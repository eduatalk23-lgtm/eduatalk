'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { Planner } from '@/lib/domains/admin-plan/actions';

interface PlannerHeaderProps {
  studentId: string;
  studentName: string;
  planner: Planner;
}

/**
 * 플랜 관리 페이지 헤더
 * - 플래너 선택 페이지로 돌아가기 링크
 * - 현재 플래너 정보 표시 (이름, 기간)
 */
export function PlannerHeader({
  studentId,
  studentName,
  planner,
}: PlannerHeaderProps) {
  // 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
  const formatDate = (dateStr: string) => {
    return dateStr.replace(/-/g, '.');
  };

  return (
    <div className="mb-6">
      {/* 뒤로가기 링크 */}
      <Link
        href={`/admin/students/${studentId}/plans`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        플래너 선택으로 돌아가기
      </Link>

      {/* 페이지 제목 및 플래너 정보 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            플랜 관리: {studentName}
          </h1>
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
            <PlannerStatusBadge status={planner.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 플래너 상태 뱃지
 */
function PlannerStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: {
      label: '초안',
      className: 'bg-gray-100 text-gray-700',
    },
    active: {
      label: '진행중',
      className: 'bg-green-100 text-green-700',
    },
    paused: {
      label: '일시중지',
      className: 'bg-yellow-100 text-yellow-700',
    },
    completed: {
      label: '완료',
      className: 'bg-blue-100 text-blue-700',
    },
    archived: {
      label: '보관됨',
      className: 'bg-gray-100 text-gray-500',
    },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${config.className}`}
    >
      {config.label}
    </span>
  );
}
