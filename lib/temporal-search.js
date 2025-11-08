function parseDateFromString(text) {
  const today = new Date();
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const timeKeywords = {
    today: () => today,
    yesterday: () => new Date(today.setDate(today.getDate() - 1)),
    "last week": () => new Date(today.setDate(today.getDate() - 7)),
    "last month": () => new Date(today.setMonth(today.getMonth() - 1)),
    "this month": () => {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: today };
    },
    "this week": () => {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { start, end: today };
    },
  };

  // Common date-related words for pattern matching
  const dateWords = ["saved", "created", "added", "from", "on", "at", "in"];

  // Normalize text for better matching
  const lowerText = text.toLowerCase();

  // Extract context words
  const hasDateContext = dateWords.some((word) => lowerText.includes(word));

  // Pattern for "nth month" or "month nth" (e.g., "8th november" or "november 8th")
  const ordinalMonthPattern =
    /(\d+)(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d+)(?:st|nd|rd|th)?/i;
  const ordinalMatch = lowerText.match(ordinalMonthPattern);

  if (ordinalMatch) {
    const monthStr = ordinalMatch[2] || ordinalMatch[1];
    const day = parseInt(ordinalMatch[1] || ordinalMatch[3]);
    const month = months.indexOf(monthStr.toLowerCase());
    if (month !== -1 && day >= 1 && day <= 31) {
      const date = new Date(today.getFullYear(), month, day);
      return { type: "exact", date, context: hasDateContext };
    }
  }

  // Check for formatted dates (YYYY-MM-DD, MM/DD/YYYY, etc.)
  const dateRegex =
    /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g;
  const dates = text.match(dateRegex);
  if (dates) {
    return { type: "exact", date: new Date(dates[0]), context: hasDateContext };
  }

  // Pattern for "day month" (e.g., "8 november")
  const simpleDatePattern =
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  const simpleDateMatch = lowerText.match(simpleDatePattern);

  if (simpleDateMatch) {
    const day = parseInt(simpleDateMatch[1]);
    const month = months.indexOf(simpleDateMatch[2].toLowerCase());
    if (month !== -1 && day >= 1 && day <= 31) {
      const date = new Date(today.getFullYear(), month, day);
      return { type: "exact", date, context: hasDateContext };
    }
  }

  // Check for relative time expressions
  for (const [keyword, getDate] of Object.entries(timeKeywords)) {
    if (lowerText.includes(keyword)) {
      const date = getDate();
      return { type: "relative", date, context: hasDateContext };
    }
  }

  // Pattern for natural language dates (e.g., "next monday", "last friday")
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const dayPattern =
    /(next|last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
  const dayMatch = lowerText.match(dayPattern);

  if (dayMatch) {
    const modifier = dayMatch[1].toLowerCase();
    const targetDay = dayNames.indexOf(dayMatch[2].toLowerCase());
    const date = new Date(today);
    const currentDay = date.getDay();
    let daysToAdd = 0;

    if (modifier === "next") {
      daysToAdd = (targetDay + 7 - currentDay) % 7;
    } else if (modifier === "last") {
      daysToAdd = (targetDay - 7 - currentDay) % 7;
    } else {
      // this
      daysToAdd = (targetDay - currentDay + 7) % 7;
    }

    date.setDate(date.getDate() + daysToAdd);
    return { type: "exact", date, context: hasDateContext };
  }

  return null;
}

function getTimeBoost(item, timeQuery) {
  if (!timeQuery || !item.created_at) return 1;

  const itemDate = new Date(item.created_at);
  const queryDate = timeQuery.date;

  // Higher boost for results with date context
  const contextBoost = timeQuery.context ? 1.5 : 1;

  if (timeQuery.type === "exact") {
    // Boost items from the exact date
    return isSameDay(itemDate, queryDate) ? 2.5 * contextBoost : 0.3;
  } else if (queryDate.start && queryDate.end) {
    // Date range (this week, this month, etc.)
    return isDateInRange(itemDate, queryDate.start, queryDate.end)
      ? 2 * contextBoost
      : 0.4;
  } else {
    // Single date comparison
    return isSameDay(itemDate, queryDate) ? 2 : 0.5;
  }
}

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isDateInRange(date, start, end) {
  return date >= start && date <= end;
}

module.exports = {
  parseDateFromString,
  getTimeBoost,
};
