/**
 * Phase C-3 S3 3단계 (2026-04-21): designStudentPlan tool 출력 카드.
 * Sprint P3/P4 (2026-04-21): rows 테이블 + editable/onChange + plan_status 드롭다운.
 * Sprint P5 (2026-04-21): 같은 학기 내 priority 드래그 재정렬.
 *
 * summary 섹션은 항상 read-only. rows 는 DB row id 를 들고 있어 ArtifactPanel
 * HITL 경로에서 applyArtifactEdit(type='plan') 로 plan_status·priority 를 writeback 가능.
 */

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  DesignStudentPlanOutput,
  PlanRow,
} from "@/lib/mcp/tools/designStudentPlan";

type Props = {
  output: DesignStudentPlanOutput;
  /**
   * Sprint P3: 편집 모드. onChange 와 함께 제공되지 않으면 무시.
   * plan_status 만 현 스프린트 편집 대상 (priority·학기 재배정은 P5/P6).
   */
  editable?: boolean;
  /** Sprint P3: 편집 시 변경된 전체 output 을 상위(ArtifactPanel draft)로 전달. */
  onChange?: (next: DesignStudentPlanOutput) => void;
};

const STATUS_ORDER: PlanRow["planStatus"][] = [
  "recommended",
  "confirmed",
  "rejected",
  "completed",
];

const STATUS_LABEL: Record<PlanRow["planStatus"], string> = {
  recommended: "추천",
  confirmed: "확정",
  rejected: "거절",
  completed: "이수",
};

const SLOTS: Array<{ grade: number; semester: number; label: string }> = [
  { grade: 1, semester: 1, label: "1-1" },
  { grade: 1, semester: 2, label: "1-2" },
  { grade: 2, semester: 1, label: "2-1" },
  { grade: 2, semester: 2, label: "2-2" },
  { grade: 3, semester: 1, label: "3-1" },
  { grade: 3, semester: 2, label: "3-2" },
];

function slotKey(grade: number, semester: number): string {
  return `${grade}-${semester}`;
}

function statusTone(status: PlanRow["planStatus"]): string {
  switch (status) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "completed":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    case "rejected":
      return "bg-zinc-200 text-zinc-600 line-through dark:bg-zinc-800 dark:text-zinc-500";
    case "recommended":
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
}

function adequacyTone(score?: number): string {
  if (score == null) return "bg-zinc-100 text-zinc-700";
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-blue-100 text-blue-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function PlanCard({ output, editable, onChange }: Props) {
  if (!output.ok) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="text-xs font-medium text-rose-600">수강 계획 설계 실패</p>
        <p className="mt-1">{output.reason}</p>
      </div>
    );
  }

  const { studentName, summary, durationMs, stepCount, rows } = output;
  const isEditing = Boolean(editable && onChange);

  const updateRowStatus = (
    rowId: string,
    nextStatus: PlanRow["planStatus"],
  ) => {
    if (!onChange) return;
    const nextRows = rows.map((r) =>
      r.id === rowId ? { ...r, planStatus: nextStatus } : r,
    );
    onChange({ ...output, rows: nextRows });
  };

  /**
   * Sprint P5: 같은 학기 내 priority 재정렬.
   * sourceId 행을 targetId 위치로 이동. 학기 간 이동은 무시(=P6 범위).
   * priority 는 학기별 0..N-1 로 재부여.
   */
  const reorderWithinSemester = (sourceId: string, targetId: string) => {
    if (!onChange || sourceId === targetId) return;
    const source = rows.find((r) => r.id === sourceId);
    const target = rows.find((r) => r.id === targetId);
    if (!source || !target) return;
    if (source.grade !== target.grade || source.semester !== target.semester) {
      return;
    }

    const sameSemester = (r: PlanRow) =>
      r.grade === source.grade && r.semester === source.semester;

    const semesterRows = rows.filter(sameSemester);
    const fromIdx = semesterRows.findIndex((r) => r.id === sourceId);
    const toIdx = semesterRows.findIndex((r) => r.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const reordered = semesterRows.slice();
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const priorityById = new Map(
      reordered.map((r, i) => [r.id, i] as const),
    );

    const nextRows = rows.map((r) =>
      sameSemester(r)
        ? { ...r, priority: priorityById.get(r.id) ?? r.priority }
        : r,
    );
    onChange({ ...output, rows: nextRows });
  };

  /**
   * Sprint P6: 학기 재배정. UNIQUE(subject_id, grade, semester) 충돌은 clientside
   * 에서 drop 대상 슬롯에 동일 subject 가 있으면 호출 자체를 무시(드롭다운에서도
   * 해당 옵션을 disable). priority 는 새 학기 끝으로 재부여(max+1).
   */
  const updateRowSlot = (rowId: string, grade: number, semester: number) => {
    if (!onChange) return;
    const source = rows.find((r) => r.id === rowId);
    if (!source) return;
    if (source.grade === grade && source.semester === semester) return;

    const collides = rows.some(
      (r) =>
        r.id !== rowId &&
        r.subjectId === source.subjectId &&
        r.grade === grade &&
        r.semester === semester,
    );
    if (collides) return;

    const targetCount = rows.filter(
      (r) => r.id !== rowId && r.grade === grade && r.semester === semester,
    ).length;

    const nextRows = rows.map((r) =>
      r.id === rowId
        ? { ...r, grade, semester, priority: targetCount }
        : r,
    );
    onChange({ ...output, rows: nextRows });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            수강 계획 · {studentName ?? "학생"}
          </span>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {summary.headline}
          </p>
        </div>
        {typeof summary.adequacyScore === "number" && (
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-xs font-semibold",
              adequacyTone(summary.adequacyScore),
            )}
          >
            적합도 {summary.adequacyScore}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <RowsTable
          rows={rows}
          isEditing={isEditing}
          onStatusChange={updateRowStatus}
          onReorderWithinSemester={reorderWithinSemester}
          onSlotChange={updateRowSlot}
        />
      )}

      {summary.keyFindings.length > 0 && (
        <Section title="핵심 발견" tone="neutral" items={summary.keyFindings} />
      )}
      {summary.conflicts.length > 0 && (
        <Section title="충돌" tone="negative" items={summary.conflicts} />
      )}
      {summary.recommendedCourses.length > 0 && (
        <Section
          title="추천 과목"
          tone="positive"
          items={summary.recommendedCourses}
        />
      )}
      {summary.recommendedActions.length > 0 && (
        <Section
          title="추천 액션"
          tone="positive"
          items={summary.recommendedActions}
        />
      )}
      {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
        <Section
          title="후속 질문"
          tone="neutral"
          items={summary.followUpQuestions}
        />
      )}

      <footer className="border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        plan-sub · {stepCount} step · {(durationMs / 1000).toFixed(1)}s
      </footer>
    </div>
  );
}

function RowsTable({
  rows,
  isEditing,
  onStatusChange,
  onReorderWithinSemester,
  onSlotChange,
}: {
  rows: PlanRow[];
  isEditing: boolean;
  onStatusChange: (rowId: string, next: PlanRow["planStatus"]) => void;
  onReorderWithinSemester: (sourceId: string, targetId: string) => void;
  onSlotChange: (rowId: string, grade: number, semester: number) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
      <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
        수강 계획 ({rows.length}건)
        {isEditing && (
          <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
            · 같은 학기 내에서 행을 드래그해 우선순위 변경
          </span>
        )}
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              {isEditing && <th className="w-6 px-1 py-1.5" aria-label="드래그 핸들" />}
              <th className="px-3 py-1.5 text-left font-medium">학기</th>
              <th className="px-3 py-1.5 text-left font-medium">과목</th>
              <th className="px-3 py-1.5 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const draggedRow = draggedId
                ? rows.find((x) => x.id === draggedId)
                : null;
              const sameSemesterAsDrag = draggedRow
                ? draggedRow.grade === r.grade &&
                  draggedRow.semester === r.semester
                : false;
              const isDropTarget =
                isEditing &&
                dropTargetId === r.id &&
                draggedId !== r.id &&
                sameSemesterAsDrag;

              return (
                <tr
                  key={r.id}
                  draggable={isEditing}
                  onDragStart={
                    isEditing
                      ? (e) => {
                          setDraggedId(r.id);
                          e.dataTransfer.effectAllowed = "move";
                        }
                      : undefined
                  }
                  onDragOver={
                    isEditing && draggedId && sameSemesterAsDrag
                      ? (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dropTargetId !== r.id) setDropTargetId(r.id);
                        }
                      : undefined
                  }
                  onDragLeave={
                    isEditing
                      ? () => {
                          if (dropTargetId === r.id) setDropTargetId(null);
                        }
                      : undefined
                  }
                  onDrop={
                    isEditing && draggedId && sameSemesterAsDrag
                      ? (e) => {
                          e.preventDefault();
                          onReorderWithinSemester(draggedId, r.id);
                          setDraggedId(null);
                          setDropTargetId(null);
                        }
                      : undefined
                  }
                  onDragEnd={
                    isEditing
                      ? () => {
                          setDraggedId(null);
                          setDropTargetId(null);
                        }
                      : undefined
                  }
                  className={cn(
                    "border-t border-zinc-100 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200",
                    isEditing && "cursor-grab active:cursor-grabbing",
                    draggedId === r.id && "opacity-40",
                    isDropTarget &&
                      "outline outline-2 -outline-offset-2 outline-blue-400",
                  )}
                >
                  {isEditing && (
                    <td className="w-6 px-1 py-1.5 text-zinc-400 dark:text-zinc-500">
                      <GripVertical size={12} aria-hidden="true" />
                    </td>
                  )}
                  <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {isEditing ? (
                      <select
                        value={slotKey(r.grade, r.semester)}
                        onChange={(e) => {
                          const [g, s] = e.currentTarget.value.split("-").map(Number);
                          if (!Number.isFinite(g) || !Number.isFinite(s)) return;
                          onSlotChange(r.id, g, s);
                        }}
                        aria-label={`${r.subjectName} 학기`}
                        className="rounded-md border border-blue-300 bg-white px-1 py-0.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-zinc-900"
                      >
                        {SLOTS.map((slot) => {
                          // UNIQUE(subject, grade, semester) 충돌 옵션은 disable.
                          const collides =
                            (slot.grade !== r.grade || slot.semester !== r.semester) &&
                            rows.some(
                              (x) =>
                                x.id !== r.id &&
                                x.subjectId === r.subjectId &&
                                x.grade === slot.grade &&
                                x.semester === slot.semester,
                            );
                          return (
                            <option
                              key={slot.label}
                              value={slot.label}
                              disabled={collides}
                            >
                              {slot.label}
                              {collides ? " (중복)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      `${r.grade}-${r.semester}`
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{r.subjectName}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    {isEditing ? (
                      <select
                        value={r.planStatus}
                        onChange={(e) =>
                          onStatusChange(
                            r.id,
                            e.currentTarget.value as PlanRow["planStatus"],
                          )
                        }
                        aria-label={`${r.subjectName} 상태`}
                        className="rounded-md border border-blue-300 bg-white px-1.5 py-0.5 text-[11px] font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-zinc-900"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
                          statusTone(r.planStatus),
                        )}
                      >
                        {STATUS_LABEL[r.planStatus]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "negative" | "neutral";
  items: string[];
}) {
  const titleClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-700 dark:text-rose-400"
        : "text-zinc-700 dark:text-zinc-300";

  return (
    <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
      <p className={cn("text-[11px] font-medium", titleClass)}>{title}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-zinc-800 dark:text-zinc-200">
        {items.map((item, i) => (
          <li key={`${i}-${item.slice(0, 16)}`} className="leading-snug">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
