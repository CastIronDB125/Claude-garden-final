const STAGE_OPTIONS = [
  'Seeds — not yet sown','Seeds — sown, not sprouted','Just germinated / sprouted',
  'Seedling (cotyledons)','Seedling (true leaves emerging)','Early vegetative','Vegetative',
  'Pre-flowering','Flowering','Fruiting','Ready to harvest','Hardening off',
  'Transplanted outdoors','DWC — net pot placed','DWC — roots reaching water','DWC — established'
];

const HARDEN_SCHEDULE = [
  {day:1, hours:1,  shade:true,  notes:'Dappled shade only — no direct sun'},
  {day:2, hours:2,  shade:true,  notes:'Dappled shade; bring in if wind > 10mph'},
  {day:3, hours:3,  shade:false, notes:'Morning sun OK; avoid afternoon direct'},
  {day:4, hours:4,  shade:false, notes:'Morning sun + 1h afternoon max'},
  {day:5, hours:5,  shade:false, notes:'Increasing direct sun'},
  {day:6, hours:6,  shade:false, notes:'Half-day sun'},
  {day:7, hours:8,  shade:false, notes:'Full day OK if overnight lows > 50°F'},
  {day:8, hours:10, shade:false, notes:'Near-full outdoor exposure'},
  {day:9, hours:12, shade:false, notes:'Full sun — check frost forecast'},
  {day:10,hours:14, shade:false, notes:'Full outdoor — ready to transplant if frost-free'}
];

// ── INIT ────────────────────────────────────────────────────────────
async function init() {
  try {
    const [config, plants] = await Promise.all([
      fetch('data/config.json').then(r => r.json()),
      fetch('data/plants.json').then(r => r.json())
    ]);
    state.config = config;
    state.plants = plants;
    loadLogs();
    renderSidebar();
    renderDetail();
    fetchWeather();
  } catch(e) {
    console.error('Init failed', e);
    document.getElementById('weather-panel').innerHTML = '<div style="padding:16px;color:#d46a6a;font-size:12px">Failed to load data files. Check that data/config.json and data/plants.json exist.</div>';
  }
}

// ── LOGS (localStorage) ─────────────────────────────────────────────
function loadLogs() {
  try { const r = localStorage.getItem(LS_KEY); if(r) state.logs = JSON.parse(r); }
  catch(e) { state.logs = {daily:[], dwc:[]}; }
  // Ensure per-plant harden/ph/ec/feed logs exist
  state.plants.forEach(p => {
    if(!p._notes)  p._notes  = [];
    if(!p._feeds)  p._feeds  = [];
    if(!p._phLog)  p._phLog  = [];
    if(!p._ecLog)  p._ecLog  = [];
    if(!p._hardenStart) p._hardenStart = null;
    if(!p._stage)  p._stage  = p.status;
    if(!p._lightHours) p._lightHours = defaultLight(p);
  });
}

function saveLogs() {
  // Save both logs AND per-plant mutable fields
  const saveData = {
    logs: state.logs,
    plantMutables: state.plants.map(p => ({
      id: p.id,
      _notes: p._notes,
      _feeds: p._feeds,
      _phLog: p._phLog,
      _ecLog: p._ecLog,
      _waterLog: p._waterLog,
      _photos: p._photos,
      _hardenStart: p._hardenStart,
      _stage: p._stage,
      _lightHours: p._lightHours
    }))
  };
  localStorage.setItem(LS_KEY, JSON.stringify(saveData));
  flashSave();
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if(saved && saved.logs) state.logs = saved.logs;
    else state.logs = {daily:[], dwc:[]};

    state.plants.forEach(p => {
      const m = saved && saved.plantMutables ? saved.plantMutables.find(x => x.id === p.id) : null;
      p._notes       = m ? (m._notes  || []) : [];
      p._feeds       = m ? (m._feeds  || []) : [];
      p._phLog       = m ? (m._phLog  || []) : [];
      p._ecLog       = m ? (m._ecLog  || []) : [];
      p._waterLog    = m ? (m._waterLog || []) : [];
      p._photos      = m ? (m._photos     || []) : [];
      p._hardenStart = m ? (m._hardenStart || null) : null;
      p._stage       = m ? (m._stage  || p.status) : p.status;
      p._lightHours  = m ? (m._lightHours || defaultLight(p)) : defaultLight(p);
    });
  } catch(e) {
    state.logs = {daily:[], dwc:[]};
    state.plants.forEach(p => {
      p._notes=[]; p._feeds=[]; p._phLog=[]; p._ecLog=[]; p._waterLog=[]; p._photos=[];
      p._hardenStart=null; p._stage=p.status; p._lightHours=defaultLight(p);
    });
  }
}

function defaultLight(p) {
  if(p.system === 'Bonsai') return 14;
  if(p.category === 'Lettuce') return 14;
  if(p.system === 'DWC') return 18;
  if(p.group && p.group.includes('herb')) return 16;
  return 18;
}

function flashSave() {
  const el = document.getElementById('save-msg');
  if(!el) return;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── WEATHER ─────────────────────────────────────────────────────────
async function fetchWeather() {
  const c = state.config;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset,daylight_duration` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch` +
    `&timezone=America%2FChicago&forecast_days=7`;
  try {
    const data = await fetch(url).then(r => r.json());
    weatherData = data;
    renderWeather(data);
    if(currentTab === 'harden off') renderTab();
  } catch(e) {
    document.getElementById('weather-panel').innerHTML = '<div style="padding:14px 18px;color:var(--text3);font-size:12px">Weather unavailable — check connection.</div>';
  }
}

function moonPhase() {
  // Accurate moon phase calculation (Meeus algorithm)
  const now = new Date();
  const year = now.getFullYear() + (now.getMonth()) / 12 + now.getDate() / 365.25;
  const k = Math.round((year - 2000) * 12.3685);
  const T = k / 1236.85;
  const JDE = 2451550.09766 + 29.530588861 * k + 0.00015437 * T*T;
  const phase = ((JDE - 2451550.09766) % 29.530588861) / 29.530588861;
  const p = ((phase % 1) + 1) % 1;
  if(p < 0.0625 || p >= 0.9375) return {icon:'🌑', name:'New Moon'};
  if(p < 0.1875) return {icon:'🌒', name:'Waxing Crescent'};
  if(p < 0.3125) return {icon:'🌓', name:'First Quarter'};
  if(p < 0.4375) return {icon:'🌔', name:'Waxing Gibbous'};
  if(p < 0.5625) return {icon:'🌕', name:'Full Moon'};
  if(p < 0.6875) return {icon:'🌖', name:'Waning Gibbous'};
  if(p < 0.8125) return {icon:'🌗', name:'Last Quarter'};
  return {icon:'🌘', name:'Waning Crescent'};
}

function wxIcon(code) {
  if(code === 0) return '☀️';
  if(code <= 2) return '⛅';
  if(code <= 45) return '☁️';
  if(code <= 67) return '🌧️';
  if(code <= 77) return '🌨️';
  if(code <= 82) return '🌦️';
  return '⛈️';
}

function wxDesc(code) {
  if(code === 0) return 'Clear sky';
  if(code === 1) return 'Mainly clear';
  if(code === 2) return 'Partly cloudy';
  if(code === 3) return 'Overcast';
  if(code <= 45) return 'Foggy';
  if(code <= 55) return 'Drizzle';
  if(code <= 67) return 'Rain';
  if(code <= 77) return 'Snow';
  if(code <= 82) return 'Rain showers';
  return 'Thunderstorm';
}

function windDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function uvClass(uv) {
  if(uv < 3) return 'uv-low';
  if(uv < 6) return 'uv-mod';
  if(uv < 8) return 'uv-high';
  return 'uv-vhigh';
}

function uvLabel(uv) {
  if(uv < 3) return 'Low';
  if(uv < 6) return 'Moderate';
  if(uv < 8) return 'High';
  if(uv < 11) return 'Very High';
  return 'Extreme';
}

function fmtTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/Chicago'});
}

function fmtDaylight(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ── WEATHER NARRATIVE ────────────────────────────────────────────────
function weatherNarrative(cur, daily) {
  const temp   = Math.round(cur.temperature_2m);
  const feels  = Math.round(cur.apparent_temperature);
  const lo     = Math.round(daily.temperature_2m_min[0]);
  const wind   = Math.round(cur.wind_speed_10m);
  const pop    = daily.precipitation_probability_max[0] || 0;
  const _freezeNights = daily.temperature_2m_min.filter(t => Math.round(t) <= 28).length;
  let opening = temp + '\u00b0F with a feels-like of ' + feels + '\u00b0F. Tonight bottoms out near ' + lo + '\u00b0F';
  if(wind > 20) opening += ', winds ' + wind + ' mph';
  opening += '.';
  let verdictText, verdictColor;
  if(lo <= 32) {
    verdictText  = 'Frost risk tonight \u2014 keep everything inside. No hardening today.' + (pop > 30 ? ' Rain chance ' + pop + '%.' : '');
    verdictColor = _freezeNights >= 1 ? '#6495ED' : '#87CEEB';
  } else if(lo <= 40) {
    verdictText  = 'Reasonable day for lettuce or hardy bonsai. Too cold tonight for tomatoes and peppers.';
    verdictColor = null;
  } else if(lo <= 50) {
    verdictText  = 'Good day for lettuce, bonsai, and tomatoes. Peppers should stay in overnight.';
    verdictColor = null;
  } else {
    verdictText  = 'Good outdoor day for all crops. Overnight lows are safe.';
    verdictColor = null;
  }
  const verdict = verdictColor ? '<strong style="color:' + verdictColor + '">' + verdictText + '</strong>' : verdictText;
  return { opening, verdict };
}


// ── WEATHER RENDERING ──────────────────────────────
function renderWeather(cur, daily) {
  const narrative = weatherNarrative(cur, daily);
  const panel   = document.getElementById('weather-panel');
  const summary = document.getElementById('wx-summary');
  if(!panel || !summary) return;

  const wind   = Math.round(cur.wind_speed_10m);
  const deg    = cur.wind_direction_10m || 0;
  const dirs   = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const wDir   = dirs[Math.round(deg/22.5)%16];
  const uvIdx  = cur.uv_index ?? 0;
  const uvLbl  = uvIdx<3?'0 — Low':uvIdx<6?uvIdx+' — Moderate':uvIdx<8?uvIdx+' — High':uvIdx+' — Very High';
  const uvCol  = uvIdx<3?'#6ab55a':uvIdx<6?'#b8a040':'#c47c7c';
  const pop0   = daily.precipitation_probability_max[0]||0;
  const precip = daily.precipitation_sum&&daily.precipitation_sum[0]!==undefined?daily.precipitation_sum[0].toFixed(2):'0.00';
  const sunrise= (daily.sunrise||[])[0]?new Date(daily.sunrise[0]).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'--';
  const sunset = (daily.sunset||[])[0]?new Date(daily.sunset[0]).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'--';
  const daylight= daily.daylight_duration?(daily.daylight_duration[0]/3600).toFixed(0)+'h '+Math.round((daily.daylight_duration[0]%3600)/60)+'m':'--';
  const lightsOn = state.config.lights&&state.config.lights.on?state.config.lights.on:'05:15';
  const lightsOff= state.config.lights&&state.config.lights.off?state.config.lights.off:'22:45';
  const lightHrs = (()=>{const[oh,om]=lightsOn.split(':').map(Number),[fh,fm]=lightsOff.split(':').map(Number);let d=(fh*60+fm)-(oh*60+om);if(d<0)d+=1440;return(d/60).toFixed(1);})();
  const hiToday = Math.round(daily.temperature_2m_max[0]);
  const loToday = Math.round(daily.temperature_2m_min[0]);
  const icons={0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',51:'🌧',61:'🌧',65:'🌧',71:'🌨',80:'🌦',95:'⛈'};

  // WX SUMMARY — sticky element, direct child of #app
  summary.innerHTML = `
    <div class="wx-narrative">
      <div class="wx-narrative-opening">${narrative.opening}</div>
      <div class="wx-narrative-verdict">${narrative.verdict}</div>
    </div>
    <div class="wx-top">
      <div class="wx-current">
        <div class="wx-temp">${Math.round(cur.temperature_2m)}&deg;</div>
        <div class="wx-desc">${cur.weatherDesc||'Overcast'}</div>
        <div class="wx-feels">Feels like ${Math.round(cur.apparent_temperature)}&deg;F</div>
        <div class="wx-loc">${state.config.locationName}</div>
      </div>
      <div class="wx-details">
        <div class="wx-detail-cell"><div class="wx-detail-label">Humidity</div><div class="wx-detail-val">${Math.round(cur.relative_humidity_2m)}<span class="wx-detail-unit">%</span></div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">Wind</div><div class="wx-detail-val">${wind}<span class="wx-detail-unit"> mph ${wDir}</span></div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">UV Index</div><div class="wx-detail-val" style="font-size:12px;color:${uvCol}">${uvLbl}</div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">Today Hi/Lo</div><div class="wx-detail-val">${hiToday}&deg;&nbsp;/&nbsp;${loToday}&deg;</div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">Rain Chance</div><div class="wx-detail-val">${pop0}<span class="wx-detail-unit">%</span></div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">Precipitation</div><div class="wx-detail-val">${precip}<span class="wx-detail-unit">"</span></div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">Indoor Lights</div><div class="wx-detail-val" style="font-size:11px">${lightHrs}h / day</div></div>
        <div class="wx-detail-cell"><div class="wx-detail-label">Lights Schedule</div><div class="wx-detail-val" style="font-size:11px">${lightsOn} &ndash; ${lightsOff}</div></div>
      </div>
      <div class="wx-right">
        <div class="wx-sun-row"><span>☀️</span><span>Sunrise ${sunrise}</span></div>
        <div class="wx-sun-row"><span>🟠</span><span>Sunset ${sunset}</span></div>
        <div class="wx-sun-row"><span>🔵</span><span>Daylight: ${daylight}</span></div>
        <div class="wx-moon">🌙 Moon phase<br>${cur.moonPhase||'New Moon'}</div>
      </div>
    </div>`;

  // WEATHER PANEL — static, just the scrollable strips
  const safe = new Date(state.config.safePlanting||'2026-04-27');
  const today2 = new Date();
  const df = d=>Math.ceil((d-today2)/86400000);
  const fmt = d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const lettH = addDays(safe,-21), tomH = addDays(safe,-10), pepH = addDays(safe,-7);
  const lo0 = loToday;
  const oClass = lo0<=28?'freeze':lo0<=32?'frost':lo0<=40?'warn':'ok';
  const oText  = lo0<=32?'Frost — inside':lo0<=40?'Marginal':lo0<=50?'OK — cover peppers':'Good to go';
  const dfrost = Math.ceil((new Date(state.config.lastFrost||'2026-04-20')-today2)/86400000);
  const dsafe  = df(safe);
  const sowStart = (state.config.sowWindow&&state.config.sowWindow.start)||'Feb 16–20';
  const sowYear  = (state.config.sowWindow&&state.config.sowWindow.year)||'2026';

  const forecastDays = daily.temperature_2m_max.map((hi,i)=>{
    const d2=new Date(today2);d2.setDate(today2.getDate()+i);
    const lo=Math.round(daily.temperature_2m_min[i]),h=Math.round(hi);
    const pop=daily.precipitation_probability_max[i]||0;
    const code=(daily.weather_code||[])[i]||0;
    const uv=daily.uv_index_max?Math.round(daily.uv_index_max[i]):0;
    const isFrz=lo<=28,isFrost=lo<=32,isToday=i===0;
    const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const loC=isFrz?'freeze':isFrost?'frost':'';
    const dayC=isToday?'today':isFrz?'freeze-risk':isFrost?'frost-risk':'';
    const badge=isFrz?'<div class="wfd-badge freeze">FROST</div>':isFrost?'<div class="wfd-badge frost">FROST</div>':'<div class="wfd-badge ok">OK</div>';
    const ic=icons[code]||'🌡';
    return `<div class="wx-forecast-day ${dayC}">
      <div class="wfd-day">${isToday?'TODAY':dayNames[d2.getDay()]}</div>
      <div class="wfd-icon">${ic}</div>
      <div class="wfd-hi">${h}&deg;</div>
      <div class="wfd-lo ${loC}">${lo}&deg;</div>
      ${pop>20?`<div class="wfd-pop">${pop}%</div>`:''}
      <div class="wfd-uv">UV ${uv}</div>
      ${badge}
    </div>`;
  }).join('');

  panel.innerHTML = `
    <button class="wx-collapse-btn" onclick="toggleWeatherPanel()">&#9660; Weather details &nbsp;&mdash;&nbsp; tap to collapse</button>
    <div class="wx-garden-strip">
      <div class="wx-garden-metric"><div class="wgm-label">Last Frost</div><div class="wgm-val" style="color:#87CEEB">${dfrost>0?dfrost+'d':'Past'}</div><div class="wgm-sub">≈Apr 20</div></div>
      <div class="wx-garden-metric"><div class="wgm-label">Safe Planting</div><div class="wgm-val" style="color:var(--green-bright)">${dsafe>0?dsafe+'d':'Past'}</div><div class="wgm-sub">≈Apr 27</div></div>
      <div class="wx-garden-metric"><div class="wgm-label">Lettuce Harden</div><div class="wgm-val">${fmt(lettH)}</div><div class="wgm-sub">-21 days</div></div>
      <div class="wx-garden-metric"><div class="wgm-label">Tomato Harden</div><div class="wgm-val">${fmt(tomH)}</div><div class="wgm-sub">-10 days</div></div>
      <div class="wx-garden-metric"><div class="wgm-label">Pepper Harden</div><div class="wgm-val">${fmt(pepH)}</div><div class="wgm-sub">After lows &gt;55&deg;F</div></div>
      <div class="wx-garden-metric"><div class="wgm-label">Sow Window</div><div class="wgm-val">${sowStart}</div><div class="wgm-sub">${sowYear}</div></div>
      <div class="wx-garden-metric"><div class="wgm-label">Today Outside</div><div class="wgm-val ${oClass}">${oText}</div><div class="wgm-sub">Based on tonight low</div></div>
    </div>
    <div class="wx-forecast-strip">${forecastDays}</div>`;
}

function toggleWeatherPanel() {
  const p = document.getElementById('weather-panel');
  if(!p) return;
  p.classList.toggle('expanded');
  const btn = p.querySelector('.wx-collapse-btn');
  if(btn) btn.innerHTML = p.classList.contains('expanded')
    ? '&#9650; Weather details &nbsp;&mdash;&nbsp; tap to collapse'
    : '&#9660; Weather details &nbsp;&mdash;&nbsp; tap to expand';
}

function renderSidebar() {
  const filters = ['All','DWC','Soil','Bonsai','Uncertain','Harden Off'];
  document.getElementById('filter-bar').innerHTML = filters.map(f =>
    `<button class="filter-btn${currentFilter===f?' active':''}" onclick="setFilter('${f}')">${f}</button>`
  ).join('');

  const list = currentFilter==='All' ? state.plants
    : currentFilter==='Harden Off' ? state.plants.filter(p=>p.hardeningRequired)
    : state.plants.filter(p=>cat(p)===currentFilter);

  document.getElementById('plant-list').innerHTML = list.map(p => {
    const c = cat(p);
    const days = daysSince(p.sowDate);
    const hd = p._hardenStart ? (daysSince(p._hardenStart)+1) : 0;
    return `<div class="plant-item${p.id===selectedId?' active':''}" onclick="selectPlant('${p.id}')">
      <div class="pi-name">${p.plant}${p.nickname?` <span style="color:var(--text3);font-size:10px">(${p.nickname})</span>`:''}</div>
      <div class="pi-stage">${p._stage}</div>
      <div class="pi-meta">
        <span class="badge badge-${c.toLowerCase()}">${c}</span>
        ${p.hardeningRequired?'<span class="badge badge-harden">harden</span>':''}
        ${p.viability?'<span class="badge badge-uncertain">low viab.</span>':''}
        ${days!==null?`<span class="pi-days">d${days}</span>`:''}
        ${hd>0&&hd<=10?`<span class="pi-harden">H${hd}/10</span>`:''}
      </div>
    </div>`;
  }).join('') || '<div style="padding:14px;font-size:12px;color:var(--text3)">No plants in this category.</div>';
}

// ── DETAIL ───────────────────────────────────────────────────────────
function renderDetail() {
  const d = document.getElementById('detail');
  if(!selectedId) { d.innerHTML = '<div class="empty-detail">← Select a plant to view details</div>'; return; }
  const p = state.plants.find(x=>x.id===selectedId);
  if(!p) return;
  const c = cat(p);
  const tabs = ['overview','grow log','feed','light'];
  if(c==='DWC') tabs.splice(1,0,'dwc');
  if(p.hardeningRequired) tabs.push('harden off');

  const days = daysSince(p.sowDate);
  d.innerHTML = `
    <div id="detail-header">
      <div class="detail-header-inner">
        <div class="detail-header-meta">
          <div class="detail-title-row">
            <div class="detail-title">${p.plant}</div>
            <div class="detail-badges">
              <span class="badge badge-${c.toLowerCase()}">${c}</span>
              ${p.hardeningRequired?'<span class="badge badge-harden">harden off</span>':''}
              ${p.viability?'<span class="badge badge-uncertain">low viability</span>':''}
              ${p.nickname?`<span class="badge badge-nickname">${p.nickname}</span>`:''}
            </div>
          </div>
          <div class="detail-meta">${p.variety} · ${p.destination}</div>
          <div class="detail-id">${p.id}${p.bucket?' · Bucket: '+p.bucket:''}</div>
          ${p.sowDate?`<div class="detail-meta dim">Sown ${fmtDate(p.sowDate)} · Day ${days}</div>`:''}
        </div>
        ${latestPhoto(p)
          ? `<div class="detail-header-photo"><img src="${latestPhoto(p).b64}" alt="Latest photo" loading="lazy"><span class="detail-photo-date">${latestPhoto(p).date}</span></div>`
          : '<div class="detail-header-photo-empty">U0001f331</div>'}
      </div>
    </div>
    <div style="padding:0 18px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div class="tab-bar">${tabs.map(t=>`<button class="tab${currentTab===t?' active':''}" onclick="setTab('${t}')">${t}</button>`).join('')}</div>
    </div>
    <div id="tab-content"></div>
  `;
  renderTab();
}

function renderTab() {
  const tc = document.getElementById('tab-content'); if(!tc) return;
  const p = state.plants.find(x=>x.id===selectedId); if(!p) return;
  const c = cat(p);
  if(currentTab==='overview')   renderOverview(p,tc);
  else if(currentTab==='dwc')   renderDWC(p,tc);
  else if(currentTab==='grow log') renderGrowLog(p,tc);
  else if(currentTab==='feed')  renderFeed(p,tc);
  else if(currentTab==='light') renderLight(p,tc);
  else if(currentTab==='harden off') renderHarden(p,tc);
}


// ── PHOTO HELPERS ─────────────────────────────────────
function compressPhoto(file, callback) {
  const MAX_W = 900, QUALITY = 0.65;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, MAX_W / img.width);
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function addPhotoToPlant(plantId, b64, date) {
  const p = state.plants.find(x => x.id === plantId); if(!p) return false;
  if(!p._photos) p._photos = [];
  p._photos.unshift({ b64, date });
  if(p._photos.length > 10) p._photos = p._photos.slice(0, 10);
  saveLogs();
  return true;
}

function latestPhoto(p) {
  return (p._photos && p._photos.length) ? p._photos[0] : null;
}

// ── OVERVIEW ─────────────────────────────────────────────────────────
function renderOverview(p,tc) {
  const days = daysSince(p.sowDate);
  const lph = p._phLog.length ? p._phLog[p._phLog.length-1] : null;
  const lGrowLog = state.logs.daily.filter(l=>l.plantId===p.id).slice(-1)[0] || null;
  tc.innerHTML = `
    <div class="metrics-row">
      <div class="metric"><div class="metric-label">System</div><div class="metric-val sm">${p.system}</div></div>
      <div class="metric"><div class="metric-label">Light / day</div><div class="metric-val">${p._lightHours}<span class="metric-unit">h</span></div></div>
      <div class="metric"><div class="metric-label">Age</div><div class="metric-val">${days!==null?days:'—'}<span class="metric-unit">${days!==null?'d':''}</span></div></div>
      ${lph?`<div class="metric"><div class="metric-label">Last pH</div><div class="metric-val ${lph.value>=5.8&&lph.value<=6.2?'ok':'bad'}">${lph.value.toFixed(1)}</div></div>`:
            `<div class="metric"><div class="metric-label">Category</div><div class="metric-val sm">${p.category}</div></div>`}
    </div>

    <div class="card">
      <div class="card-label">Growth stage</div>
      <select class="field-select" onchange="updateStage('${p.id}',this.value)">
        ${STAGE_OPTIONS.map(s=>`<option${s===p._stage?' selected':''}>${s}</option>`).join('')}
      </select>
    </div>

    <div class="two-col">
      <div class="card"><div class="card-label">Group</div><div class="card-val">${p.group||'—'}</div></div>
      <div class="card"><div class="card-label">Status</div><div class="card-val">${p._stage}</div></div>
    </div>

    ${p.shuRange?`<div class="card"><div class="card-label">Heat (SHU)</div><div class="card-val">${p.shuRange}</div></div>`:''}
    ${p.viability?`<div class="alert gold"><strong>Low viability seeds:</strong> ${p.viability}<br>Keep at 85–90°F on heat mat. Do not discard before 6 weeks.</div>`:''}
    ${p.info?`<div class="card"><div class="card-label">Plant notes</div><div class="card-val dim">${p.info}</div></div>`:''}

    ${lGrowLog?`<div class="card"><div class="card-label">Last grow log — ${lGrowLog.date}</div>
      <div class="card-val">${lGrowLog.condition||''} ${lGrowLog.height?`· ${lGrowLog.height}" tall`:''} ${lGrowLog.leafCount?`· ${lGrowLog.leafCount} leaves`:''}</div>
      ${lGrowLog.notes?`<div class="card-val dim" style="margin-top:4px">${lGrowLog.notes}</div>`:''}
    </div>`:''}

    ${p._notes.length?`<div class="card"><div class="card-label">Recent notes</div><ul class="log-list">
      ${p._notes.slice(-3).reverse().map(n=>`<li><span class="log-text">${n.text}</span><span class="log-date">${n.date}</span></li>`).join('')}
    </ul></div>`:''}

    <div class="card">
      <div class="card-label">Watering log
        <span class="count">${p._waterLog ? p._waterLog.length : 0}</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <button class="btn btn-green btn-sm" onclick="logWater('${p.id}','watered')">💧 Log watered</button>
        <button class="btn btn-sm" onclick="logWater('${p.id}','dry check')">🔍 Log dry check</button>
        <button class="btn btn-sm" onclick="logWater('${p.id}','skipped')">⏭ Skipped</button>
      </div>
      ${p._waterLog && p._waterLog.length ? `<ul class="log-list">
        ${[...p._waterLog].reverse().slice(0,5).map(w=>`<li>
          <span class="log-text">${w.type==='watered'?'💧':w.type==='dry check'?'🔍':'⏭'} ${w.type}</span>
          <span class="log-date">${w.date}</span>
        </li>`).join('')}
      </ul>` : '<div class="empty-msg">No watering logged yet.</div>'}
    </div>
  `;
}

// ── DWC TAB ───────────────────────────────────────────────────────────
function renderDWC(p,tc) {
  const lph = p._phLog.length ? p._phLog[p._phLog.length-1] : null;
  const lec = p._ecLog.length ? p._ecLog[p._ecLog.length-1] : null;
  const phOk = lph && lph.value>=5.8 && lph.value<=6.2;
  const dwcLogs = state.logs.dwc.filter(l=>l.plantId===p.id);
  const lastDWC = dwcLogs.length ? dwcLogs[dwcLogs.length-1] : null;

  tc.innerHTML = `
    <div class="alert good"><strong>Nutrient program complete ✓</strong> FoxFarm Hydro Trio on hand — Grow Big Hydro (veg, N) + Tiger Bloom (flowering, P/K) + Big Bloom (micros). Follow the FoxFarm feed chart and pH-adjust after mixing.</div>

    <div class="metrics-row">
      <div class="metric"><div class="metric-label">Last pH</div>
        <div class="metric-val ${lph?(phOk?'ok':'bad'):''}">
          ${lph?lph.value.toFixed(1):'—'}</div><div class="metric-hint">Target 5.8–6.2</div></div>
      <div class="metric"><div class="metric-label">Last EC</div>
        <div class="metric-val">${lec?lec.value.toFixed(2):'—'}</div><div class="metric-hint">Seedling 0.8–1.2</div></div>
      <div class="metric"><div class="metric-label">pH logs</div>
        <div class="metric-val">${p._phLog.length}</div></div>
      <div class="metric"><div class="metric-label">Bucket</div>
        <div class="metric-val sm">${p.bucket||'—'}</div></div>
    </div>

    <div class="two-col">
      <div class="card"><div class="card-label">Log pH</div>
        <div class="input-row"><input type="number" id="ph-input" step="0.1" min="4" max="9" placeholder="e.g. 5.9">
        <button class="btn btn-green" onclick="logPH('${p.id}')">Log</button></div>
        <div class="target-note">Target: 5.8–6.2 for peppers</div>
      </div>
      <div class="card"><div class="card-label">Log EC</div>
        <div class="input-row"><input type="number" id="ec-input" step="0.01" min="0" max="6" placeholder="e.g. 1.2">
        <button class="btn btn-green" onclick="logEC('${p.id}')">Log</button></div>
        <div class="target-note">Seedling 0.8–1.2 · Veg 1.2–1.8 · Fruit 2.0–2.5</div>
      </div>
    </div>

    <div class="card">
      <div class="card-label">DWC log form</div>
      <div class="form-grid" id="dwc-form-${p.id}">
        <label>Date<input type="date" id="dwc-date" value="${isoToday()}"></label>
        <label>pH<input type="number" step="0.01" id="dwc-ph" placeholder="5.9"></label>
        <label>EC (mS/cm)<input type="number" step="0.01" id="dwc-ec" placeholder="1.2"></label>
        <label>PPM<input type="number" id="dwc-ppm" placeholder="600"></label>
        <label>Water temp (°F)<input type="number" step="0.1" id="dwc-wtemp" placeholder="68"></label>
        <label>Air temp (°F)<input type="number" step="0.1" id="dwc-atemp" placeholder="75"></label>
        <label>Top off?<select id="dwc-topoff"><option>No</option><option>Yes</option></select></label>
        <label>Water change?<select id="dwc-change"><option>No</option><option>Yes</option></select></label>
        <label class="full">Root notes<textarea id="dwc-roots" rows="2" placeholder="Root color, smell, length..."></textarea></label>
        <label class="full">Plant notes<textarea id="dwc-notes" rows="2" placeholder="Leaf color, growth, any issues..."></textarea></label>
      </div>
      <button class="btn btn-green" style="margin-top:8px" onclick="saveDWCLog('${p.id}')">Save DWC log</button>
    </div>

    ${p._phLog.length?`<div class="two-col">
      <div class="card"><div class="card-label">pH history</div><ul class="log-list">
        ${[...p._phLog].reverse().slice(0,8).map(e=>`<li>
          <span class="log-text ${e.value>=5.8&&e.value<=6.2?'ok':'bad'}">${e.value.toFixed(1)}</span>
          <span class="log-date">${e.date}</span></li>`).join('')}
      </ul></div>
      <div class="card"><div class="card-label">EC history</div><ul class="log-list">
        ${[...p._ecLog].reverse().slice(0,8).map(e=>`<li>
          <span class="log-text">${e.value.toFixed(2)}</span>
          <span class="log-date">${e.date}</span></li>`).join('')}
      </ul></div>
    </div>`:''}

    ${dwcLogs.length?`<div class="card"><div class="card-label">DWC session logs (${dwcLogs.length})</div>
      <ul class="log-list">
        ${[...dwcLogs].reverse().slice(0,6).map(l=>`<li>
          <div class="log-text">
            <strong>${l.date}</strong> · pH ${l.ph||'—'} · EC ${l.ec||'—'} · ${l.waterTemp||'—'}°F water
            ${l.rootNotes?`<div class="log-meta">${l.rootNotes}</div>`:''}
            ${l.plantNotes?`<div class="log-meta">${l.plantNotes}</div>`:''}
          </div>
        </li>`).join('')}
      </ul>
    </div>`:''}
  `;
}

// ── GROW LOG TAB (GPT's best feature, enhanced) ───────────────────────
function renderGrowLog(p,tc) {
  const plantLogs = state.logs.daily.filter(l=>l.plantId===p.id);
  tc.innerHTML = `
    <div class="card">
      <div class="card-label">Add daily log entry</div>
      <div class="form-grid">
        <label>Date<input type="date" id="gl-date" value="${isoToday()}"></label>
        <label>Height (in)<input type="number" step="0.25" id="gl-height" placeholder="3.5"></label>
        <label>Leaf count<input type="number" id="gl-leaves" placeholder="4"></label>
        <label>Watered?<select id="gl-watered"><option value="">—</option><option>Yes</option><option>No</option></select></label>
        <label>Feed used<input type="text" id="gl-feed" placeholder="Big Bloom 5ml/gal"></label>
        <label>Outside min<input type="number" id="gl-outside" placeholder="30"></label>
        <label>Condition<select id="gl-condition">
          <option value="">— select —</option>
          <option>Excellent</option><option>Good</option><option>Fair</option>
          <option>Stressed</option><option>Yellowing</option><option>Wilting</option><option>Poor</option>
        </select></label>
        <label>Zone / location<input type="text" id="gl-zone" placeholder="Top shelf / middle rack"></label>
        <label class="full">Notes<textarea id="gl-notes" rows="3" placeholder="Observations, measurements, changes..."></textarea></label>
        <div class="full" style="margin-top:6px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px">Photo (optional)</div>
          <label class="photo-upload-label">
            U0001f4f7 Choose photo
            <input type="file" accept="image/*" id="gl-photo" capture="environment"
              onchange="document.getElementById('gl-photo-name').textContent=this.files[0]?this.files[0].name:''">
          </label>
          <span id="gl-photo-name" class="photo-name-preview"></span>
        </div>
      </div>
      <button class="btn btn-green" style="margin-top:8px" onclick="saveGrowLog('${p.id}')">Save log entry</button>
    </div>

    <div class="card"><div class="card-label">Log history (${plantLogs.length} entries)</div>
      ${plantLogs.length ?
        `<ul class="log-list">${[...plantLogs].reverse().map(l=>`<li>
          <div class="log-text">
            <strong>${l.date}</strong>${l.condition?' · '+l.condition:''}
            ${l.height?` · ${l.height}" tall`:''}${l.leafCount?` · ${l.leafCount} leaves`:''}
            ${l.outsideMinutes?` · ${l.outsideMinutes} min outside`:''}
            ${l.feed?`<div class="log-meta">Feed: ${l.feed}</div>`:''}
            ${l.notes?`<div class="log-meta">${l.notes}</div>`:''}
          </div>
          <span class="log-date">${l.zone||''}</span>
        </li>`).join('')}</ul>`
        : '<div class="empty-msg">No grow logs yet.</div>'}
    </div>
  `;
}

// ── FEED TAB ──────────────────────────────────────────────────────────
function renderFeed(p,tc) {
  tc.innerHTML = `
    <div class="card"><div class="card-label">Log feeding</div>
      <div class="input-row">
        <input type="text" id="feed-input" placeholder="e.g. 5ml Big Bloom + 5ml Grow Big Hydro per gal, pH 6.0">
        <button class="btn btn-green" onclick="addFeed('${p.id}')">Log</button>
      </div>
    </div>
    ${p.system==='DWC'?`<div class="alert good">
      <strong>FoxFarm Hydro Trio complete ✓</strong><br>
      Wk 1–3: Grow Big Hydro ¼ str · Wk 4–6: + Big Bloom · Wk 7+: Tiger Bloom + Big Bloom<br>
      Always pH-adjust reservoir AFTER mixing nutrients.
    </div>`:''}
    <div class="card"><div class="card-label">Feed history <span class="count">${p._feeds.length}</span></div>
      ${p._feeds.length ?
        `<ul class="log-list">${[...p._feeds].reverse().map(f=>`<li>
          <span class="log-text">${f.text}</span><span class="log-date">${f.date}</span>
        </li>`).join('')}</ul>`
        : '<div class="empty-msg">No feeds logged yet.</div>'}
    </div>
  `;
}

// ── LIGHT TAB ─────────────────────────────────────────────────────────
function renderLight(p,tc) {
  const pct = Math.round(((p._lightHours-12)/8)*100);
  tc.innerHTML = `
    <div class="card"><div class="card-label">Daily light hours</div>
      <div class="light-display">
        <span class="light-val" id="light-val">${p._lightHours}h</span>
        <span class="light-sub">per day</span>
      </div>
      <input type="range" class="light-slider" min="12" max="20" step="1" value="${p._lightHours}"
        oninput="updateLightLive('${p.id}',this.value)" onchange="updateLightSave('${p.id}',this.value)">
      <div class="range-labels"><span>12h</span><span>14h</span><span>16h</span><span>18h</span><span>20h</span></div>
      <div class="light-bar-wrap"><div class="light-bar-fill" id="light-bar" style="width:${pct}%"></div></div>
    </div>
    <div class="card"><div class="card-label">Recommendations by stage</div>
      <table class="rec-table">
        <tr><td>Seedling / germination</td><td class="ok">16–18h</td></tr>
        <tr><td>Vegetative</td><td class="ok">16–18h</td></tr>
        <tr><td>Pepper flowering / fruiting</td><td class="warn">12–14h</td></tr>
        <tr><td>Tomato fruiting</td><td class="warn">14–16h</td></tr>
        <tr><td>Lettuce (prevent bolt)</td><td class="warn">14–16h</td></tr>
        <tr><td>Bonsai</td><td class="info">12–14h</td></tr>
      </table>
    </div>
    <div class="card"><div class="card-label">Your setup</div>
      <ul class="log-list">
        ${(state.config.equipment.lights||[]).map(l=>`<li><span class="log-text">${l}</span></li>`).join('')}
      </ul>
    </div>
  `;
}

// ── HARDEN OFF TAB ────────────────────────────────────────────────────
function renderHarden(p,tc) {
  const frostDate = frostSafeDate();
  const safePlant = safePlantDate();
  const dtf = daysUntil(frostDate);
  const dts = daysUntil(safePlant);
  const hd = p._hardenStart ? (daysSince(p._hardenStart)+1) : 0;
  const idealStart = addDays(safePlant, -10);

  const minNight = p.category==='Lettuce' ? 28 : p.category==='Tomato' ? 50 : 55;
  const coldNote = p.category==='Lettuce'
    ? 'High cold tolerance. Tolerates light frost once hardened. Can begin hardening now.'
    : p.category==='Tomato'
    ? 'Cold-sensitive below 50°F. Begin ~Apr 7–10. Day 1–2 wilting is normal.'
    : 'Cold-sensitive. Do not expose below 55°F. Start after Apr 27.';

  const rows = HARDEN_SCHEDULE.map((s,i) => {
    const d = addDays(TODAY, i);
    const ds = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    let hi='—', lo='—', cls='', frost=false;
    if(weatherData && weatherData.daily.temperature_2m_max[i] !== undefined) {
      hi = Math.round(weatherData.daily.temperature_2m_max[i]);
      lo = Math.round(weatherData.daily.temperature_2m_min[i]);
      frost = lo <= 32;
      cls = lo < minNight ? 'warn' : 'ok';
    }
    const isT = p._hardenStart && hd===s.day;
    const isPast = p._hardenStart && hd > s.day;
    return `<tr class="${isT?'today-row':''} ${isPast?'past-row':''}">
      <td>${p._hardenStart?(isPast?'✓':isT?'▶':s.day):s.day}</td>
      <td>${ds}</td>
      <td>${s.hours}h <span class="${s.shade?'shade-tag':'sun-tag'}">${s.shade?'shade':'sun'}</span></td>
      <td class="notes-col">${s.notes}</td>
      <td class="${frost?'bad':cls}">${hi!=='—'?hi+'°/'+lo+'°':'—'}${frost?' ❄':''}</td>
    </tr>`;
  }).join('');

  tc.innerHTML = `
    ${dtf>0?`<div class="harden-dates-row">
      <div class="hdc frost"><div class="hdc-label">Last frost risk</div><div class="hdc-val">${fmtShortDate(frostDate)}</div><div class="hdc-days">${dtf}d away</div></div>
      <div class="hdc safe"><div class="hdc-label">Safe outdoor planting</div><div class="hdc-val">${fmtShortDate(safePlant)}</div><div class="hdc-days">${dts}d away</div></div>
      <div class="hdc ideal"><div class="hdc-label">Ideal harden start</div><div class="hdc-val">${fmtShortDate(idealStart)}</div><div class="hdc-days">${Math.max(0,dts-10)}d away</div></div>
    </div>`:''}

    <div class="alert info"><strong>${p.variety}:</strong> ${coldNote}</div>

    <div class="card"><div class="card-label">Hardening clock</div>
      ${!p._hardenStart
        ?`<p style="color:var(--text3);margin-bottom:10px">Not started yet.</p>
           <button class="btn btn-green" onclick="startHarden('${p.id}')">Start hardening today</button>`
        :`<div class="harden-progress">
            <div class="hp-track"><div class="hp-fill" style="width:${Math.min(100,(Math.min(hd,10)/10)*100)}%"></div></div>
            <div class="hp-label">Day ${Math.min(hd,10)} of 10${hd>=10?' — protocol complete ✓':''}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="resetHarden('${p.id}')" style="margin-top:6px">Reset clock</button>`}
    </div>

    <div class="card"><div class="card-label">10-day protocol · Bella Vista, AR · full sun · ${weatherData?'live forecast':'loading weather...'}</div>
      <div style="overflow-x:auto">
        <table class="harden-table">
          <thead><tr><th>Day</th><th>Date</th><th>Outside</th><th>Guidance</th><th>Forecast hi/lo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ── ACTIONS ───────────────────────────────────────────────────────────
function setFilter(f)    { currentFilter=f; renderSidebar(); }
function setTab(t)       { currentTab=t; renderDetail(); }
function selectPlant(id) { selectedId=id; currentTab='overview'; renderDetail(); renderSidebar(); }

function updateStage(id,val) {
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._stage = val; saveLogs(); renderSidebar();
}
function updateLightLive(id,val) {
  const el = document.getElementById('light-val');
  const bar = document.getElementById('light-bar');
  if(el) el.textContent = val+'h';
  if(bar) bar.style.width = Math.round(((parseInt(val)-12)/8)*100)+'%';
}
function updateLightSave(id,val) {
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._lightHours = parseInt(val); saveLogs();
}
function addFeed(id) {
  const inp = document.getElementById('feed-input');
  if(!inp||!inp.value.trim()) return;
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._feeds.push({text:inp.value.trim(), date:nowStr()});
  inp.value=''; saveLogs(); renderTab();
}
function logPH(id) {
  const inp = document.getElementById('ph-input');
  if(!inp||!inp.value) return;
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._phLog.push({value:parseFloat(parseFloat(inp.value).toFixed(1)), date:nowStr()});
  inp.value=''; saveLogs(); renderTab();
}
function logEC(id) {
  const inp = document.getElementById('ec-input');
  if(!inp||!inp.value) return;
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._ecLog.push({value:parseFloat(parseFloat(inp.value).toFixed(2)), date:nowStr()});
  inp.value=''; saveLogs(); renderTab();
}
function saveDWCLog(id) {
  const get = sid => { const el = document.getElementById(sid); return el ? el.value : ''; };
  const ph = get('dwc-ph'), ec = get('dwc-ec');
  const entry = {
    plantId: id,
    date:     get('dwc-date'),
    ph:       ph ? parseFloat(ph) : '',
    ec:       ec ? parseFloat(ec) : '',
    ppm:      get('dwc-ppm') ? parseInt(get('dwc-ppm')) : '',
    waterTemp:get('dwc-wtemp') ? parseFloat(get('dwc-wtemp')) : '',
    airTemp:  get('dwc-atemp') ? parseFloat(get('dwc-atemp')) : '',
    topOff:   get('dwc-topoff'),
    change:   get('dwc-change'),
    rootNotes:get('dwc-roots'),
    plantNotes:get('dwc-notes')
  };
  // Also push to per-plant quick logs
  const p = state.plants.find(x=>x.id===id);
  if(p && ph) p._phLog.push({value:parseFloat(parseFloat(ph).toFixed(1)), date:entry.date});
  if(p && ec) p._ecLog.push({value:parseFloat(parseFloat(ec).toFixed(2)), date:entry.date});
  state.logs.dwc.push(entry);
  saveLogs(); renderTab();
}
function saveGrowLog(id) {
  const get = sid => { const el = document.getElementById(sid); return el ? el.value : ''; };
  const entry = {
    plantId:       id,
    date:          get('gl-date'),
    height:        get('gl-height') ? parseFloat(get('gl-height')) : '',
    leafCount:     get('gl-leaves') ? parseInt(get('gl-leaves'))   : '',
    watered:       get('gl-watered'),
    feed:          get('gl-feed'),
    outsideMinutes:get('gl-outside') ? parseInt(get('gl-outside')) : '',
    condition:     get('gl-condition'),
    zone:          get('gl-zone'),
    notes:         get('gl-notes')
  };
  state.logs.daily.push(entry);
  const photoInput = document.getElementById('gl-photo');
  if(photoInput && photoInput.files && photoInput.files[0]) {
    const dateStr = entry.date || isoToday();
    compressPhoto(photoInput.files[0], b64 => {
      addPhotoToPlant(id, b64, dateStr);
      renderDetail();
    });
  }
  saveLogs(); renderTab();
}
function startHarden(id) {
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._hardenStart = isoToday(); saveLogs(); renderDetail(); renderSidebar();
}
function resetHarden(id) {
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  p._hardenStart = null; saveLogs(); renderDetail(); renderSidebar();
}
function logWater(id, type) {
  const p = state.plants.find(x=>x.id===id); if(!p) return;
  if(!p._waterLog) p._waterLog = [];
  p._waterLog.push({ type, date: nowStr() });
  saveLogs(); renderTab();
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────
function exportData() {
  const exportObj = {
    logs: state.logs,
    plantMutables: state.plants.map(p => ({
      id: p.id,
      _notes: p._notes, _feeds: p._feeds, _phLog: p._phLog, _ecLog: p._ecLog,
      _waterLog: p._waterLog, _photos: p._photos, _hardenStart: p._hardenStart,
      _stage: p._stage, _lightHours: p._lightHours
    }))
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `garden-blended-backup-${isoToday()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function importData(e) {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if(d.logs) { state.logs = d.logs; }
      else if(Array.isArray(d)) { state.logs.daily = d; }
      if(d.plantMutables) {
        d.plantMutables.forEach(m => {
          const p = state.plants.find(x=>x.id===m.id);
          if(p) { Object.assign(p, {_notes:m._notes||[], _feeds:m._feeds||[], _phLog:m._phLog||[], _ecLog:m._ecLog||[], _hardenStart:m._hardenStart||null, _stage:m._stage||p.status, _lightHours:m._lightHours||defaultLight(p)}); }
        });
      }
      saveLogs(); renderSidebar(); renderDetail();
      alert('Data imported successfully.');
    } catch(err) { alert('Import failed — invalid JSON file.'); }
  };
  r.readAsText(f);
}

// ── BOOT ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
