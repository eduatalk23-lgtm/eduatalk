"use client";

import { useState, useEffect } from "react";
import { Save, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { PlanGroup } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";
import {
  modalSectionContainer,
  modalSectionHeader,
  modalSectionDescription,
  inputFieldBase,
  quickActionButton,
  previewCardStyles,
  modalDivider,
  modalLabel,
  modalCancelButton,
  bgPage,
  textPrimary,
  textSecondary,
  textMuted,
  textTertiary,
} from "@/lib/utils/darkMode";

type PlanRange = {
  planId: string;
  blockIndex: number;
  startPageOrTime: number;
  endPageOrTime: number;
};

type PlanRangeAdjustModalProps = {
  group: PlanGroup;
  isOpen: boolean;
  onClose: () => void;
  onSave: (ranges: PlanRange[]) => Promise<void>;
  totalPages: number; // 콘텐츠의 총 페이지/시간 수
  isBook: boolean; // 책인지 강의인지 (페이지 vs 분)
};

type AdjustMode = "bulk" | "individual" | "smart";

export function PlanRangeAdjustModal({
  group,
  isOpen,
  onClose,
  onSave,
  totalPages,
  isBook,
}: PlanRangeAdjustModalProps) {
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("bulk");
  const [ranges, setRanges] = useState<PlanRange[]>([]);
  const [originalRanges, setOriginalRanges] = useState<PlanRange[]>([]);
  const [bulkStart, setBulkStart] = useState<number>(0);
  const [bulkEnd, setBulkEnd] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // 초기화
  useEffect(() => {
    if (isOpen) {
      const plan = group.plan;
      const initialRanges: PlanRange[] = [{
        planId: plan.id,
        blockIndex: plan.block_index ?? 0,
        startPageOrTime: plan.planned_start_page_or_time ?? 0,
        endPageOrTime: plan.planned_end_page_or_time ?? 0,
      }];

      setRanges(initialRanges);
      setOriginalRanges(JSON.parse(JSON.stringify(initialRanges)));

      // 전체 범위 계산
      setBulkStart(plan.planned_start_page_or_time ?? 0);
      setBulkEnd(plan.planned_end_page_or_time ?? 0);
    }
  }, [isOpen, group.plan]);

  const handleSave = async () => {
    // 검증
    for (const range of ranges) {
      if (range.startPageOrTime < 0) {
        alert(`${range.blockIndex}번 블록: 시작 값은 0 이상이어야 합니다.`);
        return;
      }
      if (range.endPageOrTime > totalPages) {
        alert(`${range.blockIndex}번 블록: 종료 값은 총량(${totalPages})을 초과할 수 없습니다.`);
        return;
      }
      if (range.startPageOrTime >= range.endPageOrTime) {
        alert(`${range.blockIndex}번 블록: 시작 값은 종료 값보다 작아야 합니다.`);
        return;
      }
    }

    // 블록 간 겹침 검증
    const sortedRanges = [...ranges].sort((a, b) => a.blockIndex - b.blockIndex);
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      if (sortedRanges[i].endPageOrTime > sortedRanges[i + 1].startPageOrTime) {
        alert("블록 간 범위가 겹치지 않도록 해주세요.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave(ranges);
      onClose();
    } catch (error) {
      alert("범위 조정에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAdjust = () => {
    if (bulkStart < 0 || bulkEnd > totalPages || bulkStart >= bulkEnd) {
      alert("올바른 범위를 입력해주세요.");
      return;
    }

    // 기존 블록 비율 유지하여 분배
    const totalOriginalRange = originalRanges.reduce(
      (sum, r) => sum + (r.endPageOrTime - r.startPageOrTime),
      0
    );
    const newTotalRange = bulkEnd - bulkStart;

    let currentStart = bulkStart;
    const newRanges: PlanRange[] = [];

    for (let i = 0; i < originalRanges.length; i++) {
      const originalRange =
        originalRanges[i].endPageOrTime - originalRanges[i].startPageOrTime;
      const ratio = totalOriginalRange > 0 ? originalRange / totalOriginalRange : 1 / originalRanges.length;
      const newRange = Math.round(newTotalRange * ratio);
      const newEnd = i === originalRanges.length - 1 ? bulkEnd : currentStart + newRange;

      newRanges.push({
        planId: originalRanges[i].planId,
        blockIndex: originalRanges[i].blockIndex,
        startPageOrTime: currentStart,
        endPageOrTime: newEnd,
      });

      currentStart = newEnd;
    }

    setRanges(newRanges);
  };

  const handleQuickAdjust = (offset: number) => {
    const newRanges = ranges.map((range) => ({
      ...range,
      startPageOrTime: Math.max(0, range.startPageOrTime + offset),
      endPageOrTime: Math.min(totalPages, range.endPageOrTime + offset),
    }));
    setRanges(newRanges);

    // Bulk 범위도 업데이트
    const minStart = Math.min(...newRanges.map((r) => r.startPageOrTime));
    const maxEnd = Math.max(...newRanges.map((r) => r.endPageOrTime));
    setBulkStart(minStart);
    setBulkEnd(maxEnd);
  };

  const handleRestore = () => {
    setRanges(JSON.parse(JSON.stringify(originalRanges)));
    const minStart = Math.min(...originalRanges.map((r) => r.startPageOrTime));
    const maxEnd = Math.max(...originalRanges.map((r) => r.endPageOrTime));
    setBulkStart(minStart);
    setBulkEnd(maxEnd);
  };

  const handleIndividualRangeChange = (
    index: number,
    field: "startPageOrTime" | "endPageOrTime",
    value: number
  ) => {
    const newRanges = [...ranges];
    newRanges[index] = {
      ...newRanges[index],
      [field]: value,
    };
    setRanges(newRanges);
  };

  const contentTitle = group.content?.title || "제목 없음";
  const unit = isBook ? "페이지" : "분";

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="플랜 범위 조정"
      description={contentTitle}
      maxWidth="4xl"
    >
      <DialogContent>
        <div className="max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="flex flex-col gap-6">
            {/* 현재 범위 */}
            <div className={cn("flex flex-col gap-3", modalSectionContainer, bgPage)}>
              <h3 className={modalSectionHeader}>현재 범위</h3>
              <div className="flex flex-col gap-2">
                {ranges.map((range, index) => (
                  <div key={range.planId} className={cn("text-sm", textSecondary)}>
                    블록 {range.blockIndex}: {range.startPageOrTime} ~ {range.endPageOrTime} {unit} (
                    {range.endPageOrTime - range.startPageOrTime} {unit})
                  </div>
                ))}
                <div className={cn("pt-2 border-t text-sm font-medium", modalDivider, textPrimary)}>
                  전체 범위: {bulkStart} ~ {bulkEnd} {unit} (총 {bulkEnd - bulkStart} {unit})
                </div>
              </div>
            </div>

            {/* 조정 방식 선택 */}
            <div className={cn("flex flex-col gap-3", modalSectionContainer)}>
              <h3 className={modalSectionHeader}>범위 조정 방법</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="adjustMode"
                    value="bulk"
                    checked={adjustMode === "bulk"}
                    onChange={(e) => setAdjustMode(e.target.value as AdjustMode)}
                    className="shrink-0"
                    aria-label="전체 범위 일괄 조정"
                  />
                  <div className="flex flex-col gap-1">
                    <div className={cn("font-medium", textPrimary)}>전체 범위 일괄 조정</div>
                    <div className={modalSectionDescription}>
                      모든 블록에 동일한 비율로 범위 분배
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="adjustMode"
                    value="individual"
                    checked={adjustMode === "individual"}
                    onChange={(e) => setAdjustMode(e.target.value as AdjustMode)}
                    className="shrink-0"
                    aria-label="개별 블록 조정"
                  />
                  <div className="flex flex-col gap-1">
                    <div className={cn("font-medium", textPrimary)}>개별 블록 조정</div>
                    <div className={modalSectionDescription}>
                      각 블록의 범위를 개별적으로 조정
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* 새 범위 입력 */}
            {adjustMode === "bulk" && (
              <div className={cn("flex flex-col gap-4", modalSectionContainer)}>
                <h3 className={modalSectionHeader}>새 범위 입력</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className={modalLabel}>
                      전체 시작 ({unit})
                    </label>
                  <input
                    type="number"
                    value={bulkStart}
                    onChange={(e) => setBulkStart(Number(e.target.value))}
                    min={0}
                    max={totalPages}
                    className={inputFieldBase}
                  />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={modalLabel}>
                      전체 종료 ({unit})
                    </label>
                  <input
                    type="number"
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(Number(e.target.value))}
                    min={bulkStart + 1}
                    max={totalPages}
                    className={inputFieldBase}
                  />
                  </div>
                </div>
                <button
                  onClick={handleBulkAdjust}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                  aria-label="범위 적용"
                >
                  범위 적용
                </button>

                {/* 빠른 조정 */}
                <div className={cn("pt-4 border-t flex flex-col gap-2", modalDivider)}>
                  <p className={cn("text-xs font-medium", textSecondary)}>빠른 조정</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuickAdjust(-10)}
                    className={quickActionButton}
                    aria-label={`10${unit} 앞으로 이동`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    10{unit} 앞으로
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(-5)}
                    className={quickActionButton}
                    aria-label={`5${unit} 앞으로 이동`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    5{unit} 앞으로
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(5)}
                    className={quickActionButton}
                    aria-label={`5${unit} 뒤로 이동`}
                  >
                    5{unit} 뒤로
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(10)}
                    className={quickActionButton}
                    aria-label={`10${unit} 뒤로 이동`}
                  >
                    10{unit} 뒤로
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {adjustMode === "individual" && (
            <div className={cn("flex flex-col gap-4", modalSectionContainer)}>
              <h3 className={modalSectionHeader}>개별 블록 범위</h3>
              <div className="flex flex-col gap-3">
                {ranges.map((range, index) => (
                  <div key={range.planId} className={cn("rounded-lg border p-3 flex flex-col gap-2", borderDefault, bgPage)}>
                    <div className={cn("text-sm font-medium", textPrimary)}>
                      블록 {range.blockIndex}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className={modalLabel}>
                          시작 ({unit})
                        </label>
                        <input
                          type="number"
                          value={range.startPageOrTime}
                          onChange={(e) =>
                            handleIndividualRangeChange(
                              index,
                              "startPageOrTime",
                              Number(e.target.value)
                            )
                          }
                          min={0}
                          max={totalPages}
                          className={cn(inputFieldBase, "py-1.5")}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={modalLabel}>
                          종료 ({unit})
                        </label>
                        <input
                          type="number"
                          value={range.endPageOrTime}
                          onChange={(e) =>
                            handleIndividualRangeChange(
                              index,
                              "endPageOrTime",
                              Number(e.target.value)
                            )
                          }
                          min={range.startPageOrTime + 1}
                          max={totalPages}
                          className={cn(inputFieldBase, "py-1.5")}
                        />
                      </div>
                    </div>
                    <div className={cn("text-xs", textTertiary)}>
                      범위: {range.endPageOrTime - range.startPageOrTime} {unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            {/* 미리보기 */}
            <div className={cn("flex flex-col gap-3", previewCardStyles)}>
              <h3 className={cn("text-sm font-semibold", textPrimary)}>미리보기</h3>
              <div className="flex flex-col gap-2">
                {ranges.map((range, index) => (
                  <div key={range.planId} className={cn("text-sm", textSecondary)}>
                    블록 {range.blockIndex}: {range.startPageOrTime} ~ {range.endPageOrTime} {unit} (
                    {range.endPageOrTime - range.startPageOrTime} {unit})
                  </div>
                ))}
              </div>
              <button
                onClick={handleRestore}
                className={cn("flex items-center gap-1 text-xs font-medium transition", textTertiary, "hover:text-gray-900 dark:hover:text-gray-100")}
                aria-label="원래대로 되돌리기"
              >
                <RotateCcw className="h-3 w-3" />
                원래대로 되돌리기
              </button>
            </div>

            {/* 주의사항 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                ⚠️ 주의사항
              </h3>
              <ul className="flex flex-col gap-1 text-xs text-amber-800">
                <li>• 범위 조정 시 진행 중인 플랜은 일시정지됩니다.</li>
                <li>• 기존 진행률은 유지됩니다.</li>
                <li>• 조정 후 학습 시간이 재계산될 수 있습니다.</li>
                <li>• 블록 간 범위가 겹치지 않도록 해주세요.</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <button
          onClick={onClose}
          className={modalCancelButton}
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          aria-label="범위 조정 적용"
        >
          <Save className="h-4 w-4" />
          적용
        </button>
      </DialogFooter>
    </Dialog>
  );
}

