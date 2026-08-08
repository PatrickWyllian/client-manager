function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function daysSince(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Add N months to a date without overflowing into the next month.
 * e.g., Jan 31 + 1 month -> Feb 28/29 (not March 3)
 */
function addMonthsPreservingDay(baseDate, months) {
  const date = new Date(baseDate.getTime());
  const origDay = date.getDate();
  date.setDate(1); // Set to 1st to prevent overflow during month shift
  date.setMonth(date.getMonth() + months);
  
  // Calculate max days in target month
  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(origDay, lastDayOfTargetMonth));
  return date;
}

module.exports = { daysUntil, daysSince, formatDate, formatMonth, addMonthsPreservingDay };
