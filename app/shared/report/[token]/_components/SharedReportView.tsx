"use client";

import type { ReportExportData } from "@/lib/domains/student-record/export/report-export";

interface SharedReportViewProps {
  report: ReportExportData;
}

export function SharedReportView({ report }: SharedReportViewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
            <span>{report.studentName}</span>
            {report.targetGrades.length > 0 && (
              <span>{report.targetGrades.join(", ")}학년</span>
            )}
            <span>{new Date(report.createdAt).toLocaleDateString("ko-KR")}</span>
            {report.mode === "prospective" && (
              <span className="text-blue-600 font-medium">설계 모드</span>
            )}
          </div>
        </div>
      </header>

      {/* 컨텐츠 */}
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* 진단 */}
        {report.diagnosis && (
          <Section title="종합 진단">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-600">
                  {report.diagnosis.overallGrade}
                </span>
                <span className="text-gray-600">{report.diagnosis.recordDirection}</span>
              </div>
              {report.diagnosis.strengths.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-1">강점</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {report.diagnosis.strengths.map((s, i) => (
                      <li key={i}>- {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.diagnosis.weaknesses.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-1">약점</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {report.diagnosis.weaknesses.map((w, i) => (
                      <li key={i}>- {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.diagnosis.recommendedMajors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">추천 계열</h4>
                  <div className="flex flex-wrap gap-2">
                    {report.diagnosis.recommendedMajors.map((m, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 역량 점수 */}
        {report.competencyScores && report.competencyScores.length > 0 && (
          <Section title="역량 분석">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {report.competencyScores.map((c, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{c.grade}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 교과 적합도 */}
        {report.courseAdequacy && (
          <Section title="교과 적합도">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-600">
                  {report.courseAdequacy.score}%
                </span>
                <span className="text-gray-600">{report.courseAdequacy.majorCategory}</span>
              </div>
              {report.courseAdequacy.notTaken.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-1">미이수 과목</h4>
                  <div className="flex flex-wrap gap-1">
                    {report.courseAdequacy.notTaken.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-sm rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 활동 요약 (sections) */}
        {report.sections.length > 0 && (
          <Section title="활동 요약">
            <div className="space-y-4">
              {report.sections.map((sec, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">{sec.title}</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{sec.content}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 보완 전략 */}
        {report.strategies && report.strategies.length > 0 && (
          <Section title="보완 전략">
            <div className="space-y-3">
              {report.strategies.map((s, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                      s.priority === "high" ? "bg-red-50 text-red-700" :
                      s.priority === "medium" ? "bg-amber-50 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {s.priority}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{s.targetArea}</span>
                  </div>
                  <p className="text-sm text-gray-600">{s.content}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 면접 예상 질문 */}
        {report.interviewQuestions && report.interviewQuestions.length > 0 && (
          <Section title="면접 예상 질문">
            <div className="space-y-4">
              {report.interviewQuestions.map((q, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-900">Q{i + 1}. {q.question}</p>
                  {q.suggestedAnswer && (
                    <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{q.suggestedAnswer}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs text-gray-400">{q.questionType}</span>
                    <span className="text-xs text-gray-400">{q.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 로드맵 */}
        {report.roadmapItems && report.roadmapItems.length > 0 && (
          <Section title="학기별 로드맵">
            <div className="space-y-2">
              {report.roadmapItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 text-gray-400">
                    {item.grade}학년{item.semester ? ` ${item.semester}학기` : ""}
                  </span>
                  <span className="text-gray-700">{item.plan_content}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 대학별 전략 */}
        {report.univStrategies && report.univStrategies.length > 0 && (
          <Section title="대학별 전략">
            <div className="space-y-3">
              {report.univStrategies.map((u, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <h4 className="text-sm font-medium text-gray-900">
                    {u.universityName} — {u.admissionType}
                  </h4>
                  {u.keyTips && u.keyTips.length > 0 && (
                    <ul className="mt-1 text-sm text-gray-600 space-y-0.5">
                      {u.keyTips.map((tip, j) => (
                        <li key={j}>- {tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 푸터 */}
        <footer className="pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
          TimeLevelUp — 이 리포트는 공유 링크를 통해 열람 중입니다.
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </section>
  );
}
