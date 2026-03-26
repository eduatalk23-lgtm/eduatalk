"use client";

import { useState, useMemo, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  bypassCandidatesQueryOptions,
  bypassPairsQueryOptions,
  bypassMajorKeys,
  discoveryQueryOptions,
} from "@/lib/query-options/bypassMajor";
import {
  generateCandidatesAction,
  runBypassPipelineAction,
} from "@/lib/domains/bypass-major/actions/bypass";
import type { DiscoverySuggestion } from "@/lib/domains/bypass-major/actions/bypass";
import type {
  UniversityDepartment,
  BypassCandidateWithDetails,
} from "@/lib/domains/bypass-major/types";
import { BypassTargetSelector } from "./BypassTargetSelector";
import { BypassCandidateList } from "./BypassCandidateList";
import { CurriculumComparisonView } from "./CurriculumComparisonView";
import { Compass, ListChecks, GitCompare, Wand2, Zap, Sparkles } from "lucide-react";

interface BypassMajorPanelProps {
  studentId: string;
  studentGrade: number;
  tenantId: string;
}

type TabKey = "candidates" | "comparison";

export function BypassMajorPanel({
  studentId,
  tenantId,
}: BypassMajorPanelProps) {
  const schoolYear = calculateSchoolYear();
  const queryClient = useQueryClient();
  const [isGenerating, startGenerate] = useTransition();

  // 1지망 학과 선택 상태
  const [targetDept, setTargetDept] = useState<UniversityDepartment | null>(
    null,
  );
  // 탭
  const [tab, setTab] = useState<TabKey>("candidates");
  // 커리큘럼 비교 대상
  const [compareTarget, setCompareTarget] = useState<{
    deptIdA: string;
    deptIdB: string;
  } | null>(null);
  // 생성 결과 메시지
  const [generateMsg, setGenerateMsg] = useState<{ text: string; type: "loading" | "success" | "empty" | "error" } | null>(null);

  // ─── 진단/희망학과 기반 목표 학과 자동 발견 ────────
  const { data: discoveryRes } = useQuery(
    discoveryQueryOptions(studentId, schoolYear),
  );

  const suggestions: DiscoverySuggestion[] = useMemo(() => {
    if (discoveryRes?.success !== true) return [];
    return discoveryRes.data?.suggestions ?? [];
  }, [discoveryRes]);

  const discoverySource = discoveryRes?.success === true ? discoveryRes.data?.source : null;
  const diagnosisContext = discoveryRes?.success === true ? discoveryRes.data?.diagnosisContext : null;
  const recommendedMajors = discoveryRes?.success === true ? discoveryRes.data?.recommendedMajors ?? [] : [];

  // ─── 학생별 기존 후보 조회 ─────────────────────────
  const { data: candidatesRes, isLoading: candidatesLoading } = useQuery(
    bypassCandidatesQueryOptions(studentId, schoolYear),
  );

  const candidates: BypassCandidateWithDetails[] = useMemo(() => {
    if (candidatesRes?.success !== true) return [];
    return candidatesRes.data ?? [];
  }, [candidatesRes]);

  // 목표 학과에 대한 사전 매핑 페어
  const { data: pairsRes, isLoading: pairsLoading } = useQuery({
    ...bypassPairsQueryOptions(targetDept?.id ?? ""),
    enabled: !!targetDept?.id,
  });

  const preMappedPairs = useMemo(() => {
    if (pairsRes?.success !== true) return [];
    return pairsRes.data ?? [];
  }, [pairsRes]);

  // 목표 학과 기준으로 후보 필터링
  const filteredCandidates = useMemo(() => {
    if (!targetDept) return candidates;
    return candidates.filter(
      (c) => c.target_department_id === targetDept.id,
    );
  }, [candidates, targetDept]);

  // 비교 뷰 열기
  function handleCompare(candidateDeptId: string, targetDeptId: string) {
    setCompareTarget({ deptIdA: targetDeptId, deptIdB: candidateDeptId });
    setTab("comparison");
  }

  // 비교 뷰 닫기
  function handleCloseCompare() {
    setCompareTarget(null);
    setTab("candidates");
  }

  // 후보 자동 생성 (커리큘럼 유사도만)
  function handleGenerate() {
    if (!targetDept) return;
    startGenerate(async () => {
      setGenerateMsg({ text: "커리큘럼 유사도 분석 중...", type: "loading" });
      const res = await generateCandidatesAction({
        studentId,
        targetDeptId: targetDept.id,
        schoolYear,
        tenantId,
      });
      if (res.success && res.data && res.data.totalGenerated > 0) {
        queryClient.invalidateQueries({
          queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
        });
        setGenerateMsg({
          text: `${res.data.totalGenerated}건 생성 (사전매핑 ${res.data.preMapped}, 유사도 ${res.data.similarity})`,
          type: "success",
        });
      } else if (res.success && res.data?.noCurriculum) {
        setGenerateMsg({ text: "목표 학과의 교육과정 데이터가 없습니다. '종합 분석'을 실행하면 교육과정을 자동으로 확충한 뒤 분석합니다.", type: "empty" });
      } else if (res.success) {
        setGenerateMsg({ text: "동일 계열 내 유사 학과를 찾지 못했습니다. 다른 목표 학과를 시도해보세요.", type: "empty" });
      } else {
        setGenerateMsg({ text: "후보 생성에 실패했습니다. 잠시 후 다시 시도해주세요.", type: "error" });
      }
    });
  }

  // 3필터 파이프라인 (커리큘럼 + 역량 매칭)
  function handlePipeline() {
    if (!targetDept) return;
    startGenerate(async () => {
      setGenerateMsg({ text: "종합 분석 중... (교육과정 확충 + 역량 매칭 + 배치 평가, 최대 40초 소요)", type: "loading" });
      const res = await runBypassPipelineAction({
        studentId,
        tenantId,
        targetDeptId: targetDept.id,
        schoolYear,
      });
      if (res.success && res.data && res.data.totalGenerated > 0) {
        queryClient.invalidateQueries({
          queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
        });
        const d = res.data;
        const parts = [`${d.totalGenerated}건 분석 완료`];
        if (d.withCompetency > 0) parts.push(`역량 ${d.withCompetency}건`);
        if (d.enriched > 0) parts.push(`교육과정 확충 ${d.enriched}건`);
        setGenerateMsg({ text: parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(", ")})` : parts[0], type: "success" });
      } else if (res.success) {
        setGenerateMsg({ text: "분석 가능한 우회학과 후보가 없습니다. 다른 목표 학과를 시도해보세요.", type: "empty" });
      } else {
        setGenerateMsg({ text: "종합 분석에 실패했습니다. 잠시 후 다시 시도해주세요.", type: "error" });
      }
    });
  }

  // 추천 학과 일괄 종합 분석
  function handleBulkAnalysis() {
    if (suggestions.length === 0) return;
    startGenerate(async () => {
      let totalGenerated = 0;
      let totalEnriched = 0;
      let totalCompetency = 0;
      const successNames: string[] = [];
      const failedNames: string[] = [];
      setGenerateMsg({ text: `${suggestions.length}개 추천 학과 일괄 분석 중... (최대 ${suggestions.length * 40}초 소요)`, type: "loading" });

      for (const s of suggestions) {
        try {
          const res = await runBypassPipelineAction({
            studentId,
            tenantId,
            targetDeptId: s.department.id,
            schoolYear,
          });
          if (res.success && res.data) {
            totalGenerated += res.data.totalGenerated;
            totalEnriched += res.data.enriched;
            totalCompetency += res.data.withCompetency;
            successNames.push(s.department.department_name);
          } else {
            failedNames.push(s.department.department_name);
          }
        } catch {
          failedNames.push(s.department.department_name);
        }
      }

      queryClient.invalidateQueries({
        queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
      });

      if (totalGenerated > 0) {
        const parts = [`${totalGenerated}건 분석 완료 (${successNames.length}개 학과)`];
        if (totalCompetency > 0) parts.push(`역량 ${totalCompetency}건`);
        if (totalEnriched > 0) parts.push(`확충 ${totalEnriched}건`);
        if (failedNames.length > 0) parts.push(`실패 ${failedNames.length}건`);
        setGenerateMsg({
          text: parts.join(" · "),
          type: failedNames.length > 0 ? "empty" : "success",
        });
      } else if (failedNames.length > 0) {
        setGenerateMsg({ text: `${failedNames.length}개 학과 분석에 실패했습니다. 잠시 후 다시 시도해주세요.`, type: "error" });
      } else {
        setGenerateMsg({ text: "분석 가능한 우회학과 후보가 없습니다.", type: "empty" });
      }
    });
  }

  // 목표 학과에서 탐지된 고유 대학 목록 (요약용)
  const uniqueUniversities = useMemo(() => {
    const set = new Set<string>();
    for (const c of filteredCandidates) {
      set.add(c.candidate_department.university_name);
    }
    return Array.from(set).sort();
  }, [filteredCandidates]);

  return (
    <div className="flex flex-col gap-4">
      {/* 자동 제안 — 진단/희망학과 기반 */}
      {suggestions.length > 0 && !targetDept && (
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {discoverySource === "diagnosis_recommended" ? "AI 진단 기반 추천 학과" : "희망 계열 기반 추천 학과"}
          </div>
          {/* 근거 정보 */}
          {diagnosisContext && discoverySource === "diagnosis_recommended" && (
            <div className="mt-1.5 flex flex-col gap-1 rounded-md bg-[var(--surface-secondary)] px-3 py-2 text-[11px]">
              {diagnosisContext.recordDirection && (
                <p className="text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">기록 방향</span>{" "}
                  {diagnosisContext.recordDirection}
                  {diagnosisContext.directionStrength && (
                    <span className={cn(
                      "ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium",
                      diagnosisContext.directionStrength === "strong" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                      diagnosisContext.directionStrength === "moderate" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                      diagnosisContext.directionStrength === "weak" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                    )}>
                      {diagnosisContext.directionStrength === "strong" ? "뚜렷" : diagnosisContext.directionStrength === "moderate" ? "보통" : "약함"}
                    </span>
                  )}
                </p>
              )}
              {recommendedMajors.length > 0 && (
                <p className="text-[var(--text-tertiary)]">
                  <span className="font-medium text-[var(--text-secondary)]">추천 계열</span>{" "}
                  {recommendedMajors.join(", ")}
                </p>
              )}
              {diagnosisContext.strengths.length > 0 && (
                <p className="text-[var(--text-tertiary)]">
                  <span className="font-medium text-[var(--text-secondary)]">주요 강점</span>{" "}
                  {diagnosisContext.strengths.slice(0, 2).join(" / ")}
                </p>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s.department.id}
                type="button"
                onClick={() => setTargetDept(s.department)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-3 py-1.5 text-xs transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50 dark:hover:border-primary-700 dark:hover:bg-primary-900/20"
              >
                <span className="font-medium text-[var(--text-primary)]">
                  {s.department.department_name}
                </span>
                <span className="text-[var(--text-tertiary)]">
                  {s.department.university_name}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleBulkAnalysis}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              전체 일괄 분석
            </button>
          </div>
          <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
            개별 클릭으로 목표 학과 설정 또는 "전체 일괄 분석"으로 모든 추천 학과를 한번에 분석합니다.
          </p>
        </div>
      )}

      {/* 진단/희망학과 없을 때 안내 */}
      {suggestions.length === 0 && discoverySource === "none" && !targetDept && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/10">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            자동 추천을 위해 진단 또는 희망 전공 설정이 필요합니다
          </p>
          <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
            AI 초기 분석을 먼저 실행하거나, 학생 프로필에서 희망 전공을 설정하면 목표 학과가 자동으로 추천됩니다.
            아래 검색으로 직접 목표 학과를 선택할 수도 있습니다.
          </p>
        </div>
      )}

      {/* 목표 학과 선택 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
          <Compass className="h-3.5 w-3.5" />
          목표 학과 (1지망)
          {suggestions.length > 0 && targetDept && (
            <span className="text-[10px] font-normal text-[var(--text-tertiary)]">
              — 또는 위 추천 학과를 선택하세요
            </span>
          )}
        </label>
        <BypassTargetSelector value={targetDept} onChange={setTargetDept} />
        {/* 선택 후에도 다른 추천 학과로 빠른 전환 */}
        {targetDept && suggestions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-tertiary)]">추천:</span>
            {suggestions
              .filter((s) => s.department.id !== targetDept.id)
              .map((s) => (
                <button
                  key={s.department.id}
                  type="button"
                  onClick={() => setTargetDept(s.department)}
                  className="rounded-md border border-[var(--border-secondary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] transition-colors hover:border-primary-300 hover:text-primary-600"
                >
                  {s.department.department_name} · {s.department.university_name}
                </button>
              ))}
          </div>
        )}
        {targetDept && (
          <div className="mt-2 flex flex-col gap-2">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            <strong>추천</strong>: 커리큘럼 유사도만으로 빠른 후보 생성 · <strong>종합 분석</strong>: 커리큘럼+배치+역량 3중 필터 정밀 분석
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              우회학과 추천
            </button>
            <button
              type="button"
              onClick={handlePipeline}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              종합 분석
            </button>
          </div>
          {generateMsg && (
            <div className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
              generateMsg.type === "loading" && "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-300",
              generateMsg.type === "success" && "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-300",
              generateMsg.type === "empty" && "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-300",
              generateMsg.type === "error" && "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-300",
            )}>
              {generateMsg.type === "loading" && (
                <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              )}
              {generateMsg.text}
            </div>
          )}
          </div>
        )}
      </div>

      {/* 사전 매핑 우회학과 요약 */}
      {targetDept && preMappedPairs.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/10">
          <p className="mb-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            사전 매핑된 우회학과 ({preMappedPairs.length}건)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preMappedPairs.map((pair) => (
              <span
                key={pair.id}
                className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              >
                {pair.bypass_department_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {pairsLoading && targetDept && (
        <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-tertiary)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-gray-600" />
          사전 매핑 데이터 불러오는 중...
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-[var(--border-secondary)]">
        {(
          [
            {
              key: "candidates" as const,
              label: "후보 목록",
              icon: ListChecks,
              disabled: false,
            },
            {
              key: "comparison" as const,
              label: "커리큘럼 비교",
              icon: GitCompare,
              disabled: !compareTarget,
            },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700",
              t.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.key === "candidates" && filteredCandidates.length > 0 && (
              <span className="ml-1 text-xs text-[var(--text-tertiary)]">
                ({filteredCandidates.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === "candidates" && (
        <>
          {candidatesLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              <span className="text-sm text-[var(--text-secondary)]">
                후보 불러오는 중...
              </span>
            </div>
          ) : (
            <BypassCandidateList
              candidates={filteredCandidates}
              studentId={studentId}
              schoolYear={schoolYear}
              onCompare={handleCompare}
              targetDeptId={targetDept?.id ?? null}
              tenantId={tenantId}
            />
          )}
        </>
      )}

      {tab === "comparison" && compareTarget && (
        <CurriculumComparisonView
          deptIdA={compareTarget.deptIdA}
          deptIdB={compareTarget.deptIdB}
          onClose={handleCloseCompare}
        />
      )}

      {/* 탐색 대학 요약 */}
      {uniqueUniversities.length > 0 && (
        <div className="rounded-lg bg-[var(--surface-secondary)] px-4 py-2.5">
          <p className="text-xs text-[var(--text-tertiary)]">
            탐색 대학:{" "}
            {uniqueUniversities.map((name, i) => (
              <span key={name}>
                {i > 0 && ", "}
                <span className="text-[var(--text-secondary)]">{name}</span>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
