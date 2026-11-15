// db.js — the DATABASE.
// Think of this as a spreadsheet file (booking.db) with two tabs: "properties" and "bookings".

const { DatabaseSync } = require('node:sqlite');

// Opens the file "booking.db" (creates it if it doesn't exist yet).
// Tests can pass ':memory:' to get a throwaway database instead.
function openDatabase(file = 'booking.db') {
  const db = new DatabaseSync(file);

  // Tab 1: every place a guest can stay. Each row is one place.
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id            INTEGER PRIMARY KEY AUTOINCREMENT, -- a unique number for each place
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,   -- 'hotel' or 'rental'
      city          TEXT NOT NULL,
      description   TEXT NOT NULL,
      price_per_night INTEGER NOT NULL, -- in dollars
      max_guests    INTEGER NOT NULL,
      bedrooms      INTEGER NOT NULL,
      emoji         TEXT NOT NULL    -- a little picture for the card
    );

    -- Tab 2: every reservation. Each row is one booking.
    CREATE TABLE IF NOT EXISTS bookings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT NOT NULL UNIQUE, -- confirmation code the guest keeps, e.g. "BK-7F3KQ2"
      property_id   INTEGER NOT NULL REFERENCES properties(id),
      guest_name    TEXT NOT NULL,
      guest_email   TEXT NOT NULL,
      guests        INTEGER NOT NULL,
      check_in      TEXT NOT NULL,   -- dates are stored as "YYYY-MM-DD"
      check_out     TEXT NOT NULL,
      total_price   INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'confirmed' -- 'confirmed' or 'cancelled'
    );
  `);

  seedIfEmpty(db);
  return db;
}

// Fill the database with sample places the first time, so the site isn't empty.
function seedIfEmpty(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM properties').get();
  if (n > 0) return;

  const insert = db.prepare(`
    INSERT INTO properties (name, type, city, description, price_per_night, max_guests, bedrooms, emoji)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const samples = [
    ['Grand Harbor Hotel',   'hotel',  'Mumbai',  'Sea-view rooms, rooftop pool and breakfast included.', 120, 3, 1, '🏨'],
    ['Lotus Palace Hotel',   'hotel',  'Jaipur',  'A heritage hotel with a courtyard and spa.',            95, 2, 1, '🏰'],
    ['City Central Suites',  'hotel',  'Bengaluru','Modern suites near the business district.',            80, 3, 1, '🌆'],
    ['Beachside Villa',      'rental', 'Goa',     'Private villa 2 minutes from the beach, with a pool.', 210, 8, 4, '🏖️'],
    ['Hilltop Cottage',      'rental', 'Munnar',  'Cozy cottage among tea gardens. Perfect for couples.',  70, 3, 1, '🏡'],
    ['Lakeview Apartment',   'rental', 'Udaipur', 'Bright 2-bedroom apartment overlooking the lake.',     110, 5, 2, '🌅'],
    ['Backwater Houseboat',  'rental', 'Kochi',   'Sleep on the water! Includes a cook and a guide.',     150, 4, 2, '🛶'],
    ['Mountain Lodge',       'hotel',  'Manali',  'Warm lodge with fireplace and mountain views.',         65, 4, 2, '🏔️'],
  ];
  for (const s of samples) insert.run(...s);
}

module.exports = { openDatabase };
