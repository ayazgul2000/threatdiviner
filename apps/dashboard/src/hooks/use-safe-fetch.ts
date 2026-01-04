'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isTimeout: boolean;
}

interface SafeFetchOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

export function useSafeFetch<T>(options: SafeFetchOptions = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    onError,
  } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
    isTimeout: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchWithTimeout = useCallback(
    async (
      url: string,
      fetchOptions?: RequestInit,
      timeout: number = timeoutMs,
    ): Promise<Response> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    [timeoutMs],
  );

  const fetchWithRetry = useCallback(
    async (
      url: string,
      fetchOptions?: RequestInit,
      remainingRetries: number = retries,
    ): Promise<Response> => {
      try {
        return await fetchWithTimeout(url, fetchOptions);
      } catch (error: unknown) {
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        if (remainingRetries > 0 && !isAbortError) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return fetchWithRetry(url, fetchOptions, remainingRetries - 1);
        }
        throw error;
      }
    },
    [fetchWithTimeout, retries, retryDelay],
  );

  const fetchData = useCallback(
    async (
      endpoint: string,
      fetchOptions?: RequestInit,
    ): Promise<T | null> => {
      if (!mountedRef.current) return null;

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        isTimeout: false,
      }));

      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('token') || sessionStorage.getItem('token')
            : null;

        const url = endpoint.startsWith('http')
          ? endpoint
          : `${API_URL}${endpoint}`;

        const response = await fetchWithRetry(url, {
          ...fetchOptions,
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...fetchOptions?.headers,
          },
          credentials: 'include',
        });

        if (!mountedRef.current) return null;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `HTTP Error: ${response.status}`,
          );
        }

        const data = response.status === 204 ? null : await response.json();

        if (mountedRef.current) {
          setState({
            data,
            loading: false,
            error: null,
            isTimeout: false,
          });
        }

        return data;
      } catch (error: unknown) {
        if (!mountedRef.current) return null;

        const isAbortError = error instanceof Error && error.name === 'AbortError';
        const errorMessage = isAbortError
          ? 'Request timed out'
          : error instanceof Error
            ? error.message
            : 'Unknown error occurred';

        setState({
          data: null,
          loading: false,
          error: errorMessage,
          isTimeout: isAbortError,
        });

        if (error instanceof Error) {
          onError?.(error);
        }

        return null;
      }
    },
    [fetchWithRetry, onError],
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      data: null,
      loading: false,
      error: null,
      isTimeout: false,
    });
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  return {
    ...state,
    fetchData,
    reset,
    cancel,
  };
}

// Simple fetch function with timeout for one-off requests
export async function safeFetch<T>(
  endpoint: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<{ data: T | null; error: string | null }> {
  const { timeoutMs = DEFAULT_TIMEOUT, ...fetchOptions } = options || {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : null;

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...fetchOptions?.headers,
      },
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorData.message || `HTTP Error: ${response.status}`,
      };
    }

    const data = response.status === 204 ? null : await response.json();
    return { data, error: null };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    return {
      data: null,
      error: isAbortError
        ? 'Request timed out'
        : error instanceof Error
          ? error.message
          : 'Unknown error occurred',
    };
  }
}
