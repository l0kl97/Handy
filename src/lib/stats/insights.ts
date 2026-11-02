import type { DictationWords } from "@/bindings";

/**
 * Time-saved insights from per-dictation word counts.
 *
 * Time saved = what typing the words would have taken minus what speaking
 * them took. Without recorded durations we use typical speeds: about 40 words
 * per minute typing and 150 speaking. Both are shown to the user as the
 * assumption behind the number.
 */
export const TYPING_WPM = 40;
export const SPEAKING_WPM = 150;
/** Typing speeds the user can pick (words per minute). */
export const TYPING_WPM_OPTIONS = [30, 40, 50, 60, 70, 80, 100];
const TYPING_WPM_KEY = "handy.typingWpm";

/** The user's typing speed (a per-device preference), or the default. */
export const getTypingWpm = (): number => {
  try {
    const v = Number(localStorage.getItem(TYPING_WPM_KEY));
    return TYPING_WPM_OPTIONS.includes(v) ? v : TYPING_WPM;
  } catch {
    return TYPING_WPM;
  }
};

export const setTypingWpm = (wpm: number): void => {
  try {
    localStorage.setItem(TYPING_WPM_KEY, String(wpm));
  } catch {
    // Not persisted; the choice still applies until the page reloads.
  }
};

export const typingMinutes = (words: number, typingWpm = TYPING_WPM) =>
  words / typingWpm;
export const speakingMinutes = (words: number) => words / SPEAKING_WPM;
/** Weekly goal the gauge fills towards, in minutes saved. */
export const WEEKLY_GOAL_MINUTES = 60;

/** Typing time minus speaking time; never negative (a fast typist may win). */
export const minutesSaved = (words: number, typingWpm = TYPING_WPM): number =>
  Math.max(0, typingMinutes(words, typingWpm) - speakingMinutes(words));

export interface DayBucket {
  /** Local midnight of the day, in ms. */
  start: number;
  words: number;
}

export interface Insights {
  totalWords: number;
  dictations: number;
  totalMinutesSaved: number;
  wordsToday: number;
  /** Rolling last 7 days including today. */
  weekWords: number;
  weekMinutesSaved: number;
  /** 0–1 share of the weekly goal, capped at 1. */
  weekGoalProgress: number;
  /** The last 7 local days, oldest first. */
  days: DayBucket[];
}

const startOfLocalDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Aggregates dictations into insights relative to `now` (local time). */
export const computeInsights = (
  entries: DictationWords[],
  now: number = Date.now(),
  typingWpm: number = TYPING_WPM,
): Insights => {
  const today = startOfLocalDay(now);
  const days: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i); // DST-safe: steps calendar days, not 24h
    days.push({ start: d.getTime(), words: 0 });
  }
  const weekStart = days[0].start;

  let totalWords = 0;
  let dictations = 0;
  for (const e of entries) {
    const words = Number.isFinite(e.words) && e.words > 0 ? e.words : 0;
    if (words === 0) continue;
    totalWords += words;
    dictations += 1;

    const ms = e.timestamp * 1000;
    if (ms < weekStart || ms > now) continue; // outside the window or clock skew
    const day = startOfLocalDay(ms);
    const bucket = days.find((b) => b.start === day);
    if (bucket) bucket.words += words;
  }

  const weekWords = days.reduce((a, b) => a + b.words, 0);
  const weekMinutesSaved = minutesSaved(weekWords, typingWpm);
  return {
    totalWords,
    dictations,
    totalMinutesSaved: minutesSaved(totalWords, typingWpm),
    wordsToday: days[days.length - 1].words,
    weekWords,
    weekMinutesSaved,
    weekGoalProgress: Math.min(1, weekMinutesSaved / WEEKLY_GOAL_MINUTES),
    days,
  };
};

/** "42 Min." / "3,4 Std." style split: value + unit key, locale-formatted by the caller. */
export const durationParts = (
  minutes: number,
): { value: number; unit: "minutes" | "hours" } =>
  minutes >= 60
    ? { value: Math.round((minutes / 60) * 10) / 10, unit: "hours" }
    : { value: Math.round(minutes), unit: "minutes" };
