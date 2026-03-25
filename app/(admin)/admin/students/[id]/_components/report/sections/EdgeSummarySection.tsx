"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import type { PersistedEdge } from "@/lib/domains/student-record/edge-repository";
import { EDGE_TYPE_META, type CrossRefEdgeType } from "@/lib/domains/student-record/cross-reference";
import { EmptyState } from "../EmptyState";
import { Link2 } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

// 6색 팔레트 규율: indigo 계열 변형 + semantic (emerald/amber/red)
const EDGE_BAR_COLORS: Record<CrossRefEdgeType, string> = {
  COMPETENCY_SHARED: "#4f46e5",     // indigo-600 (brand)
  CONTENT_REFERENCE: "#6366f1",     // indigo-500
  TEMPORAL_GROWTH: "#059669",       // emerald-600 (positive/growth)
  COURSE_SUPPORTS: "#818cf8",       // indigo-400
  READING_ENRICHES: "#a5b4fc",      // indigo-300
  THEME_CONVERGENCE: "#f59e0b",     // amber-500 (caution)
  TEACHER_VALIDATION: "#dc2626",    // red-600 (validation)
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
          <p className="text-2xl font-bold text-indigo-600">{edges.length}</p>
          <p className="text-xs text-gray-500">총 연결</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600">{sortedTypes.length}</p>
          <p className="text-xs text-gray-500">연결 유형</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600">
            {new Set(edges.map((e) => e.source_record_id)).size}
          </p>
          <p className="text-xs text-gray-500">관련 영역</p>
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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            <th className="px-3 py-2 text-left font-medium text-gray-700">연결 유형</th>
            <th className="w-16 px-2 py-2 text-center font-medium text-gray-700">건수</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">대표 연결</th>
          </tr>
        </thead>
        <tbody>
          {sortedTypes.map(([type, typeEdges]) => {
            const meta = EDGE_TYPE_META[type];
            // 상위 2개 대표 예시
            const examples = typeEdges.slice(0, 2);

            return (
              <tr key={type} className="border-b border-gray-200 print-avoid-break">
                <td className="px-3 py-2">
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${meta.bgColor} ${meta.color}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-2 py-2 text-center font-semibold">{typeEdges.length}</td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    {examples.map((ex) => (
                      <div key={ex.id} className={`text-xs ${ex.confidence >= 0.7 ? "text-gray-700" : "text-gray-500"}`}>
                        <span className="font-medium text-gray-800">{ex.source_label}</span>
                        <span className="mx-1 text-gray-500">→</span>
                        <span className="font-medium text-gray-800">{ex.target_label}</span>
                        {ex.confidence > 0 && (
                          <span className={`ml-1 rounded px-1 py-0.5 text-xs font-medium ${
                            ex.confidence >= 0.8 ? "bg-emerald-50 text-emerald-700" :
                            ex.confidence >= 0.5 ? "bg-amber-50 text-amber-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {Math.round(ex.confidence * 100)}%
                          </span>
                        )}
                        {ex.reason && (
                          <span className="ml-1 text-gray-500">({ex.reason.slice(0, 60)}{ex.reason.length > 60 ? "…" : ""})</span>
                        )}
                      </div>
                    ))}
                    {typeEdges.length > 2 && (
                      <p className="text-xs text-gray-500">외 {typeEdges.length - 2}건</p>
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
