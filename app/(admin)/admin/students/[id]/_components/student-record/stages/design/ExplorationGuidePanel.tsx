"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  guideAssignmentsQueryOptions,
  explorationGuideKeys,
} from "@/lib/query-options/explorationGuide";
import { assignGuideAction } from "@/lib/domains/guide/actions/assignment";
import { GuideSearchSection } from "../../GuideSearchSection";
import { GuideAssignmentList } from "../../GuideAssignmentList";
import { GuideDetailDialog } from "../../GuideDetailDialog";

interface ExplorationGuidePanelProps {
  studentId: string;
  studentGrade: number;
  tenantId: string;
  schoolName?: string;
  schoolYear: number;
  studentClassificationId?: number;
  studentClassificationName?: string;
}

type TabKey = "search" | "assignments";

export function ExplorationGuidePanel({
  studentId,
  studentGrade,
  schoolName,
  schoolYear,
  studentClassificationId,
  studentClassificationName,
}: ExplorationGuidePanelProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("assignments");
  const [detailGuideId, setDetailGuideId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [, startTransition] = useTransition();

  // 현재 배정 목록 (assignedGuideIds 구성용)
  const { data: assignmentsRes } = useQuery(
    guideAssignmentsQueryOptions(studentId, schoolYear),
  );
  const assignedGuideIds = useMemo(() => {
    const set = new Set<string>();
    if (assignmentsRes?.success) {
      for (const a of assignmentsRes.data ?? []) {
        set.add(a.guide_id);
      }
    }
    return set;
  }, [assignmentsRes]);

  const invalidateAssignments = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: explorationGuideKeys.assignments(studentId, schoolYear),
    });
    queryClient.invalidateQueries({
      queryKey: explorationGuideKeys.completionRate(studentId),
    });
  }, [queryClient, studentId, schoolYear]);

  function handleSelectGuide(guideId: string) {
    setDetailGuideId(guideId);
    setDetailOpen(true);
  }

  function handleAssignGuide(guideId: string, notes?: string) {
    startTransition(async () => {
      const result = await assignGuideAction({
        studentId,
        guideId,
        schoolYear,
        grade: studentGrade,
        schoolName,
        notes: notes || undefined,
      });
      if (result.success) {
        invalidateAssignments();
        setDetailOpen(false);
        setTab("assignments");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 탭 */}
      <div className="flex gap-1 border-b">
        {(
          [
            { key: "assignments" as const, label: "배정 현황" },
            { key: "search" as const, label: "추천/검색" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label}
            {t.key === "assignments" && assignedGuideIds.size > 0 && (
              <span className="ml-1 text-xs text-gray-400">
                ({assignedGuideIds.size})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === "assignments" && (
        <GuideAssignmentList
          studentId={studentId}
          schoolYear={schoolYear}
          onSelectGuide={handleSelectGuide}
        />
      )}

      {tab === "search" && (
        <GuideSearchSection
          onSelectGuide={handleSelectGuide}
          onAssignGuide={(guideId) => handleAssignGuide(guideId)}
          assignedGuideIds={assignedGuideIds}
          studentClassificationId={studentClassificationId}
          studentClassificationName={studentClassificationName}
        />
      )}

      {/* 상세 Dialog */}
      <GuideDetailDialog
        guideId={detailGuideId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAssign={(guideId, notes) => handleAssignGuide(guideId, notes)}
        isAssigned={detailGuideId ? assignedGuideIds.has(detailGuideId) : false}
      />
    </div>
  );
}
