
import { useState, useMemo } from "react";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { WizardData } from "../PlanGroupWizard";
import {
  Step6FinalReviewProps,
  ContentInfo,
  BookDetail,
  LectureEpisode,
} from "./types";
import { useContentInfos } from "./hooks/useContentInfos";
import { useContentTotals } from "./hooks/useContentTotals";
import { useRecommendedRanges } from "./hooks/useRecommendedRanges";
import { useContentDetails } from "./hooks/useContentDetails";
import { useInitialRanges } from "./hooks/useInitialRanges";
import { SubjectAllocationUI } from "./SubjectAllocationUI";
import { ContentAllocationUI } from "./ContentAllocationUI";
import { ContentList } from "./ContentList";
import { ComparisonTable } from "./ComparisonTable";

export function Step6FinalReview({
  data,
  onUpdate,
  contents,
  isCampMode = false,
  studentId,
}: Step6FinalReviewProps) {
  // Hooks
  const { contentInfos, loading } = useContentInfos({
    data,
    contents,
    isCampMode,
    studentId,
  });

  const { contentTotals, loadingContentTotals } = useContentTotals({
    data,
    contentInfos,
    isCampMode,
    studentId,
  });

  const { recommendedRanges, rangeUnavailableReasons } = useRecommendedRanges({
    data,
    contentInfos,
    contentTotals,
  });

  const initialRanges = useInitialRanges({ contentInfos, data });

  // Range Editing State
  const [editingRangeIndex, setEditingRangeIndex] = useState<{
    type: "student" | "recommended";
    index: number;
  } | null>(null);
  const [editingRange, setEditingRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const {
    contentDetails,
    startDetailId,
    endDetailId,
    loadingDetails,
    setStartDetailId,
    setEndDetailId,
  } = useContentDetails({ editingRangeIndex, data, isCampMode, studentId });

  // Helper functions for range editing
  const setStartRange = (detailId: string) => {
    if (!editingRangeIndex) return;
    const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
    setStartDetailId((prev) => {
      const newMap = new Map(prev);
      newMap.set(contentKey, detailId);
      return newMap;
    });
  };

  const setEndRange = (detailId: string) => {
    if (!editingRangeIndex) return;
    const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
    setEndDetailId((prev) => {
      const newMap = new Map(prev);
      newMap.set(contentKey, detailId);
      return newMap;
    });
  };

  // 과목별 정렬 및 필수 과목 처리
  const contentsBySubject = new Map<string, ContentInfo[]>();
  contentInfos.forEach((content) => {
    const subject = content.subject_category || "기타";
    if (!contentsBySubject.has(subject)) {
      contentsBySubject.set(subject, []);
    }
    contentsBySubject.get(subject)!.push(content);
  });

  const requiredSubjects = useMemo(() => {
    if (!isCampMode) return [];
    return (
      data.subject_constraints?.required_subjects?.map(
        (req) => req.subject_category
      ) || []
    );
  }, [isCampMode, data.subject_constraints]);

  const sortedSubjects = useMemo(() => {
    return Array.from(contentsBySubject.keys()).sort((a, b) => {
      if (isCampMode && requiredSubjects.length > 0) {
        const aIndex = requiredSubjects.indexOf(a);
        const bIndex = requiredSubjects.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
      }
      return a.localeCompare(b);
    });
  }, [contentsBySubject, isCampMode, requiredSubjects]);

  const studentCount = data.student_contents.length;
  const recommendedCount = data.recommended_contents.length;
  const totalCount = studentCount + recommendedCount;

  const selectedSubjectCategories = new Set(
    contentInfos.map((c) => c.subject_category).filter((s): s is string => !!s)
  );

  // 학습량 요약 상태 계산
  const scheduleSummaryState = useMemo(() => {
    if (!data.schedule_summary) return null;

    const isCalculatingRecommendations =
      contentInfos.length > 0 &&
      recommendedRanges.size === 0 &&
      rangeUnavailableReasons.size === 0;
    const isLoading = loadingContentTotals || isCalculatingRecommendations;

    if (isLoading) {
      return {
        type: "loading" as const,
        loadingContentTotals,
      };
    }

    if (recommendedRanges.size === 0 && rangeUnavailableReasons.size > 0) {
      return { type: "unavailable" as const };
    }

    if (recommendedRanges.size === 0) {
      return { type: "empty" as const };
    }

    return { type: "ready" as const };
  }, [
    data.schedule_summary,
    contentInfos.length,
    recommendedRanges.size,
    rangeUnavailableReasons.size,
    loadingContentTotals,
  ]);

  // 학습량 요약 데이터 계산
  const learningVolumeSummary = useMemo(() => {
    if (!scheduleSummaryState || scheduleSummaryState.type !== "ready") {
      return null;
    }

    let initialTotalPages = 0;
    let initialTotalEpisodes = 0;
    let currentTotalPages = 0;
    let currentTotalEpisodes = 0;
    let recommendedTotalPages = 0;
    let recommendedTotalEpisodes = 0;

    const contentKeyMap = new Map<string, string>();
    const contentMap = new Map<
      string,
      | (typeof data.student_contents)[0]
      | (typeof data.recommended_contents)[0]
    >();

    data.student_contents.forEach((c, idx) => {
      const key = `student-${idx}`;
      contentKeyMap.set(c.content_id, key);
      contentMap.set(key, c);
    });

    data.recommended_contents.forEach((c, idx) => {
      const key = `recommended-${idx}`;
      contentKeyMap.set(c.content_id, key);
      contentMap.set(key, c);
    });

    contentInfos.forEach((info) => {
      const contentKey = contentKeyMap.get(info.content_id);
      if (!contentKey) return;

      const content = contentMap.get(contentKey);
      if (!content) return;

      const initial = initialRanges.get(contentKey);
      const recommended = recommendedRanges.get(contentKey);

      const range = content.end_range - content.start_range + 1;
      const initialRange = initial ? initial.end - initial.start + 1 : range;
      const recommendedRange = recommended
        ? recommended.end - recommended.start + 1
        : 0;

      if (info.content_type === "book") {
        initialTotalPages += initialRange;
        currentTotalPages += range;
        recommendedTotalPages += recommendedRange;
      } else {
        initialTotalEpisodes += initialRange;
        currentTotalEpisodes += range;
        recommendedTotalEpisodes += recommendedRange;
      }
    });

    const { total_study_days, total_study_hours } = data.schedule_summary || {
      total_study_days: 0,
      total_study_hours: 0,
    };
    const avgDailyHours =
      total_study_days > 0 ? total_study_hours / total_study_days : 0;

    const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
    const episodesPerHour = defaultRangeRecommendationConfig.episodesPerHour;
    const totalDailyPages = Math.round(avgDailyHours * pagesPerHour);
    const totalDailyEpisodes = Math.round(avgDailyHours * episodesPerHour);

    let currentEstimatedDays = 0;
    if (currentTotalPages > 0 && totalDailyPages > 0) {
      currentEstimatedDays = Math.ceil(currentTotalPages / totalDailyPages);
    }
    if (currentTotalEpisodes > 0 && totalDailyEpisodes > 0) {
      const episodeDays = Math.ceil(
        currentTotalEpisodes / totalDailyEpisodes
      );
      currentEstimatedDays = Math.max(currentEstimatedDays, episodeDays);
    }

    let recommendedEstimatedDays = 0;
    if (recommendedTotalPages > 0 && totalDailyPages > 0) {
      recommendedEstimatedDays = Math.ceil(
        recommendedTotalPages / totalDailyPages
      );
    }
    if (recommendedTotalEpisodes > 0 && totalDailyEpisodes > 0) {
      const episodeDays = Math.ceil(
        recommendedTotalEpisodes / totalDailyEpisodes
      );
      recommendedEstimatedDays = Math.max(
        recommendedEstimatedDays,
        episodeDays
      );
    }

    const hasChanged =
      initialTotalPages !== currentTotalPages ||
      initialTotalEpisodes !== currentTotalEpisodes;
    const hasDifference =
      currentTotalPages !== recommendedTotalPages ||
      currentTotalEpisodes !== recommendedTotalEpisodes;

    return {
      initialTotalPages,
      initialTotalEpisodes,
      currentTotalPages,
      currentTotalEpisodes,
      recommendedTotalPages,
      recommendedTotalEpisodes,
      currentEstimatedDays,
      recommendedEstimatedDays,
      hasChanged,
      hasDifference,
    };
  }, [
    scheduleSummaryState,
    contentInfos,
    data.student_contents,
    data.recommended_contents,
    data.schedule_summary,
    initialRanges,
    recommendedRanges,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">콘텐츠 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-gray-900">
          최종 확인 및 조정
        </h2>
        <p className="text-sm text-gray-600">
          선택한 콘텐츠와 학습 범위를 확인하고 필요시 조정해주세요.
        </p>
      </div>

      {/* 요약 정보 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-800">전체 콘텐츠</div>
              <div className="text-2xl font-bold text-gray-900">
                {totalCount}개
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-blue-800">학생 콘텐츠</div>
              <div className="text-2xl font-bold text-blue-800">
                {studentCount}개
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-green-700">
                추천 콘텐츠
              </div>
              <div className="text-2xl font-bold text-green-900">
                {recommendedCount}개
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 학습량 비교 요약 */}
      {scheduleSummaryState && scheduleSummaryState.type === "loading" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              📊 전체 학습량 비교
            </h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"></div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-800">
                    {scheduleSummaryState.loadingContentTotals
                      ? "콘텐츠 정보를 불러오는 중..."
                      : "추천 범위를 계산하는 중..."}
                  </p>
                  <p className="text-xs text-gray-600">잠시만 기다려주세요</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {scheduleSummaryState &&
        scheduleSummaryState.type === "ready" &&
        learningVolumeSummary && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-gray-900">
                📊 전체 학습량 비교
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 현재 범위 */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-medium text-blue-800">
                      현재 지정 범위
                    </div>
                    <div className="text-lg font-bold text-blue-800">
                      {learningVolumeSummary.currentTotalPages > 0 && (
                        <span className="block">
                          📄 {learningVolumeSummary.currentTotalPages}페이지
                        </span>
                      )}
                      {learningVolumeSummary.currentTotalEpisodes > 0 && (
                        <span className="block">
                          📺 {learningVolumeSummary.currentTotalEpisodes}회차
                        </span>
                      )}
                      {learningVolumeSummary.currentTotalPages === 0 &&
                        learningVolumeSummary.currentTotalEpisodes === 0 && (
                          <span className="text-sm text-gray-600">없음</span>
                        )}
                    </div>
                    <div className="text-xs text-blue-600">
                      예상 소요: 약 {learningVolumeSummary.currentEstimatedDays}일
                    </div>
                  </div>
                </div>
              </div>

              {/* 추천 범위 */}
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-green-700">
                    추천 범위
                  </div>
                  <div className="text-lg font-bold text-green-900">
                    {learningVolumeSummary.recommendedTotalPages > 0 && (
                      <span className="block">
                        📄 {learningVolumeSummary.recommendedTotalPages}페이지
                      </span>
                    )}
                    {learningVolumeSummary.recommendedTotalEpisodes > 0 && (
                      <span className="block">
                        📺 {learningVolumeSummary.recommendedTotalEpisodes}회차
                      </span>
                    )}
                    {learningVolumeSummary.recommendedTotalPages === 0 &&
                      learningVolumeSummary.recommendedTotalEpisodes === 0 && (
                        <span className="text-sm text-gray-600">없음</span>
                      )}
                  </div>
                  <div className="text-xs text-green-600">
                    예상 소요: 약 {learningVolumeSummary.recommendedEstimatedDays}
                    일 (스케줄에 맞춤)
                  </div>
                </div>
              </div>

              {/* 차이 */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-amber-700">차이</div>
                  <div className="text-lg font-bold text-amber-900">
                    {learningVolumeSummary.hasDifference ? (
                      <>
                        {learningVolumeSummary.currentTotalPages -
                          learningVolumeSummary.recommendedTotalPages !==
                          0 && (
                          <span className="block">
                            📄{" "}
                            {learningVolumeSummary.currentTotalPages -
                              learningVolumeSummary.recommendedTotalPages >
                            0
                              ? "+"
                              : ""}
                            {learningVolumeSummary.currentTotalPages -
                              learningVolumeSummary.recommendedTotalPages}
                            페이지
                          </span>
                        )}
                        {learningVolumeSummary.currentTotalEpisodes -
                          learningVolumeSummary.recommendedTotalEpisodes !==
                          0 && (
                          <span className="block">
                            📺{" "}
                            {learningVolumeSummary.currentTotalEpisodes -
                              learningVolumeSummary.recommendedTotalEpisodes >
                            0
                              ? "+"
                              : ""}
                            {learningVolumeSummary.currentTotalEpisodes -
                              learningVolumeSummary.recommendedTotalEpisodes}
                            회차
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-green-600">일치</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* 학습 범위 비교 테이블 */}
      <ComparisonTable
        data={data}
        onUpdate={onUpdate}
        contentInfos={contentInfos}
        recommendedRanges={recommendedRanges}
      />

      {/* 과목별 그룹화된 학습 범위 요약 */}
      {sortedSubjects.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            과목별 학습 범위
          </h3>
          <div className="flex flex-col gap-3">
            {sortedSubjects.map((subject) => {
              const contents = contentsBySubject.get(subject) || [];
              const isRequired = requiredSubjects.includes(subject);
              const hasRequired = selectedSubjectCategories.has(subject);

              return (
                <div
                  key={subject}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {subject}
                      </h4>
                      {isRequired && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          필수
                        </span>
                      )}
                      {isRequired && !hasRequired && (
                        <span className="text-xs text-red-600">(미선택)</span>
                      )}
                      <span className="ml-auto text-xs text-gray-600">
                        {contents.length}개
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {contents.map((content, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <div className="flex-1">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs font-medium text-gray-900">
                                {content.title}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                {content.content_type === "book" && "📚"}
                                {content.content_type === "lecture" && "🎧"}
                                <span>
                                  {content.start_range} ~ {content.end_range}
                                  {content.content_type === "book"
                                    ? " 페이지"
                                    : " 회차"}
                                </span>
                              </div>
                            </div>
                          </div>
                          {content.isRecommended && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              추천
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 콘텐츠가 없는 경우 */}
      {totalCount === 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">선택된 콘텐츠가 없습니다.</p>
          <p className="text-xs text-gray-600">
            이전 단계에서 콘텐츠를 선택해주세요.
          </p>
        </div>
      )}

      {/* 학생 콘텐츠 리스트 */}
      <ContentList
        type="student"
        contents={data.student_contents}
        contentInfos={contentInfos}
        recommendedRanges={recommendedRanges}
        rangeUnavailableReasons={rangeUnavailableReasons}
        editingRangeIndex={editingRangeIndex}
        editingRange={editingRange}
        contentDetails={contentDetails}
        loadingDetails={loadingDetails}
        startDetailId={startDetailId}
        endDetailId={endDetailId}
        onUpdateContents={(newContents) => onUpdate({ student_contents: newContents })}
        setEditingRangeIndex={setEditingRangeIndex}
        setEditingRange={setEditingRange}
        setStartRange={setStartRange}
        setEndRange={setEndRange}
      />

       {/* 추천 콘텐츠 리스트 */}
       <ContentList
        type="recommended"
        contents={data.recommended_contents}
        contentInfos={contentInfos}
        recommendedRanges={recommendedRanges}
        rangeUnavailableReasons={rangeUnavailableReasons}
        editingRangeIndex={editingRangeIndex}
        editingRange={editingRange}
        contentDetails={contentDetails}
        loadingDetails={loadingDetails}
        startDetailId={startDetailId}
        endDetailId={endDetailId}
        onUpdateContents={(newContents) => onUpdate({ recommended_contents: newContents })}
        setEditingRangeIndex={setEditingRangeIndex}
        setEditingRange={setEditingRange}
        setStartRange={setStartRange}
        setEndRange={setEndRange}
      />

      {/* 전략과목/취약과목 정보 */}
      {data.scheduler_type === "1730_timetable" &&
        (data.student_contents.length > 0 ||
          data.recommended_contents.length > 0) && (
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                전략과목/취약과목 정보
              </h2>

              <div className="inline-flex rounded-lg border border-gray-300 p-1">
                <button
                  type="button"
                  onClick={() => onUpdate({ allocation_mode: "subject" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    (data.allocation_mode || "subject") === "subject"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  교과별 설정
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ allocation_mode: "content" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    data.allocation_mode === "content"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  콘텐츠별 설정
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              {(data.allocation_mode || "subject") === "subject"
                ? "교과 단위로 전략/취약과목을 설정합니다. 같은 교과의 모든 콘텐츠에 동일하게 적용됩니다."
                : "개별 콘텐츠마다 전략/취약과목을 설정합니다. 더 세밀한 조절이 가능합니다."}
            </p>

            {(data.allocation_mode || "subject") === "subject" && (
              <SubjectAllocationUI
                data={data}
                onUpdate={onUpdate}
                contentInfos={contentInfos}
              />
            )}

            {data.allocation_mode === "content" && (
              <ContentAllocationUI
                data={data}
                onUpdate={onUpdate}
                contentInfos={contentInfos}
              />
            )}
          </div>
        )}
    </div>
  );
}
