"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { TimeManagementSectionClient } from "../../../[id]/_components/time-management/TimeManagementSectionClient";
import {
  getStudentExclusionsForAdmin,
  getStudentAcademiesWithSchedulesForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";
import type { PlanExclusion } from "@/lib/types/plan/domain";
import type { AcademyWithSchedules } from "@/lib/domains/admin-plan/actions/timeManagement";
import { PanelErrorRetry } from "../../PanelErrorRetry";

type TimeManagementData = {
  exclusions: PlanExclusion[];
  academies: AcademyWithSchedules[];
};

export function TimeManagementTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<TimeManagementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const [exclusionsResult, academiesResult] = await Promise.all([
          getStudentExclusionsForAdmin(studentId),
          getStudentAcademiesWithSchedulesForAdmin(studentId),
        ]);
        setData({
          exclusions: exclusionsResult.data ?? [],
          academies: academiesResult.data ?? [],
        });
      } catch (err) {
        console.error("[TimeManagementTab] fetch failed", err);
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      }
    });
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) return <PanelErrorRetry message={error} onRetry={loadData} />;
  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-10 animate-pulse rounded-lg bg-bg-tertiary" />
        <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
        <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
        <div className="h-48 animate-pulse rounded-lg bg-bg-tertiary" />
      </div>
    );
  }

  return (
    <TimeManagementSectionClient
      studentId={studentId}
      initialExclusions={data.exclusions}
      initialAcademies={data.academies}
      onRefresh={loadData}
    />
  );
}
