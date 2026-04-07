"use client";

// ============================================
// context-tabs/RecordContextTabs — 기록 현황 탭
// CompetencyTab, GuideRateTab, TeacherTab, DiffTab
// ============================================

import { cn } from "@/lib/cn";
import type { RecordTabData } from "@/lib/domains/student-record/types";
import type { RecordArea, LayerGuideAssignment, LayerActivityTag, LayerSetekGuide } from "../ContextTabContent";
import { EmptyMessage } from "./shared";

// ── STATUS_LABELS (GuideRateTab 전용) ──

const STATUS_LABELS = [
  { key: "assigned" as const, label: "배정", color: "bg-blue-400" },
  { key: "in_progress" as const, label: "진행", color: "bg-amber-400" },
  { key: "submitted" as const, label: "제출", color: "bg-violet-400" },
  { key: "completed" as const, label: "완료", color: "bg-emerald-400" },
  { key: "cancelled" as const, label: "취소", color: "bg-gray-400" },
];

// ── 1. 역량 분포 탭 ──

export function CompetencyTab({ tags, currentArea }: { tags: LayerActivityTag[]; currentArea?: RecordArea | null }) {
  const grouped = new Map<string, { count: number; ai: number; manual: number; confirmed: number }>();
  for (const t of tags) {
    const item = t.competency_item ?? "미분류";
    const entry = grouped.get(item) ?? { count: 0, ai: 0, manual: 0, confirmed: 0 };
    entry.count++;
    if (t.source === "ai") entry.ai++;
    if (t.source === "manual") entry.manual++;
    if (t.status === "confirmed") entry.confirmed++;
    grouped.set(item, entry);
  }

  const sorted = [...grouped.entries()].sort((a, b) => b[1].count - a[1].count);

  if (sorted.length === 0) {
    return <EmptyMessage>역량 태그가 없습니다.</EmptyMessage>;
  }

  const currentRecordId = currentArea?.recordId;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[var(--text-tertiary)]">전체 {tags.length}개 태그, {sorted.length}개 역량</p>
      {sorted.map(([item, stat]) => {
        const isHighlighted = currentRecordId && tags.some((t) => t.record_id === currentRecordId && t.competency_item === item);
        return (
          <div
            key={item}
            className={cn(
              "flex items-center justify-between rounded px-2 py-1.5 text-xs",
              isHighlighted ? "bg-indigo-50 dark:bg-indigo-900/20" : "",
            )}
          >
            <span className="text-[var(--text-primary)]">{item}</span>
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
              <span>🤖{stat.ai}</span>
              <span>👤{stat.manual}</span>
              <span>✅{stat.confirmed}</span>
              <span className="font-medium text-[var(--text-secondary)]">{stat.count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 2. 가이드 이행률 탭 ──

export function GuideRateTab({ assignments }: { assignments: LayerGuideAssignment[] }) {
  if (assignments.length === 0) {
    return <EmptyMessage>배정된 가이드가 없습니다.</EmptyMessage>;
  }

  const statusCount = { assigned: 0, in_progress: 0, submitted: 0, completed: 0, cancelled: 0 };
  for (const a of assignments) {
    const s = a.status as keyof typeof statusCount;
    if (s in statusCount) statusCount[s]++;
  }

  const total = assignments.length;
  const confirmed = assignments.filter((a) => a.confirmed_at != null).length;
  const rate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 진행률 바 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">확정 이행률</span>
          <span className="font-medium text-[var(--text-primary)]">{rate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* 상태별 카운트 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_LABELS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1 text-[10px]">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            <span className="text-[var(--text-tertiary)]">{label}</span>
            <span className="font-medium text-[var(--text-secondary)]">{statusCount[key]}</span>
          </div>
        ))}
      </div>

      {/* 배정 목록 */}
      <div className="space-y-1">
        {assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-[var(--border-secondary)] px-2 py-1.5">
            <span className="truncate text-xs text-[var(--text-primary)]">
              {a.exploration_guides?.title ?? "가이드"}
            </span>
            <span className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              a.confirmed_at ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
            )}>
              {a.confirmed_at ? "확정" : a.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. 교사 전달 탭 ──

export function TeacherTab({ guides, currentArea }: { guides: LayerSetekGuide[]; currentArea?: RecordArea | null }) {
  const withPoints = guides.filter((g) => g.teacher_points && g.teacher_points.length > 0);

  if (withPoints.length === 0) {
    return <EmptyMessage>교사 전달 포인트가 없습니다.</EmptyMessage>;
  }

  return (
    <div className="space-y-3">
      {withPoints.map((guide, idx) => {
        const isHighlighted = currentArea?.type === "setek" && currentArea?.subjectId === guide.subject_id;
        return (
          <div
            key={idx}
            className={cn(
              "rounded border border-[var(--border-secondary)] p-2",
              isHighlighted && "ring-1 ring-indigo-400",
            )}
          >
            {guide.keywords.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {guide.keywords.map((kw) => (
                  <span key={kw} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    {kw}
                  </span>
                ))}
              </div>
            )}
            <ul className="space-y-0.5">
              {guide.teacher_points!.map((tp, i) => (
                <li key={i} className="text-xs text-[var(--text-secondary)]">· {tp}</li>
              ))}
            </ul>
            {guide.cautions && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">⚠ {guide.cautions}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 4. 가안 vs 실생기부 탭 ──

export function DiffTab({
  recordByGrade,
  currentArea,
}: {
  recordByGrade: Map<number, { data: RecordTabData }>;
  currentArea?: RecordArea | null;
}) {
  const diffs: Array<{ label: string; grade: number; confirmed: number; imported: number; match: boolean; isCurrent: boolean }> = [];

  for (const [grade, entry] of recordByGrade) {
    for (const s of entry.data.seteks) {
      const draft = s.confirmed_content ?? s.ai_draft_content;
      const imported = s.imported_content;
      if (!draft && !imported) continue;
      const isCurrent = currentArea?.type === "setek" && currentArea?.subjectId === s.subject_id && currentArea?.grade === grade;
      diffs.push({
        label: `${grade}학년 세특`,
        grade,
        confirmed: draft?.length ?? 0,
        imported: imported?.length ?? 0,
        match: draft === imported,
        isCurrent,
      });
    }
  }

  if (diffs.length === 0) {
    return <EmptyMessage>비교할 가안/실생기부 데이터가 없습니다.</EmptyMessage>;
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-[var(--text-tertiary)]">{diffs.length}개 영역</p>
      {diffs.map((d, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between rounded px-2 py-1.5 text-xs",
            d.isCurrent && "bg-indigo-50 dark:bg-indigo-900/20",
          )}
        >
          <span className="text-[var(--text-primary)]">{d.label}</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[var(--text-tertiary)]">가안 {d.confirmed}자</span>
            <span className="text-[var(--text-tertiary)]">임포트 {d.imported}자</span>
            <span className={d.match ? "text-emerald-600" : "text-amber-600"}>
              {d.match ? "✓ 일치" : "≠ 불일치"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
