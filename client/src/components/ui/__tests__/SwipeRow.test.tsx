import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../context/ThemeProvider';
import { setCoarsePointer } from '../../../test/setup';
import { SwipeRow } from '../SwipeRow';

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
    this.pointerType = init.pointerType ?? 'touch';
  }
}

const swipe = (target: Element, dx: number, dy = 2) => {
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 200, clientY: 20 });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: 200 + dx / 2, clientY: 20 + dy / 2 });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: 200 + dx, clientY: 20 + dy });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: 200 + dx, clientY: 20 + dy });
};

const renderRow = (hand: 'right' | 'left') => {
  const done = vi.fn();
  const more = vi.fn();
  const open = vi.fn();
  render(
    <ThemeProvider initial={{ hand }}>
      <SwipeRow
        primary={{ label: 'Done', icon: null, color: 'green', onAction: done }}
        secondary={{ label: 'Actions', icon: null, color: 'blue', onAction: more }}
      >
        <button type="button" onClick={open}>
          Row
        </button>
      </SwipeRow>
    </ThemeProvider>,
  );
  return { row: screen.getByRole('button', { name: 'Row' }), done, more, open };
};

describe('SwipeRow', () => {
  beforeEach(() => {
    localStorage.clear();
    setCoarsePointer(true);
    vi.stubGlobal('PointerEvent', TestPointerEvent);
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it('finishes with a swipe toward the palm of the right hand and opens actions the other way', () => {
    const { row, done, more, open } = renderRow('right');
    swipe(row, -150);
    expect(done).toHaveBeenCalledOnce();
    swipe(row, 150);
    expect(more).toHaveBeenCalledOnce();
    fireEvent.click(row);
    expect(open).not.toHaveBeenCalled();
  });

  it('mirrors the directions for the left hand and ignores scrolls and fine pointers', () => {
    const { row, done, more } = renderRow('left');
    swipe(row, 150);
    expect(done).toHaveBeenCalledOnce();
    swipe(row, -30, 160);
    expect(more).not.toHaveBeenCalled();
    act(() => setCoarsePointer(false));
    swipe(row, 150);
    expect(done).toHaveBeenCalledOnce();
  });
});
