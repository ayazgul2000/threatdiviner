'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  Sparkles,
  X,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { nlqApi } from '@/lib/api';

export function NlqSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load suggestions on mount
  useEffect(() => {
    loadSuggestions();
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadSuggestions = async () => {
    try {
      const { suggestions } = await nlqApi.getSuggestions();
      setSuggestions(suggestions);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await nlqApi.query(query);
      setResults(result);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch();
  };

  const goToChat = () => {
    router.push(`/dashboard/chat?q=${encodeURIComponent(query)}`);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search Button/Trigger */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search with AI...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-white rounded border border-slate-200">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex items-center gap-3 p-4 border-b border-slate-200">
              <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about your security findings..."
                className="flex-1 text-lg outline-none placeholder:text-slate-400"
                autoFocus
              />
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Search
              </button>
            </form>

            {/* Content Area */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Error */}
              {error && (
                <div className="p-4 text-red-600 text-sm bg-red-50">
                  {error}
                </div>
              )}

              {/* Results */}
              {results && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-700">
                      {results.intent || 'Results'}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {results.results?.length || 0} results
                    </span>
                  </div>

                  {results.explanation && (
                    <p className="text-sm text-slate-600 mb-4 p-3 bg-blue-50 rounded-lg">
                      {results.explanation}
                    </p>
                  )}

                  {results.results?.length > 0 ? (
                    <div className="space-y-2">
                      {results.results.slice(0, 5).map((item: any, index: number) => (
                        <div
                          key={index}
                          className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          <p className="text-sm font-medium text-slate-700">
                            {item.title || item.name || `Result ${index + 1}`}
                          </p>
                          {item.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No results found</p>
                  )}

                  {/* Chat Option */}
                  <button
                    onClick={goToChat}
                    className="w-full mt-4 flex items-center justify-center gap-2 p-3 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Continue this conversation in AI Chat
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Suggestions (when no results) */}
              {!results && !error && (
                <div className="p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Try asking
                  </p>
                  <div className="space-y-1">
                    {suggestions.slice(0, 6).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full flex items-center gap-3 p-2 text-sm text-slate-600 rounded-lg hover:bg-slate-50 text-left"
                      >
                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{suggestion}</span>
                      </button>
                    ))}
                  </div>

                  {/* Quick Action: Go to Chat */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        router.push('/dashboard/chat');
                      }}
                      className="w-full flex items-center justify-between p-3 text-sm text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span>Open AI Chat for detailed conversations</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200">↵</kbd>
                <span>to search</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200">esc</kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
