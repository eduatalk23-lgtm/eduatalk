"use client";

import { cn } from "@/lib/cn";
import { ArrowRight, ChevronRight } from "lucide-react";
import {
  EDGE_TYPE_META,
  type ConnectionNode,
  type CrossRefEdge,
} from "@/lib/domains/student-record/cross-reference";

const RECORD_TYPE_ICONS: Record<string, string> = {
  setek: "📄",
  personal_setek: "📄",
  changche: "🎯",
  haengteuk: "💬",
  reading: "📚",
  score: "📊",
};

export function ConnectionNodeCard({
  node,
  isHighlighted,
  onDrillDown,
}: {
  node: ConnectionNode;
  isHighlighted?: boolean;
  onDrillDown: (nodeKey: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        isHighlighted
          ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/20"
          : "border-[var(--border-secondary)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{RECORD_TYPE_ICONS[node.recordType] ?? "📄"}</span>
        <span className="flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">
          {node.label}
        </span>
        <span className="rounded-full bg-[var(--background-secondary)] px-1.5 py-0.5 text-3xs text-[var(--text-tertiary)]">
          {node.edges.length}
        </span>
      </div>

      <div className="flex flex-col gap-1 pt-2">
        {node.edges.map((edge, i) => (
          <EdgeRow key={`${edge.type}-${edge.targetLabel}-${i}`} edge={edge} onDrillDown={onDrillDown} />
        ))}
      </div>
    </div>
  );
}

function EdgeRow({ edge, onDrillDown }: { edge: CrossRefEdge; onDrillDown: (key: string) => void }) {
  const meta = EDGE_TYPE_META[edge.type];
  const isInferred = edge.edgeContext === "synthesis_inferred";
  const isProjected = edge.edgeContext === "projected";
  // targetRecordId가 있으면 정확한 nodeKey로 drilldown, 없으면 label fallback
  const targetKey = edge.targetRecordId
    ? `${edge.targetRecordType}:${edge.targetRecordId}`
    : `${edge.targetRecordType}:${edge.targetLabel}`;

  return (
    <button
      type="button"
      onClick={() => onDrillDown(targetKey)}
      title={
        isInferred
          ? `Synthesis 추론 연결 — ${edge.reason}`
          : isProjected
            ? `설계 모드 예상 — ${edge.reason}`
            : edge.reason
      }
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-2xs transition-colors hover:opacity-80",
        meta.bgColor,
        meta.color,
        isInferred && "border-dashed border-violet-400 dark:border-violet-500",
        isProjected && "border-dashed opacity-70",
      )}
    >
      {isInferred && (
        <span className="shrink-0 rounded-sm bg-violet-500 px-1 text-3xs font-bold text-white">
          추론
        </span>
      )}
      {isProjected && (
        <span className="shrink-0 rounded-sm bg-amber-500 px-1 text-3xs font-bold text-white">
          예상
        </span>
      )}
      <span className="shrink-0 opacity-70">{meta.label}</span>
      <ArrowRight className="h-2.5 w-2.5 shrink-0 opacity-50" />
      <span className="flex-1 truncate">{edge.targetLabel}</span>
      {edge.sharedCompetencies && edge.sharedCompetencies.length > 1 && (
        <span className="shrink-0 rounded-full bg-white/50 px-1 text-3xs dark:bg-black/20">
          {edge.sharedCompetencies.length}
        </span>
      )}
      <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
    </button>
  );
}
