"use client";

/**
 * 배치 플랜 미리보기 단계 컴포넌트
 *
 * Phase 3: 미리보기 모드
 *
 * 생성된 플랜을 DB 저장 전에 미리보기하고,
 * 특정 학생을 제외하거나 품질을 확인할 수 있습니다.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import type {
  StudentPlanPreview,
  BatchPreviewResult,
  QualityScore,
} from "@/lib/domains/admin-plan/types/preview";

// ============================================
// 타입
// ============================================

interface BatchPreviewStepProps {
  previewResult: BatchPreviewResult;
  selectedStudentIds: string[];
  onSelectionChange: (studentIds: string[]) => void;
  isLoading?: boolean;
}

// ============================================
// 아이콘
// ============================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

// ============================================
// 품질 점수 표시
// ============================================

function QualityScoreDisplay({ score }: { score: QualityScore }) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return "text-green-600";
    if (value >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getConflictColor = (value: number) => {
    if (value === 0) return "text-green-600";
    if (value <= 2) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex justify-between">
        <span style={{ color: textSecondaryVar }}>전체</span>
        <span className={cn("font-medium", getScoreColor(score.overall))}>
          {score.overall}점
        </span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: textSecondaryVar }}>균형</span>
        <span className={cn("font-medium", getScoreColor(score.balance))}>
          {score.balance}점
        </span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: textSecondaryVar }}>충돌</span>
        <span className={cn("font-medium", getConflictColor(score.conflicts))}>
          {score.conflicts}건
        </span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: textSecondaryVar }}>커버리지</span>
        <span className={cn("font-medium", getScoreColor(score.coverage))}>
          {score.coverage}%
        </span>
      </div>
    </div>
  );
}

// ============================================
// 학생 미리보기 카드
// ============================================

function StudentPreviewCard({
  preview,
  isSelected,
  onToggle,
}: {
  preview: StudentPlanPreview;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    success: <CheckIcon className="h-4 w-4 text-green-600" />,
    error: <XIcon className="h-4 w-4 text-red-600" />,
    skipped: <AlertIcon className="h-4 w-4 text-yellow-600" />,
  };

  const statusLabel = {
    success: "성공",
    error: "오류",
    skipped: "건너뜀",
  };

  const canSelect = preview.status === "success";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        isSelected && canSelect && "ring-2 ring-blue-500"
      )}
      style={{
        borderColor: borderDefaultVar,
        backgroundColor: bgSurfaceVar,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        {canSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {statusIcon[preview.status]}
            <span className="font-medium truncate" style={{ color: textPrimaryVar }}>
              {preview.studentName}
            </span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                preview.status === "success" && "bg-green-100 text-green-700",
                preview.status === "error" && "bg-red-100 text-red-700",
                preview.status === "skipped" && "bg-yellow-100 text-yellow-700"
              )}
            >
              {statusLabel[preview.status]}
            </span>
          </div>
          {preview.status === "success" && preview.summary && (
            <div className="text-xs mt-1" style={{ color: textSecondaryVar }}>
              {preview.summary.totalPlans}개 플랜 · {Math.round(preview.summary.totalMinutes / 60)}시간
              {preview.cost && ` · $${preview.cost.estimatedUSD.toFixed(4)}`}
            </div>
          )}
          {preview.status !== "success" && preview.error && (
            <div className="text-xs text-red-600 mt-1">{preview.error}</div>
          )}
        </div>
        {preview.status === "success" && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:underline"
          >
            {isExpanded ? "접기" : "상세"}
          </button>
        )}
      </div>

      {/* 확장된 상세 정보 */}
      {isExpanded && preview.status === "success" && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: borderDefaultVar }}>
          {/* 품질 점수 */}
          {preview.qualityScore && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs font-medium mb-2" style={{ color: textPrimaryVar }}>
                <ChartIcon className="h-3.5 w-3.5" />
                품질 점수
              </div>
              <QualityScoreDisplay score={preview.qualityScore} />
            </div>
          )}

          {/* 과목 분포 */}
          {preview.summary?.subjectDistribution && (
            <div className="mb-3">
              <div className="text-xs font-medium mb-2" style={{ color: textPrimaryVar }}>
                과목 분포
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(preview.summary.subjectDistribution).map(([subject, minutes]) => (
                  <span
                    key={subject}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100"
                    style={{ color: textSecondaryVar }}
                  >
                    {subject}: {Math.round(minutes / 60)}시간
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 검증 경고 */}
          {preview.validation && preview.validation.warnings.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1 text-yellow-600">
                경고 ({preview.validation.warnings.length}건)
              </div>
              <ul className="text-xs text-yellow-600 space-y-0.5">
                {preview.validation.warnings.slice(0, 3).map((w, i) => (
                  <li key={i}>• {w.message}</li>
                ))}
                {preview.validation.warnings.length > 3 && (
                  <li>• 외 {preview.validation.warnings.length - 3}건</li>
                )}
              </ul>
            </div>
          )}

          {/* 검증 오류 */}
          {preview.validation && preview.validation.errors.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium mb-1 text-red-600">
                오류 ({preview.validation.errors.length}건)
              </div>
              <ul className="text-xs text-red-600 space-y-0.5">
                {preview.validation.errors.slice(0, 3).map((e, i) => (
                  <li key={i}>• {e.message}</li>
                ))}
                {preview.validation.errors.length > 3 && (
                  <li>• 외 {preview.validation.errors.length - 3}건</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function BatchPreviewStep({
  previewResult,
  selectedStudentIds,
  onSelectionChange,
  isLoading,
}: BatchPreviewStepProps) {
  const successPreviews = useMemo(
    () => previewResult.previews.filter((p) => p.status === "success"),
    [previewResult.previews]
  );

  const handleToggle = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      onSelectionChange(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      onSelectionChange([...selectedStudentIds, studentId]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(successPreviews.map((p) => p.studentId));
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      {/* 요약 헤더 */}
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: bgSurfaceVar, borderColor: borderDefaultVar }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium" style={{ color: textPrimaryVar }}>
            미리보기 결과
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:underline"
              disabled={isLoading}
            >
              전체 선택
            </button>
            <button
              onClick={handleDeselectAll}
              className="text-xs text-gray-600 hover:underline"
              disabled={isLoading}
            >
              전체 해제
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div style={{ color: textSecondaryVar }}>성공</div>
            <div className="font-medium text-green-600">
              {previewResult.summary.succeeded}명
            </div>
          </div>
          <div>
            <div style={{ color: textSecondaryVar }}>선택됨</div>
            <div className="font-medium text-blue-600">
              {selectedStudentIds.length}명
            </div>
          </div>
          <div>
            <div style={{ color: textSecondaryVar }}>총 플랜</div>
            <div className="font-medium" style={{ color: textPrimaryVar }}>
              {previewResult.summary.totalPlans}개
            </div>
          </div>
          <div>
            <div style={{ color: textSecondaryVar }}>평균 품질</div>
            <div
              className={cn(
                "font-medium",
                previewResult.summary.averageQualityScore >= 80
                  ? "text-green-600"
                  : previewResult.summary.averageQualityScore >= 60
                  ? "text-yellow-600"
                  : "text-red-600"
              )}
            >
              {previewResult.summary.averageQualityScore}점
            </div>
          </div>
        </div>

        {previewResult.summary.failed > 0 && (
          <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-600">
            {previewResult.summary.failed}명의 학생에서 오류가 발생했습니다.
          </div>
        )}
      </div>

      {/* 학생별 미리보기 카드 */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {previewResult.previews.map((preview) => (
          <StudentPreviewCard
            key={preview.studentId}
            preview={preview}
            isSelected={selectedStudentIds.includes(preview.studentId)}
            onToggle={() => handleToggle(preview.studentId)}
          />
        ))}
      </div>

      {/* 비용 안내 */}
      <div className="text-xs text-center" style={{ color: textSecondaryVar }}>
        선택된 학생: {selectedStudentIds.length}명 · 예상 비용: $
        {previewResult.previews
          .filter((p) => selectedStudentIds.includes(p.studentId))
          .reduce((sum, p) => sum + (p.cost?.estimatedUSD || 0), 0)
          .toFixed(4)}
      </div>
    </div>
  );
}

export default BatchPreviewStep;
