"use client";

import { ChevronUp, ChevronDown, Package, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  textMuted,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import type { Program } from "@/lib/domains/crm/types";
import { formatPrice, PRICE_UNIT_LABELS } from "./priceUtils";

type ProgramListPanelProps = {
  programs: Program[];
  statsMap: Map<string, number>;
  selectedProgramId: string | null;
  onSelectProgram: (programId: string) => void;
  onNewProgram: () => void;
  onReorder: (programId: string, direction: "up" | "down") => void;
};

export function ProgramListPanel({
  programs,
  statsMap,
  selectedProgramId,
  onSelectProgram,
  onNewProgram,
  onReorder,
}: ProgramListPanelProps) {
  const activePrograms = programs.filter((p) => p.is_active);
  const inactivePrograms = programs.filter((p) => !p.is_active);

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4 shadow-sm", borderDefault, bgSurface)}>
      {/* 새 프로그램 버튼 */}
      <button
        type="button"
        onClick={onNewProgram}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        새 프로그램
      </button>

      {/* 카운트 */}
      <div className={cn("flex items-center gap-1.5 text-xs", textMuted)}>
        <Package className="h-3.5 w-3.5" />
        <span>
          총 {programs.length}개 (활성 {activePrograms.length}개)
        </span>
      </div>

      {/* 프로그램 리스트 */}
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-280px)]">
        {programs.length === 0 && (
          <div className={cn("py-8 text-center text-sm", textMuted)}>
            등록된 프로그램이 없습니다
          </div>
        )}

        {/* 활성 프로그램 */}
        {activePrograms.map((program, index) => (
          <ProgramItem
            key={program.id}
            program={program}
            activeCount={statsMap.get(program.id) ?? 0}
            isSelected={selectedProgramId === program.id}
            onSelect={() => onSelectProgram(program.id)}
            isFirst={index === 0}
            isLast={index === activePrograms.length - 1}
            onMoveUp={() => onReorder(program.id, "up")}
            onMoveDown={() => onReorder(program.id, "down")}
          />
        ))}

        {/* 비활성 구분선 */}
        {inactivePrograms.length > 0 && activePrograms.length > 0 && (
          <div className="py-2"><div className="border-t border-secondary-100 dark:border-secondary-700" /></div>
        )}
        {inactivePrograms.length > 0 && (
          <div className={cn("px-3 pb-1 text-[11px] font-medium", textMuted)}>
            비활성
          </div>
        )}
        {inactivePrograms.map((program) => (
          <ProgramItem
            key={program.id}
            program={program}
            activeCount={statsMap.get(program.id) ?? 0}
            isSelected={selectedProgramId === program.id}
            onSelect={() => onSelectProgram(program.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProgramItem({
  program,
  activeCount,
  isSelected,
  onSelect,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  program: Program;
  activeCount: number;
  isSelected: boolean;
  onSelect: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const priceLabel =
    program.price > 0
      ? `${formatPrice(program.price)}/${PRICE_UNIT_LABELS[program.price_unit] ?? program.price_unit}`
      : "무료";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg transition",
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-700"
          : "hover:bg-secondary-50 dark:hover:bg-secondary-700/50",
        !program.is_active && "opacity-60"
      )}
    >
      {/* 순서 변경 버튼 (활성 프로그램만) */}
      {program.is_active && onMoveUp && onMoveDown && (
        <div className="flex flex-col py-1 pl-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={isFirst}
            className="rounded p-0.5 text-secondary-400 hover:text-secondary-700 dark:text-secondary-500 dark:hover:text-secondary-300 disabled:invisible"
            title="위로"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={isLast}
            className="rounded p-0.5 text-secondary-400 hover:text-secondary-700 dark:text-secondary-500 dark:hover:text-secondary-300 disabled:invisible"
            title="아래로"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col gap-0.5 px-3 py-2.5 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-sm font-medium",
                isSelected ? "text-primary-700 dark:text-primary-300" : textPrimary
              )}
            >
              {program.name}
            </span>
            {!program.is_active && (
              <span className="rounded-full bg-error-100 dark:bg-error-900/30 px-1.5 py-0.5 text-[10px] font-medium text-error-600 dark:text-error-400">
                OFF
              </span>
            )}
          </span>
          <span className={cn("rounded-full bg-secondary-100 dark:bg-secondary-700 px-2 py-0.5 text-xs", textSecondary)}>
            {program.code}
          </span>
        </div>
        <div className={cn("flex items-center gap-2 text-xs", textMuted)}>
          <span>{priceLabel}</span>
          <span>수강 {activeCount}명</span>
        </div>
      </button>
    </div>
  );
}
