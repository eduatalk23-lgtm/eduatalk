"use client";

/**
 * BatchAIPlanModal 래퍼 컴포넌트
 * 기존 BatchAIPlanModal을 인라인으로 표시하고 결과를 상위로 전달
 */

import { useCallback } from "react";
import { BatchAIPlanModal } from "@/app/(admin)/admin/students/_components/BatchAIPlanModal";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type { CreationResult } from "../../_context/types";

interface BatchAIPlanWrapperProps {
  selectedStudents: StudentListRow[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: (results: CreationResult[]) => void;
}

export function BatchAIPlanWrapper({
  selectedStudents,
  isOpen,
  onClose,
  onComplete,
}: BatchAIPlanWrapperProps) {
  // 모달이 닫힐 때 처리
  // 참고: BatchAIPlanModal은 내부적으로 결과를 처리하므로
  // 현재는 onClose만 전달하고, 추후 결과 캡처 로직 추가 필요
  const handleClose = useCallback(() => {
    // TODO: Phase 2에서 결과 캡처 로직 추가
    // 현재는 단순히 닫기만 처리
    onClose();
  }, [onClose]);

  return (
    <BatchAIPlanModal
      open={isOpen}
      onClose={handleClose}
      selectedStudents={selectedStudents}
    />
  );
}
