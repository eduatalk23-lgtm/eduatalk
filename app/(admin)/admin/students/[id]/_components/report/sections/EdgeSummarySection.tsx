"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import type { PersistedEdge } from "@/lib/domains/student-record/edge-repository";
import { EDGE_TYPE_META, type CrossRefEdgeType } from "@/lib/domains/student-record/cross-reference";
import { EmptyState } from "../EmptyState";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { BADGE, TABLE, TYPO, CHART_HEX } from "@/lib/design-tokens/report";

// 엣지 유형별 색상: CHART_HEX 팔레트 사용
const EDGE_BAR_COLORS: Record<CrossRefEdgeType, string> = {
  COMPETENCY_SHARED: CHART_HEX[0],     // indigo
  CONTENT_REFERENCE: CHART_HEX[5],     // blue
  TEMPORAL_GROWTH: CHART_HEX[4],       // emerald
  COURSE_SUPPORTS: CHART_HEX[1],       // purple
  READING_ENRICHES: CHART_HEX[2],      // pink
  THEME_CONVERGENCE: CHART_HEX[3],     // amber
  TEACHER_VALIDATION: CHART_HEX[6],    // red
};

interface EdgeSummarySectionProps {
  edges: PersistedEdge[];
}

export function EdgeSummarySection({ edges }: EdgeSummarySectionProps) {
  if (edges.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Link2} title="활동 연결 분석" />
        <EmptyState
          title="활동 간 연결이 아직 감지되지 않았습니다."
          description="AI 초기 분석 파이프라인을 실행하면 교과/창체/독서 간 연결이 자동 분석됩니다."
        />
      </section>
    );
  }

  // 엣지 타입별 그룹핑
  const grouped = new Map<CrossRefEdgeType, PersistedEdge[]>();
  for (const edge of edges) {
    const list = grouped.get(edge.edge_type) ?? [];
    list.push(edge);
    grouped.set(edge.edge_type, list);
  }

  // 타입별 정렬 (건수 내림차순)
  const sortedTypes = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Link2} title="활동 연결 분석" subtitle="7종 크로스레퍼런스" />

      {/* 요약 통계 */}
      <div className="mb-4 flex items-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{edges.length}</p>
          <p className={TYPO.caption}>총 연결</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{sortedTypes.length}</p>
          <p className={TYPO.caption}>연결 유형</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {new Set(edges.map((e) => e.source_record_id)).size}
          </p>
          <p className={TYPO.caption}>관련 영역</p>
        </div>
      </div>

      {/* P1-2: 엣지 밀도 수평 바 차트 */}
      {sortedTypes.length > 0 && (
        <div className="mb-4 print-avoid-break">
          <ResponsiveContainer width="100%" height={Math.max(120, sortedTypes.length * 32 + 40)}>
            <BarChart
              data={sortedTypes.map(([type, typeEdges]) => ({
                name: EDGE_TYPE_META[type].label,
                count: typeEdges.length,
                type,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65} />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(value: number) => [`${value}건`, "연결 수"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {sortedTypes.map(([type]) => (
                  <Cell key={type} fill={EDGE_BAR_COLORS[type] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 타입별 상세 테이블 */}
      <table className={TABLE.wrapper}>
        <thead className={TABLE.thead}>
          <tr>
            <th className={TABLE.th}>연결 유형</th>
            <th className={cn(TABLE.th, "w-16 text-center")}>건수</th>
            <th className={TABLE.th}>대표 연결</th>
          </tr>
        </thead>
        <tbody>
          {sortedTypes.map(([type, typeEdges]) => {
            const meta = EDGE_TYPE_META[type];
            // 상위 2개 대표 예시
            const examples = typeEdges.slice(0, 2);

            return (
              <tr key={type} className={cn(TABLE.trHover, "print-avoid-break")}>
                <td className={TABLE.td}>
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${meta.bgColor} ${meta.color}`}>
                    {meta.label}
                  </span>
                </td>
                <td className={cn(TABLE.td, "text-center font-semibold")}>{typeEdges.length}</td>
                <td className={TABLE.td}>
                  <div className="space-y-1">
                    {examples.map((ex) => (
                      <div key={ex.id} className={cn("text-xs", ex.confidence >= 0.7 ? TYPO.body : TYPO.caption)}>
                        <span className="font-medium text-[var(--text-primary)]">{ex.source_label}</span>
                        <span className="mx-1 text-[var(--text-tertiary)]">→</span>
                        <span className="font-medium text-[var(--text-primary)]">{ex.target_label}</span>
                        {ex.confidence > 0 && (
                          <span className={cn(
                            "ml-1 rounded px-1 py-0.5",
                            TYPO.label,
                            ex.confidence >= 0.8 ? BADGE.emerald :
                            ex.confidence >= 0.5 ? BADGE.amber :
                            BADGE.gray,
                          )}>
                            {Math.round(ex.confidence * 100)}%
                          </span>
                        )}
                        {ex.reason && (
                          <span className={cn("ml-1", TYPO.caption)}>({ex.reason.slice(0, 60)}{ex.reason.length > 60 ? "…" : ""})</span>
                        )}
                      </div>
                    ))}
                    {typeEdges.length > 2 && (
                      <p className={TYPO.caption}>외 {typeEdges.length - 2}건</p>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
