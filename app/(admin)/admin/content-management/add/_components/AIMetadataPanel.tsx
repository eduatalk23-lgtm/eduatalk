"use client";

/**
 * AI 추론 메타데이터 패널
 *
 * AI가 추출한 메타데이터를 표시하고 사용자가 수정할 수 있게 합니다.
 */

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ConfidenceIndicator, QualityBadge } from "./ConfidenceIndicator";
import type { ExtractedMetadata } from "@/lib/domains/content-research/types";

interface AIMetadataPanelProps {
  metadata: ExtractedMetadata | null;
  overallScore: number;
  isLoading: boolean;
  error?: string | null;
  onAccept?: (metadata: ExtractedMetadata) => void;
  onEdit?: (field: keyof ExtractedMetadata, value: unknown) => void;
}

export function AIMetadataPanel({
  metadata,
  overallScore,
  isLoading,
  error,
  onAccept,
  onEdit,
}: AIMetadataPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm text-blue-700">AI가 메타데이터를 분석 중입니다...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          제목을 입력하면 AI가 자동으로 메타데이터를 추론합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🤖</span>
          <span className="font-medium text-purple-800">AI 분석 결과</span>
          <QualityBadge score={overallScore} />
        </div>
        <button
          type="button"
          className="text-purple-600 hover:text-purple-800 transition-colors"
        >
          {isExpanded ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-purple-200 p-4 space-y-4">
          {/* 추론 근거 */}
          <div className="text-sm text-purple-700 bg-purple-100/50 rounded p-2">
            💡 {metadata.reasoning}
          </div>

          {/* 메타데이터 필드 */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {/* 과목 */}
            <MetadataField
              label="과목"
              value={metadata.subject}
              confidence={metadata.subjectConfidence}
              onEdit={onEdit ? (v) => onEdit("subject", v) : undefined}
            />

            {/* 과목 카테고리 */}
            <MetadataField
              label="과목 카테고리"
              value={metadata.subjectCategory}
              confidence={metadata.subjectCategoryConfidence}
              onEdit={onEdit ? (v) => onEdit("subjectCategory", v) : undefined}
            />

            {/* 난이도 */}
            <MetadataField
              label="난이도"
              value={formatDifficulty(metadata.difficulty)}
              confidence={metadata.difficultyConfidence}
              onEdit={onEdit ? (v) => onEdit("difficulty", v) : undefined}
            />

            {/* 대상 학년 */}
            <MetadataField
              label="대상 학년"
              value={metadata.gradeLevel.join(", ") || null}
              confidence={metadata.gradeLevelConfidence}
              onEdit={onEdit ? (v) => onEdit("gradeLevel", v) : undefined}
            />

            {/* 교육과정 */}
            <MetadataField
              label="교육과정"
              value={metadata.curriculum ? `${metadata.curriculum}개정` : null}
              confidence={metadata.curriculumConfidence}
              onEdit={onEdit ? (v) => onEdit("curriculum", v) : undefined}
            />

            {/* 강의 유형 (강의인 경우) */}
            {metadata.lectureType && (
              <MetadataField
                label="강의 유형"
                value={formatLectureType(metadata.lectureType)}
                confidence={metadata.lectureTypeConfidence ?? 0}
                onEdit={onEdit ? (v) => onEdit("lectureType", v) : undefined}
              />
            )}

            {/* 강사명 (강의인 경우) */}
            {metadata.instructorName && (
              <MetadataField
                label="강사명"
                value={metadata.instructorName}
                confidence={0.9}
              />
            )}
          </div>

          {/* 적용 버튼 */}
          {onAccept && (
            <div className="pt-2 border-t border-purple-200">
              <button
                type="button"
                onClick={() => onAccept(metadata)}
                className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                AI 추론 결과 적용하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 개별 메타데이터 필드
// ============================================

interface MetadataFieldProps {
  label: string;
  value: string | null;
  confidence: number;
  onEdit?: (value: string) => void;
}

function MetadataField({ label, value, confidence, onEdit }: MetadataFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");

  const handleSave = () => {
    if (onEdit) {
      onEdit(editValue);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {onEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            수정
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              setEditValue(value ?? "");
              setIsEditing(false);
            }}
            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            취소
          </button>
        </div>
      ) : (
        <>
          <p className={cn("text-sm font-medium", value ? "text-gray-900" : "text-gray-400 italic")}>
            {value || "알 수 없음"}
          </p>
          <ConfidenceIndicator confidence={confidence} size="sm" />
        </>
      )}
    </div>
  );
}

// ============================================
// 포맷팅 헬퍼
// ============================================

function formatDifficulty(difficulty: string | null): string | null {
  if (!difficulty) return null;
  const labels: Record<string, string> = {
    easy: "기초",
    medium: "기본",
    hard: "심화",
  };
  return labels[difficulty] ?? difficulty;
}

function formatLectureType(type: string | null): string | null {
  if (!type) return null;
  const labels: Record<string, string> = {
    concept: "개념완성",
    problem: "문제풀이",
    review: "복습/정리",
    exam_prep: "시험대비",
    intensive: "단기특강",
  };
  return labels[type] ?? type;
}
