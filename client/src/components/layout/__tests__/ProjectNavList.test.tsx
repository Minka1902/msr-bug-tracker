import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ProjectNavList } from '../ProjectNavList';
import type { ShellProject } from '../shellTypes';

const project = (key: string, overrides: Partial<ShellProject> = {}): ShellProject => ({
  key,
  kind: 'software',
  name: key,
  color: '#4f56f0',
  icon: 'hexagon',
  emblem: null,
  isFavorite: false,
  isMain: false,
  ...overrides,
});

describe('ProjectNavList', () => {
  it('puts the main household first, then other households, then favorites, keeping server order', () => {
    render(
      <MemoryRouter>
        <ProjectNavList
          onCreateProject={vi.fn()}
          projects={[
            project('RECENT'),
            project('STARRED', { isFavorite: true }),
            project('CABIN', { kind: 'household' }),
            project('OLDER'),
            project('HOME', { kind: 'household', isMain: true }),
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'HOME',
      'CABIN',
      'STARRED',
      'RECENT',
      'OLDER',
    ]);
    expect(screen.getByRole('link', { name: /^HOME/ })).toContainElement(
      screen.getByLabelText('Main household'),
    );
  });
});
