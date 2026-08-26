// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: terminal;
/*
 * GeekBoard — dense large widget for Scriptable
 * 日历/日程/提醒/农历/节气/天气/AQI/定位/海拔/行情/加密货币/电池/VPN/IP/WiFi/SIM/三圆环/步数/闹钟
 * 无外部依赖。数据抓取全部带 TTL 缓存以省电。
 * 配置只改下面 CONFIG 一处。
 */

// =====================================================================
// CONFIG
// =====================================================================
const CONFIG = {
  // ---- 行情（3~5 个即可，超出会被截断到 QUOTE_ROWS）----
  STOCKS: ["AAPL", "NVDA", "TSLA"],          // Yahoo Finance 代码。港股 0700.HK，A股 600519.SS / 000001.SZ，日股 7203.T，指数 ^GSPC
  CRYPTO: ["BTC", "ETH"],                    // Binance 现货，自动拼 USDT；备用 CoinGecko
  CRYPTO_GECKO_IDS: { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", DOGE: "dogecoin", XRP: "ripple" },
  QUOTE_ROWS: 5,
  CN_COLOR_CONVENTION: true,                 // true = 红涨绿跌；false = 绿涨红跌

  // ---- 日历 / 提醒 ----
  CALENDARS: [],                             // 只看这些日历（名称），空 = 全部
  CALENDARS_EXCLUDE: ["Birthdays", "Siri Suggestions", "生日", "Siri 建议"],
  REMINDER_LISTS: [],                        // 指定提醒事项列表（名称），空 = 全部列表
  REMINDER_DAYS_AHEAD: 7,                    // 显示未来 N 天内到期 + 逾期 + 无日期的（无日期仅在指定了列表时显示）
  LEFT_LINES: 16,                            // 左栏总行数预算（日程 + 提醒）
  MIN_REMINDER_LINES: 3,

  // ---- 定位 / 天气 ----
  USE_GPS: true,                             // false 则用 FALLBACK_COORDS
  FALLBACK_COORDS: { lat: 35.6812, lon: 139.7671 },
  REVERSE_GEOCODE: true,                     // 显示所在区名（Apple 本地服务，缓存 30 分钟）
  UNITS_METRIC: true,
  SHOW_PRESSURE: false,                      // 第三行加气压 hPa（会挤，短地名时可开）

  // ---- 网络 / VPN ----
  // VPN 判定：出口 IP 是机房/代理(ip-api hosting/proxy) 或 ISP 不在信任列表 → VPN ON。
  // 把你家宽带和手机运营商的名字片段填进来（不区分大小写）。留空则只用 hosting/proxy 判定。
  TRUSTED_ISP: [],                           // 例如 ["KDDI", "SoftBank", "NTT", "Rakuten"]

  // ---- Gmail 未读数（可选）：Google 账号 → 安全性 → 两步验证 → 应用专用密码，生成后填入 ----
  GMAIL: { user: "", appPassword: "" },      // 两个都留空 = 不启用

  // ---- 快捷指令桥接（见 README）----
  BRIDGE_FILE: "geekboard-bridge.json",      // 位于 iCloud Drive/Scriptable/ 目录下，由快捷指令写入
  BRIDGE_STALE_HOURS: 4,                     // 超过则视为过期，灰显并加 ?
  MOVE_GOAL: 500, EXERCISE_GOAL: 30, STAND_GOAL: 12,   // 圆环目标，桥接文件里给了则覆盖

  // ---- 刷新 / 缓存（分钟）----
  REFRESH_MIN: 15,                           // 建议 iOS 的下次刷新间隔（iOS 只当作提示）
  TTL: { weather: 20, aqi: 60, quotes: 5, crypto: 5, ip: 30, location: 30, geocode: 30, gmail: 10 },
  NET_TIMEOUT_S: 8,

  // ---- 布局（iPhone 15/16 Pro 大号 Widget 338×354；Plus/Pro Max 用 364×382 时把 WIDTH 改成 340）----
  WIDTH: 314,                                // 可用宽度 = Widget 宽 - 左右 padding 24
  FONT: 12,                                  // 主字号
  LEFT_W: 176,
  RIGHT_W: 130,
  WEEK_STARTS_MONDAY: true,
};

// =====================================================================
// THEME
// =====================================================================
const C = {
  bg: new Color("#0b0f14"), fg: new Color("#e6edf3"), dim: new Color("#7d8590"), faint: new Color("#3d444d"),
  blue: new Color("#58a6ff"), green: new Color("#3fb950"), red: new Color("#f85149"), amber: new Color("#d29922"),
  purple: new Color("#bc8cff"), cyan: new Color("#39d2c0"), line: new Color("#21262d"),
  ringMove: new Color("#fa114f"), ringEx: new Color("#92e82a"), ringStand: new Color("#00d8ff"),
};
const UP = CONFIG.CN_COLOR_CONVENTION ? C.red : C.green;
const DOWN = CONFIG.CN_COLOR_CONVENTION ? C.green : C.red;
const F = {
  body: Font.regularMonospacedSystemFont(CONFIG.FONT),
  bold: Font.boldMonospacedSystemFont(CONFIG.FONT),
  small: Font.regularMonospacedSystemFont(CONFIG.FONT - 1.5),
  smallBold: Font.boldMonospacedSystemFont(CONFIG.FONT - 1.5),
  foot: Font.regularMonospacedSystemFont(CONFIG.FONT - 1),
  footBold: Font.boldMonospacedSystemFont(CONFIG.FONT - 1),
  grid: Font.regularMonospacedSystemFont(CONFIG.FONT - 2.5),
  gridBold: Font.boldMonospacedSystemFont(CONFIG.FONT - 2.5),
};

// =====================================================================
// UTILS
// =====================================================================
const pad2 = n => (n < 10 ? "0" : "") + n;
const hm = d => pad2(d.getHours()) + ":" + pad2(d.getMinutes());
const md = d => (d.getMonth() + 1) + "/" + d.getDate();
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 86400000;
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / DAY + 1) / 7);
}
const dayOfYear = d => Math.round((dayStart(d) - new Date(d.getFullYear(), 0, 1)) / DAY) + 1;
function fmtPrice(p) {
  if (p == null || isNaN(p)) return "--";
  if (p >= 10000) return Math.round(p).toLocaleString("en-US");
  if (p >= 1000) return p.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}
const fmtPct = x => (x == null || isNaN(x)) ? "--" : (x >= 0 ? "+" : "") + x.toFixed(2);
function durStr(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + "h" + pad2(r) : h + "h";
}
const num = v => { if (v == null) return null; if (typeof v === "number") return v; const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
function ispShort(s) {
  s = String(s || "").replace(/\b(corporation|corp\.?|company|co\.,?|inc\.?|ltd\.?|limited|llc|k\.k\.|kabushiki kaisha|communications?|telecom(munications?)?|group|holdings?)\b/gi, "").replace(/[,.]+/g, " ").replace(/\s+/g, " ").trim();
  if (s.length <= 12) return s;
  const cut = s.slice(0, 13), i = cut.lastIndexOf(" ");
  return (i > 3 ? cut.slice(0, i) : s.slice(0, 12)).trim();
}
const compass = deg => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16];
function withTimeout(promise, ms) {
  if (typeof Timer === "undefined") return promise;
  return Promise.race([promise, new Promise((_, rej) => Timer.schedule(ms, false, () => rej(new Error("timeout"))))]);
}

// ---- cache (local, per key, with TTL) ----
const fm = FileManager.local();
const CACHE_DIR = fm.joinPath(fm.documentsDirectory(), "geekboard-cache");
if (!fm.fileExists(CACHE_DIR)) fm.createDirectory(CACHE_DIR, true);
function cacheRead(key) {
  const p = fm.joinPath(CACHE_DIR, key + ".json");
  if (!fm.fileExists(p)) return null;
  try { return JSON.parse(fm.readString(p)); } catch (e) { return null; }
}
function cacheWrite(key, v) {
  fm.writeString(fm.joinPath(CACHE_DIR, key + ".json"), JSON.stringify({ t: Date.now(), v }));
}
// fresh cache → return; else fetch; fetch fails → stale cache (marked)
async function cached(key, ttlMin, fetcher) {
  const c = cacheRead(key);
  if (c && Date.now() - c.t < ttlMin * 60000) return { v: c.v, t: c.t, stale: false };
  try {
    const v = await withTimeout(fetcher(), CONFIG.NET_TIMEOUT_S * 1000 + 500);
    if (v != null) { cacheWrite(key, v); return { v, t: Date.now(), stale: false }; }
  } catch (e) { console.warn(key + ": " + e); }
  return c ? { v: c.v, t: c.t, stale: true } : { v: null, t: 0, stale: true };
}
async function getJSON(url, headers) {
  const r = new Request(url);
  r.timeoutInterval = CONFIG.NET_TIMEOUT_S;
  r.headers = Object.assign({ "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1" }, headers || {});
  return await r.loadJSON();
}

// =====================================================================
// LUNAR / 节气  (2000–2100 精确表，来源：天文算法 sxtwl；表外回落 Meeus 近似)
// =====================================================================
const LUNAR_BASE = 2000;
const LUNAR_TABLE = [4589203,3052843,5506347,4065883,2774362,5113194,3734357,6294436,4852553,3324563,5769877,4326701,2919085,5245621,4011434,6424018,4984229,3595594,6032714,4590741,3183918,5506390,4065973,2774450,5244626,3722917,6162213,4720203,3320983,5639339,4326746,2910934,5376873,4028242,6425426,4983589,3594827,5900875,4457643,3056987,5506477,4066154,2775890,5246354,3865893,6163749,4721237,3323053,5768374,4195765,2911658,5377737,4136594,6426258,4984102,3590742,5900887,4457814,3049173,5506901,4196169,2649747,5113491,3732779,6161707,4590171,3323226,5768554,4328293,2922314,5376842,4004501,6425237,4850989,3459757,5900981,4588970,3050405,5508517,4197706,2784405,5115030,3733838,6161750,4721333,3323314,5768914,4329125,3051082,5244555,3869847,6292651,4851035,3459798,5901162,4589394,3184421,5507909,4065931,2643099,5113003];
const JIEQI_TABLE = ["GVETFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETGVFUGVGVHXIXIXIXHWHW","GUETGVFUGVGWHXIXIXJYIXHW","GVETFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETGVFUGVGWHXIXIXJYIXHW","GVETFUEUFVFVHWHXHWIXHWHV","FUESFUEUFVFVHXHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETGVFUGVGWHXIXIXIYIXHW","GVETFUEUFUFVHWHXHWIXHWHV","FUESFUEUFVFVHWHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETGVFUGVGWHXIXIXIYIWHW","GUETFUETFUFVHWHXHWIXHWHV","FUDSFUEUFVFVHWHXHXIXHWHW","FUETFVFUFVGVHXHXIXIXHWHW","FUETGVFUGVGVHXIXIXIYIWHW","GUETFUETFUFVGWHWHWIXHWHV","FUDSFUEUFVFVHWHXHXIXHWHV","FUETFUFUFVGVHXHXHXIXHWHW","FUETGVFUGVGVHXIXIXIYIWHW","GUETFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETGVFUGVGVHXIXIXIXHWHW","GUETFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETGVFUGVGVHXIXIXIXHWHW","GUETFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETFUETFUFVGWHWHWIXHWGV","FUDSFUEUFUFVHWHXHWIXHWHV","FUESFUEUFVFVHXHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETFUETFUFVGWHWHWHXHWGV","FUDSFUETFUFVHWHXHWIXHWHV","FUESFUEUFVFVHWHXHXIXHWHW","FUETGVFUFVGVHXHXIXIXHWHW","GUETFUETFUFUGWHWHWHXHVGV","FTDSFUETFUFVGWHWHWIXHWHV","FUDSFUEUFVFVHWHXHXIXHWHW","FUETFUFUFVGVHXHXHXIXHWHW","FUETFUETFUFUGWHWHWHXHVGV","FTDSFUETFUFVGWHWHWIXHWHV","FUDSFUEUFVFVHWHXHXIXHWHW","FUETFUFUFVFVHXHXHXIXHWHW","FUETFUETFUFUGWHWHWHXHVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUETFUFUFVFVHXHXHXIXHWHW","FUETFUETFUFUGWHWHWHWGVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETFUETFUFUGWHWHWHWGVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETFUETEUFUGWGWHWHWGVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFUFVHWHXHWIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW","FUETFUETEUFUGWGWHWHWGVGV","FTDSFUETFUFVGWHWHWHXHWGV","FUDSFUEUFUFVHWHXHWIXHWHV","FUESFUEUFVFVHWHXHXIXHWHW","FUETFUETEUFUGWGWHWHWGVGV","FTDSFUETFUFVGWHWHWHXHWGV","FUDSFUETFUFVGWHXHWIXHWHV","FUESFUEUFVFVHWHXHXIXHWHW","FUETFUETEUFUGWGWHWHWGVGV","FTDSFUETFUFUGWHWHWHXHVGV","FUDSFUETFUFVGWHWHWIXHWHV","FUDSFUEUFVFVHWHXHXIXHWHW","FUETETETEUFUGWGWGWHWGVGV","ETDSFUETFUFUGWHWHWHXHVGV","FTDSFUETFUFVGWHWHWIXHWHV","FUDSFUEUFVFVHWHXHXIXHWHW","FUETETETEUEUGWGWGWHWGVGV","ETDSFUETFUFUGWHWHWHXHVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUETETETEUEUGWGWGWHWGVGV","ETDSFUETFUFUGWHWHWHWGVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESETETEUEUGWGWGWHWGVGV","ETDSFUETFUFUGWGWHWHWGVGV","FTDSFUETFUFVGWHWHWIXHWGV","FUDSFUEUFVFVHWHXHXIXHWHV","FUESFUFUFVFVHXHXHXIXHWHW"];
const LUNAR_MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const LUNAR_DAYS = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
const TIANGAN = "甲乙丙丁戊己庚辛壬癸", DIZHI = "子丑寅卯辰巳午未申酉戌亥", SHENGXIAO = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
const JIEQI_NAMES = ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
  "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"];

function lunarOf(date) {
  const y = date.getFullYear(), d0 = dayStart(date);
  for (const ly of [y, y - 1]) {
    const code = LUNAR_TABLE[ly - LUNAR_BASE];
    if (code === undefined) continue;
    const doy = code >> 17, leap = (code >> 13) & 15, mask = code & 0x1fff;
    let off = Math.round((d0 - new Date(ly, 0, 1 + doy)) / DAY);
    if (off < 0) continue;
    const n = leap ? 13 : 12;
    let mi = 0;
    while (mi < n) { const len = (mask >> mi & 1) ? 30 : 29; if (off < len) break; off -= len; mi++; }
    if (mi >= n) continue;
    let month, isLeap = false;
    if (!leap || mi < leap) month = mi + 1; else if (mi === leap) { month = leap; isLeap = true; } else month = mi;
    const gz = ((ly - 4) % 60 + 60) % 60;
    return { year: ly, month, day: off + 1, isLeap, ganzhi: TIANGAN[gz % 10] + DIZHI[gz % 12], shengxiao: SHENGXIAO[gz % 12],
      monthName: (isLeap ? "闰" : "") + LUNAR_MONTHS[month - 1] + "月", dayName: LUNAR_DAYS[off] };
  }
  return null;
}
function sunLon(jd) {
  const T = (jd - 2451545) / 36525, r = Math.PI / 180;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * r;
  const Cc = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const om = (125.04 - 1934.136 * T) * r;
  return (((L0 + Cc - 0.00569 - 0.00478 * Math.sin(om)) % 360) + 360) % 360;
}
function jieqiDatesOfYear(year) {
  const row = JIEQI_TABLE[year - LUNAR_BASE];
  if (row) return JIEQI_NAMES.map((name, k) => ({ name, y: year, m: (k >> 1) + 1, d: row.charCodeAt(k) - 65 }));
  const jan5 = Date.UTC(year, 0, 5, 16) / DAY + 2440587.5;
  return JIEQI_NAMES.map((name, k) => {
    let jd = jan5 + k * 15.2184, target = (285 + 15 * k) % 360;
    for (let i = 0; i < 6; i++) { let diff = sunLon(jd) - target; diff = ((diff + 180) % 360 + 360) % 360 - 180; jd -= diff / (360 / 365.2422); }
    const t = new Date((jd - 2440587.5) * DAY + 8 * 3600000);
    return { name, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  });
}
function jieqiAround(date) {
  const y = date.getFullYear(), d0 = dayStart(date);
  const all = [...jieqiDatesOfYear(y - 1).slice(22), ...jieqiDatesOfYear(y), ...jieqiDatesOfYear(y + 1).slice(0, 2)];
  let prev = null, next = null;
  for (const j of all) {
    const days = Math.round((new Date(j.y, j.m - 1, j.d) - d0) / DAY);
    if (days <= 0) prev = { name: j.name, days: -days }; else if (!next) next = { name: j.name, days };
  }
  return { prev, next };
}

// =====================================================================
// DATA
// =====================================================================
async function getLocation() {
  if (!CONFIG.USE_GPS) return { v: Object.assign({ fixed: true }, CONFIG.FALLBACK_COORDS), stale: false };
  const r = await cached("loc", CONFIG.TTL.location, async () => {
    Location.setAccuracyToKilometer();
    const l = await Location.current();
    return { lat: l.latitude, lon: l.longitude, alt: l.altitude, hacc: l.horizontalAccuracy, vacc: l.verticalAccuracy };
  });
  if (!r.v) r.v = Object.assign({ fixed: true }, CONFIG.FALLBACK_COORDS);
  return r;
}
async function getPlace(loc) {
  if (!CONFIG.REVERSE_GEOCODE || loc.fixed) return null;
  const key = "geo_" + loc.lat.toFixed(2) + "_" + loc.lon.toFixed(2);
  const r = await cached(key, CONFIG.TTL.geocode, async () => {
    const res = await Location.reverseGeocode(loc.lat, loc.lon);
    const p = res && res[0];
    if (!p) return null;
    return p.subLocality || p.locality || p.subAdministrativeArea || p.administrativeArea || null;
  });
  return r.v;
}
async function getWeather(loc) {
  const q = "latitude=" + loc.lat.toFixed(4) + "&longitude=" + loc.lon.toFixed(4) +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,precipitation,is_day,pressure_msl" +
    "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=1" +
    (CONFIG.UNITS_METRIC ? "" : "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch");
  return await cached("wx", CONFIG.TTL.weather, async () => {
    const j = await getJSON("https://api.open-meteo.com/v1/forecast?" + q);
    const c = j.current, d = j.daily;
    return { t: c.temperature_2m, feel: c.apparent_temperature, rh: c.relative_humidity_2m, code: c.weather_code, day: c.is_day,
      wind: c.wind_speed_10m, wdir: c.wind_direction_10m, uv: c.uv_index, precip: c.precipitation, pres: c.pressure_msl,
      tmax: d.temperature_2m_max[0], tmin: d.temperature_2m_min[0], sunrise: d.sunrise[0], sunset: d.sunset[0],
      uvmax: d.uv_index_max[0], pop: d.precipitation_probability_max[0], psum: d.precipitation_sum[0], elev: j.elevation };
  });
}
async function getAQI(loc) {
  return await cached("aqi", CONFIG.TTL.aqi, async () => {
    const j = await getJSON("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + loc.lat.toFixed(4) + "&longitude=" + loc.lon.toFixed(4) + "&current=us_aqi,pm2_5&timezone=auto");
    return { aqi: j.current.us_aqi, pm25: j.current.pm2_5 };
  });
}
async function getStocks() {
  if (!CONFIG.STOCKS.length) return { v: [], stale: false };
  return await cached("stocks", CONFIG.TTL.quotes, async () => {
    const syms = CONFIG.STOCKS.map(encodeURIComponent).join(",");
    let out = [];
    try {
      const j = await getJSON("https://query1.finance.yahoo.com/v8/finance/spark?symbols=" + syms + "&range=1d&interval=1d");
      for (const r of (j.spark && j.spark.result) || []) {
        const m = r.response && r.response[0] && r.response[0].meta;
        if (m) out.push(quoteFromMeta(r.symbol, m));
      }
    } catch (e) { console.warn("spark: " + e); }
    if (out.length < CONFIG.STOCKS.length) {
      for (const s of CONFIG.STOCKS) {
        if (out.find(x => x.sym === s)) continue;
        try {
          const j = await getJSON("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(s) + "?range=1d&interval=1d");
          const m = j.chart.result[0].meta;
          out.push(quoteFromMeta(s, m));
        } catch (e) { console.warn("chart " + s + ": " + e); }
      }
    }
    return out.length ? CONFIG.STOCKS.map(s => out.find(x => x.sym === s)).filter(Boolean) : null;
  });
}
function quoteFromMeta(sym, m) {
  const price = m.regularMarketPrice, prev = m.previousClose != null ? m.previousClose : m.chartPreviousClose;
  const pct = (price != null && prev) ? (price - prev) / prev * 100 : null;
  return { sym: sym.replace(/^\^/, ""), price, pct, cur: m.currency };
}
async function getCrypto() {
  if (!CONFIG.CRYPTO.length) return { v: [], stale: false };
  return await cached("crypto", CONFIG.TTL.crypto, async () => {
    try {
      const list = encodeURIComponent(JSON.stringify(CONFIG.CRYPTO.map(s => s.toUpperCase() + "USDT")));
      const j = await getJSON("https://api.binance.com/api/v3/ticker/24hr?symbols=" + list);
      const arr = Array.isArray(j) ? j : [];
      if (arr.length) return CONFIG.CRYPTO.map(s => {
        const r = arr.find(x => x.symbol === s.toUpperCase() + "USDT");
        return r ? { sym: s.toUpperCase(), price: parseFloat(r.lastPrice), pct: parseFloat(r.priceChangePercent) } : null;
      }).filter(Boolean);
    } catch (e) { console.warn("binance: " + e); }
    const ids = CONFIG.CRYPTO.map(s => CONFIG.CRYPTO_GECKO_IDS[s.toUpperCase()] || s.toLowerCase());
    const j = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=" + ids.join(",") + "&vs_currencies=usd&include_24hr_change=true");
    return CONFIG.CRYPTO.map((s, i) => { const r = j[ids[i]]; return r ? { sym: s.toUpperCase(), price: r.usd, pct: r.usd_24h_change } : null; }).filter(Boolean);
  });
}
async function getNet() {
  return await cached("ip", CONFIG.TTL.ip, async () => {
    try {
      const j = await getJSON("http://ip-api.com/json/?fields=status,query,isp,org,as,countryCode,proxy,hosting");
      if (j.status === "success") return { ip: j.query, isp: j.isp || j.org || "", as: j.as || "", cc: j.countryCode, proxy: !!j.proxy, hosting: !!j.hosting };
    } catch (e) { console.warn("ip-api: " + e); }
    const j = await getJSON("https://ipapi.co/json/");
    return { ip: j.ip, isp: j.org || "", as: j.asn || "", cc: j.country_code, proxy: false, hosting: false, noFlags: true };
  });
}
function vpnOn(n) {
  if (!n) return null;
  if (n.proxy || n.hosting) return true;
  if (CONFIG.TRUSTED_ISP.length) {
    const s = (n.isp + " " + n.as).toLowerCase();
    return !CONFIG.TRUSTED_ISP.some(t => s.includes(t.toLowerCase()));
  }
  return n.noFlags ? null : false;
}
async function getGmail() {
  const g = CONFIG.GMAIL;
  if (!g || !g.user || !g.appPassword) return null;
  return await cached("gmail", CONFIG.TTL.gmail, async () => {
    const r = new Request("https://mail.google.com/mail/feed/atom");
    r.timeoutInterval = CONFIG.NET_TIMEOUT_S;
    r.headers = { Authorization: "Basic " + Data.fromString(g.user + ":" + g.appPassword).toBase64String() };
    const xml = await r.loadString();
    const m = xml.match(/<fullcount>(\d+)<\/fullcount>/);
    if (!m) throw new Error("gmail: no fullcount (bad app password?)");
    return { unread: parseInt(m[1], 10) };
  });
}
async function getBridge() {
  try {
    const ic = FileManager.iCloud();
    const p = ic.joinPath(ic.documentsDirectory(), CONFIG.BRIDGE_FILE);
    if (!ic.fileExists(p)) return null;
    await ic.downloadFileFromiCloud(p);
    const raw = ic.readString(p);
    let j;
    try { j = JSON.parse(raw); } catch (e) { j = null; }
    if (!j || typeof j !== "object" || !Object.keys(j).length) return null;
    const mt = ic.modificationDate(p);
    const ts = j.ts ? new Date(j.ts) : mt;
    const ageH = (Date.now() - (ts ? ts.getTime() : 0)) / 3600000;
    return {
      move: num(j.move), moveGoal: num(j.moveGoal) || CONFIG.MOVE_GOAL,
      exercise: num(j.exercise), exerciseGoal: num(j.exerciseGoal) || CONFIG.EXERCISE_GOAL,
      stand: num(j.stand), standGoal: num(j.standGoal) || CONFIG.STAND_GOAL,
      steps: num(j.steps), distance: num(j.distance),
      ssid: j.ssid ? String(j.ssid).trim() : null, lanIp: j.lanIp ? String(j.lanIp).trim() : null,
      carrier: j.carrier ? String(j.carrier).trim() : null, radio: j.radio ? String(j.radio).trim() : null,
      alarm: j.alarm ? String(j.alarm).trim() : null,
      ts, stale: ageH > CONFIG.BRIDGE_STALE_HOURS,
    };
  } catch (e) { console.warn("bridge: " + e); return null; }
}
function pickCalendars(all, include, exclude) {
  let cs = all;
  if (include && include.length) cs = cs.filter(c => include.includes(c.title));
  if (exclude && exclude.length) cs = cs.filter(c => !exclude.includes(c.title));
  return cs;
}
async function getEvents(now) {
  const cals = pickCalendars(await Calendar.forEvents(), CONFIG.CALENDARS, CONFIG.CALENDARS_EXCLUDE);
  const today = await CalendarEvent.today(cals);
  const tmr = await CalendarEvent.tomorrow(cals);
  const clean = list => list.filter(e => e.title).sort((a, b) => a.startDate - b.startDate || a.isAllDay - b.isAllDay);
  // month grid range
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + (CONFIG.WEEK_STARTS_MONDAY ? 6 : 0)) % 7));
  const gridEnd = new Date(gridStart.getTime() + 42 * DAY);
  const month = await CalendarEvent.between(gridStart, gridEnd, cals);
  const eventDays = new Set();
  for (const e of month) {
    let s = dayStart(e.startDate), end = e.endDate;
    for (let d = s; d < end && eventDays.size < 100; d = new Date(d.getTime() + DAY)) eventDays.add(d.getMonth() + "-" + d.getDate());
  }
  return { today: clean(today), tomorrow: clean(tmr), eventDays, gridStart };
}
async function getReminders(now) {
  const all = await Calendar.forReminders();
  const cals = pickCalendars(all, CONFIG.REMINDER_LISTS, []);
  const list = await Reminder.allIncomplete(cals);
  const horizon = dayStart(now).getTime() + (CONFIG.REMINDER_DAYS_AHEAD + 1) * DAY;
  const rows = list.filter(r => r.title && (r.dueDate ? r.dueDate.getTime() < horizon : CONFIG.REMINDER_LISTS.length > 0));
  rows.sort((a, b) => {
    const ad = a.dueDate ? a.dueDate.getTime() : Infinity, bd = b.dueDate ? b.dueDate.getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return (a.priority || 9) - (b.priority || 9);
  });
  return rows;
}

// =====================================================================
// RENDER HELPERS
// =====================================================================
function txt(stack, s, font, color, opts) {
  const t = stack.addText(String(s));
  t.font = font || F.body; t.textColor = color || C.fg; t.lineLimit = 1;
  t.minimumScaleFactor = (opts && opts.scale) || 0.7;
  if (opts && opts.right) t.rightAlignText();
  return t;
}
function hairline(w, width) {
  const s = w.addStack(); s.size = new Size(width, 1); s.backgroundColor = C.line;
}
function wxSymbol(code, isDay) {
  if (code === 0) return isDay ? "sun.max.fill" : "moon.stars.fill";
  if (code <= 2) return isDay ? "cloud.sun.fill" : "cloud.moon.fill";
  if (code === 3) return "cloud.fill";
  if (code <= 48) return "cloud.fog.fill";
  if (code <= 57) return "cloud.drizzle.fill";
  if (code <= 67) return "cloud.rain.fill";
  if (code <= 77) return "cloud.snow.fill";
  if (code <= 82) return "cloud.heavyrain.fill";
  if (code <= 86) return "cloud.snow.fill";
  return "cloud.bolt.rain.fill";
}
function wxColor(code) {
  if (code === 0) return C.amber;
  if (code <= 3) return C.fg;
  if (code <= 48) return C.dim;
  if (code <= 67) return C.blue;
  if (code <= 77) return C.cyan;
  if (code <= 86) return C.blue;
  return C.purple;
}
function uvColor(uv) { return uv >= 8 ? C.red : uv >= 6 ? C.amber : uv >= 3 ? C.fg : C.dim; }
function aqiColor(a) { return a == null ? C.dim : a <= 50 ? C.green : a <= 100 ? C.amber : a <= 150 ? C.red : C.purple; }
function ringsImage(b) {
  const S = 42, ctx = new DrawContext();
  ctx.size = new Size(S, S); ctx.opaque = false; ctx.respectScreenScale = true;
  const cx = S / 2, cy = S / 2, lw = 4.5;
  const rings = [
    [b.move, b.moveGoal, C.ringMove, 18], [b.exercise, b.exerciseGoal, C.ringEx, 12.5], [b.stand, b.standGoal, C.ringStand, 7],
  ];
  for (const [val, goal, col, r] of rings) {
    ctx.setLineWidth(lw);
    ctx.setStrokeColor(new Color(col.hex, 0.18));
    ctx.strokeEllipse(new Rect(cx - r, cy - r, 2 * r, 2 * r));
    const frac = (val == null || !goal) ? 0 : Math.min(1, val / goal);
    if (frac <= 0) continue;
    const pts = [], n = Math.max(2, Math.ceil(frac * 60));
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + frac * 2 * Math.PI * (i / n);
      pts.push(new Point(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
    const p = new Path(); p.addLines(pts);
    ctx.setStrokeColor(col); ctx.addPath(p); ctx.strokePath();
  }
  return ctx.getImage();
}

// =====================================================================
// BUILD WIDGET
// =====================================================================
async function build() {
  const now = new Date();
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(9, 12, 7, 12);
  w.spacing = 0;
  w.refreshAfterDate = new Date(now.getTime() + CONFIG.REFRESH_MIN * 60000);

  // ---- gather (all independent; failures degrade to "--") ----
  const loc = await getLocation();
  const [wx, aqi, stocks, crypto, net, bridge, ev, rem, place, gmail] = await Promise.all([
    getWeather(loc.v), getAQI(loc.v), getStocks(), getCrypto(), getNet(), getBridge(), getEvents(now), getReminders(now), getPlace(loc.v), getGmail(),
  ].map(p => Promise.resolve(p).catch(e => { console.warn(e); return null; })));
  const battery = Device.batteryLevel(), charging = Device.isCharging();

  // ================= ROW 1: date · lunar · 节气 · live clock =================
  const lun = lunarOf(now), jq = jieqiAround(now);
  const r1 = w.addStack(); r1.layoutHorizontally(); r1.centerAlignContent(); r1.spacing = 6;
  // 不放时钟：状态栏永远有时间，重复即无效信息
  txt(r1, WD[now.getDay()] + " " + pad2(now.getDate()) + " " + MON[now.getMonth()], F.bold, C.fg);
  txt(r1, "W" + isoWeek(now) + " D" + dayOfYear(now), F.body, C.dim);
  if (lun) txt(r1, lun.ganzhi + lun.shengxiao + " " + lun.monthName + lun.dayName, F.body, C.amber);
  if (jq && jq.next) txt(r1, (jq.prev && jq.prev.days === 0 ? jq.prev.name + "·" : "") + jq.next.name + "-" + jq.next.days + "d", F.body, jq.prev && jq.prev.days === 0 ? C.amber : C.dim);
  r1.addSpacer();

  // ================= ROW 2: weather =================
  const r2 = w.addStack(); r2.layoutHorizontally(); r2.centerAlignContent(); r2.spacing = 5;
  const W = wx && wx.v;
  if (W) {
    const sym = SFSymbol.named(wxSymbol(W.code, W.day)); sym.applyFont(Font.systemFont(12));
    const im = r2.addImage(sym.image); im.imageSize = new Size(14, 14); im.tintColor = wxColor(W.code);
    const u = CONFIG.UNITS_METRIC ? "°" : "°";
    txt(r2, Math.round(W.t) + u, F.bold, C.fg);
    if (Math.abs(W.feel - W.t) >= 2) txt(r2, "~" + Math.round(W.feel) + u, F.body, C.dim);   // 体感差 <2° 不显示，省位置
    txt(r2, Math.round(W.tmin) + "/" + Math.round(W.tmax), F.body, C.fg);
    txt(r2, "H" + Math.round(W.rh) + "%", F.body, C.fg);
    txt(r2, "UV" + Math.round(W.uv) + (W.uvmax != null && Math.round(W.uvmax) > Math.round(W.uv) ? "/" + Math.round(W.uvmax) : ""), F.body, uvColor(W.uvmax != null ? W.uvmax : W.uv));
    txt(r2, "P" + (W.pop != null ? W.pop : "--") + "%" + (W.psum ? " " + W.psum + (CONFIG.UNITS_METRIC ? "mm" : "in") : ""), F.body, W.pop >= 50 ? C.blue : C.fg);
    if (aqi && aqi.v && aqi.v.aqi != null) txt(r2, "AQI" + Math.round(aqi.v.aqi), F.body, aqiColor(aqi.v.aqi));
    const ms = W.wind / 3.6;
    if (CONFIG.UNITS_METRIC ? ms >= 1 : W.wind >= 3) txt(r2, compass(W.wdir) + (CONFIG.UNITS_METRIC ? Math.round(ms) + "m/s" : Math.round(W.wind) + "mph"), F.body, W.wind >= 36 ? C.amber : C.dim);
    r2.addSpacer();
    if (wx.stale) txt(r2, "!", F.bold, C.amber);
  } else {
    txt(r2, "WX --", F.body, C.dim);
  }

  // ================= ROW 3: geo · sun =================
  const r3 = w.addStack(); r3.layoutHorizontally(); r3.centerAlignContent(); r3.spacing = 5;
  const L = loc.v;
  txt(r3, Math.abs(L.lat).toFixed(4) + (L.lat >= 0 ? "N" : "S") + " " + Math.abs(L.lon).toFixed(4) + (L.lon >= 0 ? "E" : "W"), F.body, L.fixed ? C.dim : C.fg);
  if (L.alt != null && !L.fixed) txt(r3, "↑" + Math.round(L.alt) + "m", F.body, C.fg);
  else if (W && W.elev != null) txt(r3, "↑" + Math.round(W.elev) + "m", F.body, C.dim);
  if (place) txt(r3, place.length > 8 ? place.slice(0, 8) : place, F.body, C.blue);
  if (W && W.sunrise) txt(r3, "☀" + W.sunrise.slice(11, 16) + "-" + W.sunset.slice(11, 16), F.body, C.dim);
  if (CONFIG.SHOW_PRESSURE && W && W.pres != null) txt(r3, Math.round(W.pres) + "hPa", F.body, C.dim);
  r3.addSpacer();
  if (loc.stale && !L.fixed) txt(r3, "loc?", F.small, C.amber);

  w.addSpacer(3); hairline(w, CONFIG.WIDTH); w.addSpacer(3);

  // ================= BODY =================
  const body = w.addStack(); body.layoutHorizontally(); body.topAlignContent();
  const left = body.addStack(); left.layoutVertically(); left.size = new Size(CONFIG.LEFT_W, 0); left.spacing = 1;
  body.addSpacer(CONFIG.WIDTH - CONFIG.LEFT_W - CONFIG.RIGHT_W);
  const right = body.addStack(); right.layoutVertically(); right.size = new Size(CONFIG.RIGHT_W, 0); right.spacing = 1;

  // ---- LEFT: agenda ----
  const E = ev || { today: [], tomorrow: [] };
  const upcoming = E.today.filter(e => !e.isAllDay && e.endDate > now);
  const nextEv = upcoming.find(e => e.startDate > now);
  const cur = upcoming.find(e => e.startDate <= now);
  const remRows = rem || [];
  const evLines = Math.min(E.today.length + Math.min(E.tomorrow.length, 3), Math.max(3, CONFIG.LEFT_LINES - 2 - Math.min(remRows.length, CONFIG.MIN_REMINDER_LINES)));
  const remLines = Math.max(0, CONFIG.LEFT_LINES - 2 - evLines);

  const ah = left.addStack(); ah.layoutHorizontally(); ah.centerAlignContent(); ah.spacing = 4;
  txt(ah, "AGENDA", F.smallBold, C.dim);
  txt(ah, E.today.length + "·" + E.tomorrow.length, F.small, C.dim);
  if (cur) { txt(ah, "▶" + hm(cur.endDate), F.small, C.green); }
  else if (nextEv) {
    txt(ah, "→", F.small, C.blue);
    const rel = ah.addDate(nextEv.startDate); rel.applyRelativeStyle(); rel.font = F.small; rel.textColor = C.blue; rel.lineLimit = 1; rel.minimumScaleFactor = 0.7;
  } else if (!E.today.length) txt(ah, "free", F.small, C.faint);

  let shown = 0;
  const todayCount = Math.min(E.today.length, evLines);
  const evRow = (e, prefix, dimAll) => {
    const s = left.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 4;
    const past = e.endDate <= now, ongoing = e.startDate <= now && e.endDate > now;
    const col = dimAll || past ? C.dim : ongoing ? C.green : e === nextEv ? C.blue : C.fg;
    txt(s, prefix + (e.isAllDay ? "ALL  " : hm(e.startDate)), F.body, past ? C.faint : dimAll ? C.dim : col);
    txt(s, e.title, F.body, col, { scale: 0.85 });
    s.addSpacer();
    if (!e.isAllDay) txt(s, durStr(e.endDate - e.startDate), F.small, C.faint);
    else if (e.calendar && e.calendar.title) txt(s, e.calendar.title.slice(0, 6), F.small, C.faint);
  };
  // hide past events first if we must trim
  let todayList = E.today;
  if (todayList.length > todayCount) {
    const future = todayList.filter(e => e.endDate > now);
    todayList = future.length >= todayCount ? future : todayList.slice(todayList.length - todayCount);
  }
  for (const e of todayList.slice(0, todayCount)) { evRow(e, ""); shown++; }
  for (const e of E.tomorrow.slice(0, evLines - shown)) { evRow(e, "+", true); shown++; }
  const hidden = E.today.length + E.tomorrow.length - shown;

  // ---- LEFT: reminders ----
  if (remLines > 0) {
    const rh = left.addStack(); rh.layoutHorizontally(); rh.centerAlignContent(); rh.spacing = 4;
    txt(rh, "TODO", F.smallBold, C.dim);
    const overdue = remRows.filter(r => r.dueDate && r.dueDate < now).length;
    txt(rh, String(remRows.length) + (overdue ? "·" + overdue + "!" : ""), F.small, overdue ? C.red : C.dim);
    if (hidden > 0) { rh.addSpacer(); txt(rh, "+" + hidden + " ev", F.small, C.faint); }
    for (const r of remRows.slice(0, remLines)) {
      const s = left.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 4;
      const od = r.dueDate && r.dueDate < now;
      const dueToday = r.dueDate && dayStart(r.dueDate).getTime() === dayStart(now).getTime();
      const hi = r.priority > 0 && r.priority <= 4;
      txt(s, hi ? "!" : od ? "!" : "•", F.bold, hi || od ? C.red : C.faint);
      txt(s, r.title, F.body, od ? C.red : dueToday ? C.fg : C.dim, { scale: 0.85 });
      s.addSpacer();
      let due = "";
      if (r.dueDate) {
        if (od) { const d = Math.floor((now - r.dueDate) / DAY); due = d >= 1 ? "-" + d + "d" : hm(r.dueDate); }
        else if (dueToday) due = r.dueDateIncludesTime ? hm(r.dueDate) : "today";
        else due = md(r.dueDate);
      }
      if (due) txt(s, due, F.small, od ? C.red : C.faint);
    }
    if (remRows.length > remLines) txt(left, "+" + (remRows.length - remLines), F.small, C.faint);
  }

  // ---- RIGHT: month grid (ISO week + 7 days) ----
  const cellW = Math.floor(CONFIG.RIGHT_W / 8), cellH = CONFIG.FONT + 1;
  const cell = (row, s, font, color, bg) => {
    const c = row.addStack(); c.size = new Size(cellW, cellH); c.centerAlignContent();
    if (bg) { c.backgroundColor = bg; c.cornerRadius = 3; }
    c.addSpacer();
    const t = c.addText(s); t.font = font; t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
    c.addSpacer();
  };
  const hdr = right.addStack(); hdr.layoutHorizontally();
  const dn = CONFIG.WEEK_STARTS_MONDAY ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  cell(hdr, "wk", F.grid, C.faint);
  dn.forEach((d, i) => cell(hdr, d, F.gridBold, ((CONFIG.WEEK_STARTS_MONDAY && i >= 5) || (!CONFIG.WEEK_STARTS_MONDAY && (i === 0 || i === 6))) ? C.faint : C.dim));
  const gs = (E.gridStart) || (() => { const f = new Date(now.getFullYear(), now.getMonth(), 1); f.setDate(1 - ((f.getDay() + (CONFIG.WEEK_STARTS_MONDAY ? 6 : 0)) % 7)); return f; })();
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const rowsNeeded = Math.ceil((Math.round((lastOfMonth - gs) / DAY) + 1) / 7);
  for (let r = 0; r < rowsNeeded; r++) {
    const row = right.addStack(); row.layoutHorizontally();
    const wkDate = new Date(gs.getTime() + r * 7 * DAY);
    const isCurWeek = isoWeek(wkDate) === isoWeek(now) && Math.abs(wkDate - now) < 8 * DAY;
    cell(row, String(isoWeek(wkDate)), F.grid, isCurWeek ? C.dim : C.faint);
    for (let i = 0; i < 7; i++) {
      const d = new Date(gs.getTime() + (r * 7 + i) * DAY);
      const inMonth = d.getMonth() === now.getMonth();
      const isToday = d.getDate() === now.getDate() && inMonth;
      const wkend = CONFIG.WEEK_STARTS_MONDAY ? i >= 5 : (i === 0 || i === 6);
      const has = E.eventDays && E.eventDays.has(d.getMonth() + "-" + d.getDate());
      let col = !inMonth ? C.faint : wkend ? C.dim : C.fg;
      if (has && inMonth && !isToday) col = C.blue;
      if (isToday) cell(row, String(d.getDate()), F.gridBold, C.bg, C.fg);
      else cell(row, String(d.getDate()), has && inMonth ? F.gridBold : F.grid, col);
    }
  }

  right.addSpacer(4);
  // ---- RIGHT: quotes ----
  const quotes = [...((stocks && stocks.v) || []), ...((crypto && crypto.v) || [])].slice(0, CONFIG.QUOTE_ROWS);
  const qStale = (stocks && stocks.stale) || (crypto && crypto.stale);
  for (const q of quotes) {
    const s = right.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 3;
    const col = q.pct == null ? C.dim : q.pct >= 0 ? UP : DOWN;
    txt(s, q.sym.length > 6 ? q.sym.slice(0, 6) : q.sym, F.smallBold, C.fg);
    s.addSpacer();
    txt(s, fmtPrice(q.price), F.small, C.fg);
    txt(s, fmtPct(q.pct), F.smallBold, col, { right: true });
  }
  if (!quotes.length) txt(right, "MKT --", F.small, C.dim);
  else if (qStale) txt(right, "mkt cached " + hm(new Date(Math.max(stocks ? stocks.t || 0 : 0, crypto ? crypto.t || 0 : 0))), F.small, C.amber);

  right.addSpacer(4);
  // ---- RIGHT: rings + steps (bridge) ----
  if (bridge && (bridge.move != null || bridge.steps != null)) {
    const rs = right.addStack(); rs.layoutHorizontally(); rs.centerAlignContent(); rs.spacing = 5;
    const im = rs.addImage(ringsImage(bridge)); im.imageSize = new Size(42, 42);
    const col = rs.addStack(); col.layoutVertically(); col.spacing = 0;
    const dimB = bridge.stale ? C.dim : C.fg;
    const line = (label, v, goal, c, unit) => {
      const s = col.addStack(); s.layoutHorizontally(); s.spacing = 3; s.centerAlignContent();
      txt(s, label, F.smallBold, bridge.stale ? C.dim : c);
      txt(s, (v == null ? "--" : Math.round(v)) + "/" + goal + unit, F.small, dimB);
    };
    line("M", bridge.move, bridge.moveGoal, C.ringMove, "");
    line("E", bridge.exercise, bridge.exerciseGoal, C.ringEx, "");
    line("S", bridge.stand, bridge.standGoal, C.ringStand, "");
    if (bridge.steps != null) {
      const s = col.addStack(); s.layoutHorizontally(); s.spacing = 3; s.centerAlignContent();
      txt(s, Math.round(bridge.steps).toLocaleString("en-US"), F.small, dimB);
      if (bridge.distance != null) txt(s, bridge.distance.toFixed(1) + "km", F.small, C.dim);
      if (bridge.stale) txt(s, "?", F.smallBold, C.amber);
    }
  } else {
    txt(right, "RINGS: no bridge", F.small, C.faint);
  }

  w.addSpacer();
  hairline(w, CONFIG.WIDTH); w.addSpacer(3);

  // ================= FOOTER 1: WAN · VPN · battery =================
  const f1 = w.addStack(); f1.layoutHorizontally(); f1.centerAlignContent(); f1.spacing = 5;
  const N = net && net.v;
  if (N) {
    txt(f1, N.ip, F.foot, C.fg);
    txt(f1, ispShort(N.isp) + (N.cc ? " " + N.cc : ""), F.foot, C.dim);
    const v = vpnOn(N);
    txt(f1, v === true ? "VPN ON" : v === false ? "VPN OFF" : "VPN ?", F.footBold, v === true ? C.amber : v === false ? C.dim : C.faint);
    if (net.stale) txt(f1, "!", F.footBold, C.amber);
  } else txt(f1, "NET --", F.foot, C.dim);
  f1.addSpacer();
  const bp = Math.round(battery * 100);
  txt(f1, (charging ? "⚡" : "BAT ") + bp + "%", F.footBold, charging ? C.green : bp <= 20 ? C.red : C.fg, { right: true });

  // ================= FOOTER 2: LAN · SIM · alarm · run time =================
  const f2 = w.addStack(); f2.layoutHorizontally(); f2.centerAlignContent(); f2.spacing = 5;
  const bcol = bridge && bridge.stale ? C.faint : C.dim;
  if (bridge && (bridge.ssid || bridge.lanIp)) txt(f2, [bridge.ssid && bridge.ssid.slice(0, 12), bridge.lanIp].filter(Boolean).join(" "), F.foot, bcol);
  if (bridge && (bridge.carrier || bridge.radio)) txt(f2, [bridge.carrier && bridge.carrier.slice(0, 8), bridge.radio].filter(Boolean).join(" "), F.foot, bcol);
  if (bridge && bridge.alarm) txt(f2, "⏰" + bridge.alarm, F.foot, bridge.stale ? C.dim : C.fg);
  if (gmail && gmail.v) txt(f2, "✉" + gmail.v.unread + (gmail.stale ? "!" : ""), F.footBold, gmail.v.unread ? C.blue : C.dim);
  if (bridge && bridge.stale) txt(f2, "bridge " + Math.round((now - bridge.ts) / 3600000) + "h", F.foot, C.amber);
  if (!bridge) txt(f2, "no bridge", F.foot, C.faint);
  f2.addSpacer();
  txt(f2, "↻" + hm(now), F.foot, C.faint, { right: true });

  return w;
}

// =====================================================================
const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
