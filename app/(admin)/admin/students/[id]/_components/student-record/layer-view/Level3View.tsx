"use client";

import { useState, useTransition, useMemo } from "react";
import { ChevronRight, Check, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RecordArea, LayerId, PerspectiveId } from "./types";
import {
  DEFAULT_SELECTED_PERSPECTIVES,
  buildPerspectiveGridColumns,
  LAYER_META,
  FOCUS_RING,
} from "./types";
import { PerspectiveBar } from "./PerspectiveBar";
import { PerspectivePanel } from "./PerspectivePanel";
import type { useAreaData, AreaData } from "./useAreaData";
import { GuidePanel } from "./panels/GuidePanel";
import { DeliverablePanel } from "./panels/DeliverablePanel";
import { DraftPanel } from "./panels/DraftPanel";
import { ActualPanel } from "./panels/ActualPanel";
import { AnalysisPanel } from "./panels/AnalysisPanel";
import { DirectionPanel } from "./panels/DirectionPanel";

interface Level3ViewProps {
  area: RecordArea;
  layer: LayerId;
  onBack: () => void;
  onBackToLevel1: () => void;
  areaData: ReturnType<typeof useAreaData>;
  /** 확정/수용 액션 완료 시 데이터 갱신 콜백 */
  onActionComplete?: () => void;
}

export function Level3View({
  area,
  layer,
  onBack,
  onBackToLevel1,
  areaData,
  onActionComplete,
}: Level3ViewProps) {
  const [selectedPerspectives, setSelectedPerspectives] = useState<PerspectiveId[]>(
    DEFAULT_SELECTED_PERSPECTIVES,
  );

  const layerMeta = LAYER_META[layer];
  const gridStyle = useMemo(() => ({ gridTemplateColumns: buildPerspectiveGridColumns(selectedPerspectives) }), [selectedPerspectives]);

  // actual / deliverable 레이어는 관점 분리 무의미 — 단일 패널 (PerspectivePanel 스타일 통일)
  if (layer === "actual" || layer === "deliverable") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Breadcrumb area={area} layer={layer} onBackToLevel1={onBackToLevel1} onBack={onBack} />
        <div className="flex min-w-0 flex-col rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)]">
          <div className="flex items-center gap-1.5 border-b border-[var(--border-secondary)] px-3 py-2">
            <span>{layerMeta.emoji}</span>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">{layerMeta.label}</h4>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {layer === "actual"
              ? <ActualPanel record={areaData.record as Record<string, unknown> | null} />
              : <DeliverablePanel fileCounts={areaData.deliverableFileCounts} />
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 브레드크럼 */}
      <Breadcrumb area={area} layer={layer} onBackToLevel1={onBackToLevel1} onBack={onBack} />

      {/* 컨트롤 바 */}
      <div className="sticky top-0 z-10 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <span>{layerMeta.emoji}</span>
            {layerMeta.label}
          </div>
          <div className="h-4 w-px bg-[var(--border-secondary)]" />
          <PerspectiveBar selected={selectedPerspectives} onChange={setSelectedPerspectives} />
        </div>
      </div>

      {/* 가로 배치 관점 패널 */}
      <div
        className="grid min-h-[300px] gap-3 overflow-x-auto"
        style={gridStyle}
      >
        {selectedPerspectives.map((perspective) => (
          <PerspectivePanel
            key={perspective}
            perspective={perspective}
            footer={
              <WorkflowActions
                layer={layer}
                perspective={perspective}
                area={area}
                areaData={areaData}
                onComplete={onActionComplete}
              />
            }
          >
            {renderLayerContent(layer, perspective, areaData)}
          </PerspectivePanel>
        ))}
      </div>
    </div>
  );
}

function Breadcrumb({
  area,
  layer,
  onBackToLevel1,
  onBack,
}: {
  area: RecordArea;
  layer: LayerId;
  onBackToLevel1: () => void;
  onBack: () => void;
}) {
  const layerMeta = LAYER_META[layer];
  return (
    <nav aria-label={`${layerMeta.label} 내비게이션`} className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
      <button type="button" onClick={onBackToLevel1} aria-label="전체 영역 목록으로 돌아가기" className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]", FOCUS_RING)}>
        생기부
      </button>
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
      <button type="button" onClick={onBack} aria-label={`${area.label} 영역으로 돌아가기`} className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]", FOCUS_RING)}>
        {area.label}
      </button>
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="font-medium text-[var(--text-primary)]" aria-current="page">
        {layerMeta.emoji} {layerMeta.label}
      </span>
    </nav>
  );
}

function renderLayerContent(
  layer: LayerId,
  perspective: PerspectiveId,
  data: ReturnType<typeof useAreaData>,
) {
  switch (layer) {
    case "guide":
      return <GuidePanel assignments={data.guideAssignments} perspective={perspective} detailed />;
    case "draft":
      return <DraftPanel record={data.record as Record<string, unknown> | null} perspective={perspective} detailed />;
    case "analysis":
      return <AnalysisPanel tags={data.activityTags} perspective={perspective} detailed />;
    case "direction":
      return <DirectionPanel guides={data.setekGuides} perspective={perspective} detailed />;
    default:
      return null;
  }
}

// ── 워크플로우 액션 버튼 ──

function WorkflowActions({
  layer,
  perspective,
  area,
  areaData,
  onComplete,
}: {
  layer: LayerId;
  perspective: PerspectiveId;
  area: RecordArea;
  areaData: AreaData;
  onComplete?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 확정 관점은 상태 표시만
  if (perspective === "confirmed") {
    return <ConfirmedStatus layer={layer} areaData={areaData} />;
  }

  // AI 관점: "수용" (AI → 컨설턴트)
  // 컨설턴트 관점: "확정" (컨설턴트 → 확정)
  const isAi = perspective === "ai";
  const label = isAi ? "수용" : "확정";
  const description = isAi ? "AI → 컨설턴트" : "컨설턴트 → 확정";

  function handleAction() {
    startTransition(async () => {
      try {
        let res: { success: boolean; error?: string };

        if (layer === "guide") {
          // 가이드 배정: AI 수용 → in_progress / 컨설턴트 확정 → completed+confirmed
          const assignments = areaData.guideAssignments;
          if (assignments.length === 0) {
            setResult({ ok: false, msg: "배정 없음" });
            return;
          }
          if (isAi) {
            // AI 추천 수용 → 상태를 in_progress로 (확정은 아님)
            const { updateAssignmentStatusAction } = await import("@/lib/domains/guide/actions/assignment");
            res = await updateAssignmentStatusAction(assignments[0].id, "in_progress");
          } else {
            // 컨설턴트 확정 → completed + confirmed_at/by
            const { confirmAssignmentAction } = await import("@/lib/domains/student-record/actions/confirm");
            res = await confirmAssignmentAction(assignments[0].id);
          }
        } else if (layer === "draft") {
          // 가안: AI 수용 → ai_draft→content / 컨설턴트 확정 → content→confirmed
          const record = areaData.record as { id?: string } | null;
          if (!record?.id) {
            setResult({ ok: false, msg: "레코드 없음" });
            return;
          }
          const recordType = resolveRecordType(area);
          if (!recordType) {
            setResult({ ok: false, msg: "레코드 유형 미지원" });
            return;
          }
          const { acceptAiDraftAction, confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
          res = isAi
            ? await acceptAiDraftAction(record.id, recordType)
            : await confirmDraftAction(record.id, recordType);
        } else if (layer === "analysis") {
          // 태그: 현재 관점의 태그만 확정 (AI/수동 구분)
          const perspectiveTags = areaData.activityTags.filter((t) =>
            isAi ? t.source === "ai" : t.source === "manual",
          );
          const tagIds = perspectiveTags.filter((t) => t.id).map((t) => t.id!);
          if (tagIds.length === 0) {
            setResult({ ok: false, msg: "태그 없음" });
            return;
          }
          const { confirmTagsAction } = await import("@/lib/domains/student-record/actions/confirm");
          res = await confirmTagsAction(tagIds);
        } else if (layer === "direction") {
          // 방향 가이드: 해당 관점 소스만 확정
          const guides = areaData.setekGuides;
          const target = guides.find((g) => isAi ? g.source === "ai" : g.source === "manual");
          if (!target?.id) {
            setResult({ ok: false, msg: "가이드 없음" });
            return;
          }
          const { confirmDirectionAction } = await import("@/lib/domains/student-record/actions/confirm");
          res = await confirmDirectionAction(target.id);
        } else {
          return;
        }

        setResult({ ok: res.success, msg: res.success ? "완료" : (res.error ?? "실패") });
        if (res.success) onComplete?.();
      } catch {
        setResult({ ok: false, msg: "오류 발생" });
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-tertiary)]">{description}</span>
        <button
          type="button"
          disabled={isPending}
          aria-busy={isPending}
          aria-label={`${label} — ${description}`}
          onClick={handleAction}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", FOCUS_RING,
            isAi
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60",
            isPending && "opacity-50 cursor-not-allowed",
          )}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isAi ? (
            <ArrowRight className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          {label}
        </button>
      </div>
      {result && (
        <p role="alert" className={cn("mt-1 text-[10px]", result.ok ? "text-emerald-600" : "text-red-500")}>
          {result.msg}
        </p>
      )}
    </div>
  );
}

function ConfirmedStatus({ layer, areaData }: { layer: LayerId; areaData: AreaData }) {
  let hasConfirmed = false;

  if (layer === "guide") {
    hasConfirmed = areaData.guideAssignments.some((a) => a.confirmed_at != null);
  } else if (layer === "draft") {
    const record = areaData.record as { confirmed_at?: string | null } | null;
    hasConfirmed = record?.confirmed_at != null;
  } else if (layer === "analysis") {
    hasConfirmed = areaData.activityTags.some((t) => t.status === "confirmed");
  } else if (layer === "direction") {
    hasConfirmed = areaData.setekGuides.some((g) => g.status === "confirmed");
  }

  return (
    <p className={cn("text-[10px]", hasConfirmed ? "text-emerald-600" : "text-[var(--text-tertiary)]")}>
      {hasConfirmed ? "✅ 확정 완료" : "미확정"}
    </p>
  );
}

function resolveRecordType(area: RecordArea): "setek" | "changche" | "haengteuk" | "personal_setek" | null {
  switch (area.type) {
    case "setek":
      return area.subjectId ? "setek" : "personal_setek";
    case "changche":
      return "changche";
    case "haengteuk":
      return "haengteuk";
    default:
      return null;
  }
}
