/** Pure helpers (no React, no Supabase) so they can be unit tested. */

/** Today's date as YYYY-MM-DD in the user's LOCAL timezone (toISOString would use UTC and be off by a day). */
export const today = (now = new Date()) => {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const nights = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 864e5));

/** Live price: room price x nights x rooms, plus selected extras (server recomputes the same way). */
export function quote(room, extraList, choice, n, guests) {
  if (!room) return { base: 0, lines: [], total: 0 };
  const base = room.price_per_night * n * choice.rooms;
  const lines = extraList.filter(e => choice.extras.includes(e.code)).map(e => ({ name: e.name,
    cost: e.pricing === 'per_guest_night' ? e.price * guests * n : e.pricing === 'per_night' ? e.price * n * choice.rooms : Number(e.price) }));
  return { base, lines, total: base + lines.reduce((t, l) => t + l.cost, 0) };
}

/** Cheapest room price, or null when the hotel has no room types (Math.min of [] would give Infinity). */
export const fromPrice = h => h.room_types?.length ? Math.min(...h.room_types.map(r => r.price_per_night)) : null;

/** Returns an object of field -> error message (empty if valid). */
export function validateBooking(f, room, rooms) {
  const e = {};
  if (!f.name.trim()) e.name = 'Full name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email address.';
  if (!/^[+\d][\d\s-]{6,}$/.test(f.phone)) e.phone = 'Enter a valid phone number.';
  if (!f.checkIn) e.checkIn = 'Check-in date is required.';
  else if (f.checkIn < today()) e.checkIn = 'Check-in cannot be in the past.';
  if (!f.checkOut) e.checkOut = 'Check-out date is required.';
  else if (f.checkIn && f.checkOut <= f.checkIn) e.checkOut = 'Check-out must be after check-in.';
  const g = Number(f.guests);
  if (!Number.isInteger(g) || g < 1) e.guests = 'Enter at least 1 guest.';
  else if (room && g > room.capacity * rooms) e.guests = `${room.name} x${rooms} sleeps up to ${room.capacity * rooms} guests.`;
  return e;
}
