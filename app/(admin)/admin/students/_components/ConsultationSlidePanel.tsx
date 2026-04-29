"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { ConsultationPanelContent } from "./ConsultationPanelContent";
import { fetchConsultationData } from "@/lib/domains/consulting/actions/fetchConsultationData";
import type { ConsultationPanelData } from "@/lib/domains/consulting/actions/fetchConsultationData";
import { PanelErrorRetry } from "./PanelErrorRetry";

type ConsultationSlidePanelProps = {
  studentId: string;
  studentLabel?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ConsultationSlidePanel({
  studentId,
  studentLabel,
  isOpen,
  onClose,
}: ConsultationSlidePanelProps) {
  const [data, setData] = useState<ConsultationPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchConsultationData(studentId);
        setData(result);
      } catch (err) {
        console.error("[ConsultationSlidePanel] fetch failed", err);
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      }
    });
  }, [studentId]);

  useEffect(() => {
    const key = isOpen ? studentId : "";

    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (!key) {
      const id = requestAnimationFrame(() => {
        setData(null);
        setError(null);
      });
      return () => cancelAnimationFrame(id);
    }

    loadData();
  }, [isOpen, studentId, loadData]);

  return (
    <SlideOverPanel
      id="consultation-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`상담 관리${studentLabel ? ` - ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      {error ? (
        <PanelErrorRetry message={error} onRetry={loadData} />
      ) : !data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-48 animate-pulse rounded-lg bg-bg-tertiary" />
        </div>
      ) : (
        <ConsultationPanelContent
          studentId={studentId}
          data={data}
          onRefresh={loadData}
          isRefreshing={isPending}
        />
      )}
    </SlideOverPanel>
  );
}
