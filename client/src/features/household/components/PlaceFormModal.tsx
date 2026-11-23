import { Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { Controller } from 'react-hook-form';
import { PLACE_CATEGORIES, PLACE_CATEGORY_META, type PlaceCategory } from '@msr/shared/places';
import { createPlaceSchema, type CreatePlaceInput } from '@msr/shared/schemas/place';
import type { Place } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { OptionPicker } from '../../../components/ui/OptionPicker';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { Switch } from '../../../components/ui/Switch';
import { Textarea } from '../../../components/ui/Textarea';
import { useZodForm } from '../../../hooks/useZodForm';

const FORM_ID = 'place-form';
const CATEGORY_OPTIONS = PLACE_CATEGORIES.map((category) => ({
  value: category,
  label: PLACE_CATEGORY_META[category].label,
  icon: <ProjectIcon name={PLACE_CATEGORY_META[category].icon} />,
}));
const TEXT_FIELDS = [
  { name: 'contactName', label: 'Contact person', type: 'text' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'phoneAlt', label: 'Other phone', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'website', label: 'Website', type: 'url' },
  { name: 'address', label: 'Address', type: 'text' },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'postalCode', label: 'Postal code', type: 'text' },
  { name: 'openingHours', label: 'Opening hours', type: 'text' },
] as const;

const valuesOf = (place: Place | null) => ({
  name: place?.name ?? '',
  category: place?.category ?? ('other' as PlaceCategory),
  contactName: place?.contactName ?? '',
  phone: place?.phone ?? '',
  phoneAlt: place?.phoneAlt ?? '',
  email: place?.email ?? '',
  website: place?.website ?? '',
  address: place?.address ?? '',
  city: place?.city ?? '',
  postalCode: place?.postalCode ?? '',
  openingHours: place?.openingHours ?? '',
  notes: place?.notes ?? '',
  isFavorite: place?.isFavorite ?? false,
});

interface PlaceFormModalProps {
  open: boolean;
  place: Place | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: CreatePlaceInput) => void;
  onDelete: (place: Place) => void;
}

export function PlaceFormModal({ open, place, saving, onOpenChange, onSave, onDelete }: PlaceFormModalProps) {
  const submit = (event: FormEvent) => form.handleSubmit(onSave)(event);

  const form = useZodForm(createPlaceSchema, valuesOf(place));
  const { errors } = form.formState;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={place ? 'Edit place' : 'Add place'}
      size="lg"
      footer={
        <>
          {place && (
            <Button
              variant="danger-ghost"
              leftIcon={<Trash2 />}
              onClick={() => onDelete(place)}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving}>
            Save place
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="place-name" error={errors.name?.message} required>
          <Input id="place-name" autoFocus invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Category">
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <OptionPicker
                aria-label="Category"
                value={field.value ?? 'other'}
                onChange={(category) => category && field.onChange(category)}
                options={CATEGORY_OPTIONS}
                className="w-full"
              />
            )}
          />
        </Field>
        {TEXT_FIELDS.map(({ name, label, type }) => (
          <Field key={name} label={label} htmlFor={`place-${name}`} error={errors[name]?.message}>
            <Input id={`place-${name}`} type={type} invalid={!!errors[name]} {...form.register(name)} />
          </Field>
        ))}
        <Field label="Notes" htmlFor="place-notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="place-notes" invalid={!!errors.notes} {...form.register('notes')} />
        </Field>
        <Controller
          control={form.control}
          name="isFavorite"
          render={({ field }) => (
            <Switch
              label="Favorite"
              checked={!!field.value}
              onCheckedChange={field.onChange}
              className="sm:col-span-2"
            />
          )}
        />
      </form>
    </Modal>
  );
}
