// db.js — the DATABASE.
// Our data lives in a Postgres database. On Render we connect to Neon using the
// DATABASE_URL setting. On your own computer, without that setting, a temporary
// in-memory database is used for practice (its data disappears when the server stops).

const { Pool } = require('pg');

// Sample places, so the site isn't empty the first time. Prices are in rupees (₹).
const SAMPLES = [
  ['Grand Harbor Hotel',  'hotel',  'Mumbai',    'Sea-view rooms, rooftop pool and breakfast included.', 6500, 3, 1, '🏨'],
  ['Lotus Palace Hotel',  'hotel',  'Jaipur',    'A heritage hotel with a courtyard and spa.',            5000, 2, 1, '🏰'],
  ['City Central Suites', 'hotel',  'Bengaluru', 'Modern suites near the business district.',            3500, 3, 1, '🌆'],
  ['Beachside Villa',     'rental', 'Goa',       'Private villa 2 minutes from the beach, with a pool.', 12000, 8, 4, '🏖️'],
  ['Hilltop Cottage',     'rental', 'Munnar',    'Cozy cottage among tea gardens. Perfect for couples.',  3000, 3, 1, '🏡'],
  ['Lakeview Apartment',  'rental', 'Udaipur',   'Bright 2-bedroom apartment overlooking the lake.',      6000, 5, 2, '🌅'],
  ['Backwater Houseboat', 'rental', 'Kochi',     'Sleep on the water! Includes a cook and a guide.',      8000, 4, 2, '🛶'],
  ['Mountain Lodge',      'hotel',  'Manali',    'Warm lodge with fireplace and mountain views.',         3500, 4, 2, '🏔️'],
];

// What each sample place offers (shown as little tags on the site).
const SAMPLE_AMENITIES = {
  'Grand Harbor Hotel': 'Sea view,Pool,Breakfast,Wi-Fi,AC',
  'Lotus Palace Hotel': 'Spa,Breakfast,Heritage stay,Wi-Fi,AC',
  'City Central Suites': 'Workspace,Wi-Fi,AC,Gym,Parking',
  'Beachside Villa': 'Private pool,Beach access,Kitchen,Wi-Fi,Parking',
  'Hilltop Cottage': 'Mountain view,Kitchen,Garden,Wi-Fi',
  'Lakeview Apartment': 'Lake view,Kitchen,Wi-Fi,AC',
  'Backwater Houseboat': 'Cook included,Guide,Meals,AC',
  'Mountain Lodge': 'Fireplace,Mountain view,Breakfast,Parking',
};

// Opens the database and makes sure its two "tables" exist.
// Pass a link to use that database; pass null to force the temporary practice one (used by tests).
async function openDatabase(connectionString = process.env.DATABASE_URL) {
  let pool;
  if (connectionString) {
    pool = new Pool({ connectionString });
  } else {
    if (process.env.RENDER) {
      throw new Error('DATABASE_URL is missing. Add it under Render > Environment before the site can start.');
    }
    console.warn('⚠️  No DATABASE_URL set: using a temporary practice database. Data is lost when the server stops.');
    const { newDb } = require('pg-mem');                 // a built-in practice database
    pool = new (newDb().adapters.createPg().Pool)();
  }

  // Tab 1: every place a guest can stay. Each row is one place.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id              SERIAL PRIMARY KEY,               -- a unique number for each place
      name            TEXT NOT NULL,
      type            TEXT NOT NULL,                    -- 'hotel' or 'rental'
      city            TEXT NOT NULL,
      description     TEXT NOT NULL,
      price_per_night INTEGER NOT NULL,                 -- in Indian rupees (₹)
      max_guests      INTEGER NOT NULL,
      bedrooms        INTEGER NOT NULL,
      emoji           TEXT NOT NULL                     -- a little picture for the card
    )`);

  // Added later: amenities ("Pool,Wi-Fi") and an optional photo link.
  // "IF NOT EXISTS" means this is safe to run every time, even on a database that already has them.
  await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''");

  // Tab 2: every reservation. Each row is one booking.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id            SERIAL PRIMARY KEY,
      code          TEXT NOT NULL UNIQUE,               -- confirmation code, e.g. "BK-7F3KQ2"
      property_id   INTEGER NOT NULL REFERENCES properties(id),
      guest_name    TEXT NOT NULL,
      guest_email   TEXT NOT NULL,
      guest_phone   TEXT NOT NULL,                      -- 10-digit Indian mobile number
      guests        INTEGER NOT NULL,
      check_in      TEXT NOT NULL,                      -- dates are stored as "YYYY-MM-DD"
      check_out     TEXT NOT NULL,
      total_price   INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'confirmed'   -- 'confirmed' or 'cancelled'
    )`);

  // Fill in the sample places only the first time (when the table is empty).
  const existing = await pool.query('SELECT id FROM properties LIMIT 1');
  if (existing.rows.length === 0) {
    for (const s of SAMPLES) {
      await pool.query(
        'INSERT INTO properties (name, type, city, description, price_per_night, max_guests, bedrooms, emoji) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        s
      );
    }
  }
  for (const [name, list] of Object.entries(SAMPLE_AMENITIES)) {
    await pool.query("UPDATE properties SET amenities = $1 WHERE name = $2 AND amenities = ''", [list, name]);
  }
  return pool;
}

module.exports = { openDatabase };
