// test.js — automatic checks. Run with:  npm test
const test = require('node:test');
const assert = require('node:assert');
const { openDatabase } = require('./db');
const { createApp } = require('./server');

// Dates in the future so the tests keep working over time.
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

let server, base;
test.before(async () => {
  server = createApp(openDatabase(':memory:')).listen(0);   // throwaway database
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const guest = { guestName: 'Asha', guestEmail: 'asha@example.com', guests: 2 };

test('search finds places by city and type', async () => {
  const goa = await (await fetch(base + '/api/properties?city=goa')).json();
  assert.strictEqual(goa[0].name, 'Beachside Villa');
  const hotels = await (await fetch(base + '/api/properties?type=hotel')).json();
  assert.ok(hotels.every((p) => p.type === 'hotel'));
});

test('a booking is created with the right price', async () => {
  const res = await post('/api/bookings', { propertyId: 5, ...guest, checkIn: day(10), checkOut: day(13) });
  assert.strictEqual(res.status, 201);
  assert.strictEqual((await res.json()).total_price, 70 * 3);   // 3 nights x $70
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

test('a booking can only be looked up with the matching email', async () => {
  const b = await (await post('/api/bookings', { propertyId: 3, ...guest, checkIn: day(40), checkOut: day(42) })).json();
  assert.strictEqual((await fetch(`${base}/api/bookings/${b.code}?email=asha@example.com`)).status, 200);
  assert.strictEqual((await fetch(`${base}/api/bookings/${b.code}?email=thief@example.com`)).status, 404);
});
