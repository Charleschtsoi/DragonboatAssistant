const TIMEZONE = 'Asia/Hong_Kong';
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

module.exports = {
  TIMEZONE,
  TRAINING_TIME,
  TRAINING_VENUE,
  POLL_OPTIONS,
  upcomingSaturdayDate,
  formatTrainingPollTitle,
  buildAttendancePollTitle,
};
