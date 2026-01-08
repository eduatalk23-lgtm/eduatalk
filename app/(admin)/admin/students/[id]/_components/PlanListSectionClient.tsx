"use client";

/**
 * PlanListSectionClient
 *
 * 플랜 목록 섹션의 Client Component wrapper
 * - 플랜 관리 페이지로 이동하는 링크 제공
 * - 탭 페이지에서는 요약 정보만 표시
 */

import Link from "next/link";
import { Calendar, ArrowRight, ExternalLink } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";

interface PlanListSectionClientProps {
  studentId: string;
  tenantId: string | null;
  studentName: string;
  children: React.ReactNode;
}

export function PlanListSectionClient({
  studentId,
  children,
}: PlanListSectionClientProps) {
  return (
    <SectionCard
      title="학습 플랜"
      headerAction={
        <Link
          href={`/admin/students/${studentId}/plans`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Calendar className="h-4 w-4" />
          플랜 관리 페이지
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {children}

      {/* 플랜 관리 페이지 링크 카드 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <Link
          href={`/admin/students/${studentId}/plans`}
          className="group flex items-center justify-between rounded-lg border border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">플랜 관리 페이지로 이동</p>
              <p className="text-sm text-gray-500">
                플래너 생성, 플랜 그룹 관리, AI 플랜 생성 등 모든 기능
              </p>
            </div>
          </div>
          <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
        </Link>
      </div>
    </SectionCard>
  );
}
