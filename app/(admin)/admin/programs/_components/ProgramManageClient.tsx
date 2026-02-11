"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getPrograms,
  getProgramStats,
  reorderPrograms,
  type ProgramStat,
} from "@/lib/domains/crm/actions/programs";
import type { Program } from "@/lib/domains/crm/types";
import { ProgramListPanel } from "./ProgramListPanel";
import { ProgramFormPanel } from "./ProgramFormPanel";

type FormMode = "register" | "selected";

type ProgramManageClientProps = {
  isAdmin: boolean;
};

export function ProgramManageClient({ isAdmin }: ProgramManageClientProps) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [stats, setStats] = useState<ProgramStat[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    null
  );
  const [formMode, setFormMode] = useState<FormMode>("register");
  // 초기 로드 + 갱신
  const loadData = useCallback(async () => {
    const [programsResult, statsResult] = await Promise.all([
      getPrograms(),
      getProgramStats(),
    ]);
    setPrograms(programsResult.success ? (programsResult.data ?? []) : []);
    setStats(statsResult.success ? (statsResult.data ?? []) : []);
  }, []);

  // 최초 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;

  const handleSelectProgram = useCallback((programId: string) => {
    setSelectedProgramId(programId);
    setFormMode("selected");
  }, []);

  const handleNewProgram = useCallback(() => {
    setSelectedProgramId(null);
    setFormMode("register");
  }, []);

  const handleSaved = useCallback(
    (programId: string) => {
      setSelectedProgramId(programId);
      setFormMode("selected");
      loadData();
    },
    [loadData]
  );

  const handleDeleted = useCallback(() => {
    setSelectedProgramId(null);
    setFormMode("register");
    loadData();
  }, [loadData]);

  const handleToggled = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleReorder = useCallback(
    (programId: string, direction: "up" | "down") => {
      const activePrograms = programs.filter((p) => p.is_active);
      const idx = activePrograms.findIndex((p) => p.id === programId);
      if (idx < 0) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= activePrograms.length) return;

      const reordered = [...activePrograms];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

      // Optimistic update
      const inactivePrograms = programs.filter((p) => !p.is_active);
      setPrograms([...reordered, ...inactivePrograms]);

      startTransition(async () => {
        const result = await reorderPrograms(reordered.map((p) => p.id));
        if (!result.success) {
          toast.showError(result.error ?? "순서 변경에 실패했습니다.");
          loadData();
        }
      });
    },
    [programs, loadData, toast]
  );

  const statsMap = new Map(stats.map((s) => [s.program_id, s.active_count]));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* 왼쪽: 프로그램 목록 */}
      <ProgramListPanel
        programs={programs}
        statsMap={statsMap}
        selectedProgramId={selectedProgramId}
        onSelectProgram={handleSelectProgram}
        onNewProgram={handleNewProgram}
        onReorder={handleReorder}
      />

      {/* 오른쪽: 폼 패널 */}
      <ProgramFormPanel
        selectedProgram={selectedProgram}
        formMode={formMode}
        isAdmin={isAdmin}
        onNewProgram={handleNewProgram}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onToggled={handleToggled}
      />
    </div>
  );
}
