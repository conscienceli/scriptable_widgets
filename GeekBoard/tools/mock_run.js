// Node harness: mocks the Scriptable runtime, runs GeekBoard.js, prints the widget tree.
const fs = require("fs");
const NOW = new Date(2026, 7, 25, 14, 32); // Tue 25 Aug 2026 14:32 local
const RealDate = Date;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) return new RealDate(NOW.getTime()); super(...a); } static now() { return NOW.getTime(); } }
global.Date = FakeDate;

class Color { constructor(hex, a) { this.hex = hex; this.alpha = a == null ? 1 : a; } }
class Font { static regularMonospacedSystemFont(s) { return { n: "mono", s }; } static boldMonospacedSystemFont(s) { return { n: "monoB", s }; } static systemFont(s) { return { n: "sys", s }; } }
class Size { constructor(w, h) { this.width = w; this.height = h; } }
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }); } }
class Path { addLines(p) { this.pts = p; } }
class DrawContext { constructor() { this.ops = []; } setLineWidth() {} setStrokeColor() {} strokeEllipse() { this.ops.push("ell"); } addPath() {} strokePath() { this.ops.push("arc"); } getImage() { return { img: "rings", ops: this.ops.length }; } }
class SFSymbol { static named(n) { return { name: n, applyFont() {}, image: { img: n } }; } }
class Timer { static schedule(ms, rep, cb) { return setTimeout(cb, ms); } }
const CUR_ITEMS = [];
class WidgetText { constructor(t) { this.text = t; this.kind = "text"; } leftAlignText() {} rightAlignText() { this.right = true; } }
class WidgetDate { constructor(d) { this.date = d; this.kind = "date"; } applyTimeStyle() { this.style = "time"; } applyRelativeStyle() { this.style = "rel"; } }
class WidgetImage { constructor(i) { this.image = i; this.kind = "image"; } }
class Stack {
  constructor() { this.items = []; this.kind = "stack"; this.dir = "h"; }
  layoutHorizontally() { this.dir = "h"; } layoutVertically() { this.dir = "v"; }
  centerAlignContent() {} topAlignContent() {} bottomAlignContent() {}
  addStack() { const s = new Stack(); this.items.push(s); return s; }
  addText(t) { const x = new WidgetText(t); this.items.push(x); return x; }
  addDate(d) { const x = new WidgetDate(d); this.items.push(x); return x; }
  addImage(i) { const x = new WidgetImage(i); this.items.push(x); return x; }
  addSpacer(n) { this.items.push({ kind: "spacer", n }); }
}
class ListWidget extends Stack { constructor() { super(); this.dir = "v"; } setPadding() {} presentLarge() { return Promise.resolve(); } }
const files = {};
const fmLocal = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/local", fileExists: p => p in files || p === "/local/geekboard-cache", createDirectory() {}, readString: p => files[p], writeString: (p, s) => { files[p] = s; } };
const fmIcloud = Object.assign({}, fmLocal, { documentsDirectory: () => "/icloud", downloadFileFromiCloud: async () => {}, modificationDate: () => new RealDate(NOW.getTime() - 40 * 60000) });
files["/icloud/geekboard-bridge.json"] = JSON.stringify(process.env.BRIDGE === "0" ? {} : { move: "412 kcal", exercise: 22, stand: 8, steps: "6,842", distance: "4.92 km", ssid: "HomeNet-5G", lanIp: "192.168.1.23", carrier: "KDDI", radio: "5G", alarm: "06:30" });
class FileManager { static local() { return fmLocal; } static iCloud() { return fmIcloud; } }
const RESP = {
  "api.open-meteo.com": { elevation: 41, current: { temperature_2m: 31.4, relative_humidity_2m: 68, apparent_temperature: 34.2, weather_code: 2, wind_speed_10m: 11.5, wind_direction_10m: 140, uv_index: 6.8, precipitation: 0, is_day: 1, pressure_msl: 1012.6 }, daily: { temperature_2m_max: [33.1], temperature_2m_min: [26.2], sunrise: ["2026-08-25T05:07"], sunset: ["2026-08-25T18:22"], uv_index_max: [8.9], precipitation_probability_max: [10], precipitation_sum: [0] } },
  "air-quality-api.open-meteo.com": { current: { us_aqi: 42, pm2_5: 9.1 } },
  "query1.finance.yahoo.com": { spark: { result: [
    { symbol: "AAPL", response: [{ meta: { regularMarketPrice: 232.14, previousClose: 229.31, currency: "USD" } }] },
    { symbol: "NVDA", response: [{ meta: { regularMarketPrice: 181.6, chartPreviousClose: 184.2, currency: "USD" } }] },
    { symbol: "TSLA", response: [{ meta: { regularMarketPrice: 351.2, previousClose: 340.0, currency: "USD" } }] } ] } },
  "api.binance.com": [{ symbol: "BTCUSDT", lastPrice: "112340.55", priceChangePercent: "-0.83" }, { symbol: "ETHUSDT", lastPrice: "4312.10", priceChangePercent: "2.15" }],
  "ip-api.com": { status: "success", query: "203.0.113.5", isp: "KDDI CORPORATION", org: "au", as: "AS2516 KDDI", countryCode: "JP", proxy: false, hosting: process.env.VPN === "1" },
};
class Request { constructor(u) { this.url = u; } async loadJSON() { if (process.env.OFFLINE) throw new Error("offline"); const h = this.url.split("/")[2]; if (!(h in RESP)) throw new Error("no mock " + h); return RESP[h]; } }
class Location { static setAccuracyToKilometer() {} static async current() { if (process.env.NOLOC) throw new Error("denied"); return { latitude: 35.6812, longitude: 139.7671, altitude: 41.3, horizontalAccuracy: 1000, verticalAccuracy: 20 }; } static async reverseGeocode() { return [{ subLocality: "丸の内", locality: "千代田区" }]; } }
class Device { static batteryLevel() { return 0.84; } static isCharging() { return process.env.CHG === "1"; } }
const cal = t => ({ title: t, color: new Color("#fff") });
const CALS = [cal("Work"), cal("Personal"), cal("Birthdays")];
const ev = (title, h, m, dur, all, c) => ({ title, startDate: new RealDate(2026, 7, 25, h, m), endDate: new RealDate(2026, 7, 25, h, m + dur), isAllDay: !!all, calendar: c || CALS[0] });
const evT = (title, h, m, dur) => ({ title, startDate: new RealDate(2026, 7, 26, h, m), endDate: new RealDate(2026, 7, 26, h, m + dur), isAllDay: false, calendar: CALS[0] });
class Calendar { static async forEvents() { return CALS; } static async forReminders() { return [cal("Todo"), cal("Shopping")]; } }
class CalendarEvent {
  static async today() { return process.env.EMPTY ? [] : [ev("Standup", 9, 30, 30), ev("Design review w/ platform team", 11, 0, 60), ev("Deploy freeze", 0, 0, 0, true, CALS[1]), ev("1:1 Kenji", 14, 0, 45), ev("Dentist", 16, 30, 60), ev("Dinner @ Ginza", 19, 0, 120), ev("Late sync", 21, 0, 30)]; }
  static async tomorrow() { return process.env.EMPTY ? [] : [evT("Flight HND-SFO", 10, 15, 600), evT("Board prep", 8, 0, 60)]; }
  static async between() { return [ev("x", 9, 0, 60), { title: "y", startDate: new RealDate(2026, 7, 28, 9), endDate: new RealDate(2026, 7, 30, 9), isAllDay: true, calendar: CALS[0] }]; }
}
const rm = (title, due, pr, t) => ({ title, dueDate: due, priority: pr || 0, dueDateIncludesTime: !!t, calendar: cal("Todo") });
class Reminder { static async allIncomplete() { return process.env.EMPTY ? [] : [rm("Renew passport", new RealDate(2026, 7, 28)), rm("Pay rent", new RealDate(2026, 7, 23), 1), rm("Call bank", new RealDate(2026, 7, 25, 17, 0), 0, true), rm("Read paper", null), rm("Buy milk", new RealDate(2026, 7, 26)), rm("Far away", new RealDate(2026, 8, 20))]; }
}
class Script { static setWidget(w) { global.__widget = w; } static complete() {} }
const config = { runsInWidget: true };
Object.assign(global, { Color, Font, Size, Point, Rect, Path, DrawContext, SFSymbol, Timer, ListWidget, FileManager, Request, Location, Device, Calendar, CalendarEvent, Reminder, Script, config });
console.warn = (...a) => { if (process.env.VERBOSE) console.error("WARN", ...a); };

const src = fs.readFileSync(__dirname + "/../GeekBoard.js", "utf8");
(async () => {
  await (new (Object.getPrototypeOf(async function () {}).constructor)(src))();
  const w = global.__widget;
  const render = (s, ind) => {
    if (s.kind === "stack") {
      if (s.dir === "h") { console.log(ind + s.items.map(renderInline).filter(Boolean).join(" ")); }
      else s.items.forEach(i => (i.kind === "stack" ? render(i, ind + (s.size ? "  " : "")) : console.log(ind + renderInline(i))));
    } else console.log(ind + renderInline(s));
  };
  const renderInline = i => {
    if (i.kind === "text") return i.text;
    if (i.kind === "date") return i.style === "time" ? "[" + i.date.getHours() + ":" + String(i.date.getMinutes()).padStart(2, "0") + "]" : "[in " + Math.round((i.date - NOW) / 60000) + "m]";
    if (i.kind === "image") return "<" + i.image.img + ">";
    if (i.kind === "spacer") return i.n ? "" : "…";
    if (i.kind === "stack") return i.dir === "h" ? i.items.map(renderInline).filter(Boolean).join(" ") : "{" + i.items.map(renderInline).filter(Boolean).join(" | ") + "}";
    return "";
  };
  render(w, "");
})().catch(e => { console.error("RUN ERROR:", e); process.exit(1); });
