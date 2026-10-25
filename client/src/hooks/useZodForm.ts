import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import type { z } from 'zod';

export const useZodForm = <S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  defaultValues?: DefaultValues<z.input<S>>,
) =>
  useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as Resolver<z.input<S>, unknown, z.output<S>>,
    mode: 'onTouched',
    defaultValues,
  });
