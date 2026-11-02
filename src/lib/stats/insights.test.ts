// Run with: bun src/lib/stats/insights.test.ts
import {
  computeInsights,
  durationParts,
  minutesSaved,
  WEEKLY_GOAL_MINUTES,
} from "./insights";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  }
};
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// A fixed "now": Wednesday 2026-11-04 15:00 local time.
const now = new Date(2026, 10, 4, 15, 0, 0).getTime();
const at = (daysAgo: number, hour = 10) => {
  const d = new Date(2026, 10, 4 - daysAgo, hour, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

// Empty input: zeros everywhere, 7 empty days.
{
  const s = computeInsights([], now);
  check("empty: totals are zero", s.totalWords === 0 && s.dictations === 0);
  check("empty: seven days", s.days.length === 7, s.days.length);
  check("empty: no progress", s.weekGoalProgress === 0);
}

// Formula: 150 words → 150/40 − 150/150 = 2.75 minutes.
check("minutesSaved formula", near(minutesSaved(150), 2.75), minutesSaved(150));
check("minutesSaved never negative", minutesSaved(-10) === 0);

// Bucketing: today, yesterday, 6 days ago count; 7 days ago does not.
{
  const s = computeInsights(
    [
      { timestamp: at(0), words: 100 },
      { timestamp: at(1), words: 50 },
      { timestamp: at(6, 0), words: 20 },
      { timestamp: at(7, 23), words: 999 },
    ],
    now,
  );
  check("today's words", s.wordsToday === 100, s.wordsToday);
  check("week excludes 7 days ago", s.weekWords === 170, s.weekWords);
  check("total includes everything", s.totalWords === 1169, s.totalWords);
  check("dictation count", s.dictations === 4, s.dictations);
  check("oldest day bucket", s.days[0].words === 20, s.days[0]);
}

// Invalid and boundary values are ignored, not crashing or skewing.
{
  const s = computeInsights(
    [
      { timestamp: at(0), words: 0 },
      { timestamp: at(0), words: -5 },
      { timestamp: at(0), words: Number.NaN },
      { timestamp: Math.floor(now / 1000) + 3600, words: 10 }, // future
    ],
    now,
  );
  check("zero/negative/NaN ignored", s.dictations === 1, s.dictations);
  check("future entry counts in total only", s.weekWords === 0, s.weekWords);
}

// Progress caps at the goal.
{
  const words = Math.ceil((WEEKLY_GOAL_MINUTES * 3) / (1 / 40 - 1 / 150));
  const s = computeInsights([{ timestamp: at(0), words }], now);
  check("progress capped at 1", s.weekGoalProgress === 1, s.weekGoalProgress);
}

// Durations switch to hours at 60 minutes.
check("minutes below an hour", durationParts(42.4).unit === "minutes");
check("hours from 60 min", durationParts(90).value === 1.5);

if (failures > 0) {
  console.error(`insights: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("insights: all assertions passed");
