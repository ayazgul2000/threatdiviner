// apps/api/src/ai/services/chat.service.ts
// AI-powered security chat service with context management

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../ai.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    toolCalls?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  messages: ChatMessage[];
  context?: ChatContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatContext {
  // Security context
  findingIds?: string[];
  scanId?: string;
  repositoryId?: string;
  threatModelId?: string;

  // Knowledge context
  cweIds?: string[];
  cveIds?: string[];
  owaspCategories?: string[];

  // Custom context
  customContext?: string;
}

export interface SendMessageInput {
  sessionId: string;
  userId: string;
  tenantId: string;
  message: string;
  context?: ChatContext;
  stream?: boolean;
}

export interface SendMessageResult {
  messageId: string;
  response: string;
  model: string;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly maxMessagesPerSession = 100;
  private readonly maxContextTokens = 8000;

  // In-memory session store (would use Redis in production)
  private sessions = new Map<string, ChatSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    tenantId: string,
    title?: string,
    initialContext?: ChatContext,
  ): Promise<ChatSession> {
    const sessionId = crypto.randomUUID();

    const session: ChatSession = {
      id: sessionId,
      userId,
      tenantId,
      title: title || 'New Security Chat',
      messages: [],
      context: initialContext,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add system message with context
    const systemMessage = await this.buildSystemMessage(tenantId, initialContext);
    session.messages.push({
      id: crypto.randomUUID(),
      role: 'system',
      content: systemMessage,
      timestamp: new Date(),
    });

    this.sessions.set(sessionId, session);

    // Persist to database
    await this.persistSession(session);

    this.logger.log(`Chat session created: ${sessionId} for user ${userId}`);

    return session;
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { sessionId, userId, tenantId, message, context } = input;

    let session = this.sessions.get(sessionId);
    if (!session) {
      // Try to load from database
      session = await this.loadSession(sessionId, userId, tenantId);
      if (!session) {
        throw new BadRequestException('Chat session not found');
      }
    }

    // Validate ownership
    if (session.userId !== userId || session.tenantId !== tenantId) {
      throw new BadRequestException('Session access denied');
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    // Update context if provided
    if (context) {
      session.context = { ...session.context, ...context };
    }

    // Prepare messages for AI
    const aiMessages = await this.prepareAIMessages(session);

    // Get AI response
    const response = await this.aiService.complete({
      systemPrompt: session.messages[0]?.content || this.getDefaultSystemPrompt(),
      messages: aiMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      maxTokens: 2000,
      temperature: 0.7,
    });

    // Add assistant message
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        model: response.model,
        tokens: response.usage?.totalTokens,
      },
    };
    session.messages.push(assistantMessage);
    session.updatedAt = new Date();

    // Update title if first real exchange
    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = this.generateTitle(message);
    }

    // Enforce message limit
    this.enforceMessageLimit(session);

    // Update session
    this.sessions.set(sessionId, session);
    await this.persistSession(session);

    // Emit event for analytics
    this.eventEmitter.emit('chat.message', {
      sessionId,
      userId,
      tenantId,
      tokens: response.usage,
    });

    return {
      messageId: assistantMessage.id,
      response: response.content,
      model: response.model,
      tokens: response.usage ? {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
      } : undefined,
    };
  }

  /**
   * Stream a message response
   */
  async *streamMessage(input: SendMessageInput): AsyncIterable<StreamChunk> {
    const { sessionId, userId, tenantId, message, context } = input;

    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.loadSession(sessionId, userId, tenantId);
      if (!session) {
        throw new BadRequestException('Chat session not found');
      }
    }

    if (session.userId !== userId || session.tenantId !== tenantId) {
      throw new BadRequestException('Session access denied');
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    if (context) {
      session.context = { ...session.context, ...context };
    }

    const aiMessages = await this.prepareAIMessages(session);

    let fullResponse = '';

    for await (const chunk of this.aiService.streamComplete({
      systemPrompt: session.messages[0]?.content || this.getDefaultSystemPrompt(),
      messages: aiMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      maxTokens: 2000,
      temperature: 0.7,
    })) {
      fullResponse += chunk.content;
      yield chunk;
    }

    // Add assistant message after streaming complete
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
    };
    session.messages.push(assistantMessage);
    session.updatedAt = new Date();

    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = this.generateTitle(message);
    }

    this.enforceMessageLimit(session);
    this.sessions.set(sessionId, session);
    await this.persistSession(session);
  }

  /**
   * Get chat session
   */
  async getSession(sessionId: string, userId: string, tenantId: string): Promise<ChatSession | null> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.loadSession(sessionId, userId, tenantId);
    }

    if (!session || session.userId !== userId || session.tenantId !== tenantId) {
      return null;
    }

    return session;
  }

  /**
   * List user's chat sessions
   */
  async listSessions(
    userId: string,
    tenantId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ sessions: Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>[]; total: number }> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId, tenantId },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const total = await this.prisma.chatSession.count({
      where: { userId, tenantId },
    });

    return { sessions, total };
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string, userId: string, tenantId: string): Promise<void> {
    this.sessions.delete(sessionId);

    await this.prisma.chatSession.deleteMany({
      where: { id: sessionId, userId, tenantId },
    });

    this.logger.log(`Chat session deleted: ${sessionId}`);
  }

  /**
   * Clear all sessions for a user
   */
  async clearUserSessions(userId: string, tenantId: string): Promise<number> {
    // Clear from memory
    for (const [id, session] of this.sessions) {
      if (session.userId === userId && session.tenantId === tenantId) {
        this.sessions.delete(id);
      }
    }

    // Clear from database
    const result = await this.prisma.chatSession.deleteMany({
      where: { userId, tenantId },
    });

    return result.count;
  }

  // ========== Private Methods ==========

  private async buildSystemMessage(tenantId: string, context?: ChatContext): Promise<string> {
    let systemPrompt = this.getDefaultSystemPrompt();

    if (context) {
      const contextParts: string[] = [];

      // Add finding context
      if (context.findingIds?.length) {
        const findings = await this.prisma.securityFinding.findMany({
          where: { id: { in: context.findingIds } },
          take: 5,
        });
        if (findings.length) {
          contextParts.push(`\n\nRelevant security findings:\n${findings.map(f =>
            `- [${f.severity}] ${f.title} in ${f.filePath}:${f.startLine}`
          ).join('\n')}`);
        }
      }

      // Add repository context
      if (context.repositoryId) {
        const repo = await this.prisma.repository.findUnique({
          where: { id: context.repositoryId },
          select: { name: true, defaultBranch: true, language: true },
        });
        if (repo) {
          contextParts.push(`\n\nWorking with repository: ${repo.name} (${repo.language || 'Unknown language'})`);
        }
      }

      // Add CWE context
      if (context.cweIds?.length) {
        contextParts.push(`\n\nRelevant CWE IDs: ${context.cweIds.join(', ')}`);
      }

      // Add custom context
      if (context.customContext) {
        contextParts.push(`\n\nAdditional context:\n${context.customContext}`);
      }

      if (contextParts.length) {
        systemPrompt += contextParts.join('');
      }
    }

    return systemPrompt;
  }

  private getDefaultSystemPrompt(): string {
    return `You are ThreatDiviner's AI security assistant. You help security engineers with:

1. **Vulnerability Analysis**: Explain vulnerabilities, their impact, and remediation strategies
2. **Code Security**: Review code snippets for security issues and suggest fixes
3. **Threat Modeling**: Assist with threat model creation and analysis
4. **Security Best Practices**: Provide guidance on secure coding and architecture
5. **Compliance**: Help with understanding security compliance requirements
6. **Attack Patterns**: Explain attack techniques and defensive measures

Guidelines:
- Be concise but thorough in your explanations
- Always consider the security context when answering
- Provide actionable recommendations when possible
- Reference specific CWEs, CVEs, or OWASP categories when relevant
- If unsure, acknowledge limitations and suggest further research

You have access to the user's security findings, repositories, and threat models when provided in context.`;
  }

  private async prepareAIMessages(session: ChatSession): Promise<ChatMessage[]> {
    // Filter out system messages and get conversation history
    const conversationMessages = session.messages.filter(m => m.role !== 'system');

    // Keep recent messages within token budget
    // Simple approximation: ~4 chars per token
    let totalChars = 0;
    const maxChars = this.maxContextTokens * 4;
    const recentMessages: ChatMessage[] = [];

    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgChars = msg.content.length;

      if (totalChars + msgChars > maxChars) {
        break;
      }

      totalChars += msgChars;
      recentMessages.unshift(msg);
    }

    return recentMessages;
  }

  private generateTitle(firstMessage: string): string {
    // Generate a title from the first message
    const words = firstMessage.split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    return title || 'Security Chat';
  }

  private enforceMessageLimit(session: ChatSession): void {
    // Keep system message + recent conversation
    if (session.messages.length > this.maxMessagesPerSession) {
      const systemMessage = session.messages.find(m => m.role === 'system');
      const recentMessages = session.messages
        .filter(m => m.role !== 'system')
        .slice(-this.maxMessagesPerSession + 1);

      session.messages = systemMessage
        ? [systemMessage, ...recentMessages]
        : recentMessages;
    }
  }

  private async persistSession(session: ChatSession): Promise<void> {
    await this.prisma.chatSession.upsert({
      where: { id: session.id },
      update: {
        title: session.title,
        messages: session.messages as any,
        context: session.context as any,
        updatedAt: session.updatedAt,
      },
      create: {
        id: session.id,
        userId: session.userId,
        tenantId: session.tenantId,
        title: session.title,
        messages: session.messages as any,
        context: session.context as any,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  }

  private async loadSession(
    sessionId: string,
    userId: string,
    tenantId: string,
  ): Promise<ChatSession | null> {
    const dbSession = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId, tenantId },
    });

    if (!dbSession) return null;

    const session: ChatSession = {
      id: dbSession.id,
      userId: dbSession.userId,
      tenantId: dbSession.tenantId,
      title: dbSession.title,
      messages: dbSession.messages as ChatMessage[],
      context: dbSession.context as ChatContext,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt,
    };

    // Cache in memory
    this.sessions.set(sessionId, session);

    return session;
  }
}
