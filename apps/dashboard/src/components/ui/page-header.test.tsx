import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from './page-header';

// Mock next/navigation
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe('PageHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(<PageHeader title="Test Title" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders title and description', () => {
    render(<PageHeader title="Test Title" description="Test description" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders back button when backHref provided', () => {
    render(<PageHeader title="Test" backHref="/dashboard" />);

    const backButton = screen.getByLabelText(/back/i);
    expect(backButton).toBeInTheDocument();
  });

  it('calls router.back when back button clicked', () => {
    render(<PageHeader title="Test" backHref="/dashboard" />);

    const backButton = screen.getByLabelText(/back/i);
    fireEvent.click(backButton);

    expect(mockBack).toHaveBeenCalled();
  });

  it('renders breadcrumbs when provided', () => {
    render(
      <PageHeader
        title="Test"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: 'Current' },
        ]}
      />
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(
      <PageHeader
        title="Test"
        actions={<button>Action Button</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });

  it('renders multiple action buttons', () => {
    render(
      <PageHeader
        title="Test"
        actions={
          <>
            <button>Action 1</button>
            <button>Action 2</button>
          </>
        }
      />
    );

    expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeInTheDocument();
  });

  it('renders context badge when provided', () => {
    render(
      <PageHeader
        title="Test"
        context={{
          type: 'repository',
          status: 'ACTIVE',
        }}
      />
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders context with metadata', () => {
    render(
      <PageHeader
        title="Test"
        context={{
          type: 'finding',
          status: 'OPEN',
          metadata: {
            Scanner: 'Semgrep',
            Severity: 'HIGH',
          },
        }}
      />
    );

    expect(screen.getByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('Scanner:')).toBeInTheDocument();
    expect(screen.getByText('Semgrep')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageHeader title="Test" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not render description when not provided', () => {
    render(<PageHeader title="Test" />);

    expect(screen.queryByTestId('description')).not.toBeInTheDocument();
  });

  it('does not render breadcrumbs when not provided', () => {
    render(<PageHeader title="Test" />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
