import { QUESTION_TYPE_LABELS as TYPE_LABELS, DIFFICULTY_BADGE } from "../constants";
import { EmptyState } from "../EmptyState";
import { MessageCircle } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

interface InterviewSectionProps {
  questions: Array<{
    question: string;
    question_type: string;
    difficulty: string;
    suggested_answer: string | null;
  }>;
}

export function InterviewSection({ questions }: InterviewSectionProps) {
  if (questions.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={MessageCircle} title="면접 예상 질문" subtitle="5유형 분류 · 제안 답변" />
        <EmptyState
          title="면접 예상 질문이 아직 생성되지 않았습니다."
          description="면접 질문 생성 기능을 사용하면 5가지 유형의 예상 질문이 표시됩니다."
        />
      </section>
    );
  }

  // 타입별 그룹핑
  const grouped = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = grouped.get(q.question_type) ?? [];
    list.push(q);
    grouped.set(q.question_type, list);
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={MessageCircle} title="면접 예상 질문" subtitle="5유형 분류 · 제안 답변" />
      <p className="mb-3 text-xs text-gray-500">
        생기부 기록 기반 AI 생성 질문 {questions.length}개 (타입별 분류)
      </p>

      <div className="space-y-4">
        {[...grouped.entries()].map(([type, qs]) => (
          <div key={type} className="print-avoid-break">
            <h3 className="mb-1.5 text-sm font-semibold text-gray-800">
              {TYPE_LABELS[type] ?? type}
              <span className="ml-1 text-xs font-normal text-gray-500">({qs.length})</span>
            </h3>

            <div className="space-y-2">
              {qs.map((q, idx) => {
                const diff = DIFFICULTY_BADGE[q.difficulty];
                return (
                  <div key={idx} className="rounded border border-gray-200 px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-xs font-bold text-gray-500">{idx + 1}.</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900">{q.question}</p>
                        {q.suggested_answer && (
                          <div className="mt-1.5 rounded bg-blue-50 px-2 py-1.5">
                            <p className="text-xs font-semibold text-blue-600">답변 가이드</p>
                            <p className="whitespace-pre-line text-xs leading-relaxed text-blue-800">
                              {q.suggested_answer}
                            </p>
                          </div>
                        )}
                      </div>
                      {diff && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${diff.cls}`}>
                          {diff.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
