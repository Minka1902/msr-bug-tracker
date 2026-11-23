import { describe, expect, it } from 'vitest';
import { parseSharedLink, storeOf, trimUrl } from '../src/sharedLink';

describe('parseSharedLink', () => {
  it('reads the AliExpress app share text', () => {
    expect(
      parseSharedLink({
        text: 'I just found this on AliExpress: US $12.34 | 30m Garden Hose Expandable https://a.aliexpress.com/_mKxyz12',
      }),
    ).toEqual({ name: '30m Garden Hose Expandable', url: 'https://a.aliexpress.com/_mKxyz12', store: 'aliexpress' });
    expect(parseSharedLink({ text: 'Only US $5.49 for LED Strip 5m\nhttps://a.aliexpress.com/_oDT0IPY' })).toEqual({
      name: 'LED Strip 5m',
      url: 'https://a.aliexpress.com/_oDT0IPY',
      store: 'aliexpress',
    });
  });

  it('reads Amazon titles and slugs', () => {
    expect(parseSharedLink({ text: 'Check out this deal on Amazon: Kindle Paperwhite 16GB https://a.co/d/abc123' })).toEqual({
      name: 'Kindle Paperwhite 16GB',
      url: 'https://a.co/d/abc123',
      store: 'amazon',
    });
    expect(
      parseSharedLink({ url: 'https://www.amazon.com/Anker-Charger-Foldable-Compact/dp/B0B1234567?ref=share&th=1' }),
    ).toEqual({
      name: 'Anker Charger Foldable Compact',
      url: 'https://www.amazon.com/Anker-Charger-Foldable-Compact/dp/B0B1234567?ref=share&th=1',
      store: 'amazon',
    });
  });

  it('reads SHEIN share text and slugs', () => {
    expect(
      parseSharedLink({
        title: 'SHEIN',
        text: 'I found this on SHEIN, check it out! https://il.shein.com/Floral-Print-Midi-Dress-p-12345678.html?share=1',
      }),
    ).toEqual({
      name: 'Floral Print Midi Dress',
      url: 'https://il.shein.com/Floral-Print-Midi-Dress-p-12345678.html?share=1',
      store: 'shein',
    });
  });

  it('prefers a real shared title and the first link', () => {
    expect(
      parseSharedLink({
        title: 'Cordless Drill 20V',
        text: 'https://www.aliexpress.com/item/1005001234.html and also https://example.com/x',
      }),
    ).toEqual({ name: 'Cordless Drill 20V', url: 'https://www.aliexpress.com/item/1005001234.html', store: 'aliexpress' });
  });

  it('falls back to the store name, then the site, and keeps text without a link', () => {
    expect(parseSharedLink({ url: 'https://www.aliexpress.com/item/1005001234.html' })).toMatchObject({
      name: 'AliExpress item',
      store: 'aliexpress',
    });
    expect(parseSharedLink({ text: 'https://www.ikea.com/il/he/p/billy-bookcase-white-00263850/' })).toEqual({
      name: 'billy bookcase white 00263850',
      url: 'https://www.ikea.com/il/he/p/billy-bookcase-white-00263850/',
      store: null,
    });
    expect(parseSharedLink({ text: 'https://example.com/' })).toMatchObject({ name: 'example.com', store: null });
    expect(parseSharedLink({ text: 'just milk' })).toEqual({ name: 'just milk', url: null, store: null });
  });

  it('keeps names and links within the limits', () => {
    const long = `https://www.amazon.com/x/dp/B01?${'a'.repeat(2100)}`;
    const parsed = parseSharedLink({ title: 'n'.repeat(200), url: long });
    expect(parsed.name).toHaveLength(120);
    expect(parsed.url).toBe('https://www.amazon.com/x/dp/B01');
  });
});

describe('storeOf and trimUrl', () => {
  it.each([
    ['https://s.click.aliexpress.com/e/_abc', 'aliexpress'],
    ['https://he.aliexpress.com/item/1.html', 'aliexpress'],
    ['https://amzn.to/3xyz', 'amazon'],
    ['https://amzn.eu/d/xyz', 'amazon'],
    ['https://www.amazon.co.uk/dp/B01', 'amazon'],
    ['https://api-shein.shein.com/h5/sharejump/appsharejump?x=1', 'shein'],
    ['https://notamazon.com/x', null],
    ['https://shein.example.com/x', null],
  ])('%s', (url, store) => {
    expect(storeOf(url)).toBe(store);
  });

  it('drops only the query string of a link over 2000 characters', () => {
    expect(trimUrl('https://a.co/d/1')).toBe('https://a.co/d/1');
    expect(trimUrl(`https://a.co/d/1?${'x'.repeat(2000)}`)).toBe('https://a.co/d/1');
  });
});
