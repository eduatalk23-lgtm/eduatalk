"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Step3ContentSelectionProps,
  RecommendationSettings,
  RecommendedContent,
} from "@/lib/types/content-selection";
import {
  StudentContentsPanel,
  RecommendedContentsPanel,
  ProgressIndicator,
} from "./_shared";
import { BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { getRecommendedMasterContentsAction } from "@/app/(student)/actions/getRecommendedMasterContents";
import { fetchDetailSubjects } from "@/app/(student)/actions/fetchDetailSubjects";

/**
 * Step3ContentSelection - 콘텐츠 선택 통합 컴포넌트
 * 
 * Phase 3.5에서 구현
 * 기존 Step3Contents + Step4RecommendedContents를 통합
 * 탭 UI로 학생 콘텐츠와 추천 콘텐츠를 한 화면에서 관리
 */
export function Step3ContentSelection({
  data,
  onUpdate,
  contents,
  isEditMode = false,
  isCampMode = false,
  studentId,
  editable = true,
}: Step3ContentSelectionProps) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<"student" | "recommended">(
    "student"
  );

  // 추천 콘텐츠 상태
  const [recommendedContents, setRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [allRecommendedContents, setAllRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [selectedRecommendedIds, setSelectedRecommendedIds] = useState<
    Set<string>
  >(new Set());
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [hasRequestedRecommendations, setHasRequestedRecommendations] =
    useState(false); // 항상 false로 초기화 (일반 모드에서도 추천 기능 사용 가능)
  const [hasScoreData, setHasScoreData] = useState(false);

  // 추천 설정
  const [recommendationSettings, setRecommendationSettings] =
    useState<RecommendationSettings>({
      selectedSubjects: new Set(),
      recommendationCounts: new Map(),
      autoAssignContents: false,
    });

  // 필수 교과 설정 관련 상태
  const availableSubjects = ["국어", "수학", "영어", "과학", "사회"];
  const [detailSubjects, setDetailSubjects] = useState<Map<string, string[]>>(
    new Map()
  );
  const [loadingDetailSubjects, setLoadingDetailSubjects] = useState<
    Set<string>
  >(new Set());

  // 최대 콘텐츠 개수
  const maxContents = 9;
  const currentTotal =
    data.student_contents.length + data.recommended_contents.length;

  // 필수 과목 체크 (캠프 모드에서만)
  const requiredSubjects = useMemo(() => {
    // 일반 모드에서는 필수 과목 검증 사용 안 함
    if (!isCampMode) {
      return [];
    }

    // 필수 교과 설정에서 지정한 과목 가져오기
    const requiredSubjectCategories =
      data.subject_constraints?.required_subjects?.map(
        (req) => req.subject_category
      ) || [];

    // 필수 교과가 설정되지 않았으면 빈 배열 반환
    if (requiredSubjectCategories.length === 0) {
      return [];
    }

    const allContents = [
      ...data.student_contents,
      ...data.recommended_contents,
    ];
    const subjectSet = new Set(
      allContents
        .map((c) => c.subject_category)
        .filter((s): s is string => !!s)
    );

    // 필수 교과 설정에 따라 동적으로 생성
    return requiredSubjectCategories.map((category) => ({
      subject: category,
      selected: subjectSet.has(category),
    }));
  }, [
    data.student_contents,
    data.recommended_contents,
    data.subject_constraints?.required_subjects,
    isCampMode,
  ]);

  // 필수 과목 모두 선택 여부 (캠프 모드에서만)
  const allRequiredSelected = useMemo(() => {
    if (!isCampMode) return true; // 일반 모드에서는 항상 true
    return requiredSubjects.every((s) => s.selected);
  }, [requiredSubjects, isCampMode]);

  // 경고 메시지
  const warningMessage = useMemo(() => {
    if (currentTotal === 0) {
      return "최소 1개 이상의 콘텐츠를 선택해주세요.";
    }
    // 캠프 모드에서만 필수 과목 검증
    if (isCampMode && !allRequiredSelected && currentTotal >= maxContents) {
      const missing = requiredSubjects
        .filter((s) => !s.selected)
        .map((s) => s.subject);
      return `필수 과목 (${missing.join(", ")})을 선택해주세요.`;
    }
    return undefined;
  }, [currentTotal, allRequiredSelected, requiredSubjects, isCampMode, maxContents]);

  // 학생 콘텐츠 업데이트
  const handleStudentContentsUpdate = useCallback(
    (contents: typeof data.student_contents) => {
      onUpdate({ student_contents: contents });
    },
    [onUpdate]
  );

  // 추천 콘텐츠 업데이트
  const handleRecommendedContentsUpdate = useCallback(
    (contents: typeof data.recommended_contents) => {
      onUpdate({ recommended_contents: contents });
      
      // 선택된 ID 업데이트
      setSelectedRecommendedIds(new Set(contents.map((c) => c.content_id)));
    },
    [onUpdate]
  );

  // 추천 받기 요청
  const handleRequestRecommendations = useCallback(async () => {
    setRecommendationLoading(true);

    try {
      // 과목과 개수 배열로 변환
      const subjects = Array.from(recommendationSettings.selectedSubjects);
      const counts = subjects.map(
        (s) => recommendationSettings.recommendationCounts.get(s) || 1
      );

      // API 호출
      const result = await getRecommendedMasterContentsAction(
        studentId,
        subjects,
        counts
      );

      if (!result.success || !result.data) {
        alert("추천 콘텐츠를 불러오는 데 실패했습니다.");
        return;
      }

      const recommendations = result.data.recommendations || [];

      // 성적 데이터 유무 확인
      const hasDetailedReasons = recommendations.some(
        (r: any) =>
          r.reason?.includes("내신") ||
          r.reason?.includes("모의고사") ||
          r.reason?.includes("위험도") ||
          r.scoreDetails
      );
      setHasScoreData(hasDetailedReasons);

      // 중복 제거
      const existingIds = new Set([
        ...data.student_contents.map((c) => c.content_id),
        ...data.recommended_contents.map((c) => c.content_id),
      ]);

      // 학생 콘텐츠의 master_content_id 수집
      const studentMasterIds = new Set<string>();
      data.student_contents.forEach((c) => {
        const masterContentId = (c as any).master_content_id;
        if (masterContentId) {
          studentMasterIds.add(masterContentId);
        }
      });

      // 추천 콘텐츠 매핑
      const recommendationsMap = new Map<string, RecommendedContent>();
      recommendations.forEach((c: any) => {
        recommendationsMap.set(c.id, c);
      });

      // 전체 목록 업데이트
      setAllRecommendedContents((prev) => {
        const merged = new Map<string, RecommendedContent>();
        prev.forEach((c) => merged.set(c.id, c));
        recommendationsMap.forEach((c, id) => {
          merged.set(id, c);
        });
        return Array.from(merged.values());
      });

      // 필터링
      const filteredRecommendations = recommendations.filter((r: any) => {
        // content_id로 직접 비교
        if (existingIds.has(r.id)) {
          return false;
        }
        // master_content_id로 비교
        if (studentMasterIds.has(r.id)) {
          return false;
        }
        return true;
      });

      setRecommendedContents(filteredRecommendations);
      setHasRequestedRecommendations(true);

      // 자동 배정
      if (
        recommendationSettings.autoAssignContents &&
        filteredRecommendations.length > 0
      ) {
        // TODO: 자동 배정 로직 구현 (전체 범위)
        // 현재는 수동 선택만 지원
      }

      // 추천 탭으로 전환
      setActiveTab("recommended");
    } catch (error) {
      console.error("[Step3ContentSelection] 추천 받기 실패:", error);
      alert("추천 콘텐츠를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setRecommendationLoading(false);
    }
  }, [
    recommendationSettings,
    studentId,
    data.student_contents,
    data.recommended_contents,
  ]);

  // 필수 교과 설정 핸들러
  // 세부 과목 불러오기
  const handleLoadDetailSubjects = useCallback(
    async (category: string) => {
      if (detailSubjects.has(category)) return;

      setLoadingDetailSubjects((prev) => new Set([...prev, category]));

      try {
        const subjects = await fetchDetailSubjects(category);
        setDetailSubjects((prev) => new Map([...prev, [category, subjects]]));
      } catch (error) {
        console.error("Error loading detail subjects:", error);
      } finally {
        setLoadingDetailSubjects((prev) => {
          const newSet = new Set(prev);
          newSet.delete(category);
          return newSet;
        });
      }
    },
    [detailSubjects]
  );

  // 필수 교과 추가
  const handleAddRequiredSubject = useCallback(() => {
    const currentConstraints = data.subject_constraints || {
      enable_required_subjects_validation: true,
      required_subjects: [],
      excluded_subjects: [],
      constraint_handling: "warning",
    };

    const newRequirement = {
      subject_category: "",
      min_count: 1,
    };

    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        enable_required_subjects_validation: true,
        required_subjects: [
          ...(currentConstraints.required_subjects || []),
          newRequirement,
        ],
      },
    });
  }, [data.subject_constraints, onUpdate]);

  // 필수 교과 업데이트
  const handleRequiredSubjectUpdate = useCallback(
    (
      index: number,
      updated: Partial<{
        subject_category: string;
        subject?: string;
        min_count: number;
      }>
    ) => {
      if (!data.subject_constraints) return;

      const currentConstraints = data.subject_constraints;
      const newRequirements = [...currentConstraints.required_subjects!];
      newRequirements[index] = { ...newRequirements[index], ...updated };

      onUpdate({
        subject_constraints: {
          ...currentConstraints,
          required_subjects: newRequirements,
        },
      });
    },
    [data.subject_constraints, onUpdate]
  );

  // 필수 교과 삭제
  const handleRequiredSubjectRemove = useCallback(
    (index: number) => {
      if (!data.subject_constraints) return;

      const currentConstraints = data.subject_constraints;
      const newRequirements = currentConstraints.required_subjects!.filter(
        (_, i) => i !== index
      );

      onUpdate({
        subject_constraints: {
          ...currentConstraints,
          required_subjects: newRequirements,
          enable_required_subjects_validation: newRequirements.length > 0,
        },
      });
    },
    [data.subject_constraints, onUpdate]
  );

  // 제약 조건 처리 방식 변경
  const handleConstraintHandlingChange = useCallback(
    (handling: "strict" | "warning" | "auto_fix") => {
      if (!data.subject_constraints) return;

      const currentConstraints = data.subject_constraints;
      onUpdate({
        subject_constraints: {
          ...currentConstraints,
          constraint_handling: handling,
        },
      });
    },
    [data.subject_constraints, onUpdate]
  );

  // 편집 모드에서 기존 추천 콘텐츠 정보 로드
  useEffect(() => {
    if (isEditMode && data.recommended_contents.length > 0) {
      // 편집 모드에서 기존 추천 콘텐츠가 있으면 allRecommendedContents에 추가
      // 실제 추천 콘텐츠 정보는 나중에 필요할 때 조회
      const existingIds = new Set(
        data.recommended_contents.map((c) => c.content_id)
      );
      setSelectedRecommendedIds(existingIds);
    }
  }, [isEditMode, data.recommended_contents]);

  return (
    <div className="space-y-6">
      {/* 필수 교과 설정 섹션 - 캠프 모드에서만 표시 */}
      {isCampMode && (
      <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 mb-6 shadow-md">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold text-gray-900">
              필수 교과 설정
            </h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              필수
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. (예: 국어,
            수학, 영어)
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. 세부 과목까지
            지정하여 더 정확한 제약 조건을 설정할 수 있습니다.
          </p>

          {/* 필수 교과 목록 */}
          {(data.subject_constraints?.required_subjects || []).length > 0 && (
            <div className="space-y-3">
              {(data.subject_constraints?.required_subjects || []).map(
                (req, index) => (
                  <RequiredSubjectItem
                    key={index}
                    requirement={req}
                    index={index}
                    availableSubjects={availableSubjects}
                    availableDetailSubjects={
                      detailSubjects.get(req.subject_category) || []
                    }
                    loadingDetailSubjects={loadingDetailSubjects.has(
                      req.subject_category
                    )}
                    onUpdate={(updated) =>
                      handleRequiredSubjectUpdate(index, updated)
                    }
                    onRemove={() => handleRequiredSubjectRemove(index)}
                    onLoadDetailSubjects={handleLoadDetailSubjects}
                  />
                )
              )}
            </div>
          )}

          {/* 교과 추가 버튼 */}
          <button
            type="button"
            onClick={handleAddRequiredSubject}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            + 필수 교과 추가
          </button>

          {/* 제약 조건 처리 방식 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제약 조건 처리 방식
            </label>
            <select
              value={data.subject_constraints?.constraint_handling || "warning"}
              onChange={(e) =>
                handleConstraintHandlingChange(
                  e.target.value as "strict" | "warning" | "auto_fix"
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="warning">
                경고 (권장) - 경고만 표시하고 진행
              </option>
              <option value="strict">
                엄격 (필수) - 조건 미충족 시 진행 불가
              </option>
              <option value="auto_fix">
                자동 보정 - 시스템이 자동으로 보정
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {data.subject_constraints?.constraint_handling === "warning" &&
                "조건 미충족 시 경고를 표시하지만 다음 단계로 진행할 수 있습니다."}
              {data.subject_constraints?.constraint_handling === "strict" &&
                "조건을 반드시 충족해야 다음 단계로 진행할 수 있습니다."}
              {data.subject_constraints?.constraint_handling === "auto_fix" &&
                "시스템이 자동으로 필요한 콘텐츠를 추천합니다."}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* 진행률 표시 */}
      <ProgressIndicator
        current={currentTotal}
        max={maxContents}
        requiredSubjects={requiredSubjects}
        showWarning={!!warningMessage}
        warningMessage={warningMessage}
      />

      {/* 탭 UI */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("student")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "student"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          <BookOpen className="h-4 w-4" />
          <span>학생 콘텐츠</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "student"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {data.student_contents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recommended")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "recommended"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          <Sparkles className="h-4 w-4" />
          <span>추천 콘텐츠</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "recommended"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {data.recommended_contents.length}
          </span>
        </button>
      </div>

      {/* 탭 내용 */}
      <div>
        {activeTab === "student" ? (
          <StudentContentsPanel
            contents={contents}
            selectedContents={data.student_contents}
            maxContents={maxContents}
            currentTotal={currentTotal}
            onUpdate={handleStudentContentsUpdate}
            editable={editable}
            isCampMode={isCampMode}
          />
        ) : (
          <RecommendedContentsPanel
            recommendedContents={recommendedContents}
            allRecommendedContents={allRecommendedContents}
            selectedContents={data.recommended_contents}
            selectedRecommendedIds={selectedRecommendedIds}
            maxContents={maxContents}
            currentTotal={currentTotal}
            settings={recommendationSettings}
            onSettingsChange={setRecommendationSettings}
            onUpdate={handleRecommendedContentsUpdate}
            onRequestRecommendations={handleRequestRecommendations}
            isEditMode={isEditMode}
            isCampMode={isCampMode}
            loading={recommendationLoading}
            hasRequestedRecommendations={hasRequestedRecommendations}
            hasScoreData={hasScoreData}
            studentId={studentId}
          />
        )}
      </div>
    </div>
  );
}

// RequiredSubjectItem 컴포넌트
type RequiredSubjectItemProps = {
  requirement: {
    subject_category: string;
    subject?: string;
    min_count: number;
  };
  index: number;
  availableSubjects: string[];
  availableDetailSubjects: string[];
  loadingDetailSubjects: boolean;
  onUpdate: (
    updated: Partial<{
      subject_category: string;
      subject?: string;
      min_count: number;
    }>
  ) => void;
  onRemove: () => void;
  onLoadDetailSubjects: (category: string) => void;
};

function RequiredSubjectItem({
  requirement,
  index,
  availableSubjects,
  availableDetailSubjects,
  loadingDetailSubjects,
  onUpdate,
  onRemove,
  onLoadDetailSubjects,
}: RequiredSubjectItemProps) {
  const [showDetailSubjects, setShowDetailSubjects] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        {/* 교과 선택 */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            교과
          </label>
          <select
            value={requirement.subject_category}
            onChange={(e) =>
              onUpdate({ subject_category: e.target.value, subject: undefined })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">교과 선택</option>
            {availableSubjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        {/* 최소 개수 */}
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            최소 개수
          </label>
          <input
            type="number"
            min="1"
            max="9"
            value={requirement.min_count}
            onChange={(e) =>
              onUpdate({ min_count: parseInt(e.target.value) || 1 })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        {/* 삭제 버튼 */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 text-gray-400 hover:text-red-600 transition-colors"
          aria-label="필수 교과 삭제"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 세부 과목 선택 (선택사항) */}
      {requirement.subject_category && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setShowDetailSubjects(!showDetailSubjects);
              if (!showDetailSubjects && availableDetailSubjects.length === 0) {
                onLoadDetailSubjects(requirement.subject_category);
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showDetailSubjects
              ? "세부 과목 숨기기"
              : "세부 과목 지정 (선택사항)"}
          </button>

          {showDetailSubjects && (
            <div className="mt-2">
              {loadingDetailSubjects ? (
                <p className="text-xs text-gray-500">
                  세부 과목 불러오는 중...
                </p>
              ) : availableDetailSubjects.length > 0 ? (
                <select
                  value={requirement.subject || ""}
                  onChange={(e) =>
                    onUpdate({ subject: e.target.value || undefined })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="">세부 과목 선택 (전체)</option>
                  {availableDetailSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500">
                  세부 과목 정보가 없습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

