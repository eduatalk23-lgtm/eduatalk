"use client";

/**
 * 배치 AI 플랜 생성 모달
 *
 * 여러 학생에게 동시에 AI 플랜을 생성하는 4단계 모달입니다.
 * 1. 설정: 기간, 학습 시간, 옵션 설정
 * 2. 미리보기: 생성된 플랜 미리보기
 * 3. 진행: 실시간 진행 상황 표시
 * 4. 결과: 생성 결과 요약
 *
 * Phase 6: 4-Layer Context 패턴 적용
 *
 * @module BatchAIPlanModal
 */

import { useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";

import {
  BatchWizardProvider,
  useBatchStep,
  useBatchState,
} from "./BatchAIPlanModalWrapper";

import { BatchAIPlanModalContent } from "./BatchAIPlanModalContent";
import type { StudentListRow } from "./types";

// ============================================
// Props
// ============================================

interface BatchAIPlanModalProps {
  open: boolean;
  onClose: () => void;
  selectedStudents: StudentListRow[];
}

// ============================================
// 내부 모달 래퍼 (Context 내부에서 동작)
// ============================================

function BatchAIPlanModalInner({
  open,
  onClose,
  selectedStudents,
}: BatchAIPlanModalProps) {
  const { currentStep } = useBatchStep();
  const { isLoading, reset } = useBatchState();

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  // 스텝별 타이틀
  const getTitle = () => {
    switch (currentStep) {
      case "settings":
        return "배치 AI 플랜 생성";
      case "preview":
        return "플랜 미리보기";
      case "progress":
        return "플랜 저장 중...";
      case "results":
        return "생성 완료";
    }
  };

  // 스텝별 설명
  const getDescription = () => {
    switch (currentStep) {
      case "settings":
        return `${selectedStudents.length}명의 학생에게 AI 플랜을 생성합니다.`;
      case "preview":
        return "생성된 플랜을 확인하고 저장할 학생을 선택하세요.";
      case "progress":
        return "선택된 학생의 플랜을 저장하고 있습니다.";
      case "results":
        return "모든 학생의 플랜 생성이 완료되었습니다.";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !isLoading && onClose()}
      title={getTitle()}
      description={getDescription()}
      size="lg"
      showCloseButton={currentStep !== "progress"}
    >
      <BatchAIPlanModalContent
        selectedStudents={selectedStudents}
        onClose={onClose}
      />
    </Dialog>
  );
}

// ============================================
// 메인 컴포넌트 (Provider 래퍼)
// ============================================

export function BatchAIPlanModal({
  open,
  onClose,
  selectedStudents,
}: BatchAIPlanModalProps) {
  return (
    <BatchWizardProvider>
      <BatchAIPlanModalInner
        open={open}
        onClose={onClose}
        selectedStudents={selectedStudents}
      />
    </BatchWizardProvider>
  );
}
