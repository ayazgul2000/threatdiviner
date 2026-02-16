'use client';

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysis } from './useAnalysis';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAnalysis());

      expect(result.current.isStarting).toBe(false);
      expect(result.current.analysisRunId).toBeNull();
      expect(result.current.gaps).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('startAnalysis', () => {
    it('should start analysis successfully and return analysisRunId', async () => {
      const mockResponse = {
        analysisRunId: 'run-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAnalysis());

      let analysisResult: any;
      await act(async () => {
        analysisResult = await result.current.startAnalysis('tm-123');
      });

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.analysisRunId).toBe('run-123');
      expect(result.current.analysisRunId).toBe('run-123');
      expect(result.current.isStarting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle 422 response with gap detection result', async () => {
      const mockGaps = {
        valid: false,
        gaps: [
          {
            elementType: 'asset',
            elementId: 'c1',
            elementName: 'Server',
            field: 'technology',
            rule: 'required',
            message: 'Technology type is required',
            suggestions: ['web-application', 'database'],
          },
        ],
        summary: {
          totalGaps: 1,
          assetGaps: 1,
          linkGaps: 0,
          boundaryGaps: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => mockGaps,
      });

      const { result } = renderHook(() => useAnalysis());

      let analysisResult: any;
      await act(async () => {
        analysisResult = await result.current.startAnalysis('tm-123');
      });

      expect(analysisResult.success).toBe(false);
      expect(analysisResult.gaps).toEqual(mockGaps);
      expect(result.current.gaps).toEqual(mockGaps);
      expect(result.current.isStarting).toBe(false);
      expect(result.current.analysisRunId).toBeNull();
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      const { result } = renderHook(() => useAnalysis());

      let analysisResult: any;
      await act(async () => {
        analysisResult = await result.current.startAnalysis('tm-123');
      });

      expect(analysisResult.success).toBe(false);
      expect(analysisResult.error).toBe('Internal server error');
      expect(result.current.error).toBe('Internal server error');
      expect(result.current.isStarting).toBe(false);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAnalysis());

      let analysisResult: any;
      await act(async () => {
        analysisResult = await result.current.startAnalysis('tm-123');
      });

      expect(analysisResult.success).toBe(false);
      expect(analysisResult.error).toBe('Network error');
      expect(result.current.error).toBe('Network error');
      expect(result.current.isStarting).toBe(false);
    });

    it('should pass skipGapCheck query parameter when option is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ analysisRunId: 'run-456' }),
      });

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.startAnalysis('tm-123', { skipGapCheck: true });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('?skipGapCheck=true'),
        expect.any(Object)
      );
    });

    it('should set isStarting to true during analysis', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useAnalysis());

      act(() => {
        result.current.startAnalysis('tm-123');
      });

      // Should be starting
      expect(result.current.isStarting).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          status: 200,
          json: async () => ({ analysisRunId: 'run-789' }),
        });
      });

      await waitFor(() => {
        expect(result.current.isStarting).toBe(false);
      });
    });
  });

  describe('clearAnalysis', () => {
    it('should reset all state', async () => {
      // First, set up some state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ analysisRunId: 'run-123' }),
      });

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.startAnalysis('tm-123');
      });

      expect(result.current.analysisRunId).toBe('run-123');

      // Now clear
      act(() => {
        result.current.clearAnalysis();
      });

      expect(result.current.isStarting).toBe(false);
      expect(result.current.analysisRunId).toBeNull();
      expect(result.current.gaps).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should clear error state', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Some error'));

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.startAnalysis('tm-123');
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearAnalysis();
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear gaps state', async () => {
      const mockGaps = {
        valid: false,
        gaps: [{ elementType: 'asset', elementId: 'c1', field: 'technology' }],
        summary: { totalGaps: 1, assetGaps: 1, linkGaps: 0, boundaryGaps: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => mockGaps,
      });

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.startAnalysis('tm-123');
      });

      expect(result.current.gaps).toEqual(mockGaps);

      act(() => {
        result.current.clearAnalysis();
      });

      expect(result.current.gaps).toBeNull();
    });
  });
});
