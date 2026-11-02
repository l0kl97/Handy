import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettings } from "../../hooks/useSettings";
import {
  fetchLatestUpstream,
  isNewer,
  type UpstreamRelease,
} from "@/lib/updates/upstream";

interface UpdateCheckerProps {
  className?: string;
}

/**
 * Fork: notice-only update check. This build is a fork of Handy, so the
 * official updater would replace it with stock Handy; it is never used.
 * Instead we tell the user when upstream has a newer release and link to its
 * notes. Bringing it into the fork is a merge (docs/features/upstream-updates.md).
 */
const UpdateChecker: React.FC<UpdateCheckerProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState(false);
  const [release, setRelease] = useState<UpstreamRelease | null>(null);
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [failed, setFailed] = useState(false);
  const upToDateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const checkingRef = useRef(false);

  const { settings, isLoading, updateChecksLocked } = useSettings();
  const settingsLoaded =
    !isLoading && settings !== null && updateChecksLocked !== null;
  const updateChecksEnabled =
    (settings?.update_checks_enabled ?? false) && updateChecksLocked === false;

  const checkForUpdates = useCallback(async (manual: boolean) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setIsChecking(true);
    setFailed(false);
    try {
      const [latest, current] = await Promise.all([
        fetchLatestUpstream(),
        getVersion(),
      ]);
      if (!latest) {
        setFailed(manual);
        return;
      }
      if (isNewer(latest.version, current)) {
        setRelease(latest);
        setShowUpToDate(false);
      } else {
        setRelease(null);
        if (manual) {
          setShowUpToDate(true);
          clearTimeout(upToDateTimeoutRef.current);
          upToDateTimeoutRef.current = setTimeout(
            () => setShowUpToDate(false),
            3000,
          );
        }
      }
    } catch (e) {
      console.warn("Update check failed:", e);
      setFailed(manual);
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!updateChecksEnabled) {
      clearTimeout(upToDateTimeoutRef.current);
      setRelease(null);
      setShowUpToDate(false);
      setFailed(false);
      return;
    }
    checkForUpdates(false);
    // The tray's "Check for updates" lands here too.
    const unlisten = listen("check-for-updates", () => checkForUpdates(true));
    return () => {
      clearTimeout(upToDateTimeoutRef.current);
      unlisten.then((fn) => fn());
    };
  }, [settingsLoaded, updateChecksEnabled, checkForUpdates]);

  if (!updateChecksEnabled) {
    return (
      <span className={`text-ink-2 tabular-nums ${className}`}>
        {t("footer.updateCheckingDisabled")}
      </span>
    );
  }

  if (release) {
    return (
      <button
        type="button"
        onClick={() => openUrl(release.url)}
        title={t("footer.upstreamNotes")}
        className={`inline-flex items-center gap-1.5 font-medium text-accent transition-opacity hover:opacity-80 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {t("footer.upstreamAvailable", { version: release.version })}
      </button>
    );
  }

  const label = isChecking
    ? t("footer.checkingUpdates")
    : showUpToDate
      ? t("footer.upToDate")
      : failed
        ? t("footer.upstreamCheckFailed")
        : t("footer.checkForUpdates");

  return (
    <button
      type="button"
      onClick={() => checkForUpdates(true)}
      disabled={isChecking}
      className={`text-ink-2 tabular-nums transition-colors hover:text-text disabled:opacity-60 ${className}`}
    >
      {label}
    </button>
  );
};

export default UpdateChecker;
