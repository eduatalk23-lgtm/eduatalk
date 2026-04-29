"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { TimeManagementSectionClient } from "../[id]/_components/time-management/TimeManagementSectionClient";
import {
  getStudentExclusionsForAdmin,
  getStudentAcademiesWithSchedulesForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";
import type { PlanExclusion } from "@/lib/types/plan/domain";
import type { AcademyWithSchedules } from "@/lib/domains/admin-plan/actions/timeManagement";
import { PanelErrorRetry } from "./PanelErrorRetry";

type TimeManagementSlidePanelProps = {
  studentId: string;
  studentLabel?: string;
  isOpen: boolean;
  onClose: () => void;
};

type TimeManagementData = {
  exclusions: PlanExclusion[];
  academies: AcademyWithSchedules[];
};

export function TimeManagementSlidePanel({
  studentId,
  studentLabel,
  isOpen,
  onClose,
}: TimeManagementSlidePanelProps) {
  const [data, setData] = useState<TimeManagementData | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  const loadData = useCallback(
    (sid: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const [exclusionsResult, academiesResult] = await Promise.all([
            getStudentExclusionsForAdmin(sid),
            getStudentAcademiesWithSchedulesForAdmin(sid),
          ]);
          setData({
            exclusions: exclusionsResult.data ?? [],
            academies: academiesResult.data ?? [],
          });
          setDataLoaded(true);
        } catch (err) {
          console.error("[TimeManagementSlidePanel] fetch failed", err);
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
        setDataLoaded(false);
        setError(null);
      });
      return () => cancelAnimationFrame(id);
    }

    loadData(studentId);
  }, [isOpen, studentId, loadData]);

  const handleRefresh = () => {
    loadData(studentId);
  };

  return (
    <SlideOverPanel
      id="time-management-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`시간 관리${studentLabel ? ` - ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      {error ? (
        <PanelErrorRetry message={error} onRetry={() => loadData(studentId)} />
      ) : isPending || (!data && !dataLoaded) ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-10 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-48 animate-pulse rounded-lg bg-bg-tertiary" />
        </div>
      ) : (
        <TimeManagementSectionClient
          studentId={studentId}
          initialExclusions={data?.exclusions ?? []}
          initialAcademies={data?.academies ?? []}
          onRefresh={handleRefresh}
        />
      )}
    </SlideOverPanel>
  );
}
