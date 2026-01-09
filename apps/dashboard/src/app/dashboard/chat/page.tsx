'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
  Clock,
  ChevronRight,
  X,
  Zap,
} from 'lucide-react';
import { chatApi, ChatSession, ChatMessage, ChatContext } from '@/lib/api';

type SessionSummary = Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>;

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; providers: any[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sample prompts for quick start
  const samplePrompts = [
    'Explain SQL injection vulnerabilities and how to prevent them',
    'What are the OWASP Top 10 for 2021?',
    'How do I fix a cross-site scripting (XSS) vulnerability?',
    'What security headers should I implement?',
    'Explain the difference between authentication and authorization',
    'How do I securely store passwords in my application?',
  ];

  // Load chat status and sessions on mount
  useEffect(() => {
    loadStatus();
    loadSessions();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const loadStatus = async () => {
    try {
      const status = await chatApi.getStatus();
      setAiStatus(status);
    } catch (err) {
      console.error('Failed to load AI status:', err);
    }
  };

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const { sessions } = await chatApi.listSessions();
      setSessions(sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const session = await chatApi.getSession(sessionId);
      setCurrentSession(session);
      setError(null);
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Failed to load chat session');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      setIsLoading(true);
      const session = await chatApi.createSession('New Chat');
      setCurrentSession(session);
      setSessions(prev => [{
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }, ...prev]);
      setError(null);
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create new chat');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await chatApi.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || isSending) return;

    // Create session if needed
    let session = currentSession;
    if (!session) {
      try {
        session = await chatApi.createSession('New Chat');
        setCurrentSession(session);
        setSessions(prev => [{
          id: session!.id,
          title: session!.title,
          createdAt: session!.createdAt,
          updatedAt: session!.updatedAt
        }, ...prev]);
      } catch (err) {
        setError('Failed to create chat session');
        return;
      }
    }

    const userMessage = message;
    setMessage('');
    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setCurrentSession(prev => prev ? {
      ...prev,
      messages: [...prev.messages, tempUserMessage],
    } : null);

    try {
      const result = await chatApi.sendMessage(session.id, userMessage);

      // Update with actual response
      const assistantMessage: ChatMessage = {
        id: result.messageId,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
        metadata: {
          model: result.model,
          tokens: result.tokens ? result.tokens.input + result.tokens.output : undefined,
        },
      };

      setCurrentSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages.slice(0, -1), tempUserMessage, assistantMessage],
        title: prev.messages.length <= 1 ? userMessage.slice(0, 50) : prev.title,
      } : null);

      // Update session title in list
      setSessions(prev => prev.map(s =>
        s.id === session!.id
          ? { ...s, title: session!.messages.length <= 1 ? userMessage.slice(0, 50) : s.title, updatedAt: new Date().toISOString() }
          : s
      ));
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      // Remove optimistic message
      setCurrentSession(prev => prev ? {
        ...prev,
        messages: prev.messages.slice(0, -1),
      } : null);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setMessage(prompt);
    inputRef.current?.focus();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex bg-slate-50 rounded-lg overflow-hidden">
      {/* Sessions Sidebar */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={createNewSession}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No chat history yet
            </div>
          ) : (
            <div className="py-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50 ${
                    currentSession?.id === session.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                  }`}
                  onClick={() => loadSession(session.id)}
                >
                  <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(session.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Status */}
        {aiStatus && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${aiStatus.available ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-600">
                {aiStatus.available ? 'AI Available' : 'AI Unavailable'}
              </span>
            </div>
            {aiStatus.providers.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {aiStatus.providers.filter(p => p.available).map(p => p.displayName).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!currentSession ? (
          /* Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              ThreatDiviner AI Assistant
            </h2>
            <p className="text-slate-500 text-center max-w-md mb-8">
              Ask questions about security vulnerabilities, get remediation guidance,
              or analyze your findings with AI-powered insights.
            </p>

            {/* Sample Prompts */}
            <div className="w-full max-w-2xl">
              <p className="text-sm font-medium text-slate-600 mb-3">Try asking:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {samplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptClick(prompt)}
                    className="flex items-center gap-3 p-3 text-left text-sm text-slate-600 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <Zap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="line-clamp-2">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-slate-800">{currentSession.title}</h2>
                </div>
                <button
                  onClick={() => setCurrentSession(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentSession.messages
                .filter(m => m.role !== 'system')
                .map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div className={`text-sm whitespace-pre-wrap ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-700'
                    }`}>
                      {msg.content}
                    </div>
                    <div className={`text-xs mt-2 ${
                      msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                    }`}>
                      {formatTime(msg.timestamp)}
                      {msg.metadata?.model && (
                        <span className="ml-2">via {msg.metadata.model}</span>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-6 py-2">
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <form onSubmit={sendMessage} className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about security vulnerabilities, remediation, or best practices..."
                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={1}
                    disabled={isSending}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!message.trim() || isSending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
              <p className="text-xs text-slate-400 mt-2 text-center">
                AI responses are generated based on security knowledge. Always verify recommendations.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
