import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default variant', () => {
    render(<Card>Default Card</Card>);
    const card = screen.getByText('Default Card').closest('div');
    expect(card?.className).toContain('bg-white');
  });

  it('applies bordered variant', () => {
    render(<Card variant="bordered">Bordered Card</Card>);
    const card = screen.getByText('Bordered Card').closest('div');
    expect(card?.className).toContain('border');
  });

  it('applies elevated variant', () => {
    render(<Card variant="elevated">Elevated Card</Card>);
    const card = screen.getByText('Elevated Card').closest('div');
    expect(card?.className).toContain('shadow-lg');
  });

  it('applies custom className', () => {
    render(<Card className="custom-card">Custom Card</Card>);
    const card = screen.getByText('Custom Card').closest('div');
    expect(card?.className).toContain('custom-card');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Card ref={ref}>With Ref</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('applies margin-bottom class', () => {
    render(<CardHeader>Header</CardHeader>);
    const header = screen.getByText('Header').closest('div');
    expect(header?.className).toContain('mb-4');
  });
});

describe('CardTitle', () => {
  it('renders as h3 element', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title');
  });

  it('applies correct styling', () => {
    render(<CardTitle>Styled Title</CardTitle>);
    const title = screen.getByRole('heading');
    expect(title.className).toContain('text-lg');
    expect(title.className).toContain('font-semibold');
  });
});

describe('CardDescription', () => {
  it('renders children correctly', () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('applies correct styling', () => {
    render(<CardDescription>Styled description</CardDescription>);
    const description = screen.getByText('Styled description');
    expect(description.className).toContain('text-sm');
    expect(description.className).toContain('text-gray-500');
  });
});

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content here</CardContent>);
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<CardContent className="custom-content">Content</CardContent>);
    const content = screen.getByText('Content').closest('div');
    expect(content?.className).toContain('custom-content');
  });
});

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('applies border-top class', () => {
    render(<CardFooter>Footer</CardFooter>);
    const footer = screen.getByText('Footer').closest('div');
    expect(footer?.className).toContain('border-t');
  });
});

describe('Card composition', () => {
  it('composes all subcomponents correctly', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test description</CardDescription>
        </CardHeader>
        <CardContent>Main content</CardContent>
        <CardFooter>Footer content</CardFooter>
      </Card>
    );

    expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });
});
