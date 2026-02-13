"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { ConsultationPanelContent } from "./ConsultationPanelContent";
import { fetchConsultationData } from "@/lib/domains/consulting/actions/fetchConsultationData";
import type { ConsultationPanelData } from "@/lib/domains/consulting/actions/fetchConsultationData";

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
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  useEffect(() => {
    const key = isOpen ? studentId : "";

    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (!key) {
      const id = requestAnimationFrame(() => setData(null));
      return () => cancelAnimationFrame(id);
    }

    startTransition(async () => {
      const result = await fetchConsultationData(studentId);
      setData(result);
    });
  }, [isOpen, studentId]);

  const handleRefresh = () => {
    startTransition(async () => {
      const result = await fetchConsultationData(studentId);
      setData(result);
    });
  };

  return (
    <SlideOverPanel
      id="consultation-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`상담 관리${studentLabel ? ` - ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      {!data ? (
        <div className="flex flex-col gap-4">
          <div className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : (
        <ConsultationPanelContent
          studentId={studentId}
          data={data}
          onRefresh={handleRefresh}
          isRefreshing={isPending}
        />
      )}
    </SlideOverPanel>
  );
}
