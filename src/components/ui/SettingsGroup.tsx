import React from "react";
import { usePageTitle } from "./pageTitle";

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
  const pageTitle = usePageTitle();
  // Don't repeat the toolbar's page title as a group heading.
  const heading =
    title && title.trim().toLowerCase() !== pageTitle?.trim().toLowerCase()
      ? title
      : undefined;
  return (
    <section className="space-y-2.5">
      {(heading || description) && (
        <div className="px-1">
          {heading && (
            <h2 className="text-[12px] font-medium text-ink-3">{heading}</h2>
          )}
          {description && (
            <p className="text-xs text-ink-3 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className="glass-card bg-surface border border-line rounded-[12px] overflow-visible">
        <div className="divide-y divide-line">{children}</div>
      </div>
    </section>
  );
};
