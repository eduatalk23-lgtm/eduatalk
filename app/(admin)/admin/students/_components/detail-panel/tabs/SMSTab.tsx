"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { SMSPanelContent } from "../../sms/SMSPanelContent";
import { fetchSMSPanelData } from "@/lib/domains/sms/actions/panelData";
import type { SMSPanelData } from "@/lib/domains/sms/types";
import {
  listCustomTemplates,
  getStudentSMSHistory,
} from "@/lib/domains/sms/actions/customTemplates";
import { PanelErrorRetry } from "../../PanelErrorRetry";

export function SMSTab({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [data, setData] = useState<SMSPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchSMSPanelData(studentId);
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error ?? "데이터를 불러올 수 없습니다");
        }
      } catch (err) {
        console.error("[SMSTab] fetch failed", err);
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      }
    });
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefreshTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await listCustomTemplates({ activeOnly: true });
      setData((prev) =>
        prev ? { ...prev, customTemplates: result.success ? result.data ?? [] : [] } : null,
      );
    });
  }, []);

  const handleRefreshHistory = useCallback(() => {
    startTransition(async () => {
      const result = await getStudentSMSHistory(studentId);
      setData((prev) =>
        prev ? { ...prev, smsHistory: result.success ? result.data ?? [] : [] } : null,
      );
    });
  }, [studentId]);

  if (error) return <PanelErrorRetry message={error} onRetry={loadData} />;
  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
        <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
        <div className="h-48 animate-pulse rounded-lg bg-bg-tertiary" />
      </div>
    );
  }

  return (
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
  );
}
