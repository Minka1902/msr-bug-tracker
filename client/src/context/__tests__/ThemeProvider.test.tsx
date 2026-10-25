import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../../hooks/useTheme';
import { setSystemDark } from '../../test/setup';
import { ThemeProvider } from '../ThemeProvider';

const NEXT = { style: 'clean', mode: 'dark', nav: 'rail' } as const;

function Probe() {
  const { resolvedMode, setTheme } = useTheme();
  return (
    <button type="button" data-testid="mode" onClick={() => setTheme(NEXT)}>
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
    expect(document.documentElement.dataset).toMatchObject({ style: 'aurora', mode: 'light', nav: 'sidebar' });
    act(() => setSystemDark(true));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.mode).toBe('dark');
  });

  it('persists changes locally and reports them', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider onChange={onChange}>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByTestId('mode').click());
    expect(document.documentElement.dataset).toMatchObject({ style: 'clean', mode: 'dark', nav: 'rail' });
    expect(JSON.parse(localStorage.getItem('msr-theme')!)).toEqual({ style: 'clean', mode: 'dark', nav: 'rail' });
    expect(onChange).toHaveBeenCalledWith({ style: 'clean', mode: 'dark', nav: 'rail' });
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
