"use client";

import { useMemo, useState } from "react";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { FileText, Search, Compass, PenLine, BarChart3, BookOpen } from "lucide-react";
import type { AnalysisTagLike } from "../../shared/AnalysisBlocks";
import { calculateReflectionSummary, type ReflectionSummary, type SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";
import type { CourseAdequacyResult } from "@/lib/domains/student-record";
import {
  type LayerKey,
  type LayerPerspective,
  layerToSetekTab,
  isLayerSupportedInSetek,
  getDirectionMode,
  LAYER_DEFINITIONS,
} from "@/lib/domains/student-record/layer-view";
import { SetekTableRow } from "../../setek/SetekTableRow";
import { PlannedSubjectRow, AddSetekForm } from "../../setek/SetekFormParts";

type Subject = { id: string; name: string };

export type SetekLayerTab =
  | "neis"
  | "draft"
  | "direction"
  | "analysis"
  | "draft_analysis"
  | "guide";

type ActivityTagLike = AnalysisTagLike;

export interface SetekGuideItemLike {
  /** DB row id — manual 가이드 수정/삭제 시 필요. transform에서 주입 */
  id?: string;
  /** 가이드 소스 — 'ai' | 'manual'. 없으면 legacy(=ai로 간주) */
  source?: "ai" | "manual";
  /** 원본 subject_id — 컨설턴트가 새 manual 가이드를 만들 때 필요 */
  subjectId?: string;
  subjectName: string;
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
  guideMode?: "retrospective" | "prospective";
}

type PlannedSubject = {
  subjectId: string;
  subjectName: string;
  semester: number;
};

type SetekEditorProps = {
  seteks: RecordSetek[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  subjects: Subject[];
  grade: number;
  diagnosisActivityTags?: ActivityTagLike[];
  setekGuideItems?: SetekGuideItemLike[];
  guideAssignments?: Array<{
    id: string;
    guide_id: string;
    status: string;
    ai_recommendation_reason?: string | null;
    student_notes?: string | null;
    target_subject_id?: string | null;
    target_activity_type?: string | null;
    school_year?: number;
    exploration_guides?: { id: string; title: string; guide_type?: string };
  }>;
  /** confirmed course plans (세특 미존재인 것만 전달) */
  plannedSubjects?: PlannedSubject[];
  /** G2-5: 진로 소분류 ID (가이드 자동 추천용) */
  studentClassificationId?: number | null;
  /** 학교명 (가이드 배정용) */
  schoolName?: string | null;
  /** G2-1: 교과 이수 적합도 (크로스레퍼런스 COURSE_SUPPORTS용) */
  courseAdequacy?: CourseAdequacyResult | null;
  /** 외부 제어 모드 (legacy — layer가 우선) */
  activeTab?: SetekLayerTab;
  onTabChange?: (tab: SetekLayerTab) => void;
  /** 글로벌 9 레이어 — controlled 진입점. layerToSetekTab으로 4탭에 매핑. */
  layer?: LayerKey;
  /** 글로벌 관점 (AI/컨설턴트) */
  perspective?: LayerPerspective | null;
};

const B = "border border-gray-400 dark:border-gray-500";

// ─── 과목 합산 유틸 ──────────────────────────────────

export type MergedSetekRow = {
  /** 과목명 (같은 과목의 1+2학기를 한 행으로 합산) */
  displayName: string;
  /** 원본 세특 레코드들 (1~2개) */
  records: RecordSetek[];
  /** 정렬용 subject_id */
  subjectId: string;
};

function mergeSeteksBySemester(seteks: RecordSetek[], subjects: Subject[]): MergedSetekRow[] {
  const bySubject = new Map<string, RecordSetek[]>();
  for (const s of seteks) {
    const arr = bySubject.get(s.subject_id) ?? [];
    arr.push(s);
    bySubject.set(s.subject_id, arr);
  }

  const rows: MergedSetekRow[] = [];
  for (const [subjectId, records] of bySubject) {
    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "알 수 없는 과목";
    const sorted = records.sort((a, b) => a.semester - b.semester);
    rows.push({
      displayName: subjectName,
      records: sorted,
      subjectId,
    });
  }
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
}

// ─── 메인 컴포넌트 ──────────────────────────────────

const LAYER_TABS: { key: SetekLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "direction", label: "방향", icon: Compass },
  { key: "analysis", label: "분석", icon: Search },
  { key: "draft_analysis", label: "가안 분석", icon: BarChart3 },
];

const COL_HEADER_LABEL: Record<SetekLayerTab, string> = {
  neis: "세부능력 및 특기사항",
  guide: "탐구 가이드",
  draft: "세특 가안",
  direction: "작성 방향",
  analysis: "역량 분석",
  draft_analysis: "가안 역량 분석",
};

export function SetekEditor({
  seteks,
  studentId,
  schoolYear,
  tenantId,
  subjects,
  grade,
  diagnosisActivityTags,
  setekGuideItems,
  guideAssignments,
  plannedSubjects,
  studentClassificationId,
  schoolName,
  courseAdequacy,
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
  layer,
  perspective,
}: SetekEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [internalTab, setInternalTab] = useState<SetekLayerTab>("neis");

  // 우선순위: layer(9레이어) > controlledTab(레거시) > internalTab
  // layer가 지정되면 layerToSetekTab으로 4탭 매핑. null이면 미지원 → 셀 단위 stub (SetekTableRow에서 처리).
  const mappedFromLayer = layer ? layerToSetekTab(layer) : undefined;
  const isLayerNative = layer == null || isLayerSupportedInSetek(layer);
  const isControlled = layer !== undefined || controlledTab !== undefined;
  const activeTab: SetekLayerTab = layer
    ? (mappedFromLayer ?? "neis")
    : controlledTab ?? internalTab;
  const setActiveTab = controlledOnTabChange ?? setInternalTab;
  const charLimit = getCharLimit("setek", schoolYear);

  // design_direction / improve_direction 분리
  const directionMode = layer ? getDirectionMode(layer) : null;

  const mergedRows = useMemo(() => mergeSeteksBySemester(seteks, subjects), [seteks, subjects]);
  const existingSubjectIds = new Set(seteks.map((s) => s.subject_id));
  const plannedSubjectIds = new Set(plannedSubjects?.map((p) => p.subjectId) ?? []);
  const availableSubjects = subjects.filter(
    (s) => !existingSubjectIds.has(s.id) && !plannedSubjectIds.has(s.id),
  );

  // Wave 5.1e: subject 이름 기준 dedupe — subjects 테이블에 동명 row 가 여러 개인 경우
  //   (2022 개정 교육과정 전환 잔재) mergedRows(실제 setek)와 pendingPlanned(계획만) 에
  //   각각 다른 subject_id 로 같은 이름 row 가 중복 표시되는 문제를 UI 단에서 차단.
  //   setek 이 먼저 있으면(실제 작성된 상태) 계획 row 는 숨긴다.
  const existingSubjectNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of mergedRows) names.add(row.displayName);
    return names;
  }, [mergedRows]);

  const pendingPlanned = useMemo(
    () =>
      (plannedSubjects ?? []).filter(
        (p) =>
          !existingSubjectIds.has(p.subjectId) &&
          !existingSubjectNames.has(p.subjectName),
      ),
    [plannedSubjects, existingSubjectIds, existingSubjectNames],
  );

  const allSetekIds = useMemo(() => new Set(seteks.map((s) => s.id)), [seteks]);

  // 세특 레코드에 속하는 태그 + perspective 분류만 수행한 base 집합.
  // tag_context 분리(analysis vs draft_analysis)는 아래 파생 메모에서 한다.
  const recordScopedTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    let tags = diagnosisActivityTags.filter(
      (t) => t.record_type === "setek" && allSetekIds.has(t.record_id),
    );
    // 분석 레이어 perspective 분류
    // AI = source='ai' && status!='confirmed' (아직 컨설턴트가 손대지 않은 AI 제안)
    // 컨설턴트 = source='manual' || status='confirmed' (컨설턴트가 손댄 모든 것)
    if (perspective === "ai") {
      tags = tags.filter((t) => t.source === "ai" && t.status !== "confirmed");
    } else if (perspective === "consultant") {
      tags = tags.filter((t) => t.source === "manual" || t.status === "confirmed");
    }
    return tags;
  }, [diagnosisActivityTags, allSetekIds, perspective]);

  // NEIS 기반 분석 태그 (tag_context='analysis' 또는 미지정)
  const analysisTags = useMemo(
    () => recordScopedTags.filter((t) => t.tag_context !== "draft_analysis"),
    [recordScopedTags],
  );
  // P8 가안 기반 분석 태그 (tag_context='draft_analysis')
  const draftAnalysisTags = useMemo(
    () => recordScopedTags.filter((t) => t.tag_context === "draft_analysis"),
    [recordScopedTags],
  );
  // 현재 활성 탭이 보여야 할 태그 집합 — SetekTableRow로 전달된다.
  const filteredTags = activeTab === "draft_analysis" ? draftAnalysisTags : analysisTags;

  const subjectNames = useMemo(() => new Set(mergedRows.map((r) => r.displayName)), [mergedRows]);
  const filteredGuideItems = useMemo(() => {
    if (!setekGuideItems) return [];
    // 주의: 세특 가이드는 생성 시 `calculateSchoolYear()`(=학생 현재 학년도)로만 저장되어
    // 학년별로 row가 분리되지 않는다 (generateSetekGuide.ts:140, 226).
    // 여기서 schoolYear 필터를 걸면 과거 학년 슬롯이 빈 상태가 되므로 subjectName만으로 필터한다.
    let items = setekGuideItems.filter((g) => subjectNames.has(g.subjectName));
    // design_direction (prospective) / improve_direction (retrospective) 분리
    if (directionMode) {
      items = items.filter((g) => g.guideMode === directionMode);
    }
    return items;
  }, [setekGuideItems, subjectNames, directionMode]);

  // G3-6: 가이드 키워드 반영률 계산
  const reflectionSummary = useMemo<ReflectionSummary | null>(() => {
    if (filteredGuideItems.length === 0 || mergedRows.length === 0) return null;
    const textMap = new Map<string, string>();
    for (const row of mergedRows) {
      const combined = row.records.map((r) => r.content?.trim() || r.imported_content || "").join(" ");
      textMap.set(row.displayName, combined);
    }
    return calculateReflectionSummary(filteredGuideItems, textMap);
  }, [filteredGuideItems, mergedRows]);

  const reflectionBySubject = useMemo(() => {
    if (!reflectionSummary) return new Map<string, SubjectReflectionRate>();
    return new Map(reflectionSummary.subjects.map((s) => [s.subjectName, s]));
  }, [reflectionSummary]);

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 (글로벌 제어 시 숨김) ───────────────────────── */}
      {!isControlled && <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
        {LAYER_TABS.map((tab) => {
          const hasData = tab.key === "neis" ? seteks.length > 0
            : tab.key === "draft" ? seteks.some((s) => s.content?.trim() || s.ai_draft_content || s.confirmed_content?.trim())
            : tab.key === "analysis" ? analysisTags.length > 0
            : tab.key === "draft_analysis" ? draftAnalysisTags.length > 0
            : tab.key === "direction" ? filteredGuideItems.length > 0
            : tab.key === "guide" ? (guideAssignments ?? []).some((a) => a.target_subject_id && a.school_year === schoolYear)
            : false;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
              title={tab.label}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {hasData && tab.key !== "neis" && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>}

      {/* ─── 생기부 모형 테이블 ─────────────────────────────────────────── */}
      {mergedRows.length === 0 && pendingPlanned.length === 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr>
              <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
              <th className={`${B} w-28 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>과 목</th>
              <th className={`${B} px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>{COL_HEADER_LABEL[activeTab]}</th>
            </tr></thead>
            <tbody><tr><td colSpan={3} className={`${B} px-4 py-2 text-center text-xs text-[var(--text-tertiary)]`}>해당 사항 없음</td></tr></tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr>
                <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
                <th className={`${B} w-28 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>과 목</th>
                <th className={`${B} px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>{COL_HEADER_LABEL[activeTab]}</th>
              </tr></thead>
              <tbody>
                {mergedRows.map((row) => (
                  <SetekTableRow
                    key={row.subjectId}
                    row={row}
                    charLimit={charLimit}
                    studentId={studentId}
                    schoolYear={schoolYear}
                    tenantId={tenantId}
                    grade={grade}
                    activeTab={activeTab}
                    subjectTags={filteredTags.filter((t) => row.records.some((r) => r.id === t.record_id))}
                    subjectReflection={reflectionBySubject.get(row.displayName)}
                    subjectGuides={guideAssignments?.filter((a) => a.target_subject_id === row.subjectId && a.school_year === schoolYear) ?? []}
                    subjectDirection={filteredGuideItems.filter((g) => g.subjectName === row.displayName)}
                    layer={layer}
                    perspective={perspective}
                  />
                ))}
                {pendingPlanned.map((p) => (
                  <PlannedSubjectRow
                    key={`planned-${p.subjectId}-${p.semester}`}
                    planned={p}
                    studentId={studentId}
                    schoolYear={schoolYear}
                    tenantId={tenantId}
                    grade={grade}
                    charLimit={charLimit}
                    activeTab={activeTab}
                    subjectGuides={
                      guideAssignments?.filter(
                        (a) => a.target_subject_id === p.subjectId && a.school_year === schoolYear,
                      ) ?? []
                    }
                    perspective={perspective}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "neis" && (
        <>
          {showAddForm ? (
            <AddSetekForm
              subjects={availableSubjects}
              studentId={studentId}
              schoolYear={schoolYear}
              tenantId={tenantId}
              grade={grade}
              charLimit={charLimit}
              onClose={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              disabled={availableSubjects.length === 0}
              className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:border-gray-500"
            >
              + 과목 추가
            </button>
          )}
        </>
      )}

      {/* ─── 분석 탭: 반영률 요약 ──────────────────────────────────────── */}
      {activeTab === "analysis" && reflectionSummary && reflectionSummary.totalKeywords > 0 && (
        <div className="rounded-lg border border-[var(--border-secondary)] p-3">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">가이드 키워드 반영률</span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {reflectionSummary.totalMatched}/{reflectionSummary.totalKeywords}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {reflectionSummary.subjects.map((s) => (
              <div key={s.subjectName} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs text-[var(--text-secondary)]">{s.subjectName}</span>
                <div className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800" style={{ height: 6 }}>
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.rate >= 70 ? "bg-emerald-500" : s.rate >= 40 ? "bg-amber-500" : "bg-red-400",
                    )}
                    style={{ width: `${s.rate}%` }}
                  />
                </div>
                <span className={cn(
                  "w-20 shrink-0 text-right text-xs font-medium",
                  s.rate >= 70 ? "text-emerald-600 dark:text-emerald-400" : s.rate >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500",
                )}>
                  {s.rate}% ({s.matchedKeywords}/{s.totalKeywords})
                </span>
              </div>
            ))}
          </div>
          {reflectionSummary.subjects.length > 1 && (
            <div className="flex items-center gap-2 border-t border-[var(--border-secondary)] pt-1.5 mt-1.5">
              <span className="w-20 shrink-0 text-xs font-medium text-[var(--text-secondary)]">평균</span>
              <div className="flex-1" />
              <span className="w-20 shrink-0 text-right text-xs font-semibold text-[var(--text-primary)]">
                {reflectionSummary.averageRate}%
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
