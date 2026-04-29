'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LinkedStudent } from '@/lib/domains/parent';

interface ParentChildSwitcherProps {
  students: LinkedStudent[];
  selectedStudentId: string;
}

function formatSubtitle(student: LinkedStudent): string {
  const parts: string[] = [];
  if (student.school_name) parts.push(student.school_name);
  if (student.grade) {
    const gradeClass = student.class
      ? `${student.grade}학년 ${student.class}반`
      : `${student.grade}학년`;
    parts.push(gradeClass);
  }
  return parts.join(' · ');
}

/**
 * 학부모 캘린더용 자녀 전환 pill — CalendarTopBar의 studentSwitcher로 전달
 * 관리자의 StudentSwitcher와 동일한 pill 디자인 토큰 사용
 */
export function ParentChildSwitcher({ students, selectedStudentId }: ParentChildSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStudent = students.find((s) => s.id === selectedStudentId);
  const displayName = currentStudent?.name ?? '자녀 선택';

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = useCallback(
    (studentId: string) => {
      setOpen(false);
      if (studentId !== selectedStudentId) {
        router.push(`/parent/calendar?studentId=${studentId}`);
      }
    },
    [router, selectedStudentId],
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger pill */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`자녀 선택: ${displayName}`}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full text-sm cursor-pointer transition-colors',
          'bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]',
          'hover:bg-[rgb(var(--color-secondary-200))] dark:hover:bg-[rgb(var(--color-secondary-700))]',
          'text-[var(--text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-info-500))] focus-visible:ring-offset-1',
        )}
      >
        <Users className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
        <span className="truncate max-w-[120px]">{displayName}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg shadow-lg border bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
          <div className="px-3 py-2 border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
            <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
              자녀 선택
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="자녀 목록">
            {students.map((student) => {
              const isSelected = student.id === selectedStudentId;
              const subtitle = formatSubtitle(student);

              return (
                <button
                  key={student.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(student.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-info-500))] focus-visible:ring-offset-1',
                    isSelected
                      ? 'bg-[rgb(var(--color-info-50))] dark:bg-[rgb(var(--color-info-950))]'
                      : 'hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]',
                  )}
                >
                  <span className="w-4 shrink-0">
                    {isSelected && (
                      <Check className="w-4 h-4 text-[rgb(var(--color-info-500))]" />
                    )}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div
                      className={cn(
                        'truncate font-medium',
                        isSelected
                          ? 'text-[rgb(var(--color-info-600))] dark:text-[rgb(var(--color-info-400))]'
                          : 'text-[var(--text-primary)]',
                      )}
                    >
                      {student.name ?? '(이름 없음)'}
                    </div>
                    {subtitle && (
                      <div className="flex flex-col gap-0.5 text-xs text-[var(--text-tertiary)] truncate">
                        {subtitle}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
