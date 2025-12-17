"use client";

import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textTertiaryVar,
} from "@/lib/utils/darkMode";

type SubjectAnalysisSectionProps = {
  strongSubjects: string[];
  weakSubjects: string[];
};

export function SubjectAnalysisSection({
  strongSubjects,
  weakSubjects,
}: SubjectAnalysisSectionProps) {
  return (
    <div className={cn("flex flex-col gap-6 rounded-xl border p-6 shadow-sm", borderDefaultVar, bgSurfaceVar)}>
      <h3 className={cn("text-lg font-semibold", textPrimaryVar)}>과목 분석</h3>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 강점 과목 */}
        <div className="flex flex-col gap-4">
          <h4 className="text-base font-medium text-green-700 dark:text-green-300">강점 과목</h4>
          {strongSubjects.length > 0 ? (
            <div className="flex flex-col gap-2">
              {strongSubjects.map((subject) => (
                <div
                  key={subject}
                  className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-3 text-sm font-medium text-green-800 dark:text-green-200"
                >
                  {subject}
                </div>
              ))}
            </div>
          ) : (
            <p className={cn("text-sm", textTertiaryVar)}>강점 과목이 없습니다</p>
          )}
        </div>

        {/* 약점 과목 */}
        <div className="flex flex-col gap-4">
          <h4 className="text-base font-medium text-red-700 dark:text-red-300">약점 과목</h4>
          {weakSubjects.length > 0 ? (
            <div className="flex flex-col gap-2">
              {weakSubjects.map((subject) => (
                <div
                  key={subject}
                  className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-sm font-medium text-red-800 dark:text-red-200"
                >
                  {subject}
                </div>
              ))}
            </div>
          ) : (
            <p className={cn("text-sm", textTertiaryVar)}>약점 과목이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}

