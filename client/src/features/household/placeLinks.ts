import type { Place } from '@msr/shared/types';

export const placeLinks = ({
  address,
  city,
  phone,
  email,
}: Pick<Place, 'address' | 'city' | 'phone' | 'email'>) => {
  const query = [address, city].filter(Boolean).join(', ');
  const encoded = encodeURIComponent(query);
  const dial = phone.replace(/[^\d+*#-]/g, '');
  return {
    google: query ? `https://www.google.com/maps/search/?api=1&query=${encoded}` : null,
    waze: query ? `https://waze.com/ul?q=${encoded}&navigate=yes` : null,
    call: dial ? `tel:${dial}` : null,
    mail: email ? `mailto:${email}` : null,
  };
};
