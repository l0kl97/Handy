import React from "react";
import { InfoTooltip } from "./InfoTooltip";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
  /** Horizontal only: the control takes the row's free width, for content that fits itself to it. */
  grow?: boolean;
}

export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  descriptionMode = "tooltip",
  grouped = false,
  layout = "horizontal",
  disabled = false,
  tooltipPosition = "top",
  grow = false,
}) => {
  const info = (
    <InfoTooltip
      text={description}
      placement={tooltipPosition === "bottom" ? "below" : "above"}
    />
  );

  const containerClasses = grouped
    ? "px-4 py-3"
    : "px-4 py-3 rounded-[12px] border border-line bg-surface";

  if (layout === "stacked") {
    if (descriptionMode === "tooltip") {
      return (
        <div className={containerClasses}>
          <div className="flex items-center gap-2 mb-2">
            <h3
              className={`text-[13px] font-medium text-text ${disabled ? "opacity-40" : ""}`}
            >
              {title}
            </h3>
            {info}
          </div>
          <div className="w-full">{children}</div>
        </div>
      );
    }

    return (
      <div className={containerClasses}>
        <div className="mb-2">
          <h3
            className={`text-[13px] font-medium text-text ${disabled ? "opacity-40" : ""}`}
          >
            {title}
          </h3>
          <p
            className={`text-xs text-ink-3 mt-0.5 ${disabled ? "opacity-40" : ""}`}
          >
            {description}
          </p>
        </div>
        <div className="w-full">{children}</div>
      </div>
    );
  }

  // Horizontal layout (default)
  const horizontalContainerClasses = `${
    grouped
      ? "flex items-center justify-between min-h-[52px] px-4 py-2"
      : "flex items-center justify-between min-h-[52px] px-4 py-2 rounded-[12px] border border-line bg-surface"
  }${grow ? " gap-4" : ""}`;
  const titleClasses = grow ? "max-w-2/3 shrink-0" : "max-w-2/3";
  const controlClasses = grow
    ? "relative flex min-w-0 flex-1 justify-end"
    : "relative";

  if (descriptionMode === "tooltip") {
    return (
      <div className={horizontalContainerClasses}>
        <div className={titleClasses}>
          <div className="flex items-center gap-2">
            <h3
              className={`text-[13px] font-medium text-text ${disabled ? "opacity-40" : ""}`}
            >
              {title}
            </h3>
            {info}
          </div>
        </div>
        <div className={controlClasses}>{children}</div>
      </div>
    );
  }

  return (
    <div className={horizontalContainerClasses}>
      <div className={titleClasses}>
        <h3
          className={`text-[13px] font-medium text-text ${disabled ? "opacity-40" : ""}`}
        >
          {title}
        </h3>
        <p
          className={`text-xs text-ink-3 mt-0.5 ${disabled ? "opacity-40" : ""}`}
        >
          {description}
        </p>
      </div>
      <div className={controlClasses}>{children}</div>
    </div>
  );
};
