import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSelector } from './project-selector';
import { ProjectProvider } from '@/contexts/project-context';

const mockProjects = [
  { id: '1', name: 'Project 1', status: 'ACTIVE', description: 'Test project 1' },
  { id: '2', name: 'Project 2', status: 'ACTIVE', description: 'Test project 2' },
];

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('ProjectSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProjects),
    });
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  const renderWithProvider = () => {
    return render(
      <ProjectProvider>
        <ProjectSelector />
      </ProjectProvider>
    );
  };

  it('renders project selector', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('fetches projects on mount', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.any(Object)
      );
    });
  });

  it('displays loading state initially', () => {
    renderWithProvider();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows projects in dropdown when clicked', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });
  });

  it('shows create project option', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/new project/i)).toBeInTheDocument();
    });
  });

  it('selects a project when clicked', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const project1 = screen.getByText('Project 1');
      fireEvent.click(project1);
    });

    // Verify localStorage was called to save selection
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('displays currently selected project', async () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockProjects[0]));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
    });
  });

  it('opens create project modal when clicking new project', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const newProjectBtn = screen.getByText(/new project/i);
      fireEvent.click(newProjectBtn);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Should still render without crashing
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows empty state when no projects', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/no projects/i)).toBeInTheDocument();
    });
  });
});
