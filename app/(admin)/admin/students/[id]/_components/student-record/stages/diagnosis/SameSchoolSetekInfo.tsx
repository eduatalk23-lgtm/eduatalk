"use client";

import { useState } from "react";
import { ChevronDown, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { findSameSchoolSeteksAction } from "@/lib/domains/student-record/actions/duplication";
import type { SameSchoolSetekEntry } from "@/lib/domains/student-record/actions/duplication";

interface SameSchoolSetekInfoProps {
  studentId: string;
  subjectId: string;
  schoolYear: number;
}

export function SameSchoolSetekInfo({ studentId, subjectId, schoolYear }: SameSchoolSetekInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [entries, setEntries] = useState<SameSchoolSetekEntry[] | null>(null);

  async function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    // on-demand fetch
    if (entries === null) {
      setIsLoading(true);
      try {
        const res = await findSameSchoolSeteksAction({ studentId, subjectId, schoolYear });
        setEntries(res.success && res.data ? res.data : []);
      } catch {
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    }
    setIsOpen(true);
  }

  // 이미 fetch 완료 + 빈 결과 → 숨김
  if (entries !== null && entries.length === 0 && !isOpen) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-[var(--border-secondary)]">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Users className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        <span className="flex-1 text-xs text-[var(--text-secondary)]">
          같은 학교 동일 과목 세특
          {entries !== null && entries.length > 0 && (
            <span className="ml-1 text-[var(--text-tertiary)]">({entries.length}건)</span>
          )}
        </span>
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-[var(--text-tertiary)]" />
        ) : (
          <ChevronDown className={cn("h-3 w-3 text-[var(--text-tertiary)] transition-transform", isOpen && "rotate-180")} />
        )}
      </button>

      {isOpen && entries !== null && (
        <div className="border-t border-dashed border-[var(--border-secondary)] px-3 pb-3 pt-2">
          {entries.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-tertiary)]">
              같은 학교에 동일 과목 세특이 없습니다
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry, i) => (
                <div key={i} className="rounded-md bg-bg-secondary p-2 dark:bg-bg-secondary/50">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-3xs font-medium text-[var(--text-secondary)]">
                      {entry.studentName} ({entry.grade}학년 {entry.semester}학기)
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {entry.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
