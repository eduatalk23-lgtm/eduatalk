"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { crossRefQueryOptions, edgesQueryOptions } from "@/lib/query-options/studentRecord";
import {
  detectAllCrossReferences,
  EDGE_TYPE_META,
  type CrossRefEdge,
  type CrossRefInput,
} from "@/lib/domains/student-record/cross-reference";
import type { ActivityTag, RecordType, CourseAdequacyResult } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { ArrowRight, Link2 } from "lucide-react";
import { useSidePanel } from "@/components/side-panel";

// ============================================
// Props
// ============================================

interface CrossReferenceChipsProps {
  studentId: string;
  tenantId: string;
  /** 현재 영역의 record IDs */
  currentRecordIds: Set<string>;
  /** 현재 record_type */
  currentRecordType: RecordType;
  /** 현재 학년 */
  currentGrade: number;
  /** 세특인 경우 과목명 */
  subjectName?: string;
  /** DiagnosisTabData.activityTags */
  allTags?: ActivityTag[];
  /** DiagnosisTabData.courseAdequacy */
  courseAdequacy?: CourseAdequacyResult | null;
}

// ============================================
// Component
// ============================================

export function CrossReferenceChips({
  studentId,
  tenantId,
  currentRecordIds,
  currentRecordType,
  currentGrade,
  subjectName,
  allTags,
  courseAdequacy,
}: CrossReferenceChipsProps) {
  const sidePanel = useSidePanel();

  // Phase E4: DB 영속화 엣지 우선 조회
  const { data: persistedEdges } = useQuery(edgesQueryOptions(studentId, tenantId));

  // Fallback: 런타임 계산용 데이터
  const { data: crossRefData } = useQuery(crossRefQueryOptions(studentId, tenantId));

  const edges = useMemo<CrossRefEdge[]>(() => {
    // DB 엣지가 있으면 → 현재 영역의 엣지만 필터링
    if (persistedEdges && persistedEdges.length > 0) {
      return persistedEdges
        .filter((e) => currentRecordIds.has(e.source_record_id))
        .map((e) => ({
          type: e.edge_type,
          targetRecordType: e.target_record_type as CrossRefEdge["targetRecordType"],
          targetRecordId: e.target_record_id ?? undefined,
          targetLabel: e.target_label,
          reason: e.reason,
          sharedCompetencies: e.shared_competencies ?? undefined,
        }));
    }

    // Fallback: 런타임 계산
    if (!allTags) return [];
    const input: CrossRefInput = {
      currentRecordIds,
      currentRecordType,
      currentGrade,
      subjectName,
      allTags,
      storylineLinks: crossRefData?.storylineLinks ?? [],
      readingLinks: crossRefData?.readingLinks ?? [],
      courseAdequacy: courseAdequacy ?? null,
      recordLabelMap: new Map(Object.entries(crossRefData?.recordLabelMap ?? {})),
      readingLabelMap: new Map(Object.entries(crossRefData?.readingLabelMap ?? {})),
      recordContentMap: new Map(Object.entries(crossRefData?.recordContentMap ?? {})),
    };
    return detectAllCrossReferences(input);
  }, [
    currentRecordIds,
    currentRecordType,
    currentGrade,
    subjectName,
    allTags,
    courseAdequacy,
    crossRefData,
    persistedEdges,
  ]);

  if (edges.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-secondary)] p-3">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          연결된 영역
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{edges.length}건</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {edges.map((edge, i) => {
          const meta = EDGE_TYPE_META[edge.type];
          return (
            <button
              type="button"
              key={`${edge.type}-${edge.targetLabel}-${i}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-80",
                meta.bgColor,
                meta.color,
              )}
              title={`${meta.label}: ${edge.reason}`}
              onClick={() => sidePanel.openApp("connections")}
            >
              <span className="opacity-70">{meta.label}</span>
              <ArrowRight className="h-2.5 w-2.5 opacity-50" />
              <span>{edge.targetLabel}</span>
              {edge.sharedCompetencies && edge.sharedCompetencies.length > 1 && (
                <span className="rounded-full bg-white/50 px-1 text-[9px] dark:bg-black/20">
                  {edge.sharedCompetencies.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
