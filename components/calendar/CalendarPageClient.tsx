"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AdminPlanManagementClient } from "@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementClient";
import { AdminPlanManagementSkeleton } from "@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementSkeleton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { fetchCalendarPageData } from "@/lib/domains/admin-plan/actions/calendarPageData";

export interface CalendarPageClientProps {
  /** 로그인한 사용자 ID (권한 확인용) */
  currentUserId: string;
  /** 데이터를 조회할 학생 ID (student 모드 = currentUserId, admin 모드 = 대상 학생 ID) */
  studentId: string;
  /** 표시할 학생 이름 */
  studentName: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 캘린더 ID */
  calendarId: string;
  /** 뷰 모드 */
  viewMode: "student" | "admin" | "personal";
  /** autoOpenWizard (admin 경로에서만 사용) */
  autoOpenWizard?: boolean;
  /** 학생 전환 드롭다운 슬롯 (admin/personal 경로에서만 전달) */
  studentSwitcher?: ReactNode;
}

/**
 * CalendarPageClient — 세 캘린더 진입점 공용 클라이언트 컴포넌트
 *
 * 역할:
 *   - useSearchParams()로 date 파라미터 감지
 *   - React Query로 fetchCalendarPageData 클라이언트 페칭
 *   - AdminPlanManagementClient(lazy dynamic) 렌더
 *
 * 이 구조로:
 *   - router.replace('...?date=xxx') 시 서버 컴포넌트 재실행 없음
 *   - React Query queryKey 변경만으로 데이터 갱신 → race condition 근본 제거
 *   - 세 진입점(student/admin/personal) 동일 코드 경로 → 패치 1회로 전체 수정
 */
export function CalendarPageClient({
  currentUserId,
  studentId,
  studentName,
  tenantId,
  calendarId,
  viewMode,
  autoOpenWizard,
  studentSwitcher,
}: CalendarPageClientProps) {
  const searchParams = useSearchParams();
  const rawDate = searchParams.get("date") ?? undefined;
  const dateParam =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  const { data: pageData, isLoading, isError } = useQuery({
    queryKey: ["calendarPageData", studentId, calendarId, dateParam ?? "today"],
    queryFn: () => fetchCalendarPageData(studentId, calendarId, dateParam),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    // keepPreviousData: queryKey(dateParam)가 변경돼도 새 데이터 도착 전까지
    // 이전 데이터 유지 → 주차 네비게이션 깜빡임 제거
    placeholderData: keepPreviousData,
  });

  if (isLoading || !pageData) {
    return <AdminPlanManagementSkeleton />;
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon="⚠️"
          title="데이터를 불러올 수 없습니다"
          description="잠시 후 다시 시도해주세요."
        />
      </div>
    );
  }

  return (
    <AdminPlanManagementClient
      studentId={studentId}
      studentName={studentName}
      tenantId={tenantId}
      initialDate={pageData.targetDate}
      activePlanGroupId={pageData.activePlanGroupId}
      allPlanGroups={pageData.allPlanGroups}
      calendarId={calendarId}
      autoOpenWizard={autoOpenWizard}
      calendarDailySchedules={pageData.calendarDailySchedules}
      calendarExclusions={pageData.calendarExclusions}
      calendarCalculatedSchedule={pageData.calendarCalculatedSchedule}
      calendarDateTimeSlots={pageData.calendarDateTimeSlots}
      viewMode={viewMode}
      currentUserId={currentUserId}
      selectedCalendarSettings={pageData.calendarSettings}
      studentSwitcher={studentSwitcher}
    />
  );
}
