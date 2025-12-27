"use client";

import { useRouter } from "next/navigation";
import { QuickPlanWizard } from "./QuickPlanWizard";

interface QuickPlanWizardWrapperProps {
  studentId: string;
  tenantId: string | null;
  defaultDate?: string;
}

export function QuickPlanWizardWrapper({
  studentId,
  tenantId,
  defaultDate,
}: QuickPlanWizardWrapperProps) {
  const router = useRouter();

  const handleSuccess = () => {
    // 성공 시 오늘의 학습 페이지로 이동
    router.push("/today");
  };

  const handleCancel = () => {
    // 취소 시 이전 페이지 또는 플랜 페이지로 이동
    router.back();
  };

  return (
    <QuickPlanWizard
      studentId={studentId}
      tenantId={tenantId}
      defaultDate={defaultDate}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
