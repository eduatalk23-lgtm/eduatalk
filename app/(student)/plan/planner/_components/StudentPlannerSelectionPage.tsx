'use client';

import { useRouter } from 'next/navigation';
import { PlannerManagement } from '@/app/(admin)/admin/students/[id]/plans/_components/PlannerManagement';
import type { Planner } from '@/lib/domains/admin-plan/actions';

interface StudentPlannerSelectionPageProps {
  studentId: string;
  tenantId: string;
  studentName: string;
}

/**
 * 학생용 플래너 선택 페이지 컴포넌트
 * - 학생의 플래너 목록을 표시하고 선택 시 플랜 관리 페이지로 이동
 * - viewMode="student"로 Admin 전용 기능 숨김
 */
export function StudentPlannerSelectionPage({
  studentId,
  tenantId,
  studentName,
}: StudentPlannerSelectionPageProps) {
  const router = useRouter();

  /**
   * 플래너 선택 시 학생용 플랜 관리 페이지로 라우팅
   * 관리자 생성 플래너는 진입 차단 (방어 코드)
   */
  const handlePlannerSelect = (planner: Planner | null) => {
    if (!planner || planner.createdBy !== studentId) return;
    router.push(`/plan/planner/${planner.id}`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <PlannerManagement
        studentId={studentId}
        tenantId={tenantId}
        studentName={studentName}
        onPlannerSelect={handlePlannerSelect}
        mode="selection"
        viewMode="student"
      />
    </div>
  );
}
