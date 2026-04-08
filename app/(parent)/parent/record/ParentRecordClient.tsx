"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Tabs, TabPanel } from "@/components/molecules/Tabs";
import { fetchParentRecordSummary } from "@/lib/domains/student-record/actions/parentRecord";
import type { MinScoreCriteria } from "@/lib/domains/student-record";
import { APPLICATION_ROUND_LABELS } from "@/lib/domains/student-record";
import { RecordYearSelector } from "@/app/(admin)/admin/students/[id]/_components/student-record/RecordYearSelector";
import { StorylineTimeline } from "@/app/(admin)/admin/students/[id]/_components/student-record/stages/design/StorylineTimeline";
import { cn } from "@/lib/cn";

function parentRecordQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: ["parentRecord", studentId, schoolYear],
    queryFn: async () => {
      const result = await fetchParentRecordSummary(studentId, schoolYear);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && !!schoolYear,
  });
}

type ParentRecordClientProps = {
  studentId: string;
  initialSchoolYear: number;
};

const TABS = [
  { id: "overview", label: "요약" },
  { id: "strategy", label: "최저충족" },
  { id: "storyline", label: "스토리라인" },
  { id: "applications", label: "지원현황" },
];

export function ParentRecordClient({ studentId, initialSchoolYear }: ParentRecordClientProps) {
  const [schoolYear, setSchoolYear] = useState(initialSchoolYear);
  const [activeTab, setActiveTab] = useState("overview");

  const handleYearChange = (year: "all" | number) => {
    if (year !== "all") setSchoolYear(year);
  };

  const { data, isLoading, error } = useQuery(parentRecordQueryOptions(studentId, schoolYear));

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
        {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <RecordYearSelector value={schoolYear} onChange={handleYearChange} />
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} variant="pill" size="sm" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {/* 요약 탭 */}
          <TabPanel tabId="overview" activeTab={activeTab}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatCard label="세특" value={`${data.stats.setekCount}과목`} />
              <StatCard label="창체" value={`${data.stats.changcheCount}건`} />
              <StatCard label="독서" value={`${data.stats.readingCount}권`} />
              <StatCard label="수상" value={`${data.stats.awardCount}건`} />
              <StatCard label="봉사" value={`${data.stats.volunteerHours}시간`} />
            </div>

            {data.attendance && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <h4 className="mb-2 text-sm font-medium text-[var(--text-primary)]">출결 현황</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <p className="text-[var(--text-tertiary)]">결석</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {(data.attendance.absence_sick ?? 0) + (data.attendance.absence_unauthorized ?? 0) + (data.attendance.absence_other ?? 0)}일
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-tertiary)]">지각</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {(data.attendance.lateness_sick ?? 0) + (data.attendance.lateness_unauthorized ?? 0) + (data.attendance.lateness_other ?? 0)}회
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-tertiary)]">조퇴</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {(data.attendance.early_leave_sick ?? 0) + (data.attendance.early_leave_unauthorized ?? 0) + (data.attendance.early_leave_other ?? 0)}회
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-tertiary)]">수업일</p>
                    <p className="font-medium text-[var(--text-primary)]">{data.attendance.school_days ?? "-"}일</p>
                  </div>
                </div>
              </div>
            )}
          </TabPanel>

          {/* 최저 충족 탭 */}
          <TabPanel tabId="strategy" activeTab={activeTab}>
            {data.minScoreTargets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
                등록된 최저 목표가 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.minScoreTargets.map((target) => {
                  const criteria = target.criteria as unknown as MinScoreCriteria;
                  const latestSim = data.minScoreSimulations.find((s) => s.target_id === target.id);
                  const criteriaLabel = criteria.type === "none"
                    ? "최저 없음"
                    : criteria.type === "grade_sum"
                      ? `${criteria.subjects.join("+")} 중 ${criteria.count}개 합 ${criteria.maxSum} 이내`
                      : `${criteria.subjects.join("/")} ${criteria.maxSum}등급 이내`;

                  return (
                    <div key={target.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-[var(--text-primary)]">{target.university_name}</h4>
                          <p className="text-xs text-[var(--text-secondary)]">{target.department}</p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{criteriaLabel}</p>
                        </div>
                        {latestSim && (
                          <div className="text-right">
                            <span className={cn(
                              "rounded-full px-3 py-1 text-sm font-medium",
                              latestSim.is_met
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                            )}>
                              {latestSim.is_met ? "충족" : "미달"}
                            </span>
                            {latestSim.grade_sum != null && (
                              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                                등급합 {latestSim.grade_sum}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {latestSim?.bottleneck_subjects && latestSim.bottleneck_subjects.length > 0 && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          병목 과목: {latestSim.bottleneck_subjects.join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabPanel>

          {/* 스토리라인 탭 */}
          <TabPanel tabId="storyline" activeTab={activeTab}>
            <StorylineTimeline
              storylines={data.storylines}
              roadmapItems={data.roadmapItems}
            />
          </TabPanel>

          {/* 지원현황 탭 */}
          <TabPanel tabId="applications" activeTab={activeTab}>
            {data.applications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
                등록된 지원 현황이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.applications.map((app) => (
                  <div key={app.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                    <span className="text-xs text-[var(--text-tertiary)]">{APPLICATION_ROUND_LABELS[app.round] ?? app.round}</span>
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">{app.university_name}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">{app.department}</p>
                    <span className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                      app.result === "accepted" ? "bg-emerald-100 text-emerald-700" :
                      app.result === "rejected" ? "bg-red-100 text-red-700" :
                      app.result === "registered" ? "bg-indigo-100 text-indigo-700" :
                      "bg-gray-100 text-gray-600",
                    )}>
                      {app.result === "pending" ? "대기" : app.result === "accepted" ? "합격" : app.result === "waitlisted" ? "예비" : app.result === "rejected" ? "불합격" : "등록"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    </div>
  );
}
