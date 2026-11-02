import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "../ui/SettingsGroup";
import { CustomWords } from "../settings/CustomWords";

/**
 * Fork: the custom-words dictionary as its own sidebar page, so names and
 * terms can be added quickly (it used to sit deep in Advanced).
 */
export const DictionaryPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl w-full mx-auto space-y-4">
      <SettingsGroup>
        <CustomWords descriptionMode="inline" grouped />
      </SettingsGroup>
      <p className="px-1 text-[12px] leading-[1.5] text-ink-3">
        {t("dictionary.hint")}
      </p>
    </div>
  );
};
