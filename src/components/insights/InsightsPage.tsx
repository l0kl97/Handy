import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, events, type DictationWords } from "@/bindings";
import {
  computeInsights,
  durationParts,
  SPEAKING_WPM,
  TYPING_WPM,
  WEEKLY_GOAL_MINUTES,
} from "@/lib/stats/insights";
import { Gauge } from "./Gauge";

/** Dictation insights: time saved vs. typing, words, the last 7 days. */
export const InsightsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<DictationWords[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await commands.getDictationStats();
      if (res?.status === "ok") {
        setEntries(res.data ?? []);
        setFailed(false);
      } else {
        console.warn("Failed to load dictation stats:", res?.error);
        setFailed(true);
        setEntries((prev) => prev ?? []);
      }
    } catch (e) {
      console.warn("Failed to load dictation stats:", e);
      setFailed(true);
      setEntries((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh after every finished dictation. listen() resolves later than
    // a quick unmount, so unlisten right away if we are already gone.
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    events.transcriptionCompleteEvent
      .listen(() => load())
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      })
      .catch((e) => console.warn("Failed to listen for dictations:", e));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [load]);

  const s = useMemo(() => computeInsights(entries ?? []), [entries]);
  const num = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const fmtDuration = (minutes: number) => {
    const d = durationParts(minutes);
    return { value: num.format(d.value), unit: t(`insights.units.${d.unit}`) };
  };

  const week = fmtDuration(s.weekMinutesSaved);
  const total = fmtDuration(s.totalMinutesSaved);
  const reached = s.weekGoalProgress >= 1;
  const maxDay = Math.max(1, ...s.days.map((d) => d.words));
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });

  if (entries === null) {
    return <div className="max-w-3xl w-full mx-auto" aria-busy="true" />;
  }

  return (
    <div className="max-w-3xl w-full mx-auto space-y-4">
      {failed && (
        <p className="text-xs text-error px-1" role="alert">
          {t("insights.error")}
        </p>
      )}

      {/* Gauge card */}
      <section className="glass-card relative overflow-hidden rounded-[16px] border border-line bg-surface px-6 pt-6 pb-5">
        <div className="flex items-start justify-between">
          <h2 className="text-[12px] font-medium text-ink-3">
            {t("insights.gauge.title")}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              reached ? "bg-accent/15 text-accent" : "bg-surface-2 text-ink-2"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${reached ? "bg-accent" : "bg-ink-3"}`}
            />
            {reached
              ? t("insights.gauge.reached")
              : t("insights.gauge.onTrack")}
          </span>
        </div>
        <Gauge
          progress={s.weekGoalProgress}
          ticks={[
            "0",
            num.format(WEEKLY_GOAL_MINUTES / 2),
            num.format(WEEKLY_GOAL_MINUTES),
          ]}
          ariaLabel={t("insights.gauge.aria", {
            value: week.value,
            unit: week.unit,
            goal: WEEKLY_GOAL_MINUTES,
          })}
        >
          <span className="text-[12px] text-ink-3">
            {t("insights.gauge.label")}
          </span>
          <span className="title-display mt-1 flex items-baseline gap-1.5 text-text">
            <span
              className="text-[52px] leading-none font-semibold"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {week.value}
            </span>
            <span className="text-[17px] font-medium text-ink-2">
              {week.unit}
            </span>
          </span>
          <span className="mt-3 rounded-[8px] bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2">
            {t("insights.gauge.goal", { value: WEEKLY_GOAL_MINUTES })}
          </span>
        </Gauge>
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            key: "words",
            value: num.format(s.totalWords),
            unit: "",
          },
          { key: "dictations", value: num.format(s.dictations), unit: "" },
          { key: "total", value: total.value, unit: total.unit },
        ].map((tile) => (
          <div
            key={tile.key}
            className="glass-card rounded-[14px] border border-line bg-surface px-4 py-3.5"
          >
            <p className="text-[12px] text-ink-3">
              {t(`insights.tiles.${tile.key}`)}
            </p>
            <p
              className="title-display mt-1 text-[26px] leading-tight font-semibold text-text"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {tile.value}
              {tile.unit && (
                <span className="ms-1 text-[14px] font-medium text-ink-2">
                  {tile.unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Last 7 days */}
      <section className="glass-card rounded-[16px] border border-line bg-surface px-5 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[12px] font-medium text-ink-3">
            {t("insights.chart.title")}
          </h2>
          <span className="text-[12px] text-ink-3">
            {t("insights.chart.today", { count: s.wordsToday })}
          </span>
        </div>
        <div className="mt-4 flex h-28 items-end gap-3" role="list">
          {s.days.map((d, i) => {
            const isToday = i === s.days.length - 1;
            const h = d.words === 0 ? 3 : Math.max(6, (d.words / maxDay) * 100);
            return (
              <div
                key={d.start}
                role="listitem"
                aria-label={t("insights.chart.bar", {
                  day: weekday.format(d.start),
                  count: d.words,
                })}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="relative flex h-24 w-full items-end justify-center">
                  <div
                    className={`w-full max-w-9 rounded-[6px] transition-[height] duration-500 ${
                      isToday
                        ? "bg-accent shadow-[0_0_18px_-2px_var(--color-accent)]"
                        : "bg-surface-2 border border-line"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span
                  className={`text-[11px] ${isToday ? "text-text font-medium" : "text-ink-3"}`}
                >
                  {weekday.format(d.start)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {s.dictations === 0 && (
        <p className="px-1 text-[13px] text-ink-2">{t("insights.empty")}</p>
      )}
      <p className="px-1 text-[11px] text-ink-3">
        {t("insights.assumption", {
          typing: TYPING_WPM,
          speaking: SPEAKING_WPM,
        })}
      </p>
    </div>
  );
};
