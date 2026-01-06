"use client";

/**
 * PlanListSectionClient
 *
 * 플랜 목록 섹션의 Client Component wrapper
 * - 플랜 그룹 생성 버튼 및 모달 상태 관리
 * - "전체 보기" 링크 제공
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";

// 7단계 위저드를 dynamic import로 가져오기 (SSR 비활성화)
const AdminPlanCreationWizard7Step = dynamic(
  () =>
    import("../plans/_components/admin-wizard").then(
      (mod) => mod.AdminPlanCreationWizard7Step
    ),
  { ssr: false }
);

interface PlanListSectionClientProps {
  studentId: string;
  tenantId: string | null;
  studentName: string;
  children: React.ReactNode;
}

export function PlanListSectionClient({
  studentId,
  tenantId,
  studentName,
  children,
}: PlanListSectionClientProps) {
  const router = useRouter();
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const handleSuccess = useCallback(
    (_groupId: string, _generateAI: boolean) => {
      setShowCreateWizard(false);
      router.refresh();
    },
    [router]
  );

  return (
    <>
      <SectionCard
        title="학습 플랜"
        headerAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateWizard(true)}
              disabled={!tenantId}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              플랜 그룹 생성
            </button>
            <Link
              href={`/admin/students/${studentId}/plans`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              전체 보기 →
            </Link>
          </div>
        }
      >
        {children}
      </SectionCard>

      {/* 플랜 그룹 생성 위저드 모달 */}
      {showCreateWizard && tenantId && (
        <AdminPlanCreationWizard7Step
          studentId={studentId}
          tenantId={tenantId}
          studentName={studentName}
          onClose={() => setShowCreateWizard(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
