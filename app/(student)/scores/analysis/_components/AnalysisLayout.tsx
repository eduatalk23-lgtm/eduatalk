"use client";

import { useState } from "react";
import type { InternalScoreWithRelations, MockScoreWithRelations } from "@/lib/types/scoreAnalysis";
import InternalDetailAnalysis from "./InternalDetailAnalysis";
import MockDetailAnalysis from "./MockDetailAnalysis";

type AnalysisLayoutProps = {
  studentId: string;
  tenantId: string;
  internalScores: InternalScoreWithRelations[];
  mockScores: MockScoreWithRelations[];
};

type AnalysisType = "internal" | "mock";

export default function AnalysisLayout({
  studentId,
  tenantId,
  internalScores,
  mockScores,
}: AnalysisLayoutProps) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("internal");

  return (
    <div className="flex flex-col gap-6">
      {/* 분석 유형 선택 탭 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setAnalysisType("internal")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            analysisType === "internal"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          내신 분석
        </button>
        <button
          onClick={() => setAnalysisType("mock")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            analysisType === "mock"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          모의고사 분석
        </button>
      </div>

      {/* 분석 콘텐츠 */}
      {analysisType === "internal" ? (
        <InternalDetailAnalysis
          studentId={studentId}
          tenantId={tenantId}
          scores={internalScores}
        />
      ) : (
        <MockDetailAnalysis
          studentId={studentId}
          tenantId={tenantId}
          scores={mockScores}
        />
      )}
    </div>
  );
}

