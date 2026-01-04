'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '@/lib/api';

interface UseApiQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError | Error) => void;
  initialData?: T;
  staleTime?: number;
}

interface UseApiQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | Error | null;
  refetch: () => Promise<void>;
  isFetching: boolean;
  isStale: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Simple in-memory cache
const queryCache = new Map<string, CacheEntry<any>>();

export function useApiQuery<T>(
  key: string | string[],
  queryFn: () => Promise<T>,
  options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
  const {
    enabled = true,
    refetchInterval,
    onSuccess,
    onError,
    initialData,
    staleTime = 30000, // 30 seconds default stale time
  } = options;

  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<{
    data: T | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: ApiError | Error | null;
    isStale: boolean;
  }>(() => {
    const cached = queryCache.get(cacheKey);
    if (cached) {
      const isStale = Date.now() - cached.timestamp > staleTime;
      return {
        data: cached.data as T,
        isLoading: false,
        isFetching: isStale && enabled,
        isError: false,
        error: null,
        isStale,
      };
    }
    return {
      data: initialData,
      isLoading: enabled,
      isFetching: enabled,
      isError: false,
      error: null,
      isStale: true,
    };
  });

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    setState(prev => ({
      ...prev,
      isFetching: true,
      isError: false,
      error: null,
    }));

    try {
      const data = await queryFn();

      if (!mountedRef.current) return;

      // Update cache
      queryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      setState({
        data,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        isStale: false,
      });

      onSuccess?.(data);
    } catch (error) {
      if (!mountedRef.current) return;

      const apiError = error instanceof ApiError ? error : error instanceof Error ? error : new Error('Unknown error');

      setState(prev => ({
        ...prev,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: apiError,
      }));

      onError?.(apiError);
    }
  }, [queryFn, cacheKey, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      const cached = queryCache.get(cacheKey);
      const isStale = !cached || Date.now() - cached.timestamp > staleTime;

      if (isStale) {
        fetchData();
      }
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, cacheKey, staleTime, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      intervalRef.current = setInterval(fetchData, refetchInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refetchInterval, enabled, fetchData]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    isError: state.isError,
    error: state.error,
    refetch: fetchData,
    isStale: state.isStale,
  };
}

// Mutation hook for POST/PUT/DELETE operations
interface UseApiMutationOptions<T, V> {
  onSuccess?: (data: T, variables: V) => void;
  onError?: (error: ApiError | Error, variables: V) => void;
  onSettled?: (data: T | undefined, error: ApiError | Error | null, variables: V) => void;
  invalidateKeys?: string[];
}

interface UseApiMutationResult<T, V> {
  mutate: (variables: V) => void;
  mutateAsync: (variables: V) => Promise<T>;
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | Error | null;
  isSuccess: boolean;
  reset: () => void;
}

export function useApiMutation<T, V = void>(
  mutationFn: (variables: V) => Promise<T>,
  options: UseApiMutationOptions<T, V> = {}
): UseApiMutationResult<T, V> {
  const { onSuccess, onError, onSettled, invalidateKeys } = options;

  const [state, setState] = useState<{
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
    error: ApiError | Error | null;
    isSuccess: boolean;
  }>({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    isSuccess: false,
  });

  const mutateAsync = useCallback(
    async (variables: V): Promise<T> => {
      setState({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        isSuccess: false,
      });

      try {
        const data = await mutationFn(variables);

        setState({
          data,
          isLoading: false,
          isError: false,
          error: null,
          isSuccess: true,
        });

        // Invalidate cache keys
        if (invalidateKeys) {
          invalidateKeys.forEach(key => {
            queryCache.delete(key);
          });
        }

        onSuccess?.(data, variables);
        onSettled?.(data, null, variables);

        return data;
      } catch (error) {
        const apiError = error instanceof ApiError ? error : error instanceof Error ? error : new Error('Unknown error');

        setState({
          data: undefined,
          isLoading: false,
          isError: true,
          error: apiError,
          isSuccess: false,
        });

        onError?.(apiError, variables);
        onSettled?.(undefined, apiError, variables);

        throw error;
      }
    },
    [mutationFn, onSuccess, onError, onSettled, invalidateKeys]
  );

  const mutate = useCallback(
    (variables: V) => {
      mutateAsync(variables).catch(() => {
        // Error already handled in mutateAsync
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setState({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      isSuccess: false,
    });
  }, []);

  return {
    mutate,
    mutateAsync,
    data: state.data,
    isLoading: state.isLoading,
    isError: state.isError,
    error: state.error,
    isSuccess: state.isSuccess,
    reset,
  };
}

// Helper to invalidate cache
export function invalidateQueries(keys: string | string[]) {
  const keysToInvalidate = Array.isArray(keys) ? keys : [keys];
  keysToInvalidate.forEach(key => {
    // Invalidate exact match and prefix matches
    queryCache.forEach((_, cacheKey) => {
      if (cacheKey === key || cacheKey.startsWith(`${key}:`)) {
        queryCache.delete(cacheKey);
      }
    });
  });
}

// Helper to clear all cache
export function clearQueryCache() {
  queryCache.clear();
}
