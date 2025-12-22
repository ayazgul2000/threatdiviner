import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '../table';

describe('Table', () => {
  it('renders table element', () => {
    render(
      <Table>
        <tbody>
          <tr>
            <td>Cell</td>
          </tr>
        </tbody>
      </Table>
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('wraps table in overflow container', () => {
    render(
      <Table>
        <tbody>
          <tr>
            <td>Cell</td>
          </tr>
        </tbody>
      </Table>
    );
    const wrapper = screen.getByRole('table').closest('div');
    expect(wrapper?.className).toContain('overflow-x-auto');
  });

  it('applies custom className', () => {
    render(
      <Table className="custom-table">
        <tbody>
          <tr>
            <td>Cell</td>
          </tr>
        </tbody>
      </Table>
    );
    expect(screen.getByRole('table').className).toContain('custom-table');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(
      <Table ref={ref}>
        <tbody>
          <tr>
            <td>Cell</td>
          </tr>
        </tbody>
      </Table>
    );
    expect(ref.current).toBeInstanceOf(HTMLTableElement);
  });
});

describe('TableHeader', () => {
  it('renders thead element', () => {
    render(
      <table>
        <TableHeader>
          <tr>
            <th>Header</th>
          </tr>
        </TableHeader>
      </table>
    );
    expect(screen.getByRole('rowgroup')).toBeInTheDocument();
  });

  it('applies background class', () => {
    render(
      <table>
        <TableHeader>
          <tr>
            <th>Header</th>
          </tr>
        </TableHeader>
      </table>
    );
    const thead = screen.getByRole('rowgroup');
    expect(thead.className).toContain('bg-gray-50');
  });
});

describe('TableBody', () => {
  it('renders tbody element', () => {
    render(
      <table>
        <TableBody>
          <tr>
            <td>Cell</td>
          </tr>
        </TableBody>
      </table>
    );
    const tbody = document.querySelector('tbody');
    expect(tbody).toBeInTheDocument();
  });

  it('applies correct styling', () => {
    render(
      <table>
        <TableBody>
          <tr>
            <td>Cell</td>
          </tr>
        </TableBody>
      </table>
    );
    const tbody = document.querySelector('tbody');
    expect(tbody?.className).toContain('bg-white');
    expect(tbody?.className).toContain('divide-y');
  });
});

describe('TableRow', () => {
  it('renders tr element', () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Cell</td>
          </TableRow>
        </tbody>
      </table>
    );
    expect(screen.getByRole('row')).toBeInTheDocument();
  });

  it('applies hover styles by default', () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Cell</td>
          </TableRow>
        </tbody>
      </table>
    );
    const row = screen.getByRole('row');
    expect(row.className).toContain('hover:bg-gray-50');
    expect(row.className).toContain('cursor-pointer');
  });

  it('removes hover styles when hoverable is false', () => {
    render(
      <table>
        <tbody>
          <TableRow hoverable={false}>
            <td>Cell</td>
          </TableRow>
        </tbody>
      </table>
    );
    const row = screen.getByRole('row');
    expect(row.className).not.toContain('hover:bg-gray-50');
    expect(row.className).not.toContain('cursor-pointer');
  });
});

describe('TableHead', () => {
  it('renders th element', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead>Header</TableHead>
          </tr>
        </thead>
      </table>
    );
    expect(screen.getByRole('columnheader')).toHaveTextContent('Header');
  });

  it('applies correct styling', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead>Header</TableHead>
          </tr>
        </thead>
      </table>
    );
    const th = screen.getByRole('columnheader');
    expect(th.className).toContain('text-xs');
    expect(th.className).toContain('font-medium');
    expect(th.className).toContain('uppercase');
  });
});

describe('TableCell', () => {
  it('renders td element', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>Cell content</TableCell>
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole('cell')).toHaveTextContent('Cell content');
  });

  it('applies correct styling', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>Cell</TableCell>
          </tr>
        </tbody>
      </table>
    );
    const td = screen.getByRole('cell');
    expect(td.className).toContain('px-6');
    expect(td.className).toContain('py-4');
    expect(td.className).toContain('whitespace-nowrap');
  });
});

describe('TableEmpty', () => {
  it('renders default empty message', () => {
    render(
      <table>
        <tbody>
          <TableEmpty colSpan={3} />
        </tbody>
      </table>
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(
      <table>
        <tbody>
          <TableEmpty colSpan={3} message="No results found" />
        </tbody>
      </table>
    );
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('applies correct colspan', () => {
    render(
      <table>
        <tbody>
          <TableEmpty colSpan={5} />
        </tbody>
      </table>
    );
    const td = screen.getByRole('cell');
    expect(td).toHaveAttribute('colspan', '5');
  });
});

describe('Table composition', () => {
  it('composes all subcomponents correctly', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Item 1</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Item 2</TableCell>
            <TableCell>Inactive</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
