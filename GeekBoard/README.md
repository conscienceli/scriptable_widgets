# GeekBoard · Scriptable 大号 Widget

极客风高信息密度面板。一屏塞进日程、提醒、农历节气、天气、空气质量、经纬度海拔、月历、股票与加密货币行情、活动圆环、网络与 VPN 状态、电量。

![preview](preview.png)

> 预览图为模拟数据；实机使用 SF Mono，观感一致。

## 文件说明

| 文件 | 用途 |
|---|---|
| `GeekBoard.js` | Widget 脚本本体，放进 iCloud Drive/Scriptable/ |
| `geekboard-bridge.sample.json` | 快捷指令桥接文件样例（第 3 节） |
| `tools/mock_run.js` | Node 端 Scriptable 运行时 mock，改布局时可在电脑上跑通逻辑：`node tools/mock_run.js` |
| `tools/preview.html` | 预览图的 HTML 源，改版式时用它出图 |
| `tools/gen_lunar.py` | 生成内置农历表的脚本（依赖 `pip install sxtwl`），仅在需要扩展年份范围时使用 |


## 0. 一图读懂布局

```
TUE 25 AUG  W35 D237  丙午马 七月十三  白露-13d        ← 周几/日期/ISO周/年内第几天/干支农历/下一个节气倒数
☁ 31° ~34° 26/33 H68% UV7/9 P10% AQI42 SE3m/s         ← 天气/体感/今日低高/湿度/UV当前÷最高/降水概率/空气/风
35.6812N 139.7671E ↑41m 丸の内 ☀05:07-18:22          ← 经纬度/海拔/所在区/日出-日落
──────────────────────────────────────────────────
AGENDA 7·2 ▶14:45          wk M T W T F S S           ← 今天·明天事件数；▶正在进行的结束时间 / →下一个倒计时
ALL   Deploy freeze  Person 35 24 [25] 26 27 28 29 30   ← 月历：ISO 周号 + 有事件的日期高亮
09:30 Standup         30m  AAPL   232.14 +1.23
14:00 1:1 Kenji       45m  BTC   112,341 -0.83        ← 行情：价格 + 涨跌%
+08:00 Board prep      1h  ◎ M 412/500 E 22/30 S 8/12  ← 三圆环 + 步数/距离（需要快捷指令桥接）
TODO 4·1!                     6,842 4.9km
! Pay rent            -2d                             ← 逾期/高优先级红色
• Call bank          17:00
──────────────────────────────────────────────────
203.0.113.5 KDDI JP VPN OFF                  BAT 84%  ← 公网IP/运营商/国家/VPN 判定/电量
HomeNet-5G 192.168.1.23 KDDI 5G ⏰06:30       ↻14:32  ← WiFi名/内网IP/数据SIM/制式/闹钟/脚本上次运行时间
```

颜色语义（不是装饰）：绿 = 正在进行 / 充电中 / 空气优；蓝 = 下一个事件、有事件的日期、所在区；红 = 逾期、高优先级、低电量；琥珀 = VPN ON、UV 高、数据过期 `!`、今天正好是节气；灰 = 已过去 / 次要。涨跌默认**红涨绿跌**（`CN_COLOR_CONVENTION`）。

## 1. 安装脚本（2 分钟）

1. App Store 安装 **Scriptable**。
2. 把 `GeekBoard.js` 放进 iCloud Drive → `Scriptable` 文件夹（或在 Scriptable 里新建脚本，把内容整个粘进去，命名 `GeekBoard`）。
3. 在 Scriptable 里点一下运行，按提示允许 **日历 / 提醒事项 / 定位** 权限。
4. 桌面长按 → 添加 Widget → Scriptable → **大号** → 长按 Widget → 编辑 → Script 选 `GeekBoard`，When Interacting 选 `Run Script`。
5. 设置 → Scriptable → 位置 → 选 **始终**（Widget 在后台刷新时才能定位；脚本用的是公里级精度 + 30 分钟缓存，几乎不耗电）。

## 2. 改配置（脚本顶部 `CONFIG`）

| 项 | 说明 |
|---|---|
| `STOCKS` | Yahoo 代码：美股 `AAPL`；港股 `0700.HK`；A 股 `600519.SS` / `000001.SZ`；日股 `7203.T`；指数 `^GSPC` `^N225`；汇率 `USDJPY=X` |
| `CRYPTO` | Binance 现货代码（自动加 USDT）。Binance 不通时自动切 CoinGecko，用 `CRYPTO_GECKO_IDS` 映射 |
| `QUOTE_ROWS` | 行情显示行数，股票在前币在后，超出截断 |
| `CALENDARS` / `CALENDARS_EXCLUDE` | 按日历名称过滤 |
| `REMINDER_LISTS` | 指定提醒事项列表名。留空 = 所有列表里 7 天内到期 + 逾期；指定了列表后无日期的项也会显示 |
| `TRUSTED_ISP` | 填你家宽带和手机运营商名字片段，如 `["KDDI","SoftBank","NTT"]`。出口 IP 不属于这些 → 判定 VPN ON。留空则只靠 ip-api 的机房/代理标记判定 |
| `GMAIL` | 想要 Gmail 未读数时填 Google 应用专用密码（账号 → 安全性 → 两步验证 → 应用专用密码）。走 Atom feed，一次请求 |
| `WIDTH` | iPhone 15/16 Pro 用 `314`；Plus / Pro Max 改 `340`；iPhone 16 Pro Max 也是 `340` |
| `FONT` | 主字号，默认 12。改大一号请把 `LEFT_LINES` 减 1~2 |
| `USE_GPS` | `false` 则完全不定位，用 `FALLBACK_COORDS` |
| `TTL` | 各数据源缓存分钟数。iOS 刷新 Widget 时若缓存未过期就不发网络请求 |

## 3. 快捷指令桥接（拿三圆环 / 步数 / WiFi / 内网 IP / SIM / 闹钟）

iOS 不让第三方 App 直接读这些，但「快捷指令」可以。原理：一个快捷指令把数据写成 JSON 文件到 iCloud 的 Scriptable 目录，Widget 每次刷新读取它。

### 3.1 新建快捷指令 `GeekBoard Bridge`

按顺序添加动作（括号内是每个动作的设置）：

1. **查找健康样本** (类型 `活动能量`，筛选 `开始日期 是 今天`，分组 无) → **计算统计** (总和) → 结果命名 `move`
2. **查找健康样本** (类型 `锻炼时间`，今天) → **计算统计** (总和) → `exercise`
3. **查找健康样本** (类型 `站立小时数`，今天) → **计算统计** (总和) → `stand`
4. **查找健康样本** (类型 `步数`，今天) → **计算统计** (总和) → `steps`
5. **查找健康样本** (类型 `步行 + 跑步距离`，今天) → **计算统计** (总和) → `distance`
6. **获取网络详细信息** (Wi-Fi → 网络名称) → `ssid`
7. **获取当前 IP 地址** (本地, Wi-Fi) → `lanIp`
8. **获取网络详细信息** (蜂窝 → 运营商名称) → `carrier`；再加一个 (蜂窝 → 无线技术 / 网络类型) → `radio`
9. （可选，iOS 17+）时钟 App 的 **获取闹钟** → 筛选 `已启用`，按时间排序 → 取第一项 → **设定格式** 得到 `HH:mm` → `alarm`。你的系统里如果搜不到这个动作就跳过。
10. **文本**，内容如下（把 `{…}` 换成上面各步的变量，**全部加引号**，脚本会自己去单位和逗号）：

```json
{"move":"{move}","exercise":"{exercise}","stand":"{stand}","steps":"{steps}","distance":"{distance}",
 "ssid":"{ssid}","lanIp":"{lanIp}","carrier":"{carrier}","radio":"{radio}","alarm":"{alarm}"}
```

11. **存储文件**：服务 `iCloud Drive`，关闭「询问存储位置」，路径填 `Scriptable/geekboard-bridge.json`，打开「如果文件存在则覆盖」。

跑一次，去「文件」App 的 iCloud Drive/Scriptable 里确认有 `geekboard-bridge.json`。距离如果返回的是米，在 `distance` 后面接一个「计算 ÷1000」即可（脚本按 km 显示）。

圆环目标（`MOVE_GOAL` 等）快捷指令拿不到，在 CONFIG 里手填；或者在 JSON 里加 `"moveGoal":"500"` 覆盖。

### 3.2 让它自动跑

快捷指令 → 自动化 → 新建「个人自动化」，每条都选 **立即运行**、关掉「运行时通知」：

- **特定时间**：分别建 7:00 / 9:00 / 12:00 / 15:00 / 18:00 / 21:00 / 23:00 各一条（iOS 不支持"每小时"，只能多建几条）
- **App**：`健身` 关闭时（看完圆环顺手刷新）
- **充电器**：连接时
- **Wi-Fi**：加入任意网络时（这样 SSID / 内网 IP 换网就更新）

每条自动化都指向 `GeekBoard Bridge`。桥接数据超过 `BRIDGE_STALE_HOURS`（默认 4 小时）未更新，Widget 会把这些字段灰显并在底栏标 `bridge Nh`。

## 4. 省电说明

- Widget 何时刷新由 iOS 决定（通常 15~30 分钟一次，脚本用 `REFRESH_MIN` 给它一个建议值）。
- 每次刷新最多 5 个网络请求（天气、AQI、行情、币、IP），且都受 TTL 缓存约束；行情 5 分钟内、天气 20 分钟内、IP 30 分钟内重复刷新不会再发请求。
- 定位用公里级精度并缓存 30 分钟；不做持续定位。
- 没有任何动画 / 大图 / 持续运行的东西。实际功耗与系统自带天气 Widget 同一量级。

## 5. 数据源与失效行为

| 数据 | 来源 | 失败时 |
|---|---|---|
| 天气 / 日出日落 / UV / 气压 | Open-Meteo（免 key） | 用上次缓存并标 `!`；没缓存显示 `WX --` |
| AQI | Open-Meteo Air Quality | 不显示 |
| 股票 | Yahoo Finance `spark`，逐只 `chart` 兜底 | 缓存 + `mkt cached HH:mm` |
| 加密货币 | Binance 24hr → CoinGecko 兜底 | 同上 |
| 公网 IP / ISP / VPN | ip-api.com（含机房/代理标记）→ ipapi.co 兜底 | `NET --` |
| 农历 / 节气 | 脚本内置 2000–2100 精确表（天文历法生成，逐日校验过） | 无网络依赖 |
| 三圆环 / 步数 / WiFi / SIM / 闹钟 | 快捷指令桥接文件 | 显示 `no bridge` / `RINGS: no bridge` |

## 6. iOS 拿不到、所以没放的东西

微信未读、短信未读、耳机电量、指南针朝向、网关地址。任何第三方 App（包括快捷指令）都读不到这些，Widget 里不放假数据占位。

## 7. 排错

- Widget 一片空白 / 只剩一行：多半是某个权限没给。在 Scriptable App 内运行脚本一次，看控制台报错。
- 行情全是 `--`：Yahoo 偶尔限流，等 5 分钟；或者代码写错（Yahoo 网页搜索一下确认代码）。
- 经纬度是灰色的：定位失败，正在用 `FALLBACK_COORDS`。检查 Scriptable 定位权限是否为「始终」。
- 圆环不显示：确认「文件」里 iCloud Drive/Scriptable/geekboard-bridge.json 存在且内容是合法 JSON（所有值都加引号）。
