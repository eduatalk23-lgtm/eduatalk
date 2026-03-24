"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveChangcheAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit, CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";
import { useStudentRecordContext } from "./StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, BookOpen, MessageSquare, StickyNote } from "lucide-react";
import { CrossReferenceChips } from "./CrossReferenceChips";
import { TextSelectionTagger } from "./TextSelectionTagger";
import { InlineAreaMemos } from "./InlineAreaMemos";

const ACTIVITY_TYPES: ChangcheActivityType[] = ["autonomy", "club", "career"];

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type ChangcheLayerTab = "record" | "analysis" | "guide" | "memo" | "chat";

const CHANGCHE_TABS: { key: ChangcheLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "record", label: "기록", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "memo", label: "메모", icon: StickyNote },
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

// ─── 타입 ──────────────────────────────────────

interface ActivityTagLike {
  record_type: string;
  record_id: string;
  competency_item: string;
  evaluation: string;
  evidence_summary?: string | null;
}

type ChangcheEditorProps = {
  changche: RecordChangche[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: ActivityTagLike[];
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
};

// ─── 메인 컴포넌트 ──────────────────────────────────

export function ChangcheEditor({
  changche,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
  guideAssignments,
}: ChangcheEditorProps) {
  const [activeTab, setActiveTab] = useState<ChangcheLayerTab>("record");

  // 모든 changche ID (분석 필터용)
  const allChangcheIds = useMemo(() => new Set(changche.map((c) => c.id)), [changche]);

  // 역량 태그 필터: changche record_type만
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "changche" && allChangcheIds.has(t.record_id),
    );
  }, [diagnosisActivityTags, allChangcheIds]);

  // 사이드 패널 연결
  const { setActiveSubjectId } = useStudentRecordContext();
  const sidePanel = useSidePanel();

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 ───────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
        {CHANGCHE_TABS.map((tab) => {
          const hasData = tab.key === "record" ? changche.length > 0
            : tab.key === "analysis" ? filteredTags.length > 0
            : tab.key === "guide" ? (guideAssignments?.length ?? 0) > 0
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
              {hasData && tab.key !== "record" && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 📄 기록 탭 (기본) ──────────────────── */}
      {activeTab === "record" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
                <th className={`${B} w-24 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>영역</th>
                <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>시간</th>
                <th className={`${B} px-2 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]`}>특기사항</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_TYPES.map((type, idx) => {
                const existing = changche.find((c) => c.activity_type === type);
                return (
                  <ChangcheRow
                    key={type}
                    activityType={type}
                    existing={existing}
                    studentId={studentId}
                    schoolYear={schoolYear}
                    tenantId={tenantId}
                    grade={grade}
                    showGrade={idx === 0}
                    rowSpan={ACTIVITY_TYPES.length}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 🔍 분석 탭 ──────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="flex flex-col gap-2">
          {/* 컨설턴트 드래그 태깅 */}
          {changche.filter((c) => c.content?.trim()).length > 0 && (
            <details className="rounded-lg border border-[var(--border-secondary)]">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                ✏️ 원문 드래그 태깅 <span className="font-normal text-[var(--text-tertiary)]">— 문장을 선택하여 역량 태그 지정</span>
              </summary>
              <div className="space-y-2 border-t border-[var(--border-secondary)] px-3 py-2">
                {changche.filter((c) => c.content?.trim()).map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">
                      {CHANGCHE_TYPE_LABELS[c.activity_type] ?? c.activity_type}
                    </div>
                    <TextSelectionTagger
                      content={c.content}
                      recordType="changche"
                      recordId={c.id}
                      studentId={studentId}
                      tenantId={tenantId}
                      schoolYear={schoolYear}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}

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

          {/* G2-1: 크로스레퍼런스 칩 */}
          <CrossReferenceChips
            studentId={studentId}
            tenantId={tenantId}
            currentRecordIds={allChangcheIds}
            currentRecordType="changche"
            currentGrade={grade}
            allTags={diagnosisActivityTags as import("@/lib/domains/student-record").ActivityTag[] | undefined}
          />
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

      {/* ─── 📝 메모 탭 (G3-4) ──────────────────── */}
      {activeTab === "memo" && (
        <div className="flex flex-col gap-4">
          {ACTIVITY_TYPES.map((type) => (
            <InlineAreaMemos
              key={type}
              studentId={studentId}
              areaType="changche"
              areaId={type}
              areaLabel={CHANGCHE_TYPE_LABELS[type]}
            />
          ))}
        </div>
      )}

      {/* ─── 💬 논의 탭 ──────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <MessageSquare className="h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">창체 영역에 대해 학생/학부모와 논의</p>
          <button
            type="button"
            onClick={() => {
              // 창체 첫 번째 영역을 컨텍스트로 설정
              if (setActiveSubjectId) {
                setActiveSubjectId(`changche:${ACTIVITY_TYPES[0]}`);
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

// ─── ChangcheRow (기존과 동일) ──────────────────────

function ChangcheRow({
  activityType,
  existing,
  studentId,
  schoolYear,
  tenantId,
  grade,
  showGrade,
  rowSpan,
}: {
  activityType: ChangcheActivityType;
  existing: RecordChangche | undefined;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  showGrade?: boolean;
  rowSpan?: number;
}) {
  const charLimit = getCharLimit(activityType, schoolYear);
  const [content, setContent] = useState(existing?.content ?? "");
  const queryClient = useQueryClient();

  // Import 등으로 외부에서 데이터가 변경되면 state 동기화
  useEffect(() => {
    setContent(existing?.content ?? "");
  }, [existing?.content]);

  const handleSave = useCallback(
    async (data: string) => {
      const result = await saveChangcheAction(
        {
          student_id: studentId,
          school_year: schoolYear,
          tenant_id: tenantId,
          grade,
          activity_type: activityType,
          content: data,
          char_limit: charLimit,
        },
        schoolYear,
      );
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
        });
      }
      return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
    },
    [studentId, schoolYear, tenantId, grade, activityType, charLimit, queryClient],
  );

  const { status, error, saveNow } = useAutoSave({
    data: content,
    onSave: handleSave,
  });

  return (
    <tr>
      {showGrade && (
        <td rowSpan={rowSpan} className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
          {grade}
        </td>
      )}
      <td className={`${B} px-2 py-1.5 text-center align-middle whitespace-nowrap`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {CHANGCHE_TYPE_LABELS[activityType]}
          </span>
          {existing && <RecordStatusBadge status={existing.status} />}
        </div>
      </td>
      <td className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
        {existing?.hours ?? "-"}
      </td>
      <td className={`${B} p-1 align-top`}>
        <AutoResizeTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-16 resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
          placeholder={`${CHANGCHE_TYPE_LABELS[activityType]} 활동 내용을 입력하세요...`}
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
      </td>
    </tr>
  );
}

/** textarea 높이를 내용에 맞춰 자동 조절 (테이블 셀 내에서도 작동) */
function AutoResizeTextarea({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(resize, [props.value, resize]);

  return (
    <textarea
      ref={ref}
      {...props}
      onChange={(e) => { onChange?.(e); resize(); }}
    />
  );
}
