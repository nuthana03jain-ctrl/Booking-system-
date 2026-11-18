// admin.js — the HOST AREA. The password is kept only while this page is open.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
let password = '';

// Like the guest version, but adds the password to every request.
async function adminApi(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function loadBookings() {
  const rows = await adminApi('/api/admin/bookings');
  $('bookings-count').textContent = `(${rows.length})`;
  $('bookings').innerHTML = rows.length
    ? rows.map((b) => `
        <tr>
          <td>${esc(b.code)}</td><td>${esc(b.property_name)}</td><td>${esc(b.guest_name)}</td>
          <td>${esc(b.guest_phone)}</td><td>${esc(b.guest_email)}</td>
          <td>${esc(b.check_in)}</td><td>${esc(b.check_out)}</td><td>${b.guests}</td>
          <td>${money(b.total_price)}</td>
          <td>${b.status === 'cancelled' ? '❌ Cancelled' : '✅ Confirmed'}</td>
        </tr>`).join('')
    : '<tr><td colspan="10">No bookings yet.</td></tr>';
}

$('login-form').onsubmit = async (e) => {
  e.preventDefault();
  password = $('password').value;
  $('login-error').textContent = '';
  try {
    await loadBookings();                       // this also checks the password
    $('login').classList.add('hidden');
    $('panel').classList.remove('hidden');
  } catch (err) {
    $('login-error').textContent = err.message;
  }
};

$('add-form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  $('add-msg').textContent = '';
  try {
    await adminApi('/api/admin/properties', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    form.reset();
    $('add-msg').textContent = '✅ Place added. It now shows on the home page.';
  } catch (err) {
    $('add-msg').textContent = err.message;
  }
};
