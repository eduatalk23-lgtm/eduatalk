"use client";

import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  fetchCoverageReportAction,
  type ClusterCoverage,
} from "@/lib/domains/guide/actions/coverage-analysis";

const coverageQueryOptions = queryOptions({
  queryKey: ["guide", "coverage"],
  queryFn: () => fetchCoverageReportAction(),
  staleTime: 60_000,
});

const DIFFICULTY_COLORS = {
  basic: "bg-green-500",
  intermediate: "bg-yellow-500",
  advanced: "bg-red-500",
} as const;

const DIFFICULTY_LABELS = {
  basic: "기초",
  intermediate: "발전",
  advanced: "심화",
} as const;

function DifficultyBar({ dist, total }: { dist: ClusterCoverage["difficulty_distribution"]; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-secondary-200 dark:bg-secondary-700" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {(["basic", "intermediate", "advanced"] as const).map((level) => {
        const count = dist[level] ?? 0;
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={level}
            className={cn(DIFFICULTY_COLORS[level], "min-w-[2px]")}
            style={{ width: `${pct}%` }}
            title={`${DIFFICULTY_LABELS[level]}: ${count}건 (${pct.toFixed(0)}%)`}
          />
        );
      })}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: ClusterCoverage }) {
  const router = useRouter();
  const dist = cluster.difficulty_distribution;
  const hasGaps = cluster.gaps.length > 0;

  return (
    <Link
      href={`/admin/guides/coverage/${cluster.id}`}
      className={cn(
        "block rounded-xl border p-4 transition-colors hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-600",
        hasGaps
          ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
          : "border-secondary-200 bg-white dark:border-secondary-700 dark:bg-secondary-900",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-tight line-clamp-2">
          {cluster.name}
        </h3>
        {hasGaps ? (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        )}
      </div>

      {cluster.description && (
        <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
          {cluster.description}
        </p>
      )}

      <DifficultyBar dist={dist} total={cluster.guide_count} />

      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
        <span>{cluster.guide_count}건</span>
        <span className="text-green-600">{dist.basic ?? 0} 기초</span>
        <span className="text-yellow-600">{dist.intermediate ?? 0} 발전</span>
        <span className="text-red-600">{dist.advanced ?? 0} 심화</span>
        {cluster.quality.avgScore != null && (
          <span className={cn(
            "ml-auto font-medium",
            cluster.quality.avgScore >= 80 ? "text-green-600" :
            cluster.quality.avgScore >= 60 ? "text-yellow-600" : "text-red-600",
          )}>
            {cluster.quality.avgScore}점
          </span>
        )}
      </div>

      {hasGaps && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cluster.gaps.map((g) => {
            const params = new URLSearchParams({
              keyword: cluster.name,
              gapCluster: cluster.id,
              gapClusterName: cluster.name,
              difficultyLevel: g,
              guideType: cluster.guide_type || "topic_exploration",
            });
            if (cluster.career_field_codes?.[0]) {
              params.set("careerField", cluster.career_field_codes[0]);
            }
            if (cluster.subject_hints?.[0]) {
              params.set("subject", cluster.subject_hints[0]);
            }
            return (
              <button
                key={g}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/admin/guides/generate?${params.toString()}`);
                }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {DIFFICULTY_LABELS[g as keyof typeof DIFFICULTY_LABELS]} 생성
              </button>
            );
          })}
        </div>
      )}
    </Link>
  );
}

export function CoverageClient() {
  const { data: res, isLoading } = useQuery(coverageQueryOptions);
  const report = res?.success ? res.data : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/guides"
          className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            가이드 커버리지 분석
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            100개 주제 클러스터별 난이도 분포 및 갭 현황
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          분석 중...
        </div>
      )}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="전체 클러스터" value={report.summary.totalClusters} />
            <SummaryCard label="전체 가이드" value={report.summary.totalGuides.toLocaleString()} />
            <SummaryCard
              label="갭 있는 클러스터"
              value={report.summary.clustersWithGaps}
              warn={report.summary.clustersWithGaps > 0}
            />
            <SummaryCard
              label="심화 부재"
              value={report.summary.noAdvanced}
              warn={report.summary.noAdvanced > 0}
            />
          </div>

          {/* Cluster Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {report.clusters.map((c) => (
              <ClusterCard key={c.id} cluster={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        warn
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-secondary-200 bg-white dark:border-secondary-700 dark:bg-secondary-900",
      )}
    >
      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold",
          warn ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-primary)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
