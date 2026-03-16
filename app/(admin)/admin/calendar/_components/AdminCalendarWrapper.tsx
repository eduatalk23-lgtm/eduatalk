'use client';

import { Suspense } from 'react';
import { Search, Calendar } from 'lucide-react';
import { StudentSwitcher } from './StudentSwitcher';
import { AdminPlanManagement } from '../../students/[id]/plans/_components/AdminPlanManagement';
import { AdminPlanManagementSkeleton } from '../../students/[id]/plans/_components/AdminPlanManagementSkeleton';
import type { CalendarPageData } from '@/lib/domains/admin-plan/actions/calendarPageData';

interface AdminCalendarWrapperProps {
  /** null이면 학생 미선택 상태 */
  studentId: string | null;
  studentName: string | null;
  tenantId: string | null;
  calendarId: string | null;
  pageData: CalendarPageData | null;
  /** 관리자 본인 캘린더 모드 */
  isPersonalMode?: boolean;
  /** 현재 사용자 ID (권한 확인용) */
  currentUserId?: string;
}

export function AdminCalendarWrapper({
  studentId,
  studentName,
  tenantId,
  calendarId,
  pageData,
  isPersonalMode = false,
  currentUserId,
}: AdminCalendarWrapperProps) {
  // 데이터 없음: 학생 선택 프롬프트 (personal 모드가 아닌 경우에만)
  if ((!studentId || !calendarId || !pageData || !tenantId) && !isPersonalMode) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col">
        {/* Header with StudentSwitcher */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--text-secondary)]" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">학생 캘린더</h1>
          </div>
          <StudentSwitcher
            currentStudentId={null}
            currentStudentName={null}
          />
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]">
              <Search className="w-8 h-8 text-[var(--text-tertiary)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              학생을 선택해주세요
            </h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              우측 상단의 학생 검색 버튼을 클릭하여
              캘린더를 조회할 학생을 선택하세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 캘린더 표시: personal 또는 학생 캘린더
  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={studentId!}
          studentName={studentName ?? ''}
          tenantId={tenantId!}
          initialDate={pageData!.targetDate}
          activePlanGroupId={pageData!.activePlanGroupId}
          allPlanGroups={pageData!.allPlanGroups}
          calendarId={calendarId!}
          calendarDailySchedules={pageData!.calendarDailySchedules}
          calendarExclusions={pageData!.calendarExclusions}
          calendarCalculatedSchedule={pageData!.calendarCalculatedSchedule}
          calendarDateTimeSlots={pageData!.calendarDateTimeSlots}
          viewMode={isPersonalMode ? "personal" : "admin"}
          currentUserId={currentUserId}
          selectedCalendarSettings={pageData!.calendarSettings}
          studentSwitcher={
            <StudentSwitcher
              currentStudentId={studentId}
              currentStudentName={isPersonalMode ? `${studentName} (나)` : studentName}
            />
          }
        />
      </Suspense>
    </div>
  );
}
