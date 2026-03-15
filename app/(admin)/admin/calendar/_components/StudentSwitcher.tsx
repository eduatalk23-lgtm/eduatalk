'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { studentSearchQueryOptions } from '@/lib/query-options/students';
import type { StudentSearchItem } from '@/lib/domains/student/actions/search';

const RECENT_STUDENTS_KEY = 'admin_calendar_recent_students';
const MAX_RECENT = 5;

interface RecentStudent {
  id: string;
  name: string | null;
  grade: number | null;
  school_name: string | null;
  division: string | null;
}

function getRecentStudents(): RecentStudent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_STUDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentStudent(student: RecentStudent) {
  const recent = getRecentStudents().filter((s) => s.id !== student.id);
  recent.unshift(student);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  localStorage.setItem(RECENT_STUDENTS_KEY, JSON.stringify(recent));
}

interface StudentSwitcherProps {
  currentStudentId: string | null;
  currentStudentName: string | null;
}

export function StudentSwitcher({ currentStudentId, currentStudentName }: StudentSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // getRecentStudents() safely returns [] on server (typeof window === 'undefined')
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>(getRecentStudents);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search query
  const { data: searchResult, isLoading } = useQuery({
    ...studentSearchQueryOptions(debouncedQuery),
    enabled: open && debouncedQuery.length > 0,
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSelect = useCallback(
    (student: StudentSearchItem | RecentStudent) => {
      addRecentStudent({
        id: student.id,
        name: student.name,
        grade: 'grade' in student ? student.grade : null,
        school_name: 'school_name' in student ? student.school_name : null,
        division: 'division' in student ? (student.division as string | null) : null,
      });
      setRecentStudents(getRecentStudents());
      setOpen(false);
      setQuery('');
      router.push(`/admin/calendar?student=${student.id}`);
    },
    [router],
  );

  const displayName = currentStudentName ?? '학생 검색...';

  const students = searchResult?.students ?? [];
  const showRecent = query.length === 0 && recentStudents.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger — search pill style (matches TopBar searchPill tokens) */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-colors min-w-[200px]',
          'bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]',
          'hover:bg-[rgb(var(--color-secondary-200))] dark:hover:bg-[rgb(var(--color-secondary-700))]',
          currentStudentId
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)]',
        )}
      >
        <Search className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
        <span className="truncate">{displayName}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg shadow-lg border bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
          {/* Search Input */}
          <div className="p-2 border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="학생 이름 검색..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))] bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto py-1">
            {isLoading && debouncedQuery.length > 0 && (
              <div className="px-3 py-4 text-center text-sm text-[var(--text-tertiary)]">
                검색 중...
              </div>
            )}

            {!isLoading && debouncedQuery.length > 0 && students.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-[var(--text-tertiary)]">
                검색 결과가 없습니다
              </div>
            )}

            {/* Search results */}
            {!isLoading && students.length > 0 && students.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                isSelected={student.id === currentStudentId}
                onSelect={() => handleSelect(student)}
              />
            ))}

            {/* Recent students */}
            {showRecent && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  최근 조회
                </div>
                {recentStudents.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    isSelected={student.id === currentStudentId}
                    onSelect={() => handleSelect(student as StudentSearchItem)}
                  />
                ))}
              </>
            )}

            {/* Empty state (no recent, no search) */}
            {!showRecent && query.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-[var(--text-tertiary)]">
                학생 이름을 검색하세요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRow({
  student,
  isSelected,
  onSelect,
}: {
  student: { id: string; name: string | null; grade?: number | null; school_name?: string | null; division?: string | null };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const gradeLabel = student.grade
    ? `${student.division === '중등부' ? '중' : '고'}${student.grade}`
    : '';
  const subtitle = [gradeLabel, student.school_name].filter(Boolean).join(' ');

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]',
      )}
    >
      <span className="w-4 shrink-0">
        {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
      </span>
      <div className="flex-1 text-left min-w-0">
        <div
          className={cn(
            'truncate font-medium',
            isSelected
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-[var(--text-primary)]',
          )}
        >
          {student.name ?? '(이름 없음)'}
        </div>
        {subtitle && (
          <div className="text-xs text-[var(--text-tertiary)] truncate">{subtitle}</div>
        )}
      </div>
    </button>
  );
}
