// apps/api/src/ai/chat.controller.ts
// REST controller for AI chat functionality

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, from, map, concatMap, of } from 'rxjs';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { ChatService, ChatContext, ChatSession, SendMessageResult } from './services/chat.service';
import { NlqService } from './services/nlq.service';
import { ProviderRegistryService } from './provider-registry.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

interface CreateSessionDto {
  title?: string;
  context?: ChatContext;
}

interface SendMessageDto {
  message: string;
  context?: ChatContext;
}

interface NlqQueryDto {
  query: string;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly nlqService: NlqService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  /**
   * Get AI chat status and available models
   */
  @Get('status')
  async getStatus() {
    const providers = this.providerRegistry.getAllProviders();
    const health = this.providerRegistry.getHealthStatus();
    const models = this.providerRegistry.getAllModels();

    return {
      available: providers.length > 0,
      providers: providers.map(p => ({
        name: p.name,
        displayName: p.displayName,
        available: health.find(h => h.name === p.name)?.available ?? false,
      })),
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
      })),
    };
  }

  /**
   * Create a new chat session
   */
  @Post('sessions')
  async createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ): Promise<ChatSession> {
    return this.chatService.createSession(
      user.id,
      user.tenantId,
      dto.title,
      dto.context,
    );
  }

  /**
   * List user's chat sessions
   */
  @Get('sessions')
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.chatService.listSessions(
      user.id,
      user.tenantId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Get a specific chat session
   */
  @Get('sessions/:sessionId')
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<ChatSession | null> {
    return this.chatService.getSession(sessionId, user.id, user.tenantId);
  }

  /**
   * Delete a chat session
   */
  @Delete('sessions/:sessionId')
  async deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.chatService.deleteSession(sessionId, user.id, user.tenantId);
  }

  /**
   * Clear all user's chat sessions
   */
  @Delete('sessions')
  async clearSessions(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.chatService.clearUserSessions(user.id, user.tenantId);
    return { deleted: count };
  }

  /**
   * Send a message (non-streaming)
   */
  @Post('sessions/:sessionId/messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
  ): Promise<SendMessageResult> {
    return this.chatService.sendMessage({
      sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      message: dto.message,
      context: dto.context,
    });
  }

  /**
   * Send a message with streaming response (Server-Sent Events)
   */
  @Sse('sessions/:sessionId/stream')
  streamMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    const stream = this.chatService.streamMessage({
      sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      message: decodeURIComponent(message),
      stream: true,
    });

    return from(stream).pipe(
      map(chunk => ({
        data: JSON.stringify(chunk),
      })),
    );
  }

  /**
   * Quick question (stateless, no session)
   */
  @Post('quick')
  async quickQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    // Create a temporary session, send message, then return just the response
    const session = await this.chatService.createSession(
      user.id,
      user.tenantId,
      'Quick Question',
      dto.context,
    );

    const result = await this.chatService.sendMessage({
      sessionId: session.id,
      userId: user.id,
      tenantId: user.tenantId,
      message: dto.message,
      context: dto.context,
    });

    return {
      response: result.response,
      model: result.model,
      sessionId: session.id, // Return session ID in case user wants to continue
    };
  }

  /**
   * Natural Language Query - search the codebase/findings using natural language
   */
  @Post('nlq')
  async naturalLanguageQuery(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NlqQueryDto,
  ): Promise<any> {
    return this.nlqService.query({
      query: dto.query,
      tenantId: user.tenantId,
    });
  }

  /**
   * Get NLQ suggestions based on context
   */
  @Get('nlq/suggestions')
  async getNlqSuggestions(@CurrentUser() _user: AuthenticatedUser) {
    return {
      suggestions: [
        'Show me all critical vulnerabilities from the last 7 days',
        'Which repositories have the most SQL injection findings?',
        'What CWEs are most common in our codebase?',
        'Show findings that haven\'t been fixed in over 30 days',
        'List all false positives marked this month',
        'Which scanners find the most issues?',
        'Show high severity findings in Python files',
        'What are the top OWASP categories in our findings?',
      ],
    };
  }
}
