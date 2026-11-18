// app.js — how the page BEHAVES. It talks to the server and draws results on screen.

const $ = (id) => document.getElementById(id);   // shortcut: find an element by its id

// ---------- Small helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + n.toLocaleString('en-IN');
const todayStr = () => new Date().toISOString().slice(0, 10);

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
const postJSON = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Dates can't be in the past.
$('checkIn').min = $('checkOut').min = todayStr();

// ---------- Pop-up window ----------
function openModal(html) { $('modal-content').innerHTML = html; $('modal').classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); }
$('modal-close').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };

// ---------- Searching ----------
let currentSearch = {};   // remembers the dates/guests so the booking pop-up can reuse them

async function search() {
  $('search-error').textContent = '';
  const params = new URLSearchParams();
  for (const key of ['city', 'type', 'guests', 'checkIn', 'checkOut']) {
    if ($(key).value) params.set(key, $(key).value);
  }
  currentSearch = { checkIn: $('checkIn').value, checkOut: $('checkOut').value, guests: $('guests').value };

  try {
    const places = await api('/api/properties?' + params);
    showResults(places);
  } catch (err) {
    $('search-error').textContent = err.message;
  }
}

function showResults(places) {
  $('result-count').textContent = places.length ? `${places.length} place(s) found` : 'No places match. Try changing your search.';
  $('results').innerHTML = places.map((p) => `
    <div class="card">
      <div class="pic">${p.emoji}</div>
      <div class="body">
        <span class="tag ${p.type}">${p.type === 'hotel' ? 'Hotel' : 'Vacation rental'}</span>
        <h3>${esc(p.name)}</h3>
        <div class="muted">📍 ${esc(p.city)} · 🛏️ ${p.bedrooms} bedroom(s) · 👥 up to ${p.max_guests}</div>
        <div>${esc(p.description)}</div>
        <div class="price">${money(p.price_per_night)} <span class="muted">/ night</span></div>
        ${p.total_price ? `<div class="muted">${p.nights} night(s) total: <b>${money(p.total_price)}</b></div>` : ''}
        <button data-id="${p.id}">Book this</button>
      </div>
    </div>`).join('');

  // Make every "Book this" button open the booking pop-up.
  document.querySelectorAll('.card button').forEach((btn) => {
    btn.onclick = () => openBooking(places.find((p) => p.id === Number(btn.dataset.id)));
  });
}

$('search-form').onsubmit = (e) => { e.preventDefault(); search(); };

// ---------- Booking ----------
function openBooking(p) {
  openModal(`
    <h3>${p.emoji} Book ${esc(p.name)}</h3>
    <form id="book-form">
      <label>Check-in  <input name="checkIn"  type="date" min="${todayStr()}" value="${currentSearch.checkIn || ''}" required></label>
      <label>Check-out <input name="checkOut" type="date" min="${todayStr()}" value="${currentSearch.checkOut || ''}" required></label>
      <label>Guests (max ${p.max_guests}) <input name="guests" type="number" min="1" max="${p.max_guests}" value="${Math.min(currentSearch.guests || 2, p.max_guests)}" required></label>
      <label>Your name  <input name="guestName" required></label>
      <label>Your email <input name="guestEmail" type="email" required></label>
      <div class="summary muted" id="price-preview">Choose your dates to see the price.</div>
      <p class="error" id="book-error"></p>
      <button type="submit">Confirm booking</button>
    </form>`);

  const form = $('book-form');
  // Show a live price estimate as dates change. (The server recalculates the real price.)
  const updatePrice = () => {
    const nights = Math.round((new Date(form.checkOut.value) - new Date(form.checkIn.value)) / 86400000);
    $('price-preview').innerHTML = nights > 0
      ? `${nights} night(s) × ${money(p.price_per_night)} = <b>${money(nights * p.price_per_night)}</b>`
      : 'Choose your dates to see the price.';
  };
  form.checkIn.onchange = form.checkOut.onchange = updatePrice;
  updatePrice();

  form.onsubmit = async (e) => {
    e.preventDefault();
    $('book-error').textContent = '';
    try {
      const r = await postJSON('/api/bookings', {
        propertyId: p.id, checkIn: form.checkIn.value, checkOut: form.checkOut.value,
        guests: Number(form.guests.value), guestName: form.guestName.value, guestEmail: form.guestEmail.value,
      });
      openModal(`
        <h3 class="success">✅ Booking confirmed!</h3>
        <p>${esc(r.property)}<br>${esc(r.checkIn)} → ${esc(r.checkOut)}<br>Total: <b>${money(r.total_price)}</b></p>
        <p>Your confirmation code (save it!):</p>
        <div class="code">${esc(r.code)}</div>
        <p class="muted">You'll need this code and your email to view or cancel your booking.</p>`);
      search();   // refresh the list so the booked dates disappear
    } catch (err) {
      $('book-error').textContent = err.message;
    }
  };
}

// ---------- Find / cancel my booking ----------
$('my-booking-btn').onclick = () => {
  openModal(`
    <h3>Find my booking</h3>
    <form id="lookup-form">
      <label>Confirmation code <input name="code" placeholder="BK-XXXXXXXX" required></label>
      <label>Email used to book <input name="email" type="email" required></label>
      <p class="error" id="lookup-error"></p>
      <button type="submit">Find</button>
    </form>`);
  $('lookup-form').onsubmit = async (e) => {
    e.preventDefault();
    const { code, email } = e.target;
    try {
      const b = await api(`/api/bookings/${encodeURIComponent(code.value)}?email=${encodeURIComponent(email.value)}`);
      showBooking(b, email.value);
    } catch (err) {
      $('lookup-error').textContent = err.message;
    }
  };
};

function showBooking(b, email) {
  const cancelled = b.status === 'cancelled';
  openModal(`
    <h3>${b.emoji} ${esc(b.property_name)}</h3>
    <p class="muted">📍 ${esc(b.city)}</p>
    <div class="summary">
      ${esc(b.check_in)} → ${esc(b.check_out)}<br>
      ${b.guests} guest(s) · ${money(b.total_price)}<br>
      Code: <b>${esc(b.code)}</b><br>
      Status: <b>${cancelled ? '❌ Cancelled' : '✅ Confirmed'}</b>
    </div>
    ${cancelled ? '' : '<p><button id="cancel-btn" class="danger">Cancel this booking</button></p>'}
    <p class="error" id="cancel-error"></p>`);
  if (!cancelled) {
    $('cancel-btn').onclick = async () => {
      if (!confirm('Really cancel this booking?')) return;
      try {
        await postJSON(`/api/bookings/${b.code}/cancel`, { email });
        showBooking({ ...b, status: 'cancelled' }, email);
        search();
      } catch (err) { $('cancel-error').textContent = err.message; }
    };
  }
}

search();   // show all places when the page first opens
