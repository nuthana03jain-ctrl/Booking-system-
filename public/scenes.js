// scenes.js — hand-drawn illustrations for each destination.
// They are written as SVG (a picture described in code), so they load instantly,
// look sharp on any screen, and need no photo files or permission from a photographer.
(function () {
  let counter = 0;

  // A palm tree, placed at (x, y) and resized by s.
  const palm = (x, y, s, leaf = '#2d6a4f') => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 0 Q6 -60 30 -110" stroke="#6b4423" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g fill="${leaf}">
        <path d="M30 -110q-40-10-62 16q32-6 62-16z"/><path d="M30 -110q42-14 64 10q-34-6-64-10z"/>
        <path d="M30 -110q-14-36-46-42q26 16 46 42z"/><path d="M30 -110q20-36 52-32q-32 10-52 32z"/>
      </g>
    </g>`;

  // A sky (top to bottom colours) that fills the picture.
  const sky = (u, top, bottom) => `
    <defs><linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="400" height="260" fill="url(#${u}s)"/>`;

  // Water, from light at the top to dark at the bottom.
  const water = (u, y, top, bottom) => `
    <defs><linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect y="${y}" width="400" height="${260 - y}" fill="url(#${u}w)"/>`;

  const ripples = (d) => `<path d="${d}" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round" fill="none"/>`;

  const scenes = {
    // Goa, Chennai: sunset beach with palms
    beach: (u) => `${sky(u, '#ff9a8b', '#ffe0b5')}
      <circle cx="285" cy="132" r="36" fill="#fff4cc"/>
      ${water(u, 140, '#3fb6c9', '#145f73')}
      ${ripples('M20 160h60M150 172h80M280 162h70M60 188h90')}
      <path d="M0 210 Q120 182 250 202 T400 192 V260 H0Z" fill="#f2cf98"/>
      ${palm(78, 240, 1)}${palm(330, 238, .7, '#40916c')}`,

    // Manali, Shimla, Rishikesh: snowy mountains and pine trees
    mountains: (u) => `${sky(u, '#9ccfe8', '#eaf6fb')}
      <circle cx="320" cy="60" r="22" fill="#fff8d6"/>
      <path d="M0 200 L70 120 L120 165 L200 70 L275 150 L330 105 L400 175 V260 H0Z" fill="#8aa5c4"/>
      <path d="M200 70 L224 98 L211 94 L200 104 L189 94 L176 98Z M70 120 L88 138 L70 134 L54 140Z M330 105 L346 122 L331 118 L312 124Z" fill="#fff"/>
      <path d="M0 225 Q100 180 200 215 T400 205 V260 H0Z" fill="#52796f"/>
      <g fill="#2f4f3a"><path d="M30 240l14-36 14 36z"/><path d="M54 244l12-30 12 30z"/>
        <path d="M310 238l14-38 14 38z"/><path d="M336 242l12-32 12 32z"/><path d="M362 240l13-34 13 34z"/></g>`,

    // Udaipur: a palace on a lake, with its reflection
    lake: (u) => `${sky(u, '#ffb88c', '#ffe9d6')}
      <circle cx="90" cy="110" r="30" fill="#fff1d0"/>
      <path d="M0 165 Q70 135 150 158 T300 150 T400 160 V170 H0Z" fill="#c99c7e"/>
      ${water(u, 168, '#8ec5e0', '#3a7ca5')}
      <g id="${u}pal">
        <rect x="150" y="125" width="110" height="45" fill="#f4e6cc"/>
        <rect x="136" y="140" width="22" height="30" fill="#ead6b2"/><rect x="252" y="140" width="22" height="30" fill="#ead6b2"/>
        <circle cx="205" cy="125" r="17" fill="#f4e6cc"/><circle cx="166" cy="126" r="8" fill="#f4e6cc"/><circle cx="244" cy="126" r="8" fill="#f4e6cc"/>
        <rect x="203" y="100" width="4" height="12" fill="#f4e6cc"/>
        <g fill="#c9a37a"><path d="M160 170v-13a5 5 0 0 1 10 0v13z"/><path d="M180 170v-13a5 5 0 0 1 10 0v13z"/>
          <path d="M200 170v-13a5 5 0 0 1 10 0v13z"/><path d="M220 170v-13a5 5 0 0 1 10 0v13z"/><path d="M240 170v-13a5 5 0 0 1 10 0v13z"/></g>
      </g>
      <use href="#${u}pal" transform="translate(0 340) scale(1 -1)" opacity=".22"/>
      ${ripples('M40 200h50M300 210h60M120 236h70')}`,

    // Bengaluru, Hyderabad, Kolkata: city skyline at dusk with lit windows
    city: (u) => {
      const front = [[0,160,45,100],[60,140,55,120],[125,172,40,88],[185,118,50,142],[245,155,45,105],[300,135,55,125],[365,170,35,90]];
      return `${sky(u, '#3d3b6e', '#f4a261')}
      <defs><pattern id="${u}p" width="12" height="14" patternUnits="userSpaceOnUse">
        <rect x="3" y="3" width="5" height="6" fill="#ffd97d" opacity=".85"/></pattern></defs>
      <circle cx="300" cy="150" r="30" fill="#ffd6a5" opacity=".9"/>
      <g fill="#4a4e69"><rect x="20" y="120" width="50" height="140"/><rect x="150" y="90" width="40" height="170"/>
        <rect x="250" y="110" width="45" height="150"/><rect x="340" y="130" width="50" height="130"/></g>
      ${front.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#22223b"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${u}p)"/>`).join('')}
      <rect y="246" width="400" height="14" fill="#1b1b2f"/>`;
    },

    // Jaipur, Delhi, Agra: a pink palace with arched windows
    palace: (u) => `${sky(u, '#ff9f9f', '#ffe3d3')}
      <defs><pattern id="${u}p" width="20" height="22" patternUnits="userSpaceOnUse" x="100">
        <path d="M5 20V11a5 5 0 0 1 10 0v9z" fill="#b5523b"/></pattern></defs>
      <circle cx="80" cy="70" r="26" fill="#fff0d9"/>
      <rect y="215" width="400" height="45" fill="#e9c46a"/>
      <g fill="#e07a5f"><circle cx="115" cy="130" r="8"/><circle cx="145" cy="105" r="8"/><circle cx="178" cy="85" r="9"/>
        <circle cx="200" cy="82" r="13"/><circle cx="222" cy="85" r="9"/><circle cx="255" cy="105" r="8"/><circle cx="285" cy="130" r="8"/></g>
      <path d="M100 215V130H130V105H160V85H240V105H270V130H300V215Z" fill="#e07a5f"/>
      <path d="M100 215V130H130V105H160V85H240V105H270V130H300V215Z" fill="url(#${u}p)"/>
      <path d="M186 215v-24a14 14 0 0 1 28 0v24z" fill="#7a3b2e"/>
      ${palm(40, 222, .55, '#588157')}${palm(345, 222, .6, '#588157')}`,

    // Munnar, Ooty: rolling tea gardens in the morning mist
    hills: (u) => `${sky(u, '#d8f3dc', '#f7fff7')}
      <circle cx="300" cy="70" r="24" fill="#fff3b0"/>
      <path d="M0 130 Q100 90 200 125 T400 115 V260 H0Z" fill="#95d5b2"/>
      <ellipse cx="130" cy="135" rx="140" ry="10" fill="#fff" opacity=".55"/>
      <path d="M0 170 Q120 125 240 165 T400 150 V260 H0Z" fill="#52b788"/>
      <g stroke="#74c69d" stroke-width="3" fill="none" opacity=".8">
        <path d="M0 186 Q120 142 240 182 T400 167"/><path d="M0 200 Q120 156 240 196 T400 181"/></g>
      <path d="M0 212 Q140 172 260 207 T400 197 V260 H0Z" fill="#2d6a4f"/>
      <g stroke="#40916c" stroke-width="3" fill="none"><path d="M0 228 Q140 188 260 223 T400 213"/><path d="M0 244 Q140 204 260 239 T400 229"/></g>`,

    // Kochi, Alleppey: backwaters with a houseboat and palms
    backwater: (u) => `${sky(u, '#c7f0db', '#fefae0')}
      <circle cx="210" cy="95" r="26" fill="#fff6c9"/>
      <path d="M0 168 Q100 150 200 165 T400 160 V172 H0Z" fill="#3a7d44"/>
      ${water(u, 168, '#5fb49c', '#1f6f5c')}
      <rect x="160" y="187" width="90" height="14" fill="#8a5a3b"/>
      <path d="M148 201 Q205 166 262 201Z" fill="#d4a24c"/>
      <path d="M130 200 Q205 220 282 200 L270 213 Q205 230 142 213Z" fill="#6b4226"/>
      ${ripples('M60 228h60M290 236h70M170 246h60')}
      ${palm(30, 176, .8)}${palm(352, 176, .75, '#40916c')}`,

    // Mumbai: the sea, a skyline and a grand arch
    harbor: (u) => `${sky(u, '#a2d2ff', '#fff1e6')}
      <circle cx="320" cy="76" r="24" fill="#fff"/>
      <g fill="#9aa5b1"><rect x="0" y="122" width="34" height="40"/><rect x="40" y="108" width="26" height="54"/><rect x="72" y="128" width="30" height="34"/>
        <rect x="280" y="114" width="28" height="48"/><rect x="314" y="126" width="36" height="36"/><rect x="356" y="104" width="30" height="58"/></g>
      ${water(u, 160, '#48cae4', '#0077b6')}
      <path d="M150 162V112H250V162H220V142a20 20 0 0 0-40 0V162Z" fill="#d4a373"/>
      <g fill="#c08552"><rect x="150" y="100" width="18" height="14"/><rect x="232" y="100" width="18" height="14"/><circle cx="200" cy="110" r="12"/></g>
      <path d="M60 204h40l-8 9h-24z" fill="#fff"/><path d="M80 203v-28l15 26z" fill="#ffd166"/>
      <path d="M300 222h34l-7 8h-20z" fill="#fff"/><path d="M317 221v-22l12 20z" fill="#ef476f"/>
      ${ripples('M130 196h50M220 210h60M30 236h80')}`,
  };

  // Which picture to use for each city.
  const byCity = {
    goa: 'beach', chennai: 'beach', pondicherry: 'beach',
    manali: 'mountains', shimla: 'mountains', rishikesh: 'mountains', darjeeling: 'mountains',
    udaipur: 'lake', jaipur: 'palace', delhi: 'palace', agra: 'palace', jodhpur: 'palace',
    bengaluru: 'city', bangalore: 'city', hyderabad: 'city', kolkata: 'city', pune: 'city',
    munnar: 'hills', ooty: 'hills', coorg: 'hills',
    kochi: 'backwater', alleppey: 'backwater', alappuzha: 'backwater',
    mumbai: 'harbor',
  };

  function svg(key) {
    const u = 'sc' + (++counter);                  // unique id for this picture
    const draw = scenes[key] || scenes.city;
    return `<svg class="scene" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${draw(u)}</svg>`;
  }
  const keyForCity = (city) => byCity[String(city || '').toLowerCase().trim()];

  window.Scene = {
    svg,
    forCity: (city) => svg(keyForCity(city) || 'city'),
    // Unknown city? Hotels get the city picture, holiday homes get the hills.
    forPlace: (p) => svg(keyForCity(p.city) || (p.type === 'rental' ? 'hills' : 'city')),
  };
})();
