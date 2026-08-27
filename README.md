# DragonboatAssistant

Local WhatsApp bot for macOS that automates dragonboat group logistics:

| Schedule | Action |
| --- | --- |
| **Monday 09:00** (Hong Kong) | Sends an attendance poll: *Dragonboat Training Attendance* → Join / Not Join |
| **Wednesday 10:00** (Hong Kong) | Sends a reminder to issue the training invoice for corporate claims |

If a scheduled send fails, the bot DMs you (admin) so you can check the MacBook console.

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

> `whatsapp-web.js` launches Chromium via Puppeteer. On first install it downloads Chromium automatically. Keep the Mac awake (or prevent sleep) while the bot is running so cron jobs fire on time.

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

Open `index.js` and set the three values at the top:

```js
const TARGET_GROUP_ID = 'YOUR_GROUP_ID@g.us';     // WhatsApp group chat ID
const ADMIN_PHONE_NUMBER = 'YOUR_NUMBER@c.us';   // your number for error alerts
const TIMEZONE = 'Asia/Hong_Kong';
```

### Admin phone number format

Use country code **without** `+` or spaces, then `@c.us`:

| Your number | Value in code |
| --- | --- |
| +852 9123 4567 | `'85291234567@c.us'` |

### Change the invoice reminder day (optional)

Default is Wednesday (`3`). Edit this constant near the top of `index.js`:

```js
const INVOICE_REMINDER_DAY = '3';
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
```

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

Leave Terminal open (or run in the background — see below). Cron jobs use `Asia/Hong_Kong`, so they fire at local Hong Kong time even if the Mac’s system timezone differs.

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

> For long-term reliability, prevent Mac sleep while the bot should run: **System Settings → Battery / Energy → Prevent automatic sleeping when display is off** (on AC power), or use a tool like `caffeinate`.

Example (keep awake while the process runs):

```bash
caffeinate -i npm start
```

---

## 5. What success / failure looks like

| Event | Terminal | WhatsApp |
| --- | --- | --- |
| Monday poll sent | `Monday attendance poll sent.` | Poll in the group |
| Invoice reminder sent | `Invoice reminder sent.` | Text in the group |
| Send failed | Error stack in console | DM to admin: *Error: Failed to execute scheduled group task. Check MacBook console.* |

---

## Troubleshooting (Mac)

| Problem | What to try |
| --- | --- |
| `node: command not found` | Install Node (`brew install node`) and reopen Terminal |
| QR never appears / Chromium fails | Re-run `npm install`; ensure antivirus isn’t blocking Chromium under `node_modules/puppeteer` |
| Bot asks for QR every restart | Don’t delete `.wwebjs_auth/`; don’t unlink the device in WhatsApp |
| Wrong / missing group ID | Confirm the logged chat ends with `@g.us`, not `@c.us` (personal chats) |
| Cron didn’t fire | Mac was asleep; keep the Mac awake or plugged in with sleep disabled for that period |
| Admin alert didn’t arrive | Check `ADMIN_PHONE_NUMBER` format (`852...@c.us`) and that you’ve chatted with that account before |

---

## Project layout

```text
DragonboatAssistant/
├── index.js          # Bot + cron jobs + config
├── package.json
├── .wwebjs_auth/     # Saved WhatsApp session (created after first login; do not commit)
└── README.md
```

---

## Security notes

- This bot uses your **personal WhatsApp** as a linked device. Only run it on a Mac you trust.
- Never commit `.wwebjs_auth/` or share your session folder.
- Keep `TARGET_GROUP_ID` and `ADMIN_PHONE_NUMBER` private if the repo is public (or move them to a local `.env` later).
