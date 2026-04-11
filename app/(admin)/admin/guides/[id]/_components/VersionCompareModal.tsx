"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Equal,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { compareVersionsAction } from "@/lib/domains/guide/actions/crud";
import { analyzeVersionDiffAction } from "@/lib/domains/guide/llm/actions/analyzeVersionDiff";
import type { VersionAnalysisOutput } from "@/lib/domains/guide/llm/types";
import type { GuideVersionItem } from "@/lib/domains/guide/types";
import {
  GUIDE_STATUS_LABELS,
  GUIDE_TYPE_LABELS,
  GUIDE_SOURCE_TYPE_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/domains/guide/types";
import type {
  VersionDiff,
  SectionDiff,
  DiffHunk,
  MetaDiff,
} from "@/lib/domains/guide/utils/versionDiff";

// ============================================================
// 타입
// ============================================================

interface VersionCompareModalProps {
  open: boolean;
  onClose: () => void;
  /** 현재 보고 있는 가이드 ID */
  currentGuideId: string;
  /** 기본 비교 대상 가이드 ID */
  defaultCompareId?: string;
  /** 버전 히스토리 목록 */
  versions: GuideVersionItem[];
}

// ============================================================
// 메타 변경 라벨 매핑
// ============================================================

const META_FIELD_LABELS: Record<keyof MetaDiff, string> = {
  title: "제목",
  status: "상태",
  guideType: "가이드 유형",
  sourceType: "소스 유형",
  difficultyLevel: "난이도",
  qualityScore: "품질 점수",
  subjectArea: "교과",
  subjectSelect: "과목",
  bookTitle: "도서명",
};

function formatMetaValue(key: keyof MetaDiff, value: unknown): string {
  if (value == null) return "(없음)";
  switch (key) {
    case "status":
      return GUIDE_STATUS_LABELS[value as keyof typeof GUIDE_STATUS_LABELS] ?? String(value);
    case "guideType":
      return GUIDE_TYPE_LABELS[value as keyof typeof GUIDE_TYPE_LABELS] ?? String(value);
    case "sourceType":
      return GUIDE_SOURCE_TYPE_LABELS[value as keyof typeof GUIDE_SOURCE_TYPE_LABELS] ?? String(value);
    case "difficultyLevel":
      return value ? (DIFFICULTY_LABELS[value as keyof typeof DIFFICULTY_LABELS] ?? String(value)) : "(없음)";
    case "qualityScore":
      return `${value}점`;
    default:
      return String(value);
  }
}

// ============================================================
// 서브 컴포넌트
// ============================================================

function DiffHunkView({ hunks }: { hunks: DiffHunk[] }) {
  return (
    <div className="text-sm leading-relaxed space-y-0.5">
      {hunks.map((hunk, i) => (
        <span
          key={i}
          className={cn(
            "inline",
            hunk.type === "add" &&
              "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
            hunk.type === "remove" &&
              "bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300",
          )}
        >
          {hunk.text}{" "}
        </span>
      ))}
    </div>
  );
}

function SectionDiffItem({ section }: { section: SectionDiff }) {
  const [expanded, setExpanded] = useState(section.type === "modified");

  const icon = {
    added: <Plus className="w-3.5 h-3.5 text-green-500" />,
    removed: <Minus className="w-3.5 h-3.5 text-red-500" />,
    modified: <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" />,
    unchanged: <Equal className="w-3.5 h-3.5 text-secondary-400" />,
  }[section.type];

  const bgClass = {
    added: "bg-green-50 dark:bg-green-900/10",
    removed: "bg-red-50 dark:bg-red-900/10",
    modified: "bg-amber-50 dark:bg-amber-900/10",
    unchanged: "",
  }[section.type];

  const charLabel =
    section.charDelta > 0
      ? `+${section.charDelta}자`
      : section.charDelta < 0
        ? `${section.charDelta}자`
        : "";

  return (
    <div className={cn("rounded-md border border-secondary-200 dark:border-secondary-700", bgClass)}>
      <button
        type="button"
        onClick={() => section.hunks && setExpanded((p) => !p)}
        disabled={!section.hunks}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-secondary-50 dark:hover:bg-secondary-800/50 transition-colors disabled:cursor-default"
      >
        {section.hunks ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-secondary-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-secondary-400" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        {icon}
        <span className="font-medium text-[var(--text-heading)]">
          {section.label}
        </span>
        <span className="ml-auto text-xs text-[var(--text-secondary)]">
          {section.type === "added" && "추가"}
          {section.type === "removed" && "삭제"}
          {section.type === "modified" && "수정"}
          {section.type === "unchanged" && "변경 없음"}
          {charLabel && ` (${charLabel})`}
        </span>
      </button>
      {expanded && section.hunks && (
        <div className="border-t border-secondary-200 dark:border-secondary-700 px-3 py-2">
          <DiffHunkView hunks={section.hunks} />
        </div>
      )}
    </div>
  );
}

function MetaChanges({ meta }: { meta: MetaDiff }) {
  const changes = (Object.entries(meta) as [keyof MetaDiff, unknown][]).filter(
    ([, v]) => v != null,
  );

  if (changes.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
        메타 변경 ({changes.length}건)
      </h4>
      <div className="space-y-1">
        {changes.map(([key, change]) => {
          const c = change as { old: unknown; new: unknown };
          return (
            <div
              key={key}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded bg-secondary-50 dark:bg-secondary-800/50"
            >
              <span className="font-medium text-[var(--text-heading)] min-w-[80px]">
                {META_FIELD_LABELS[key]}
              </span>
              <span className="text-red-500 line-through">
                {formatMetaValue(key, c.old)}
              </span>
              <span className="text-secondary-400">→</span>
              <span className="text-green-600 dark:text-green-400">
                {formatMetaValue(key, c.new)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsSummary({ diff }: { diff: VersionDiff }) {
  const { stats, timeDeltaMs } = diff;

  const timeLabelParts: string[] = [];
  const totalMinutes = Math.floor(timeDeltaMs / 60000);
  if (totalMinutes >= 1440) {
    timeLabelParts.push(`${Math.floor(totalMinutes / 1440)}일`);
  } else if (totalMinutes >= 60) {
    timeLabelParts.push(`${Math.floor(totalMinutes / 60)}시간`);
  }
  if (totalMinutes % 60 > 0 && totalMinutes < 1440) {
    timeLabelParts.push(`${totalMinutes % 60}분`);
  }
  const timeLabel = timeLabelParts.join(" ") || "즉시";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        {
          label: "추가",
          value: stats.addedSections,
          color: "text-green-600 dark:text-green-400",
          icon: <Plus className="w-3.5 h-3.5" />,
        },
        {
          label: "삭제",
          value: stats.removedSections,
          color: "text-red-500",
          icon: <Minus className="w-3.5 h-3.5" />,
        },
        {
          label: "수정",
          value: stats.modifiedSections,
          color: "text-amber-500",
          icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
        },
        {
          label: "글자수",
          value: stats.totalCharDelta,
          color:
            stats.totalCharDelta >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-500",
          icon:
            stats.totalCharDelta >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            ),
          format: (v: number) => (v >= 0 ? `+${v}` : `${v}`),
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900"
        >
          <span className={stat.color}>{stat.icon}</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {stat.label}
          </span>
          <span className={cn("text-sm font-semibold ml-auto", stat.color)}>
            {stat.format ? stat.format(stat.value) : stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// AI 분석 섹션 (Layer 2)
// ============================================================

const VERDICT_CONFIG = {
  improved: { label: "개선됨", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  regressed: { label: "퇴보", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  lateral: { label: "방향 변경", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: ArrowLeftRight },
} as const;

function AIAnalysisSection({
  analysis,
  loading,
  error,
  onAnalyze,
}: {
  currentGuideId: string;
  compareId: string;
  analysis: VersionAnalysisOutput | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
}) {
  if (!analysis && !loading && !error) {
    return (
      <div className="pt-2 border-t border-dashed border-secondary-200 dark:border-secondary-700">
        <button
          type="button"
          onClick={onAnalyze}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          AI 맥락 분석
          <span className="ml-auto text-xs text-[var(--text-secondary)]">
            Gemini Flash
          </span>
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-2 border-t border-dashed border-secondary-200 dark:border-secondary-700">
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-[var(--text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          AI가 변경사항을 분석하고 있습니다...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-2 border-t border-dashed border-secondary-200 dark:border-secondary-700">
        <div className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="text-red-500">{error}</span>
          <button
            type="button"
            onClick={onAnalyze}
            className="text-xs text-primary-500 hover:underline"
          >
            재시도
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const verdictCfg = VERDICT_CONFIG[analysis.overallVerdict];
  const VerdictIcon = verdictCfg.icon;

  return (
    <div className="pt-2 border-t border-dashed border-secondary-200 dark:border-secondary-700 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary-500" />
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          AI 맥락 분석
        </h4>
        <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ml-auto", verdictCfg.color)}>
          <VerdictIcon className="w-3 h-3" />
          {verdictCfg.label}
        </span>
      </div>

      {/* 변경 맥락 */}
      <p className="text-sm text-[var(--text-primary)] leading-relaxed bg-secondary-50 dark:bg-secondary-800/50 rounded-lg px-3 py-2">
        {analysis.changeNarrative}
      </p>

      {/* 개선 영역 */}
      {analysis.improvementAreas.length > 0 && (
        <div className="space-y-1">
          <h5 className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle className="w-3 h-3" />
            개선된 영역
          </h5>
          <ul className="space-y-0.5 pl-4">
            {analysis.improvementAreas.map((area, i) => (
              <li key={i} className="text-sm text-[var(--text-primary)] list-disc">
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 퇴보 위험 */}
      {analysis.regressionRisks.length > 0 && (
        <div className="space-y-1">
          <h5 className="flex items-center gap-1 text-xs font-medium text-red-500">
            <AlertTriangle className="w-3 h-3" />
            주의 필요
          </h5>
          <ul className="space-y-0.5 pl-4">
            {analysis.regressionRisks.map((risk, i) => (
              <li key={i} className="text-sm text-[var(--text-primary)] list-disc">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 다음 편집 제안 */}
      {analysis.suggestedNextEdits.length > 0 && (
        <div className="space-y-1">
          <h5 className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <Lightbulb className="w-3 h-3" />
            다음 편집 권장
          </h5>
          <ul className="space-y-0.5 pl-4">
            {analysis.suggestedNextEdits.map((edit, i) => (
              <li key={i} className="text-sm text-[var(--text-primary)] list-disc">
                {edit}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 메인 컴포넌트
// ============================================================

export function VersionCompareModal({
  open,
  onClose,
  currentGuideId,
  defaultCompareId,
  versions,
}: VersionCompareModalProps) {
  const [compareId, setCompareId] = useState<string>(
    defaultCompareId ?? "",
  );

  // AI 분석 상태
  const [aiAnalysis, setAiAnalysis] = useState<VersionAnalysisOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // 비교 대상이 설정되지 않았으면 직전 버전 자동 선택
  const effectiveCompareId = useMemo(() => {
    if (compareId) return compareId;
    // versions는 내림차순, currentGuideId의 직전 버전 찾기
    const currentIdx = versions.findIndex((v) => v.id === currentGuideId);
    if (currentIdx >= 0 && currentIdx < versions.length - 1) {
      return versions[currentIdx + 1].id;
    }
    return "";
  }, [compareId, currentGuideId, versions]);

  const { data: diffResult, isLoading } = useQuery({
    queryKey: ["guide-version-compare", currentGuideId, effectiveCompareId],
    queryFn: () => compareVersionsAction(currentGuideId, effectiveCompareId),
    enabled: open && !!effectiveCompareId && effectiveCompareId !== currentGuideId,
  });

  const diff = diffResult?.success && diffResult.data ? diffResult.data : null;

  // 현재 버전과 비교 대상의 버전 정보
  const currentVersion = versions.find((v) => v.id === currentGuideId);
  const compareVersion = versions.find((v) => v.id === effectiveCompareId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 다이얼로그 */}
      <div className="relative w-full max-w-2xl max-h-[85vh] mx-4 rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-700">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary-500" />
            <h3 className="text-base font-semibold text-[var(--text-heading)]">
              버전 비교
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          >
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* 버전 선택 */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50/50 dark:bg-secondary-800/30">
          <div className="flex-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              이전 버전
            </label>
            <select
              value={effectiveCompareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">선택...</option>
              {versions
                .filter((v) => v.id !== currentGuideId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                    {v.version_message ? ` — ${v.version_message}` : ""}
                    {v.is_latest ? " (최신)" : ""}
                  </option>
                ))}
            </select>
          </div>

          <ArrowLeftRight className="w-4 h-4 text-secondary-400 mt-3" />

          <div className="flex-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              현재 버전
            </label>
            <div className="mt-0.5 px-2.5 py-1.5 rounded-md border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800 text-sm text-[var(--text-primary)]">
              v{currentVersion?.version ?? "?"}
              {currentVersion?.version_message
                ? ` — ${currentVersion.version_message}`
                : ""}
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!effectiveCompareId && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              비교할 이전 버전을 선택하세요.
            </p>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              비교 분석 중...
            </div>
          )}

          {diffResult && !diffResult.success && (
            <p className="text-sm text-red-500 text-center py-4">
              {diffResult.error}
            </p>
          )}

          {diff && (
            <>
              {/* 요약 통계 */}
              <StatsSummary diff={diff} />

              {/* 메타 변경 */}
              <MetaChanges meta={diff.meta} />

              {/* 섹션별 변경 */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  섹션별 변경 (
                  {diff.sections.filter((s) => s.type !== "unchanged").length}건
                  변경 / {diff.sections.length}개 섹션)
                </h4>
                <div className="space-y-1">
                  {diff.sections.map((section) => (
                    <SectionDiffItem key={section.key} section={section} />
                  ))}
                </div>
              </div>

              {/* AI 맥락 분석 */}
              <AIAnalysisSection
                currentGuideId={currentGuideId}
                compareId={effectiveCompareId}
                analysis={aiAnalysis}
                loading={aiLoading}
                error={aiError}
                onAnalyze={async () => {
                  setAiLoading(true);
                  setAiError(null);
                  try {
                    const result = await analyzeVersionDiffAction(currentGuideId, effectiveCompareId);
                    if (result.success && result.data) {
                      setAiAnalysis(result.data);
                    } else {
                      setAiError(result.message ?? "AI 분석에 실패했습니다.");
                    }
                  } catch {
                    setAiError("AI 분석 중 오류가 발생했습니다.");
                  } finally {
                    setAiLoading(false);
                  }
                }}
              />
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-secondary-200 dark:border-secondary-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-sm text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
