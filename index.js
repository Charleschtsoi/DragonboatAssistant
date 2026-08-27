const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

// ---------------------------------------------------------------------------
// Configuration — update these before first run
// ---------------------------------------------------------------------------
const TARGET_GROUP_ID = 'YOUR_GROUP_ID@g.us'; // e.g. '1203630...@g.us'
const ADMIN_PHONE_NUMBER = 'YOUR_NUMBER@c.us'; // e.g. '85291234567@c.us'
const TIMEZONE = 'Asia/Hong_Kong'; // IANA timezone (Hong Kong)

// Placeholder day for the invoice reminder — change '3' (Wednesday) as needed.
// Cron day-of-week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const INVOICE_REMINDER_DAY = '3';

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
  console.log('Scan this QR code with WhatsApp to authenticate:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
  scheduleJobs();
});

// Log every incoming message ID so you can find the exact TARGET_GROUP_ID
// (group chats end in @g.us) during initial setup.
client.on('message', (message) => {
  console.log('Incoming message ID / chat:', message.from, '| message id:', message.id._serialized);
});

async function alertAdmin(err) {
  console.error(err);
  try {
    await client.sendMessage(
      ADMIN_PHONE_NUMBER,
      'Error: Failed to execute scheduled group task. Check MacBook console.'
    );
  } catch (alertErr) {
    console.error('Failed to send admin alert:', alertErr);
  }
}

function scheduleJobs() {
  // Task 1 — Monday Poll at 09:00 (Asia/Hong_Kong)
  cron.schedule(
    '0 9 * * 1',
    async () => {
      try {
        const poll = new Poll(
          'Dragonboat Training Attendance',
          ['Join', 'Not Join'],
          { allowMultipleAnswers: false } // single-choice (library name for multipleAnswers)
        );
        await client.sendMessage(TARGET_GROUP_ID, poll);
        console.log('Monday attendance poll sent.');
      } catch (err) {
        await alertAdmin(err);
      }
    },
    { timezone: TIMEZONE }
  );

  // Task 2 — Invoice Reminder at 10:00 (placeholder day; change INVOICE_REMINDER_DAY)
  cron.schedule(
    `0 10 * * ${INVOICE_REMINDER_DAY}`,
    async () => {
      try {
        await client.sendMessage(
          TARGET_GROUP_ID,
          'Reminder: Please issue the training invoice for corporate claims. Thank you!'
        );
        console.log('Invoice reminder sent.');
      } catch (err) {
        await alertAdmin(err);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`Cron jobs scheduled (timezone: ${TIMEZONE}).`);
}

client.initialize();
