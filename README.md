# DragonboatAssistant

Local WhatsApp bot for macOS that sends a weekly dragonboat attendance poll.

| Schedule | Action |
| --- | --- |
| **Monday 09:00** (Hong Kong) | Sends a poll for **this coming Saturday**: *5 Sep Training 14:00 - 16:00 @ Ap Lei Chau* → Join / Not join |

If the send fails, the bot DMs you (admin) so you can check the MacBook console.

> The Mac must be **awake** around Monday 09:00 HKT (or use a scheduled wake a few minutes earlier). Sleep will skip the poll.

---

## Prerequisites (Mac)

1. **Node.js 18+**  
   Check your version:
   ```bash
   node -v
   ```
   If you need to install/update, use [nodejs.org](https://nodejs.org/) or Homebrew:
   ```bash
   brew install node
   ```

2. **Terminal** — you’ll run the bot from Terminal (or iTerm).

3. **WhatsApp on your phone** — needed once to scan the QR code and link the session.

> `whatsapp-web.js` launches Chromium via Puppeteer. On first install it downloads Chromium automatically.

---

## 1. Clone & install

```bash
cd ~/Projects   # or wherever you keep code
git clone https://github.com/Charleschtsoi/DragonboatAssistant.git
cd DragonboatAssistant

npm install whatsapp-web.js qrcode-terminal node-cron
```

Or, if dependencies are already listed in `package.json`:

```bash
npm install
```

---

## 2. Configure `index.js`

Open `index.js` and set the values at the top:

```js
const TARGET_GROUP_ID = 'YOUR_GROUP_ID@g.us';     // WhatsApp group chat ID
const ADMIN_PHONE_NUMBER = 'YOUR_NUMBER@c.us';   // your number for error alerts
const TIMEZONE = 'Asia/Hong_Kong';

const POLL_CRON = '0 9 * * 1'; // Monday 09:00 — change if you prefer another time
const TRAINING_TIME = '14:00 - 16:00';
const TRAINING_VENUE = 'Ap Lei Chau';
```

The poll title is built automatically from the **upcoming Saturday** in Hong Kong time, for example `22 Aug Training 14:00 - 16:00 @ Ap Lei Chau`. Change `TRAINING_TIME` or `TRAINING_VENUE` if the session details change.

### Admin phone number format

Use country code **without** `+` or spaces, then `@c.us`:

| Your number | Value in code |
| --- | --- |
| +852 9123 4567 | `'85291234567@c.us'` |

### Change poll time (optional)

`POLL_CRON` uses standard cron (`minute hour day-of-month month day-of-week`). Examples:

| Goal | `POLL_CRON` |
| --- | --- |
| Monday 09:00 (default) | `'0 9 * * 1'` |
| Monday 08:30 | `'30 8 * * 1'` |
| Sunday 20:00 | `'0 20 * * 0'` |

If you use Mac **scheduled wake**, set wake a few minutes **before** this time (e.g. wake 08:55 for a 09:00 poll).

---

## 3. First run — scan QR & find the group ID

### Start the bot

```bash
npm start
```

1. A **QR code** appears in Terminal.
2. On your phone: **WhatsApp → Settings → Linked Devices → Link a Device**.
3. Scan the QR code.
4. Wait until you see: `WhatsApp client is ready.`

Session is saved with **LocalAuth** (`.wwebjs_auth/`). You should **not** need to scan again on later restarts unless you log out the linked device.

### Find `TARGET_GROUP_ID`

1. With the bot running, send any message in the target WhatsApp group (from your phone or another chat).
2. Watch Terminal — each incoming message logs something like:
   ```text
   Incoming message ID / chat: 1203630xxxxxxxxxx@g.us | message id: ...
   ```
3. Copy the ID that ends in **`@g.us`**.
4. Stop the bot (`Ctrl + C`), paste it into `TARGET_GROUP_ID` in `index.js`, and start again:
   ```bash
   npm start
   ```

---

## 4. Day-to-day use

```bash
cd ~/Projects/DragonboatAssistant
npm start
```

Leave Terminal open (or run in the background — see below). The poll uses `Asia/Hong_Kong`, so it fires at Hong Kong time even if the Mac’s system timezone differs.

### Keep it running in the background (optional)

Using `nohup`:

```bash
cd ~/Projects/DragonboatAssistant
nohup npm start > bot.log 2>&1 &
```

Watch logs:

```bash
tail -f bot.log
```

Stop later:

```bash
pkill -f "node index.js"
```

### Mac sleep vs Monday poll

The bot only sends while the Mac is awake and `npm start` is running.

**Stay awake while the bot runs** (simple):

```bash
caffeinate -i npm start
```

Or in **System Settings → Battery / Energy**, prevent automatic sleeping on power adapter.

---

## Mac sleep / wake schedule (Monday)

Use this if you want the Mac to sleep most of the week, then wake just before the Monday poll (`POLL_CRON` default: **09:00 HKT**).

### Prerequisites

1. Leave the bot running (`npm start` or `nohup` / `caffeinate`). The process freezes in sleep and resumes on wake.
2. Wake a few minutes **before** the poll. If the Mac sleeps through 09:00, the poll is usually **not** sent later.

### Exact `pmset` steps (Monday 08:55)

1. Open **Terminal**.
2. Schedule a repeating Monday wake (admin password required):
   ```bash
   sudo pmset repeat wakeorpoweron M 08:55:00
   ```
   - `M` = Monday only  
   - `08:55:00` = 5 minutes before the default 09:00 poll  
   - If you change `POLL_CRON`, change this wake time to match (still a few minutes earlier)
3. Confirm the schedule:
   ```bash
   pmset -g sched
   ```
   You should see something like: `wakeorpoweron at 8:55AM every Monday`
4. Keep the Mac **plugged in** if you can — scheduled wake is more reliable on AC power.
5. Optional: cancel the schedule later with:
   ```bash
   sudo pmset repeat cancel
   ```

> Times follow the Mac’s **system clock**. If the Mac is not set to Hong Kong time, convert 08:55 HKT to your local clock, or set the Mac timezone to Hong Kong so it matches `TIMEZONE` / `POLL_CRON`.

You can also set this in **System Settings → Battery / Energy → Schedule** (same idea: Monday, ~08:55).

---

## 5. What success / failure looks like

| Event | Terminal | WhatsApp |
| --- | --- | --- |
| Monday poll sent | `Monday attendance poll sent: 5 Sep Training 14:00 - 16:00 @ Ap Lei Chau` | Poll in the group |
| Send failed | Error stack in console | DM to admin: *Error: Failed to execute scheduled group task. Check MacBook console.* |

---

## Troubleshooting (Mac)

| Problem | What to try |
| --- | --- |
| `node: command not found` | Install Node (`brew install node`) and reopen Terminal |
| QR never appears / Chromium fails | Re-run `npm install`; ensure antivirus isn’t blocking Chromium under `node_modules/puppeteer` |
| Bot asks for QR every restart | Don’t delete `.wwebjs_auth/`; don’t unlink the device in WhatsApp |
| Wrong / missing group ID | Confirm the logged chat ends with `@g.us`, not `@c.us` (personal chats) |
| Poll didn’t fire | Mac was asleep through Monday 09:00; see **Mac sleep / wake schedule** or use `caffeinate` |
| Admin alert didn’t arrive | Check `ADMIN_PHONE_NUMBER` format (`852...@c.us`) and that you’ve chatted with that account before |

---

## Project layout

```text
DragonboatAssistant/
├── index.js          # Bot + Monday poll + config
├── poll-title.test.js
├── package.json
├── .wwebjs_auth/     # Saved WhatsApp session (created after first login; do not commit)
└── README.md
```

---

## Security notes

- This bot uses your **personal WhatsApp** as a linked device. Only run it on a Mac you trust.
- Never commit `.wwebjs_auth/` or share your session folder.
- Keep `TARGET_GROUP_ID` and `ADMIN_PHONE_NUMBER` private if the repo is public (or move them to a local `.env` later).
