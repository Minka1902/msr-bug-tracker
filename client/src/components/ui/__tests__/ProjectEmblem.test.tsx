import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defaultEmblem } from '@msr/shared/emblem';
import { ProjectAvatar } from '../ProjectAvatar';

const emblem = {
  ...defaultEmblem('#ef4444'),
  pattern: 'quarters' as const,
  colors: ['#ef4444', '#ffffff', '#ffffff', '#3b82f6'],
  divider: { color: '#0f172a', width: 2 as const },
};

describe('ProjectAvatar with an emblem', () => {
  it('draws one filled part per color, the dividers and the icon in its own color', () => {
    const { container } = render(<ProjectAvatar appearance={{ color: '#ef4444', icon: 'rocket', emblem }} />);
    const flag = container.querySelector('svg[data-emblem="quarters"]')!;
    const fills = [...flag.querySelectorAll('g > path[fill]:not([fill="none"])')].map((path) =>
      path.getAttribute('fill'),
    );
    expect(fills).toEqual(emblem.colors);
    expect(flag.querySelector('path[stroke="#0f172a"]')).toHaveAttribute('stroke-width', '1.2');
    expect(container.querySelector('svg.lucide-rocket')).toHaveStyle({ color: '#0f172a' });
  });

  it('hides the icon on request and falls back to the gradient look without an emblem', () => {
    const { container, rerender } = render(
      <ProjectAvatar
        appearance={{ color: '#ef4444', icon: 'rocket', emblem: { ...emblem, showIcon: false } }}
      />,
    );
    expect(container.querySelector('svg.lucide-rocket')).toBeNull();
    rerender(<ProjectAvatar appearance={{ color: '#ef4444', icon: 'rocket', emblem: null }} />);
    expect(container.querySelector('svg[data-emblem]')).toBeNull();
    expect(container.querySelector('svg.lucide-rocket')).not.toBeNull();
  });
});
