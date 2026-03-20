"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";
import { useStudentRecordContext } from "./StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, BookOpen, Compass, MessageSquare } from "lucide-react";

type Subject = { id: string; name: string };

type SetekLayerTab = "record" | "analysis" | "guide" | "direction" | "chat";

interface ActivityTagLike {
  record_type: string;
  record_id: string;
  competency_item: string;
  evaluation: string;
  evidence_summary?: string | null;
}

interface SetekGuideItemLike {
  subjectName: string;
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
}

type SetekEditorProps = {
  seteks: RecordSetek[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  subjects: Subject[];
  grade: number;
  diagnosisActivityTags?: ActivityTagLike[];
  setekGuideItems?: SetekGuideItemLike[];
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
};

const B = "border border-gray-400 dark:border-gray-500";

// ─── 과목 합산 유틸 ──────────────────────────────────

type MergedSetekRow = {
  /** 과목명 (같은 과목의 1+2학기를 한 행으로 합산) */
  displayName: string;
  /** 원본 세특 레코드들 (1~2개) */
  records: RecordSetek[];
  /** 정렬용 subject_id */
  subjectId: string;
};

function mergeSeteksBySemester(seteks: RecordSetek[], subjects: Subject[]): MergedSetekRow[] {
  // subject_id 기준으로 그룹화 (같은 과목의 1학기+2학기를 합산)
  const bySubject = new Map<string, RecordSetek[]>();
  for (const s of seteks) {
    const arr = bySubject.get(s.subject_id) ?? [];
    arr.push(s);
    bySubject.set(s.subject_id, arr);
  }

  const rows: MergedSetekRow[] = [];
  for (const [subjectId, records] of bySubject) {
    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "알 수 없는 과목";
    // 같은 과목이 2학기분이면 합산 표시, 아니면 단독
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
  { key: "record", label: "세특", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "direction", label: "방향", icon: Compass },
  { key: "chat", label: "논의", icon: MessageSquare },
];

const COMPETENCY_LABELS: Record<string, string> = {
  academic_achievement: "학업성취도", academic_attitude: "학업태도", academic_inquiry: "탐구력",
  career_course_effort: "과목이수노력", career_course_achievement: "과목성취도", career_exploration: "진로탐색",
  community_collaboration: "협업", community_caring: "배려", community_integrity: "성실성", community_leadership: "리더십",
};

const EVAL_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
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
}: SetekEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<SetekLayerTab>("record");
  const charLimit = getCharLimit("setek", schoolYear);

  const mergedRows = useMemo(() => mergeSeteksBySemester(seteks, subjects), [seteks, subjects]);
  const existingSubjectIds = new Set(seteks.map((s) => s.subject_id));
  const availableSubjects = subjects.filter((s) => !existingSubjectIds.has(s.id));

  // 모든 세특 ID (분석 탭 필터용)
  const allSetekIds = useMemo(() => new Set(seteks.map((s) => s.id)), [seteks]);

  // 과목별 태그 필터
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "setek" && allSetekIds.has(t.record_id),
    );
  }, [diagnosisActivityTags, allSetekIds]);

  // 과목별 가이드 방향 필터
  const subjectNames = useMemo(() => new Set(mergedRows.map((r) => r.displayName)), [mergedRows]);
  const filteredGuideItems = useMemo(() => {
    if (!setekGuideItems) return [];
    return setekGuideItems.filter((g) => subjectNames.has(g.subjectName));
  }, [setekGuideItems, subjectNames]);

  // 사이드 패널 연결
  const { setActiveSubjectId } = useStudentRecordContext();
  const sidePanel = useSidePanel();

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 ───────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--border-secondary)]">
        {LAYER_TABS.map((tab) => {
          const hasData = tab.key === "record" ? seteks.length > 0
            : tab.key === "analysis" ? filteredTags.length > 0
            : tab.key === "guide" ? (guideAssignments?.length ?? 0) > 0
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
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
              {hasData && tab.key !== "record" && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 📄 세특 탭 (기본) ──────────────────── */}
      {activeTab === "record" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
                  <th className={`${B} w-28 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>과 목</th>
                  <th className={`${B} px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>세부능력 및 특기사항</th>
                </tr>
              </thead>
              <tbody>
                {mergedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`${B} px-4 py-2 text-center text-xs text-[var(--text-tertiary)]`}>
                      해당 사항 없음
                    </td>
                  </tr>
                ) : (
                  mergedRows.map((row) => (
                    <SetekTableRow
                      key={row.subjectId}
                      row={row}
                      charLimit={charLimit}
                      studentId={studentId}
                      schoolYear={schoolYear}
                      tenantId={tenantId}
                      grade={grade}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

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

      {/* ─── 🔍 분석 탭 ──────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="flex flex-col gap-3">
          {filteredTags.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">
              AI 분석을 실행하면 이 영역의 역량 태그가 표시됩니다
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                filteredTags.reduce<Record<string, ActivityTagLike[]>>((acc, tag) => {
                  const key = tag.competency_item;
                  (acc[key] ??= []).push(tag);
                  return acc;
                }, {}),
              ).map(([item, tags]) => (
                <div key={item} className="rounded-lg border border-[var(--border-secondary)] p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {COMPETENCY_LABELS[item] ?? item}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{tags.length}건</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", EVAL_COLORS[tag.evaluation] ?? "bg-gray-100 text-gray-600")}
                        title={tag.evidence_summary ?? undefined}
                      >
                        {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}{" "}
                        {tag.evidence_summary?.slice(0, 30) ?? ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 📘 가이드 탭 ──────────────────────────── */}
      {activeTab === "guide" && (
        <div className="flex flex-col gap-2">
          {!guideAssignments || guideAssignments.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">
              이 영역에 배정된 탐구 가이드가 없습니다
            </p>
          ) : (
            guideAssignments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-secondary)] p-3">
                <BookOpen className="h-4 w-4 shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {a.exploration_guides?.title ?? "가이드"}
                  </p>
                  {a.exploration_guides?.guide_type && (
                    <p className="text-[10px] text-[var(--text-tertiary)]">{a.exploration_guides.guide_type}</p>
                  )}
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  a.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  a.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600",
                )}>
                  {a.status === "completed" ? "완료" : a.status === "in_progress" ? "진행중" : "배정됨"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── 📝 방향 탭 ──────────────────────────── */}
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
                    <span key={c} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                      {COMPETENCY_LABELS[c] ?? c}
                    </span>
                  ))}
                </div>
                <p className="mb-2 text-sm text-[var(--text-primary)]">{item.direction}</p>
                {item.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.keywords.map((kw) => (
                      <span key={kw} className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                {item.teacherPoints && item.teacherPoints.length > 0 && (
                  <div className="mt-2 border-t border-violet-200 pt-2 dark:border-violet-800">
                    <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">교사 전달 포인트</p>
                    <ul className="list-inside list-disc text-xs text-[var(--text-secondary)]">
                      {item.teacherPoints.map((tp, j) => <li key={j}>{tp}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── 💬 논의 탭 ──────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <MessageSquare className="h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">이 영역에 대해 학생/학부모와 논의</p>
          <button
            type="button"
            onClick={() => {
              const firstSubject = mergedRows[0];
              if (firstSubject && setActiveSubjectId) {
                setActiveSubjectId(firstSubject.subjectId);
              }
              sidePanel.openApp("chat");
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            채팅 열기
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 세특 테이블 행 (2열: 과목 | 내용) ─────────────

function SetekTableRow({
  row,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: {
  row: MergedSetekRow;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  return (
    <>
      {row.records.map((setek, idx) => (
        <tr key={setek.id} className="align-top">
          {idx === 0 && (
            <>
              {/* 학년 */}
              <td rowSpan={row.records.length} className={`${B} px-2 py-2 text-center align-middle text-sm text-[var(--text-primary)]`}>
                {grade}
              </td>
              {/* 과목명 */}
              <td rowSpan={row.records.length} className={`${B} px-3 py-2 text-center align-middle text-sm font-medium text-[var(--text-primary)]`}>
                {row.displayName}
              </td>
            </>
          )}
          {/* 세특 내용 */}
          <td className={`${B} p-1`}>
            {row.records.length > 1 && (
              <p className="mb-1 px-1 text-xs font-medium text-[var(--text-tertiary)]">{setek.semester}학기</p>
            )}
            <SetekInlineEditor
              setek={setek}
              charLimit={charLimit}
              studentId={studentId}
              schoolYear={schoolYear}
              tenantId={tenantId}
              grade={grade}
              showSemesterLabel={false}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── 인라인 세특 에디터 (테이블 내부) ───────────────

function SetekInlineEditor({
  setek,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  showSemesterLabel,
}: {
  setek: RecordSetek;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  showSemesterLabel: boolean;
}) {
  const [content, setContent] = useState(setek.content ?? "");
  const queryClient = useQueryClient();

  useEffect(() => {
    setContent(setek.content ?? "");
  }, [setek.content]);

  const handleSave = useCallback(
    async (data: string) => {
      const result = await saveSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        semester: setek.semester,
        subject_id: setek.subject_id,
        content: data,
        char_limit: charLimit,
      });
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
        });
      }
      return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
    },
    [studentId, schoolYear, tenantId, grade, setek.semester, setek.subject_id, charLimit, queryClient],
  );

  const { status, error, saveNow } = useAutoSave({
    data: content,
    onSave: handleSave,
    enabled: true,
  });

  return (
    <>
      {showSemesterLabel && (
        <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">{setek.semester}학기</p>
      )}
      <AutoResizeTextarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-16 resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
        placeholder="세특 내용을 입력하세요..."
      />
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <SaveStatusIndicator status={status} error={error} />
          {status === "error" && (
            <button onClick={saveNow} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">재시도</button>
          )}
        </div>
        <CharacterCounter content={content} charLimit={charLimit} />
      </div>
    </>
  );
}

// ─── 과목 추가 폼 ──────────────────────────────────

function AddSetekForm({
  subjects,
  studentId,
  schoolYear,
  tenantId,
  grade,
  charLimit,
  onClose,
}: {
  subjects: { id: string; name: string }[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  onClose: () => void;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [semester, setSemester] = useState(1);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubjectId) throw new Error("과목을 선택해주세요.");
      const result = await saveSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        semester,
        subject_id: selectedSubjectId,
        content,
        char_limit: charLimit,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "저장 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">과목 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">과목 선택...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="w-28 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
          placeholder="세특 내용을 입력하세요..."
        />
        <div className="flex items-center justify-between">
          <CharacterCounter content={content} charLimit={charLimit} />
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedSubjectId || mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "저장 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}

function AutoResizeTextarea({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(resize, [props.value, resize]);
  return <textarea ref={ref} {...props} onChange={(e) => { onChange?.(e); resize(); }} />;
}
