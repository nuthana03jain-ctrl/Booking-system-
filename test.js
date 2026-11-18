// test.js — automatic checks. Run with:  npm test
const test = require('node:test');
const assert = require('node:assert');
const { openDatabase } = require('./db');
const { createApp } = require('./server');

// Dates in the future so the tests keep working over time.
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const ADMIN = 'test-host-password';

let server, base;
test.before(async () => {
  process.env.ADMIN_PASSWORD = ADMIN;
  server = createApp(await openDatabase(null)).listen(0);   // throwaway practice database
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, body, headers = {}) => fetch(base + url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const guest = { guestName: 'Asha', guestEmail: 'asha@example.com', guestPhone: '98765 43210', guests: 2 };

test('search finds places by city and type', async () => {
  const goa = await (await fetch(base + '/api/properties?city=goa')).json();
  assert.strictEqual(goa[0].name, 'Beachside Villa');
  const hotels = await (await fetch(base + '/api/properties?type=hotel')).json();
  assert.ok(hotels.every((p) => p.type === 'hotel'));
});

test('a booking is created with the right price in rupees', async () => {
  const res = await post('/api/bookings', { propertyId: 5, ...guest, checkIn: day(10), checkOut: day(13) });
  assert.strictEqual(res.status, 201);
  assert.strictEqual((await res.json()).total_price, 3000 * 3);   // 3 nights x ₹3,000
});

test('the same dates cannot be booked twice, and cancelling frees them', async () => {
  const stay = { propertyId: 1, ...guest, checkIn: day(20), checkOut: day(23) };
  const first = await (await post('/api/bookings', stay)).json();

  assert.strictEqual((await post('/api/bookings', stay)).status, 409);                                   // clash
  assert.strictEqual((await post('/api/bookings', { ...stay, checkIn: day(22), checkOut: day(25) })).status, 409); // overlap
  assert.strictEqual((await post('/api/bookings', { ...stay, checkIn: day(23), checkOut: day(25) })).status, 201); // back-to-back is fine

  // taken dates are hidden from search
  const search = await (await fetch(`${base}/api/properties?checkIn=${day(20)}&checkOut=${day(22)}`)).json();
  assert.ok(!search.some((p) => p.id === 1));

  await post(`/api/bookings/${first.code}/cancel`, { email: 'asha@example.com' });
  assert.strictEqual((await post('/api/bookings', stay)).status, 201);                                   // free again
});

test('bad requests are refused', async () => {
  const ok = { propertyId: 2, ...guest, checkIn: day(30), checkOut: day(32) };
  assert.strictEqual((await post('/api/bookings', { ...ok, checkOut: day(30) })).status, 400);   // 0 nights
  assert.strictEqual((await post('/api/bookings', { ...ok, checkIn: day(-3) })).status, 400);    // in the past
  assert.strictEqual((await post('/api/bookings', { ...ok, guests: 9 })).status, 400);           // too many guests
  assert.strictEqual((await post('/api/bookings', { ...ok, guestEmail: 'nope' })).status, 400);  // bad email
  assert.strictEqual((await post('/api/bookings', { ...ok, propertyId: 999 })).status, 404);     // no such place
});

test('Indian mobile numbers are checked', async () => {
  const ok = { propertyId: 2, ...guest, checkIn: day(50), checkOut: day(52) };
  assert.strictEqual((await post('/api/bookings', { ...ok, guestPhone: '12345' })).status, 400);          // too short
  assert.strictEqual((await post('/api/bookings', { ...ok, guestPhone: '+91 5555555555' })).status, 400); // must start with 6-9
  assert.strictEqual((await post('/api/bookings', { ...ok, guestPhone: '' })).status, 400);               // missing
  assert.strictEqual((await post('/api/bookings', { ...ok, guestPhone: '+91 98765 43210' })).status, 201); // +91 prefix is fine
});

test('a booking can only be looked up with the matching email', async () => {
  const b = await (await post('/api/bookings', { propertyId: 3, ...guest, checkIn: day(40), checkOut: day(42) })).json();
  assert.strictEqual((await fetch(`${base}/api/bookings/${b.code}?email=asha@example.com`)).status, 200);
  assert.strictEqual((await fetch(`${base}/api/bookings/${b.code}?email=thief@example.com`)).status, 404);
});

test('the host area needs the right password', async () => {
  assert.strictEqual((await fetch(base + '/api/admin/bookings')).status, 401);
  assert.strictEqual((await fetch(base + '/api/admin/bookings', { headers: { 'x-admin-password': 'wrong' } })).status, 401);
  const res = await fetch(base + '/api/admin/bookings', { headers: { 'x-admin-password': ADMIN } });
  assert.strictEqual(res.status, 200);
  const rows = await res.json();
  assert.ok(Array.isArray(rows) && rows.length > 0);
  assert.ok(rows[0].guest_phone);
});

test('the host can add a place that then appears in search', async () => {
  const place = { name: 'Pine Hill Cottage', type: 'rental', city: 'Shimla', description: 'Quiet cottage with a fireplace.',
                  price_per_night: 4000, max_guests: 4, bedrooms: 2, emoji: '🌲' };
  const host = { 'x-admin-password': ADMIN };
  assert.strictEqual((await post('/api/admin/properties', place, host)).status, 201);
  const found = await (await fetch(`${base}/api/properties?city=shimla`)).json();
  assert.strictEqual(found[0].name, 'Pine Hill Cottage');
  assert.strictEqual((await post('/api/admin/properties', { ...place, price_per_night: -5 }, host)).status, 400);
});

test('places come with amenities, and host photo links are checked', async () => {
  const goa = await (await fetch(base + '/api/properties?city=goa')).json();
  assert.ok(goa[0].amenities.includes('Private pool'));
  const host = { 'x-admin-password': ADMIN };
  const place = { name: 'Fort View Stay', type: 'hotel', city: 'Agra', description: 'Rooms facing the fort.',
                  price_per_night: 2500, max_guests: 2, bedrooms: 1, amenities: ' Wi-Fi , AC ,', image_url: 'javascript:alert(1)' };
  assert.strictEqual((await post('/api/admin/properties', place, host)).status, 400);           // unsafe link refused
  assert.strictEqual((await post('/api/admin/properties', { ...place, image_url: 'https://example.com/fort.jpg' }, host)).status, 201);
  const agra = await (await fetch(base + '/api/properties?city=agra')).json();
  assert.strictEqual(agra[0].amenities, 'Wi-Fi,AC');                                             // tidied up
  assert.strictEqual(agra[0].image_url, 'https://example.com/fort.jpg');
});
