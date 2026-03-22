"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveHaengteukAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordHaengteuk } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";
import { useStudentRecordContext } from "./StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, MessageSquare, StickyNote } from "lucide-react";
import { CrossReferenceChips } from "./CrossReferenceChips";
import { InlineAreaMemos } from "./InlineAreaMemos";

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type HaengteukLayerTab = "record" | "analysis" | "memo" | "chat";

const HAENGTEUK_TABS: { key: HaengteukLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "record", label: "기록", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
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

type HaengteukEditorProps = {
  haengteuk: RecordHaengteuk | null;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: ActivityTagLike[];
};

export function HaengteukEditor({
  haengteuk,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
}: HaengteukEditorProps) {
  const charLimit = getCharLimit("haengteuk", schoolYear);
  const [content, setContent] = useState(haengteuk?.content ?? "");
  const [activeTab, setActiveTab] = useState<HaengteukLayerTab>("record");
  const queryClient = useQueryClient();

  useEffect(() => {
    setContent(haengteuk?.content ?? "");
  }, [haengteuk?.content]);

  // 역량 태그 필터: haengteuk record_type만
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags || !haengteuk) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "haengteuk" && t.record_id === haengteuk.id,
    );
  }, [diagnosisActivityTags, haengteuk]);

  // 사이드 패널 연결
  const { setActiveSubjectId } = useStudentRecordContext();
  const sidePanel = useSidePanel();

  const handleSave = useCallback(
    async (data: string) => {
      const result = await saveHaengteukAction(
        {
          student_id: studentId,
          school_year: schoolYear,
          tenant_id: tenantId,
          grade,
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
    [studentId, schoolYear, tenantId, grade, charLimit, queryClient],
  );

  const { status, error, saveNow } = useAutoSave({
    data: content,
    onSave: handleSave,
  });

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 ───────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
        {HAENGTEUK_TABS.map((tab) => {
          const hasData = tab.key === "record" ? !!haengteuk
            : tab.key === "analysis" ? filteredTags.length > 0
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

      {/* ─── 📄 기록 탭 (기본) ──────────────────── */}
      {activeTab === "record" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${B} w-14 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
                <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>
                  <span>행동특성 및 종합의견</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${B} px-2 py-1.5 text-center align-middle`}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm text-[var(--text-primary)]">{grade}</span>
                    {haengteuk && <RecordStatusBadge status={haengteuk.status} />}
                  </div>
                </td>
                <td className={`${B} p-1 align-top`}>
                  <AutoResizeTextarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-16 resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                    placeholder="행동특성 및 종합의견을 입력하세요..."
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
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 🔍 분석 탭 ──────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="flex flex-col gap-2">
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
          {haengteuk && (
            <CrossReferenceChips
              studentId={studentId}
              tenantId={tenantId}
              currentRecordIds={new Set([haengteuk.id])}
              currentRecordType="haengteuk"
              currentGrade={grade}
              allTags={diagnosisActivityTags as import("@/lib/domains/student-record").ActivityTag[] | undefined}
            />
          )}
        </div>
      )}

      {/* ─── 📝 메모 탭 (G3-4) ──────────────────── */}
      {activeTab === "memo" && (
        <InlineAreaMemos
          studentId={studentId}
          areaType="haengteuk"
          areaId="haengteuk"
          areaLabel="행동특성"
        />
      )}

      {/* ─── 💬 논의 탭 ──────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <MessageSquare className="h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">행특 영역에 대해 학생/학부모와 논의</p>
          <button
            type="button"
            onClick={() => {
              if (setActiveSubjectId) {
                setActiveSubjectId("haengteuk");
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
