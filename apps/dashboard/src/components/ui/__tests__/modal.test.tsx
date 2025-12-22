import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../modal';

describe('Modal', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('renders children when open', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );
    const backdrop = document.querySelector('.bg-black.bg-opacity-50');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );
    fireEvent.click(screen.getByText('Modal content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies correct size class for sm', () => {
    render(
      <Modal isOpen={true} onClose={onClose} size="sm">
        <div>Small modal</div>
      </Modal>
    );
    const modalContent = screen.getByText('Small modal').closest('.relative');
    expect(modalContent?.className).toContain('max-w-md');
  });

  it('applies correct size class for md (default)', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Medium modal</div>
      </Modal>
    );
    const modalContent = screen.getByText('Medium modal').closest('.relative');
    expect(modalContent?.className).toContain('max-w-lg');
  });

  it('applies correct size class for lg', () => {
    render(
      <Modal isOpen={true} onClose={onClose} size="lg">
        <div>Large modal</div>
      </Modal>
    );
    const modalContent = screen.getByText('Large modal').closest('.relative');
    expect(modalContent?.className).toContain('max-w-2xl');
  });

  it('applies correct size class for xl', () => {
    render(
      <Modal isOpen={true} onClose={onClose} size="xl">
        <div>Extra large modal</div>
      </Modal>
    );
    const modalContent = screen.getByText('Extra large modal').closest('.relative');
    expect(modalContent?.className).toContain('max-w-4xl');
  });

  it('sets body overflow to hidden when open', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('resets body overflow when closed', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );

    rerender(
      <Modal isOpen={false} onClose={onClose}>
        <div>Modal content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('unset');
  });
});

describe('ModalHeader', () => {
  it('renders children correctly', () => {
    render(<ModalHeader>Header Title</ModalHeader>);
    expect(screen.getByRole('heading')).toHaveTextContent('Header Title');
  });

  it('renders close button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<ModalHeader onClose={onClose}>Header</ModalHeader>);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('does not render close button when onClose is not provided', () => {
    render(<ModalHeader>Header</ModalHeader>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<ModalHeader onClose={onClose}>Header</ModalHeader>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies border-bottom styling', () => {
    render(<ModalHeader>Header</ModalHeader>);
    const header = screen.getByRole('heading').closest('div');
    expect(header?.className).toContain('border-b');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<ModalHeader ref={ref}>Header</ModalHeader>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('ModalBody', () => {
  it('renders children correctly', () => {
    render(<ModalBody>Body content</ModalBody>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('applies padding', () => {
    render(<ModalBody>Body</ModalBody>);
    const body = screen.getByText('Body').closest('div');
    expect(body?.className).toContain('px-6');
    expect(body?.className).toContain('py-4');
  });

  it('applies custom className', () => {
    render(<ModalBody className="custom-body">Body</ModalBody>);
    const body = screen.getByText('Body').closest('div');
    expect(body?.className).toContain('custom-body');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<ModalBody ref={ref}>Body</ModalBody>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('ModalFooter', () => {
  it('renders children correctly', () => {
    render(<ModalFooter>Footer content</ModalFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('applies border-top styling', () => {
    render(<ModalFooter>Footer</ModalFooter>);
    const footer = screen.getByText('Footer').closest('div');
    expect(footer?.className).toContain('border-t');
  });

  it('applies flex and justify-end', () => {
    render(<ModalFooter>Footer</ModalFooter>);
    const footer = screen.getByText('Footer').closest('div');
    expect(footer?.className).toContain('flex');
    expect(footer?.className).toContain('justify-end');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<ModalFooter ref={ref}>Footer</ModalFooter>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('Modal composition', () => {
  it('composes all subcomponents correctly', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <ModalHeader onClose={onClose}>Test Modal</ModalHeader>
        <ModalBody>This is the modal body</ModalBody>
        <ModalFooter>
          <button>Cancel</button>
          <button>Confirm</button>
        </ModalFooter>
      </Modal>
    );

    expect(screen.getByRole('heading', { name: 'Test Modal' })).toBeInTheDocument();
    expect(screen.getByText('This is the modal body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });
});
