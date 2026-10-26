import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import type { Emblem } from '@msr/shared/emblem';
import type { AppearanceValue } from './components/ProjectAppearanceEditor';

interface AppearanceFields extends FieldValues {
  color: string;
  icon: string;
  emblem?: Emblem | null;
}

export const useAppearanceField = <T extends AppearanceFields>(form: UseFormReturn<T, unknown, unknown>) => {
  const onChange = (patch: Partial<AppearanceValue>) =>
    Object.entries(patch).forEach(([field, next]) =>
      form.setValue(field as Path<T>, next as PathValue<T, Path<T>>, { shouldDirty: true }),
    );

  const [color, icon, emblem] = form.watch(['color', 'icon', 'emblem'] as Path<T>[]) as unknown as [
    string,
    string,
    Emblem | null | undefined,
  ];

  return { value: { color, icon, emblem: emblem ?? null }, onChange };
};
