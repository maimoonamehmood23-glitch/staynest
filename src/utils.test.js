import { describe, it, expect } from 'vitest';
import { today, nights, quote, fromPrice, validateBooking, normalize, matchesDestination, canFitGuests, validateSearch, searchHotels } from './utils.js';

const room = { name: 'Deluxe', capacity: 2, price_per_night: 100 };
const valid = { name: 'Ali', email: 'ali@example.com', phone: '+92 300 1234567', checkIn: '2999-01-10', checkOut: '2999-01-12', guests: 2 };

describe('today', () => {
  it('uses the LOCAL date, not UTC (regression: 00:30 local in UTC+5 is still the previous day in UTC)', () => {
    expect(today(new Date(2026, 5, 15, 0, 30))).toBe('2026-06-15');
  });
  it('zero-pads month and day', () => {
    expect(today(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('nights', () => {
  it('counts nights between dates', () => expect(nights('2999-01-10', '2999-01-13')).toBe(3));
  it('never returns less than 1', () => expect(nights('2999-01-10', '2999-01-10')).toBe(1));
});

describe('quote', () => {
  const extras = [
    { code: 'bf', name: 'Breakfast', pricing: 'per_guest_night', price: 10 },
    { code: 'sp', name: 'Spa', pricing: 'per_stay', price: '50' },
    { code: 'pk', name: 'Parking', pricing: 'per_night', price: 5 },
  ];
  it('returns zero without a room', () => expect(quote(null, extras, { rooms: 1, extras: [] }, 2, 2).total).toBe(0));
  it('prices room x nights x rooms', () => expect(quote(room, extras, { rooms: 2, extras: [] }, 3, 2).base).toBe(600));
  it('adds each extra by its pricing rule', () => {
    const q = quote(room, extras, { rooms: 2, extras: ['bf', 'sp', 'pk'] }, 3, 2);
    expect(q.lines.map(l => l.cost)).toEqual([60, 50, 30]);
    expect(q.total).toBe(740);
  });
});

describe('fromPrice', () => {
  it('returns the cheapest room', () => expect(fromPrice({ room_types: [{ price_per_night: 90 }, { price_per_night: 60 }] })).toBe(60));
  it('returns null (not Infinity) with no rooms', () => expect(fromPrice({ room_types: [] })).toBeNull());
});

describe('validateBooking', () => {
  it('accepts a valid booking', () => expect(validateBooking(valid, room, 1)).toEqual({}));
  it('requires a name', () => expect(validateBooking({ ...valid, name: '  ' }, room, 1).name).toBeDefined());
  it('rejects a bad email', () => expect(validateBooking({ ...valid, email: 'nope' }, room, 1).email).toBeDefined());
  it('rejects a bad phone', () => expect(validateBooking({ ...valid, phone: 'abc' }, room, 1).phone).toBeDefined());
  it('rejects check-in in the past', () => expect(validateBooking({ ...valid, checkIn: '2000-01-01' }, room, 1).checkIn).toBeDefined());
  it('rejects check-out on or before check-in', () => expect(validateBooking({ ...valid, checkOut: valid.checkIn }, room, 1).checkOut).toBeDefined());
  it('rejects zero guests', () => expect(validateBooking({ ...valid, guests: 0 }, room, 1).guests).toBeDefined());
  it('rejects more guests than the room sleeps', () => expect(validateBooking({ ...valid, guests: 3 }, room, 1).guests).toMatch(/sleeps up to 2/));
  it('scales capacity with the number of rooms', () => expect(validateBooking({ ...valid, guests: 4 }, room, 2)).toEqual({}));
});

const hotel = (name, location, rooms = [{ capacity: 2, rooms_available: 3 }], description = '') => ({ name, location, description, room_types: rooms });

describe('normalize', () => {
  it('lowercases, trims and drops accents', () => expect(normalize('  Málaga ')).toBe('malaga'));
  it('handles null and undefined', () => expect(normalize(null)).toBe(''));
});

describe('matchesDestination', () => {
  const h = hotel('Grand Plaza', 'Barcelona, Spain', undefined, 'Beach hotel');
  it('matches everything when the search is empty', () => expect(matchesDestination(h, '   ')).toBe(true));
  it('matches the location, ignoring case', () => expect(matchesDestination(h, 'barcelona')).toBe(true));
  it('matches the name', () => expect(matchesDestination(h, 'plaza')).toBe(true));
  it('matches several words in any order', () => expect(matchesDestination(h, 'spain barcelona')).toBe(true));
  it('ignores accents', () => expect(matchesDestination(hotel('Sol', 'Málaga'), 'malaga')).toBe(true));
  it('requires every word to match', () => expect(matchesDestination(h, 'barcelona paris')).toBe(false));
});

describe('canFitGuests', () => {
  const h = hotel('A', 'B', [{ capacity: 2, rooms_available: 3 }, { capacity: 4, rooms_available: 1 }]);
  it('fits guests up to capacity x rooms available', () => expect(canFitGuests(h, 6)).toBe(true));
  it('rejects more guests than any room type can sleep', () => expect(canFitGuests(h, 7)).toBe(false));
  it('does not hide hotels for an empty or invalid guest count', () => {
    expect(canFitGuests(h, '')).toBe(true);
    expect(canFitGuests(h, 0)).toBe(true);
  });
  it('rejects a hotel with no room types', () => expect(canFitGuests(hotel('A', 'B', []), 2)).toBe(false));
});

describe('validateSearch', () => {
  it('accepts an empty-date search', () => expect(validateSearch({ checkIn: '', checkOut: '', guests: 2 })).toEqual({}));
  it('accepts valid dates', () => expect(validateSearch({ checkIn: '2999-01-10', checkOut: '2999-01-12', guests: 1 })).toEqual({}));
  it('rejects check-in in the past', () => expect(validateSearch({ checkIn: '2000-01-01', checkOut: '', guests: 2 }).checkIn).toBeDefined());
  it('rejects check-out on or before check-in', () => expect(validateSearch({ checkIn: '2999-01-10', checkOut: '2999-01-10', guests: 2 }).checkOut).toBeDefined());
  it('rejects zero or non-numeric guests', () => {
    expect(validateSearch({ checkIn: '', checkOut: '', guests: 0 }).guests).toBeDefined();
    expect(validateSearch({ checkIn: '', checkOut: '', guests: '' }).guests).toBeDefined();
  });
});

describe('searchHotels', () => {
  const list = [hotel('Big', 'Rome', [{ capacity: 4, rooms_available: 5 }]), hotel('Tiny', 'Rome', [{ capacity: 2, rooms_available: 1 }]), hotel('Far', 'Paris')];
  it('filters by destination and guests together', () => expect(searchHotels(list, { destination: 'rome', guests: 5 }).map(h => h.name)).toEqual(['Big']));
  it('returns all hotels for an empty destination and small party', () => expect(searchHotels(list, { destination: '', guests: 1 })).toHaveLength(3));
});
