"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import AdminScoreListClient from "../[id]/_components/AdminScoreListClient";
import AdminScoreInputClient from "../[id]/_components/AdminScoreInputClient";
import {
  fetchScorePanelData,
  type ScorePanelData,
} from "@/lib/domains/score/actions/fetchScoreData";
import type { ScoreDashboardResponse } from "@/lib/types/scoreDashboard";
import { cn } from "@/lib/cn";

/** Client-safe dashboard API call (avoids importing next/headers) */
async function fetchDashboardClient(
  studentId: string,
  tenantId: string
): Promise<ScoreDashboardResponse> {
  const url = new URL(
    `/api/students/${studentId}/score-dashboard`,
    window.location.origin
  );
  url.searchParams.set("tenantId", tenantId);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || err.message || "API 호출 실패");
  }
  return res.json();
}

type ScoreSubTab = "analysis" | "list" | "input";

type ScoreSlidePanelProps = {
  studentId: string;
  studentLabel?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ScoreSlidePanel({
  studentId,
  studentLabel,
  isOpen,
  onClose,
}: ScoreSlidePanelProps) {
  const [data, setData] = useState<ScorePanelData | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dashboardData, setDashboardData] =
    useState<ScoreDashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<ScoreSubTab>("analysis");
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  const loadData = useCallback(
    (sid: string, existingTenantId?: string) => {
      startTransition(async () => {
        const result = await fetchScorePanelData(sid);
        setData(result);
        setDataLoaded(true);

        // analysis 탭용 대시보드 데이터
        const tenantId = existingTenantId ?? result?.tenantId;
        if (tenantId) {
          try {
            const dashboard = await fetchDashboardClient(sid, tenantId);
            setDashboardData(dashboard);
            setDashboardError(null);
          } catch (err) {
            setDashboardError(
              err instanceof Error
                ? err.message
                : "성적 분석 데이터를 불러오지 못했습니다."
            );
          }
        }
      });
    },
    []
  );

  useEffect(() => {
    const key = isOpen ? studentId : "";

    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (!key) {
      const id = requestAnimationFrame(() => {
        setData(null);
        setDataLoaded(false);
        setDashboardData(null);
        setDashboardError(null);
      });
      return () => cancelAnimationFrame(id);
    }

    loadData(studentId);
  }, [isOpen, studentId, loadData]);

  const handleRefresh = useCallback(() => {
    loadData(studentId, data?.tenantId);
  }, [studentId, data?.tenantId, loadData]);

  const subTabs: { key: ScoreSubTab; label: string }[] = [
    { key: "analysis", label: "성적 분석" },
    { key: "list", label: "성적 조회" },
    { key: "input", label: "성적 입력" },
  ];

  return (
    <SlideOverPanel
      id="score-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`성적 관리${studentLabel ? ` - ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      {isPending || (!data && !dataLoaded) ? (
        <div className="flex flex-col gap-4">
          <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <p className="text-sm text-yellow-800">
            학생의 기관 정보가 설정되지 않았거나 개정교육과정 정보가 없습니다.
            학생 설정을 먼저 완료해주세요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Sub-tab navigation */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            {subTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition",
                  activeSubTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Analysis sub-tab */}
          {activeSubTab === "analysis" && (
            <AnalysisContent
              dashboardData={dashboardData}
              dashboardError={dashboardError}
            />
          )}

          {/* List sub-tab */}
          {activeSubTab === "list" && (
            <AdminScoreListClient
              studentId={studentId}
              tenantId={data.tenantId}
              curriculumYear={data.curriculumYear}
              subjectGroups={data.subjectGroups}
              internalScores={data.internalScores}
              mockScores={data.mockScores}
              onRefresh={handleRefresh}
            />
          )}

          {/* Input sub-tab */}
          {activeSubTab === "input" && (
            <AdminScoreInputClient
              studentId={studentId}
              tenantId={data.tenantId}
              curriculumOptions={data.curriculumOptions}
              onRefresh={handleRefresh}
            />
          )}
        </div>
      )}
    </SlideOverPanel>
  );
}

function AnalysisContent({
  dashboardData,
  dashboardError,
}: {
  dashboardData: ScoreDashboardResponse | null;
  dashboardError: string | null;
}) {
  if (dashboardError) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          성적 정보를 불러오는 중 오류가 발생했습니다.
        </p>
        <p className="text-xs text-red-600">{dashboardError}</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  const { internalAnalysis, mockAnalysis, strategyResult } = dashboardData;

  const hasData =
    internalAnalysis.totalGpa !== null ||
    mockAnalysis.avgPercentile !== null ||
    Object.keys(internalAnalysis.subjectStrength).length > 0 ||
    mockAnalysis.recentExam !== null;

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">성적 분석</h2>

      {!hasData && (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm font-medium text-gray-700">
            성적 데이터가 없습니다.
          </p>
          <p className="text-xs text-gray-500">
            학생의 내신 또는 모의고사 성적을 입력하면 분석 결과가 표시됩니다.
          </p>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 rounded-lg bg-indigo-50 p-4">
          <div className="text-sm text-indigo-600">내신 GPA</div>
          <div className="text-2xl font-bold text-indigo-700">
            {internalAnalysis.totalGpa !== null
              ? internalAnalysis.totalGpa.toFixed(2)
              : "-"}
          </div>
          {internalAnalysis.zIndex !== null && (
            <div className="text-xs text-indigo-500">
              Z-Index: {internalAnalysis.zIndex.toFixed(2)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-lg bg-purple-50 p-4">
          <div className="text-sm text-purple-600">모의고사 평균 백분위</div>
          <div className="text-2xl font-bold text-purple-700">
            {mockAnalysis.avgPercentile !== null
              ? `${mockAnalysis.avgPercentile.toFixed(1)}%`
              : "-"}
          </div>
          {mockAnalysis.best3GradeSum !== null && (
            <div className="text-xs text-purple-500">
              상위 3개 등급 합: {mockAnalysis.best3GradeSum}
            </div>
          )}
        </div>
      </div>

      {/* 전략 분석 */}
      {strategyResult && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700">입시 전략</h3>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                strategyResult.type === "BALANCED"
                  ? "bg-blue-100 text-blue-800"
                  : strategyResult.type === "MOCK_ADVANTAGE"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-indigo-100 text-indigo-800"
              }`}
            >
              {strategyResult.type === "BALANCED"
                ? "균형형"
                : strategyResult.type === "MOCK_ADVANTAGE"
                  ? "모의고사 우위"
                  : "내신 우위"}
            </span>
            <p className="text-sm text-gray-700">{strategyResult.message}</p>
          </div>
          {strategyResult.data.diff !== null && (
            <div className="text-xs text-gray-600">
              내신 {strategyResult.data.internalPct?.toFixed(1) ?? "-"}% vs
              모의고사 {strategyResult.data.mockPct?.toFixed(1) ?? "-"}%
              (차이: {Math.abs(strategyResult.data.diff).toFixed(1)}%)
            </div>
          )}
        </div>
      )}

      {/* 교과군별 평점 */}
      {Object.keys(internalAnalysis.subjectStrength).length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-gray-700">교과군별 평점</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(internalAnalysis.subjectStrength).map(
              ([subject, gpa]) => (
                <div
                  key={subject}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2"
                >
                  <span className="text-sm text-gray-700">{subject}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {gpa.toFixed(2)}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
