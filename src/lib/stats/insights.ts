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
/** Weekly goal the gauge fills towards, in minutes saved. */
export const WEEKLY_GOAL_MINUTES = 60;

export const minutesSaved = (words: number): number =>
  Math.max(0, words / TYPING_WPM - words / SPEAKING_WPM);

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
  const weekMinutesSaved = minutesSaved(weekWords);
  return {
    totalWords,
    dictations,
    totalMinutesSaved: minutesSaved(totalWords),
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
