import { Clock, Copy, Globe, Mail, MapPin, Navigation, Pencil, Phone, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { PLACE_CATEGORY_META } from '@msr/shared/places';
import type { Place } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { IconButton } from '../../../components/ui/IconButton';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { copyText } from '../../../lib/clipboard';
import { cn } from '../../../lib/cn';
import { placeLinks } from '../placeLinks';

interface PlaceCardProps {
  place: Place;
  canEdit: boolean;
  onEdit: (place: Place) => void;
  onToggleFavorite: (place: Place) => void;
}

const LinkButton = ({
  href,
  label,
  icon,
  children,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <Button asChild size="sm" variant="soft" leftIcon={icon}>
    <a
      href={href}
      aria-label={label}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  </Button>
);

export function PlaceCard({ place, canEdit, onEdit, onToggleFavorite }: PlaceCardProps) {
  const links = placeLinks(place);
  const altCall = placeLinks({ ...place, phone: place.phoneAlt }).call;
  const category = PLACE_CATEGORY_META[place.category];
  const where = [place.address, place.city, place.postalCode].filter(Boolean).join(', ');

  return (
    <Card role="article" aria-label={place.name} padding="md" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
          <ProjectIcon name={category.icon} className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{place.name}</h3>
          <p className="truncate text-sm text-muted">
            {[category.label, place.contactName].filter(Boolean).join(' · ')}
          </p>
        </div>
        <IconButton
          icon={<Star className={cn(place.isFavorite && 'fill-highlight text-highlight')} />}
          label={place.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={place.isFavorite}
          disabled={!canEdit}
          onClick={() => onToggleFavorite(place)}
        />
        {canEdit && (
          <IconButton icon={<Pencil />} label={`Edit ${place.name}`} onClick={() => onEdit(place)} />
        )}
      </div>
      {(where || place.openingHours || place.notes) && (
        <div className="flex flex-col gap-1 text-sm text-muted">
          {where && (
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              {where}
            </p>
          )}
          {place.openingHours && (
            <p className="flex items-start gap-1.5">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              {place.openingHours}
            </p>
          )}
          {place.notes && <p className="whitespace-pre-line">{place.notes}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {links.call && (
          <LinkButton href={links.call} label={`Call ${place.phone}`} icon={<Phone />}>
            {place.phone}
          </LinkButton>
        )}
        {altCall && (
          <LinkButton href={altCall} label={`Call ${place.phoneAlt}`} icon={<Phone />}>
            {place.phoneAlt}
          </LinkButton>
        )}
        {links.google && (
          <LinkButton href={links.google} label="Open in Google Maps" icon={<MapPin />}>
            Maps
          </LinkButton>
        )}
        {links.waze && (
          <LinkButton href={links.waze} label="Open in Waze" icon={<Navigation />}>
            Waze
          </LinkButton>
        )}
        {links.mail && (
          <LinkButton href={links.mail} label={`Email ${place.email}`} icon={<Mail />}>
            Email
          </LinkButton>
        )}
        {place.website && (
          <LinkButton href={place.website} label="Open website" icon={<Globe />}>
            Website
          </LinkButton>
        )}
        {where && (
          <Button size="sm" variant="ghost" leftIcon={<Copy />} onClick={() => copyText(where, 'Address')}>
            Copy address
          </Button>
        )}
      </div>
    </Card>
  );
}
