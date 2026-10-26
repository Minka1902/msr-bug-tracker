import { render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { describe, expect, it } from 'vitest';
import { CodeBlock } from '../CodeBlock';

const renderBlock = (wrap?: boolean) =>
  render(
    <Tooltip.Provider>
      <CodeBlock code='{ "url": "https://msr.example/mcp" }' copyLabel="Config" wrap={wrap} />
    </Tooltip.Provider>,
  );

describe('CodeBlock', () => {
  it('lets keyboard users reach a block that scrolls sideways', () => {
    const { container } = renderBlock();
    expect(container.querySelector('pre')).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Copy config' })).toBeInTheDocument();
  });

  it('keeps wrapped blocks out of the tab order', () => {
    const { container } = renderBlock(true);
    expect(container.querySelector('pre')).not.toHaveAttribute('tabindex');
  });
});
