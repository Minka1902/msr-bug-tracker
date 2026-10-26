import { render } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { describe, expect, it } from 'vitest';
import { StepList } from '../../settings/components/StepList';
import { AGENT_GUIDES } from '../agentGuides';

const CONNECTOR_URL = 'https://msr.example/mcp';

describe('AGENT_GUIDES', () => {
  it('covers every agent once', () => {
    expect(AGENT_GUIDES.map((guide) => guide.id)).toEqual([
      'claude',
      'chatgpt',
      'claude-code',
      'cursor',
      'vscode',
      'codex',
      'gemini',
      'other',
    ]);
  });

  it.each(AGENT_GUIDES.map((guide) => [guide.label, guide] as const))(
    'puts the connector URL in the %s steps',
    (_label, guide) => {
      const { container } = render(
        <Tooltip.Provider>
          <StepList steps={guide.steps(CONNECTOR_URL)} />
        </Tooltip.Provider>,
      );
      expect(container.textContent).toContain(CONNECTOR_URL);
    },
  );
});
