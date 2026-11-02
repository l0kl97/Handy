import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyGlass, glassSupported } from "@/lib/utils/glass";

interface GlassEffectToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/** macOS only: translucent vibrancy behind the window. */
export const GlassEffectToggle: React.FC<GlassEffectToggleProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    if (!glassSupported()) return null;

    const enabled = getSetting("glass_effect") ?? false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={async (value) => {
          // Optimistic: the window changes at once. The store reverts the
          // value if the write fails, so re-apply whatever actually stuck.
          applyGlass(value);
          await updateSetting("glass_effect", value);
          applyGlass(
            useSettingsStore.getState().settings?.glass_effect ?? false,
          );
        }}
        isUpdating={isUpdating("glass_effect")}
        label={t("glass.title")}
        description={t("glass.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);

GlassEffectToggle.displayName = "GlassEffectToggle";
