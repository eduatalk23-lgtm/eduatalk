'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { Planner } from '@/lib/domains/admin-plan/actions';
import { PlannerStatusBadge } from '@/components/planner/PlannerStatusBadge';

interface StudentPlannerHeaderProps {
  planner: Planner;
}

/**
 * 학생용 플랜 관리 페이지 헤더
 * - 플래너 선택 페이지로 돌아가기 링크
 * - 현재 플래너 정보 표시 (이름, 기간)
 */
export function StudentPlannerHeader({ planner }: StudentPlannerHeaderProps) {
  // 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
  const formatDate = (dateStr: string) => {
    return dateStr.replace(/-/g, '.');
  };

  return (
    <div className="mb-6">
      {/* 뒤로가기 링크 */}
      <Link
        href="/plan/planner"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        플래너 선택으로 돌아가기
      </Link>

      {/* 페이지 제목 및 플래너 정보 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 플랜 관리</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {/* 플래너 이름 */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-gray-900">{planner.name}</span>
            </div>

            {/* 플래너 기간 */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>
                {formatDate(planner.periodStart)} ~ {formatDate(planner.periodEnd)}
              </span>
            </div>

            {/* 플래너 상태 뱃지 */}
            <PlannerStatusBadge status={planner.status} variant="student" />
          </div>
        </div>
      </div>
    </div>
  );
}
