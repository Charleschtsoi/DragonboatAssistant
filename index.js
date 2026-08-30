const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

// ---------------------------------------------------------------------------
// Configuration — update these before first run
// ---------------------------------------------------------------------------
const TARGET_GROUP_ID = 'YOUR_GROUP_ID@g.us'; // e.g. '1203630...@g.us'
const ADMIN_PHONE_NUMBER = 'YOUR_NUMBER@c.us'; // e.g. '85291234567@c.us'
const TIMEZONE = 'Asia/Hong_Kong'; // IANA timezone (Hong Kong)

// Monday attendance poll time (Asia/Hong_Kong). Align Mac wake with this window.
const POLL_CRON = '0 9 * * 1'; // 09:00 every Monday

// Weekly Saturday training — the poll title uses the upcoming Saturday's date.
const TRAINING_TIME = '14:00 - 16:00';
const TRAINING_VENUE = 'Ap Lei Chau';
const POLL_OPTIONS = ['Join', 'Not join'];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function calendarDateInTimezone(date, timeZone = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    weekday: byType.weekday,
  };
}

function addCalendarDays(ymd, days) {
  const shifted = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function upcomingSaturdayDate(from = new Date(), timeZone = TIMEZONE) {
  const today = calendarDateInTimezone(from, timeZone);
  const weekdayIndex = WEEKDAY_INDEX[today.weekday];
  const daysUntilSaturday = (6 - weekdayIndex + 7) % 7;
  if (daysUntilSaturday === 0) {
    return { year: today.year, month: today.month, day: today.day };
  }
  return addCalendarDays(today, daysUntilSaturday);
}

function formatTrainingPollTitle(ymd) {
  return `${ymd.day} ${MONTH_SHORT[ymd.month - 1]} Training ${TRAINING_TIME} @ ${TRAINING_VENUE}`;
}

function buildAttendancePollTitle(from = new Date(), timeZone = TIMEZONE) {
  return formatTrainingPollTitle(upcomingSaturdayDate(from, timeZone));
}

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth(),
  });

  client.on('qr', (qr) => {
    console.log('Scan this QR code with WhatsApp to authenticate:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('WhatsApp client is ready.');
    scheduleJobs(client);
  });

  // Log every incoming message ID so you can find the exact TARGET_GROUP_ID
  // (group chats end in @g.us) during initial setup.
  client.on('message', (message) => {
    console.log('Incoming message ID / chat:', message.from, '| message id:', message.id._serialized);
  });

  return client;
}

async function alertAdmin(client, err) {
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

function scheduleJobs(client) {
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
        await alertAdmin(client, err);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`Attendance poll scheduled (${POLL_CRON}, timezone: ${TIMEZONE}).`);
  console.log(`Next Saturday poll title: ${buildAttendancePollTitle()}`);
}

if (require.main === module) {
  createClient().initialize();
}

module.exports = {
  TIMEZONE,
  TRAINING_TIME,
  TRAINING_VENUE,
  POLL_OPTIONS,
  upcomingSaturdayDate,
  formatTrainingPollTitle,
  buildAttendancePollTitle,
};
