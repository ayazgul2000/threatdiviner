import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AnalysisProgressModal } from './AnalysisProgressModal';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AnalysisProgressModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    threatModelId: 'tm-123',
    analysisRunId: 'run-456',
    onComplete: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('rendering', () => {
    it('should render modal when isOpen is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'queued' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Threagile Analysis')).toBeInTheDocument();
      });
    });

    it('should not render content when isOpen is false', () => {
      render(<AnalysisProgressModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Threagile Analysis')).not.toBeInTheDocument();
    });

    it('should display all stage labels', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'validating' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Validating')).toBeInTheDocument();
        expect(screen.getByText('Generating YAML')).toBeInTheDocument();
        expect(screen.getByText('Running Engine')).toBeInTheDocument();
        expect(screen.getByText('Processing Results')).toBeInTheDocument();
        expect(screen.getByText('AI Triage')).toBeInTheDocument();
        expect(screen.getByText('Finalizing')).toBeInTheDocument();
      });
    });
  });

  describe('stage progression', () => {
    it('should show validating stage with 5% progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'validating' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('5%')).toBeInTheDocument();
      });
    });

    it('should show generating stage with 20% progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'generating' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('20%')).toBeInTheDocument();
      });
    });

    it('should show running stage with 60% progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'running' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('60%')).toBeInTheDocument();
      });
    });

    it('should show processing stage with 80% progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'processing' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('80%')).toBeInTheDocument();
      });
    });

    it('should show triaging stage with 95% progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'triaging' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('95%')).toBeInTheDocument();
      });
    });
  });

  describe('polling behavior', () => {
    it('should poll status endpoint on mount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'running' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/threat-modeling/tm-123/analysis-runs/run-456'),
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should not poll when analysisRunId is null', () => {
      render(<AnalysisProgressModal {...defaultProps} analysisRunId={null} />);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('completion callback', () => {
    it('should call onComplete with riskCount when analysis completes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'completed', riskCount: 7 }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledWith(7);
      });
    });

    it('should call onComplete with 0 when riskCount is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'completed' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledWith(0);
      });
    });
  });

  describe('error handling', () => {
    it('should call onError when analysis fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'failed', errorMessage: 'Threagile timeout' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith('Threagile timeout');
      });
    });

    it('should call onError when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should call onError with default message when errorMessage is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'failed' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith('Analysis failed');
      });
    });
  });

  describe('button state', () => {
    it('should show disabled Analyzing button when in progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'running' }),
      });

      render(<AnalysisProgressModal {...defaultProps} />);

      await waitFor(() => {
        const button = screen.getByText('Analyzing...');
        expect(button.closest('button')).toBeDisabled();
      });
    });
  });
});
