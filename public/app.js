// app.js — how the GUEST page BEHAVES. It talks to the server and draws everything on screen.

const $ = (id) => document.getElementById(id);   // shortcut: find an element by its id

// ---------- Small helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');                       // e.g. ₹12,000
const todayStr = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); // today in India
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const niceDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); // 15 Dec 2026
const shortDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });              // 15 Dec
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const amenitiesOf = (p) => String(p.amenities || '').split(',').map((a) => a.trim()).filter(Boolean);

// Small line icons (drawn in SVG, like the illustrations).
const svgIcon = (d) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  pin:   svgIcon('<path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  users: svgIcon('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'),
  bed:   svgIcon('<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.5"/>'),
  check: svgIcon('<path d="M5 12l5 5 9-10"/>'),
};

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
const postJSON = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// The picture for a place: its own photo if the host added one, otherwise our illustration.
// If the photo link is broken, the photo removes itself and the illustration shows instead.
function picture(p, name = p.name) {
  const photo = p.image_url ? `<img src="${esc(p.image_url)}" alt="Photo of ${esc(name)}" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="media">${Scene.forPlace(p)}${photo}</div>`;
}

// ---------- Small message at the bottom ("Code copied") ----------
let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Pop-up window ----------
let lastFocus = null;
function openModal(html, { wide = false } = {}) {
  lastFocus = document.activeElement;
  $('modal-content').innerHTML = html;
  $('modal-box').classList.toggle('wide', wide);
  $('modal-box').scrollTop = 0;
  $('modal').classList.remove('hidden');
  document.body.classList.add('no-scroll');          // stop the page behind from scrolling
  $('modal-close').focus({ preventScroll: true });
}
function closeModal() {
  $('modal').classList.add('hidden');
  document.body.classList.remove('no-scroll');
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}
$('modal-close').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };   // click outside to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal();
});

// ---------- Dates in the search box ----------
$('checkIn').min = $('checkOut').min = todayStr();
// Picking a check-in date moves check-out to at least the next day.
$('checkIn').onchange = () => {
  const ci = $('checkIn').value;
  if (!ci) return;
  $('checkOut').min = addDays(ci, 1);
  if (!$('checkOut').value || $('checkOut').value <= ci) $('checkOut').value = addDays(ci, 1);
};

// ---------- Popular destinations ----------
const DESTINATIONS = [
  ['Goa', 'Beaches & sunsets'], ['Manali', 'Snowy mountains'], ['Udaipur', 'The city of lakes'],
  ['Jaipur', 'The Pink City'], ['Kochi', 'Backwaters & houseboats'], ['Munnar', 'Misty tea gardens'],
  ['Mumbai', 'The city by the sea'], ['Bengaluru', 'The garden city'],
];
$('dest-row').innerHTML = DESTINATIONS.map(([city, tagline]) => `
  <button class="dest" data-city="${city}" aria-label="See stays in ${city}">
    ${Scene.forCity(city)}
    <span class="dest-text"><b>${city}</b><small>${tagline}</small></span>
  </button>`).join('');
document.querySelectorAll('.dest').forEach((tile) => {
  tile.onclick = () => { $('city').value = tile.dataset.city; search({ scroll: true }); };
});

// ---------- Searching ----------
const state = { type: '', places: [] };   // the chosen filter and the latest results

function setType(type) {
  state.type = type;
  document.querySelectorAll('.chip').forEach((chip) => {
    const on = chip.dataset.type === type;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', on);
  });
}
document.querySelectorAll('.chip').forEach((chip) => {
  chip.onclick = () => { setType(chip.dataset.type); search(); };
});
$('sort').onchange = () => renderResults();
$('search-form').onsubmit = (e) => { e.preventDefault(); search({ scroll: true }); };

// Grey placeholder cards while we wait for the server.
function showSkeleton() {
  $('result-count').textContent = 'Finding stays…';
  $('results').innerHTML = Array.from({ length: 6 }, () => `
    <div class="card skeleton" aria-hidden="true">
      <div class="card-media"></div>
      <div class="card-body">
        <div class="sk-line" style="width:35%"></div>
        <div class="sk-line" style="width:75%;height:16px"></div>
        <div class="sk-line" style="width:55%"></div>
        <div class="sk-line" style="width:40%;height:18px;margin-top:16px"></div>
      </div>
    </div>`).join('');
}

async function search({ scroll = false } = {}) {
  $('search-error').textContent = '';
  const city = $('city').value.trim();
  const checkIn = $('checkIn').value, checkOut = $('checkOut').value;
  if (Boolean(checkIn) !== Boolean(checkOut)) {
    $('search-error').textContent = 'Please choose both a check-in and a check-out date.';
    return;
  }

  $('results-title').textContent = city ? `Stays in ${titleCase(city)}` : 'All stays';
  showSkeleton();
  if (scroll) $('stays').scrollIntoView({ behavior: 'smooth' });

  // The free server can take up to a minute to wake up, so tell the guest why they're waiting.
  const slowNote = setTimeout(() => {
    $('result-count').textContent = 'Waking up the server. The first search can take up to a minute…';
  }, 4000);

  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (state.type) params.set('type', state.type);
  if ($('guests').value) params.set('guests', $('guests').value);
  if (checkIn && checkOut) { params.set('checkIn', checkIn); params.set('checkOut', checkOut); }

  try {
    state.places = await api('/api/properties?' + params);
    renderResults();
  } catch (err) {
    $('result-count').textContent = '';
    $('results').innerHTML = `
      <div class="empty">
        <h3>We couldn't load stays</h3>
        <p class="muted">${esc(err.message)}</p>
        <button class="btn btn-primary" id="retry-btn">Try again</button>
      </div>`;
    $('retry-btn').onclick = () => search();
  } finally {
    clearTimeout(slowNote);
  }
}

function sortPlaces(list) {
  const sorted = [...list];
  const by = $('sort').value;
  if (by === 'price-desc') sorted.sort((a, b) => b.price_per_night - a.price_per_night);
  else if (by === 'guests-desc') sorted.sort((a, b) => b.max_guests - a.max_guests || a.price_per_night - b.price_per_night);
  else sorted.sort((a, b) => a.price_per_night - b.price_per_night);
  return sorted;
}

function cardHTML(p) {
  const amen = amenitiesOf(p).slice(0, 3);
  return `
    <article class="card" tabindex="0" data-id="${p.id}" aria-label="${esc(p.name)}, ${esc(p.city)}, ${money(p.price_per_night)} per night">
      <div class="card-media">
        ${picture(p)}
        <span class="badge">${p.type === 'hotel' ? 'Hotel' : 'Holiday home'}</span>
      </div>
      <div class="card-body">
        <p class="card-loc">${ICON.pin}${esc(p.city)}</p>
        <h3>${esc(p.name)}</h3>
        <p class="card-meta">${ICON.users} Up to ${p.max_guests} · ${ICON.bed} ${plural(p.bedrooms, 'bedroom')}</p>
        ${amen.length ? `<div class="amenities">${amen.map((a) => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
        <div class="card-foot">
          <div>
            <span class="price">${money(p.price_per_night)}</span><span class="per"> / night</span>
            ${p.total_price
              ? `<div class="total">${money(p.total_price)} for ${plural(p.nights, 'night')}</div>`
              : '<div class="total free">Free cancellation</div>'}
          </div>
          <button class="btn btn-primary btn-sm" tabindex="-1">View &amp; book</button>
        </div>
      </div>
    </article>`;
}

function renderResults() {
  const list = sortPlaces(state.places);
  const checkIn = $('checkIn').value, checkOut = $('checkOut').value;
  const dates = list[0] && list[0].nights ? ` · ${shortDate(checkIn)} – ${shortDate(checkOut)}` : '';

  if (!list.length) {
    $('result-count').textContent = '';
    $('results').innerHTML = `
      <div class="empty">
        <div class="scene-box">${Scene.svg('hills')}</div>
        <h3>No stays match your search</h3>
        <p class="muted">Try another city, fewer guests or different dates.</p>
        <button class="btn btn-primary" id="clear-btn">Show all stays</button>
      </div>`;
    $('clear-btn').onclick = () => {
      $('city').value = ''; $('checkIn').value = ''; $('checkOut').value = '';
      setType('');
      search();
    };
    return;
  }

  $('result-count').textContent = `${plural(list.length, 'stay')} available${dates}`;
  $('results').innerHTML = list.map(cardHTML).join('');

  // The whole card opens the details (mouse, or Enter/Space on the keyboard).
  $('results').querySelectorAll('.card').forEach((el) => {
    const place = list.find((p) => p.id === Number(el.dataset.id));
    el.onclick = () => openDetails(place);
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails(place); } };
  });
}

// ---------- Stay details + booking form ----------
function openDetails(p) {
  const amen = amenitiesOf(p);
  const ci = $('checkIn').value, co = $('checkOut').value;
  const guests = Math.min(Math.max(Number($('guests').value) || 2, 1), p.max_guests);

  openModal(`
    <div class="detail-media">${picture(p)}</div>
    <div class="detail-grid">
      <div class="detail-info">
        <span class="pill">${p.type === 'hotel' ? 'Hotel' : 'Holiday home'}</span>
        <h2>${esc(p.name)}</h2>
        <p class="card-loc">${ICON.pin}${esc(p.city)}</p>
        <p class="card-meta">${ICON.users} Up to ${plural(p.max_guests, 'guest')} · ${ICON.bed} ${plural(p.bedrooms, 'bedroom')}</p>
        <p>${esc(p.description)}</p>
        ${amen.length ? `
          <h4>What this place offers</h4>
          <ul class="amenity-list">${amen.map((a) => `<li>${ICON.check}${esc(a)}</li>`).join('')}</ul>` : ''}
        <h4>Good to know</h4>
        <ul class="facts">
          <li>${ICON.check}Free cancellation online with your booking code</li>
          <li>${ICON.check}Pay at the property. Nothing is charged now</li>
          <li>${ICON.check}Instant confirmation</li>
        </ul>
      </div>

      <form id="book-form" class="book-panel form">
        <div class="book-price"><b>${money(p.price_per_night)}</b> <span class="muted">/ night</span></div>
        <div class="row-2">
          <label>Check-in <input name="checkIn" type="date" min="${todayStr()}" value="${ci}" required></label>
          <label>Check-out <input name="checkOut" type="date" min="${ci ? addDays(ci, 1) : todayStr()}" value="${co}" required></label>
        </div>
        <label>Guests (up to ${p.max_guests}) <input name="guests" type="number" min="1" max="${p.max_guests}" value="${guests}" required></label>
        <label>Full name <input name="guestName" autocomplete="name" required></label>
        <label>Mobile number <input name="guestPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="98765 43210" required></label>
        <label>Email <input name="guestEmail" type="email" autocomplete="email" placeholder="you@example.com" required></label>
        <div class="breakdown" id="price-preview"></div>
        <p class="error" id="book-error" role="alert"></p>
        <button type="submit" class="btn btn-primary btn-block" id="book-btn">Confirm booking</button>
        <p class="fineprint">You won't be charged now.</p>
      </form>
    </div>
    <div class="mobile-book-bar" id="book-bar">
      <div><b>${money(p.price_per_night)}</b> <span class="muted">/ night</span><div class="total free">Free cancellation</div></div>
      <button type="button" class="btn btn-primary" id="book-bar-btn">Book now</button>
    </div>`, { wide: true });

  // On phones: "Book now" jumps to the form, and the bar hides once the form is on screen.
  $('book-bar-btn').onclick = () => {
    $('book-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => $('book-form').checkIn.focus({ preventScroll: true }), 500);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => $('book-bar').classList.toggle('away', entry.isIntersecting),
      { root: $('modal-box'), threshold: 0.15 }).observe($('book-form'));
  }

  const form = $('book-form');

  // Live price breakdown. (The server works out the real price again when you book.)
  const updatePrice = () => {
    const n = nightsBetween(form.checkIn.value, form.checkOut.value);
    $('price-preview').innerHTML = n > 0
      ? `<div class="line"><span>${money(p.price_per_night)} × ${plural(n, 'night')}</span><span>${money(n * p.price_per_night)}</span></div>
         <div class="line"><span>Booking fee</span><span>₹0</span></div>
         <div class="line total-line"><span>Total, pay at property</span><span>${money(n * p.price_per_night)}</span></div>`
      : '<span class="muted">Choose your dates to see the total price.</span>';
  };
  form.checkIn.onchange = () => {
    const d = form.checkIn.value;
    if (d) {
      form.checkOut.min = addDays(d, 1);
      if (!form.checkOut.value || form.checkOut.value <= d) form.checkOut.value = addDays(d, 1);
    }
    updatePrice();
  };
  form.checkOut.onchange = updatePrice;
  updatePrice();

  form.onsubmit = async (e) => {
    e.preventDefault();
    $('book-error').textContent = '';
    const btn = $('book-btn');
    btn.disabled = true;
    btn.textContent = 'Booking…';
    const details = {
      propertyId: p.id, checkIn: form.checkIn.value, checkOut: form.checkOut.value,
      guests: Number(form.guests.value), guestName: form.guestName.value,
      guestPhone: form.guestPhone.value, guestEmail: form.guestEmail.value,
    };
    try {
      const result = await postJSON('/api/bookings', details);
      showConfirmation(result, details);
      search();   // refresh the list so the booked dates disappear
    } catch (err) {
      $('book-error').textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Confirm booking';
    }
  };
}

// ---------- "You're booked!" ----------
function showConfirmation(r, details) {
  openModal(`
    <div class="confirm">
      <div class="confirm-check">${ICON.check}</div>
      <h2>You're booked!</h2>
      <p class="muted">Your stay at <b>${esc(r.property)}</b> is confirmed.</p>
      <div class="summary">
        <div class="line"><span>Check-in</span><b>${niceDate(r.checkIn)}</b></div>
        <div class="line"><span>Check-out</span><b>${niceDate(r.checkOut)}</b></div>
        <div class="line"><span>Guests</span><b>${details.guests}</b></div>
        <div class="line"><span>Total, pay at property</span><b>${money(r.total_price)}</b></div>
      </div>
      <p class="muted">Your confirmation code</p>
      <div class="code-row">
        <span class="code">${esc(r.code)}</span>
        <button class="btn btn-ghost btn-sm" id="copy-code" type="button">Copy</button>
      </div>
      <p class="fineprint">Keep this code. You'll need it with your email to view or cancel your booking.</p>
      <button class="btn btn-primary btn-block" id="done-btn" style="margin-top:20px">Done</button>
    </div>`);
  $('copy-code').onclick = async () => {
    try { await navigator.clipboard.writeText(r.code); toast('Code copied'); }
    catch { toast('Please copy the code by hand'); }
  };
  $('done-btn').onclick = closeModal;
}

// ---------- Find / cancel my booking ----------
function openLookup() {
  openModal(`
    <div class="modal-pad">
      <h2>Find my booking</h2>
      <p class="muted" style="margin:6px 0 18px">Enter the code from your confirmation and the email you booked with.</p>
      <form id="lookup-form" class="form">
        <label>Confirmation code <input name="code" placeholder="BK-XXXXXXXX" autocapitalize="characters" required></label>
        <label>Email <input name="email" type="email" autocomplete="email" required></label>
        <p class="error" id="lookup-error" role="alert"></p>
        <button type="submit" class="btn btn-primary btn-block">Find booking</button>
      </form>
    </div>`);
  $('lookup-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const b = await api(`/api/bookings/${encodeURIComponent(form.code.value.trim())}?email=${encodeURIComponent(form.email.value)}`);
      showBooking(b, form.email.value);
    } catch (err) {
      $('lookup-error').textContent = err.message;
    }
  };
}
$('my-booking-btn').onclick = openLookup;
$('footer-booking').onclick = (e) => { e.preventDefault(); openLookup(); };

function showBooking(b, email) {
  const cancelled = b.status === 'cancelled';
  openModal(`
    <div class="modal-pad">
      <div class="booking-head">
        <div class="booking-thumb">${picture(b, b.property_name)}</div>
        <div>
          <h2>${esc(b.property_name)}</h2>
          <p class="card-loc">${ICON.pin}${esc(b.city)}</p>
        </div>
      </div>
      <div class="summary">
        <div class="line"><span>Status</span><span class="status ${cancelled ? 'cancelled' : 'ok'}">${cancelled ? 'Cancelled' : 'Confirmed'}</span></div>
        <div class="line"><span>Check-in</span><b>${niceDate(b.check_in)}</b></div>
        <div class="line"><span>Check-out</span><b>${niceDate(b.check_out)}</b></div>
        <div class="line"><span>Guests</span><b>${b.guests}</b></div>
        <div class="line"><span>Total, pay at property</span><b>${money(b.total_price)}</b></div>
        <div class="line"><span>Code</span><b>${esc(b.code)}</b></div>
      </div>
      ${cancelled ? '' : '<button id="cancel-btn" class="btn btn-danger btn-block">Cancel this booking</button>'}
      <p class="error" id="cancel-error" role="alert" style="margin-top:10px"></p>
    </div>`);
  if (!cancelled) {
    $('cancel-btn').onclick = async () => {
      if (!confirm('Cancel this booking? This cannot be undone.')) return;
      try {
        await postJSON(`/api/bookings/${encodeURIComponent(b.code)}/cancel`, { email });
        showBooking({ ...b, status: 'cancelled' }, email);
        toast('Booking cancelled');
        search();
      } catch (err) { $('cancel-error').textContent = err.message; }
    };
  }
}

// ---------- Start ----------
$('hero-art').innerHTML = Scene.svg('beach');
search();   // show all stays when the page first opens
