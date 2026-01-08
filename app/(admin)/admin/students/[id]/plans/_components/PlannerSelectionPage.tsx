'use client';

import { useRouter } from 'next/navigation';
import { PlannerManagement } from './PlannerManagement';
import type { Planner } from '@/lib/domains/admin-plan/actions';

interface PlannerSelectionPageProps {
  studentId: string;
  tenantId: string;
  studentName: string;
}

/**
 * 플래너 선택 페이지 컴포넌트
 * - 플래너 목록을 표시하고 선택 시 플랜 관리 페이지로 이동
 * - URL 기반 라우팅으로 플래너 선택 상태 관리
 */
export function PlannerSelectionPage({
  studentId,
  tenantId,
  studentName,
}: PlannerSelectionPageProps) {
  const router = useRouter();

  /**
   * 플래너 선택 시 플랜 관리 페이지로 라우팅
   */
  const handlePlannerSelect = (planner: Planner) => {
    router.push(`/admin/students/${studentId}/plans/${planner.id}`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <PlannerManagement
        studentId={studentId}
        tenantId={tenantId}
        studentName={studentName}
        onPlannerSelect={handlePlannerSelect}
        mode="selection"
      />
    </div>
  );
}
