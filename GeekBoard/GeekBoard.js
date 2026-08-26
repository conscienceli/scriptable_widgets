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
  SIZE_OVERRIDE: null,                       // 尺寸推算不准时手动指定，如 { w: 372, h: 364 }。量法见 README
  AGENDA_DAYS: 7,                            // 日程最多往后看几天（行数有余量时自动往后填）
  RIGHT_RATIO: 0.46,                         // 右栏占宽比例
  WEEK_STARTS_MONDAY: true,
  SHOW_ICONS: true,                          // 关掉则纯文字（更省一点，但辨识度低）
  SHOW_SECTION_TINT: true,                   // 区块底色分区
  SHOW_DAY_BAR: true,                        // 顶部一天的进度条（白昼段 + 当前时刻游标）
  SHOW_HOURLY_RAIN: true,                    // 进度条下挂一条今天逐小时降雨概率（蓝色深浅），零额外请求
  SHOW_SPARKLINES: true,                     // 股票行画两日迷你走势线（复用行情请求，零额外请求）
  SHOW_NOW_LINE: true,                       // 日程里插一条「现在」分隔线
  SHOW_WIFI: true,                           // 底栏显示 WiFi 名（需要桥接）
  SHOW_SIM: true,                            // 底栏显示数据 SIM 运营商与制式（需要桥接）
};

// =====================================================================
// DEVICE / SIZE
// =====================================================================
// 大号 Widget 的实际尺寸 Scriptable 读不到，只能从屏幕推。
// 下面两个比例是在真机截图上量出来的：430x932 的屏，Widget 深色圆角矩形占 x 89..1204、
// y 253..1411（设备像素，3x），即 372 x 386 pt。
//   372/430 = 0.8651    386/372 = 1.0384
// 量的时候务必取靠近中线的那一列/那一行——贴着边缘量会落进圆角里，两头各少算一截，
// 我第一次就是这么把高度量成 364 的。
const W_RATIO = 0.8651, H_RATIO = 1.0384;
function widgetSize() {
  const o = CONFIG.SIZE_OVERRIDE;
  if (o && o.w && o.h) return { w: o.w, h: o.h, src: "override" };
  try {
    const s = Device.screenSize();
    const sw = Math.round(Math.min(s.width, s.height));
    const w = Math.round(sw * W_RATIO);
    return { w, h: Math.round(w * H_RATIO), src: "screen:" + sw };
  } catch (e) {
    return { w: 372, h: 364, src: "fallback" };
  }
}
const WSZ = widgetSize();
const PAD_X = 11, PAD_TOP = 8, PAD_BOT = 6;
const BLOCK_PAD_V = 1;          // 区块上下内边距，直接吃掉纵向空间，改大之前先看 leftLines
const DAY_BAR_H = 9;            // 顶部进度条高度（含降雨条；SHOW_HOURLY_RAIN 关掉后自动回落）
const DAY_BAR_SUN_H = 5;
const LAY = (() => {
  const W = WSZ.w - PAD_X * 2;
  const font = Math.max(10.5, Math.min(14, W / 26.5));
  const gap = 7;
  const rightW = Math.round(W * CONFIG.RIGHT_RATIO);
  const leftW = W - rightW - gap;
  // 行距实测：字号 13.2 时相邻两行间隔 16.67pt，即 1.263 倍。取 1.27 略微保守。
  const lineH = font * 1.27;
  const blockV = (CONFIG.SHOW_SECTION_TINT ? BLOCK_PAD_V + 1 : BLOCK_PAD_V) * 2;
  const stackGap = 2;
  const stripH = lineH + blockV;                 // 顶部三个横条各自的高度
  const footH = (font - 1.5) * 1.27 + blockV;    // 底栏（只剩一行）
  const dayBarH = CONFIG.SHOW_HOURLY_RAIN ? DAY_BAR_H : DAY_BAR_SUN_H;
  const barH = CONFIG.SHOW_DAY_BAR ? dayBarH + stackGap : 0;
  // TODO 区块在不在要等数据回来才知道，所以 chrome 做成函数、渲染时再算
  const bodyH = () => WSZ.h - PAD_TOP - PAD_BOT - stripH * 3 - footH - barH - stackGap * 4;
  const linesFor = (hasTodo) =>
    Math.max(6, Math.floor((bodyH() - blockV * (hasTodo ? 2 : 1) - (hasTodo ? stackGap : 0)) / lineH));
  return { W, font, gap, rightW, leftW, lineH, blockV, stackGap, bodyH, linesFor };
})();

// =====================================================================
// THEME  —— Tokyo Night 配色，柔和而不刺眼，暗色壁纸下也不会糊成一片
// =====================================================================
const C = {
  bg0: new Color("#1B1D2B"), bg1: new Color("#12131C"),   // 背景渐变两端
  fg: new Color("#C6D0F5"), dim: new Color("#8A93B8"), faint: new Color("#4B5273"),
  blue: new Color("#7AA2F7"), cyan: new Color("#7DCFFF"), teal: new Color("#73DACA"),
  green: new Color("#9ECE6A"), red: new Color("#F7768E"), amber: new Color("#E0AF68"),
  orange: new Color("#FF9E64"), purple: new Color("#BB9AF7"), pink: new Color("#FF75A0"),
  line: new Color("#2A2E45"),
  ringMove: new Color("#F7768E"), ringEx: new Color("#9ECE6A"), ringStand: new Color("#7DCFFF"),
};
const UP = CONFIG.CN_COLOR_CONVENTION ? C.red : C.green;
const DOWN = CONFIG.CN_COLOR_CONVENTION ? C.green : C.red;
const tint = (c, a) => new Color(c.hex, a);

// 字体分工：需要竖向对齐的（时间、价格、日期格）用等宽；
// 叙述性的（事件标题、区块标签）用比例字体——同样宽度能多塞几个字，观感也软一些。
const F = {
  mono: Font.regularMonospacedSystemFont(LAY.font),
  monoBold: Font.boldMonospacedSystemFont(LAY.font),
  monoSm: Font.regularMonospacedSystemFont(LAY.font - 1.5),
  monoSmBold: Font.boldMonospacedSystemFont(LAY.font - 1.5),
  monoXs: Font.regularMonospacedSystemFont(LAY.font - 2.5),
  monoXsBold: Font.boldMonospacedSystemFont(LAY.font - 2.5),
  title: Font.systemFont(LAY.font),
  titleMed: Font.mediumSystemFont(LAY.font),
  label: Font.semiboldRoundedSystemFont(LAY.font - 2),
  labelSm: Font.semiboldRoundedSystemFont(LAY.font - 3),
  small: Font.systemFont(LAY.font - 2),
  smallMed: Font.mediumSystemFont(LAY.font - 2),
  foot: Font.mediumRoundedSystemFont(LAY.font - 1.5),
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
// 缓存里存的对象结构一变，旧缓存就会以错误的形态被渲染（例如缺 session 字段的行情被当成盘中）。
// 所以带一个 schema 版本号，对不上就当作没有缓存。改动任何被缓存对象的字段时，把这个数字 +1。
const CACHE_SCHEMA = 3;
const fm = FileManager.local();
const CACHE_DIR = fm.joinPath(fm.documentsDirectory(), "geekboard-cache");
if (!fm.fileExists(CACHE_DIR)) fm.createDirectory(CACHE_DIR, true);
function cacheRead(key) {
  const p = fm.joinPath(CACHE_DIR, key + ".json");
  if (!fm.fileExists(p)) return null;
  try {
    const c = JSON.parse(fm.readString(p));
    if (!c || c.s !== CACHE_SCHEMA) return null;   // 版本不符 → 视为无缓存，重新取
    return c;
  } catch (e) { return null; }
}
function cacheWrite(key, v) {
  fm.writeString(fm.joinPath(CACHE_DIR, key + ".json"), JSON.stringify({ s: CACHE_SCHEMA, t: Date.now(), v }));
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
    "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum" +
    "&hourly=precipitation_probability&timezone=auto&forecast_days=1" +
    (CONFIG.UNITS_METRIC ? "" : "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch");
  return await cached("wx", CONFIG.TTL.weather, async () => {
    const j = await getJSON("https://api.open-meteo.com/v1/forecast?" + q);
    const c = j.current, d = j.daily;
    return { t: c.temperature_2m, feel: c.apparent_temperature, rh: c.relative_humidity_2m, code: c.weather_code, day: c.is_day,
      wind: c.wind_speed_10m, wdir: c.wind_direction_10m, uv: c.uv_index, precip: c.precipitation, pres: c.pressure_msl,
      tmax: d.temperature_2m_max[0], tmin: d.temperature_2m_min[0], sunrise: d.sunrise[0], sunset: d.sunset[0],
      uvmax: d.uv_index_max[0], pop: d.precipitation_probability_max[0], psum: d.precipitation_sum[0], elev: j.elevation,
      hourlyPop: (j.hourly && j.hourly.precipitation_probability) || null };
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
  // 拿不到交易时段就如实说不知道。以前这里默认 OPEN，结果是休市时间照样显示绿灯。
  if (!p) return { state: "UNKNOWN", until: null };
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
  // 走势线只要形状，不要精度：降采样到 ≤32 点、5 位有效数字，别让缓存文件膨胀
  const closes = ((r.indicators && r.indicators.quote && r.indicators.quote[0]) || {}).close || [];
  const pts = closes.filter(v => v != null);
  if (pts.length > 4) {
    const n = Math.min(32, pts.length), sp = [];
    for (let i = 0; i < n; i++) sp.push(+pts[Math.round(i * (pts.length - 1) / (n - 1))].toPrecision(5));
    out.spark = sp;
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
    // 时段未知时别当成休市去缓存 2 小时，按盘中的短 TTL 尽快纠正
    if (states.some(x => !x || x === "UNKNOWN")) return CONFIG.TTL_QUOTES.OPEN;
    return CONFIG.TTL_QUOTES.CLOSED;
  };
  return await cached("stocks", ttl, async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    if (CONFIG.EXTENDED_HOURS) {
      const out = [];
      for (const s of CONFIG.STOCKS) {
        try {
          // range=2d 而不是 1d：同一个请求顺便喂饱迷你走势线，交易时段判定用的 meta 不受影响
          const j = await getJSON("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(s) +
            "?range=2d&interval=15m&includePrePost=true");
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
// 桥接文件：快捷指令的「存储文件」经常不给扩展名（存出来就叫 geekboard-bridge），
// 有的设置又会补成 .txt；Scriptable 也可能配置成本地存储而不是 iCloud。
// 所以这里把常见的位置全试一遍，而不是让人回去改文件名。
// 双卡手机上「获取蜂窝网络的运营商名称」返回的是列表，快捷指令会把它连着换行整个塞进
// 文本里，于是 JSON 字符串内部出现了真正的换行——这在 JSON 里非法，直接 parse 会失败。
// 正解是在快捷指令里加一步「从列表中获取项目」，但这里也兜一下，把串内换行折成 " / " 重试，
// 免得整个桥接因为一张副卡就全废。
function parseLoose(raw) {
  try { return JSON.parse(raw); } catch (e) { /* 继续尝试修复 */ }
  let out = "", inStr = false, esc = false, justJoined = false;
  for (const ch of String(raw)) {
    if (esc) { out += ch; esc = false; justJoined = false; continue; }
    if (ch === "\\") { out += ch; esc = true; justJoined = false; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; justJoined = false; continue; }
    if (inStr && (ch === "\n" || ch === "\r")) {
      if (!justJoined) { out += " / "; justJoined = true; }
      continue;
    }
    out += ch; justJoined = false;
  }
  try { return JSON.parse(out); } catch (e) { return null; }
}
function bridgeCandidates() {
  const base = String(CONFIG.BRIDGE_FILE || "geekboard-bridge.json");
  const bare = base.replace(/\.[^./]*$/, "");
  const names = [base, bare, bare + ".json", bare + ".txt", "GeekBoard/" + base, "GeekBoard/bridge.json"];
  return names.filter((n, i) => names.indexOf(n) === i);
}
async function getBridge() {
  const fms = [];
  try { fms.push(FileManager.iCloud()); } catch (e) { /* 没开 iCloud */ }
  try { fms.push(FileManager.local()); } catch (e) { /* ignore */ }
  let found = null, fm2 = null, badJson = false;
  for (const f of fms) {
    for (const name of bridgeCandidates()) {
      let p;
      try { p = f.joinPath(f.documentsDirectory(), name); } catch (e) { continue; }
      try { if (!f.fileExists(p)) continue; } catch (e) { continue; }
      try { await f.downloadFileFromiCloud(p); } catch (e) { /* 本地文件没有这个方法 */ }
      let raw = null;
      try { raw = f.readString(p); } catch (e) { continue; }
      const j = parseLoose(raw);
      if (j == null) { badJson = true; continue; }
      if (!j || typeof j !== "object" || !Object.keys(j).length) continue;
      found = j; fm2 = f;
      try { found.__path = p; } catch (e) { /* ignore */ }
      break;
    }
    if (found) break;
  }
  if (!found) return { status: badJson ? "badjson" : "missing" };

  const j = found;
  let ts = null;
  if (j.ts) { const d = new Date(j.ts); if (!isNaN(d.getTime())) ts = d; }
  if (!ts) { try { ts = fm2.modificationDate(j.__path); } catch (e) { ts = null; } }
  const firstOf = (v) => (v == null ? null : String(v).split(" / ")[0].trim() || null);
  const str = (v) => {
    if (v == null) return null;
    const t = String(v).trim();
    // 快捷指令没替换变量时会原样写下 "{ssid}" 这种占位符，别当成真数据显示
    if (!t || /^\{.*\}$/.test(t)) return null;
    return t;
  };
  const b = {
    status: "ok",
    move: num(j.move), moveGoal: num(j.moveGoal) || CONFIG.MOVE_GOAL,
    exercise: num(j.exercise), exerciseGoal: num(j.exerciseGoal) || CONFIG.EXERCISE_GOAL,
    stand: num(j.stand), standGoal: num(j.standGoal) || CONFIG.STAND_GOAL,
    steps: num(j.steps), distance: num(j.distance),
    ssid: str(j.ssid), lanIp: str(j.lanIp),
    // 双卡兜底拼出来的 "中国联通 / 中国移动" 塞不进底栏，截断了更难看——取第一段就好，
    // 想控制取哪张卡，回快捷指令里用「从列表中获取项目」选第一项/最后一项
    carrier: firstOf(str(j.carrier)), radio: firstOf(str(j.radio)), alarm: str(j.alarm),
    ts, stale: ts ? (Date.now() - ts.getTime()) / 3600000 > CONFIG.BRIDGE_STALE_HOURS : false,
  };
  b.hasHealth = b.move != null || b.steps != null || b.exercise != null || b.stand != null;
  return b;
}

function pickCalendars(all, include, exclude) {
  let cs = all;
  if (include && include.length) cs = cs.filter(c => include.includes(c.title));
  if (exclude && exclude.length) cs = cs.filter(c => !exclude.includes(c.title));
  return cs;
}
async function getEvents(now) {
  const cals = pickCalendars(await Calendar.forEvents(), CONFIG.CALENDARS, CONFIG.CALENDARS_EXCLUDE);
  const maxDays = Math.max(1, CONFIG.AGENDA_DAYS);
  const from = dayStart(now);
  // 一次拿够未来几天，行数有余量就继续往后填，免得清闲的一天在中间留一大块空白
  const span = await CalendarEvent.between(from, new Date(from.getTime() + (maxDays + 1) * DAY), cals);
  const byDay = [];
  for (let i = 0; i <= maxDays; i++) byDay.push([]);
  for (const e of span) {
    if (!e.title) continue;
    const off = Math.round((dayStart(e.startDate) - from) / DAY);
    byDay[Math.max(0, Math.min(maxDays, off))].push(e);
  }
  for (const d of byDay) d.sort((a, b) => a.startDate - b.startDate || a.isAllDay - b.isAllDay);

  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + (CONFIG.WEEK_STARTS_MONDAY ? 6 : 0)) % 7));
  const month = await CalendarEvent.between(gridStart, new Date(gridStart.getTime() + 42 * DAY), cals);
  const eventDays = new Set();
  for (const e of month) {
    for (let d = dayStart(e.startDate); d < e.endDate && eventDays.size < 100; d = new Date(d.getTime() + DAY)) eventDays.add(d.getMonth() + "-" + d.getDate());
  }
  const total = byDay.reduce((n, d) => n + d.length, 0);
  return { byDay, today: byDay[0], upcoming: total - byDay[0].length, eventDays, gridStart };
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
  t.font = font || F.title; t.textColor = color || C.fg; t.lineLimit = 1;
  t.minimumScaleFactor = (opts && opts.scale) != null ? opts.scale : 0.75;
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
// 区块容器：低饱和底色 + 圆角，用来划分边界
function block(parent, accent, width) {
  const s = parent.addStack();
  s.layoutVertically();
  s.spacing = 1;
  if (width) s.size = new Size(width, 0);
  if (CONFIG.SHOW_SECTION_TINT) {
    s.backgroundColor = tint(accent, 0.1);
    s.cornerRadius = 8;
    s.setPadding(BLOCK_PAD_V + 1, 6, BLOCK_PAD_V + 1, 6);
  } else {
    s.setPadding(BLOCK_PAD_V, 0, BLOCK_PAD_V, 0);
  }
  return s;
}
function strip(parent, accent, width) {
  const s = block(parent, accent, width);
  const row = s.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 4;
  return row;
}
// 小圆角标签（VPN 之类的状态用）
function pill(stack, label, fg, bg) {
  const p = stack.addStack();
  p.centerAlignContent();
  p.setPadding(1, 5, 1, 5);
  p.backgroundColor = bg;
  p.cornerRadius = 7;
  txt(p, label, F.labelSm, fg, { scale: 1 });
  return p;
}

// ---- 一天的进度条：轨道 + 白昼段 + 当前时刻游标 -------------------------
// 直接回答「现在处于一天的哪个位置」，比再写一遍时间有用。
function dayBarImage(w, h, now, sunriseStr, sunsetStr, hourlyPop) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true;
  const sunH = DAY_BAR_SUN_H, gap = 1, rainH = h - sunH - gap;
  const r = sunH / 2;
  const frac = (d) => (d.getHours() * 60 + d.getMinutes()) / 1440;
  const parseHM = (s) => {
    if (!s) return null;
    const m = String(s).match(/(\d{1,2}):(\d{2})/);
    return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) / 1440 : null;
  };
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, w, sunH), r, r);
  ctx.setFillColor(tint(C.faint, 0.4));
  ctx.addPath(track); ctx.fillPath();

  const a = parseHM(sunriseStr), b = parseHM(sunsetStr);
  if (a != null && b != null && b > a) {
    // 白昼段画成一条渐变（DrawContext 没有渐变填充，用细切片近似）
    const x0 = a * w, x1 = b * w, n = 48;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const sx = x0 + (x1 - x0) * (i / n), sw = (x1 - x0) / n + 0.6;
      // 日出橙 → 正午黄 → 日落橙
      const k = 1 - Math.abs(t - 0.5) * 2;
      const col = new Color(k > 0.5 ? C.amber.hex : C.orange.hex, 0.35 + 0.5 * k);
      ctx.setFillColor(col);
      ctx.fillRect(new Rect(sx, 0, sw, sunH));
    }
  }
  // 降雨条：同一条 0-24h 时间轴，每小时一格，蓝色深浅 = 降雨概率；已过去的小时压暗。
  // 和白昼段共用横轴的意义在于：游标一插下来，「几点下雨、离现在多久」就直接可读。
  if (rainH > 0 && hourlyPop && hourlyPop.length >= 24) {
    const cw = w / 24;
    for (let hh = 0; hh < 24; hh++) {
      const pop = num(hourlyPop[hh]);
      if (pop == null || pop < 10) continue;             // 低于 10% 不画，免得整条都是噪声
      const alpha = (0.16 + 0.74 * pop / 100) * (hh < now.getHours() ? 0.28 : 1);
      ctx.setFillColor(tint(C.blue, alpha));
      ctx.fillRect(new Rect(hh * cw + 0.4, sunH + gap, cw - 0.8, rainH));
    }
  }
  // 当前时刻：竖向贯穿两条，先用背景色挖缝再画游标，任何底色上都清晰
  const cx = Math.max(2.5, Math.min(w - 2.5, frac(now) * w));
  ctx.setFillColor(new Color(C.bg1.hex, 0.95));
  ctx.fillRect(new Rect(cx - 2.3, 0, 4.6, h));
  const cur = new Path();
  cur.addRoundedRect(new Rect(cx - 1.2, 0, 2.4, h), 1.2, 1.2);
  ctx.setFillColor(C.fg);
  ctx.addPath(cur); ctx.fillPath();
  return ctx.getImage();
}

// ---- 股票迷你走势线：两日收盘序列 + 前收虚线基准 + 端点 ----
function sparkImage(w, h, pts, prev, col) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true;
  let mn = Math.min(...pts), mx = Math.max(...pts);
  if (prev != null) { mn = Math.min(mn, prev); mx = Math.max(mx, prev); }
  if (mx - mn < 1e-9) { mn -= 1; mx += 1; }
  const X = (i) => 1 + i / (pts.length - 1) * (w - 4);
  const Y = (v) => (h - 2) - (v - mn) / (mx - mn) * (h - 4) + 1;
  if (prev != null) {
    // 前收基准虚线：线在虚线上方=红盘，下方=绿盘（或反之），比只看颜色多一层参照
    ctx.setFillColor(tint(C.faint, 0.7));
    const y = Y(prev);
    for (let x = 1; x < w - 1; x += 3.2) ctx.fillRect(new Rect(x, y - 0.4, 1.7, 0.8));
  }
  const path = new Path();
  path.addLines(pts.map((v, i) => new Point(X(i), Y(v))));
  ctx.setStrokeColor(col); ctx.setLineWidth(1.4);
  ctx.addPath(path); ctx.strokePath();
  const lx = X(pts.length - 1), ly = Y(pts[pts.length - 1]);
  ctx.setFillColor(col);
  ctx.fillEllipse(new Rect(lx - 1.7, ly - 1.7, 3.4, 3.4));
  return ctx.getImage();
}

// 月相：从农历日近似（初一朔、十五望），映射到 8 个 SF 月相符号；符号缺失时回落普通月亮
function moonSymbol(lunDay) {
  const idx = Math.round((lunDay - 1) / 29.53 * 8) % 8;
  return ["moonphase.new.moon", "moonphase.waxing.crescent", "moonphase.first.quarter", "moonphase.waxing.gibbous",
    "moonphase.full.moon", "moonphase.waning.gibbous", "moonphase.last.quarter", "moonphase.waning.crescent"][idx];
}

// ---- 「现在」分隔线：圆点 + 时刻 + 细线，插在今天已过去和还没到的日程之间 ----
function nowLineImage(w, h, timeStr, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true;
  const cy = h / 2, fs = Math.max(7, h - 3);
  ctx.setFillColor(color);
  ctx.fillEllipse(new Rect(0, cy - 2.5, 5, 5));
  ctx.setFont(Font.boldMonospacedSystemFont(fs));
  ctx.setTextColor(color);
  const textX = 8, textW = timeStr.length * fs * 0.62;
  ctx.drawText(timeStr, new Point(textX, cy - fs * 0.72));
  // 线从文字右侧开始，避免压到字
  const lx = textX + textW + 4;
  if (lx < w - 2) {
    ctx.setFillColor(tint(color, 0.45));
    ctx.fillRect(new Rect(lx, cy - 0.5, w - lx, 1));
  }
  return ctx.getImage();
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
const uvColor = uv => uv >= 8 ? C.red : uv >= 6 ? C.orange : uv >= 3 ? C.amber : C.dim;
const aqiColor = a => a == null ? C.dim : a <= 50 ? C.green : a <= 100 ? C.amber : a <= 150 ? C.orange : C.red;
// 交易时段 → 图标 / 颜色 / 标签
const SESSION_META = {
  OPEN:    { icon: "circle.fill",  color: C.green,  label: "OPEN",   fb: "●" },
  UNKNOWN: { icon: "circle",       color: C.faint,  label: "",       fb: "·" },
  PRE:     { icon: "sunrise.fill", color: C.amber,  label: "PRE",    fb: "早" },
  POST:    { icon: "moon.fill",    color: C.purple, label: "POST",   fb: "晚" },
  CLOSED:  { icon: "pause.fill",   color: C.faint,  label: "CLOSED", fb: "休" },
  "24H":   { icon: "bolt.fill",    color: C.cyan,   label: "24H",    fb: "∞" },
};
function ringsImage(b, S) {
  const ctx = new DrawContext();
  ctx.size = new Size(S, S); ctx.opaque = false; ctx.respectScreenScale = true;
  const cx = S / 2, cy = S / 2, lw = S * 0.107;
  const rings = [[b.move, b.moveGoal, C.ringMove, S * 0.43], [b.exercise, b.exerciseGoal, C.ringEx, S * 0.30], [b.stand, b.standGoal, C.ringStand, S * 0.167]];
  for (const [val, goal, col, r] of rings) {
    ctx.setLineWidth(lw);
    ctx.setStrokeColor(new Color(col.hex, 0.2));
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
  const bg = new LinearGradient();
  bg.colors = [C.bg0, C.bg1];
  bg.locations = [0, 1];
  bg.startPoint = new Point(0, 0);
  bg.endPoint = new Point(0.6, 1);
  w.backgroundGradient = bg;
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
  txt(r1, WD[now.getDay()] + " " + pad2(now.getDate()) + " " + MON[now.getMonth()], F.monoBold, C.fg);
  txt(r1, "W" + isoWeek(now) + "·D" + dayOfYear(now), F.small, C.dim);
  r1.addSpacer(2);
  if (lun) {
    if (!icon(r1, moonSymbol(lun.day), LAY.font - 2, C.amber, "")) icon(r1, "moon.fill", LAY.font - 2, C.amber, "");
    txt(r1, lun.ganzhi + lun.shengxiao + " " + lun.monthName + lun.dayName, F.title, C.amber);
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
    icon(r2, wxSymbol(W.code, W.day), LAY.font + 1, wxColor(W.code), "");
    txt(r2, Math.round(W.t) + "°", F.monoBold, C.fg);
    if (Math.abs(W.feel - W.t) >= 2) txt(r2, "~" + Math.round(W.feel) + "°", F.small, C.dim);
    txt(r2, Math.round(W.tmin) + "/" + Math.round(W.tmax), F.monoSm, C.dim);
    icon(r2, "humidity.fill", LAY.font - 2, C.cyan, "H");
    txt(r2, Math.round(W.rh) + "%", F.monoSm, C.fg);
    const uvv = W.uvmax != null ? W.uvmax : W.uv;
    icon(r2, "sun.max.fill", LAY.font - 2, uvColor(uvv), "UV");
    txt(r2, Math.round(W.uv) + (uvv != null && Math.round(uvv) > Math.round(W.uv) ? "/" + Math.round(uvv) : ""), F.monoSm, uvColor(uvv));
    icon(r2, "umbrella.fill", LAY.font - 2, W.pop >= 50 ? C.blue : C.dim, "P");
    txt(r2, (W.pop != null ? W.pop : "--") + "%", F.monoSm, W.pop >= 50 ? C.blue : C.fg);
    if (aqi && aqi.v && aqi.v.aqi != null) {
      icon(r2, "aqi.medium", LAY.font - 2, aqiColor(aqi.v.aqi), "AQI");
      txt(r2, String(Math.round(aqi.v.aqi)), F.monoSm, aqiColor(aqi.v.aqi));
    }
    const ms = W.wind / 3.6;
    if (CONFIG.UNITS_METRIC ? ms >= 1 : W.wind >= 3) {
      icon(r2, "wind", LAY.font - 2, C.dim, "");
      txt(r2, compass(W.wdir) + (CONFIG.UNITS_METRIC ? Math.round(ms) : Math.round(W.wind)), F.monoSm, W.wind >= 36 ? C.amber : C.dim);
    }
    r2.addSpacer();
    if (wx.stale) icon(r2, "exclamationmark.triangle.fill", LAY.font - 2, C.amber, "!");
  } else {
    icon(r2, "cloud.fill", LAY.font, C.dim, "");
    txt(r2, "weather unavailable", F.small, C.dim);
    r2.addSpacer();
  }

  // ============ ROW 3: 地理 / 日照 ============
  const r3 = strip(w, C.purple, LAY.W);
  const L = loc.v;
  icon(r3, "location.fill", LAY.font - 2, L.fixed ? C.faint : C.purple, "");
  txt(r3, Math.abs(L.lat).toFixed(4) + (L.lat >= 0 ? "N" : "S") + " " + Math.abs(L.lon).toFixed(4) + (L.lon >= 0 ? "E" : "W"), F.monoSm, L.fixed ? C.dim : C.fg);
  const alt = (L.alt != null && !L.fixed) ? L.alt : (W && W.elev != null ? W.elev : null);
  if (alt != null) {
    icon(r3, "mountain.2.fill", LAY.font - 2, C.dim, "↑");
    txt(r3, Math.round(alt) + "m", F.monoSm, C.fg);
  }
  if (place) txt(r3, place.length > 8 ? place.slice(0, 8) : place, F.titleMed, C.purple);
  r3.addSpacer();
  if (W && W.sunrise) {
    icon(r3, "sunrise.fill", LAY.font - 2, C.amber, "");
    txt(r3, W.sunrise.slice(11, 16), F.monoSm, C.dim);
    icon(r3, "sunset.fill", LAY.font - 2, C.orange, "");
    txt(r3, W.sunset.slice(11, 16), F.monoSm, C.dim);
  }
  if (CONFIG.SHOW_PRESSURE && W && W.pres != null) txt(r3, Math.round(W.pres) + "hPa", F.monoSm, C.dim);

  // ============ 一天的进度条 ============
  if (CONFIG.SHOW_DAY_BAR) {
    const barRow = w.addStack(); barRow.layoutHorizontally(); barRow.centerAlignContent();
    const barH2 = CONFIG.SHOW_HOURLY_RAIN ? DAY_BAR_H : DAY_BAR_SUN_H;
    const im = barRow.addImage(dayBarImage(LAY.W, barH2, now, W && W.sunrise, W && W.sunset, CONFIG.SHOW_HOURLY_RAIN && W ? W.hourlyPop : null));
    im.imageSize = new Size(LAY.W, barH2);
  }

  // ============ BODY ============
  const body = w.addStack(); body.layoutHorizontally(); body.topAlignContent(); body.spacing = LAY.gap;
  const left = body.addStack(); left.layoutVertically(); left.size = new Size(LAY.leftW, 0); left.spacing = 2;
  const right = body.addStack(); right.layoutVertically(); right.size = new Size(LAY.rightW, 0); right.spacing = 3;

  // ---- LEFT: AGENDA（按日期分组）----
  const E = ev || { byDay: [[]], today: [], upcoming: 0 };
  const remRows = rem || [];
  const byDay = E.byDay || [[]];
  const todayAll = byDay[0] || [];
  const nextEv = todayAll.find(e => !e.isAllDay && e.startDate > now)
    || byDay.slice(1).flat().find(e => !e.isAllDay);
  const cur = todayAll.find(e => !e.isAllDay && e.startDate <= now && e.endDate > now);

  const remWanted = Math.min(remRows.length, CONFIG.MIN_REMINDER_LINES);
  const hasTodo = remRows.length > 0;
  const leftLines = LAY.linesFor(hasTodo);
  const bodyH = LAY.bodyH();
  const evLines = Math.max(3, leftLines - 1 - (hasTodo ? 1 + remWanted : 0));

  const agBlock = block(left, C.blue, LAY.leftW);
  const ah = agBlock.addStack(); ah.layoutHorizontally(); ah.centerAlignContent(); ah.spacing = 4;
  icon(ah, "calendar.day.timeline.left", LAY.font - 2, C.blue, "");
  txt(ah, "AGENDA", F.label, C.blue, { scale: 1 });
  ah.addSpacer();
  if (cur) {
    icon(ah, "play.fill", LAY.font - 3, C.green, "▶");
    txt(ah, hm(cur.endDate), F.monoSm, C.green);
  } else if (nextEv) {
    icon(ah, "arrow.right", LAY.font - 3, C.blue, "→");
    const rel = ah.addDate(nextEv.startDate); rel.applyRelativeStyle(); rel.font = F.monoSm; rel.textColor = C.blue; rel.lineLimit = 1; rel.minimumScaleFactor = 0.7;
  } else if (!todayAll.length) txt(ah, "clear", F.small, C.faint);

  const innerLeftW = LAY.leftW - (CONFIG.SHOW_SECTION_TINT ? 12 : 0);
  const groupHeader = (dayOff, date) => {
    const s = agBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 4;
    const label = dayOff === 0 ? "TODAY" : dayOff === 1 ? "TOMORROW" : WD[date.getDay()];
    const col = dayOff === 0 ? C.blue : dayOff === 1 ? C.teal : C.dim;
    const dot = s.addStack(); dot.size = new Size(3, LAY.font - 3); dot.backgroundColor = col; dot.cornerRadius = 1.5;
    txt(s, label, F.labelSm, col, { scale: 1 });
    s.addSpacer();
    // 右侧只放日期：day>=2 时左边已经是星期几了，再写一遍是重复
    txt(s, md(date), F.monoXs, C.faint);
  };
  const evRow = (e, dayOff) => {
    const s = agBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 5;
    const past = dayOff === 0 && e.endDate <= now;
    const ongoing = e.startDate <= now && e.endDate > now && dayOff === 0;
    const col = past ? C.faint : ongoing ? C.green : e === nextEv ? C.blue : dayOff > 0 ? C.dim : C.fg;
    // 所属日历的真实颜色做成小圆点——工作/私人/家庭一眼分开，这颜色是系统里用户自己配的
    let calCol = (e.calendar && e.calendar.color) || C.faint;
    if (past) { try { calCol = new Color(calCol.hex, 0.35); } catch (err) { /* keep */ } }
    const dot = s.addStack(); dot.size = new Size(4, 4); dot.backgroundColor = calCol; dot.cornerRadius = 2;
    txt(s, e.isAllDay ? "ALL" : hm(e.startDate), F.monoSm, past ? C.faint : ongoing ? C.green : e === nextEv ? C.blue : C.dim);
    txt(s, e.title, F.title, col, { scale: 0.8 });
    s.addSpacer();
    if (!e.isAllDay) txt(s, durStr(e.endDate - e.startDate), F.monoXs, C.faint);
    else if (e.calendar && e.calendar.title) txt(s, e.calendar.title.slice(0, 6), F.monoXs, C.faint);
  };
  const nowLine = () => {
    const s = agBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent();
    const h = Math.max(9, LAY.font - 2);
    const im = s.addImage(nowLineImage(innerLeftW, h, hm(now), C.orange));
    im.imageSize = new Size(innerLeftW, h);
  };

  // 排版：今天在最前，「现在」线插在已过去与未到之间；行数有余量再往后铺
  let shown = 0, eventsShown = 0, nowDrawn = false;
  const totalEvents = byDay.reduce((n, d) => n + d.length, 0);
  for (let d = 0; d < byDay.length && shown < evLines; d++) {
    const list = byDay[d];
    if (!list.length) continue;
    if (shown + 1 >= evLines) break;               // 只剩一行就别单独放个组标题
    groupHeader(d, new Date(dayStart(now).getTime() + d * DAY));
    shown++;
    for (const e of list) {
      if (shown >= evLines) break;
      if (CONFIG.SHOW_NOW_LINE && d === 0 && !nowDrawn && !e.isAllDay && e.startDate > now) { nowLine(); nowDrawn = true; shown++; if (shown >= evLines) break; }
      evRow(e, d);
      shown++; eventsShown++;
    }
    // 今天的事全部已过去 → 「现在」线收在这一组末尾
    if (CONFIG.SHOW_NOW_LINE && d === 0 && !nowDrawn && shown < evLines) { nowLine(); nowDrawn = true; shown++; }
  }
  const hiddenEv = totalEvents - eventsShown;
  if (hiddenEv > 0 && shown < evLines) { txt(agBlock, "+" + hiddenEv + " more", F.small, C.faint); shown++; }
  const rendered = shown;

  // ---- LEFT: TODO ----
  if (hasTodo) {
    const remLines = Math.max(1, leftLines - 2 - rendered);
    const tdBlock = block(left, C.orange, LAY.leftW);
    const rh = tdBlock.addStack(); rh.layoutHorizontally(); rh.centerAlignContent(); rh.spacing = 4;
    const overdue = remRows.filter(r => r.dueDate && r.dueDate < now).length;
    icon(rh, "checklist", LAY.font - 2, C.orange, "");
    txt(rh, "TODO", F.label, C.orange, { scale: 1 });
    if (overdue) pill(rh, overdue + " late", C.bg1, C.red);
    rh.addSpacer();
    txt(rh, String(remRows.length), F.monoXs, C.faint);
    for (const r of remRows.slice(0, remLines)) {
      const s = tdBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 5;
      const od = r.dueDate && r.dueDate < now;
      const dueToday = r.dueDate && dayStart(r.dueDate).getTime() === dayStart(now).getTime();
      const hi = r.priority > 0 && r.priority <= 4;
      icon(s, hi || od ? "exclamationmark.circle.fill" : "circle", LAY.font - 3.5, hi || od ? C.red : C.faint, hi || od ? "!" : "•");
      txt(s, r.title, F.title, od ? C.red : dueToday ? C.fg : C.dim, { scale: 0.8 });
      s.addSpacer();
      let due = "";
      if (r.dueDate) {
        if (od) { const d = Math.floor((now - r.dueDate) / DAY); due = d >= 1 ? "-" + d + "d" : hm(r.dueDate); }
        else if (dueToday) due = r.dueDateIncludesTime ? hm(r.dueDate) : "today";
        else due = md(r.dueDate);
      }
      if (due) txt(s, due, F.monoXs, od ? C.red : C.faint);
    }
    if (remRows.length > remLines) txt(tdBlock, "+" + (remRows.length - remLines) + " more", F.small, C.faint);
  }

  // ---- RIGHT: 月历 ----
  const gsPre = E.gridStart || (() => { const f = new Date(now.getFullYear(), now.getMonth(), 1); f.setDate(1 - ((f.getDay() + (CONFIG.WEEK_STARTS_MONDAY ? 6 : 0)) % 7)); return f; })();
  const calRows = 1 + Math.ceil((Math.round((new Date(now.getFullYear(), now.getMonth() + 1, 0) - gsPre) / DAY) + 1) / 7);
  const quotesPre = [...((stocks && stocks.v) || []), ...((crypto && crypto.v) || [])].slice(0, CONFIG.QUOTE_ROWS);
  const innerW = LAY.rightW - (CONFIG.SHOW_SECTION_TINT ? 12 : 0);
  const cellW = Math.floor(innerW / 8);
  const qRowH = (LAY.font - 2.5) * 1.32;
  const hdrRowH = (LAY.font - 1.5) * 1.32;
  const bridgeOk = !!(bridge && bridge.status === "ok");
  const actRows = (bridge && bridge.hasHealth) ? 4 : 1;
  const rightPad = (CONFIG.SHOW_SECTION_TINT ? (BLOCK_PAD_V + 1) * 6 : 0) + 6 + 8;
  const calRowH = (f) => f * 1.27 + 2;
  let qShown = quotesPre.length, gridFont = 0;
  for (;;) {
    const avail = bodyH - rightPad - hdrRowH - qShown * qRowH - actRows * qRowH;
    gridFont = Math.min(LAY.font, (avail / calRows - 2) / 1.27);
    if (gridFont >= 7.5 || qShown <= 2) break;
    qShown--;
  }
  const gridFontMaxW = (cellW - 3) / (0.62 * 2);
  gridFont = Math.max(7.5, Math.min(gridFont, gridFontMaxW));
  const FG = { grid: Font.regularMonospacedSystemFont(gridFont), gridBold: Font.boldMonospacedSystemFont(gridFont) };

  const calBlock = block(right, C.blue, LAY.rightW);
  // 月历格子：列宽写死、格子里绝不放 spacer，文字禁止缩放。踩过的两个坑见 README。
  const pad2c = (v) => { const t = String(v); return t.length >= 2 ? t : " " + t; };
  const gridGap = Math.max(0, (innerW - cellW * 8) / 7);
  const cell = (row, s, font, color, bg) => {
    const c = row.addStack();
    c.size = new Size(cellW, 0);
    c.centerAlignContent();
    if (bg) { c.backgroundColor = bg; c.cornerRadius = 4; }
    const t = c.addText(pad2c(s));
    t.font = font; t.textColor = color; t.lineLimit = 1;
    t.minimumScaleFactor = 1;
  };
  const hdr = calBlock.addStack(); hdr.layoutHorizontally(); hdr.spacing = gridGap;
  const dn = CONFIG.WEEK_STARTS_MONDAY ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  cell(hdr, "wk", FG.grid, C.faint);
  dn.forEach((d, i) => cell(hdr, d, FG.gridBold, ((CONFIG.WEEK_STARTS_MONDAY && i >= 5) || (!CONFIG.WEEK_STARTS_MONDAY && (i === 0 || i === 6))) ? C.faint : C.blue));
  const gs = gsPre;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const rowsNeeded = Math.ceil((Math.round((lastOfMonth - gs) / DAY) + 1) / 7);
  for (let r = 0; r < rowsNeeded; r++) {
    const row = calBlock.addStack(); row.layoutHorizontally(); row.spacing = gridGap;
    const wkDate = new Date(gs.getTime() + r * 7 * DAY);
    const isCurWeek = isoWeek(wkDate) === isoWeek(now) && Math.abs(wkDate - now) < 8 * DAY;
    cell(row, String(isoWeek(wkDate)), FG.grid, isCurWeek ? C.blue : C.faint);
    for (let i = 0; i < 7; i++) {
      const d = new Date(gs.getTime() + (r * 7 + i) * DAY);
      const inMonth = d.getMonth() === now.getMonth();
      const isToday = d.getDate() === now.getDate() && inMonth;
      const wkend = CONFIG.WEEK_STARTS_MONDAY ? i >= 5 : (i === 0 || i === 6);
      const has = E.eventDays && E.eventDays.has(d.getMonth() + "-" + d.getDate());
      let col = !inMonth ? C.faint : wkend ? C.dim : C.fg;
      if (isToday) cell(row, String(d.getDate()), FG.gridBold, C.bg1, C.blue);
      else if (has && inMonth) cell(row, String(d.getDate()), FG.gridBold, C.blue, tint(C.blue, 0.16));
      else cell(row, String(d.getDate()), FG.grid, col);
    }
  }

  // ---- RIGHT: 行情 ----
  const quotes = quotesPre.slice(0, qShown);
  const mkSession = (stocks && stocks.v && stocks.v.length && stocks.v[0].session) || (quotes.length ? quotes[0].session : null);
  const mkMeta = SESSION_META[mkSession] || SESSION_META.UNKNOWN;
  const mkBlock = block(right, mkSession === "CLOSED" ? C.faint : mkMeta.color, LAY.rightW);
  const mh = mkBlock.addStack(); mh.layoutHorizontally(); mh.centerAlignContent(); mh.spacing = 4;
  icon(mh, "chart.line.uptrend.xyaxis", LAY.font - 2, mkMeta.color, "");
  txt(mh, "MKT", F.label, mkMeta.color, { scale: 1 });
  mh.addSpacer();
  if (mkSession && mkMeta.label) txt(mh, mkMeta.label, F.labelSm, mkMeta.color, { scale: 1 });
  const qCharW = (LAY.font - 2.5) * 0.62;
  for (const q of quotes) {
    const meta = SESSION_META[q.session] || SESSION_META.UNKNOWN;
    const closed = q.session === "CLOSED";
    const s = mkBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 3;
    const pctCol = q.pct == null ? C.dim : closed ? tint(q.pct >= 0 ? UP : DOWN, 0.75) : (q.pct >= 0 ? UP : DOWN);
    // 走势线只在真放得下的时候画（按实际字符数算宽度，最少 14pt）；
    // 塞不下——典型是盘后行还带一个盘后变动——就回落时段小图标，那个图标本身也是信息。
    // 绝不靠把文字缩小来硬塞。
    const extStr = q.extPct != null ? (q.extPct >= 0 ? "+" : "") + q.extPct.toFixed(1) : "";
    const usedW = (Math.min(q.sym.length, 5) + fmtPrice(q.price).length + fmtPct(q.pct).length + extStr.length) * qCharW
      + 3 * (extStr ? 5 : 4);
    const sw = Math.min(34, innerW - usedW);
    if (CONFIG.SHOW_SPARKLINES && q.spark && q.spark.length > 3 && sw >= 14) {
      const im = s.addImage(sparkImage(sw, 11, q.spark, q.prev, pctCol));
      im.imageSize = new Size(sw, 11);
    } else {
      icon(s, meta.icon, LAY.font - 4.5, meta.color, "");
    }
    txt(s, q.sym.length > 5 ? q.sym.slice(0, 5) : q.sym, F.monoXsBold, closed ? C.dim : C.fg);
    s.addSpacer();
    txt(s, fmtPrice(q.price), F.monoXs, closed ? C.dim : C.fg);
    txt(s, fmtPct(q.pct), F.monoXsBold, pctCol, { right: true });
    if (q.extPct != null) txt(s, (q.extPct >= 0 ? "+" : "") + q.extPct.toFixed(1), F.monoXs, q.extPct >= 0 ? tint(UP, 0.8) : tint(DOWN, 0.8), { right: true });
  }
  if (!quotes.length) txt(mkBlock, "no market data", F.small, C.faint);
  else if ((stocks && stocks.stale) || (crypto && crypto.stale)) txt(mkBlock, "cached " + hm(new Date(Math.max(stocks ? stocks.t || 0 : 0, crypto ? crypto.t || 0 : 0))), F.small, C.amber);

  // ---- RIGHT: 活动 ----
  if (bridge && bridge.hasHealth) {
    const acBlock = block(right, C.ringMove, LAY.rightW);
    const rs = acBlock.addStack(); rs.layoutHorizontally(); rs.centerAlignContent(); rs.spacing = 6;
    const ringSize = Math.round(LAY.font * 3.4);
    const im = rs.addImage(ringsImage(bridge, ringSize)); im.imageSize = new Size(ringSize, ringSize);
    const col = rs.addStack(); col.layoutVertically(); col.spacing = 0;
    const dimB = bridge.stale ? C.dim : C.fg;
    const line = (label, v, goal, c) => {
      const s = col.addStack(); s.layoutHorizontally(); s.spacing = 3; s.centerAlignContent();
      txt(s, label, F.monoXsBold, bridge.stale ? C.dim : c);
      txt(s, (v == null ? "--" : Math.round(v)) + "/" + goal, F.monoXs, dimB);
    };
    line("M", bridge.move, bridge.moveGoal, C.ringMove);
    line("E", bridge.exercise, bridge.exerciseGoal, C.ringEx);
    line("S", bridge.stand, bridge.standGoal, C.ringStand);
    if (bridge.steps != null) {
      const s = col.addStack(); s.layoutHorizontally(); s.spacing = 3; s.centerAlignContent();
      icon(s, "figure.walk", LAY.font - 4.5, dimB, "");
      txt(s, Math.round(bridge.steps).toLocaleString("en-US"), F.monoXs, dimB);
      if (bridge.distance != null) txt(s, bridge.distance.toFixed(1) + "km", F.monoXs, C.dim);
      if (bridge.stale) txt(s, "?", F.monoXsBold, C.amber);
    }
  } else {
    // 分清楚是「文件没找到」「JSON 坏了」还是「文件读到了但没有健康数据」——
    // 以前一律显示 no bridge，害人排查半天
    const msg = !bridge || bridge.status === "missing" ? "no bridge file"
      : bridge.status === "badjson" ? "bridge: bad JSON"
      : "bridge ok · no health";
    const acBlock = block(right, C.faint, LAY.rightW);
    const s = acBlock.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = 4;
    icon(s, bridge && bridge.status === "badjson" ? "exclamationmark.triangle.fill" : "figure.walk", LAY.font - 3, bridge && bridge.status === "badjson" ? C.amber : C.faint, "");
    txt(s, msg, F.small, bridge && bridge.status === "badjson" ? C.amber : C.faint, { scale: 0.7 });
  }

  w.addSpacer();

  // ============ FOOTER：只留 VPN 状态，公网 IP / 运营商 / WiFi 名 / 内网 IP 都去掉 ============
  const f1 = strip(w, C.green, LAY.W);
  const N = net && net.v;
  const v = vpnOn(N);
  icon(f1, v === true ? "lock.shield.fill" : v === false ? "lock.open.fill" : "questionmark.circle", LAY.font - 1, v === true ? C.green : v === false ? C.faint : C.faint, "");
  if (v === true) pill(f1, "VPN ON", C.bg1, C.green);
  else txt(f1, v === false ? "VPN OFF" : "VPN ?", F.foot, C.dim, { scale: 1 });
  if (net && net.stale && N) icon(f1, "exclamationmark.triangle.fill", LAY.font - 2.5, C.amber, "!");
  if (CONFIG.SHOW_WIFI && bridgeOk && bridge.ssid) {
    f1.addSpacer(6);
    icon(f1, "wifi", LAY.font - 2, bridge.stale ? C.faint : C.cyan, "");
    txt(f1, bridge.ssid.slice(0, 14), F.foot, bridge.stale ? C.faint : C.dim);
  }
  if (CONFIG.SHOW_SIM && bridgeOk && (bridge.carrier || bridge.radio)) {
    f1.addSpacer(6);
    icon(f1, "antenna.radiowaves.left.and.right", LAY.font - 2, bridge.stale ? C.faint : C.dim, "");
    txt(f1, [bridge.carrier && bridge.carrier.slice(0, 8), bridge.radio].filter(Boolean).join(" "), F.foot, bridge.stale ? C.faint : C.dim);
  }
  if (bridgeOk && bridge.alarm) {
    f1.addSpacer(6);
    icon(f1, "alarm.fill", LAY.font - 2, bridge.stale ? C.dim : C.amber, "");
    txt(f1, bridge.alarm, F.foot, bridge.stale ? C.dim : C.fg);
  }
  f1.addSpacer();
  if (gmail && gmail.v) {
    icon(f1, "envelope.fill", LAY.font - 2, gmail.v.unread ? C.blue : C.faint, "");
    txt(f1, String(gmail.v.unread), F.foot, gmail.v.unread ? C.blue : C.dim);
  }
  icon(f1, "arrow.clockwise", LAY.font - 3, C.faint, "↻");
  txt(f1, hm(now), F.foot, C.faint, { right: true });

  return w;
}

// =====================================================================
const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
