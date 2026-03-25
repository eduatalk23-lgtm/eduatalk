import { useMemo } from "react";
import {
  computeWarnings,
  type WarningCheckInput,
} from "@/lib/domains/student-record/warnings/engine";
import type { RecordWarning } from "@/lib/domains/student-record/warnings/types";
import type {
  RecordTabData,
  StorylineTabData,
  DiagnosisTabData,
  StrategyTabData,
} from "@/lib/domains/student-record/types";
import { AlertTriangle } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

const SEVERITY_STYLES: Record<string, { label: string; color: string }> = {
  critical: { label: "긴급", color: "text-red-700 bg-red-50" },
  high: { label: "높음", color: "text-amber-700 bg-amber-50" },
  medium: { label: "보통", color: "text-amber-700 bg-amber-50" },
  low: { label: "낮음", color: "text-gray-600 bg-gray-50" },
};

const CATEGORY_LABELS: Record<string, string> = {
  record: "기록",
  course: "이수",
  storyline: "스토리라인",
  min_score: "수능최저",
  strategy: "전략",
};

interface WarningSectionProps {
  recordDataByGrade: Record<number, RecordTabData>;
  storylineData: StorylineTabData;
  diagnosisData: DiagnosisTabData;
  strategyData: StrategyTabData;
  studentGrade: number;
}

export function WarningSection({
  recordDataByGrade,
  storylineData,
  diagnosisData,
  strategyData,
  studentGrade,
}: WarningSectionProps) {
  const warnings = useMemo(() => {
    const recordsByGrade = new Map<number, RecordTabData>();
    for (const [grade, data] of Object.entries(recordDataByGrade)) {
      recordsByGrade.set(Number(grade), data);
    }

    const input: WarningCheckInput = {
      recordsByGrade,
      storylineData,
      diagnosisData,
      strategyData,
      currentGrade: studentGrade,
    };

    return computeWarnings(input);
  }, [recordDataByGrade, storylineData, diagnosisData, strategyData, studentGrade]);

  if (warnings.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={AlertTriangle} title="점검 사항" />
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-emerald-600">특이사항 없음 — 모든 항목이 정상입니다</p>
        </div>
      </section>
    );
  }

  // 카테고리별 그룹핑
  const grouped = warnings.reduce<Record<string, RecordWarning[]>>(
    (acc, w) => {
      (acc[w.category] ??= []).push(w);
      return acc;
    },
    {},
  );

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={AlertTriangle} title="점검 사항" />

      <div className="space-y-4 pt-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="print-avoid-break">
            <h3 className="text-sm font-semibold text-gray-700">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            <div className="space-y-2 pt-2">
              {items.map((w, i) => {
                const sev = SEVERITY_STYLES[w.severity];
                return (
                  <div
                    key={i}
                    className="flex gap-3 rounded border border-gray-200 p-3"
                  >
                    <span
                      className={`shrink-0 self-start rounded px-1.5 py-0.5 text-xs font-medium ${sev?.color ?? ""}`}
                    >
                      {sev?.label ?? w.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {w.title}
                      </p>
                      <p className="text-sm text-gray-600">{w.message}</p>
                      {w.suggestion && (
                        <p className="pt-1 text-xs text-blue-600">
                          → {w.suggestion}
                        </p>
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
