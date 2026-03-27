"use client";

import type { RecordTabData, DiagnosisTabData, StorylineTabData } from "@/lib/domains/student-record/types";
import { cn } from "@/lib/cn";
import type { RecordArea, AreaSummary, LayerId, PerspectiveId, LayerGuideAssignment, LayerActivityTag, LayerSetekGuide } from "./types";
import { NEIS_SECTIONS, PERSPECTIVE_IDS, PERSPECTIVE_META, FOCUS_RING } from "./types";
import { LayerBar } from "./LayerBar";
import { AreaSection } from "./AreaSection";
import { AreaRow } from "./AreaRow";
import { RecordYearSelector } from "../RecordYearSelector";
import { Level2View } from "./Level2View";

interface LayerViewContainerProps {
  areas: RecordArea[];
  summaries: Map<string, AreaSummary>;
  selectedLayer: LayerId;
  onLayerChange: (layer: LayerId) => void;
  selectedPerspective: PerspectiveId;
  onPerspectiveChange: (perspective: PerspectiveId) => void;
  showGradePrefix: boolean;
  viewMode: "all" | number;
  onViewModeChange: (mode: "all" | number) => void;
  studentGrade: number;
  onAreaSelect?: (area: RecordArea) => void;
  selectedArea?: RecordArea | null;
  onAreaBack?: () => void;
  // 레벨 2 데이터 소스
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: LayerGuideAssignment[];
  activityTags: LayerActivityTag[];
  setekGuides: LayerSetekGuide[];
  deliverableFileCounts?: Record<string, number>;
  diagnosisData?: DiagnosisTabData | null;
  storylineData?: StorylineTabData | null;
  tenantId?: string;
}

const EMPTY_SUMMARY: AreaSummary = { text: "", isEmpty: true };

export function LayerViewContainer({
  areas,
  summaries,
  selectedLayer,
  onLayerChange,
  selectedPerspective,
  onPerspectiveChange,
  showGradePrefix,
  viewMode,
  onViewModeChange,
  studentGrade,
  onAreaSelect,
  selectedArea,
  onAreaBack,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  deliverableFileCounts,
  diagnosisData,
  storylineData,
  tenantId,
}: LayerViewContainerProps) {
  // --- 레벨 2: 영역 선택됨 → Level2View ---
  if (selectedArea && onAreaBack) {
    return (
      <div className="animate-in fade-in duration-200">
        <Level2View
          area={selectedArea}
          onBack={onAreaBack}
          perspective={selectedPerspective}
          onPerspectiveChange={onPerspectiveChange}
          recordByGrade={recordByGrade}
          guideAssignments={guideAssignments}
          activityTags={activityTags}
          setekGuides={setekGuides}
          deliverableFileCounts={deliverableFileCounts}
          diagnosisData={diagnosisData}
          storylineData={storylineData}
          tenantId={tenantId}
        />
      </div>
    );
  }

  // --- 레벨 1: 전체 영역 오버뷰 ---
  const hasAnyRecord = areas.some((a) => a.recordId);

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 컨트롤 바: 레이어 + 관점 + 학년 한 줄 */}
      {hasAnyRecord && (
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] px-3 py-2">
          <LayerBar selected={selectedLayer} onChange={onLayerChange} />
          <div className="h-4 w-px bg-[var(--border-secondary)]" />
          {/* 퍼스펙티브: 인라인 토글 (actual 레이어가 아닐 때) */}
          {selectedLayer !== "actual" && (
            <div className="flex items-center gap-0.5">
              {PERSPECTIVE_IDS.map((id) => {
                const meta = PERSPECTIVE_META[id];
                const active = id === selectedPerspective;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPerspectiveChange(id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                      FOCUS_RING,
                      active
                        ? "bg-emerald-600 text-white dark:bg-emerald-700"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    <span className="text-[10px]">{meta.emoji}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex-1" />
          <RecordYearSelector
            value={viewMode}
            onChange={onViewModeChange}
            studentGrade={studentGrade}
            compact
          />
        </div>
      )}

      {/* 영역 목록 (NEIS 섹션별) */}
      {NEIS_SECTIONS.map((section) => {
        const sectionAreas = areas.filter((a) => a.sectionNumber === section.number);
        if (sectionAreas.length === 0) return null;

        return (
          <AreaSection key={section.number} number={section.number} label={section.label}>
            {sectionAreas.map((area) => (
              <AreaRow
                key={area.id}
                area={area}
                summary={summaries.get(area.id) ?? EMPTY_SUMMARY}
                gradePrefix={showGradePrefix}
                onClick={onAreaSelect ? () => onAreaSelect(area) : undefined}
              />
            ))}
          </AreaSection>
        );
      })}

      {hasAnyRecord === false && (
        <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">
          기록 데이터가 없습니다. 먼저 생기부를 임포트하거나 기록을 입력해주세요.
        </div>
      )}
    </div>
  );
}
