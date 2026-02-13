"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import type { EnrollmentWithProgram } from "@/lib/domains/enrollment/types";
import { ProgramCard } from "./ProgramCard";

type ProgramListPanelProps = {
  activeEnrollments: EnrollmentWithProgram[];
  historyEnrollments: EnrollmentWithProgram[];
  selectedEnrollmentId: string | null;
  onSelectEnrollment: (id: string) => void;
  onDeleteEnrollment: (id: string) => void;
  onAddEnrollment: () => void;
};

export function ProgramListPanel({
  activeEnrollments,
  historyEnrollments,
  selectedEnrollmentId,
  onSelectEnrollment,
  onDeleteEnrollment,
  onAddEnrollment,
}: ProgramListPanelProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const hasEnrollments =
    activeEnrollments.length > 0 || historyEnrollments.length > 0;

  return (
    <div className={cn("rounded-lg border p-4", borderDefault, bgSurface)}>
      <div className="flex items-center justify-between">
        <h2 className={cn("text-sm font-semibold", textPrimary)}>
          수강 프로그램
        </h2>
        <Button
          variant="primary"
          size="xs"
          onClick={onAddEnrollment}
          className="text-xs text-white"
        >
          + 등록
        </Button>
      </div>

      {/* 수강중 */}
      {activeEnrollments.length > 0 && (
        <div className="mt-3">
          <h3
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium",
              textSecondary
            )}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            수강중
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {activeEnrollments.length}
            </span>
          </h3>
          <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {activeEnrollments.map((e) => (
              <ProgramCard
                key={e.id}
                enrollment={e}
                isSelected={e.id === selectedEnrollmentId}
                onClick={() => onSelectEnrollment(e.id)}
                onDelete={() => onDeleteEnrollment(e.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 이력 (아코디언) */}
      {historyEnrollments.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setHistoryExpanded((prev) => !prev)}
            aria-expanded={historyExpanded}
            className={cn(
              "flex w-full items-center gap-1.5 text-[11px] font-medium",
              textSecondary
            )}
          >
            {historyExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
            이력
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {historyEnrollments.length}
            </span>
          </button>
          {historyExpanded && (
            <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {historyEnrollments.map((e) => (
                <ProgramCard
                  key={e.id}
                  enrollment={e}
                  isSelected={e.id === selectedEnrollmentId}
                  onClick={() => onSelectEnrollment(e.id)}
                  onDelete={() => onDeleteEnrollment(e.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!hasEnrollments && (
        <p className={cn("mt-4 text-center text-xs", textSecondary)}>
          등록된 수강이 없습니다.
        </p>
      )}
    </div>
  );
}
