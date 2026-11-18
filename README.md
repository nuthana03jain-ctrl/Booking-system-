# 🏝️ StayEasy — Hotel & Vacation Rental Booking

A beginner-friendly booking website. Guests can search places to stay, book dates,
look up a booking with a confirmation code, and cancel it.

## Run it
```bash
npm install     # one time: downloads the tools this project uses
npm start       # starts the site -> open http://localhost:3000
npm test        # runs the automatic checks
```

## How the pieces fit together
Think of a restaurant:

| Piece | Restaurant comparison | File |
|---|---|---|
| Web page | The menu and the table the guest sits at | `public/index.html`, `style.css`, `app.js` |
| Server | The waiter + manager who enforce the rules | `server.js` |
| Database | The kitchen's notebook of everything that happened | `db.js` → `booking.db` |
| Tests | A mystery diner who tries to break things | `test.js` |

**What happens when a guest books:** the page sends the details to the server →
the server checks the rules (valid dates? enough room? still free?) → it works out the
price → it writes the booking into the database → it replies with a confirmation code.

## Rules the system enforces
- No two confirmed bookings can overlap for the same place (check-out day = next guest's check-in day is OK).
- Guests can't exceed a place's capacity; dates can't be in the past; check-out must be after check-in.
- Price is calculated by the server, not trusted from the browser. Prices are in rupees (₹).
- Mobile numbers must be valid Indian 10-digit numbers (starting 6–9).
- Viewing/cancelling needs the confirmation code **and** the booking email.

## Host area
Hosts open `/admin.html` (link at the bottom of the home page). They log in with the
password in the `ADMIN_PASSWORD` setting, see all bookings, and add new places.
On Render, set `ADMIN_PASSWORD` under the service's **Environment** tab.
Without it, the host area is switched off on purpose.

## Product plan
See `PRODUCT.md` for who the site is for, what's built and what comes next.

## Ideas for next steps
1. Real photos and a detail page per property
2. Host login: let owners add/edit their own places and see their bookings
3. Guest accounts and reviews/ratings
4. Online payment (e.g. Stripe) and confirmation emails
5. Put it on the internet (hosting) with a stronger database such as PostgreSQL
