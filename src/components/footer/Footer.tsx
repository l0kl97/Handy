import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

import ModelSelector from "../model-selector";
import UpdateChecker from "../update-checker";
import NoticeChip from "./NoticeChip";
import TranscriptionStatus from "./TranscriptionStatus";

interface FooterProps {
  onShowHistory: () => void;
}

const Footer: React.FC<FooterProps> = ({ onShowHistory }) => {
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.2");
      }
    };

    fetchVersion();
  }, []);

  return (
    <div className="w-full shrink-0 border-t border-line">
      <div className="flex justify-between items-center h-11 text-xs px-8 text-ink-3">
        <div className="flex items-center gap-4">
          <ModelSelector />
          <TranscriptionStatus onShowHistory={onShowHistory} />
        </div>

        <div className="flex items-center gap-3">
          {/* Update Status */}
          <div className="flex items-center gap-1">
            <UpdateChecker />
            <span className="text-line-strong">·</span>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="font-mono text-[11px] tracking-tight">
              v{version}
            </span>
          </div>
          <NoticeChip />
        </div>
      </div>
    </div>
  );
};

export default Footer;
