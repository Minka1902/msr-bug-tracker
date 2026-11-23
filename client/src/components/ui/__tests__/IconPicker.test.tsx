import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconPicker } from '../IconPicker';

describe('IconPicker', () => {
  it('opens on the category of the chosen icon', () => {
    render(<IconPicker value="house" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Home & family' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'house' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches category', () => {
    render(<IconPicker value="house" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Food & drink' }));
    expect(screen.getByRole('radio', { name: 'pizza' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'house' })).not.toBeInTheDocument();
  });

  it('searches every category and picks the match', () => {
    const onChange = vi.fn();
    render(<IconPicker value="house" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search icons' }), { target: { value: 'dog' } });
    fireEvent.click(screen.getByRole('radio', { name: 'dog' }));
    expect(onChange).toHaveBeenCalledWith('dog');
    expect(screen.queryByRole('radio', { name: 'house' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches', () => {
    render(<IconPicker value="house" onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search icons' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No icons match "zzz"')).toBeInTheDocument();
  });
});
