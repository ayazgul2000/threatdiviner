'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  threatModelingApi,
  WizardQuestion,
  WizardAnswer,
  WizardFlowResult,
  WizardCreateResult,
  ApiError,
} from '@/lib/api';

export interface WizardState {
  currentQuestion: WizardQuestion | null;
  answers: WizardAnswer[];
  history: WizardQuestion[];
  preview: WizardFlowResult | null;
  isLoading: boolean;
  isPreviewLoading: boolean;
  isCreating: boolean;
  error: string | null;
  isComplete: boolean;
}

export interface UseWizardFlowReturn extends WizardState {
  start: () => Promise<void>;
  selectOption: (value: string) => Promise<void>;
  goBack: () => void;
  reset: () => void;
  refreshPreview: () => Promise<void>;
  createThreatModel: (data: {
    projectId: string;
    name: string;
    description?: string;
    methodology?: string;
  }) => Promise<WizardCreateResult | null>;
}

const initialState: WizardState = {
  currentQuestion: null,
  answers: [],
  history: [],
  preview: null,
  isLoading: false,
  isPreviewLoading: false,
  isCreating: false,
  error: null,
  isComplete: false,
};

export function useWizardFlow(): UseWizardFlowReturn {
  const [state, setState] = useState<WizardState>(initialState);

  // Start the wizard by fetching the entry question
  const start = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const question = await threatModelingApi.wizard.start();

      if (!question) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'No wizard questions available. Please contact your administrator.',
        }));
        return;
      }

      setState({
        ...initialState,
        currentQuestion: question,
        history: [question],
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to start wizard';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  // Select an option and move to the next question
  const selectOption = useCallback(
    async (value: string) => {
      if (!state.currentQuestion) return;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const answer: WizardAnswer = {
        questionId: state.currentQuestion.questionId,
        selectedValue: value,
      };

      try {
        // Check if current question is terminal or selected option has no next
        const selectedOption = state.currentQuestion.options.find((o) => o.value === value);
        const isTerminal = state.currentQuestion.isTerminal || !selectedOption?.nextQuestionId;

        if (isTerminal) {
          // Wizard complete - fetch preview
          const newAnswers = [...state.answers, answer];
          setState((prev) => ({
            ...prev,
            answers: newAnswers,
            isLoading: false,
            isComplete: true,
            isPreviewLoading: true,
          }));

          // Fetch preview with all answers
          try {
            const preview = await threatModelingApi.wizard.preview(newAnswers);
            setState((prev) => ({
              ...prev,
              preview,
              isPreviewLoading: false,
            }));
          } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Failed to load preview';
            setState((prev) => ({
              ...prev,
              isPreviewLoading: false,
              error: message,
            }));
          }
        } else {
          // Get next question
          const nextQuestion = await threatModelingApi.wizard.getNextQuestion(
            state.currentQuestion.questionId,
            value
          );

          if (!nextQuestion) {
            // No more questions - treat as terminal
            const newAnswers = [...state.answers, answer];
            setState((prev) => ({
              ...prev,
              answers: newAnswers,
              isLoading: false,
              isComplete: true,
              isPreviewLoading: true,
            }));

            try {
              const preview = await threatModelingApi.wizard.preview(newAnswers);
              setState((prev) => ({
                ...prev,
                preview,
                isPreviewLoading: false,
              }));
            } catch (err) {
              const message = err instanceof ApiError ? err.message : 'Failed to load preview';
              setState((prev) => ({
                ...prev,
                isPreviewLoading: false,
                error: message,
              }));
            }
          } else {
            setState((prev) => ({
              ...prev,
              currentQuestion: nextQuestion,
              answers: [...prev.answers, answer],
              history: [...prev.history, nextQuestion],
              isLoading: false,
            }));
          }
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to proceed to next question';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
      }
    },
    [state.currentQuestion, state.answers]
  );

  // Go back to the previous question
  const goBack = useCallback(() => {
    if (state.history.length <= 1) return;

    const newHistory = [...state.history];
    newHistory.pop(); // Remove current question

    const previousQuestion = newHistory[newHistory.length - 1];
    const newAnswers = state.answers.slice(0, -1);

    setState((prev) => ({
      ...prev,
      currentQuestion: previousQuestion,
      answers: newAnswers,
      history: newHistory,
      isComplete: false,
      preview: null,
      error: null,
    }));
  }, [state.history, state.answers]);

  // Reset the wizard
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Refresh the preview
  const refreshPreview = useCallback(async () => {
    if (state.answers.length === 0) return;

    setState((prev) => ({ ...prev, isPreviewLoading: true, error: null }));

    try {
      const preview = await threatModelingApi.wizard.preview(state.answers);
      setState((prev) => ({
        ...prev,
        preview,
        isPreviewLoading: false,
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to refresh preview';
      setState((prev) => ({ ...prev, isPreviewLoading: false, error: message }));
    }
  }, [state.answers]);

  // Create the threat model from wizard answers
  const createThreatModel = useCallback(
    async (data: {
      projectId: string;
      name: string;
      description?: string;
      methodology?: string;
    }): Promise<WizardCreateResult | null> => {
      if (state.answers.length === 0) {
        setState((prev) => ({ ...prev, error: 'No answers to submit' }));
        return null;
      }

      setState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        const result = await threatModelingApi.wizard.create({
          projectId: data.projectId,
          answers: state.answers,
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
    [state.answers]
  );

  return {
    ...state,
    start,
    selectOption,
    goBack,
    reset,
    refreshPreview,
    createThreatModel,
  };
}
