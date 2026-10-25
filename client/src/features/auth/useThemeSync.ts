import { useEffect, useRef } from 'react';
import type { CurrentUser } from '@msr/shared/types';
import { useTheme } from '../../hooks/useTheme';
import { useUpdateMe } from './api';

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const useThemeSync = (user: CurrentUser) => {
  const { setTheme, subscribe } = useTheme();
  const updateMe = useUpdateMe();
  const appliedFor = useRef<string | null>(null);
  const { style, mode, nav, timezone } = user.preferences;

  useEffect(() => {
    if (appliedFor.current === user.id) return;
    appliedFor.current = user.id;
    setTheme({ style, mode, nav }, { silent: true });
    if (timezone !== BROWSER_TIMEZONE && !user.impersonator)
      updateMe.mutate({ preferences: { timezone: BROWSER_TIMEZONE } });
  }, [user.id, user.impersonator, style, mode, nav, timezone, setTheme, updateMe]);

  useEffect(() => subscribe((prefs) => updateMe.mutate({ preferences: prefs })), [subscribe, updateMe]);
};
