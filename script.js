/* =====================================================================
   Summit Weather – script.js
   Data: Open-Meteo (free, no API key). Map: Leaflet + OpenStreetMap.
   ===================================================================== */

/* ===== Helpers ===== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "--" : Number(n).toFixed(d));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toArr = (d) => (Array.isArray(d) ? d : [d]);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 429 ? "Too many requests, try again in a minute" : "Request failed (" + res.status + ")");
  return res.json();
}

function setMsg(el, text, isError = false) {
  el.textContent = text || "";
  el.className = "msg" + (text ? (isError ? " error" : " ok") : "");
}

// Same calendar day, n years ago (Feb 29 becomes Feb 28)
function yearsAgo(n) {
  const now = new Date();
  const m = now.getMonth();
  const t = new Date(now.getFullYear() - n, m, now.getDate());
  if (t.getMonth() !== m) t.setDate(0);
  return t;
}

const store = {
  get users() { try { return JSON.parse(localStorage.getItem("users")) || {}; } catch { return {}; } },
  set users(v) { localStorage.setItem("users", JSON.stringify(v)); },
  get session() { return localStorage.getItem("session"); },
  set session(v) { v ? localStorage.setItem("session", v) : localStorage.removeItem("session"); },
};

/* =====================================================================
   BACKGROUND: mountain video, with an animated mountain scene fallback
   ===================================================================== */
(function background() {
  const box = $("videoBg");
  const canvas = $("sceneCanvas");
  const ctx = canvas.getContext("2d");
  const video = $("bgVideo");
  const source = video.querySelector("source");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0, h = 0, last = 0, t = 0, raf = null, stopped = false;

  const layers = [
    { color: "#5c7fa3", amp: 70, base: 0.62, speed: 4, f: 0.0035, seed: 1 },
    { color: "#41607f", amp: 90, base: 0.7, speed: 7, f: 0.0045, seed: 2 },
    { color: "#2c4a5e", amp: 110, base: 0.8, speed: 11, f: 0.0055, seed: 3 },
    { color: "#16303a", amp: 120, base: 0.92, speed: 16, f: 0.0065, seed: 4 },
  ];
  const clouds = Array.from({ length: 7 }, (_, i) => ({
    x: Math.random() * 1600, y: 40 + Math.random() * 220, s: 0.7 + Math.random() * 1.2, v: 6 + Math.random() * 10 + i,
  }));

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    draw();
  }

  function ridge(layer, x) {
    const o = x + t * layer.speed * 6;
    return (
      h * layer.base -
      (Math.sin(o * layer.f + layer.seed) * layer.amp +
        Math.sin(o * layer.f * 2.3 + layer.seed * 2) * layer.amp * 0.5 +
        Math.sin(o * layer.f * 5.1) * layer.amp * 0.18) * 0.6
    );
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0e2a47");
    sky.addColorStop(0.5, "#4a7090");
    sky.addColorStop(1, "#f3b98a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.72, h * 0.5, 0, w * 0.72, h * 0.5, h * 0.4);
    sun.addColorStop(0, "rgba(255,236,190,0.95)");
    sun.addColorStop(0.15, "rgba(255,210,150,0.55)");
    sun.addColorStop(1, "rgba(255,200,140,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.16)";
    clouds.forEach((c) => {
      const x = ((c.x + t * c.v) % (w + 400)) - 200;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + i * 38 * c.s, c.y + (i % 2) * 8, 60 * c.s, 20 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    layers.forEach((layer) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, ridge(layer, x));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    });
  }

  function loop(now) {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000 || 0, 0.1);
    last = now;
    t += dt;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function stopScene() { stopped = true; if (raf) cancelAnimationFrame(raf); }

  window.addEventListener("resize", resize);
  resize();
  if (!reduced) raf = requestAnimationFrame(loop);

  // If the video plays, show it and stop the canvas to save battery
  video.addEventListener("playing", () => { box.classList.add("has-video"); stopScene(); });
  // If the file is missing, keep the animated scene
  if (source) source.addEventListener("error", () => box.classList.remove("has-video"));
  video.play().catch(() => {});
})();

/* =====================================================================
   ROUTING (hash based)
   ===================================================================== */
const pages = ["home", "about", "map", "login", "profile"];

function showPage() {
  let id = location.hash.replace("#", "") || "home";
  if (!pages.includes(id)) id = "home";

  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === id));
  document.querySelectorAll("[data-link]").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + id && a.id !== "loginLink")
  );

  $("navLinks").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (id === "map") initMap();
  if (id === "profile") renderProfile();
}
window.addEventListener("hashchange", showPage);
$("menuToggle").addEventListener("click", () => $("navLinks").classList.toggle("open"));

/* =====================================================================
   WEATHER HELPERS
   ===================================================================== */
const WMO = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫"], 48: ["Rime fog", "🌫"],
  51: ["Light drizzle", "🌦"], 53: ["Drizzle", "🌦"], 55: ["Heavy drizzle", "🌧"],
  56: ["Freezing drizzle", "🌧"], 57: ["Freezing drizzle", "🌧"],
  61: ["Light rain", "🌧"], 63: ["Rain", "🌧"], 65: ["Heavy rain", "🌧"],
  66: ["Freezing rain", "🌧"], 67: ["Freezing rain", "🌧"],
  71: ["Light snow", "🌨"], 73: ["Snow", "🌨"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨"],
  80: ["Rain showers", "🌦"], 81: ["Rain showers", "🌧"], 82: ["Violent showers", "⛈"],
  85: ["Snow showers", "🌨"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈"], 96: ["Thunderstorm with hail", "⛈"], 99: ["Thunderstorm with hail", "⛈"],
};
const wmo = (code) => WMO[code] || ["Unknown", "🌡"];

function aqiInfo(v) {
  if (v == null || isNaN(v)) return { cat: "No data", color: "#888" };
  if (v <= 50) return { cat: "Good", color: "#3ecf6e" };
  if (v <= 100) return { cat: "Moderate", color: "#f2d43d" };
  if (v <= 150) return { cat: "Unhealthy for sensitive groups", color: "#f39c3d" };
  if (v <= 200) return { cat: "Unhealthy", color: "#e5484d" };
  if (v <= 300) return { cat: "Very unhealthy", color: "#a35cc9" };
  return { cat: "Hazardous", color: "#8b1e3f" };
}

// -30°C (blue) ... 45°C (red)
function tempColor(t) {
  const c = Math.max(-30, Math.min(45, t));
  return `hsl(${240 - ((c + 30) / 75) * 240}, 85%, 50%)`;
}

async function geocode(q) {
  const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
  const r = d.results && d.results[0];
  if (!r) throw new Error("Place not found. Try another name.");
  return { name: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude };
}

async function loadPoint(lat, lon) {
  const wUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5&timezone=auto`;
  const [w, a] = await Promise.all([getJSON(wUrl), getJSON(aUrl).catch(() => null)]);
  return { w, a };
}

/* =====================================================================
   HOME: current weather + AQI
   ===================================================================== */
function renderWeather(place, { w, a }) {
  const c = w.current;
  const [desc, icon] = wmo(c.weather_code);

  $("wxPlace").textContent = place;
  $("wxTime").textContent = "Local time: " + c.time.replace("T", " ");
  $("wxIcon").textContent = icon;
  $("wxTemp").textContent = fmt(c.temperature_2m, 1);
  $("wxDesc").textContent = desc;
  $("wxFeels").textContent = fmt(c.apparent_temperature, 1) + "°C";
  $("wxHum").textContent = fmt(c.relative_humidity_2m) + "%";
  $("wxWind").textContent = fmt(c.wind_speed_10m) + " km/h";
  $("wxRain").textContent = fmt(c.precipitation, 1) + " mm";

  const aq = a && a.current ? a.current : {};
  const info = aqiInfo(aq.us_aqi);
  $("aqiValue").textContent = aq.us_aqi == null ? "--" : Math.round(aq.us_aqi);
  $("aqiValue").style.color = info.color;
  $("aqiCat").textContent = info.cat;
  $("aqiBox").style.borderColor = info.color;
  $("aqiPm").textContent = `PM2.5 ${fmt(aq.pm2_5, 1)} · PM10 ${fmt(aq.pm10, 1)} µg/m³`;

  $("forecast").innerHTML = w.daily.time
    .map((d, i) => {
      const day = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
      const [fd, fi] = wmo(w.daily.weather_code[i]);
      return `<div class="fday" title="${esc(fd)}"><div class="d">${esc(day)}</div><div class="i">${fi}</div>` +
        `<div class="t">${fmt(w.daily.temperature_2m_max[i])}° <small>${fmt(w.daily.temperature_2m_min[i])}°</small></div></div>`;
    })
    .join("");
}

async function showPlace(p) {
  renderWeather(p.name, await loadPoint(p.lat, p.lon));
}

async function searchAndShow(q) {
  setMsg($("searchMsg"), "Searching…");
  try {
    await showPlace(await geocode(q));
    setMsg($("searchMsg"), "");
  } catch (err) {
    setMsg($("searchMsg"), err.message, true);
  }
}

function getMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation is not supported by your browser."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => reject(new Error("Could not get your location. Please allow location access."))
    );
  });
}

$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("searchInput").value.trim();
  if (q) searchAndShow(q);
});

$("homeLocate").addEventListener("click", async () => {
  setMsg($("searchMsg"), "Finding your location…");
  try {
    const { latitude, longitude } = await getMyLocation();
    await showPlace({ name: `Your location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`, lat: latitude, lon: longitude });
    setMsg($("searchMsg"), "");
  } catch (err) {
    setMsg($("searchMsg"), err.message, true);
  }
});

function loadHomeDefault() {
  const email = store.session;
  const user = email && store.users[email];
  searchAndShow((user && user.homeCity) || "London");
}

/* =====================================================================
   WORLD MAP + TIME MACHINE
   ===================================================================== */
// [name, latitude, longitude] — add or remove cities here
const CITIES = [
  ["New York", 40.71, -74.01], ["Los Angeles", 34.05, -118.24], ["Mexico City", 19.43, -99.13], ["Toronto", 43.65, -79.38],
  ["São Paulo", -23.55, -46.63], ["Buenos Aires", -34.6, -58.38], ["Bogotá", 4.71, -74.07], ["London", 51.51, -0.13],
  ["Paris", 48.86, 2.35], ["Berlin", 52.52, 13.4], ["Madrid", 40.42, -3.7], ["Moscow", 55.76, 37.62],
  ["Istanbul", 41.01, 28.98], ["Cairo", 30.04, 31.24], ["Lagos", 6.52, 3.38], ["Nairobi", -1.29, 36.82],
  ["Johannesburg", -26.2, 28.05], ["Dubai", 25.2, 55.27], ["Delhi", 28.61, 77.21], ["Mumbai", 19.08, 72.88],
  ["Kathmandu", 27.72, 85.32], ["Dhaka", 23.81, 90.41], ["Bangkok", 13.76, 100.5], ["Singapore", 1.35, 103.82],
  ["Beijing", 39.9, 116.41], ["Tokyo", 35.68, 139.69], ["Seoul", 37.57, 126.98], ["Sydney", -33.87, 151.21],
  ["Auckland", -36.85, 174.76], ["Anchorage", 61.22, -149.9], ["Reykjavik", 64.15, -21.94], ["Honolulu", 21.31, -157.86],
];
const LATS = CITIES.map((c) => c[1]).join(",");
const LONS = CITIES.map((c) => c[2]).join(",");

let map = null, cityLayer = null, pointMarker = null;
let layerMode = "temp", yearsBack = 0, reqId = 0, chartId = 0, playing = false;
const tempCache = new Map();
let aqiCache = null;

function initMap() {
  if (map) { setTimeout(() => map.invalidateSize(), 100); return; }
  if (typeof L === "undefined") { $("mapBox").textContent = "Map library failed to load. Check your internet connection."; return; }

  map = L.map("mapBox", { worldCopyJump: true, minZoom: 2 }).setView([20, 10], 2);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  cityLayer = L.layerGroup().addTo(map);

  map.on("click", (e) => {
    const ll = e.latlng.wrap();
    selectPoint(ll.lat, ll.lng, `${ll.lat.toFixed(2)}, ${ll.lng.toFixed(2)}`);
  });

  updateLegend();
  updateTimeLabel();
  refreshLayer();
}

async function fetchTemps(n) {
  if (tempCache.has(n)) return tempCache.get(n);
  let values;
  if (n === 0) {
    const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${LATS}&longitude=${LONS}&current=temperature_2m`);
    values = toArr(d).map((x) => x.current.temperature_2m);
  } else {
    const day = ymd(yearsAgo(n));
    const d = await getJSON(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${LATS}&longitude=${LONS}&start_date=${day}&end_date=${day}&daily=temperature_2m_mean`
    );
    values = toArr(d).map((x) => x.daily.temperature_2m_mean[0]);
  }
  tempCache.set(n, values);
  return values;
}

async function fetchAqi() {
  if (aqiCache && Date.now() - aqiCache.time < 10 * 60 * 1000) return aqiCache.values;
  const d = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LATS}&longitude=${LONS}&current=us_aqi`);
  const values = toArr(d).map((x) => (x.current ? x.current.us_aqi : null));
  aqiCache = { time: Date.now(), values };
  return values;
}

function drawMarkers(values, mode) {
  cityLayer.clearLayers();
  CITIES.forEach((c, i) => {
    const v = values[i];
    if (v == null || isNaN(v)) return;
    const color = mode === "aqi" ? aqiInfo(v).color : tempColor(v);
    const label = mode === "aqi" ? Math.round(v) : Math.round(v) + "°";
    const icon = L.divIcon({
      className: "",
      html: `<div class="mk" style="background:${color}">${label}</div>`,
      iconSize: [44, 26],
      iconAnchor: [22, 13],
    });
    const m = L.marker([c[1], c[2]], { icon }).addTo(cityLayer);
    m.bindTooltip(c[0]);
    m.on("click", () => selectPoint(c[1], c[2], c[0]));
  });
}

async function refreshLayer() {
  if (!map) return;
  const my = ++reqId;
  setMsg($("mapMsg"), "Loading data…");
  try {
    const values = layerMode === "aqi" ? await fetchAqi() : await fetchTemps(yearsBack);
    if (my !== reqId) return;
    drawMarkers(values, layerMode);
    setMsg($("mapMsg"), "");
  } catch (err) {
    if (my === reqId) setMsg($("mapMsg"), "Could not load data: " + err.message, true);
  }
}

function updateLegend() {
  if (layerMode === "aqi") {
    const items = [["Good", "#3ecf6e"], ["Moderate", "#f2d43d"], ["Sensitive", "#f39c3d"], ["Unhealthy", "#e5484d"], ["Very unhealthy", "#a35cc9"], ["Hazardous", "#8b1e3f"]];
    $("legend").innerHTML = items.map(([n, c]) => `<span class="chip"><i style="background:${c}"></i>${n}</span>`).join("");
  } else {
    $("legend").innerHTML = `<span>-30°C</span><span class="bar"></span><span>45°C</span>`;
  }
}

function updateTimeLabel() {
  if (yearsBack === 0) { $("timeLabel").textContent = "Today (live reading)"; return; }
  const d = yearsAgo(yearsBack).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  $("timeLabel").textContent = `${d} · ${yearsBack} year${yearsBack > 1 ? "s" : ""} ago`;
}

$("yearSlider").addEventListener("input", (e) => { yearsBack = +e.target.value; updateTimeLabel(); });
$("yearSlider").addEventListener("change", () => refreshLayer());

document.querySelectorAll('input[name="layer"]').forEach((r) =>
  r.addEventListener("change", (e) => {
    layerMode = e.target.value;
    const aqi = layerMode === "aqi";
    if (aqi) {
      playing = false;
      yearsBack = 0;
      $("yearSlider").value = 0;
      updateTimeLabel();
    }
    $("yearSlider").disabled = aqi;
    $("playBtn").disabled = aqi;
    $("timeBox").classList.toggle("disabled", aqi);
    $("playBtn").textContent = "▶ Play";
    updateLegend();
    refreshLayer();
  })
);

$("playBtn").addEventListener("click", async () => {
  if (playing) { playing = false; return; }
  playing = true;
  $("playBtn").textContent = "⏸ Pause";
  if (yearsBack >= 20) yearsBack = 0;
  while (playing && yearsBack < 20) {
    yearsBack++;
    $("yearSlider").value = yearsBack;
    updateTimeLabel();
    await refreshLayer();
    await sleep(1500);
  }
  playing = false;
  $("playBtn").textContent = "▶ Play";
});

/* ----- Click a city or any point: popup + 20-year chart ----- */
async function selectPoint(lat, lon, name) {
  if (pointMarker) map.removeLayer(pointMarker);
  pointMarker = L.circleMarker([lat, lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#4fd1a5", fillOpacity: 1 }).addTo(map);
  pointMarker.bindPopup("Loading…").openPopup();

  try {
    const { w, a } = await loadPoint(lat, lon);
    const c = w.current;
    const [desc, icon] = wmo(c.weather_code);
    const aq = a && a.current ? a.current.us_aqi : null;
    pointMarker.setPopupContent(
      `<b>${esc(name)}</b><br>${icon} ${esc(desc)}<br>🌡 ${fmt(c.temperature_2m, 1)}°C · 💧 ${fmt(c.relative_humidity_2m)}%<br>` +
        `💨 ${fmt(c.wind_speed_10m)} km/h<br>😷 AQI ${aq == null ? "--" : Math.round(aq)} (${esc(aqiInfo(aq).cat)})`
    );
  } catch (err) {
    pointMarker.setPopupContent("Could not load weather for this spot.");
  }
  drawHistory(lat, lon, name);
}

async function drawHistory(lat, lon, name) {
  const my = ++chartId;
  const dayText = yearsAgo(1).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  $("chartBox").hidden = false;
  $("chartTitle").textContent = `Average temperature on ${dayText}, last 20 years · ${name}`;
  $("chartNote").textContent = "Loading history…";
  const cv = $("histChart");
  cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);

  try {
    const start = ymd(yearsAgo(20)), end = ymd(yearsAgo(1));
    const d = await getJSON(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean`
    );
    if (my !== chartId) return;
    const md = end.slice(5);
    const pts = [];
    d.daily.time.forEach((t, i) => {
      const v = d.daily.temperature_2m_mean[i];
      if (t.slice(5) === md && v != null) pts.push([+t.slice(0, 4), v]);
    });
    drawChart(pts);
  } catch (err) {
    if (my === chartId) $("chartNote").textContent = "Could not load history: " + err.message;
  }
}

function drawChart(pts) {
  const cv = $("histChart"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (pts.length < 2) { $("chartNote").textContent = "Not enough historical data for this spot."; return; }

  const padL = 55, padR = 20, padT = 20, padB = 40;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const extra = (y1 - y0) * 0.2 || 1;
  y0 -= extra; y1 += extra;
  const X = (x) => padL + ((x - x0) / (x1 - x0 || 1)) * (W - padL - padR);
  const Y = (y) => padT + (1 - (y - y0) / (y1 - y0)) * (H - padT - padB);

  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = y0 + ((y1 - y0) * i) / 4;
    ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(v.toFixed(1) + "°", padL - 8, Y(v) + 4);
  }
  ctx.textAlign = "center";
  pts.forEach((p, i) => { if (i % 3 === 0 || i === pts.length - 1) ctx.fillText(p[0], X(p[0]), H - 14); });

  ctx.strokeStyle = "#4fd1a5"; ctx.lineWidth = 2.5; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
  ctx.stroke();
  pts.forEach((p) => {
    ctx.fillStyle = tempColor(p[1]);
    ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
  });

  // Linear trend line
  const n = pts.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0), sxx = xs.reduce((a, b) => a + b * b, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const icpt = (sy - slope * sx) / n;
  ctx.setLineDash([8, 6]); ctx.strokeStyle = "#ffd36e"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(x0), Y(slope * x0 + icpt)); ctx.lineTo(X(x1), Y(slope * x1 + icpt)); ctx.stroke();
  ctx.setLineDash([]);

  const dec = slope * 10;
  $("chartNote").textContent =
    `Dashed line = trend (${dec >= 0 ? "+" : ""}${dec.toFixed(2)} °C per decade). A single day is noisy, so treat this as a rough guide.`;
}

/* ----- Map search + location ----- */
$("mapSearchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("mapSearchInput").value.trim();
  if (!q) return;
  initMap();
  setMsg($("mapMsg"), "Searching…");
  try {
    const p = await geocode(q);
    map.flyTo([p.lat, p.lon], 8);
    setMsg($("mapMsg"), "");
    selectPoint(p.lat, p.lon, p.name);
  } catch (err) {
    setMsg($("mapMsg"), err.message, true);
  }
});

$("locateBtn").addEventListener("click", async () => {
  initMap();
  try {
    const { latitude, longitude } = await getMyLocation();
    map.flyTo([latitude, longitude], 9);
    selectPoint(latitude, longitude, "Your location");
  } catch (err) {
    setMsg($("mapMsg"), err.message, true);
  }
});

/* =====================================================================
   LOGIN / SIGN UP (demo using localStorage)
   ===================================================================== */
let signupMode = false;

function setAuthMode(signup) {
  signupMode = signup;
  $("authTitle").textContent = signup ? "Sign up" : "Login";
  $("authSubmit").textContent = signup ? "Create account" : "Login";
  $("nameRow").hidden = !signup;
  $("switchText").textContent = signup ? "Already have an account?" : "No account?";
  $("switchLink").textContent = signup ? "Login" : "Sign up";
  $("authMsg").textContent = "";
}
$("switchLink").addEventListener("click", (e) => { e.preventDefault(); setAuthMode(!signupMode); });

// Demo hash only. NOT secure. Use a real backend for production.
async function hash(text) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381;
  for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return "x" + h;
}

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("emailInput").value.trim().toLowerCase();
  const pass = await hash($("passInput").value);
  const users = store.users;

  if (signupMode) {
    if (users[email]) return setMsg($("authMsg"), "An account with this email already exists.", true);
    users[email] = { name: $("nameInput").value.trim() || email.split("@")[0], pass, bio: "", homeCity: "" };
    store.users = users;
    store.session = email;
    setMsg($("authMsg"), "Account created!");
  } else {
    if (!users[email] || users[email].pass !== pass) return setMsg($("authMsg"), "Invalid email or password.", true);
    store.session = email;
    setMsg($("authMsg"), "Welcome back!");
  }

  $("authForm").reset();
  updateNav();
  loadHomeDefault();
  setTimeout(() => (location.hash = "#profile"), 500);
});

function updateNav() {
  const link = $("loginLink");
  if (store.session) { link.textContent = "Logout"; link.setAttribute("href", "#home"); }
  else { link.textContent = "Login"; link.setAttribute("href", "#login"); }
}

$("loginLink").addEventListener("click", () => {
  if (store.session) { store.session = null; updateNav(); renderProfile(); loadHomeDefault(); }
});

/* =====================================================================
   PROFILE
   ===================================================================== */
function renderProfile() {
  const email = store.session;
  const user = email && store.users[email];
  $("profileLoggedOut").hidden = !!user;
  $("profileLoggedIn").hidden = !user;
  if (!user) return;

  $("avatar").textContent = user.name.charAt(0).toUpperCase();
  $("pName").value = user.name;
  $("pEmail").value = email;
  $("pCity").value = user.homeCity || "";
  $("pBio").value = user.bio || "";
}

$("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const users = store.users;
  const email = store.session;
  users[email].name = $("pName").value.trim();
  users[email].homeCity = $("pCity").value.trim();
  users[email].bio = $("pBio").value.trim();
  store.users = users;
  $("avatar").textContent = users[email].name.charAt(0).toUpperCase();
  setMsg($("profileMsg"), "Profile saved!");
  loadHomeDefault();
});

$("logoutBtn").addEventListener("click", () => {
  store.session = null;
  updateNav();
  loadHomeDefault();
  location.hash = "#home";
});

/* =====================================================================
   INIT
   ===================================================================== */
$("year").textContent = new Date().getFullYear();
updateNav();
showPage();
loadHomeDefault();
