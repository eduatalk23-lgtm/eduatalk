"use client";

import { useState, useMemo, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  bypassCandidatesQueryOptions,
  bypassPairsQueryOptions,
  bypassMajorKeys,
} from "@/lib/query-options/bypassMajor";
import {
  generateCandidatesAction,
  runBypassPipelineAction,
} from "@/lib/domains/bypass-major/actions/bypass";
import type {
  UniversityDepartment,
  BypassCandidateWithDetails,
} from "@/lib/domains/bypass-major/types";
import { BypassTargetSelector } from "./BypassTargetSelector";
import { BypassCandidateList } from "./BypassCandidateList";
import { CurriculumComparisonView } from "./CurriculumComparisonView";
import { Compass, ListChecks, GitCompare, Wand2, Zap } from "lucide-react";

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
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

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
      setGenerateMsg(null);
      const res = await generateCandidatesAction({
        studentId,
        targetDeptId: targetDept.id,
        schoolYear,
        tenantId,
      });
      if (res.success && res.data) {
        queryClient.invalidateQueries({
          queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
        });
        setGenerateMsg(
          `${res.data.totalGenerated}건 생성 (사전매핑 ${res.data.preMapped}, 유사도 ${res.data.similarity})`,
        );
      } else {
        setGenerateMsg(res.success ? "생성할 후보가 없습니다." : "생성에 실패했습니다.");
      }
    });
  }

  // 3필터 파이프라인 (커리큘럼 + 역량 매칭)
  function handlePipeline() {
    if (!targetDept) return;
    startGenerate(async () => {
      setGenerateMsg(null);
      const res = await runBypassPipelineAction({
        studentId,
        tenantId,
        targetDeptId: targetDept.id,
        schoolYear,
      });
      if (res.success && res.data) {
        queryClient.invalidateQueries({
          queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
        });
        const d = res.data;
        setGenerateMsg(
          `${d.totalGenerated}건 분석 완료 (역량 ${d.withCompetency}건 반영)`,
        );
      } else {
        setGenerateMsg("파이프라인 실행에 실패했습니다.");
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
      {/* 목표 학과 선택 */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
          <Compass className="h-3.5 w-3.5" />
          목표 학과 (1지망)
        </label>
        <BypassTargetSelector value={targetDept} onChange={setTargetDept} />
        {targetDept && (
          <div className="mt-2 flex items-center gap-3">
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
            {generateMsg && (
              <span className="text-xs text-[var(--text-secondary)]">
                {generateMsg}
              </span>
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
