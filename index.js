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

client.on('ready', async () => {
  console.log('WhatsApp client is ready.');
  await logGroupChats();
  scheduleJobs();
  if (process.argv.includes('--send-now')) {
    await sendAttendancePoll(resolveTargetGroupId());
  }
});

function chatIdFromMessage(message) {
  return message.id?.remote || (message.fromMe ? message.to : message.from);
}

function serializedMessageId(message) {
  const id = message?.id;
  if (!id) return '(no id)';
  if (typeof id === 'string') return id;
  if (id._serialized) return id._serialized;
  const fromMe = id.fromMe ? 'true' : 'false';
  const remote = id.remote || '';
  const serial = id.id || '';
  if (remote || serial) return `${fromMe}_${remote}_${serial}`;
  try {
    return JSON.stringify(id);
  } catch (_) {
    return String(id);
  }
}

function resolveTargetGroupId() {
  const flagIndex = process.argv.indexOf('--group');
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }
  return TARGET_GROUP_ID;
}

function isPlaceholderGroupId(id) {
  return !id || id.includes('YOUR_GROUP_ID');
}

function looksLikeTargetGroup(name) {
  return /dragon/i.test(name) || /26\/27\s*AA/i.test(name);
}

async function logGroupChats() {
  try {
    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup);
    console.log('======== WhatsApp groups (copy @g.us into TARGET_GROUP_ID) ========');
    for (const group of groups) {
      const id = group.id._serialized;
      const mark = looksLikeTargetGroup(group.name || '') ? '  <<< use this' : '';
      console.log(`${group.name} | ${id}${mark}`);
    }
    console.log('================================================================');
  } catch (err) {
    console.error('Failed to list WhatsApp groups:', err);
  }
}

// Log every new message, including ones you send from this phone.
// Own messages do not fire the `message` event, so we use `message_create`.
client.on('message_create', async (message) => {
  const chatId = chatIdFromMessage(message);
  const isGroup = typeof chatId === 'string' && chatId.endsWith('@g.us');
  let chatName = '';
  try {
    const chat = await message.getChat();
    chatName = chat.name || '';
  } catch (_) {
    // Name is optional; chat id is what we need.
  }
  const body = String(message.body || '').replace(/\s+/g, ' ').slice(0, 80);
  const mark = looksLikeTargetGroup(chatName) || chatId === TARGET_GROUP_ID ? '  <<< 26/27 AA group' : '';
  console.log(
    `${isGroup ? '[GROUP]' : '[CHAT]'} ${chatName || '(no name)'} | chat id: ${chatId} | message id: ${serializedMessageId(message)} | type: ${message.type} | from me: ${message.fromMe} | ${body}${mark}`
  );
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

async function sendAttendancePoll(groupId) {
  if (isPlaceholderGroupId(groupId)) {
    throw new Error('Set TARGET_GROUP_ID in index.js or pass --group <id>@g.us');
  }
  const pollTitle = buildAttendancePollTitle();
  const poll = new Poll(pollTitle, POLL_OPTIONS, {
    allowMultipleAnswers: false, // single-choice (library name for multipleAnswers)
  });
  const sent = await client.sendMessage(groupId, poll);
  console.log(`Monday attendance poll sent: ${pollTitle}`);
  console.log(`Sent poll | chat id: ${groupId} | message id: ${serializedMessageId(sent)}`);
  return sent;
}

function scheduleJobs() {
  cron.schedule(
    POLL_CRON,
    async () => {
      try {
        await sendAttendancePoll(TARGET_GROUP_ID);
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
