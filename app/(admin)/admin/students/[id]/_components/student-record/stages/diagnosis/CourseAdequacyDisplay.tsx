"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { calculateCourseAdequacy } from "@/lib/domains/student-record";
import { MAJOR_RECOMMENDED_COURSES_2015, MAJOR_RECOMMENDED_COURSES_2022 } from "@/lib/domains/student-record/constants";
import type { CourseAdequacyResult } from "@/lib/domains/student-record";

type Props = {
  initialResult: CourseAdequacyResult | null;
  takenSubjects: string[];
  offeredSubjects: string[] | null;
  initialMajor: string | null;
  curriculumYear?: number;
};

const MAJOR_KEYS_2015 = Object.keys(MAJOR_RECOMMENDED_COURSES_2015);
const MAJOR_KEYS_2022 = Object.keys(MAJOR_RECOMMENDED_COURSES_2022);

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-[var(--text-primary)]">{value}%</span>
    </div>
  );
}

export function CourseAdequacyDisplay({ initialResult, takenSubjects, offeredSubjects, initialMajor, curriculumYear }: Props) {
  const [selectedMajor, setSelectedMajor] = useState(initialMajor ?? "");
  const majorKeys = (curriculumYear ?? 2015) >= 2022 ? MAJOR_KEYS_2022 : MAJOR_KEYS_2015;

  const result = useMemo(() => {
    if (!selectedMajor) return null;
    // 서버에서 계산한 초기 결과를 전공 미변경 시 재사용
    if (initialResult && selectedMajor === initialMajor) return initialResult;
    return calculateCourseAdequacy(selectedMajor, takenSubjects, offeredSubjects, curriculumYear);
  }, [selectedMajor, initialMajor, initialResult, takenSubjects, offeredSubjects, curriculumYear]);

  return (
    <div className="flex flex-col gap-4">
      {/* 전공 선택 */}
      <div className="flex items-center gap-3">
        <label className="shrink-0 text-sm font-medium text-[var(--text-primary)]">목표 전공</label>
        <select
          value={selectedMajor}
          onChange={(e) => setSelectedMajor(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 bg-[var(--background)] px-3 py-1.5 text-sm dark:border-gray-600"
        >
          <option value="">전공 계열 선택</option>
          {majorKeys.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {(curriculumYear ?? 2015) >= 2022 ? "2022 교육과정" : "2015 교육과정"}
        </span>
      </div>

      {!selectedMajor && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
          목표 전공 계열을 선택하면 교과 이수 적합도를 분석합니다.
        </div>
      )}

      {selectedMajor && !result && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
          해당 전공 계열의 추천 과목 정보가 없습니다.
        </div>
      )}

      {result && (
        <>
          {/* 종합 점수 */}
          <div className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-col items-center">
              <span className={cn(
                "text-3xl font-bold",
                result.score >= 70 ? "text-green-600" : result.score >= 50 ? "text-yellow-600" : "text-red-600",
              )}>
                {result.score}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">/ 100점</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <ScoreBar label="일반선택" value={result.generalRate} />
              <ScoreBar label="진로선택" value={result.careerRate} />
              {result.fusionRate != null && (
                <ScoreBar label="융합선택" value={result.fusionRate} />
              )}
            </div>
          </div>

          {/* 과목 상세 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* 이수 */}
            <SubjectList title="이수 완료" items={result.taken} variant="taken" />
            {/* 미이수 */}
            <SubjectList title="미이수 (이수 권장)" items={result.notTaken} variant="notTaken" />
            {/* 미개설 */}
            <SubjectList title="학교 미개설" items={result.notOffered} variant="notOffered" />
          </div>

          {/* 안내 */}
          <p className="text-xs text-[var(--text-tertiary)]">
            추천 과목 {result.totalRecommended}개 중 이수 가능 {result.totalAvailable}개, 이수 완료 {result.taken.length}개.
            {result.notOffered.length > 0 && ` 학교 미개설 ${result.notOffered.length}개는 적합도 계산에서 제외됩니다.`}
          </p>
        </>
      )}
    </div>
  );
}

function SubjectList({ title, items, variant }: {
  title: string;
  items: string[];
  variant: "taken" | "notTaken" | "notOffered";
}) {
  const colors = {
    taken: "border-green-200 dark:border-green-800",
    notTaken: "border-amber-200 dark:border-amber-800",
    notOffered: "border-gray-200 dark:border-gray-700",
  };
  const badgeColors = {
    taken: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    notTaken: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    notOffered: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  };

  return (
    <div className={cn("rounded-lg border p-3", colors[variant])}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-primary)]">{title}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", badgeColors[variant])}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <span className="text-xs text-[var(--text-tertiary)]">없음</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((name) => (
            <span key={name} className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-[var(--text-secondary)] dark:bg-gray-800">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
