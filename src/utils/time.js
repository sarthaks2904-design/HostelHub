function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function nowIso() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(value) {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getTimeParts(timeText) {
  const [hours = "0", minutes = "0"] = String(timeText || "0:0").split(":");
  return {
    hours: Number(hours),
    minutes: Number(minutes)
  };
}

function minutesSinceMidnight(value) {
  const date = toDate(value);
  return date.getHours() * 60 + date.getMinutes();
}

function isAfterCurfew(value, curfewTime) {
  const date = toDate(value);
  const curfew = getTimeParts(curfewTime);
  return minutesSinceMidnight(date) > curfew.hours * 60 + curfew.minutes;
}

function isPast(value, reference = new Date()) {
  return toDate(value).getTime() < toDate(reference).getTime();
}

function addHours(value, hours) {
  return new Date(toDate(value).getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(value, minutes) {
  return new Date(toDate(value).getTime() + minutes * 60 * 1000);
}

function addDays(value, days) {
  return new Date(toDate(value).getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfWeek(value = new Date()) {
  const date = toDate(value);
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const distance = day === 0 ? 6 : day - 1;
  normalized.setDate(normalized.getDate() - distance);
  return normalized;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  toDate,
  nowIso,
  dateKey,
  getTimeParts,
  minutesSinceMidnight,
  isAfterCurfew,
  isPast,
  addHours,
  addMinutes,
  addDays,
  startOfWeek,
  cloneJson
};
