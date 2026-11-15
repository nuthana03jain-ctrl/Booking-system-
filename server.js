// server.js — the BACK OFFICE.
// The web page sends requests here (like "list places in Goa"), and this file answers.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { openDatabase } = require('./db');

function createApp(db) {
  const app = express();
  app.use(express.json());                                   // understand data sent by the page
  app.use(express.static(path.join(__dirname, 'public')));   // serve the website files

  // ---------- Helpers ----------

  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
  const today = () => new Date().toISOString().slice(0, 10);

  // Number of nights between two "YYYY-MM-DD" dates.
  const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  // Is this place free for the whole stay?
  // Two stays CLASH when each one starts before the other one ends.
  // (Check-out morning and check-in afternoon on the same day is fine.)
  function isAvailable(propertyId, checkIn, checkOut) {
    const clash = db.prepare(`
      SELECT 1 FROM bookings
      WHERE property_id = ? AND status = 'confirmed'
        AND check_in < ? AND check_out > ?
      LIMIT 1
    `).get(propertyId, checkOut, checkIn);
    return !clash;
  }

  // Check dates from the page. Returns an error message, or null if all is fine.
  function dateProblem(checkIn, checkOut) {
    if (!isDate(checkIn) || !isDate(checkOut)) return 'Please choose valid dates.';
    if (checkIn < today()) return 'Check-in cannot be in the past.';
    if (checkOut <= checkIn) return 'Check-out must be after check-in.';
    return null;
  }

  // ---------- 1. Search places ----------
  // Example: GET /api/properties?city=goa&type=rental&guests=4&checkIn=2026-12-01&checkOut=2026-12-05
  app.get('/api/properties', (req, res) => {
    const { city, type, guests, checkIn, checkOut } = req.query;

    let sql = 'SELECT * FROM properties WHERE 1=1';
    const params = [];
    if (city)   { sql += ' AND city LIKE ?';        params.push(`%${city}%`); }
    if (type)   { sql += ' AND type = ?';           params.push(type); }
    if (guests) { sql += ' AND max_guests >= ?';    params.push(Number(guests)); }
    sql += ' ORDER BY price_per_night';

    let results = db.prepare(sql).all(...params);

    // If the visitor chose dates, hide places that are already taken.
    if (checkIn && checkOut) {
      const problem = dateProblem(checkIn, checkOut);
      if (problem) return res.status(400).json({ error: problem });
      const nights = nightsBetween(checkIn, checkOut);
      results = results
        .filter((p) => isAvailable(p.id, checkIn, checkOut))
        .map((p) => ({ ...p, nights, total_price: nights * p.price_per_night }));
    }
    res.json(results);
  });

  // ---------- 2. Make a booking ----------
  app.post('/api/bookings', (req, res) => {
    const { propertyId, guestName, guestEmail, guests, checkIn, checkOut } = req.body || {};

    // Check what the visitor typed.
    if (!guestName || !guestName.trim()) return res.status(400).json({ error: 'Please enter your name.' });
    if (!/^\S+@\S+\.\S+$/.test(guestEmail || '')) return res.status(400).json({ error: 'Please enter a valid email.' });
    const problem = dateProblem(checkIn, checkOut);
    if (problem) return res.status(400).json({ error: problem });

    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
    if (!property) return res.status(404).json({ error: 'That place does not exist.' });

    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) return res.status(400).json({ error: 'Please enter the number of guests.' });
    if (guestCount > property.max_guests) {
      return res.status(400).json({ error: `This place sleeps at most ${property.max_guests} guests.` });
    }

    // Is it still free? (We check again here, even though the page checked earlier —
    // someone else may have booked it in the meantime.)
    if (!isAvailable(property.id, checkIn, checkOut)) {
      return res.status(409).json({ error: 'Sorry, those dates were just taken. Please try other dates.' });
    }

    // The PRICE is worked out here, never trusted from the page.
    const total = nightsBetween(checkIn, checkOut) * property.price_per_night;
    const code = 'BK-' + crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. BK-7F3A91C2

    db.prepare(`
      INSERT INTO bookings (code, property_id, guest_name, guest_email, guests, check_in, check_out, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, property.id, guestName.trim(), guestEmail.trim().toLowerCase(), guestCount, checkIn, checkOut, total);

    res.status(201).json({ code, total_price: total, property: property.name, checkIn, checkOut });
  });

  // ---------- 3. Look up a booking ----------
  // Needs BOTH the code and the email, so strangers can't snoop on bookings.
  function findBooking(code, email) {
    return db.prepare(`
      SELECT b.*, p.name AS property_name, p.city, p.emoji
      FROM bookings b JOIN properties p ON p.id = b.property_id
      WHERE b.code = ? AND b.guest_email = ?
    `).get(String(code).toUpperCase(), String(email || '').trim().toLowerCase());
  }

  app.get('/api/bookings/:code', (req, res) => {
    const booking = findBooking(req.params.code, req.query.email);
    if (!booking) return res.status(404).json({ error: 'No booking found with that code and email.' });
    res.json(booking);
  });

  // ---------- 4. Cancel a booking ----------
  app.post('/api/bookings/:code/cancel', (req, res) => {
    const booking = findBooking(req.params.code, req.body && req.body.email);
    if (!booking) return res.status(404).json({ error: 'No booking found with that code and email.' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'This booking is already cancelled.' });

    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(booking.id);
    res.json({ ok: true }); // the dates become free again automatically
  });

  return app;
}

// Only start listening if you run "node server.js" directly (tests import createApp instead).
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  createApp(openDatabase()).listen(PORT, () => console.log(`Booking site running at http://localhost:${PORT}`));
}

module.exports = { createApp };
