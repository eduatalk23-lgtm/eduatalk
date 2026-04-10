"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  fetchClusterDetailAction,
  type ClusterDetail,
  type ClusterGuide,
  type SequelLink,
} from "@/lib/domains/guide/actions/cluster-detail";

function clusterDetailQueryOptions(clusterId: string) {
  return queryOptions({
    queryKey: ["guide", "cluster-detail", clusterId],
    queryFn: () => fetchClusterDetailAction(clusterId),
    staleTime: 60_000,
    enabled: !!clusterId,
  });
}

const DIFF_META = {
  basic: {
    label: "기초",
    grade: "1학년 권장",
    color: "border-green-300 dark:border-green-700",
    headerBg: "bg-green-50 dark:bg-green-950/30",
    headerText: "text-green-700 dark:text-green-300",
    dot: "bg-green-500",
  },
  intermediate: {
    label: "발전",
    grade: "2학년 권장",
    color: "border-yellow-300 dark:border-yellow-700",
    headerBg: "bg-yellow-50 dark:bg-yellow-950/30",
    headerText: "text-yellow-700 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
  advanced: {
    label: "심화",
    grade: "3학년 권장",
    color: "border-red-300 dark:border-red-700",
    headerBg: "bg-red-50 dark:bg-red-950/30",
    headerText: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
} as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  approved: "승인",
  ai_generating: "생성 중",
  ai_improving: "개선 중",
  ai_reviewing: "리뷰 중",
  ai_failed: "실패",
  pending_approval: "검토 대기",
  archived: "보관",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  draft: "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400",
  pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ai_failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function ClusterDetailClient({ clusterId }: { clusterId: string }) {
  const { data: res, isLoading } = useQuery(
    clusterDetailQueryOptions(clusterId),
  );
  const detail: ClusterDetail | null = res?.success ? res.data ?? null : null;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-[var(--text-secondary)]">
          로딩 중...
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-[var(--text-secondary)]">
          클러스터를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const { cluster, guidesByDifficulty, sequelLinks } = detail;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start gap-3">
        <Link
          href="/admin/guides/coverage"
          className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors mt-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            {cluster.name}
          </h1>
          {cluster.description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {cluster.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {cluster.subjectHints.length > 0 && (
              <span className="text-xs text-[var(--text-secondary)]">
                과목: {cluster.subjectHints.join(", ")}
              </span>
            )}
            {cluster.careerFieldCodes.length > 0 && (
              <span className="text-xs text-[var(--text-secondary)]">
                계열: {cluster.careerFieldCodes.join(", ")}
              </span>
            )}
            <span className="text-xs text-[var(--text-secondary)]">
              총 {cluster.guideCount}건
            </span>
          </div>
        </div>
      </div>

      {/* 3단 난이도 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["basic", "intermediate", "advanced"] as const).map((diff) => {
          const meta = DIFF_META[diff];
          const guides = guidesByDifficulty[diff];

          return (
            <div
              key={diff}
              className={cn(
                "rounded-xl border-2 overflow-hidden",
                meta.color,
              )}
            >
              {/* 컬럼 헤더 */}
              <div
                className={cn(
                  "px-4 py-3 flex items-center justify-between",
                  meta.headerBg,
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn("w-2.5 h-2.5 rounded-full", meta.dot)}
                  />
                  <span
                    className={cn("text-sm font-semibold", meta.headerText)}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    ({guides.length})
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {meta.grade}
                </span>
              </div>

              {/* 가이드 목록 */}
              <div className="p-3 space-y-2">
                {guides.map((g) => (
                  <GuideCard key={g.id} guide={g} />
                ))}

                {/* 생성 버튼 */}
                <GenerateButton
                  clusterName={cluster.name}
                  clusterId={cluster.id}
                  guideType={cluster.guideType}
                  difficulty={diff}
                  careerFieldCodes={cluster.careerFieldCodes}
                  subjectHints={cluster.subjectHints}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 사슬 관계 */}
      {sequelLinks.length > 0 && (
        <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            사슬 관계 ({sequelLinks.length}건)
          </h2>
          <div className="space-y-1.5">
            {sequelLinks.map((link, i) => (
              <SequelRow key={i} link={link} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuideCard({ guide }: { guide: ClusterGuide }) {
  const statusLabel = STATUS_LABELS[guide.status] ?? guide.status;
  const statusColor =
    STATUS_COLORS[guide.status] ??
    "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400";

  return (
    <Link
      href={`/admin/guides/${guide.id}`}
      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
          {guide.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              statusColor,
            )}
          >
            {statusLabel}
          </span>
          {guide.qualityScore != null && (
            <span
              className={cn(
                "text-[10px] font-medium",
                guide.qualityScore >= 80
                  ? "text-green-600"
                  : guide.qualityScore >= 60
                    ? "text-yellow-600"
                    : "text-red-600",
              )}
            >
              {guide.qualityScore}점
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function GenerateButton({
  clusterName,
  clusterId,
  guideType,
  difficulty,
  careerFieldCodes,
  subjectHints,
}: {
  clusterName: string;
  clusterId: string;
  guideType: string;
  difficulty: string;
  careerFieldCodes: string[];
  subjectHints: string[];
}) {
  const params = new URLSearchParams({
    keyword: clusterName,
    gapCluster: clusterId,
    gapClusterName: clusterName,
    difficultyLevel: difficulty,
    guideType: guideType || "topic_exploration",
  });
  if (careerFieldCodes[0]) params.set("careerField", careerFieldCodes[0]);
  if (subjectHints[0]) params.set("subject", subjectHints[0]);

  return (
    <Link
      href={`/admin/guides/generate?${params.toString()}`}
      className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg border border-dashed border-secondary-300 dark:border-secondary-600 text-xs font-medium text-[var(--text-secondary)] hover:text-primary-600 hover:border-primary-300 dark:hover:text-primary-400 dark:hover:border-primary-600 transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      {DIFF_META[difficulty as keyof typeof DIFF_META]?.label ?? difficulty} 가이드 생성
    </Link>
  );
}

function SequelRow({ link }: { link: SequelLink }) {
  const fromDiff = link.fromDifficulty
    ? DIFF_META[link.fromDifficulty as keyof typeof DIFF_META]
    : null;
  const toDiff = link.toDifficulty
    ? DIFF_META[link.toDifficulty as keyof typeof DIFF_META]
    : null;

  return (
    <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-secondary-50 dark:hover:bg-secondary-800/50">
      {fromDiff && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            fromDiff.dot,
          )}
        />
      )}
      <Link
        href={`/admin/guides/${link.fromId}`}
        className="truncate max-w-[160px] text-[var(--text-primary)] hover:text-primary-600 dark:hover:text-primary-400"
      >
        {link.fromTitle}
      </Link>
      <ArrowRight className="w-3 h-3 text-[var(--text-secondary)] shrink-0" />
      {toDiff && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            toDiff.dot,
          )}
        />
      )}
      <Link
        href={`/admin/guides/${link.toId}`}
        className="truncate max-w-[160px] text-[var(--text-primary)] hover:text-primary-600 dark:hover:text-primary-400"
      >
        {link.toTitle}
      </Link>
      <span className="text-[10px] text-[var(--text-secondary)] ml-auto shrink-0">
        {(link.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}
