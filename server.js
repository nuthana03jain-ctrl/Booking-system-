// server.js — the BACK OFFICE.
// The web pages send requests here (like "list places in Goa"), and this file answers.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { openDatabase } = require('./db');

// Indian mobile numbers are 10 digits and start with 6, 7, 8 or 9.
// Guests may type +91, 91 or a leading 0 in front; we keep only the 10 digits.
function cleanPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

// An error that carries the HTTP status to send back (e.g. 409 = "conflict").
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function createApp(db) {
  const app = express();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  app.use(express.json());                                   // understand data sent by the pages
  app.use(express.static(path.join(__dirname, 'public')));   // serve the website files

  // Host-only routes: the password must come in a header and match exactly.
  function requireAdmin(req, res, next) {
    if (!adminPassword) {
      return next(new HttpError(503, 'Host login is turned off. The site owner must set ADMIN_PASSWORD.'));
    }
    const given = Buffer.from(String(req.get('x-admin-password') || ''));
    const wanted = Buffer.from(adminPassword);
    const ok = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
    if (!ok) return next(new HttpError(401, 'Wrong password.'));
    next();
  }

  // ---------- Helpers ----------

  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
  // "Today" in India (UTC + 5:30), so a guest booking late at night in India gets the right day.
  const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

  // Number of nights between two "YYYY-MM-DD" dates.
  const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  // Is this place free for the whole stay? Uses either the database or a transaction.
  // Two stays CLASH when each one starts before the other one ends.
  // (Check-out morning and check-in afternoon on the same day is fine.)
  async function isAvailable(client, propertyId, checkIn, checkOut) {
    const clash = await client.query(`
      SELECT 1 FROM bookings
      WHERE property_id = $1 AND status = 'confirmed'
        AND check_in < $2 AND check_out > $3
      LIMIT 1`, [propertyId, checkOut, checkIn]);
    return clash.rows.length === 0;
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
  app.get('/api/properties', async (req, res) => {
    const { city, type, guests, checkIn, checkOut } = req.query;

    let sql = 'SELECT * FROM properties WHERE 1=1';
    const params = [];
    if (city)   { params.push(`%${city}%`);        sql += ` AND city ILIKE $${params.length}`; }
    if (type)   { params.push(type);               sql += ` AND type = $${params.length}`; }
    if (guests) { params.push(Number(guests));     sql += ` AND max_guests >= $${params.length}`; }
    sql += ' ORDER BY price_per_night';

    let results = (await db.query(sql, params)).rows;

    // If the visitor chose dates, hide places that are already taken.
    if (checkIn && checkOut) {
      const problem = dateProblem(checkIn, checkOut);
      if (problem) throw new HttpError(400, problem);
      const nights = nightsBetween(checkIn, checkOut);
      const free = await Promise.all(results.map((p) => isAvailable(db, p.id, checkIn, checkOut)));
      results = results
        .filter((_, i) => free[i])
        .map((p) => ({ ...p, nights, total_price: nights * p.price_per_night }));
    }
    res.json(results);
  });

  // ---------- 2. Make a booking ----------
  app.post('/api/bookings', async (req, res) => {
    const { propertyId, guestName, guestEmail, guestPhone, guests, checkIn, checkOut } = req.body || {};

    // Check what the visitor typed.
    if (!guestName || !String(guestName).trim()) throw new HttpError(400, 'Please enter your name.');
    const phone = cleanPhone(guestPhone);
    if (!phone) throw new HttpError(400, 'Please enter a valid 10-digit Indian mobile number.');
    if (!/^\S+@\S+\.\S+$/.test(guestEmail || '')) throw new HttpError(400, 'Please enter a valid email.');
    const problem = dateProblem(checkIn, checkOut);
    if (problem) throw new HttpError(400, problem);

    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) throw new HttpError(400, 'Please enter the number of guests.');

    // A "transaction" groups steps so they all succeed or none do.
    // "FOR UPDATE" locks this place's row, so two guests can't book it at the same instant.
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const found = Number.isInteger(Number(propertyId))
        ? (await client.query('SELECT * FROM properties WHERE id = $1 FOR UPDATE', [Number(propertyId)])).rows[0]
        : undefined;
      if (!found) throw new HttpError(404, 'That place does not exist.');
      if (guestCount > found.max_guests) {
        throw new HttpError(400, `This place sleeps at most ${found.max_guests} guests.`);
      }
      if (!(await isAvailable(client, found.id, checkIn, checkOut))) {
        throw new HttpError(409, 'Sorry, those dates were just taken. Please try other dates.');
      }

      // The PRICE is worked out here, never trusted from the page.
      const total = nightsBetween(checkIn, checkOut) * found.price_per_night;
      const code = 'BK-' + crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. BK-7F3A91C2

      await client.query(`
        INSERT INTO bookings (code, property_id, guest_name, guest_email, guest_phone, guests, check_in, check_out, total_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [code, found.id, String(guestName).trim(), guestEmail.trim().toLowerCase(), phone, guestCount, checkIn, checkOut, total]);
      await client.query('COMMIT');

      res.status(201).json({ code, total_price: total, property: found.name, checkIn, checkOut });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});   // undo anything half-done
      throw err;
    } finally {
      client.release();
    }
  });

  // ---------- 3. Look up a booking ----------
  // Needs BOTH the code and the email, so strangers can't snoop on bookings.
  async function findBooking(code, email) {
    const r = await db.query(`
      SELECT b.*, p.name AS property_name, p.city, p.emoji, p.type, p.image_url
      FROM bookings b JOIN properties p ON p.id = b.property_id
      WHERE b.code = $1 AND b.guest_email = $2`,
      [String(code || '').toUpperCase(), String(email || '').trim().toLowerCase()]);
    return r.rows[0];
  }

  app.get('/api/bookings/:code', async (req, res) => {
    const booking = await findBooking(req.params.code, req.query.email);
    if (!booking) throw new HttpError(404, 'No booking found with that code and email.');
    res.json(booking);
  });

  // ---------- 4. Cancel a booking ----------
  app.post('/api/bookings/:code/cancel', async (req, res) => {
    const booking = await findBooking(req.params.code, req.body && req.body.email);
    if (!booking) throw new HttpError(404, 'No booking found with that code and email.');
    if (booking.status === 'cancelled') throw new HttpError(400, 'This booking is already cancelled.');

    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [booking.id]);
    res.json({ ok: true }); // the dates become free again automatically
  });

  // ---------- 5. Host area: see all bookings ----------
  app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
    const r = await db.query(`
      SELECT b.*, p.name AS property_name
      FROM bookings b JOIN properties p ON p.id = b.property_id
      ORDER BY b.check_in`);
    res.json(r.rows);
  });

  // ---------- 6. Host area: add a new place ----------
  app.post('/api/admin/properties', requireAdmin, async (req, res) => {
    const p = req.body || {};
    const price = Number(p.price_per_night), maxGuests = Number(p.max_guests), bedrooms = Number(p.bedrooms);

    if (!p.name || !p.city || !p.description || !['hotel', 'rental'].includes(p.type)) {
      throw new HttpError(400, 'Please fill in name, type, city and description.');
    }
    if (!Number.isInteger(price) || price < 1 || !Number.isInteger(maxGuests) || maxGuests < 1
        || !Number.isInteger(bedrooms) || bedrooms < 0) {
      throw new HttpError(400, 'Price and guest numbers must be whole numbers above zero.');
    }

    // Photo link is optional. If given, it must be a web address starting with https://
    const imageUrl = String(p.image_url || '').trim();
    if (imageUrl && !/^https:\/\/\S+$/.test(imageUrl)) {
      throw new HttpError(400, 'The photo link must start with https://');
    }
    // Amenities: "Pool, Wi-Fi , AC" -> "Pool,Wi-Fi,AC"
    const amenities = String(p.amenities || '').split(',').map((a) => a.trim()).filter(Boolean).slice(0, 12).join(',');

    const r = await db.query(`
      INSERT INTO properties (name, type, city, description, price_per_night, max_guests, bedrooms, emoji, amenities, image_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [String(p.name).trim(), p.type, String(p.city).trim(), String(p.description).trim(),
       price, maxGuests, bedrooms, String(p.emoji || '🏠').trim() || '🏠', amenities, imageUrl]);
    res.status(201).json({ id: r.rows[0].id });
  });

  // ---------- Error handler: turns any failure into a friendly message ----------
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);                                     // details go to the server log, not the guest
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}

// Only start listening if you run "node server.js" directly (tests import createApp instead).
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  openDatabase().then((db) => {
    createApp(db).listen(PORT, () => console.log(`Booking site running at http://localhost:${PORT}`));
  }).catch((err) => {
    console.error('Could not start:', err.message);
    process.exit(1);
  });
}

module.exports = { createApp };
