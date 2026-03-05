"use client";

import { useEffect, useRef } from "react";
import { FileCard } from "./FileCard";
import { markDistributionViewedAction, markDistributionDownloadedAction } from "@/lib/domains/drive/actions/distribution";
import type { DistributionWithFile } from "@/lib/domains/drive/types";

interface DistributionCardProps {
  distribution: DistributionWithFile;
  signedUrl?: string;
}

export function DistributionCard({ distribution, signedUrl }: DistributionCardProps) {
  const markedRef = useRef(false);

  // Auto-mark as viewed on mount
  useEffect(() => {
    if (!markedRef.current && !distribution.viewed_at) {
      markedRef.current = true;
      markDistributionViewedAction(distribution.id);
    }
  }, [distribution.id, distribution.viewed_at]);

  return (
    <div className="relative">
      {/* Updated badge */}
      {distribution.is_updated && (
        <span className="absolute -top-1.5 -right-1.5 z-10 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-500 text-white">
          업데이트
        </span>
      )}

      {/* Title + description header */}
      <div className="px-3 pt-3 pb-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {distribution.title}
        </p>
        {distribution.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {distribution.description}
          </p>
        )}
      </div>

      <FileCard
        file={distribution.file}
        signedUrl={signedUrl}
        readOnly
        onDownload={() => markDistributionDownloadedAction(distribution.id)}
      />
    </div>
  );
}
