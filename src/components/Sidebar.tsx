import React from "react";
import { useTranslation } from "react-i18next";
import {
  BookA,
  Cog,
  FlaskConical,
  Gauge,
  History,
  Info,
  Sparkles,
  Cpu,
} from "lucide-react";
import HandyHand from "./icons/HandyHand";
import { useSettings } from "../hooks/useSettings";
import {
  GeneralSettings,
  AdvancedSettings,
  HistorySettings,
  AboutSettings,
  PostProcessingSettings,
  ModelsSettings,
} from "./settings";
import { InsightsPage } from "./insights/InsightsPage";
import { DictionaryPage } from "./dictionary/DictionaryPage";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: any;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  /** `null` when App renders the section itself (Debug, with its handlers). */
  component: React.ComponentType | null;
  enabled: (settings: any) => boolean;
}

export const SECTIONS_CONFIG = {
  insights: {
    labelKey: "sidebar.insights",
    icon: Gauge,
    component: InsightsPage,
    enabled: () => true,
  },
  general: {
    labelKey: "sidebar.general",
    icon: HandyHand,
    component: GeneralSettings,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  dictionary: {
    labelKey: "sidebar.dictionary",
    icon: BookA,
    component: DictionaryPage,
    enabled: () => true,
  },
  models: {
    labelKey: "sidebar.models",
    icon: Cpu,
    component: ModelsSettings,
    enabled: () => true,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: Cog,
    component: AdvancedSettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: Sparkles,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: null,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <nav className="glass-pane flex flex-col w-52 shrink-0 h-full bg-canvas transition-[margin,border-radius] duration-300">
      {/* Inset title bar: the traffic lights sit here, and it drags the window. */}
      <div data-tauri-drag-region className="h-[52px] shrink-0" />
      {/* Wordmark: hand glyph + name in SF Pro Display, mono like Profound's. */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-5 pb-6 text-text"
      >
        <HandyHand width={18} height={18} />
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="title-display text-[17px] font-semibold">Handy</span>
      </div>
      <div className="flex flex-col w-full gap-0.5 px-3">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              type="button"
              key={section.id}
              aria-current={isActive ? "page" : undefined}
              className={`group flex gap-2.5 items-center h-8 px-2.5 w-full rounded-[8px] cursor-pointer text-start transition-colors duration-150 ${
                isActive
                  ? "bg-line-strong/70 text-text"
                  : "text-ink-2 hover:text-text hover:bg-wash"
              }`}
              onClick={() => onSectionChange(section.id)}
            >
              <Icon
                width={16}
                height={16}
                strokeWidth={1.75}
                className={`shrink-0 transition-colors ${isActive ? "text-text" : "text-ink-3 group-hover:text-ink-2"}`}
              />
              <span className="text-[13px] font-medium tracking-[-0.005em] truncate">
                {t(section.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
