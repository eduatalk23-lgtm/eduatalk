"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ConsultationPanelContent } from "../../ConsultationPanelContent";
import { fetchConsultationData } from "@/lib/domains/consulting/actions/fetchConsultationData";
import type { ConsultationPanelData } from "@/lib/domains/consulting/actions/fetchConsultationData";
import { PanelErrorRetry } from "../../PanelErrorRetry";

export function ConsultationTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<ConsultationPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchConsultationData(studentId);
        setData(result);
      } catch (err) {
        console.error("[ConsultationTab] fetch failed", err);
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      }
    });
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <ConsultationPanelContent
      studentId={studentId}
      data={data}
      onRefresh={loadData}
      isRefreshing={isPending}
    />
  );
}
