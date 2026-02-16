'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseFetchOptions {
  immediate?: boolean;
  dependencies?: any[];
}

export function useFetch<T>(
  endpoint: string,
  options: UseFetchOptions = {}
): FetchState<T> & { refetch: () => Promise<void> } {
  const { immediate = true, dependencies = [] } = options;
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : null;

      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setState({ data, loading: false, error: null });
    } catch (error: any) {
      if (mountedRef.current) {
        setState({ data: null, loading: false, error: error.message });
      }
    }
  }, [endpoint]);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      fetchData();
    }
    return () => {
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, fetchData, ...dependencies]);

  return { ...state, refetch: fetchData };
}

interface UseMutationOptions<T, V> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface MutationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useMutation<T, V = any>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
  options: UseMutationOptions<T, V> = {}
): MutationState<T> & { mutate: (variables?: V) => Promise<T | null> } {
  const { onSuccess, onError } = options;
  const [state, setState] = useState<MutationState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (variables?: V): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });

    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : null;

      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: variables ? JSON.stringify(variables) : undefined,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = res.status === 204 ? null : await res.json();
      setState({ data, loading: false, error: null });
      onSuccess?.(data);
      return data;
    } catch (error: any) {
      setState({ data: null, loading: false, error: error.message });
      onError?.(error.message);
      return null;
    }
  }, [endpoint, method, onSuccess, onError]);

  return { ...state, mutate };
}

// Export API_URL for direct use
export { API_URL };
