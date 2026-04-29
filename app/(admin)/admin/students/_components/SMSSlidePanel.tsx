"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { SMSPanelContent } from "./sms/SMSPanelContent";
import { fetchSMSPanelData } from "@/lib/domains/sms/actions/panelData";
import type { SMSPanelData } from "@/lib/domains/sms/types";
import {
  listCustomTemplates,
  getStudentSMSHistory,
} from "@/lib/domains/sms/actions/customTemplates";
import { PanelErrorRetry } from "./PanelErrorRetry";

type SMSSlidePanelProps = {
  studentId: string;
  studentName: string;
  studentLabel?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function SMSSlidePanel({
  studentId,
  studentName,
  studentLabel,
  isOpen,
  onClose,
}: SMSSlidePanelProps) {
  const [data, setData] = useState<SMSPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  const loadData = useCallback(
    (sid: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const result = await fetchSMSPanelData(sid);
          if (result.success && result.data) {
            setData(result.data);
          } else {
            setError(result.error ?? "데이터를 불러올 수 없습니다");
          }
        } catch (err) {
          console.error("[SMSSlidePanel] fetch failed", err);
          setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
        }
      });
    },
    []
  );

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

    loadData(studentId);
  }, [isOpen, studentId, loadData]);

  const handleRefreshTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await listCustomTemplates({ activeOnly: true });
      setData((prev) =>
        prev ? { ...prev, customTemplates: result.success ? result.data ?? [] : [] } : null
      );
    });
  }, []);

  const handleRefreshHistory = useCallback(() => {
    startTransition(async () => {
      const result = await getStudentSMSHistory(studentId);
      setData((prev) =>
        prev ? { ...prev, smsHistory: result.success ? result.data ?? [] : [] } : null
      );
    });
  }, [studentId]);

  return (
    <SlideOverPanel
      id="sms-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`SMS 발송${studentLabel ? ` - ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      {error ? (
        <PanelErrorRetry message={error} onRetry={() => loadData(studentId)} />
      ) : !data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-48 animate-pulse rounded-lg bg-bg-tertiary" />
        </div>
      ) : (
        <SMSPanelContent
          studentId={studentId}
          studentName={studentName}
          phoneData={data.phoneData}
          customTemplates={data.customTemplates}
          smsHistory={data.smsHistory}
          academyName={data.academyName}
          onRefreshTemplates={handleRefreshTemplates}
          onRefreshHistory={handleRefreshHistory}
        />
      )}
    </SlideOverPanel>
  );
}
