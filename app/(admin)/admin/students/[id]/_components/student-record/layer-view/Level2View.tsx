"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import type { RecordTabData, DiagnosisTabData, StorylineTabData } from "@/lib/domains/student-record/types";
import type { RecordArea, LayerId, PerspectiveId, LayerGuideAssignment, LayerActivityTag, LayerSetekGuide } from "./types";
import { DEFAULT_SELECTED_LAYERS, buildGridColumns, FOCUS_RING } from "./types";
import { MultiLayerBar } from "./MultiLayerBar";
import { PerspectiveFilter } from "./PerspectiveFilter";
import { LayerPanel } from "./LayerPanel";
import { useAreaData } from "./useAreaData";
import { Level3View } from "./Level3View";
import { BottomSheet } from "./BottomSheet";
import { GuidePanel } from "./panels/GuidePanel";
import { DeliverablePanel } from "./panels/DeliverablePanel";
import { DraftPanel } from "./panels/DraftPanel";
import { ActualPanel } from "./panels/ActualPanel";
import { AnalysisPanel } from "./panels/AnalysisPanel";
import { DirectionPanel } from "./panels/DirectionPanel";

interface Level2ViewProps {
  area: RecordArea;
  onBack: () => void;
  perspective: PerspectiveId;
  onPerspectiveChange: (p: PerspectiveId) => void;
  // 데이터 소스 (StudentRecordClient에서 전달)
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: LayerGuideAssignment[];
  activityTags: LayerActivityTag[];
  setekGuides: LayerSetekGuide[];
  deliverableFileCounts?: Record<string, number>;
  diagnosisData?: DiagnosisTabData | null;
  storylineData?: StorylineTabData | null;
  tenantId?: string;
}

export function Level2View({
  area,
  onBack,
  perspective,
  onPerspectiveChange,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  deliverableFileCounts,
  diagnosisData,
  storylineData,
  tenantId,
}: Level2ViewProps) {
  const [selectedLayers, setSelectedLayers] = useState<LayerId[]>(DEFAULT_SELECTED_LAYERS);
  const [drillLayer, setDrillLayer] = useState<LayerId | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);
  const queryClient = useQueryClient();

  // 워크플로우 액션 완료 시 해당 쿼리만 갱신 (scoped)
  const handleActionComplete = useCallback(() => {
    // 가이드 배정 관련만 (배정 목록 + 파일 카운트)
    queryClient.invalidateQueries({ queryKey: ["explorationGuide", "assignments"] });
    queryClient.invalidateQueries({ queryKey: ["explorationGuide", "fileCounts"] });
    // 현재 학년 레코드만
    const entry = recordByGrade.get(area.grade);
    if (entry) {
      queryClient.invalidateQueries({ queryKey: ["studentRecord", "recordTab"], exact: false });
    }
    // 진단 태그
    queryClient.invalidateQueries({ queryKey: ["diagnosis"], exact: false });
  }, [queryClient, area.grade, recordByGrade]);

  const areaData = useAreaData({
    area,
    recordByGrade,
    guideAssignments,
    activityTags,
    setekGuides,
    deliverableFileCounts,
  });

  // 레벨 3 진입: 스크롤 위치 저장
  const enterLevel3 = useCallback((layer: LayerId) => {
    savedScrollTop.current = scrollRef.current?.scrollTop ?? window.scrollY;
    setDrillLayer(layer);
  }, []);

  // 레벨 3 → 2 복귀: 스크롤 위치 복원
  const exitLevel3 = useCallback(() => {
    setDrillLayer(null);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = savedScrollTop.current;
      } else {
        window.scrollTo(0, savedScrollTop.current);
      }
    });
  }, []);

  // 레벨 2 레이아웃 (hooks는 조건부 return 전에 호출)
  const allActual = selectedLayers.every((l) => l === "actual");
  const gridStyle = useMemo(() => ({ gridTemplateColumns: buildGridColumns(selectedLayers) }), [selectedLayers]);

  // 바텀시트 (레벨 2/3 공통)
  const bottomSheet = (
    <BottomSheet
      currentArea={area}
      recordByGrade={recordByGrade}
      guideAssignments={guideAssignments}
      activityTags={activityTags}
      setekGuides={setekGuides}
      diagnosisData={diagnosisData}
      storylineData={storylineData}
      tenantId={tenantId}
    />
  );

  // --- 레벨 3: 특정 레이어 드릴 ---
  if (drillLayer) {
    return (
      <div className="animate-in fade-in duration-200">
        <Level3View
          area={area}
          layer={drillLayer}
          onBack={exitLevel3}
          onBackToLevel1={onBack}
          areaData={areaData}
          onActionComplete={handleActionComplete}
        />
        <div className="px-4 pb-4">{bottomSheet}</div>
      </div>
    );
  }

  // --- 레벨 2: 다중 레이어 가로 배치 ---
  return (
    <div ref={scrollRef} className="flex flex-col gap-4 p-4">
      {/* 브레드크럼 */}
      <nav aria-label={`${area.label} 내비게이션`} className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
        <button type="button" onClick={onBack} aria-label="전체 영역 목록으로 돌아가기" className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]", FOCUS_RING)}>
          생기부
        </button>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="font-medium text-[var(--text-primary)]" aria-current="page">{area.label}</span>
      </nav>

      {/* 컨트롤 바 */}
      <div className="sticky top-0 z-10 space-y-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] p-3">
        <MultiLayerBar selected={selectedLayers} onChange={setSelectedLayers} />
        <PerspectiveFilter
          selected={perspective}
          onChange={onPerspectiveChange}
          disabled={allActual}
        />
      </div>

      {/* 가로 배치 패널 */}
      <div
        className="grid min-h-[300px] gap-3 overflow-x-auto"
        style={gridStyle}
      >
        {selectedLayers.map((layer) => (
          <LayerPanel key={layer} layer={layer} onHeaderClick={() => enterLevel3(layer)}>
            <ErrorBoundary fallback={<p className="py-4 text-center text-xs text-red-500">패널을 표시할 수 없습니다.</p>}>
              {renderPanelContent(layer, perspective, areaData)}
            </ErrorBoundary>
          </LayerPanel>
        ))}
      </div>

      {/* 바텀시트 */}
      {bottomSheet}
    </div>
  );
}

function renderPanelContent(
  layer: LayerId,
  perspective: PerspectiveId,
  data: ReturnType<typeof useAreaData>,
) {
  switch (layer) {
    case "guide":
      return <GuidePanel assignments={data.guideAssignments} perspective={perspective} />;
    case "deliverable":
      return <DeliverablePanel fileCounts={data.deliverableFileCounts} />;
    case "draft":
      return <DraftPanel record={data.record as Record<string, unknown> | null} perspective={perspective} />;
    case "actual":
      return <ActualPanel record={data.record as Record<string, unknown> | null} />;
    case "analysis":
      return <AnalysisPanel tags={data.activityTags} perspective={perspective} />;
    case "direction":
      return <DirectionPanel guides={data.setekGuides} perspective={perspective} />;
    default:
      return null;
  }
}
