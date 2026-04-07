"use client";

import { useMemo, useState } from "react";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { FileText, Search, Compass, PenLine } from "lucide-react";
import type { AnalysisTagLike } from "./shared/AnalysisBlocks";
import { COMPETENCY_LABELS } from "./shared/AnalysisBlocks";
import { calculateReflectionSummary, type ReflectionSummary, type SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";
import type { CourseAdequacyResult } from "@/lib/domains/student-record";
import { SetekTableRow } from "./setek/SetekTableRow";
import { PlannedSubjectRow, AddSetekForm } from "./setek/SetekFormParts";

type Subject = { id: string; name: string };

export type SetekLayerTab = "neis" | "draft" | "direction" | "analysis";

type ActivityTagLike = AnalysisTagLike;

export interface SetekGuideItemLike {
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
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; target_subject_id?: string | null; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
  /** confirmed course plans (세특 미존재인 것만 전달) */
  plannedSubjects?: PlannedSubject[];
  /** G2-5: 진로 소분류 ID (가이드 자동 추천용) */
  studentClassificationId?: number | null;
  /** 학교명 (가이드 배정용) */
  schoolName?: string | null;
  /** G2-1: 교과 이수 적합도 (크로스레퍼런스 COURSE_SUPPORTS용) */
  courseAdequacy?: CourseAdequacyResult | null;
  /** 외부 제어 모드: 글로벌 레이어 바에서 탭 동기화 */
  activeTab?: SetekLayerTab;
  onTabChange?: (tab: SetekLayerTab) => void;
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
  { key: "draft", label: "가안", icon: PenLine },
  { key: "direction", label: "방향", icon: Compass },
  { key: "analysis", label: "분석", icon: Search },
];

const COL_HEADER_LABEL: Record<SetekLayerTab, string> = {
  neis: "세부능력 및 특기사항", draft: "세특 가안", direction: "작성 방향",
  analysis: "역량 분석",
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
}: SetekEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [internalTab, setInternalTab] = useState<SetekLayerTab>("neis");
  const isControlled = controlledTab !== undefined;
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = controlledOnTabChange ?? setInternalTab;
  const charLimit = getCharLimit("setek", schoolYear);

  const mergedRows = useMemo(() => mergeSeteksBySemester(seteks, subjects), [seteks, subjects]);
  const existingSubjectIds = new Set(seteks.map((s) => s.subject_id));
  const plannedSubjectIds = new Set(plannedSubjects?.map((p) => p.subjectId) ?? []);
  const availableSubjects = subjects.filter(
    (s) => !existingSubjectIds.has(s.id) && !plannedSubjectIds.has(s.id),
  );

  const pendingPlanned = useMemo(
    () => (plannedSubjects ?? []).filter((p) => !existingSubjectIds.has(p.subjectId)),
    [plannedSubjects, existingSubjectIds],
  );

  const allSetekIds = useMemo(() => new Set(seteks.map((s) => s.id)), [seteks]);

  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "setek" && allSetekIds.has(t.record_id),
    );
  }, [diagnosisActivityTags, allSetekIds]);

  const subjectNames = useMemo(() => new Set(mergedRows.map((r) => r.displayName)), [mergedRows]);
  const filteredGuideItems = useMemo(() => {
    if (!setekGuideItems) return [];
    return setekGuideItems.filter((g) => subjectNames.has(g.subjectName));
  }, [setekGuideItems, subjectNames]);

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
            : tab.key === "analysis" ? filteredTags.length > 0
            : tab.key === "direction" ? filteredGuideItems.length > 0
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
                    subjectGuides={guideAssignments?.filter((a) => a.target_subject_id === row.subjectId) ?? []}
                    subjectDirection={filteredGuideItems.filter((g) => g.subjectName === row.displayName)}
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

      {/* ─── 방향 탭 (+ 가이드 배정 목록 통합) ────────────────────────── */}
      {activeTab === "direction" && (
        <div className="flex flex-col gap-3">
          {filteredGuideItems.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">
              세특 방향 가이드를 생성하면 과목별 방향이 표시됩니다
            </p>
          ) : (
            filteredGuideItems.map((item, i) => (
              <div key={i} className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">{item.subjectName}</span>
                  {item.competencyFocus?.map((c) => (
                    <span key={c} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                      {COMPETENCY_LABELS[c] ?? c}
                    </span>
                  ))}
                  {(() => {
                    const sr = reflectionBySubject.get(item.subjectName);
                    if (!sr || sr.totalKeywords === 0) return null;
                    return (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                        sr.rate >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : sr.rate >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
                      )}>
                        반영 {sr.rate}%
                      </span>
                    );
                  })()}
                </div>
                <p className="mb-2 text-sm text-[var(--text-primary)]">{item.direction}</p>
                {item.keywords.length > 0 && (() => {
                  const sr = reflectionBySubject.get(item.subjectName);
                  const matchSet = new Set(sr?.details.filter((d) => d.matched).map((d) => d.keyword) ?? []);
                  return (
                    <div className="flex flex-wrap gap-1">
                      {item.keywords.map((kw) => {
                        const isMatched = matchSet.has(kw);
                        return (
                          <span
                            key={kw}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[11px]",
                              isMatched
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
                            )}
                          >
                            {isMatched && "✓ "}{kw}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
                {item.teacherPoints && item.teacherPoints.length > 0 && (
                  <div className="mt-2 border-t border-violet-200 pt-2 dark:border-violet-800">
                    <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">교사 전달 포인트</p>
                    <ul className="list-inside list-disc text-xs text-[var(--text-secondary)]">
                      {item.teacherPoints.map((tp, j) => <li key={j}>{tp}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}

          {guideAssignments && guideAssignments.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-[var(--border-secondary)] pt-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">배정된 탐구 가이드</p>
              {guideAssignments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded border border-[var(--border-secondary)] px-2 py-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                    a.status === "completed" ? "bg-emerald-500" : a.status === "in_progress" ? "bg-amber-500" : "bg-gray-300")} />
                  <span className="truncate text-xs text-[var(--text-primary)]">{a.exploration_guides?.title ?? "가이드"}</span>
                  <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                    {a.status === "completed" ? "완료" : a.status === "in_progress" ? "진행중" : "배정됨"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
