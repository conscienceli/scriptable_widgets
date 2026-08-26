// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: terminal;
/*
 * GeekBoard — dense large widget for Scriptable
 * 日历/日程/提醒/农历/节气/天气/AQI/定位/海拔/行情(含盘前盘后)/加密货币/VPN/IP/WiFi/SIM/三圆环/步数/闹钟
 * 无外部依赖。所有网络请求带 TTL 缓存；行情 TTL 随交易时段动态调整以省电。
 * 尺寸自动适配机型。配置只改下面 CONFIG 一处。
 */

// =====================================================================
// CONFIG
// =====================================================================
const CONFIG = {
  // ---- 行情（3~5 个即可，超出会被截断到 QUOTE_ROWS）----
  STOCKS: ["AAPL", "NVDA", "TSLA"],          // Yahoo 代码。港股 0700.HK，A股 600519.SS / 000001.SZ，日股 7203.T，指数 ^GSPC
  CRYPTO: ["BTC", "ETH"],                    // Binance 现货，自动拼 USDT；备用 CoinGecko
  CRYPTO_GECKO_IDS: { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", DOGE: "dogecoin", XRP: "ripple" },
  QUOTE_ROWS: 5,
  CN_COLOR_CONVENTION: true,                 // true = 红涨绿跌；false = 绿涨红跌
  EXTENDED_HOURS: true,                      // 取盘前/盘后价（每个股票 1 次请求；关掉则用批量接口，1 次总请求但没有盘前盘后）

  // ---- 日历 / 提醒 ----
  CALENDARS: [],                             // 只看这些日历（名称），空 = 全部
  CALENDARS_EXCLUDE: ["Birthdays", "Siri Suggestions", "生日", "Siri 建议"],
  REMINDER_LISTS: [],                        // 指定提醒事项列表（名称），空 = 全部列表
  REMINDER_DAYS_AHEAD: 7,
  MIN_REMINDER_LINES: 3,

  // ---- 定位 / 天气 ----
  USE_GPS: true,
  FALLBACK_COORDS: { lat: 35.6812, lon: 139.7671 },
  REVERSE_GEOCODE: true,
  UNITS_METRIC: true,
  SHOW_PRESSURE: false,

  // ---- 网络 / VPN ----
  TRUSTED_ISP: [],                           // 例如 ["KDDI","SoftBank","NTT"]。留空则只用 ip-api 的机房/代理标记判定

  // ---- Gmail 未读数（可选）：Google 账号 → 安全性 → 两步验证 → 应用专用密码 ----
  GMAIL: { user: "", appPassword: "" },

  // ---- 快捷指令桥接（见 README）----
  BRIDGE_FILE: "geekboard-bridge.json",
  BRIDGE_STALE_HOURS: 4,
  MOVE_GOAL: 500, EXERCISE_GOAL: 30, STAND_GOAL: 12,

  // ---- 刷新 / 缓存（分钟）----
  REFRESH_MIN: 15,
  TTL: { weather: 20, aqi: 60, crypto: 10, ip: 30, location: 30, geocode: 30, gmail: 10 },
  TTL_QUOTES: { OPEN: 5, PRE: 15, POST: 15, CLOSED: 120 },   // 行情按时段动态缓存：休市时 2 小时才重取
  NET_TIMEOUT_S: 8,

  // ---- 布局 ----
  AUTO_SIZE: true,                           // 按机型自动适配；false 则用下面的 FALLBACK_W/H
  FALLBACK_W: 338, FALLBACK_H: 354,
  RIGHT_RATIO: 0.46,                         // 右栏占宽比例
  WEEK_STARTS_MONDAY: true,
  SHOW_ICONS: true,                          // 关掉则纯文字（更省一点，但辨识度低）
  SHOW_SECTION_TINT: true,                   // 区块底色分区
};

// =====================================================================
// DEVICE / SIZE
// =====================================================================
// 已知机型：屏幕点数 → 大号 Widget 尺寸。未知机型按比例回退，不会崩。
const WIDGET_SIZES = {
  "440x956": [382, 406],   // 16 Pro Max / 17 Pro Max
  "430x932": [364, 382],   // 15/16 Pro Max, 15/16 Plus, 14 Pro Max
  "428x926": [364, 382],   // 12/13 Pro Max, 14 Plus
  "402x874": [348, 371],   // 16 Pro
  "393x852": [338, 354],   // 14 Pro, 15, 15 Pro, 16
  "390x844": [338, 354],   // 12/13/13 Pro, 14
  "375x812": [329, 345],   // X, XS, 11 Pro, 12 mini, 13 mini
  "414x896": [360, 379],   // XR, XS Max, 11, 11 Pro Max
  "414x736": [348, 357],   // 6/7/8 Plus
  "375x667": [321, 324],   // 6/7/8, SE2, SE3
  "320x568": [292, 311],   // SE1
};
function widgetSize() {
  if (!CONFIG.AUTO_SIZE) return { w: CONFIG.FALLBACK_W, h: CONFIG.FALLBACK_H, known: false };
  try {
    const s = Device.screenSize();
    const sw = Math.round(Math.min(s.width, s.height)), sh = Math.round(Math.max(s.width, s.height));
    const hit = WIDGET_SIZES[sw + "x" + sh];
    if (hit) return { w: hit[0], h: hit[1], known: true };
    // 未知机型：大号 Widget 宽约为屏宽的 86%，高约为宽的 1.05 倍。留 2px 安全余量。
    return { w: Math.round(sw * 0.86) - 2, h: Math.round(sw * 0.86 * 1.05), known: false };
  } catch (e) {
    return { w: CONFIG.FALLBACK_W, h: CONFIG.FALLBACK_H, known: false };
  }
}
const WSZ = widgetSize();
const PAD_X = 11, PAD_TOP = 8, PAD_BOT = 6;
const BLOCK_PAD_V = 1;          // 区块上下内边距，直接吃掉纵向空间，改大之前先看 leftLines
const LAY = (() => {
  const W = WSZ.w - PAD_X * 2;
  const font = Math.max(10.5, Math.min(14, W / 26.5));
  const gap = 7;
  const rightW = Math.round(W * CONFIG.RIGHT_RATIO);
  const leftW = W - rightW - gap;
  const lineH = font + 3;
  const blockV = BLOCK_PAD_V * 2;
  const stackGap = 2;
  // 固定开销：外边距 + 顶部3个横条 + 底部2行 + 顶层堆叠间距(6处)
  const chrome = PAD_TOP + PAD_BOT + (lineH + blockV) * 3 + (font + 1 + blockV) * 2 + stackGap * 6;
  // 左栏自身开销：AGENDA / TODO 两个区块的内边距 + 它们之间的间距
  const leftOverhead = blockV * 2 + stackGap;
  const leftLines = Math.max(6, Math.floor((WSZ.h - chrome - leftOverhead) / lineH));
  return { W, font, gap, rightW, leftW, lineH, leftLines };
})();

// =====================================================================
// THEME
// =====================================================================
const C = {
  bg: new Color("#0b0f14"), fg: new Color("#e6edf3"), dim: new Color("#8b949e"), faint: new Color("#4a525c"),
  blue: new Color("#58a6ff"), green: new Color("#3fb950"), red: new Color("#f85149"), amber: new Color("#d29922"),
  purple: new Color("#bc8cff"), cyan: new Color("#39d2c0"), orange: new Color("#f78166"), line: new Color("#21262d"),
  ringMove: new Color("#fa114f"), ringEx: new Color("#92e82a"), ringStand: new Color("#00d8ff"),
};
const UP = CONFIG.CN_COLOR_CONVENTION ? C.red : C.green;
const DOWN = CONFIG.CN_COLOR_CONVENTION ? C.green : C.red;
const tint = (c, a) => new Color(c.hex, a);
const F = {
  body: Font.regularMonospacedSystemFont(LAY.font),
  bold: Font.boldMonospacedSystemFont(LAY.font),
  small: Font.regularMonospacedSystemFont(LAY.font - 1.5),
  smallBold: Font.boldMonospacedSystemFont(LAY.font - 1.5),
  foot: Font.regularMonospacedSystemFont(LAY.font - 1),
  footBold: Font.boldMonospacedSystemFont(LAY.font - 1),
  quote: Font.regularMonospacedSystemFont(LAY.font - 2.5),
  quoteBold: Font.boldMonospacedSystemFont(LAY.font - 2.5),
  grid: Font.regularMonospacedSystemFont(LAY.font - 2.5),
  gridBold: Font.boldMonospacedSystemFont(LAY.font - 2.5),
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
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / DAY + 1) / 7);
}
const dayOfYear = d => Math.round((dayStart(d) - new Date(d.getFullYear(), 0, 1)) / DAY) + 1;
function fmtPrice(p) {
  if (p == null || isNaN(p)) return "--";
  if (p >= 10000) return Math.round(p).toLocaleString("en-US");
  if (p >= 1000) return p.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}
const fmtPct = x => (x == null || isNaN(x)) ? "--" : (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
function durStr(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + "h" + pad2(r) : h + "h";
}
const num = v => { if (v == null) return null; if (typeof v === "number") return v; const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const compass = deg => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16];
function ispShort(s) {
  s = String(s || "").replace(/\b(corporation|corp\.?|company|co\.,?|inc\.?|ltd\.?|limited|llc|k\.k\.|kabushiki kaisha|communications?|telecom(munications?)?|group|holdings?)\b/gi, "").replace(/[,.]+/g, " ").replace(/\s+/g, " ").trim();
  if (s.length <= 12) return s;
  const cut = s.slice(0, 13), i = cut.lastIndexOf(" ");
  return (i > 3 ? cut.slice(0, i) : s.slice(0, 12)).trim();
}
function withTimeout(promise, ms) {
  if (typeof Timer === "undefined") return promise;
  return Promise.race([promise, new Promise((_, rej) => Timer.schedule(ms, false, () => rej(new Error("timeout"))))]);
}

// ---- cache ----
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
// ttlMin 可以是函数 (cachedValue) => minutes，用于按内容动态决定缓存时长
async function cached(key, ttlMin, fetcher) {
  const c = cacheRead(key);
  const ttl = typeof ttlMin === "function" ? ttlMin(c && c.v) : ttlMin;
  if (c && Date.now() - c.t < ttl * 60000) return { v: c.v, t: c.t, stale: false };
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
// LUNAR / 节气  (2000–2100 精确表，来源：天文历法 sxtwl；表外回落 Meeus 近似)
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
  return (((L0 + Cc - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * r)) % 360) + 360) % 360;
}
function jieqiDatesOfYear(year) {
  const row = JIEQI_TABLE[year - LUNAR_BASE];
  if (row) return JIEQI_NAMES.map((name, k) => ({ name, y: year, m: (k >> 1) + 1, d: row.charCodeAt(k) - 65 }));
  const jan5 = Date.UTC(year, 0, 5, 16) / DAY + 2440587.5;
  return JIEQI_NAMES.map((name, k) => {
    let jd = jan5 + k * 15.2184; const target = (285 + 15 * k) % 360;
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
    return { lat: l.latitude, lon: l.longitude, alt: l.altitude };
  });
  if (!r.v) r.v = Object.assign({ fixed: true }, CONFIG.FALLBACK_COORDS);
  return r;
}
async function getPlace(loc) {
  if (!CONFIG.REVERSE_GEOCODE || loc.fixed) return null;
  const r = await cached("geo_" + loc.lat.toFixed(2) + "_" + loc.lon.toFixed(2), CONFIG.TTL.geocode, async () => {
    const res = await Location.reverseGeocode(loc.lat, loc.lon);
    const p = res && res[0];
    return p ? (p.subLocality || p.locality || p.subAdministrativeArea || p.administrativeArea || null) : null;
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

// ---- 行情：时段判定 ----
// Yahoo chart meta 带 currentTradingPeriod {pre,regular,post}，每段是 epoch 秒。
// 据此本地判定 PRE / OPEN / POST / CLOSED，不需要额外请求。
function sessionOf(meta, nowSec) {
  const p = meta && meta.currentTradingPeriod;
  if (!p) return { state: "OPEN", until: null };
  const inR = (r) => r && nowSec >= r.start && nowSec < r.end;
  if (inR(p.regular)) return { state: "OPEN", until: p.regular.end };
  if (inR(p.pre)) return { state: "PRE", until: p.pre.end };
  if (inR(p.post)) return { state: "POST", until: p.post.end };
  return { state: "CLOSED", until: p.pre ? p.pre.start : null };
}
function parseChart(sym, j, nowSec) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !r.meta) return null;
  const m = r.meta;
  const prev = m.previousClose != null ? m.previousClose : m.chartPreviousClose;
  const reg = m.regularMarketPrice;
  const sess = sessionOf(m, nowSec);
  const out = { sym: sym.replace(/^\^/, ""), price: reg, prev,
    pct: (reg != null && prev) ? (reg - prev) / prev * 100 : null,
    session: sess.state, until: sess.until, kind: "stock" };
  // 盘前/盘后最新价：取序列里最后一个非空收盘价，且时间戳落在延长时段内
  if (sess.state === "PRE" || sess.state === "POST") {
    const ts = r.timestamp || [];
    const q = r.indicators && r.indicators.quote && r.indicators.quote[0];
    const closes = (q && q.close) || [];
    let lastP = null, lastT = null;
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) { lastP = closes[i]; lastT = ts[i]; break; }
    }
    const win = sess.state === "PRE" ? m.currentTradingPeriod.pre : m.currentTradingPeriod.post;
    if (lastP != null && lastT != null && win && lastT >= win.start - 60) {
      if (sess.state === "PRE") {
        // 盘前：市场还没开，用前收当基准，展示的就是盘前价与盘前涨跌
        out.price = lastP;
        out.pct = prev ? (lastP - prev) / prev * 100 : null;
      } else {
        // 盘后：主数字仍是当日收盘与日内涨跌，另附盘后变动
        out.extPrice = lastP;
        out.extPct = reg ? (lastP - reg) / reg * 100 : null;
      }
    }
  }
  return out;
}
async function getStocks() {
  if (!CONFIG.STOCKS.length) return { v: [], stale: false };
  // 动态 TTL：休市 2h、盘前盘后 15m、盘中 5m。休市时几乎不发请求。
  const ttl = (cachedVal) => {
    if (!cachedVal || !cachedVal.length) return CONFIG.TTL_QUOTES.OPEN;
    const states = cachedVal.map(q => q && q.session);
    if (states.includes("OPEN")) return CONFIG.TTL_QUOTES.OPEN;
    if (states.includes("PRE") || states.includes("POST")) return CONFIG.TTL_QUOTES.PRE;
    return CONFIG.TTL_QUOTES.CLOSED;
  };
  return await cached("stocks", ttl, async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    if (CONFIG.EXTENDED_HOURS) {
      const out = [];
      for (const s of CONFIG.STOCKS) {
        try {
          const j = await getJSON("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(s) +
            "?range=1d&interval=15m&includePrePost=true");
          const q = parseChart(s, j, nowSec);
          if (q) out.push(q);
        } catch (e) { console.warn("chart " + s + ": " + e); }
      }
      if (out.length) return out;
    }
    // 回退（或关闭了盘前盘后）：一次批量请求
    const j = await getJSON("https://query1.finance.yahoo.com/v8/finance/spark?symbols=" +
      CONFIG.STOCKS.map(encodeURIComponent).join(",") + "&range=1d&interval=1d");
    const out = [];
    for (const r of (j.spark && j.spark.result) || []) {
      const m = r.response && r.response[0] && r.response[0].meta;
      if (!m) continue;
      const prev = m.previousClose != null ? m.previousClose : m.chartPreviousClose;
      out.push({ sym: r.symbol.replace(/^\^/, ""), price: m.regularMarketPrice, prev,
        pct: (m.regularMarketPrice != null && prev) ? (m.regularMarketPrice - prev) / prev * 100 : null,
        session: sessionOf(m, nowSec).state, kind: "stock" });
    }
    return out.length ? out : null;
  });
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
        return r ? { sym: s.toUpperCase(), price: parseFloat(r.lastPrice), pct: parseFloat(r.priceChangePercent), kind: "crypto", session: "24H" } : null;
      }).filter(Boolean);
    } catch (e) { console.warn("binance: " + e); }
    const ids = CONFIG.CRYPTO.map(s => CONFIG.CRYPTO_GECKO_IDS[s.toUpperCase()] || s.toLowerCase());
    const j = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=" + ids.join(",") + "&vs_currencies=usd&include_24hr_change=true");
    return CONFIG.CRYPTO.map((s, i) => { const r = j[ids[i]]; return r ? { sym: s.toUpperCase(), price: r.usd, pct: r.usd_24h_change, kind: "crypto", session: "24H" } : null; }).filter(Boolean);
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
    let j; try { j = JSON.parse(ic.readString(p)); } catch (e) { j = null; }
    if (!j || typeof j !== "object" || !Object.keys(j).length) return null;
    const ts = j.ts ? new Date(j.ts) : ic.modificationDate(p);
    return {
      move: num(j.move), moveGoal: num(j.moveGoal) || CONFIG.MOVE_GOAL,
      exercise: num(j.exercise), exerciseGoal: num(j.exerciseGoal) || CONFIG.EXERCISE_GOAL,
      stand: num(j.stand), standGoal: num(j.standGoal) || CONFIG.STAND_GOAL,
      steps: num(j.steps), distance: num(j.distance),
      ssid: j.ssid ? String(j.ssid).trim() : null, lanIp: j.lanIp ? String(j.lanIp).trim() : null,
      carrier: j.carrier ? String(j.carrier).trim() : null, radio: j.radio ? String(j.radio).trim() : null,
      alarm: j.alarm ? String(j.alarm).trim() : null,
      ts, stale: (Date.now() - (ts ? ts.getTime() : 0)) / 3600000 > CONFIG.BRIDGE_STALE_HOURS,
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
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + (CONFIG.WEEK_STARTS_MONDAY ? 6 : 0)) % 7));
  const month = await CalendarEvent.between(gridStart, new Date(gridStart.getTime() + 42 * DAY), cals);
  const eventDays = new Set();
  for (const e of month) {
    for (let d = dayStart(e.startDate); d < e.endDate && eventDays.size < 100; d = new Date(d.getTime() + DAY)) eventDays.add(d.getMonth() + "-" + d.getDate());
  }
  return { today: clean(today), tomorrow: clean(tmr), eventDays, gridStart };
}
async function getReminders(now) {
  const cals = pickCalendars(await Calendar.forReminders(), CONFIG.REMINDER_LISTS, []);
  const list = await Reminder.allIncomplete(cals);
  const horizon = dayStart(now).getTime() + (CONFIG.REMINDER_DAYS_AHEAD + 1) * DAY;
  const rows = list.filter(r => r.title && (r.dueDate ? r.dueDate.getTime() < horizon : CONFIG.REMINDER_LISTS.length > 0));
  rows.sort((a, b) => {
    const ad = a.dueDate ? a.dueDate.getTime() : Infinity, bd = b.dueDate ? b.dueDate.getTime() : Infinity;
    return ad !== bd ? ad - bd : (a.priority || 9) - (b.priority || 9);
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
// SF Symbol 安全包装：符号在当前 iOS 版本不存在时回退到文字，不会崩
function icon(stack, name, size, color, fallback) {
  if (CONFIG.SHOW_ICONS) {
    let s = null;
    try { s = SFSymbol.named(name); } catch (e) { s = null; }
    if (s) {
      try {
        s.applyFont(Font.systemFont(size));
        const i = stack.addImage(s.image);
        i.imageSize = new Size(size + 2, size + 2);
        i.tintColor = color || C.dim;
        i.resizable = false;
        return true;
      } catch (e) { /* fall through */ }
    }
  }
  if (fallback) txt(stack, fallback, F.small, color || C.dim);
  return false;
}
function hairline(w, width, color) {
  const s = w.addStack(); s.size = new Size(width, 1); s.backgroundColor = color || C.line;
}
// 区块容器：低饱和底色 + 圆角，用来划分边界
function block(parent, accent, width) {
  const s = parent.addStack();
  s.layoutVertically();
  s.spacing = 1;
  if (width) s.size = new Size(width, 0);
  if (CONFIG.SHOW_SECTION_TINT) {
    s.backgroundColor = tint(accent, 0.085);
    s.cornerRadius = 5;
    s.setPadding(BLOCK_PAD_V, 5, BLOCK_PAD_V, 5);
  } else {
    s.setPadding(1, 0, 1, 0);
  }
  return s;
}
function strip(parent, accent, width) {
  const s = block(parent, accent, width);
  const row = s.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 4;
  return row;
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
const uvColor = uv => uv >= 8 ? C.red : uv >= 6 ? C.amber : uv >= 3 ? C.fg : C.dim;
const aqiColor = a => a == null ? C.dim : a <= 50 ? C.green : a <= 100 ? C.amber : a <= 150 ? C.red : C.purple;
// 交易时段 → 图标 / 颜色 / 标签
const SESSION_META = {
  OPEN:   { icon: "circle.fill",  color: C.green,  label: "OPEN",   fb: "●" },
  PRE:    { icon: "sunrise.fill", color: C.amber,  label: "PRE",    fb: "早" },
  POST:   { icon: "moon.fill",    color: C.purple, label: "POST",   fb: "晚" },
  CLOSED: { icon: "pause.fill",   color: C.faint,  label: "CLOSED", fb: "休" },
  "24H":  { icon: "bolt.fill",    color: C.cyan,   label: "24H",    fb: "∞" },
};
function ringsImage(b, S) {
  const ctx = new DrawContext();
  ctx.size = new Size(S, S); ctx.opaque = false; ctx.respectScreenScale = true;
  const cx = S / 2, cy = S / 2, lw = S * 0.107;
  const rings = [[b.move, b.moveGoal, C.ringMove, S * 0.43], [b.exercise, b.exerciseGoal, C.ringEx, S * 0.30], [b.stand, b.standGoal, C.ringStand, S * 0.167]];
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
// BUILD
// =====================================================================
async function build() {
  const now = new Date();
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(PAD_TOP, PAD_X, PAD_BOT, PAD_X);
  w.spacing = 2;
  w.refreshAfterDate = new Date(now.getTime() + CONFIG.REFRESH_MIN * 60000);

  const loc = await getLocation();
  const [wx, aqi, stocks, crypto, net, bridge, ev, rem, place, gmail] = await Promise.all([
    getWeather(loc.v), getAQI(loc.v), getStocks(), getCrypto(), getNet(), getBridge(), getEvents(now), getReminders(now), getPlace(loc.v), getGmail(),
  ].map(p => Promise.resolve(p).catch(e => { console.warn(e); return null; })));

  // ============ ROW 1: 日期 / 农历 / 节气 ============
  const lun = lunarOf(now), jq = jieqiAround(now);
  const r1 = strip(w, C.blue, LAY.W);
  icon(r1, "calendar", LAY.font, C.blue, "");
  txt(r1, WD[now.getDay()] + " " + pad2(now.getDate()) + " " + MON[now.getMonth()], F.bold, C.fg);
  txt(r1, "W" + isoWeek(now) + "·D" + dayOfYear(now), F.small, C.dim);
  r1.addSpacer(2);
  if (lun) {
    icon(r1, "moon.fill", LAY.font - 1.5, C.amber, "");
    txt(r1, lun.ganzhi + lun.shengxiao + " " + lun.monthName + lun.dayName, F.body, C.amber);
  }
  if (jq && jq.next) {
    const today = jq.prev && jq.prev.days === 0;
    txt(r1, today ? jq.prev.name : jq.next.name + "-" + jq.next.days + "d", F.small, today ? C.orange : C.dim);
  }
  r1.addSpacer();

  // ============ ROW 2: 天气 ============
  const r2 = strip(w, C.cyan, LAY.W);
  const W = wx && wx.v;
  if (W) {
    icon(r2, wxSymbol(W.code, W.day), LAY.font, wxColor(W.code), "");
    txt(r2, Math.round(W.t) + "°", F.bold, C.fg);
    if (Math.abs(W.feel - W.t) >= 2) txt(r2, "~" + Math.round(W.feel) + "°", F.small, C.dim);
    txt(r2, Math.round(W.tmin) + "/" + Math.round(W.tmax), F.small, C.dim);
    icon(r2, "humidity.fill", LAY.font - 2, C.blue, "H");
    txt(r2, Math.round(W.rh) + "%", F.body, C.fg);
    const uvv = W.uvmax != null ? W.uvmax : W.uv;
    icon(r2, "sun.max.fill", LAY.font - 2, uvColor(uvv), "UV");
    txt(r2, Math.round(W.uv) + (uvv != null && Math.round(uvv) > Math.round(W.uv) ? "/" + Math.round(uvv) : ""), F.body, uvColor(uvv));
    icon(r2, "umbrella.fill", LAY.font - 2, W.pop >= 50 ? C.blue : C.dim, "P");
    txt(r2, (W.pop != null ? W.pop : "--") + "%", F.body, W.pop >= 50 ? C.blue : C.fg);
    if (aqi && aqi.v && aqi.v.aqi != null) {
      icon(r2, "aqi.medium", LAY.font - 2, aqiColor(aqi.v.aqi), "AQI");
      txt(r2, String(Math.round(aqi.v.aqi)), F.body, aqiColor(aqi.v.aqi));
    }
    const ms = W.wind / 3.6;
    if (CONFIG.UNITS_METRIC ? ms >= 1 : W.wind >= 3) {
      icon(r2, "wind", LAY.font - 2, C.dim, "");
      txt(r2, compass(W.wdir) + (CONFIG.UNITS_METRIC ? Math.round(ms) : Math.round(W.wind)), F.small, W.wind >= 36 ? C.amber : C.dim);
    }
    r2.addSpacer();
    if (wx.stale) icon(r2, "exclamationmark.triangle.fill", LAY.font - 2, C.amber, "!");
  } else {
    icon(r2, "cloud.fill", LAY.font, C.dim, "");
    txt(r2, "weather unavailable", F.body, C.dim);
    r2.addSpacer();
  }

  // ============ ROW 3: 地理 / 日照 ============
  const r3 = strip(w, C.purple, LAY.W);
  const L = loc.v;
  icon(r3, "location.fill", LAY.font - 2, L.fixed ? C.faint : C.purple, "");
  txt(r3, Math.abs(L.lat).toFixed(4) + (L.lat >= 0 ? "N" : "S") + " " + Math.abs(L.lon).toFixed(4) + (L.lon >= 0 ? "E" : "W"), F.small, L.fixed ? C.dim : C.fg);
  const alt = (L.alt != null && !L.fixed) ? L.alt : (W && W.elev != null ? W.elev : null);
  if (alt != null) {
    icon(r3, "mountain.2.fill", LAY.font - 2, C.dim, "↑");
    txt(r3, Math.round(alt) + "m", F.small, C.fg);
  }
  if (place) txt(r3, place.length > 8 ? place.slice(0, 8) : place, F.body, C.purple);
  r3.addSpacer();
  if (W && W.sunrise) {
    icon(r3, "sunrise.fill", LAY.font - 2, C.amber, "");
    txt(r3, W.sunrise.slice(11, 16), F.small, C.dim);
    icon(r3, "sunset.fill", LAY.font - 2, C.orange, "");
    txt(r3, W.sunset.slice(11, 16), F.small, C.dim);
  }
  if (CONFIG.SHOW_PRESSURE && W && W.pres != null) txt(r3, Math.round(W.pres) + "hPa", F.small, C.dim);

  // ============ BODY ============
  const body = w.addStack(); body.layoutHorizontally(); body.topAlignContent(); body.spacing = LAY.gap;
  const left = body.addStack(); left.layoutVertically(); left.size = new Size(LAY.leftW, 0); left.spacing = 2;
  const right = body.addStack(); right.layoutVertically(); right.size = new Size(LAY.rightW, 0); right.spacing = 3;

  // ---- LEFT: AGENDA ----
  const E = ev || { today: [], tomorrow: [] };
  const remRows = rem || [];
  const upcoming = E.today.filter(e => !e.isAllDay && e.endDate > now);
  const nextEv = upcoming.find(e => e.startDate > now);
  const cur = upcoming.find(e => e.startDate <= now);
  const evLines = Math.min(E.today.length + Math.min(E.tomorrow.length, 3),
    Math.max(3, LAY.leftLines - 2 - Math.min(remRows.length, CONFIG.MIN_REMINDER_LINES)));
  const remLines = Math.max(0, LAY.leftLines - 2 - evLines);

  const agBlock = block(left, C.blue, LAY.leftW);
  const ah = agBlock.addStack(); ah.layoutHorizontally(); ah.centerAlignContent(); ah.spacing = 3;
  icon(ah, "calendar.day.timeline.left", LAY.font - 2.5, C.blue, "");
  txt(ah, "AGENDA", F.smallBold, C.blue);
  txt(ah, E.today.length + "·" + E.tomorrow.length, F.small, C.dim);
  ah.addSpacer();
  if (cur) { icon(ah, "play.fill", LAY.font - 3, C.green, "▶"); txt(ah, hm(cur.endDate), F.small, C.green); }
  else if (nextEv) {
    icon(ah, "arrow.right", LAY.font - 3, C.blue, "→");
    const rel = ah.addDate(nextEv.startDate); rel.applyRelativeStyle(); rel.font = F.small; rel.textColor = C.blue; rel.lineLimit = 1; rel.minimumScaleFactor = 0.7;
  } else if (!E.today.length) txt(ah, "free", F.small, C.faint);

  let shown = 0;
  const todayCount = Math.min(E.today.length, evLines);
  let todayList = E.today;
  if (todayList.length > todayCount) {
    const future = todayList.filter(e => e.endDate > now);
    todayList = future.length >= todayCount ? future : todayList.slice(todayList.length - todayCount);
  }
  const evRow = (e, prefix, dimAll) => {
    const s = agBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 4;
    const past = e.endDate <= now, ongoing = e.startDate <= now && e.endDate > now;
    const col = dimAll || past ? C.dim : ongoing ? C.green : e === nextEv ? C.blue : C.fg;
    txt(s, prefix + (e.isAllDay ? "ALL  " : hm(e.startDate)), F.body, past ? C.faint : dimAll ? C.dim : col);
    txt(s, e.title, F.body, col, { scale: 0.85 });
    s.addSpacer();
    if (!e.isAllDay) txt(s, durStr(e.endDate - e.startDate), F.small, C.faint);
    else if (e.calendar && e.calendar.title) txt(s, e.calendar.title.slice(0, 6), F.small, C.faint);
  };
  for (const e of todayList.slice(0, todayCount)) { evRow(e, ""); shown++; }
  for (const e of E.tomorrow.slice(0, evLines - shown)) { evRow(e, "+", true); shown++; }
  const hidden = E.today.length + E.tomorrow.length - shown;

  // ---- LEFT: TODO ----
  if (remLines > 0) {
    const tdBlock = block(left, C.orange, LAY.leftW);
    const rh = tdBlock.addStack(); rh.layoutHorizontally(); rh.centerAlignContent(); rh.spacing = 3;
    const overdue = remRows.filter(r => r.dueDate && r.dueDate < now).length;
    icon(rh, "checklist", LAY.font - 2.5, C.orange, "");
    txt(rh, "TODO", F.smallBold, C.orange);
    txt(rh, String(remRows.length) + (overdue ? "·" + overdue + "!" : ""), F.small, overdue ? C.red : C.dim);
    rh.addSpacer();
    if (hidden > 0) txt(rh, "+" + hidden + "ev", F.small, C.faint);
    for (const r of remRows.slice(0, remLines)) {
      const s = tdBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 4;
      const od = r.dueDate && r.dueDate < now;
      const dueToday = r.dueDate && dayStart(r.dueDate).getTime() === dayStart(now).getTime();
      const hi = r.priority > 0 && r.priority <= 4;
      icon(s, hi || od ? "exclamationmark.circle.fill" : "circle", LAY.font - 3.5, hi || od ? C.red : C.faint, hi || od ? "!" : "•");
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
    if (remRows.length > remLines) txt(tdBlock, "+" + (remRows.length - remLines) + " more", F.small, C.faint);
  }

  // ---- RIGHT: 月历 ----
  const calBlock = block(right, C.blue, LAY.rightW);
  const innerW = LAY.rightW - (CONFIG.SHOW_SECTION_TINT ? 10 : 0);
  const cellW = Math.floor(innerW / 8), cellH = LAY.font;
  const cell = (row, s, font, color, bg) => {
    const c = row.addStack(); c.size = new Size(cellW, cellH); c.centerAlignContent();
    if (bg) { c.backgroundColor = bg; c.cornerRadius = 3; }
    c.addSpacer();
    const t = c.addText(s); t.font = font; t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
    c.addSpacer();
  };
  const hdr = calBlock.addStack(); hdr.layoutHorizontally();
  const dn = CONFIG.WEEK_STARTS_MONDAY ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  cell(hdr, "wk", F.grid, C.faint);
  dn.forEach((d, i) => cell(hdr, d, F.gridBold, ((CONFIG.WEEK_STARTS_MONDAY && i >= 5) || (!CONFIG.WEEK_STARTS_MONDAY && (i === 0 || i === 6))) ? C.faint : C.blue));
  const gs = E.gridStart || (() => { const f = new Date(now.getFullYear(), now.getMonth(), 1); f.setDate(1 - ((f.getDay() + (CONFIG.WEEK_STARTS_MONDAY ? 6 : 0)) % 7)); return f; })();
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const rowsNeeded = Math.ceil((Math.round((lastOfMonth - gs) / DAY) + 1) / 7);
  for (let r = 0; r < rowsNeeded; r++) {
    const row = calBlock.addStack(); row.layoutHorizontally();
    const wkDate = new Date(gs.getTime() + r * 7 * DAY);
    const isCurWeek = isoWeek(wkDate) === isoWeek(now) && Math.abs(wkDate - now) < 8 * DAY;
    cell(row, String(isoWeek(wkDate)), F.grid, isCurWeek ? C.blue : C.faint);
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

  // ---- RIGHT: 行情 ----
  const quotes = [...((stocks && stocks.v) || []), ...((crypto && crypto.v) || [])].slice(0, CONFIG.QUOTE_ROWS);
  const mkSession = (stocks && stocks.v && stocks.v.length && stocks.v[0].session) || (quotes.length ? quotes[0].session : null);
  const mkMeta = SESSION_META[mkSession] || SESSION_META.OPEN;
  const mkBlock = block(right, mkSession === "CLOSED" ? C.faint : mkMeta.color, LAY.rightW);
  const mh = mkBlock.addStack(); mh.layoutHorizontally(); mh.centerAlignContent(); mh.spacing = 3;
  icon(mh, "chart.line.uptrend.xyaxis", LAY.font - 2.5, mkMeta.color, "");
  txt(mh, "MKT", F.smallBold, mkMeta.color);
  mh.addSpacer();
  if (mkSession) {
    icon(mh, mkMeta.icon, LAY.font - 3.5, mkMeta.color, mkMeta.fb);
    txt(mh, mkMeta.label, F.smallBold, mkMeta.color);
  }
  for (const q of quotes) {
    const meta = SESSION_META[q.session] || SESSION_META.OPEN;
    const closed = q.session === "CLOSED";
    const s = mkBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 3;
    icon(s, meta.icon, LAY.font - 4.5, meta.color, "");
    txt(s, q.sym.length > 5 ? q.sym.slice(0, 5) : q.sym, F.quoteBold, closed ? C.dim : C.fg);
    s.addSpacer();
    txt(s, fmtPrice(q.price), F.quote, closed ? C.dim : C.fg);
    const pctCol = q.pct == null ? C.dim : closed ? tint(q.pct >= 0 ? UP : DOWN, 0.75) : (q.pct >= 0 ? UP : DOWN);
    txt(s, fmtPct(q.pct), F.quoteBold, pctCol, { right: true });
    if (q.extPct != null) txt(s, (q.extPct >= 0 ? "+" : "") + q.extPct.toFixed(1), F.quote, q.extPct >= 0 ? tint(UP, 0.8) : tint(DOWN, 0.8), { right: true });
  }
  if (!quotes.length) txt(mkBlock, "no market data", F.small, C.faint);
  else if ((stocks && stocks.stale) || (crypto && crypto.stale)) txt(mkBlock, "cached " + hm(new Date(Math.max(stocks ? stocks.t || 0 : 0, crypto ? crypto.t || 0 : 0))), F.small, C.amber);

  // ---- RIGHT: 活动 ----
  if (bridge && (bridge.move != null || bridge.steps != null)) {
    const acBlock = block(right, C.ringMove, LAY.rightW);
    const rs = acBlock.addStack(); rs.layoutHorizontally(); rs.centerAlignContent(); rs.spacing = 5;
    const ringSize = Math.round(LAY.font * 3.4);
    const im = rs.addImage(ringsImage(bridge, ringSize)); im.imageSize = new Size(ringSize, ringSize);
    const col = rs.addStack(); col.layoutVertically(); col.spacing = 0;
    const dimB = bridge.stale ? C.dim : C.fg;
    const line = (label, v, goal, c) => {
      const s = col.addStack(); s.layoutHorizontally(); s.spacing = 3; s.centerAlignContent();
      txt(s, label, F.quoteBold, bridge.stale ? C.dim : c);
      txt(s, (v == null ? "--" : Math.round(v)) + "/" + goal, F.quote, dimB);
    };
    line("M", bridge.move, bridge.moveGoal, C.ringMove);
    line("E", bridge.exercise, bridge.exerciseGoal, C.ringEx);
    line("S", bridge.stand, bridge.standGoal, C.ringStand);
    if (bridge.steps != null) {
      const s = col.addStack(); s.layoutHorizontally(); s.spacing = 2; s.centerAlignContent();
      icon(s, "figure.walk", LAY.font - 4.5, dimB, "");
      txt(s, Math.round(bridge.steps).toLocaleString("en-US"), F.quote, dimB);
      if (bridge.distance != null) txt(s, bridge.distance.toFixed(1) + "km", F.quote, C.dim);
      if (bridge.stale) txt(s, "?", F.quoteBold, C.amber);
    }
  } else {
    const acBlock = block(right, C.faint, LAY.rightW);
    const s = acBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 3;
    icon(s, "figure.walk", LAY.font - 3, C.faint, "");
    txt(s, "no bridge", F.small, C.faint);
  }

  w.addSpacer();

  // ============ FOOTER 1: 公网 / VPN ============
  const f1 = strip(w, C.green, LAY.W);
  const N = net && net.v;
  if (N) {
    icon(f1, "globe", LAY.font - 2, C.green, "");
    txt(f1, N.ip, F.foot, C.fg);
    txt(f1, ispShort(N.isp) + (N.cc ? " " + N.cc : ""), F.foot, C.dim);
    const v = vpnOn(N);
    icon(f1, v === true ? "lock.shield.fill" : v === false ? "lock.open.fill" : "questionmark.circle", LAY.font - 2, v === true ? C.amber : v === false ? C.faint : C.faint, "");
    txt(f1, v === true ? "VPN ON" : v === false ? "VPN OFF" : "VPN ?", F.footBold, v === true ? C.amber : C.dim);
    if (net.stale) icon(f1, "exclamationmark.triangle.fill", LAY.font - 2.5, C.amber, "!");
  } else {
    icon(f1, "globe", LAY.font - 2, C.faint, "");
    txt(f1, "offline", F.foot, C.dim);
  }
  f1.addSpacer();
  if (gmail && gmail.v) {
    icon(f1, "envelope.fill", LAY.font - 2, gmail.v.unread ? C.blue : C.faint, "");
    txt(f1, String(gmail.v.unread), F.footBold, gmail.v.unread ? C.blue : C.dim);
  }
  icon(f1, "arrow.clockwise", LAY.font - 3, C.faint, "↻");
  txt(f1, hm(now), F.foot, C.faint, { right: true });

  // ============ FOOTER 2: 本地网络 / SIM / 闹钟 ============
  const f2 = strip(w, C.dim, LAY.W);
  const bcol = bridge && bridge.stale ? C.faint : C.dim;
  if (bridge && (bridge.ssid || bridge.lanIp)) {
    icon(f2, "wifi", LAY.font - 2, bcol, "");
    txt(f2, [bridge.ssid && bridge.ssid.slice(0, 14), bridge.lanIp].filter(Boolean).join(" "), F.foot, bcol);
  }
  if (bridge && (bridge.carrier || bridge.radio)) {
    icon(f2, "antenna.radiowaves.left.and.right", LAY.font - 2, bcol, "");
    txt(f2, [bridge.carrier && bridge.carrier.slice(0, 8), bridge.radio].filter(Boolean).join(" "), F.foot, bcol);
  }
  if (bridge && bridge.alarm) {
    icon(f2, "alarm.fill", LAY.font - 2, bridge.stale ? C.dim : C.fg, "");
    txt(f2, bridge.alarm, F.foot, bridge.stale ? C.dim : C.fg);
  }
  if (bridge && bridge.stale) txt(f2, "stale " + Math.round((now - bridge.ts) / 3600000) + "h", F.foot, C.amber);
  if (!bridge) { icon(f2, "wifi.slash", LAY.font - 2, C.faint, ""); txt(f2, "no bridge", F.foot, C.faint); }
  f2.addSpacer();

  return w;
}

// =====================================================================
const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
