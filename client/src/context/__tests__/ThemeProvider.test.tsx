import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../../hooks/useTheme';
import { setSystemDark } from '../../test/setup';
import { ThemeProvider } from '../ThemeProvider';

const NEXT = { style: 'clean', mode: 'dark', nav: 'rail' } as const;

function Probe({ onChange, silent }: { onChange?: (prefs: unknown) => void; silent?: boolean }) {
  const { resolvedMode, setTheme, subscribe } = useTheme();
  useEffect(() => (onChange ? subscribe(onChange) : undefined), [onChange, subscribe]);
  return (
    <button type="button" data-testid="mode" onClick={() => setTheme(NEXT, { silent })}>
      {resolvedMode}
    </button>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    setSystemDark(false);
  });

  it('applies defaults to the document and follows the system scheme', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset).toMatchObject({
      style: 'aurora',
      mode: 'light',
      nav: 'sidebar',
    });
    act(() => setSystemDark(true));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.mode).toBe('dark');
  });

  it('persists changes locally and reports them', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider>
        <Probe onChange={onChange} />
      </ThemeProvider>,
    );
    act(() => screen.getByTestId('mode').click());
    expect(document.documentElement.dataset).toMatchObject({ style: 'clean', mode: 'dark', nav: 'rail' });
    expect(JSON.parse(localStorage.getItem('msr-theme')!)).toEqual({
      style: 'clean',
      mode: 'dark',
      nav: 'rail',
    });
    expect(onChange).toHaveBeenCalledWith({ style: 'clean', mode: 'dark', nav: 'rail' });
  });

  it('applies silent changes without notifying listeners', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider>
        <Probe onChange={onChange} silent />
      </ThemeProvider>,
    );
    act(() => screen.getByTestId('mode').click());
    expect(document.documentElement.dataset.style).toBe('clean');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lets explicit initial prefs override the local mirror', () => {
    localStorage.setItem('msr-theme', JSON.stringify({ style: 'clean' }));
    render(
      <ThemeProvider initial={{ mode: 'dark' }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset).toMatchObject({ style: 'clean', mode: 'dark' });
  });
});
