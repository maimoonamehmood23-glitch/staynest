import { useEffect, useState } from 'react';
import { supabase, isConfigured } from './supabase.js';

const today = () => new Date().toISOString().slice(0, 10);
const nights = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 864e5));

/** Live price: room price x nights x rooms, plus selected extras (server recomputes the same way). */
function quote(room, extraList, choice, n, guests) {
  if (!room) return { base: 0, lines: [], total: 0 };
  const base = room.price_per_night * n * choice.rooms;
  const lines = extraList.filter(e => choice.extras.includes(e.code)).map(e => ({ name: e.name,
    cost: e.pricing === 'per_guest_night' ? e.price * guests * n : e.pricing === 'per_night' ? e.price * n * choice.rooms : Number(e.price) }));
  return { base, lines, total: base + lines.reduce((t, l) => t + l.cost, 0) };
}
const fromPrice = h => Math.min(...h.room_types.map(r => r.price_per_night));

/** Returns an object of field -> error message (empty if valid). */
function validateBooking(f, room, rooms) {
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

function HotelCard({ hotel, onView }) {
  return (
    <article className="card">
      <img src={hotel.image_url} alt={hotel.name} loading="lazy" />
      <div className="card-body">
        <div className="row"><h3>{hotel.name}</h3><span className="rating">★ {hotel.rating}</span></div>
        <p className="muted">📍 {hotel.location}</p>
        <p>{hotel.description}</p>
        <p className="tags">{hotel.facilities.map(x => <span key={x}>{x}</span>)}</p>
        <div className="row"><strong><small>from </small>${fromPrice(hotel)}<small> / night</small></strong>
          <button onClick={() => onView(hotel)}>View Details</button></div>
      </div>
    </article>
  );
}

function SearchBox({ search, setSearch, onSearch }) {
  const set = k => e => setSearch({ ...search, [k]: e.target.value });
  return (
    <form className="search" onSubmit={e => { e.preventDefault(); onSearch(); }}>
      <label>Destination<input value={search.destination} onChange={set('destination')} placeholder="e.g. Barcelona" /></label>
      <label>Check-in<input type="date" min={today()} value={search.checkIn} onChange={set('checkIn')} /></label>
      <label>Check-out<input type="date" min={search.checkIn || today()} value={search.checkOut} onChange={set('checkOut')} /></label>
      <label>Guests<input type="number" min="1" max="10" value={search.guests} onChange={set('guests')} /></label>
      <button type="submit">Search</button>
    </form>
  );
}

function BookingForm({ hotel, search, choice, extras, onDone, onChange }) {
  const room = hotel.room_types.find(r => r.id === choice.roomId);
  const [f, setF] = useState({ name: '', email: '', phone: '', checkIn: search.checkIn, checkOut: search.checkOut, guests: search.guests, request: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSubmitError('');
    const found = validateBooking(f, room, choice.rooms);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!isConfigured) return setSubmitError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.');
    setBusy(true);
    const { data, error } = await supabase.rpc('create_booking', {
      p_name: f.name.trim(), p_email: f.email.trim(), p_phone: f.phone.trim(), p_hotel: hotel.id, p_room: room.id, p_rooms: choice.rooms, p_extras: choice.extras,
      p_check_in: f.checkIn, p_check_out: f.checkOut, p_guests: Number(f.guests), p_request: f.request.trim(),
    });
    setBusy(false);
    if (error || !data?.length) return setSubmitError(`Booking failed: ${error?.message || 'no response from database'}`);
    onDone({ id: data[0].booking_id, status: data[0].booking_status, total: data[0].total_price, room, rooms: choice.rooms, extraNames: extras.filter(e => choice.extras.includes(e.code)).map(e => e.name), name: f.name.trim(), hotel, checkIn: f.checkIn, checkOut: f.checkOut, guests: f.guests });
  }
  // plain function (not a component) so inputs keep focus while typing
  const field = (k, label, p = {}) => (
    <label>{label}<input value={f[k]} onChange={set(k)} {...p} />{errors[k] && <span className="error">{errors[k]}</span>}</label>
  );
  const n = f.checkIn && f.checkOut > f.checkIn ? nights(f.checkIn, f.checkOut) : 0;
  const q = quote(room, extras, choice, n || 1, Number(f.guests) || 1);
  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2>Book {hotel.name}</h2>
      <p className="muted">{hotel.location} · {room.name} x{choice.rooms} <a className="link" onClick={onChange}>change</a></p>
      {field('name', 'Full name')}
      {field('email', 'Email', {type: 'email'})}
      {field('phone', 'Phone number', {type: 'tel'})}
      <div className="grid3">
        {field('checkIn', 'Check-in', {type: 'date', min: today()})}
        {field('checkOut', 'Check-out', { type: 'date', min: f.checkIn || today() })}
        {field('guests', 'Guests', { type: 'number', min: 1, max: room.capacity * choice.rooms })}
      </div>
      <label>Special request (optional)<textarea rows="3" value={f.request} onChange={set('request')} /></label>
      <div className="summary"><p>{room.name} x{choice.rooms} · {n || 1} night(s): <b>${q.base}</b></p>
        {q.lines.map(l => <p key={l.name}>{l.name}: <b>${l.cost}</b></p>)}<p className="total">Total: ${q.total}{!n && ' (pick dates)'}</p></div>
      {submitError && <p className="error banner">{submitError}</p>}
      <button disabled={busy}>{busy ? 'Submitting…' : 'Confirm Booking'}</button>
    </form>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [hotels, setHotels] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState({ destination: '', checkIn: '', checkOut: '', guests: 2 });
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(null);
  const [extras, setExtras] = useState([]);
  const [choice, setChoice] = useState({ roomId: null, rooms: 1, extras: [] });

  useEffect(() => {
    if (!isConfigured) return setLoadError('Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.');
    supabase.from('hotels').select('*, room_types(*)').order('rating', { ascending: false }).then(({ data, error }) => {
      if (error) setLoadError(`Could not load hotels: ${error.message}`);
      else if (!data.length) setLoadError('No hotels in the database yet. Run supabase/update_rooms_extras.sql in the Supabase SQL Editor.');
      else setHotels(data.map(h => ({ ...h, room_types: [...h.room_types].sort((a, b) => a.price_per_night - b.price_per_night) })));
    });
    supabase.from('extras').select('*').order('price').then(({ data }) => setExtras(data || []));
  }, []);

  const detailRoom = selected?.room_types.find(r => r.id === choice.roomId);
  const detailNights = search.checkIn && search.checkOut > search.checkIn ? nights(search.checkIn, search.checkOut) : 1;
  const detailQuote = { nights: detailNights, ...quote(detailRoom, extras, choice, detailNights, Number(search.guests) || 1) };
  const go = v => { setView(v); window.scrollTo(0, 0); };
  const results = hotels.filter(h => h.location.toLowerCase().includes(search.destination.trim().toLowerCase()) || h.name.toLowerCase().includes(search.destination.trim().toLowerCase()));
  const view1 = h => { setSelected(h); setChoice({ roomId: h.room_types[0]?.id, rooms: 1, extras: [] }); go('details'); };
  const list = (items) => items.length ? <div className="cards">{items.map(h => <HotelCard key={h.id} hotel={h} onView={view1} />)}</div> : <p className="panel">No hotels match your search.</p>;

  return (
    <>
      <header className="nav">
        <a className="logo" onClick={() => go('home')}>Stay<span>Nest</span></a>
        <nav>{[['home', 'Home'], ['hotels', 'Hotels'], ['about', 'About'], ['contact', 'Contact']].map(([v, l]) => <a key={v} className={view === v ? 'active' : ''} onClick={() => go(v)}>{l}</a>)}</nav>
        <button onClick={() => go('hotels')}>Book a Stay</button>
      </header>
      <main>
        {loadError && <p className="error banner">{loadError}</p>}
        {view === 'home' && <>
          <section className="hero"><h1>Find Your Perfect Stay</h1><p>Compare hotels, pick your dates and book in minutes.</p>
            <SearchBox search={search} setSearch={setSearch} onSearch={() => go('hotels')} /></section>
          <section className="wrap"><h2>Featured Hotels</h2>{list(hotels.slice(0, 3))}</section>
        </>}
        {view === 'hotels' && <section className="wrap"><SearchBox search={search} setSearch={setSearch} onSearch={() => {}} /><h2>{results.length} hotel(s) found</h2>{list(results)}</section>}
        {view === 'details' && selected && <section className="wrap details">
          <img src={selected.image_url} alt={selected.name} />
          <div className="panel"><div className="row"><h1>{selected.name}</h1><span className="rating">★ {selected.rating}</span></div>
            <p className="muted">📍 {selected.location}</p><p>{selected.description}</p>
            <h3>Facilities</h3><p className="tags">{selected.facilities.map(x => <span key={x}>{x}</span>)}</p>
            <h3>Choose your room</h3>
            {selected.room_types.map(r => <label key={r.id} className={'opt' + (choice.roomId === r.id ? ' on' : '')}>
              <input type="radio" name="room" checked={choice.roomId === r.id} onChange={() => setChoice({ ...choice, roomId: r.id, rooms: 1 })} />
              <span><b>{r.name}</b><br /><small>Sleeps {r.capacity} · {r.rooms_available} left</small></span><b>${r.price_per_night}/night</b></label>)}
            <label>Number of rooms<input type="number" min="1" max={detailRoom?.rooms_available} value={choice.rooms} onChange={e => setChoice({ ...choice, rooms: Math.max(1, Math.min(detailRoom?.rooms_available || 1, Number(e.target.value) || 1)) })} /></label>
            <h3>Extras</h3>
            {extras.map(x => <label key={x.code} className="opt"><input type="checkbox" checked={choice.extras.includes(x.code)} onChange={e => setChoice({ ...choice, extras: e.target.checked ? [...choice.extras, x.code] : choice.extras.filter(c => c !== x.code) })} />
              <span>{x.name}<br /><small>{{ per_guest_night: 'per guest / night', per_night: 'per room / night', per_stay: 'per stay' }[x.pricing]}</small></span><b>+${x.price}</b></label>)}
            <div className="summary"><p>{detailQuote.nights} night(s) · {detailRoom?.name} x{choice.rooms}: <b>${detailQuote.base}</b></p>
              {detailQuote.lines.map(l => <p key={l.name}>{l.name}: <b>${l.cost}</b></p>)}<p className="total">Estimated total: ${detailQuote.total}</p></div>
            <button onClick={() => go('booking')}>Book Now</button></div>
        </section>}
        {view === 'booking' && selected && <section className="wrap narrow"><BookingForm hotel={selected} search={search} choice={choice} extras={extras} onChange={() => go('details')} onDone={b => { setBooking(b); go('confirm'); }} /></section>}
        {view === 'confirm' && booking && <section className="wrap narrow"><div className="panel confirm">
          <div className="check">✓</div><h1>Booking Confirmed!</h1>
          <dl><dt>Booking ID</dt><dd>{booking.id}</dd><dt>Guest</dt><dd>{booking.name}</dd><dt>Hotel</dt><dd>{booking.hotel.name}</dd><dt>Location</dt><dd>{booking.hotel.location}</dd>
            <dt>Room</dt><dd>{booking.room.name} x{booking.rooms}</dd><dt>Extras</dt><dd>{booking.extraNames.join(', ') || 'None'}</dd><dt>Check-in</dt><dd>{booking.checkIn}</dd><dt>Check-out</dt><dd>{booking.checkOut}</dd><dt>Guests</dt><dd>{booking.guests}</dd><dt>Total price</dt><dd>${booking.total}</dd><dt>Status</dt><dd><span className="status">{booking.status}</span></dd></dl>
          <button onClick={() => go('home')}>Back to Home</button></div></section>}
        {view === 'about' && <section className="wrap narrow panel"><h1>About StayNest</h1><p>StayNest is an original hotel booking platform built as a university project with React and Supabase.</p></section>}
        {view === 'contact' && <section className="wrap narrow panel"><h1>Contact</h1><p>Email: support@staynest.example<br />Phone: +00 123 456 789</p></section>}
      </main>
      <footer>© {new Date().getFullYear()} StayNest – university demo project</footer>
    </>
  );
}
