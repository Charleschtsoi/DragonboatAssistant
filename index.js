const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const {
  TIMEZONE,
  POLL_OPTIONS,
  buildAttendancePollTitle,
  nextScheduledPollTitle,
  formatShortDate,
} = require('./poll-title');

// ---------------------------------------------------------------------------
// Configuration — put real ids in config.local.js on the Mac (gitignored)
// ---------------------------------------------------------------------------
let TARGET_GROUP_ID = 'YOUR_GROUP_ID@g.us';
let ADMIN_PHONE_NUMBER = 'YOUR_NUMBER@c.us';
try {
  const local = require('./config.local');
  if (local.TARGET_GROUP_ID) TARGET_GROUP_ID = local.TARGET_GROUP_ID;
  if (local.ADMIN_PHONE_NUMBER) ADMIN_PHONE_NUMBER = local.ADMIN_PHONE_NUMBER;
} catch (_) {
  // Optional local file; placeholders stay until you create config.local.js
}

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

  const inspectOnly = process.argv.includes('--inspect');
  const sendNow = process.argv.includes('--send-now');
  const toMe = process.argv.includes('--to-me');

  if (isPlaceholderGroupId(TARGET_GROUP_ID) || inspectOnly) {
    await logGroupChats();
  } else {
    console.log(`Group chat id is set (${TARGET_GROUP_ID}).`);
  }

  if (inspectOnly) {
    console.log('Inspect mode: reading your existing messages. Nothing will be sent to the group.');
    try {
      await inspectGroupMessages(resolveTargetGroupId());
    } catch (err) {
      console.error(err);
    }
    return;
  }

  scheduleJobs();

  if (sendNow) {
    try {
      const destination = toMe ? selfChatId() : resolveTargetGroupId();
      if (toMe) {
        console.log(`Sending a test poll to YOU only (${destination}). The group will not get this.`);
      } else {
        console.log(`Sending the attendance poll to the group (${destination}).`);
      }
      await sendAttendancePoll(destination);
    } catch (err) {
      await alertAdmin(err);
    }
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

function selfChatId() {
  const wid = client.info?.wid;
  if (!wid) {
    throw new Error('WhatsApp self id is not ready yet.');
  }
  return wid._serialized || `${wid.user}@c.us`;
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

async function inspectGroupMessages(groupId, limit = 30) {
  if (isPlaceholderGroupId(groupId)) {
    throw new Error('Pass --group <id>@g.us so inspect can read that chat without sending.');
  }
  const chat = await client.getChatById(groupId);
  console.log(`======== Inspect ${chat.name || '(no name)'} | ${groupId} ========`);
  const messages = await chat.fetchMessages({ limit });
  let ownCount = 0;
  for (const message of messages) {
    const body = String(message.body || '').replace(/\s+/g, ' ').slice(0, 100);
    const own = message.fromMe ? '  <<< your message' : '';
    if (message.fromMe) ownCount += 1;
    console.log(
      `[${message.fromMe ? 'ME' : 'IN'}] type: ${message.type} | message id: ${serializedMessageId(message)} | ${body}${own}`
    );
  }
  console.log(`Read ${messages.length} messages (${ownCount} from you). Nothing was sent.`);
  console.log('================================================================');
}

async function sendAttendancePoll(chatId) {
  if (isPlaceholderGroupId(chatId)) {
    throw new Error('Set TARGET_GROUP_ID in index.js or pass --group <id>@g.us');
  }
  const pollTitle = buildAttendancePollTitle();
  const poll = new Poll(pollTitle, POLL_OPTIONS, {
    allowMultipleAnswers: false, // single-choice (library name for multipleAnswers)
  });
  const sent = await client.sendMessage(chatId, poll);
  console.log(`Monday attendance poll sent: ${pollTitle}`);
  console.log(`Sent poll | chat id: ${chatId} | message id: ${serializedMessageId(sent)}`);
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
  const next = nextScheduledPollTitle();
  console.log(
    `Next Monday poll: ${formatShortDate(next.monday)} 09:00 HKT → ${next.title}`
  );
  if (isPlaceholderGroupId(TARGET_GROUP_ID)) {
    console.log('TARGET_GROUP_ID is not set yet. Copy config.local.example.js to config.local.js and paste the group chat id.');
  } else {
    console.log('Nothing is sent now. Leave this process running until next Monday 09:00 HKT.');
  }
}

client.initialize();
