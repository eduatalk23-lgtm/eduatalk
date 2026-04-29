"use client";

import { GitBranch, Pin } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { StorylineTabData, RecordTabData } from "@/lib/domains/student-record/types";
import { STRENGTH_BADGE } from "../constants";
import { ReportMarkdown } from "../ReportMarkdown";
import { CHART_HEX, TYPO, PROGRESS } from "@/lib/design-tokens/report";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";

// 6색 팔레트: indigo 계열 + semantic (CHART_HEX 사용)
const RECORD_TYPE_COLORS: Record<string, string> = {
  세특: CHART_HEX[0],      // indigo
  개인세특: CHART_HEX[1],   // purple
  창체: CHART_HEX[4],      // emerald
  독서: CHART_HEX[3],      // amber
  행특: "#6b7280",          // gray-500 (중립)
};
const GRADE_COLORS = [CHART_HEX[0], CHART_HEX[1], "#a5b4fc"]; // indigo 600→400→300

const AREA_LABELS: Record<string, string> = {
  autonomy: "자율·자치",
  club: "동아리",
  career: "진로",
  setek: "세특",
  personal_setek: "개인세특",
  reading: "독서",
  course_selection: "교과선택",
};

interface EvidenceRecord {
  type: string;
  grade: number;
  name: string;
  content: string;
  matchedKeywords: string[];
}

/** 스토리라인 키워드가 포함된 기록 추출 (최대 5건) */
function extractEvidenceRecords(
  keywords: string[],
  recordDataByGrade: Record<number, RecordTabData>,
  studentGrade: number,
): EvidenceRecord[] {
  if (keywords.length === 0 || Object.keys(recordDataByGrade).length === 0) return [];

  const results: EvidenceRecord[] = [];

  // B13: 3년 통합 — 학년별 evidence 수집에서 studentGrade 상한 제거.
  for (let g = 1; g <= 3; g++) {
    const gradeData = recordDataByGrade[g];
    if (!gradeData) continue;

    // 세특
    for (const s of gradeData.seteks ?? []) {
      const text = s.content || s.imported_content || "";
      if (!text) continue;
      const matched = keywords.filter((kw) => matchKeywordInText(kw, text));
      if (matched.length > 0) {
        results.push({
          type: "세특",
          grade: g,
          name: s.subject?.name || "과목",
          content: text,
          matchedKeywords: matched,
        });
      }
    }

    // 개인세특
    for (const s of gradeData.personalSeteks ?? []) {
      const text = s.content || s.imported_content || "";
      if (!text) continue;
      const matched = keywords.filter((kw) => matchKeywordInText(kw, text));
      if (matched.length > 0) {
        results.push({
          type: "개인세특",
          grade: g,
          name: s.subject?.name || "과목",
          content: text,
          matchedKeywords: matched,
        });
      }
    }

    // 창체
    for (const c of gradeData.changche ?? []) {
      const text = c.content || c.imported_content || "";
      if (!text) continue;
      const matched = keywords.filter((kw) => matchKeywordInText(kw, text));
      if (matched.length > 0) {
        results.push({
          type: "창체",
          grade: g,
          name: c.activity_type,
          content: text,
          matchedKeywords: matched,
        });
      }
    }

    // 행특
    if (gradeData.haengteuk) {
      const text = gradeData.haengteuk.content || gradeData.haengteuk.imported_content || "";
      if (text) {
        const matched = keywords.filter((kw) => matchKeywordInText(kw, text));
        if (matched.length > 0) {
          results.push({
            type: "행특",
            grade: g,
            name: "행동특성",
            content: text,
            matchedKeywords: matched,
          });
        }
      }
    }
  }

  // 매칭 키워드 수 내림차순 정렬 후 상위 5건
  return results
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length)
    .slice(0, 5);
}

/** content 앞 80자 추출 스니펫 */
function buildSnippet(content: string): string {
  const snippet = content.slice(0, 80).trim();
  const suffix = content.length > 80 ? "..." : "";
  return snippet + suffix;
}

interface StorylineSectionProps {
  storylineData: StorylineTabData;
  studentGrade: number;
  recordDataByGrade?: Record<number, RecordTabData>;
}

export function StorylineSection({
  storylineData,
  studentGrade,
  recordDataByGrade,
}: StorylineSectionProps) {
  const { storylines, roadmapItems } = storylineData;

  // P1-3: 활동 분포 데이터
  const { typeDistribution, gradeDistribution } = useMemo(() => {
    if (!recordDataByGrade) return { typeDistribution: [], gradeDistribution: [] };

    const typeCounts: Record<string, number> = { 세특: 0, 개인세특: 0, 창체: 0, 독서: 0, 행특: 0 };
    const gradeCounts: Array<{ name: string; count: number }> = [];

    // B13: 3년 학년별 분포 — studentGrade 상한 제거, 빈 학년도 0으로 표시.
    for (let g = 1; g <= 3; g++) {
      const data = recordDataByGrade[g];
      if (!data) { gradeCounts.push({ name: `${g}학년`, count: 0 }); continue; }
      const setekCount = (data.seteks ?? []).filter((s) => s.content).length;
      const personalCount = (data.personalSeteks ?? []).filter((s) => s.content).length;
      const changcheCount = (data.changche ?? []).filter((c) => c.content).length;
      const readingCount = (data.readings ?? []).length;
      const haengteukCount = data.haengteuk?.content ? 1 : 0;

      typeCounts["세특"] += setekCount;
      typeCounts["개인세특"] += personalCount;
      typeCounts["창체"] += changcheCount;
      typeCounts["독서"] += readingCount;
      typeCounts["행특"] += haengteukCount;

      gradeCounts.push({
        name: `${g}학년`,
        count: setekCount + personalCount + changcheCount + readingCount + haengteukCount,
      });
    }

    return {
      typeDistribution: Object.entries(typeCounts)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value, color: RECORD_TYPE_COLORS[name] ?? "#6b7280" })),
      gradeDistribution: gradeCounts,
    };
  }, [recordDataByGrade, studentGrade]);

  if (storylines.length === 0 && roadmapItems.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={GitBranch} title="스토리라인" subtitle="3년 성장 서사 · 활동 분포 · 로드맵" />
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>스토리라인이 아직 등록되지 않았습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>3년간 성장 서사를 구성하면 테마별 연결과 로드맵이 표시됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={GitBranch} title="스토리라인" subtitle="3년 성장 서사 · 활동 분포 · 로드맵" />

      {/* P1-3: 활동 분포 시각화 */}
      {typeDistribution.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 print-avoid-break md:grid-cols-2">
          {/* 유형별 도넛 */}
          <div>
            <h3 className={cn("mb-1 text-center font-semibold", TYPO.caption)}>활동 유형 분포</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%" cy="50%"
                  innerRadius={35} outerRadius={65}
                  dataKey="value"
                  label={({ name, value }: { name?: string; value: number }) => `${name ?? ""} ${value}`}
                  labelLine={false}
                >
                  {typeDistribution.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v}건`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-2">
              {typeDistribution.map((d) => (
                <span key={d.name} className={cn("flex items-center gap-1", TYPO.caption)}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </div>

          {/* 학년별 활동 건수 바 차트 */}
          <div>
            <h3 className={cn("mb-1 text-center font-semibold", TYPO.caption)}>학년별 활동 건수</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={gradeDistribution} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v}건`, ""]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {gradeDistribution.map((_, i) => (
                    <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 스토리라인 카드 */}
      <div className="space-y-5 pt-4">
        {storylines.map((sl) => {
          const badge = STRENGTH_BADGE[sl.strength ?? "moderate"];
          const linkedItems = roadmapItems.filter(
            (r) => r.storyline_id === sl.id,
          );
          const evidenceRecords = recordDataByGrade
            ? extractEvidenceRecords(sl.keywords, recordDataByGrade, studentGrade)
            : [];

          return (
            <div
              key={sl.id}
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4 shadow-sm print-avoid-break"
            >
              {/* 제목 + 배지 */}
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {sl.title}
                </h3>
                {badge && (
                  <span
                    className={cn("rounded px-1.5 py-0.5", TYPO.label, badge.color)}
                  >
                    {badge.label}
                  </span>
                )}
                {sl.career_field && (
                  <span className={TYPO.caption}>
                    {sl.career_field}
                  </span>
                )}
              </div>

              {/* 키워드 */}
              {sl.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {sl.keywords.map((kw: string, i: number) => (
                    <span
                      key={i}
                      className={cn("rounded px-2 py-0.5", TYPO.caption, "bg-[var(--surface-secondary)]")}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* 학년별 테마 타임라인 */}
              {(sl.grade_1_theme || sl.grade_2_theme || sl.grade_3_theme) && (
                <div className="flex gap-2 pt-3">
                  {[
                    { grade: 1, theme: sl.grade_1_theme },
                    { grade: 2, theme: sl.grade_2_theme },
                    { grade: 3, theme: sl.grade_3_theme },
                  ]
                    // B13: 3년 전체 표시. studentGrade 는 톤/currentness 판정에만 사용.
                    .map((t) => (
                      <div
                        key={t.grade}
                        className="flex-1 rounded bg-[var(--surface-secondary)] p-2"
                      >
                        <p className={TYPO.caption}>
                          {t.grade}학년
                        </p>
                        <p className={TYPO.body}>
                          {t.theme || "-"}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {/* 서술 */}
              {sl.narrative && (
                <ReportMarkdown className="pt-3">{sl.narrative}</ReportMarkdown>
              )}

              {/* 근거 기록 */}
              <div className="pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Pin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <p className={cn("font-medium", TYPO.caption)}>
                    근거 기록
                    {evidenceRecords.length > 0 && (
                      <span className="ml-1 text-[var(--text-tertiary)]">
                        ({evidenceRecords.length}건)
                      </span>
                    )}
                  </p>
                </div>
                {evidenceRecords.length > 0 ? (
                  <ul className="space-y-1.5">
                    {evidenceRecords.map((rec, idx) => (
                      <li
                        key={idx}
                        className="rounded-md bg-[var(--surface-secondary)] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className={cn(
                            "rounded px-1.5 py-0.5 font-medium",
                            TYPO.label,
                            rec.type === "세특" || rec.type === "개인세특"
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : rec.type === "창체"
                                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                : "bg-bg-tertiary text-text-primary dark:bg-bg-secondary dark:text-text-disabled",
                          )}>
                            {rec.grade}학년 {rec.type}
                          </span>
                          <span className={TYPO.caption}>{rec.name}</span>
                          <div className="flex flex-wrap gap-1 ml-auto">
                            {rec.matchedKeywords.map((kw, ki) => (
                              <span
                                key={ki}
                                className="rounded bg-amber-100 px-1.5 py-0.5 text-2xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className={cn(TYPO.caption, "leading-relaxed text-[var(--text-secondary)]")}>
                          {buildSnippet(rec.content)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn(TYPO.caption, "text-[var(--text-placeholder)]")}>
                    관련 기록이 아직 없습니다
                  </p>
                )}
              </div>

              {/* 연결된 로드맵 아이템 */}
              {linkedItems.length > 0 && (
                <div className="pt-3">
                  {/* P3-5: 로드맵 진행률 프로그레스 바 */}
                  {(() => {
                    const executed = linkedItems.filter((i) => i.execution_content).length;
                    const pct = Math.round((executed / linkedItems.length) * 100);
                    return (
                      <div className="mb-2 flex items-center gap-2">
                        <p className={cn("font-medium", TYPO.caption)}>
                          로드맵 ({executed}/{linkedItems.length})
                        </p>
                        <div className={PROGRESS.track}>
                          <div
                            className={cn(PROGRESS.bar, "bg-indigo-500 dark:bg-indigo-400")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{pct}%</span>
                      </div>
                    );
                  })()}
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-secondary)]">
                        <th className="px-2 py-1 text-left text-[var(--text-secondary)]">
                          학년
                        </th>
                        <th className="px-2 py-1 text-left text-[var(--text-secondary)]">
                          영역
                        </th>
                        <th className="px-2 py-1 text-left text-[var(--text-secondary)]">
                          계획
                        </th>
                        <th className="px-2 py-1 text-left text-[var(--text-secondary)]">
                          실행
                        </th>
                        <th className="px-2 py-1 text-center text-[var(--text-secondary)]">
                          일치
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedItems
                        .sort((a, b) => a.grade - b.grade)
                        .map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[var(--border-primary)]"
                          >
                            <td className="px-2 py-1 text-[var(--text-primary)]">{item.grade}</td>
                            <td className="px-2 py-1 text-[var(--text-primary)]">
                              {AREA_LABELS[item.area] ?? item.area}
                            </td>
                            <td className="px-2 py-1 text-[var(--text-primary)]">{item.plan_content}</td>
                            <td className="px-2 py-1 text-[var(--text-primary)]">
                              {item.execution_content ?? "-"}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {item.match_rate != null ? (
                                <div className="flex items-center gap-1">
                                  <div className={PROGRESS.track}>
                                    <div
                                      className={cn(PROGRESS.bar, PROGRESS.barColor(item.match_rate))}
                                      style={{ width: `${item.match_rate}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[var(--text-primary)]">{item.match_rate}%</span>
                                </div>
                              ) : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
