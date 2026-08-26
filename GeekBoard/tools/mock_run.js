// Node harness: mocks the Scriptable runtime, runs GeekBoard.js, prints the widget tree.
//
//   node tools/mock_run.js
//
// Env switches, for exercising the paths that are hard to reproduce on-device:
//   SESSION=OPEN|PRE|POST|CLOSED   market session for the mocked stock data
//   SCREEN=393x852                 pretend to be a specific iPhone
//   OFFLINE=1                      every network request throws
//   NOLOC=1                        location permission denied
//   EMPTY=1                        no calendar events / reminders
//   LIGHT=1                        a light day: few events, zero reminders (reproduces the empty-gap bug)
//   NOPERIOD=1                     Yahoo omits currentTradingPeriod (session must read UNKNOWN, not OPEN)
//   STALECACHE=1                   seed the cache with the OLD schema (must be discarded, not rendered)
//   BRIDGE=0                       no Shortcuts bridge file   BRIDGE=stale  bridge file is old
//   NOSYM=1                        SFSymbol.named returns null (tests the text fallbacks)
//   CACHE=/tmp/gbcache.json        persist the mocked cache between runs, so TTL behaviour is testable
//   SKEW=25                        advance the mocked clock by N minutes (use with CACHE to test TTL expiry)
//   VERBOSE=1                      print console.warn output
const fs = require("fs");
const SKEW_MIN = Number(process.env.SKEW || 0);
const NOW = new Date(new Date(2026, 7, 25, 14, 32).getTime() + SKEW_MIN * 60000); // Tue 25 Aug 2026 14:32 local
const RealDate = Date;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) return new RealDate(NOW.getTime()); super(...a); } static now() { return NOW.getTime(); } }
global.Date = FakeDate;

class Color { constructor(hex, a) { this.hex = hex; this.alpha = a == null ? 1 : a; } }
class Font {
  static regularMonospacedSystemFont(s) { return { n: "mono", s }; }
  static boldMonospacedSystemFont(s) { return { n: "monoB", s }; }
  static systemFont(s) { return { n: "sys", s }; }
  static mediumSystemFont(s) { return { n: "sysM", s }; }
  static semiboldSystemFont(s) { return { n: "sysSB", s }; }
  static boldSystemFont(s) { return { n: "sysB", s }; }
  static semiboldRoundedSystemFont(s) { return { n: "rndSB", s }; }
  static mediumRoundedSystemFont(s) { return { n: "rndM", s }; }
  static boldRoundedSystemFont(s) { return { n: "rndB", s }; }
}
class Size { constructor(w, h) { this.width = w; this.height = h; } }
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }); } }
class Path { addLines(p) { this.pts = p; } addRoundedRect() {} addRect() {} }
class DrawContext {
  constructor() { this.ops = []; }
  setLineWidth() {} setStrokeColor() {} setFillColor() {} setFont() {} setTextColor() {}
  strokeEllipse() { this.ops.push("ell"); } fillEllipse() { this.ops.push("fill-ell"); }
  fillRect() { this.ops.push("fill-rect"); } drawText(t) { this.ops.push("text:" + t); }
  addPath() {} strokePath() { this.ops.push("arc"); } fillPath() { this.ops.push("fill-path"); }
  getImage() { return { img: this.ops.some(o => String(o).startsWith("text:")) ? "nowline" : (this.size && this.size.width === this.size.height ? "rings" : "daybar") }; }
}
// A few symbols only exist on newer iOS; the script must fall back rather than crash.
const MISSING_SYMBOLS = new Set(["aqi.medium", "checklist", "calendar.day.timeline.left", "mountain.2.fill"]);
class SFSymbol {
  static named(n) {
    if (process.env.NOSYM) return null;
    if (MISSING_SYMBOLS.has(n)) return null;
    return { name: n, applyFont() {}, image: { img: n } };
  }
}
// unref so a pending timeout never keeps the harness alive after rendering finishes
class Timer { static schedule(ms, rep, cb) { const t = setTimeout(cb, ms); if (t.unref) t.unref(); return t; } }
class WidgetText { constructor(t) { this.text = t; this.kind = "text"; } leftAlignText() {} rightAlignText() { this.right = true; } }
class WidgetDate { constructor(d) { this.date = d; this.kind = "date"; } applyTimeStyle() { this.style = "time"; } applyRelativeStyle() { this.style = "rel"; } }
class WidgetImage { constructor(i) { this.image = i; this.kind = "image"; } }
class Stack {
  constructor() { this.items = []; this.kind = "stack"; this.dir = "h"; }
  layoutHorizontally() { this.dir = "h"; } layoutVertically() { this.dir = "v"; }
  centerAlignContent() {} topAlignContent() {} bottomAlignContent() {} setPadding() {}
  addStack() { const s = new Stack(); this.items.push(s); return s; }
  addText(t) { const x = new WidgetText(t); this.items.push(x); return x; }
  addDate(d) { const x = new WidgetDate(d); this.items.push(x); return x; }
  addImage(i) { const x = new WidgetImage(i); this.items.push(x); return x; }
  addSpacer(n) { this.items.push({ kind: "spacer", n }); }
}
class LinearGradient { }
class ListWidget extends Stack { constructor() { super(); this.dir = "v"; } presentLarge() { return Promise.resolve(); } }
const CACHE_FILE = process.env.CACHE;
const files = (CACHE_FILE && fs.existsSync(CACHE_FILE)) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
if (process.env.STALECACHE) {
  // exactly what the previous release wrote: no schema tag, quote objects with no `session`
  const old = (v) => JSON.stringify({ t: NOW.getTime(), v });
  files["/local/geekboard-cache/stocks.json"] = old([
    { sym: "AAPL", price: 309.9, pct: -0.14, cur: "USD" },
    { sym: "NVDA", price: 213.05, pct: 2.19, cur: "USD" },
  ]);
  files["/local/geekboard-cache/crypto.json"] = old([{ sym: "BTC", price: 78904, pct: -2.04 }]);
}
const fmLocal = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/local", fileExists: p => p in files || p === "/local/geekboard-cache", createDirectory() {}, readString: p => files[p], writeString: (p, s) => { files[p] = s; } };
const bridgeAgeH = process.env.BRIDGE === "stale" ? 9 : 0.7;
const fmIcloud = Object.assign({}, fmLocal, { documentsDirectory: () => "/icloud", downloadFileFromiCloud: async () => {}, modificationDate: () => new RealDate(NOW.getTime() - bridgeAgeH * 3600000) });
files["/icloud/geekboard-bridge.json"] = JSON.stringify(process.env.BRIDGE === "0" ? {} : {
  move: "412 kcal", exercise: 22, stand: 8, steps: "6,842", distance: "4.92 km",
  ssid: "HomeNet-5G", lanIp: "192.168.1.23", carrier: "KDDI", radio: "5G", alarm: "06:30",
});
class FileManager { static local() { return fmLocal; } static iCloud() { return fmIcloud; } }

// ---- market session windows, in epoch seconds relative to the mocked "now" ----
const nowSec = Math.floor(NOW.getTime() / 1000);
const SESSION = process.env.SESSION || "OPEN";
function tradingPeriod() {
  const H = 3600;
  switch (SESSION) {
    case "PRE":    return { pre: { start: nowSec - H, end: nowSec + 2 * H }, regular: { start: nowSec + 2 * H, end: nowSec + 8 * H }, post: { start: nowSec + 8 * H, end: nowSec + 12 * H } };
    case "POST":   return { pre: { start: nowSec - 12 * H, end: nowSec - 9 * H }, regular: { start: nowSec - 9 * H, end: nowSec - H }, post: { start: nowSec - H, end: nowSec + 3 * H } };
    case "CLOSED": return { pre: { start: nowSec + 10 * H, end: nowSec + 12 * H }, regular: { start: nowSec + 12 * H, end: nowSec + 18 * H }, post: { start: nowSec + 18 * H, end: nowSec + 22 * H } };
    default:       return { pre: { start: nowSec - 4 * H, end: nowSec - H }, regular: { start: nowSec - H, end: nowSec + 5 * H }, post: { start: nowSec + 5 * H, end: nowSec + 9 * H } };
  }
}
const STOCK_DATA = { AAPL: [232.14, 229.31, 231.80], NVDA: [181.60, 184.20, 182.95], TSLA: [351.20, 340.00, 349.05] };
function chartResponse(sym) {
  const [reg, prev, ext] = STOCK_DATA[sym] || [100, 100, 100];
  const cp = tradingPeriod();
  const win = SESSION === "PRE" ? cp.pre : SESSION === "POST" ? cp.post : cp.regular;
  return {
    chart: { result: [{
      meta: Object.assign(
        { symbol: sym, currency: "USD", regularMarketPrice: reg, previousClose: prev, chartPreviousClose: prev },
        process.env.NOPERIOD ? {} : { currentTradingPeriod: cp }),
      timestamp: [win.start + 60, nowSec - 120],
      indicators: { quote: [{ close: [null, (SESSION === "PRE" || SESSION === "POST") ? ext : reg] }] },
    }] },
  };
}
const RESP = {
  "api.open-meteo.com": { elevation: 41, current: { temperature_2m: 31.4, relative_humidity_2m: 68, apparent_temperature: 34.2, weather_code: 2, wind_speed_10m: 11.5, wind_direction_10m: 140, uv_index: 6.8, precipitation: 0, is_day: 1, pressure_msl: 1012.6 }, daily: { temperature_2m_max: [33.1], temperature_2m_min: [26.2], sunrise: ["2026-08-25T05:07"], sunset: ["2026-08-25T18:22"], uv_index_max: [8.9], precipitation_probability_max: [10], precipitation_sum: [0] } },
  "air-quality-api.open-meteo.com": { current: { us_aqi: 42, pm2_5: 9.1 } },
  "api.binance.com": [{ symbol: "BTCUSDT", lastPrice: "112340.55", priceChangePercent: "-0.83" }, { symbol: "ETHUSDT", lastPrice: "4312.10", priceChangePercent: "2.15" }],
  "ip-api.com": { status: "success", query: "203.0.113.5", isp: "KDDI CORPORATION", org: "au", as: "AS2516 KDDI", countryCode: "JP", proxy: false, hosting: process.env.VPN === "1" },
};
let requestCount = 0;
class Request {
  constructor(u) { this.url = u; }
  async loadJSON() {
    if (process.env.OFFLINE) throw new Error("offline");
    requestCount++;
    const host = this.url.split("/")[2];
    if (host === "query1.finance.yahoo.com") {
      const m = this.url.match(/\/chart\/([^?]+)/);
      if (m) return chartResponse(decodeURIComponent(m[1]));
      throw new Error("spark not mocked (extended-hours path should not need it)");
    }
    if (!(host in RESP)) throw new Error("no mock for " + host);
    return RESP[host];
  }
}
class Location {
  static setAccuracyToKilometer() {}
  static async current() { if (process.env.NOLOC) throw new Error("denied"); return { latitude: 35.6812, longitude: 139.7671, altitude: 41.3 }; }
  static async reverseGeocode() { return [{ subLocality: "丸の内", locality: "千代田区" }]; }
}
class Device {
  static batteryLevel() { return 0.84; }
  static isCharging() { return false; }
  static screenSize() {
    const [w, h] = (process.env.SCREEN || "430x932").split("x").map(Number);
    return { width: w, height: h };
  }
}
const cal = t => ({ title: t });
const CALS = [cal("Work"), cal("Personal"), cal("Birthdays")];
const ev = (title, h, m, dur, all, c) => ({ title, startDate: new RealDate(2026, 7, 25, h, m), endDate: new RealDate(2026, 7, 25, h, m + dur), isAllDay: !!all, calendar: c || CALS[0] });
const evT = (title, h, m, dur) => ({ title, startDate: new RealDate(2026, 7, 26, h, m), endDate: new RealDate(2026, 7, 26, h, m + dur), isAllDay: false, calendar: CALS[0] });
class Calendar { static async forEvents() { return CALS; } static async forReminders() { return [cal("Todo"), cal("Shopping")]; } }
const evD = (title, dayOff, h, m, dur, all) => ({
  title,
  startDate: new RealDate(2026, 7, 25 + dayOff, h, m),
  endDate: new RealDate(2026, 7, 25 + dayOff, h, m + dur),
  isAllDay: !!all, calendar: CALS[0],
});
const FULL_DAY = [
  ev("Standup", 9, 30, 30), ev("Design review w/ platform team", 11, 0, 60),
  ev("Deploy freeze", 0, 0, 0, true, CALS[1]), ev("1:1 Kenji", 14, 0, 45),
  ev("Dentist", 16, 30, 60), ev("Dinner @ Ginza", 19, 0, 120), ev("Late sync", 21, 0, 30),
];
const LIGHT_DAY = [ev("还款日 中国银行", 0, 0, 0, true, CALS[1]), ev("morning standup", 9, 30, 30), ev("TAI Lab 组会", 13, 0, 60)];
const AHEAD = [
  evD("Board prep", 1, 8, 0, 60), evD("Flight HND-SFO", 1, 10, 15, 600),
  evD("中元节", 1, 0, 0, 0, true), evD("Quarterly review", 2, 10, 0, 90),
  evD("Team offsite", 3, 9, 0, 480), evD("Dentist follow-up", 4, 15, 0, 30),
  evD("Visa appointment", 5, 11, 0, 60), evD("Parents visiting", 6, 18, 0, 120),
];
class CalendarEvent {
  // the widget now pulls the whole agenda window through between()
  static async between(from, to) {
    if (process.env.EMPTY) return [];
    const base = process.env.LIGHT ? LIGHT_DAY : FULL_DAY;
    const all = [...base, ...AHEAD];
    return all.filter(e => e.startDate >= from && e.startDate < to);
  }
}
const rm = (title, due, pr, t) => ({ title, dueDate: due, priority: pr || 0, dueDateIncludesTime: !!t, calendar: cal("Todo") });
class Reminder {
  static async allIncomplete() { return (process.env.EMPTY || process.env.LIGHT) ? [] : [rm("Renew passport", new RealDate(2026, 7, 28)), rm("Pay rent", new RealDate(2026, 7, 23), 1), rm("Call bank", new RealDate(2026, 7, 25, 17, 0), 0, true), rm("Buy milk", new RealDate(2026, 7, 26)), rm("Far away", new RealDate(2026, 8, 20))]; }
}
class Script { static setWidget(w) { global.__widget = w; } static complete() {} }
const config = { runsInWidget: true };
Object.assign(global, { Color, Font, Size, Point, Rect, Path, DrawContext, LinearGradient, SFSymbol, Timer, ListWidget, FileManager, Request, Location, Device, Calendar, CalendarEvent, Reminder, Script, config });
console.warn = (...a) => { if (process.env.VERBOSE) console.error("WARN", ...a); };

const src = fs.readFileSync(__dirname + "/../GeekBoard.js", "utf8");
(async () => {
  await (new (Object.getPrototypeOf(async function () {}).constructor)(src))();
  const w = global.__widget;
  const inline = i => {
    if (i.kind === "text") return i.text;
    if (i.kind === "date") return i.style === "time" ? "[" + i.date.getHours() + ":" + String(i.date.getMinutes()).padStart(2, "0") + "]" : "[in " + Math.round((i.date - NOW) / 60000) + "m]";
    if (i.kind === "image") return "<" + i.image.img + ">";
    if (i.kind === "spacer") return i.n ? "" : "…";
    if (i.kind === "stack") return i.dir === "h" ? i.items.map(inline).filter(Boolean).join(" ") : "{" + i.items.map(inline).filter(Boolean).join(" | ") + "}";
    return "";
  };
  const render = (s, ind) => {
    if (s.kind !== "stack") { console.log(ind + inline(s)); return; }
    if (s.dir === "h") { const t = s.items.map(inline).filter(Boolean).join(" "); if (t.trim()) console.log(ind + t); return; }
    s.items.forEach(i => (i.kind === "stack" ? render(i, ind) : (inline(i).trim() && console.log(ind + inline(i)))));
  };
  render(w, "");
  if (CACHE_FILE) fs.writeFileSync(CACHE_FILE, JSON.stringify(files));
  console.error(`\n[mock] screen=${process.env.SCREEN || "430x932"} session=${SESSION} network requests=${requestCount}`);
  process.exit(0);
})().catch(e => { console.error("RUN ERROR:", e); process.exit(1); });
