'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  threatModelingApi,
  AiGenerationResult,
  AiCreateResult,
  ApiError,
} from '@/lib/api';

export interface AiCreationState {
  generationResult: AiGenerationResult | null;
  isGenerating: boolean;
  isRefining: boolean;
  isCreating: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

export interface UseAiCreationReturn extends AiCreationState {
  checkAvailability: () => Promise<void>;
  generate: (
    description: string,
    options?: { systemType?: string; industry?: string }
  ) => Promise<void>;
  refine: (refinementPrompt: string) => Promise<void>;
  createThreatModel: (data: {
    projectId: string;
    name: string;
    description?: string;
    methodology?: string;
  }) => Promise<AiCreateResult | null>;
  reset: () => void;
}

const initialState: AiCreationState = {
  generationResult: null,
  isGenerating: false,
  isRefining: false,
  isCreating: false,
  isAvailable: null,
  error: null,
};

export function useAiCreation(): UseAiCreationReturn {
  const [state, setState] = useState<AiCreationState>(initialState);

  // Check if AI service is available
  const checkAvailability = useCallback(async () => {
    try {
      const { available } = await threatModelingApi.ai.getStatus();
      setState((prev) => ({ ...prev, isAvailable: available }));
    } catch (err) {
      setState((prev) => ({ ...prev, isAvailable: false }));
    }
  }, []);

  // Check availability on mount
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Generate threat model from description
  const generate = useCallback(
    async (
      description: string,
      options?: { systemType?: string; industry?: string }
    ) => {
      setState((prev) => ({
        ...prev,
        isGenerating: true,
        error: null,
      }));

      try {
        const result = await threatModelingApi.ai.generate(description, options);

        setState((prev) => ({
          ...prev,
          generationResult: result,
          isGenerating: false,
        }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to generate threat model';
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: message,
        }));
      }
    },
    []
  );

  // Refine the current generation result
  const refine = useCallback(
    async (refinementPrompt: string) => {
      if (!state.generationResult) {
        setState((prev) => ({ ...prev, error: 'No generation result to refine' }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isRefining: true,
        error: null,
      }));

      try {
        const result = await threatModelingApi.ai.refine(
          state.generationResult,
          refinementPrompt
        );

        setState((prev) => ({
          ...prev,
          generationResult: result,
          isRefining: false,
        }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to refine threat model';
        setState((prev) => ({
          ...prev,
          isRefining: false,
          error: message,
        }));
      }
    },
    [state.generationResult]
  );

  // Create threat model from generation result
  const createThreatModel = useCallback(
    async (data: {
      projectId: string;
      name: string;
      description?: string;
      methodology?: string;
    }): Promise<AiCreateResult | null> => {
      if (!state.generationResult) {
        setState((prev) => ({ ...prev, error: 'No generation result to create from' }));
        return null;
      }

      setState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        const result = await threatModelingApi.ai.create({
          projectId: data.projectId,
          generationResult: state.generationResult,
          name: data.name,
          description: data.description,
          methodology: data.methodology,
        });

        setState((prev) => ({ ...prev, isCreating: false }));
        return result;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to create threat model';
        setState((prev) => ({ ...prev, isCreating: false, error: message }));
        return null;
      }
    },
    [state.generationResult]
  );

  // Reset state
  const reset = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      isAvailable: prev.isAvailable,
    }));
  }, []);

  return {
    ...state,
    checkAvailability,
    generate,
    refine,
    createThreatModel,
    reset,
  };
}
