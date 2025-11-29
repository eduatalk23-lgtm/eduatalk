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
  onSaveDraft,
  isSavingDraft = false,
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
    useState(!isEditMode);
  const [hasScoreData, setHasScoreData] = useState(false);

  // 추천 설정
  const [recommendationSettings, setRecommendationSettings] =
    useState<RecommendationSettings>({
      selectedSubjects: new Set(),
      recommendationCounts: new Map(),
      autoAssignContents: false,
    });

  // 최대 콘텐츠 개수
  const maxContents = 9;
  const currentTotal =
    data.student_contents.length + data.recommended_contents.length;

  // 필수 과목 체크
  const requiredSubjects = useMemo(() => {
    const allContents = [
      ...data.student_contents,
      ...data.recommended_contents,
    ];
    const subjectSet = new Set(
      allContents
        .map((c) => c.subject_category)
        .filter((s): s is string => !!s)
    );

    return [
      { subject: "국어", selected: subjectSet.has("국어") },
      { subject: "수학", selected: subjectSet.has("수학") },
      { subject: "영어", selected: subjectSet.has("영어") },
    ];
  }, [data.student_contents, data.recommended_contents]);

  // 필수 과목 모두 선택 여부
  const allRequiredSelected = useMemo(() => {
    return requiredSubjects.every((s) => s.selected);
  }, [requiredSubjects]);

  // 경고 메시지
  const warningMessage = useMemo(() => {
    if (currentTotal === 0) {
      return "최소 1개 이상의 콘텐츠를 선택해주세요.";
    }
    if (!allRequiredSelected && currentTotal >= maxContents) {
      const missing = requiredSubjects
        .filter((s) => !s.selected)
        .map((s) => s.subject);
      return `필수 과목 (${missing.join(", ")})을 선택해주세요.`;
    }
    return undefined;
  }, [currentTotal, allRequiredSelected, requiredSubjects]);

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

  // Draft 자동 저장 (데이터 변경 시)
  useEffect(() => {
    if (onSaveDraft && !isSavingDraft) {
      const timer = setTimeout(() => {
        onSaveDraft();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [data.student_contents, data.recommended_contents, onSaveDraft, isSavingDraft]);

  return (
    <div className="space-y-6">
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

      {/* Draft 저장 상태 */}
      {isSavingDraft && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          저장 중...
        </div>
      )}
    </div>
  );
}

