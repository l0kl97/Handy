import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="space-y-2.5">
      {title && (
        <div className="px-1">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-ink-3 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className="bg-surface border border-line rounded-[12px] shadow-card overflow-visible">
        <div className="divide-y divide-line">{children}</div>
      </div>
    </section>
  );
};
