"use client";

import { Suspense } from "react";
import { Calendar } from "lucide-react";
import { ParentChildSwitcher } from "./ParentChildSwitcher";
import { AdminPlanManagement } from "@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement";
import { AdminPlanManagementSkeleton } from "@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementSkeleton";
import type { CalendarPageData } from "@/lib/domains/admin-plan/actions/calendarPageData";
import type { LinkedStudent } from "@/lib/domains/parent";

interface ParentCalendarWrapperProps {
  studentId: string | null;
  studentName: string | null;
  tenantId: string | null;
  calendarId: string | null;
  pageData: CalendarPageData | null;
  linkedStudents: LinkedStudent[];
  selectedStudentId?: string;
  emptyReason?: "no_children" | "no_access" | "not_found" | "no_calendar";
}

export function ParentCalendarWrapper({
  studentId,
  studentName,
  tenantId,
  calendarId,
  pageData,
  linkedStudents,
  selectedStudentId,
  emptyReason,
}: ParentCalendarWrapperProps) {
  // 자녀 미연결 상태
  if (emptyReason === "no_children") {
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <Calendar className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            연결된 자녀가 없습니다
          </h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            관리자에게 자녀 연결을 요청해주세요.
          </p>
        </div>
      </div>
    );
  }

  // 접근 권한 없음
  if (emptyReason === "no_access") {
    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col">
        <ParentCalendarHeader
          linkedStudents={linkedStudents}
          selectedStudentId={selectedStudentId ?? ""}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              접근 권한이 없습니다
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300">
              이 학생의 캘린더를 조회할 권한이 없습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 캘린더 미생성 상태
  if (emptyReason === "no_calendar") {
    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col">
        <ParentCalendarHeader
          linkedStudents={linkedStudents}
          selectedStudentId={selectedStudentId ?? ""}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]">
              <Calendar className="w-8 h-8 text-[var(--text-tertiary)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              학습 캘린더가 아직 없습니다
            </h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              자녀가 학습 플랜을 시작하면 캘린더가 자동으로 생성됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 학생을 찾을 수 없음 / 데이터 로드 실패
  if (emptyReason === "not_found" || !studentId || !calendarId || !pageData || !tenantId) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col">
        <ParentCalendarHeader
          linkedStudents={linkedStudents}
          selectedStudentId={selectedStudentId ?? ""}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              캘린더를 불러올 수 없습니다
            </h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              다른 자녀를 선택하거나 잠시 후 다시 시도해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 캘린더 표시
  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={studentId}
          studentName={studentName ?? ""}
          tenantId={tenantId}
          initialDate={pageData.targetDate}
          activePlanGroupId={pageData.activePlanGroupId}
          allPlanGroups={pageData.allPlanGroups}
          calendarId={calendarId}
          calendarDailySchedules={pageData.calendarDailySchedules}
          calendarExclusions={pageData.calendarExclusions}
          calendarCalculatedSchedule={pageData.calendarCalculatedSchedule}
          calendarDateTimeSlots={pageData.calendarDateTimeSlots}
          initialDockData={pageData.initialDockData}
          viewMode="parent"
          selectedCalendarSettings={pageData.calendarSettings}
          studentSwitcher={
            <ParentChildSwitcher
              students={linkedStudents}
              selectedStudentId={selectedStudentId ?? studentId}
            />
          }
        />
      </Suspense>
    </div>
  );
}

/** 에러/빈 상태 헤더: CalendarTopBar와 동일한 디자인 토큰 사용 */
function ParentCalendarHeader({
  linkedStudents,
  selectedStudentId,
}: {
  linkedStudents: LinkedStudent[];
  selectedStudentId: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 h-16 border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[var(--text-secondary)]" />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          자녀 캘린더
        </h1>
      </div>
      {linkedStudents.length > 0 && (
        <ParentChildSwitcher
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />
      )}
    </div>
  );
}
