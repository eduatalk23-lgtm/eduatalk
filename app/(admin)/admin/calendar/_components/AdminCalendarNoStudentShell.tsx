"use client";

import { Calendar, Search } from 'lucide-react';
import { StudentSwitcher } from './StudentSwitcher';

/**
 * 관리자 캘린더 — 학생 미선택 상태 셸
 *
 * /admin/calendar (학생 파라미터 없음) 접근 시, 또는
 * 학생 정보를 찾을 수 없을 때 렌더됩니다.
 */
export function AdminCalendarNoStudentShell() {
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
