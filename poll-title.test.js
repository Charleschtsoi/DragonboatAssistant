const assert = require('assert');
const {
  TIMEZONE,
  upcomingSaturdayDate,
  formatTrainingPollTitle,
  buildAttendancePollTitle,
} = require('./index.js');

function atHkt(isoLocal) {
  return new Date(`${isoLocal}+08:00`);
}

const sundayNight = atHkt('2026-08-30T23:30:00');
const mondayMorning = atHkt('2026-08-31T09:00:00');
const saturdaySession = atHkt('2026-08-22T14:00:00');
const yearEndMonday = atHkt('2026-12-28T09:00:00');

assert.deepStrictEqual(upcomingSaturdayDate(sundayNight, TIMEZONE), {
  year: 2026,
  month: 9,
  day: 5,
});
assert.deepStrictEqual(upcomingSaturdayDate(mondayMorning, TIMEZONE), {
  year: 2026,
  month: 9,
  day: 5,
});
assert.deepStrictEqual(upcomingSaturdayDate(saturdaySession, TIMEZONE), {
  year: 2026,
  month: 8,
  day: 22,
});
assert.deepStrictEqual(upcomingSaturdayDate(yearEndMonday, TIMEZONE), {
  year: 2027,
  month: 1,
  day: 2,
});

assert.strictEqual(
  formatTrainingPollTitle({ year: 2026, month: 8, day: 22 }),
  '22 Aug Training 14:00 - 16:00 @ Ap Lei Chau'
);
assert.strictEqual(
  buildAttendancePollTitle(mondayMorning, TIMEZONE),
  '5 Sep Training 14:00 - 16:00 @ Ap Lei Chau'
);
assert.strictEqual(
  buildAttendancePollTitle(yearEndMonday, TIMEZONE),
  '2 Jan Training 14:00 - 16:00 @ Ap Lei Chau'
);

console.log('poll-title tests passed');
