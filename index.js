const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const {
  TIMEZONE,
  POLL_OPTIONS,
  buildAttendancePollTitle,
} = require('./poll-title');

// ---------------------------------------------------------------------------
// Configuration — update these before first run
// ---------------------------------------------------------------------------
const TARGET_GROUP_ID = 'YOUR_GROUP_ID@g.us'; // e.g. '1203630...@g.us'
const ADMIN_PHONE_NUMBER = 'YOUR_NUMBER@c.us'; // e.g. '85291234567@c.us'

// Monday attendance poll time (Asia/Hong_Kong). Align Mac wake with this window.
const POLL_CRON = '0 9 * * 1'; // 09:00 every Monday

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
  cron.schedule(
    POLL_CRON,
    async () => {
      try {
        const pollTitle = buildAttendancePollTitle();
        const poll = new Poll(pollTitle, POLL_OPTIONS, {
          allowMultipleAnswers: false, // single-choice (library name for multipleAnswers)
        });
        await client.sendMessage(TARGET_GROUP_ID, poll);
        console.log(`Monday attendance poll sent: ${pollTitle}`);
      } catch (err) {
        await alertAdmin(err);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`Attendance poll scheduled (${POLL_CRON}, timezone: ${TIMEZONE}).`);
  console.log(`Next Saturday poll title: ${buildAttendancePollTitle()}`);
}

client.initialize();
