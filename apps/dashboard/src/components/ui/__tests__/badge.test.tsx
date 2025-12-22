import { render, screen } from '@testing-library/react';
import { Badge, SeverityBadge, StatusBadge } from '../badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies default variant', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-gray-100');
  });

  it('applies success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-green-100');
  });

  it('applies warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('applies danger variant', () => {
    render(<Badge variant="danger">Danger</Badge>);
    const badge = screen.getByText('Danger');
    expect(badge.className).toContain('bg-red-100');
  });

  it('applies info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-blue-100');
  });

  it('applies critical severity variant', () => {
    render(<Badge variant="critical">Critical</Badge>);
    const badge = screen.getByText('Critical');
    expect(badge.className).toContain('bg-purple-100');
  });

  it('applies high severity variant', () => {
    render(<Badge variant="high">High</Badge>);
    const badge = screen.getByText('High');
    expect(badge.className).toContain('bg-red-100');
  });

  it('applies medium severity variant', () => {
    render(<Badge variant="medium">Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge.className).toContain('bg-orange-100');
  });

  it('applies low severity variant', () => {
    render(<Badge variant="low">Low</Badge>);
    const badge = screen.getByText('Low');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('applies size sm by default', () => {
    render(<Badge>Small</Badge>);
    const badge = screen.getByText('Small');
    expect(badge.className).toContain('px-2');
    expect(badge.className).toContain('text-xs');
  });

  it('applies size md correctly', () => {
    render(<Badge size="md">Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge.className).toContain('px-2.5');
    expect(badge.className).toContain('text-sm');
  });

  it('applies custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('custom-badge');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Badge ref={ref}>With Ref</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});

describe('SeverityBadge', () => {
  it('renders critical severity with correct variant', () => {
    render(<SeverityBadge severity="critical" />);
    const badge = screen.getByText('CRITICAL');
    expect(badge.className).toContain('bg-purple-100');
  });

  it('renders high severity with correct variant', () => {
    render(<SeverityBadge severity="high" />);
    const badge = screen.getByText('HIGH');
    expect(badge.className).toContain('bg-red-100');
  });

  it('renders medium severity with correct variant', () => {
    render(<SeverityBadge severity="medium" />);
    const badge = screen.getByText('MEDIUM');
    expect(badge.className).toContain('bg-orange-100');
  });

  it('renders low severity with correct variant', () => {
    render(<SeverityBadge severity="low" />);
    const badge = screen.getByText('LOW');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('renders info severity with correct variant', () => {
    render(<SeverityBadge severity="info" />);
    const badge = screen.getByText('INFO');
    expect(badge.className).toContain('bg-blue-100');
  });

  it('allows custom children override', () => {
    render(<SeverityBadge severity="high">Custom High</SeverityBadge>);
    expect(screen.getByText('Custom High')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<SeverityBadge ref={ref} severity="high" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});

describe('StatusBadge', () => {
  it('renders pending status with default variant', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('Pending');
    expect(badge.className).toContain('bg-gray-100');
  });

  it('renders running status with info variant', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByText('Running');
    expect(badge.className).toContain('bg-blue-100');
  });

  it('renders completed status with success variant', () => {
    render(<StatusBadge status="completed" />);
    const badge = screen.getByText('Completed');
    expect(badge.className).toContain('bg-green-100');
  });

  it('renders failed status with danger variant', () => {
    render(<StatusBadge status="failed" />);
    const badge = screen.getByText('Failed');
    expect(badge.className).toContain('bg-red-100');
  });

  it('renders cancelled status with warning variant', () => {
    render(<StatusBadge status="cancelled" />);
    const badge = screen.getByText('Cancelled');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('allows custom children override', () => {
    render(<StatusBadge status="running">In Progress</StatusBadge>);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<StatusBadge ref={ref} status="completed" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});
