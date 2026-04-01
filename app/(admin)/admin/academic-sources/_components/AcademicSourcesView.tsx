"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/cn";

// ============================================
// 타입
// ============================================

interface AcademicSource {
  id: string;
  url: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract_snippet: string | null;
  cited_text: string | null;
  source_db: string;
  keywords: string[];
  subject_areas: string[];
  hit_count: number;
  embedding_status: string;
  is_valid: boolean;
  last_validated_at: string;
  created_at: string;
}

interface Stats {
  total: number;
  valid: number;
  embedded: number;
  byDb: [string, number][];
}

interface Props {
  sources: AcademicSource[];
  stats: Stats | null;
  currentFilter: {
    source_db?: string;
    subject?: string;
    q?: string;
    valid?: string;
  };
}

// ============================================
// DB 라벨
// ============================================

const SOURCE_DB_LABELS: Record<string, { label: string; color: string }> = {
  kci: { label: "KCI", color: "bg-blue-100 text-blue-800" },
  dbpia: { label: "DBpia", color: "bg-green-100 text-green-800" },
  riss: { label: "RISS", color: "bg-purple-100 text-purple-800" },
  scholar: { label: "Scholar", color: "bg-yellow-100 text-yellow-800" },
  scienceall: { label: "ScienceAll", color: "bg-orange-100 text-orange-800" },
  koreascience: { label: "KoreaScience", color: "bg-teal-100 text-teal-800" },
  other: { label: "기타", color: "bg-gray-100 text-gray-800" },
};

// ============================================
// 메인 컴포넌트
// ============================================

export function AcademicSourcesView({ sources, stats, currentFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/admin/academic-sources?${params.toString()}`);
    },
    [router, searchParams],
  );

  // 과목 목록 추출
  const allSubjects = Array.from(
    new Set(sources.flatMap((s) => s.subject_areas)),
  ).sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">학술 출처 DB</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          가이드 생성 시 자동 매칭되는 검증된 학술 논문 출처
        </p>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="총 출처" value={stats.total} />
          <StatCard
            label="유효"
            value={stats.valid}
            sub={`${Math.round((stats.valid / Math.max(stats.total, 1)) * 100)}%`}
          />
          <StatCard
            label="임베딩 완료"
            value={stats.embedded}
            sub={`${Math.round((stats.embedded / Math.max(stats.total, 1)) * 100)}%`}
          />
          <StatCard
            label="출처 DB"
            value={stats.byDb.length}
            sub={stats.byDb.map(([db, cnt]) => `${SOURCE_DB_LABELS[db]?.label ?? db}: ${cnt}`).join(", ")}
          />
        </div>
      )}

      {/* 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="제목/키워드 검색..."
          defaultValue={currentFilter.q ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v.length === 0 || v.length >= 2) {
              updateFilter("q", v || undefined);
            }
          }}
          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
        />

        <select
          value={currentFilter.source_db ?? ""}
          onChange={(e) => updateFilter("source_db", e.target.value || undefined)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">전체 DB</option>
          {Object.entries(SOURCE_DB_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={currentFilter.subject ?? ""}
          onChange={(e) => updateFilter("subject", e.target.value || undefined)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">전체 과목</option>
          {allSubjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={currentFilter.valid === "false"}
            onChange={(e) =>
              updateFilter("valid", e.target.checked ? "false" : undefined)
            }
            className="rounded"
          />
          무효 URL만
        </label>
      </div>

      {/* 결과 수 */}
      <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
        {sources.length}건
      </p>

      {/* 테이블 */}
      {sources.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-[var(--color-text-secondary)]">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[var(--color-bg-secondary)]">
                <th className="px-3 py-2.5 text-left font-medium">제목</th>
                <th className="px-3 py-2.5 text-left font-medium">DB</th>
                <th className="px-3 py-2.5 text-left font-medium">과목</th>
                <th className="px-3 py-2.5 text-center font-medium">연도</th>
                <th className="px-3 py-2.5 text-center font-medium">사용</th>
                <th className="px-3 py-2.5 text-center font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// 하위 컴포넌트
// ============================================

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && (
        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
          {sub}
        </p>
      )}
    </div>
  );
}

function SourceRow({ source }: { source: AcademicSource }) {
  const dbInfo = SOURCE_DB_LABELS[source.source_db] ?? SOURCE_DB_LABELS.other;

  return (
    <tr className="border-b last:border-b-0 hover:bg-[var(--color-bg-secondary)]/50">
      {/* 제목 + URL */}
      <td className="max-w-xs px-3 py-2.5">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--color-primary-600)] hover:underline"
        >
          {source.title.length > 60
            ? source.title.slice(0, 60) + "..."
            : source.title}
        </a>
        {source.authors.length > 0 && (
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            {source.authors.join(", ")}
            {source.journal ? ` | ${source.journal}` : ""}
          </p>
        )}
      </td>

      {/* DB 배지 */}
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
            dbInfo.color,
          )}
        >
          {dbInfo.label}
        </span>
      </td>

      {/* 과목 */}
      <td className="max-w-[140px] px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {source.subject_areas.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
            >
              {s}
            </span>
          ))}
          {source.subject_areas.length > 3 && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              +{source.subject_areas.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* 연도 */}
      <td className="px-3 py-2.5 text-center">
        {source.year ?? "-"}
      </td>

      {/* 사용 횟수 */}
      <td className="px-3 py-2.5 text-center">
        <span
          className={cn(
            "font-medium",
            source.hit_count > 0
              ? "text-[var(--color-primary-600)]"
              : "text-[var(--color-text-secondary)]",
          )}
        >
          {source.hit_count}
        </span>
      </td>

      {/* 상태 */}
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          {source.is_valid ? (
            <span className="h-2 w-2 rounded-full bg-green-500" title="유효" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-red-500" title="무효" />
          )}
          {source.embedding_status === "completed" ? (
            <span className="h-2 w-2 rounded-full bg-blue-500" title="임베딩 완료" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-gray-300" title="임베딩 대기" />
          )}
        </div>
      </td>
    </tr>
  );
}
