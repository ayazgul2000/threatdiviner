'use client';

import { useState, useCallback } from 'react';
import {
  threatModelingApi,
  ImportPreviewResult,
  ImportCreateResult,
  ImportFileType,
  ApiError,
} from '@/lib/api';

export interface ImportState {
  preview: ImportPreviewResult | null;
  isParsing: boolean;
  isCreating: boolean;
  error: string | null;
  filename: string | null;
}

export interface UseImportReturn extends ImportState {
  parseFile: (file: File) => Promise<void>;
  parseContent: (filename: string, content: string, fileType?: ImportFileType) => Promise<void>;
  parseRepository: (repositoryId: string, filePaths?: string[]) => Promise<void>;
  createThreatModel: (data: {
    projectId: string;
    name: string;
    description?: string;
    methodology?: string;
  }) => Promise<ImportCreateResult | null>;
  reset: () => void;
}

const initialState: ImportState = {
  preview: null,
  isParsing: false,
  isCreating: false,
  error: null,
  filename: null,
};

export function useImport(): UseImportReturn {
  const [state, setState] = useState<ImportState>(initialState);

  // Parse file content
  const parseFile = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      isParsing: true,
      error: null,
      filename: file.name,
    }));

    try {
      const content = await file.text();
      const preview = await threatModelingApi.import.parse(file.name, content);

      setState((prev) => ({
        ...prev,
        preview,
        isParsing: false,
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to parse file';
      setState((prev) => ({
        ...prev,
        isParsing: false,
        error: message,
      }));
    }
  }, []);

  // Parse content directly
  const parseContent = useCallback(
    async (filename: string, content: string, fileType?: ImportFileType) => {
      setState((prev) => ({
        ...prev,
        isParsing: true,
        error: null,
        filename,
      }));

      try {
        const preview = await threatModelingApi.import.parse(filename, content, fileType);

        setState((prev) => ({
          ...prev,
          preview,
          isParsing: false,
        }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to parse content';
        setState((prev) => ({
          ...prev,
          isParsing: false,
          error: message,
        }));
      }
    },
    []
  );

  // Parse repository files
  const parseRepository = useCallback(
    async (repositoryId: string, filePaths?: string[]) => {
      setState((prev) => ({
        ...prev,
        isParsing: true,
        error: null,
        filename: 'Repository scan',
      }));

      try {
        const results = await threatModelingApi.import.fromRepository(repositoryId, filePaths);

        if (results.length === 0) {
          setState((prev) => ({
            ...prev,
            isParsing: false,
            error:
              'No parseable files found. Looking for: openapi.yaml, swagger.yaml, main.tf, architecture.drawio (in root or common folders like api/, docs/, infrastructure/)',
          }));
          return;
        }

        // Merge all results into a single preview
        const mergedPreview: ImportPreviewResult = {
          title: results[0].title || 'Repository Import',
          fileType: 'merged',
          components: [],
          dataFlows: [],
          securityConcerns: [],
        };

        for (const result of results) {
          mergedPreview.components.push(...result.components);
          mergedPreview.dataFlows.push(...result.dataFlows);
          mergedPreview.securityConcerns.push(...result.securityConcerns);
        }

        // Update title to reflect merged content
        if (results.length > 1) {
          mergedPreview.title = `Merged from ${results.length} files`;
        }

        setState((prev) => ({
          ...prev,
          preview: mergedPreview,
          isParsing: false,
          filename: `${results.length} file(s) from repository`,
        }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to scan repository';
        setState((prev) => ({
          ...prev,
          isParsing: false,
          error: message,
        }));
      }
    },
    []
  );

  // Create threat model from preview
  const createThreatModel = useCallback(
    async (data: {
      projectId: string;
      name: string;
      description?: string;
      methodology?: string;
    }): Promise<ImportCreateResult | null> => {
      if (!state.preview) {
        setState((prev) => ({ ...prev, error: 'No preview to create from' }));
        return null;
      }

      setState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        const result = await threatModelingApi.import.create({
          projectId: data.projectId,
          importResult: state.preview,
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
    [state.preview]
  );

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    parseFile,
    parseContent,
    parseRepository,
    createThreatModel,
    reset,
  };
}
