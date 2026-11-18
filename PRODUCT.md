# StayEasy — Product Plan (plain English)

## Who it's for
- **Guests:** Indian travellers who want a hotel or holiday rental, mostly on a phone, priced in rupees.
- **Hosts:** owners of hotels, cottages and flats who want more bookings without a big system.

## The problem
Finding a stay means jumping between many sites, and small hosts are hard to find. Guests want a simple search, a clear rupee price and a booking code they can keep.

## What's built (version 1)
| Area | What a user can do |
|---|---|
| Guest search | Search by city, type, dates and guest count. Booked dates are hidden. |
| Guest booking | Book with name, Indian mobile number and email. Get a confirmation code. |
| Guest self-service | Find a booking with the code and email. Cancel it. |
| Host area | Log in with a password. See all bookings. Add a new place. |
| Reliability | Clear "waking up the server" message. Clear error messages. India time for "today". |

## Decisions I made as product manager
1. **Rupees and Indian mobile numbers first.** These are the things an Indian guest or host checks first.
2. **Simple host password instead of accounts.** One owner is enough for now. Real host accounts come when several hosts sign up.
3. **No payment yet.** Guests pay the property directly. Online payment needs a business account and checks, so it comes later.
4. **No tax figure yet.** GST rules depend on the property and the price, so an accountant should confirm them before we add a tax line.

## Next priorities (in order)
1. **Keep data safe.** The free hosting can lose bookings on restart. Move to a database that persists.
2. **Online payment** (for example Razorpay with UPI and cards), plus a payment receipt.
3. **Confirmation by SMS or WhatsApp** using the guest's mobile number.
4. **Host accounts** so each owner sees only their own places.
5. **Photos, reviews and a place detail page.**
6. **Expo Go mobile app** using the same server.

## How we'll know it works
- Guests who search also book (conversion).
- Searches that return no results (shows missing places).
- Bookings that get cancelled (shows trust problems).
- Time for a host to add a place (shows how easy the host area is).

## Risks
- **Lost bookings** on free hosting (fix in priority 1).
- **Host password** must be strong and kept private.
- **Tax and legal rules** for online bookings in India need professional advice before taking real money.
