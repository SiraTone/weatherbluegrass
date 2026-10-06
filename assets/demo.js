/* Forecast demo: live NWS data rendered as CellScope-style on-air graphics.
   NWS (api.weather.gov) for US forecasts, Open-Meteo for place search, moon phase computed locally. */
(function () {
  var d = document;
  var $ = function (id) { return d.getElementById(id); };
  var stage = $('demoStage'), note = $('demoNote'), tabs = d.querySelectorAll('.demo-tabs [role=tab]');
  var state = { place: null, hourly: null, daily: null, tz: 'America/New_York', g: 'hourly' };
  var MARK = 'assets/logo.svg';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function say(msg, err) { note.textContent = msg || ''; note.classList.toggle('err', !!err); }
  function getJson(url) {
    return fetch(url, { headers: { Accept: 'application/geo+json, application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function fmtTime(date, opts) { return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: state.tz }, opts)).format(date); }

  // ---------- graphic frame ----------
  function frame(title, sub, body, source) {
    var now = new Date();
    return '<div class="g-head"><div class="g-brand"><img src="' + MARK + '" alt=""><div><b>CELLSCOPE</b><span>WEATHER DEMO</span></div></div>' +
      '<div class="g-title"><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>' +
      '<div class="g-cs"><img src="' + MARK + '" alt="">CellScope</div></div>' +
      '<div class="g-body">' + body + '</div>' +
      '<div class="g-foot"><span>' + esc(fmtTime(now, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })) + '</span><span>' + esc(source) + '</span></div>';
  }

  // ---------- icons ----------
  var SUN = '<circle cx="32" cy="32" r="11" fill="#f5c542"/><g stroke="#f5c542" stroke-width="3.5" stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M49 15l-4 4M19 45l-4 4"/></g>';
  var CLOUD = '<path d="M20 44a10 10 0 0 1 1-20 13 13 0 0 1 25 3 8.5 8.5 0 0 1-1 17z" fill="#b9c6dc"/>';
  var ICONS = {
    sun: SUN,
    partly: '<g transform="translate(-6 -8) scale(.8)">' + SUN + '</g><g transform="translate(8 6) scale(.85)">' + CLOUD + '</g>',
    cloud: '<g transform="translate(0 4)">' + CLOUD + '</g>',
    rain: '<g transform="translate(0 -4)">' + CLOUD + '</g><g stroke="#4d9bf0" stroke-width="3.5" stroke-linecap="round"><path d="M22 48l-3 8M32 48l-3 8M42 48l-3 8"/></g>',
    snow: '<g transform="translate(0 -4)">' + CLOUD + '</g><g fill="#e8f2ff"><circle cx="22" cy="52" r="2.6"/><circle cx="32" cy="55" r="2.6"/><circle cx="42" cy="52" r="2.6"/></g>',
    storm: '<g transform="translate(0 -4)"><path d="M20 44a10 10 0 0 1 1-20 13 13 0 0 1 25 3 8.5 8.5 0 0 1-1 17z" fill="#8393ad"/></g><path d="M34 40l-8 11h6l-3 9 10-13h-6z" fill="#ffd23f"/>',
    fog: '<g transform="translate(0 -2)">' + CLOUD + '</g><g stroke="#b9c6dc" stroke-width="3" stroke-linecap="round"><path d="M16 52h32M20 58h24"/></g>'
  };
  function iconFor(text, day) {
    var t = String(text || '').toLowerCase();
    var k = /thunder|t-storm/.test(t) ? 'storm' : /snow|flurr|sleet|ice|wintry/.test(t) ? 'snow' : /rain|shower|drizzle/.test(t) ? 'rain'
      : /fog|haze|mist|smoke/.test(t) ? 'fog' : /partly|mostly sunny|mostly clear/.test(t) ? 'partly' : /cloud|overcast/.test(t) ? 'cloud' : 'sun';
    return '<svg class="wk-i" viewBox="0 0 64 64" aria-hidden="true">' + ICONS[k] + '</svg>';
  }
  function tempColor(f) {
    return f < 50 ? ['#4fc3cf', '#2c7f93'] : f < 65 ? ['#8fd16c', '#4f8a47'] : f < 78 ? ['#f0c244', '#9a7b2e'] : f < 90 ? ['#f08a3c', '#9a4f22'] : ['#e5504a', '#8f2b27'];
  }
  function tempText(f) { return f < 50 ? '#4fc3cf' : f < 65 ? '#8fd16c' : f < 78 ? '#f0c244' : f < 90 ? '#f08a3c' : '#e5504a'; }

  // ---------- graphics ----------
  function hourly() {
    var h = state.hourly;
    if (!h || !h.length) return '<div class="g-load">No hourly data for this place.</div>';
    var pick = [];
    for (var i = 0; i < h.length && pick.length < 6; i += 2) pick.push(h[i]);
    var lo = Math.min.apply(null, pick.map(function (p) { return p.temperature; }));
    var hi = Math.max.apply(null, pick.map(function (p) { return p.temperature; }));
    var span = Math.max(hi - lo, 8);
    var cols = pick.map(function (p) {
      var t = p.temperature, c = tempColor(t), pct = 26 + (t - lo) / span * 54;
      var lbl = fmtTime(new Date(p.startTime), { hour: 'numeric' }).replace(' ', '');
      return '<div class="hb-col"><div class="hb-t">' + t + '°</div>' +
        '<div class="hb-bar" style="height:' + pct.toFixed(1) + '%;background:linear-gradient(180deg,' + c[0] + ',' + c[1] + ')"></div>' +
        '<div class="hb-c">' + esc(p.shortForecast) + '</div><div class="hb-h">' + esc(lbl) + '</div></div>';
    }).join('');
    return frame('Hour-by-hour forecast', state.place.label, '<div class="hb">' + cols + '</div>', 'Source: National Weather Service');
  }
  function sevenDay() {
    var p = state.daily;
    if (!p || !p.length) return '<div class="g-load">No daily forecast for this place.</div>';
    var days = [], i = 0;
    while (i < p.length && days.length < 7) {
      var a = p[i];
      if (a.isDaytime) {
        var n = p[i + 1] && !p[i + 1].isDaytime ? p[i + 1] : null;
        days.push({ name: days.length === 0 ? 'Today' : fmtTime(new Date(a.startTime), { weekday: 'long' }), hi: a.temperature, lo: n ? n.temperature : null, c: a.shortForecast, pop: pct(a) });
        i += n ? 2 : 1;
      } else {
        days.push({ name: 'Tonight', hi: null, lo: a.temperature, c: a.shortForecast, pop: pct(a) });
        i += 1;
      }
    }
    function pct(x) { return x.probabilityOfPrecipitation && x.probabilityOfPrecipitation.value != null ? x.probabilityOfPrecipitation.value : 0; }
    var cards = days.map(function (x) {
      var ref = x.hi != null ? x.hi : x.lo, ac = tempText(ref);
      return '<div class="wk-d" style="--ac:' + ac + '"><div class="wk-n">' + esc(x.name) + '</div>' + iconFor(x.c) +
        '<div class="wk-hi">' + (x.hi != null ? x.hi + '°' : '--') + '</div>' +
        '<div class="wk-lo">' + (x.lo != null ? 'LOW ' + x.lo + '°' : '') + '</div>' +
        '<div class="wk-c">' + esc(x.c) + '</div>' +
        '<div class="wk-p' + (x.pop >= 20 ? ' wet' : '') + '">' + (x.pop >= 20 ? x.pop + '% RAIN' : 'DRY') + '</div></div>';
    }).join('');
    return frame('7-day forecast', state.place.label, '<div class="wk">' + cards + '</div>', 'Source: National Weather Service');
  }

  // moon: synodic phase from a known new moon
  var SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
  function moonFrac(t) { var x = ((t - NEW0) / 86400000 / SYN) % 1; return x < 0 ? x + 1 : x; }
  function moonName(p) {
    return p < .03 || p > .97 ? 'New moon' : p < .22 ? 'Waxing crescent' : p < .28 ? 'First quarter' : p < .47 ? 'Waxing gibbous'
      : p < .53 ? 'Full moon' : p < .72 ? 'Waning gibbous' : p < .78 ? 'Last quarter' : 'Waning crescent';
  }
  function moonSvg(p) {
    var r = 100, cx = 110, cy = 110, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r, sweep = k > 0 ? 0 : 1;
    var lit = 'M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy + r) + ' A' + rx.toFixed(2) + ' ' + r + ' 0 0 ' + sweep + ' ' + cx + ' ' + (cy - r) + 'Z';
    var flip = p > .5 ? ' transform="translate(220 0) scale(-1 1)"' : '';
    return '<svg viewBox="0 0 220 220" role="img" aria-label="Moon phase"><defs><radialGradient id="mg" cx="35%" cy="40%"><stop offset="0" stop-color="#fff7de"/><stop offset="1" stop-color="#e8dcb4"/></radialGradient></defs>' +
      '<circle cx="110" cy="110" r="108" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/><circle cx="110" cy="110" r="100" fill="#18223a" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>' +
      '<g' + flip + '><path d="' + lit + '" fill="url(#mg)"/></g></svg>';
  }
  function nextAt(target) {
    var now = Date.now(), p = moonFrac(now), diff = (target - p + 1) % 1;
    if (diff < 0.002) diff = 1;
    return new Date(now + diff * SYN * 86400000);
  }
  function moon() {
    var p = moonFrac(Date.now()), ill = Math.round((1 - Math.cos(2 * Math.PI * p)) / 2 * 100);
    var day = { weekday: 'short', month: 'short', day: 'numeric' };
    var body = '<div class="mn">' + moonSvg(p) + '<div><h3>' + esc(moonName(p)) + '</h3>' +
      '<div class="mn-row"><small>Illumination</small><b>' + ill + '%</b></div>' +
      '<div class="mn-row"><small>Next full moon</small><b>' + esc(fmtTime(nextAt(.5), day)) + '</b></div>' +
      '<div class="mn-row"><small>Next new moon</small><b>' + esc(fmtTime(nextAt(0), day)) + '</b></div></div></div>';
    return frame('Moon phase', 'Tonight', body, 'Lunar phase calculation');
  }

  function render() {
    if (!state.place) { stage.innerHTML = '<div class="g-load">Pick a place to begin.</div>'; return; }
    stage.innerHTML = state.g === 'hourly' ? hourly() : state.g === '7day' ? sevenDay() : moon();
  }
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      state.g = b.getAttribute('data-g');
      tabs.forEach(function (o) { o.setAttribute('aria-selected', o === b ? 'true' : 'false'); });
      stage.setAttribute('aria-labelledby', b.id);
      render();
    });
    b.addEventListener('keydown', function (e) {
      var i = Array.prototype.indexOf.call(tabs, b), n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (n >= 0) { var t = tabs[(n + tabs.length) % tabs.length]; t.focus(); t.click(); e.preventDefault(); }
    });
  });

  // ---------- data ----------
  function load(lat, lon, label) {
    say('Loading forecast for ' + label + '...');
    stage.innerHTML = '<div class="g-load">Loading...</div>';
    return getJson('https://api.weather.gov/points/' + lat.toFixed(4) + ',' + lon.toFixed(4)).then(function (pt) {
      var pr = pt.properties;
      state.tz = pr.timeZone || state.tz;
      if (pr.relativeLocation && pr.relativeLocation.properties && !/,/.test(label)) {
        var rl = pr.relativeLocation.properties; label = rl.city + ', ' + rl.state;
      }
      state.place = { label: label, lat: lat, lon: lon };
      return Promise.all([getJson(pr.forecastHourly), getJson(pr.forecast)]);
    }).then(function (r) {
      state.hourly = r[0].properties.periods; state.daily = r[1].properties.periods;
      say('Live National Weather Service data for ' + state.place.label + '.');
      render();
    }).catch(function (e) {
      state.place = state.place || null;
      say(/HTTP 404/.test(String(e)) ? 'The National Weather Service only covers the US. Try a US city or town.' : 'Could not load that forecast. Try again in a moment.', true);
      if (!state.hourly) stage.innerHTML = '<div class="g-load">Forecast unavailable.</div>';
    });
  }
  function search(q) {
    q = String(q || '').trim();
    if (!q) return;
    var name = q.split(',')[0].trim(), st = (q.split(',')[1] || '').trim().toLowerCase();
    say('Searching...');
    return getJson('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) + '&count=10&country_code=US&language=en').then(function (j) {
      var rs = j.results || [];
      var hit = rs.filter(function (x) { return !st || (x.admin1 || '').toLowerCase().indexOf(st) === 0 || abbr(x.admin1) === st; })[0] || rs[0];
      if (!hit) { say('No US place found for "' + q + '".', true); return; }
      return load(hit.latitude, hit.longitude, hit.name + ', ' + abbr(hit.admin1).toUpperCase());
    }).catch(function () { say('Search is unavailable right now.', true); });
  }
  var ABBR = { alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy', 'district of columbia': 'dc' };
  function abbr(n) { n = String(n || '').toLowerCase(); return ABBR[n] || n; }

  $('demoForm').addEventListener('submit', function (e) { e.preventDefault(); search($('demoQ').value); });
  $('demoGeo').addEventListener('click', function () {
    if (!navigator.geolocation) { say('Location is not available in this browser.', true); return; }
    say('Finding your location...');
    navigator.geolocation.getCurrentPosition(function (p) {
      $('demoQ').value = '';
      load(p.coords.latitude, p.coords.longitude, 'Your location');
    }, function () { say('Location was blocked. Type a city instead.', true); }, { timeout: 8000 });
  });

  var h0 = (location.hash || '').replace('#', '');
  if (h0 === '7day' || h0 === 'moon') {
    state.g = h0;
    tabs.forEach(function (o) { o.setAttribute('aria-selected', o.getAttribute('data-g') === h0 ? 'true' : 'false'); });
  }
  stage.setAttribute('aria-labelledby', 'tab-' + state.g);
  load(37.7479, -84.2947, 'Richmond, KY');
})();
