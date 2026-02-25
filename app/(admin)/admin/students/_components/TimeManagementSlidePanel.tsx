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
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  const loadData = useCallback(
    (sid: string) => {
      startTransition(async () => {
        const [exclusionsResult, academiesResult] = await Promise.all([
          getStudentExclusionsForAdmin(sid),
          getStudentAcademiesWithSchedulesForAdmin(sid),
        ]);
        setData({
          exclusions: exclusionsResult.data ?? [],
          academies: academiesResult.data ?? [],
        });
        setDataLoaded(true);
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
      {isPending || (!data && !dataLoaded) ? (
        <div className="flex flex-col gap-4">
          <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
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
