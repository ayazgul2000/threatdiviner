import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-blue-600');
  });

  it('applies secondary variant correctly', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-gray-200');
  });

  it('applies danger variant correctly', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-red-600');
  });

  it('applies ghost variant correctly', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-transparent');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toContain('px-3');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button').className).toContain('px-4');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toContain('px-6');
  });

  it('handles click events', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Clickable</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when loading prop is true', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    const svg = document.querySelector('svg.animate-spin');
    expect(svg).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Button ref={ref}>With Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });
});
