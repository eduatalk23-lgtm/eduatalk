"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanModal,
} from "./context/AdminPlanContext";
import { PlanGroupSelector } from "./PlanGroupSelector";
import type { ShortcutConfig } from "./useKeyboardShortcuts";
import {
  Wand2,
  Plus,
  LineChart,
  Trash2,
  ClipboardList,
  MoreHorizontal,
  AlertTriangle,
  FileText,
  X,
  Keyboard,
  Settings2,
} from "lucide-react";

interface AdminPlanHeaderProps {
  studentName: string;
  // shortcuts prop은 현재 사용하지 않지만 향후 단축키 힌트 표시에 사용 예정
  shortcuts?: ShortcutConfig[];
}

export function AdminPlanHeader({
  studentName,
}: AdminPlanHeaderProps) {
  // 분리된 Context 사용 (ModalData, Actions 제외 → 불필요한 리렌더링 방지)
  const {
    studentId,
    tenantId,
    selectedCalendarId,
    allPlanGroups,
    canCreatePlans,
    isAdminMode,
  } = useAdminPlanBasic();

  const {
    selectedGroupId,
    setSelectedGroupId,
    handleRefresh,
  } = useAdminPlanFilter();

  const {
    openUnifiedModal,
    setShowCreateWizard,
    setShowAIPlanModal,
    setShowOptimizationPanel,
    setShowTemplateModal,
    setShowConditionalDeleteModal,
    setShowShortcutsHelp,
    setShowPlanGroupManageModal,
    setShowMarkdownExportModal,
  } = useAdminPlanModal();

  // 단축키 힌트 배너 상태 (localStorage 연동)
  const [showShortcutsHint, setShowShortcutsHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem("admin-plan-shortcuts-hint-dismissed") !== "true"
    );
  });

  const dismissShortcutsHint = useCallback(() => {
    setShowShortcutsHint(false);
    localStorage.setItem("admin-plan-shortcuts-hint-dismissed", "true");
  }, []);

  return (
    <>
      {/* 캘린더 미선택 경고 배너 */}
      {!selectedCalendarId && (
        <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning-600" />
          <span className="text-sm text-warning-700">
            플랜을 생성하려면 먼저 캘린더를 선택해주세요.
          </span>
        </div>
      )}

      {/* 단축키 힌트 배너 */}
      {showShortcutsHint && (
        <div className="p-3 bg-info-50 border border-info-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 flex-shrink-0 text-info-600" />
            <span className="text-sm text-info-700">
              <strong>Tip:</strong> 키보드 단축키로 더 빠르게 작업하세요!{" "}
              <kbd className="px-1.5 py-0.5 text-xs bg-info-100 border border-info-300 rounded">
                ?
              </kbd>{" "}
              키를 눌러 확인
            </span>
          </div>
          <button
            onClick={dismissShortcutsHint}
            className="p-1 hover:bg-info-100 rounded transition-colors"
            aria-label="단축키 힌트 닫기"
          >
            <X className="h-4 w-4 text-info-600" />
          </button>
        </div>
      )}

      {/* 헤더 영역 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            {isAdminMode ? `${studentName} 플랜 관리` : "내 플랜 관리"}
          </h1>

          {/* 플랜 그룹 선택 */}
          <PlanGroupSelector
            groups={allPlanGroups}
            selectedGroupId={selectedGroupId}
            onSelect={setSelectedGroupId}
            tenantId={tenantId}
            studentId={studentId}
            onRefresh={handleRefresh}
          />

        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openUnifiedModal("quick")}
            disabled={!canCreatePlans}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              canCreatePlans
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-gray-300 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            )}
            title={
              canCreatePlans
                ? "플랜 추가 (Q/A)"
                : "먼저 플래너를 선택해주세요"
            }
          >
            <Plus className="h-4 w-4" />
            플랜 추가
          </button>
          <button
            onClick={() => setShowCreateWizard(true)}
            disabled={!canCreatePlans}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              canCreatePlans
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-gray-300 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            )}
            title={
              canCreatePlans
                ? "플랜 그룹 생성 (g)"
                : "먼저 캘린더를 선택해주세요"
            }
          >
            <Plus className="h-4 w-4" />
            플랜 그룹
          </button>
          {canCreatePlans && (
            <button
              onClick={() => setShowAIPlanModal(true)}
              className="flex items-center gap-2 rounded-lg bg-info-50 px-3 py-2 text-sm font-medium text-info-700 hover:bg-info-100"
              title="AI 플랜 생성 (i)"
            >
              <Wand2 className="h-4 w-4" />
              AI 생성
            </button>
          )}
          <button
            onClick={() => setShowOptimizationPanel(true)}
            className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm font-medium text-success-700 hover:bg-success-100"
            title="AI 플랜 최적화 (o)"
          >
            <LineChart className="h-4 w-4" />
            AI 분석
          </button>
          {/* 더보기 드롭다운 */}
          <div className="relative group">
            <button
              className="flex items-center gap-1 p-2 text-secondary-500 hover:bg-secondary-100 rounded-lg"
              title="더보기"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[rgb(var(--color-secondary-50))] border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left"
              >
                <ClipboardList className="h-4 w-4" />
                플랜 템플릿
              </button>
              <button
                onClick={() => setShowPlanGroupManageModal(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left"
              >
                <Settings2 className="h-4 w-4" />
                플랜 그룹 관리
              </button>
              <button
                onClick={() => setShowMarkdownExportModal(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left"
              >
                <FileText className="h-4 w-4" />
                마크다운 내보내기
              </button>
              {isAdminMode && (
                <button
                  onClick={() => setShowConditionalDeleteModal(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  조건부 삭제
                </button>
              )}
              <hr className="my-1" />
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left"
              >
                <Keyboard className="h-4 w-4" />
                단축키 도움말
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
