import { describe, it, expect } from 'vitest';
import { today, nights, quote, fromPrice, validateBooking } from './utils.js';

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
