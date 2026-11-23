import { describe, expect, it } from 'vitest';
import { placeLinks } from '../placeLinks';

describe('placeLinks', () => {
  it('builds map, call and mail links from whatever the place has', () => {
    expect(
      placeLinks({ address: 'Herzl 5', city: 'Tel Aviv', phone: '03-555 1234', email: 'a@b.co' }),
    ).toEqual({
      google: 'https://www.google.com/maps/search/?api=1&query=Herzl%205%2C%20Tel%20Aviv',
      waze: 'https://waze.com/ul?q=Herzl%205%2C%20Tel%20Aviv&navigate=yes',
      call: 'tel:03-5551234',
      mail: 'mailto:a@b.co',
    });
  });

  it('leaves out links it has nothing for', () => {
    expect(placeLinks({ address: '', city: '', phone: '', email: '' })).toEqual({
      google: null,
      waze: null,
      call: null,
      mail: null,
    });
    expect(placeLinks({ address: '', city: 'Haifa', phone: '', email: '' }).google).toBe(
      'https://www.google.com/maps/search/?api=1&query=Haifa',
    );
  });
});
