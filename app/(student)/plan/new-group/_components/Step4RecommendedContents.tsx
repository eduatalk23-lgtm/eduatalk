"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WizardData } from "./PlanGroupWizard";
import { formatNumber } from "@/lib/utils/formatNumber";
import { PlanGroupError, toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";
import { fetchDetailSubjects } from "@/app/(student)/actions/fetchDetailSubjects";
import { ProgressIndicator } from "./_shared/ProgressIndicator";

type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
};

type Step4RecommendedContentsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string; // 관리자 모드에서 다른 학생의 추천 콘텐츠 조회 시 사용
};

type RecommendedContent = {
  id: string;
  contentType: "book" | "lecture";
  title: string;
  subject_category: string | null;
  subject: string | null;
  semester: string | null;
  revision: string | null;
  publisher?: string | null;
  platform?: string | null;
  difficulty_level: string | null;
  reason: string;
  priority: number;
  scoreDetails?: {
    schoolGrade?: number | null;
    schoolAverageGrade?: number | null;
    mockPercentile?: number | null;
    mockGrade?: number | null;
    riskScore?: number;
  };
};

export function Step4RecommendedContents({
  data,
  onUpdate,
  isEditMode = false,
  isCampMode = false,
  studentId: propStudentId,
}: Step4RecommendedContentsProps) {
  const [recommendedContents, setRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [allRecommendedContents, setAllRecommendedContents] = useState<
    RecommendedContent[]
  >([]); // 원본 추천 목록 (추가된 콘텐츠 정보 조회용)
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(!isEditMode); // 편집 모드일 때는 초기 로딩 false
  const [hasRequestedRecommendations, setHasRequestedRecommendations] =
    useState(!isEditMode); // 편집 모드일 때는 아직 요청 안 함
  const [hasScoreData, setHasScoreData] = useState(false);
  
  // 추천 받기 설정 (교과 선택, 개수)
  const availableSubjects = ["국어", "수학", "영어", "과학", "사회"];
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [recommendationCounts, setRecommendationCounts] = useState<Map<string, number>>(new Map());
  const [autoAssignContents, setAutoAssignContents] = useState(false); // 콘텐츠 자동 배정 옵션
  const [editingRangeIndex, setEditingRangeIndex] = useState<number | null>(
    null
  );
  const [editingRange, setEditingRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [studentContentSubjects, setStudentContentSubjects] = useState<
    Map<string, { title: string; subject_category: string | null }>
  >(new Map());
  const fetchedRecommendedContentIdsRef = useRef<Set<string>>(new Set());

  // 상세정보 관련 상태
  const [contentDetails, setContentDetails] = useState<
    Map<
      number,
      { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
    >
  >(new Map());
  const [startDetailId, setStartDetailId] = useState<Map<number, string>>(
    new Map()
  ); // 시작 범위 선택
  const [endDetailId, setEndDetailId] = useState<Map<number, string>>(
    new Map()
  ); // 끝 범위 선택
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());
  const cachedDetailsRef = useRef<
    Map<
      string,
      { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
    >
  >(new Map());

  // 필수 교과 설정 관련 상태
  const [detailSubjects, setDetailSubjects] = useState<Map<string, string[]>>(new Map());
  const [loadingDetailSubjects, setLoadingDetailSubjects] = useState<Set<string>>(new Set());

  // 교과별 추천 목록 조회 함수 (고도화 버전)
  const fetchRecommendationsWithSubjects = useCallback(async (
    subjects: string[],
    counts: Map<string, number>,
    autoAssign: boolean = false
  ) => {
    setLoading(true);
    try {
      // 교과별 추천 개수를 쿼리 파라미터로 전달
      const params = new URLSearchParams();
      subjects.forEach((subject) => {
        const count = counts.get(subject) || 1;
        params.append("subjects", subject);
        params.append(`count_${subject}`, String(count));
      });
      
      // 관리자 모드에서 다른 학생의 추천 콘텐츠를 조회할 때는 student_id 파라미터 추가
      if (propStudentId) {
        params.append("student_id", propStudentId);
      }
      
      const response = await fetch(`/api/recommended-master-contents?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        // API 응답 구조: { success: true, data: { recommendations } }
        const recommendations = result.data?.recommendations || [];
        
        console.log("[Step4RecommendedContents] 추천 결과:", {
          totalRecommendations: recommendations.length,
          requestedSubjects: subjects,
          requestedCounts: Object.fromEntries(counts),
          recommendations: recommendations.map((r: RecommendedContent) => ({
            id: r.id,
            title: r.title,
            subject_category: r.subject_category,
            contentType: r.contentType,
          })),
        });
        
        // 추천 콘텐츠가 부족한 경우 확인
        const recommendedBySubject = new Map<string, RecommendedContent[]>();
        recommendations.forEach((r: RecommendedContent) => {
          if (r.subject_category && subjects.includes(r.subject_category)) {
            if (!recommendedBySubject.has(r.subject_category)) {
              recommendedBySubject.set(r.subject_category, []);
            }
            recommendedBySubject.get(r.subject_category)!.push(r);
          }
        });
        
        console.log("[Step4RecommendedContents] 교과별 추천 분류:", {
          recommendedBySubject: Object.fromEntries(
            Array.from(recommendedBySubject.entries()).map(([k, v]) => [k, v.length])
          ),
        });
        
        // 부족한 교과 확인 및 메시지 표시
        const insufficientSubjects: string[] = [];
        subjects.forEach((subject) => {
          const requestedCount = counts.get(subject) || 1;
          const actualCount = recommendedBySubject.get(subject)?.length || 0;
          if (actualCount < requestedCount) {
            insufficientSubjects.push(`${subject} (요청: ${requestedCount}개, 실제: ${actualCount}개)`);
          }
        });
        
        console.log("[Step4RecommendedContents] 부족한 교과:", {
          insufficientSubjects,
        });
        
        // 추천 콘텐츠가 하나도 없는 경우
        if (recommendations.length === 0) {
          alert("추천 콘텐츠가 부족합니다. 다른 교과를 선택하거나 개수를 조정해주세요.");
          setLoading(false);
          return;
        }
        
        if (insufficientSubjects.length > 0) {
          const confirmMessage = `다음 교과의 추천 콘텐츠가 부족합니다:\n${insufficientSubjects.join("\n")}\n\n부족한 교과를 제외하고 추천 받으시겠습니까?`;
          const shouldContinue = window.confirm(confirmMessage);
          if (!shouldContinue) {
            setLoading(false);
            return;
          }
        }

        // 성적 데이터 존재 여부 확인
        const hasDetailedReasons = recommendations.some(
          (r: RecommendedContent) =>
            r.reason.includes("내신") ||
            r.reason.includes("모의고사") ||
            r.reason.includes("위험도") ||
            r.scoreDetails
        );
        setHasScoreData(hasDetailedReasons);

        // 중복 제거
        const existingIds = new Set([
          ...data.student_contents.map((c) => c.content_id),
          ...data.recommended_contents.map((c) => c.content_id),
        ]);

        // allRecommendedContents에서도 이미 추가된 콘텐츠 ID 수집 (추가 안전장치)
        // 추천 콘텐츠를 추가한 직후 다시 조회할 때를 대비
        const allRecommendedIds = new Set(
          allRecommendedContents
            .filter((c) => 
              data.recommended_contents.some((rc) => rc.content_id === c.id)
            )
            .map((c) => c.id)
        );

        // 학생 콘텐츠의 master_content_id 수집 (WizardData에서 직접 가져오기 우선)
        const studentMasterIds = new Set<string>();
        data.student_contents.forEach((c) => {
          const masterContentId = (c as any).master_content_id;
          if (masterContentId) {
            studentMasterIds.add(masterContentId);
          }
        });

        // WizardData에 master_content_id가 없는 경우에만 데이터베이스에서 조회
        const studentContentsWithoutMasterId = data.student_contents.filter(
          (c) => (c.content_type === "book" || c.content_type === "lecture") && !(c as any).master_content_id
        ) as Array<{ content_id: string; content_type: "book" | "lecture" }>;

        if (studentContentsWithoutMasterId.length > 0) {
          try {
            const { getStudentContentMasterIdsAction } = await import(
              "@/app/(student)/actions/getStudentContentMasterIds"
            );
            const masterIdResult = await getStudentContentMasterIdsAction(
              studentContentsWithoutMasterId
            );
            if (masterIdResult.success && masterIdResult.data) {
              masterIdResult.data.forEach((masterId, contentId) => {
                if (masterId) {
                  studentMasterIds.add(masterId);
                }
              });
            }
          } catch (error) {
            console.warn("[Step4RecommendedContents] master_content_id 조회 실패:", error);
          }
        }

        const recommendationsMap = new Map<string, RecommendedContent>();
        recommendations.forEach((c: RecommendedContent) => {
          recommendationsMap.set(c.id, c);
        });

        setAllRecommendedContents((prev) => {
          const merged = new Map<string, RecommendedContent>();
          prev.forEach((c) => merged.set(c.id, c));
          recommendationsMap.forEach((c, id) => {
            merged.set(id, c);
          });
          return Array.from(merged.values());
        });

        const filteredRecommendations = recommendations.filter(
          (r: RecommendedContent) => {
            // content_id로 직접 비교
            if (existingIds.has(r.id)) {
              return false;
            }
            // allRecommendedContents에서도 확인 (추가 안전장치)
            if (allRecommendedIds.has(r.id)) {
              return false;
            }
            // master_content_id로 비교 (학생이 마스터 콘텐츠를 등록한 경우)
            if (studentMasterIds.has(r.id)) {
              return false;
            }
            return true;
          }
        );

        setRecommendedContents(filteredRecommendations);
        setHasRequestedRecommendations(true);
        
        // 자동 배정 옵션이 활성화된 경우에만 자동으로 추가
        // 마스터 콘텐츠 상세 정보를 조회하여 범위 자동 설정
        if (autoAssign && filteredRecommendations.length > 0) {
          const contentsToAutoAdd: Array<{
            content_type: "book" | "lecture";
            content_id: string;
            start_range: number;
            end_range: number;
            title?: string;
            subject_category?: string;
          }> = [];

          for (const r of filteredRecommendations) {
            try {
              // 마스터 콘텐츠 상세 정보 조회
              const response = await fetch(
                `/api/master-content-details?contentType=${r.contentType}&contentId=${r.id}`
              );
              
              let startRange = 1;
              let endRange = 100;

              if (response.ok) {
                const result = await response.json();
                
                if (r.contentType === "book") {
                  const details = result.details || [];
                  if (details.length > 0) {
                    startRange = details[0].page_number || 1;
                    endRange = details[details.length - 1].page_number || 100;
                  }
                } else if (r.contentType === "lecture") {
                  const episodes = result.episodes || [];
                  if (episodes.length > 0) {
                    startRange = episodes[0].episode_number || 1;
                    endRange = episodes[episodes.length - 1].episode_number || 100;
                  }
                }
              }

              contentsToAutoAdd.push({
                content_type: r.contentType as "book" | "lecture",
                content_id: r.id,
                start_range: startRange,
                end_range: endRange,
                title: r.title,
                subject_category: r.subject_category || undefined,
              });
            } catch (error) {
              console.warn(`[Step4RecommendedContents] 콘텐츠 ${r.id} 상세 정보 조회 실패:`, error);
              // 조회 실패 시 기본값 사용
              contentsToAutoAdd.push({
                content_type: r.contentType as "book" | "lecture",
                content_id: r.id,
                start_range: 1,
                end_range: 100,
                title: r.title,
                subject_category: r.subject_category || undefined,
              });
            }
          }
          
          // 최대 9개 제한 확인
          const currentTotal = data.student_contents.length + data.recommended_contents.length;
          const toAdd = contentsToAutoAdd.length;
          
          if (currentTotal + toAdd > 9) {
            // 최대 개수 초과 시 자를 개수 계산
            const maxToAdd = 9 - currentTotal;
            const trimmed = contentsToAutoAdd.slice(0, maxToAdd);
            
            if (trimmed.length > 0) {
              onUpdate({
                recommended_contents: [
                  ...data.recommended_contents,
                  ...trimmed,
                ],
              });
              alert(`추천 콘텐츠 ${trimmed.length}개가 자동으로 추가되었습니다. (최대 9개 제한으로 ${toAdd - trimmed.length}개 제외됨)`);
            } else {
              alert("추가할 수 있는 콘텐츠가 없습니다. (최대 9개 제한)");
            }
          } else {
            onUpdate({
              recommended_contents: [
                ...data.recommended_contents,
                ...contentsToAutoAdd,
              ],
            });
            alert(`추천 콘텐츠 ${contentsToAutoAdd.length}개가 자동으로 추가되었습니다.`);
          }
        }
      }
    } catch (error) {
      const planGroupError = toPlanGroupError(
        error,
        PlanGroupErrorCodes.CONTENT_FETCH_FAILED
      );
      console.error("[Step4RecommendedContents] 추천 목록 조회 실패:", planGroupError);
      alert("추천 콘텐츠를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [data.student_contents, data.recommended_contents, allRecommendedContents, onUpdate]);

  // 추천 목록 조회 함수 (기존 버전, 편집 모드가 아닐 때 사용)
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      // 관리자 모드에서 다른 학생의 추천 콘텐츠를 조회할 때는 student_id 파라미터 추가
      const params = new URLSearchParams();
      if (propStudentId) {
        params.append("student_id", propStudentId);
      }
      const url = `/api/recommended-master-contents${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        // API 응답 구조: { success: true, data: { recommendations } }
        const recommendations = result.data?.recommendations || [];

        // 성적 데이터 존재 여부 확인 (추천 이유에 성적 정보가 포함되어 있는지)
        const hasDetailedReasons = recommendations.some(
          (r: RecommendedContent) =>
            r.reason.includes("내신") ||
            r.reason.includes("모의고사") ||
            r.reason.includes("위험도") ||
            r.scoreDetails
        );
        setHasScoreData(hasDetailedReasons);

        // Step 3(학생 콘텐츠)와 Step 4(추천 콘텐츠)에서 이미 선택한 콘텐츠와 중복 제거
        const existingIds = new Set([
          ...data.student_contents.map((c) => c.content_id),
          ...data.recommended_contents.map((c) => c.content_id),
        ]);

        // allRecommendedContents에서도 이미 추가된 콘텐츠 ID 수집 (추가 안전장치)
        // 추천 콘텐츠를 추가한 직후 다시 조회할 때를 대비
        // data.recommended_contents에 있는 콘텐츠는 allRecommendedContents에서도 제외
        const allRecommendedIds = new Set(
          allRecommendedContents
            .filter((c) => 
              data.recommended_contents.some((rc) => rc.content_id === c.id)
            )
            .map((c) => c.id)
        );

        // 학생 콘텐츠의 master_content_id 수집 (WizardData에서 직접 가져오기 우선)
        const studentMasterIds = new Set<string>();
        data.student_contents.forEach((c) => {
          const masterContentId = (c as any).master_content_id;
          if (masterContentId) {
            studentMasterIds.add(masterContentId);
          }
        });

        // WizardData에 master_content_id가 없는 경우에만 데이터베이스에서 조회
        const studentContentsWithoutMasterId = data.student_contents.filter(
          (c) => (c.content_type === "book" || c.content_type === "lecture") && !(c as any).master_content_id
        ) as Array<{ content_id: string; content_type: "book" | "lecture" }>;

        if (studentContentsWithoutMasterId.length > 0) {
          try {
            const { getStudentContentMasterIdsAction } = await import(
              "@/app/(student)/actions/getStudentContentMasterIds"
            );
            const masterIdResult = await getStudentContentMasterIdsAction(
              studentContentsWithoutMasterId
            );
            if (masterIdResult.success && masterIdResult.data) {
              // master_content_id가 있는 것만 Set에 추가
              masterIdResult.data.forEach((masterId, contentId) => {
                if (masterId) {
                  studentMasterIds.add(masterId);
                }
              });
            }
          } catch (error) {
            console.warn(
              "[Step4RecommendedContents] master_content_id 조회 실패:",
              error
            );
            // 에러가 발생해도 계속 진행 (기존 로직으로 fallback)
          }
        }

        // 원본 추천 목록 저장 (추가된 콘텐츠 정보 조회용)
        // 중요: 항상 최신 추천 목록으로 업데이트하여 불러온 콘텐츠 정보를 정확히 조회할 수 있도록 함
        const recommendationsMap = new Map<string, RecommendedContent>();
        recommendations.forEach((c: RecommendedContent) => {
          recommendationsMap.set(c.id, c);
        });

        // 기존 allRecommendedContents와 병합 (이미 추가된 콘텐츠 정보 유지)
        setAllRecommendedContents((prev) => {
          const merged = new Map<string, RecommendedContent>();
          // 기존 데이터 먼저 추가 (이미 추가된 콘텐츠 정보 보존)
          prev.forEach((c) => merged.set(c.id, c));
          // 새 추천 목록으로 업데이트 (같은 ID가 있으면 최신 정보로 덮어쓰기)
          recommendationsMap.forEach((c, id) => {
            merged.set(id, c);
          });
          return Array.from(merged.values());
        });

        // 중복 제거 (같은 콘텐츠가 이미 선택된 경우)
        // content_id와 master_content_id 모두 확인
        const filteredRecommendations = recommendations.filter(
          (r: RecommendedContent) => {
            // content_id로 직접 비교
            if (existingIds.has(r.id)) {
              return false;
            }
            // allRecommendedContents에서도 확인 (추가 안전장치)
            if (allRecommendedIds.has(r.id)) {
              return false;
            }
            // master_content_id로 비교 (학생이 마스터 콘텐츠를 등록한 경우)
            if (studentMasterIds.has(r.id)) {
              return false;
            }
            return true;
          }
        );

        setRecommendedContents(filteredRecommendations);
        setHasRequestedRecommendations(true);
      }
    } catch (error) {
      const planGroupError = toPlanGroupError(
        error,
        PlanGroupErrorCodes.CONTENT_FETCH_FAILED
      );
      console.error("[Step4RecommendedContents] 추천 목록 조회 실패:", planGroupError);
    } finally {
      setLoading(false);
    }
  }, [data.student_contents, data.recommended_contents, allRecommendedContents]);

  // 학생 콘텐츠의 과목 정보 조회 (추천 전 안내용)
  useEffect(() => {
    const fetchStudentContentSubjects = async () => {
      if (data.student_contents.length === 0) return;

      const subjectMap = new Map<
        string,
        { title: string; subject_category: string | null }
      >();

      for (const content of data.student_contents) {
        // WizardData에서 전달된 title과 subject_category를 우선적으로 사용
        const storedSubjectCategory = (content as any).subject_category;
        const storedTitle = (content as any).title;

        // title이나 subject_category 중 하나라도 있으면 저장된 정보 사용
        if (storedTitle || storedSubjectCategory) {
          subjectMap.set(content.content_id, {
            title: storedTitle || "알 수 없음",
            subject_category: storedSubjectCategory || null,
          });
          continue;
        }

        // 저장된 정보가 없으면 서버 액션으로 조회
        try {
          const result = await fetchContentMetadataAction(
            content.content_id,
            content.content_type
          );
          if (result.success && result.data) {
            subjectMap.set(content.content_id, {
              title: result.data.title || "알 수 없음",
              subject_category: result.data.subject_category || null,
            });
          } else {
            // 조회 실패 시 기본값
            subjectMap.set(content.content_id, {
              title: storedTitle || "알 수 없음",
              subject_category: storedSubjectCategory || null,
            });
          }
        } catch (error) {
          const planGroupError = toPlanGroupError(
            error,
            PlanGroupErrorCodes.CONTENT_FETCH_FAILED,
            { contentId: content.content_id }
          );
          console.error("[Step4RecommendedContents] 콘텐츠 메타데이터 조회 실패:", planGroupError);
          subjectMap.set(content.content_id, {
            title: storedTitle || "알 수 없음",
            subject_category: storedSubjectCategory || null,
          });
        }
      }

      setStudentContentSubjects(subjectMap);
    };

    fetchStudentContentSubjects();
  }, [data.student_contents]);

  // 편집 모드에서 이미 추가된 추천 콘텐츠 정보 조회
  useEffect(() => {
    const fetchExistingRecommendedContents = async () => {
      if (!isEditMode || data.recommended_contents.length === 0) return;

      const contentsMap = new Map<string, RecommendedContent>();

      for (const content of data.recommended_contents) {
        // 이미 조회한 콘텐츠는 스킵
        if (fetchedRecommendedContentIdsRef.current.has(content.content_id)) {
          continue;
        }

        // 저장된 정보가 있으면 사용
        const storedTitle = (content as any).title;
        const storedSubjectCategory = (content as any).subject_category;

        if (storedTitle && storedSubjectCategory) {
          contentsMap.set(content.content_id, {
            id: content.content_id,
            contentType: content.content_type,
            title: storedTitle,
            subject_category: storedSubjectCategory,
            subject: (content as any).subject || null,
            semester: (content as any).semester || null,
            revision: (content as any).revision || null,
            publisher: (content as any).publisher || null,
            platform: (content as any).platform || null,
            difficulty_level: (content as any).difficulty_level || null,
            reason: (content as any).recommendation_reason || "",
            priority: 0,
          });
          continue;
        }

        // 저장된 정보가 없으면 서버 액션으로 조회
        try {
          const result = await fetchContentMetadataAction(
            content.content_id,
            content.content_type
          );
          if (result.success && result.data) {
            contentsMap.set(content.content_id, {
              id: content.content_id,
              contentType: content.content_type,
              title: result.data.title || "알 수 없음",
              subject_category: result.data.subject_category || null,
              subject: result.data.subject || null,
              semester: result.data.semester || null,
              revision: result.data.revision || null,
              publisher: result.data.publisher || null,
              platform: result.data.platform || null,
              difficulty_level: result.data.difficulty_level || null,
              reason: (content as any).recommendation_reason || "",
              priority: 0,
            });
          } else {
            // 조회 실패 시 저장된 정보 또는 기본값 사용
            contentsMap.set(content.content_id, {
              id: content.content_id,
              contentType: content.content_type,
              title: storedTitle || "알 수 없음",
              subject_category: storedSubjectCategory || null,
              subject: (content as any).subject || null,
              semester: (content as any).semester || null,
              revision: (content as any).revision || null,
              publisher: (content as any).publisher || null,
              platform: (content as any).platform || null,
              difficulty_level: (content as any).difficulty_level || null,
              reason: (content as any).recommendation_reason || "",
              priority: 0,
            });
          }
        } catch (error) {
          const planGroupError = toPlanGroupError(
            error,
            PlanGroupErrorCodes.CONTENT_FETCH_FAILED,
            { contentId: content.content_id }
          );
          console.error("[Step4RecommendedContents] 추천 콘텐츠 정보 조회 실패:", planGroupError);
          // 에러 발생 시 저장된 정보 또는 기본값 사용
          contentsMap.set(content.content_id, {
            id: content.content_id,
            contentType: content.content_type,
            title: storedTitle || "알 수 없음",
            subject_category: storedSubjectCategory || null,
            subject: (content as any).subject || null,
            semester: (content as any).semester || null,
            revision: (content as any).revision || null,
            publisher: (content as any).publisher || null,
            platform: (content as any).platform || null,
            difficulty_level: (content as any).difficulty_level || null,
            reason: (content as any).recommendation_reason || "",
            priority: 0,
          });
        }
      }

      // allRecommendedContents에 추가
      if (contentsMap.size > 0) {
        // 조회한 콘텐츠 ID 추적
        contentsMap.forEach((_, id) => {
          fetchedRecommendedContentIdsRef.current.add(id);
        });

        setAllRecommendedContents((prev) => {
          const merged = new Map<string, RecommendedContent>();
          // 기존 데이터 먼저 추가
          prev.forEach((c) => merged.set(c.id, c));
          // 새로 조회한 데이터 추가
          contentsMap.forEach((c, id) => {
            merged.set(id, c);
          });
          return Array.from(merged.values());
        });
      }
    };

    fetchExistingRecommendedContents();
  }, [isEditMode, data.recommended_contents]);

  // 추천 목록 자동 조회 (생성 모드일 때만)
  useEffect(() => {
    if (!isEditMode) {
      fetchRecommendations();
    }
  }, [isEditMode, fetchRecommendations]);

  // 전체 선택된 콘텐츠의 subject_category 집합 (학생 + 추천 + 현재 선택 중)
  const selectedSubjectCategories = new Set<string>();

  // 1. 학생 콘텐츠의 subject_category (저장된 값 우선, 없으면 조회한 값 사용)
  data.student_contents.forEach((sc) => {
    const storedSubjectCategory = (sc as any).subject_category;
    const fetchedSubjectCategory =
      studentContentSubjects.get(sc.content_id)?.subject_category;
    const subjectCategory = storedSubjectCategory || fetchedSubjectCategory;
    if (subjectCategory) {
      selectedSubjectCategories.add(subjectCategory);
    }
  });

  // 2. 현재 선택 중인 추천 콘텐츠의 subject_category
  Array.from(selectedContentIds).forEach((id) => {
    const content = recommendedContents.find((c) => c.id === id);
    if (content?.subject_category) {
      selectedSubjectCategories.add(content.subject_category);
    }
  });

  // 3. 이미 추가된 추천 콘텐츠의 subject_category
  // 우선순위: 1) 저장된 subject_category, 2) allRecommendedContents에서 조회
  data.recommended_contents.forEach((rc) => {
    const subjectCategory =
      (rc as any).subject_category ||
      allRecommendedContents.find((c) => c.id === rc.content_id)
        ?.subject_category;
    if (subjectCategory) {
      selectedSubjectCategories.add(subjectCategory);
    }
  });

  // 필수 과목 검증 (템플릿 설정에 따라 동적 처리)
  // enable_required_subjects_validation이 true이고 required_subjects가 설정된 경우에만 검증
  const requiredSubjects =
    data.subject_constraints?.enable_required_subjects_validation &&
    data.subject_constraints?.required_subjects &&
    data.subject_constraints.required_subjects.length > 0
      ? data.subject_constraints.required_subjects
      : [];
  
  // 필수 과목의 subject_category 배열 (렌더링 및 검증용)
  const requiredSubjectCategories = requiredSubjects.map((req) => req.subject_category);
  
  // 선택된 콘텐츠를 교과/과목별로 카운트
  const contentCountBySubject = new Map<string, number>();
  
  // 학생 콘텐츠 카운트
  data.student_contents.forEach((sc) => {
    const subjectCategory = (sc as any).subject_category;
    const subject = (sc as any).subject;
    if (subjectCategory) {
      const key = subject ? `${subjectCategory}:${subject}` : subjectCategory;
      contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
    }
  });

  // 추천 콘텐츠 카운트
  data.recommended_contents.forEach((rc) => {
    const subjectCategory =
      (rc as any).subject_category ||
      allRecommendedContents.find((c) => c.id === rc.content_id)?.subject_category;
    const subject = (rc as any).subject;
    if (subjectCategory) {
      const key = subject ? `${subjectCategory}:${subject}` : subjectCategory;
      contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
    }
  });

  // 현재 선택 중인 추천 콘텐츠 카운트
  Array.from(selectedContentIds).forEach((id) => {
    const content = recommendedContents.find((c) => c.id === id);
    if (content?.subject_category) {
      const key = content.subject_category; // 추천 콘텐츠는 세부 과목 정보가 없을 수 있음
      contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
    }
  });

  // 필수 과목 검증
  const missingRequiredSubjects: Array<{ name: string; current: number; required: number }> = [];
  
  requiredSubjects.forEach((req) => {
    let count = 0;
    
    if (req.subject) {
      // 세부 과목이 지정된 경우
      const exactKey = `${req.subject_category}:${req.subject}`;
      count = contentCountBySubject.get(exactKey) || 0;
    } else {
      // 교과만 지정된 경우: 해당 교과의 모든 콘텐츠 카운트
      contentCountBySubject.forEach((cnt, key) => {
        if (key.startsWith(req.subject_category + ":") || key === req.subject_category) {
          count += cnt;
        }
      });
    }
    
    if (count < req.min_count) {
      const displayName = req.subject 
        ? `${req.subject_category} - ${req.subject}` 
        : req.subject_category;
      missingRequiredSubjects.push({
        name: displayName,
        current: count,
        required: req.min_count,
      });
    }
  });

  // ProgressIndicator용 필수과목 정보 생성
  const progressRequiredSubjects = requiredSubjects.map((req) => {
    let count = 0;
    
    if (req.subject) {
      // 세부 과목이 지정된 경우
      const exactKey = `${req.subject_category}:${req.subject}`;
      count = contentCountBySubject.get(exactKey) || 0;
    } else {
      // 교과만 지정된 경우: 해당 교과의 모든 콘텐츠 카운트
      contentCountBySubject.forEach((cnt, key) => {
        if (key.startsWith(req.subject_category + ":") || key === req.subject_category) {
          count += cnt;
        }
      });
    }
    
    const displayName = req.subject 
      ? `${req.subject_category} - ${req.subject}` 
      : req.subject_category;
    
    return {
      subject: displayName,
      selected: count >= req.min_count,
    };
  });

  const toggleContentSelection = (contentId: string) => {
    const newSet = new Set(selectedContentIds);
    if (newSet.has(contentId)) {
      newSet.delete(contentId);
    } else {
      // 최대 9개 제한 (학생 + 추천 합쳐서)
      const totalSelected =
        data.student_contents.length +
        data.recommended_contents.length +
        newSet.size;
      if (totalSelected >= 9) {
        alert("플랜 대상 콘텐츠는 최대 9개까지 가능합니다.");
        return;
      }
      // 중복 체크 (학생 콘텐츠와 추천 콘텐츠 모두 확인)
      const isDuplicate =
        data.student_contents.some((c) => c.content_id === contentId) ||
        data.recommended_contents.some((c) => c.content_id === contentId);
      if (isDuplicate) {
        alert("이미 선택된 콘텐츠입니다.");
        return;
      }
      newSet.add(contentId);
    }
    setSelectedContentIds(newSet);
  };

  // 편집 중인 콘텐츠의 상세정보 조회
  useEffect(() => {
    if (editingRangeIndex === null) {
      return;
    }

    const content = data.recommended_contents[editingRangeIndex];
    if (!content) return;

    const fetchDetails = async () => {
      // 이미 조회한 경우 캐시에서 가져오기
      if (cachedDetailsRef.current.has(content.content_id)) {
        const cached = cachedDetailsRef.current.get(content.content_id)!;
        setContentDetails(new Map([[editingRangeIndex, cached]]));
        return;
      }

      setLoadingDetails(new Set([editingRangeIndex]));

      try {
        const response = await fetch(
          `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`
        );
        if (response.ok) {
          const result = await response.json();
          const detailData =
            content.content_type === "book"
              ? { details: result.details || [], type: "book" as const }
              : { details: result.episodes || [], type: "lecture" as const };

          // 캐시에 저장
          cachedDetailsRef.current.set(content.content_id, detailData);
          setContentDetails(new Map([[editingRangeIndex, detailData]]));

          // 현재 범위에 해당하는 항목들을 자동 선택
          const currentRange = {
            start: content.start_range,
            end: content.end_range,
          };

          if (detailData.type === "book") {
            const details = detailData.details as BookDetail[];
            const startDetail = details.find(
              (d) => d.page_number === currentRange.start
            );
            const endDetail = details.find(
              (d) => d.page_number === currentRange.end
            );
            if (startDetail)
              setStartDetailId(new Map([[editingRangeIndex, startDetail.id]]));
            if (endDetail)
              setEndDetailId(new Map([[editingRangeIndex, endDetail.id]]));
          } else {
            const episodes = detailData.details as LectureEpisode[];
            const startEpisode = episodes.find(
              (e) => e.episode_number === currentRange.start
            );
            const endEpisode = episodes.find(
              (e) => e.episode_number === currentRange.end
            );
            if (startEpisode)
              setStartDetailId(new Map([[editingRangeIndex, startEpisode.id]]));
            if (endEpisode)
              setEndDetailId(new Map([[editingRangeIndex, endEpisode.id]]));
          }
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error("[Step4RecommendedContents] 상세정보 조회 실패:", planGroupError);
      } finally {
        setLoadingDetails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(editingRangeIndex);
          return newSet;
        });
      }
    };

    fetchDetails();
  }, [editingRangeIndex, data.recommended_contents]);

  // 시작/끝 범위 선택 시 범위 자동 계산
  useEffect(() => {
    if (editingRangeIndex === null) return;

    const content = data.recommended_contents[editingRangeIndex];
    if (!content) return;

    const contentInfo = contentDetails.get(editingRangeIndex);
    const startId = startDetailId.get(editingRangeIndex);
    const endId = endDetailId.get(editingRangeIndex);

    if (!contentInfo || !startId || !endId) return;

    let newStart: number | null = null;
    let newEnd: number | null = null;

    if (contentInfo.type === "book") {
      const details = contentInfo.details as BookDetail[];
      const startDetail = details.find((d) => d.id === startId);
      const endDetail = details.find((d) => d.id === endId);
      if (startDetail && endDetail) {
        newStart = startDetail.page_number;
        
        // 끝 범위: 끝 항목의 다음 항목의 페이지 - 1
        const endIndex = details.findIndex((d) => d.id === endId);
        if (endIndex !== -1 && endIndex < details.length - 1) {
          // 다음 항목이 있으면 그 항목의 페이지 - 1
          newEnd = details[endIndex + 1].page_number - 1;
        } else {
          // 끝 항목이 마지막 항목이면: 시작 범위부터 총 페이지까지
          // 총 페이지는 content.end_range 또는 details의 마지막 항목의 페이지 번호 중 큰 값 사용
          const totalPages = Math.max(
            content.end_range || 0,
            details.length > 0 ? details[details.length - 1].page_number : 0
          );
          newEnd = totalPages;
        }
        
        if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
      }
    } else {
      // 강의는 끝 항목의 회차를 그대로 사용 (교재와 다른 방식)
      const episodes = contentInfo.details as LectureEpisode[];
      const startEpisode = episodes.find((e) => e.id === startId);
      const endEpisode = episodes.find((e) => e.id === endId);
      if (startEpisode && endEpisode) {
        newStart = startEpisode.episode_number;
        newEnd = endEpisode.episode_number;
        if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
      }
    }

    if (newStart !== null && newEnd !== null) {
      setEditingRange({
        start: String(newStart),
        end: String(newEnd),
      });
    }
  }, [
    startDetailId,
    endDetailId,
    contentDetails,
    editingRangeIndex,
    data.recommended_contents,
  ]);

  const setStartRange = (index: number, detailId: string) => {
    const newMap = new Map(startDetailId);
    newMap.set(index, detailId);
    setStartDetailId(newMap);
  };

  const setEndRange = (index: number, detailId: string) => {
    const newMap = new Map(endDetailId);
    newMap.set(index, detailId);
    setEndDetailId(newMap);
  };

  const addSelectedContents = async () => {
    if (selectedContentIds.size === 0) {
      alert("추천 콘텐츠를 선택해주세요.");
      return;
    }

    // 필수 과목 검증 (템플릿 설정에 따라 검증)
    // enable_required_subjects_validation이 true이고 required_subjects가 설정된 경우에만 검증
    if (
      requiredSubjects.length > 0 &&
      missingRequiredSubjects.length > 0
    ) {
      const missingList = missingRequiredSubjects
        .map((m) => `${m.name} (현재 ${m.current}개, 필요 ${m.required}개)`)
        .join("\n");
      alert(
        `다음 필수 과목의 최소 개수 조건을 만족하지 않습니다:\n${missingList}`
      );
      return;
    }

    // 최대 9개 제한 검증
    const totalSelected =
      data.student_contents.length +
      data.recommended_contents.length +
      selectedContentIds.size;
    if (totalSelected > 9) {
      alert("플랜 대상 콘텐츠는 최대 9개까지 가능합니다.");
      return;
    }

    // 선택된 콘텐츠를 추천 콘텐츠에 추가
    // 마스터 콘텐츠 정보를 조회하여 자동으로 범위 설정
    // 제목 및 과목 정보도 함께 저장하여 "알 수 없음" 문제 방지
    const contentsToAdd: Array<{
      content_type: "book" | "lecture";
      content_id: string;
      master_content_id?: string; // 마스터 콘텐츠 ID 저장
      start_range: number;
      end_range: number;
      title?: string; // 제목 정보 저장
      subject_category?: string; // 과목 카테고리 저장 (필수 과목 검증용)
    }> = [];

    for (const contentId of selectedContentIds) {
      // recommendedContents 또는 allRecommendedContents에서 찾기
      const content =
        recommendedContents.find((c) => c.id === contentId) ||
        allRecommendedContents.find((c) => c.id === contentId);
      if (!content) continue;

      // 마스터 콘텐츠 정보 조회
      try {
        const response = await fetch(
          `/api/master-content-info?content_type=${content.contentType}&content_id=${contentId}`
        );
        if (response.ok) {
          const info = await response.json();
          const defaultEndRange =
            content.contentType === "book"
              ? info.total_pages || 100
              : info.total_episodes || 10;

          contentsToAdd.push({
            content_type: content.contentType,
            content_id: content.id, // 마스터 콘텐츠 ID
            master_content_id: content.id, // 추천 콘텐츠는 content_id와 동일 (마스터 콘텐츠 ID)
            start_range: 1,
            end_range: defaultEndRange,
            title: content.title, // 제목 정보 저장
            subject_category: content.subject_category || undefined, // 과목 카테고리 저장
          });
        } else {
          // 조회 실패 시 기본값 사용
          contentsToAdd.push({
            content_type: content.contentType,
            content_id: content.id,
            master_content_id: content.id, // 추천 콘텐츠는 content_id와 동일 (마스터 콘텐츠 ID)
            start_range: 1,
            end_range: content.contentType === "book" ? 100 : 10,
            title: content.title, // 제목 정보 저장
          });
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error("[Step4RecommendedContents] 마스터 콘텐츠 정보 조회 실패:", planGroupError);
        // 에러 시 기본값 사용
        contentsToAdd.push({
          content_type: content.contentType,
          content_id: content.id,
          master_content_id: content.id, // 추천 콘텐츠는 content_id와 동일 (마스터 콘텐츠 ID)
          start_range: 1,
          end_range: content.contentType === "book" ? 100 : 10,
          title: content.title, // 제목 정보 저장
        });
      }
    }

    // 추천 콘텐츠에 추가
    onUpdate({
      recommended_contents: [...data.recommended_contents, ...contentsToAdd],
    });

    // 추가된 콘텐츠를 추천 목록에서 제거
    const addedContentIds = new Set(contentsToAdd.map((c) => c.content_id));
    setRecommendedContents((prev) =>
      prev.filter((c) => !addedContentIds.has(c.id))
    );
    
    // allRecommendedContents에서도 제거 (다시 추천 목록 조회 시 중복 방지)
    setAllRecommendedContents((prev) =>
      prev.filter((c) => !addedContentIds.has(c.id))
    );

    // 선택 초기화
    setSelectedContentIds(new Set());
  };

  // 필수 교과 설정 핸들러
  // 세부 과목 불러오기
  const handleLoadDetailSubjects = useCallback(async (category: string) => {
    if (detailSubjects.has(category)) return;
    
    setLoadingDetailSubjects(prev => new Set([...prev, category]));
    
    try {
      const subjects = await fetchDetailSubjects(category);
      setDetailSubjects(prev => new Map([...prev, [category, subjects]]));
    } catch (error) {
      console.error("Error loading detail subjects:", error);
    } finally {
      setLoadingDetailSubjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(category);
        return newSet;
      });
    }
  }, [detailSubjects]);

  // 필수 교과 추가
  const handleAddRequiredSubject = useCallback(() => {
    const currentConstraints = data.subject_constraints || {
      enable_required_subjects_validation: true,
      required_subjects: [],
      excluded_subjects: [],
      constraint_handling: "warning"
    };
    
    const newRequirement = {
      subject_category: "",
      min_count: 1
    };
    
    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        enable_required_subjects_validation: true,
        required_subjects: [...(currentConstraints.required_subjects || []), newRequirement]
      }
    });
  }, [data.subject_constraints, onUpdate]);

  // 필수 교과 업데이트
  const handleRequiredSubjectUpdate = useCallback((
    index: number, 
    updated: Partial<{ subject_category: string; subject?: string; min_count: number }>
  ) => {
    if (!data.subject_constraints) return;
    
    const currentConstraints = data.subject_constraints;
    const newRequirements = [...currentConstraints.required_subjects!];
    newRequirements[index] = { ...newRequirements[index], ...updated };
    
    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        required_subjects: newRequirements
      }
    });
  }, [data.subject_constraints, onUpdate]);

  // 필수 교과 삭제
  const handleRequiredSubjectRemove = useCallback((index: number) => {
    if (!data.subject_constraints) return;
    
    const currentConstraints = data.subject_constraints;
    const newRequirements = currentConstraints.required_subjects!.filter((_, i) => i !== index);
    
    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        required_subjects: newRequirements,
        enable_required_subjects_validation: newRequirements.length > 0
      }
    });
  }, [data.subject_constraints, onUpdate]);

  // 제약 조건 처리 방식 변경
  const handleConstraintHandlingChange = useCallback((handling: "strict" | "warning" | "auto_fix") => {
    if (!data.subject_constraints) return;
    
    const currentConstraints = data.subject_constraints;
    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        constraint_handling: handling
      }
    });
  }, [data.subject_constraints, onUpdate]);

  // 과목별 그룹화
  const contentsBySubject = new Map<string, RecommendedContent[]>();
  recommendedContents.forEach((content) => {
    const subject = content.subject_category || "기타";
    if (!contentsBySubject.has(subject)) {
      contentsBySubject.set(subject, []);
    }
    contentsBySubject.get(subject)!.push(content);
  });

  // 필수 과목 우선 정렬
  const sortedSubjects = Array.from(contentsBySubject.keys()).sort((a, b) => {
    const aIndex = requiredSubjectCategories.indexOf(a);
    const bIndex = requiredSubjectCategories.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  const studentCount = data.student_contents.length;
  const recommendedCount = data.recommended_contents.length;
  const totalCount = studentCount + recommendedCount;
  const canAddMore = totalCount < 9;
  const remainingSlots = 9 - totalCount;

  // 선택된 콘텐츠의 과목 목록 추출 (캠프 모드에서 취약과목/전략과목 설정용)
  const allContentSubjects = new Set<string>();
  data.student_contents.forEach((sc) => {
    const subjectCategory = (sc as any).subject_category;
    if (subjectCategory) {
      allContentSubjects.add(subjectCategory);
    }
  });
  data.recommended_contents.forEach((rc) => {
    const subjectCategory =
      (rc as any).subject_category ||
      allRecommendedContents.find((c) => c.id === rc.content_id)?.subject_category;
    if (subjectCategory) {
      allContentSubjects.add(subjectCategory);
    }
  });

  return (
    <div className="space-y-6">
      {/* 필수 교과 설정 섹션 - 상단으로 이동 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">필수 교과 설정</h2>
          <button
            type="button"
            onClick={() => onUpdate({ show_required_subjects_ui: !data.show_required_subjects_ui })}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            {data.show_required_subjects_ui ? "숨기기" : "설정하기"}
          </button>
        </div>
        
        {data.show_required_subjects_ui && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다.
              세부 과목까지 지정하여 더 정확한 제약 조건을 설정할 수 있습니다.
            </p>
            
            {/* 필수 교과 목록 */}
            {(data.subject_constraints?.required_subjects || []).length > 0 && (
              <div className="space-y-3">
                {(data.subject_constraints?.required_subjects || []).map((req, index) => (
                  <RequiredSubjectItem
                    key={index}
                    requirement={req}
                    index={index}
                    availableSubjects={availableSubjects}
                    availableDetailSubjects={detailSubjects.get(req.subject_category) || []}
                    loadingDetailSubjects={loadingDetailSubjects.has(req.subject_category)}
                    onUpdate={(updated) => handleRequiredSubjectUpdate(index, updated)}
                    onRemove={() => handleRequiredSubjectRemove(index)}
                    onLoadDetailSubjects={handleLoadDetailSubjects}
                  />
                ))}
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
                onChange={(e) => handleConstraintHandlingChange(e.target.value as "strict" | "warning" | "auto_fix")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              >
                <option value="warning">경고 (권장) - 경고만 표시하고 진행</option>
                <option value="strict">엄격 (필수) - 조건 미충족 시 진행 불가</option>
                <option value="auto_fix">자동 보정 - 시스템이 자동으로 보정</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {data.subject_constraints?.constraint_handling === "warning" && "조건 미충족 시 경고를 표시하지만 다음 단계로 진행할 수 있습니다."}
                {data.subject_constraints?.constraint_handling === "strict" && "조건을 반드시 충족해야 다음 단계로 진행할 수 있습니다."}
                {data.subject_constraints?.constraint_handling === "auto_fix" && "시스템이 자동으로 필요한 콘텐츠를 추천합니다."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            서비스 추천 콘텐츠
          </h2>
          <p className="text-sm text-gray-500">
            성적 데이터를 기반으로 추천된 교재와 강의를 선택하세요. (최대 9개,
            국어/수학/영어 각 1개 이상 필수)
          </p>
        </div>

        {/* 콘텐츠 선택 진행률 */}
        <div className="mb-6">
          <ProgressIndicator
            current={totalCount}
            max={9}
            requiredSubjects={progressRequiredSubjects}
            showWarning={missingRequiredSubjects.length > 0}
            warningMessage={
              missingRequiredSubjects.length > 0
                ? `다음 필수 과목의 최소 개수 조건을 만족하지 않습니다: ${missingRequiredSubjects.map((m) => `${m.name} (현재 ${m.current}개 / 필요 ${m.required}개)`).join(", ")}`
                : undefined
            }
          />
        </div>
        
        {/* 필수 과목 검증 안내 (상단 표시) */}
        {requiredSubjects.length > 0 && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                필수 과목 검증
              </h3>
              {missingRequiredSubjects.length === 0 && (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  ✅ 모든 필수 과목 충족
                </span>
              )}
            </div>
            <div className="space-y-2">
              {requiredSubjects.map((req) => {
                let count = 0;
                if (req.subject) {
                  const exactKey = `${req.subject_category}:${req.subject}`;
                  count = contentCountBySubject.get(exactKey) || 0;
                } else {
                  contentCountBySubject.forEach((cnt, key) => {
                    if (key.startsWith(req.subject_category + ":") || key === req.subject_category) {
                      count += cnt;
                    }
                  });
                }
                const displayName = req.subject 
                  ? `${req.subject_category} - ${req.subject}` 
                  : req.subject_category;
                const isSatisfied = count >= req.min_count;
                
                return (
                  <div
                    key={req.subject_category}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{displayName}</span>
                      {req.subject && (
                        <span className="text-xs text-gray-500">(세부 과목 지정)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        {count}개 / 최소 {req.min_count}개
                      </span>
                      {isSatisfied ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          ✓ 충족
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          ✗ 미충족
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {missingRequiredSubjects.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  ⚠️ 다음 필수 과목의 최소 개수 조건을 만족하지 않습니다:
                </p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-amber-700">
                  {missingRequiredSubjects.map((m, idx) => (
                    <li key={idx}>
                      {m.name}: 현재 {m.current}개 / 필요 {m.required}개
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-700">
                  추천 콘텐츠에서 위 과목을 선택하시면 더 효과적인 학습 플랜을 만들 수 있습니다.
                </p>
              </div>
            )}
          </div>
        )}
        {/* 진행 바 */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(totalCount / 9) * 100}%` }}
            />
          </div>
        </div>
        {!hasScoreData && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              💡 성적 데이터를 입력하시면 더 정확한 맞춤형 추천을 받을 수
              있습니다.
            </p>
          </div>
        )}
        {!canAddMore && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              ⚠️ 최대 9개의 콘텐츠를 모두 선택하셨습니다.
            </p>
          </div>
        )}
        {canAddMore && totalCount > 0 && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-800">
              ✅ {remainingSlots}개의 콘텐츠를 더 선택할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      {/* 학생 콘텐츠 분석 안내 (추천 전에도 표시) */}
      {data.student_contents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            현재 추가된 학생 콘텐츠 분석
          </h3>
          <div className="space-y-2">
            {/* 추가된 학생 콘텐츠 목록 */}
            <div className="space-y-1">
              {data.student_contents.map((content, index) => {
                // 우선순위: 1) WizardData에서 전달된 정보, 2) studentContentSubjects Map, 3) fallback
                const storedTitle = (content as any).title;
                const storedSubjectCategory = (content as any).subject_category;
                const masterContentId = (content as any).master_content_id;
                const contentInfo = studentContentSubjects.get(content.content_id);
                
                const title = storedTitle || contentInfo?.title || "알 수 없음";
                const subjectCategory = storedSubjectCategory || contentInfo?.subject_category || null;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">{title}</span>
                      {subjectCategory && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {subjectCategory}
                        </span>
                      )}
                      {!subjectCategory && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          과목 미지정
                        </span>
                      )}
                      {masterContentId && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          📦 마스터에서 가져옴
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {content.content_type === "book" ? "📚 교재" : "🎧 강의"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 필수 과목 안내 (템플릿 설정에 따라 표시) */}
            {requiredSubjects.length > 0 && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-xs font-semibold text-gray-700">
                  필수 과목 현황
                </div>
                <div className="space-y-1">
                  {requiredSubjects.map((req) => {
                    const subjectCategory = req.subject_category;
                    const isIncluded = selectedSubjectCategories.has(subjectCategory);
                    return (
                      <div
                        key={subjectCategory}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-700">{subjectCategory}</span>
                        {isIncluded ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            ✓ 포함됨
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            ✗ 누락됨
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {missingRequiredSubjects.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs font-medium text-amber-800">
                      ⚠️ 다음 필수 과목의 최소 개수 조건을 만족하지 않습니다:
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-amber-700">
                      {missingRequiredSubjects.map((m, idx) => (
                        <li key={idx}>
                          {m.name}: 현재 {m.current}개 / 필요 {m.required}개
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-amber-700">
                      추천 콘텐츠에서 위 과목을 선택하시면 더 효과적인 학습 플랜을 만들 수 있습니다.
                    </p>
                  </div>
                )}
                {missingRequiredSubjects.length === 0 && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-xs font-medium text-green-800">
                      ✅ 모든 필수 과목이 포함되어 있습니다.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 이미 추가된 추천 콘텐츠 목록 (항상 표시) */}
      {data.recommended_contents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>
              추가된 추천 콘텐츠 ({data.recommended_contents.length}개)
            </span>
          </div>
          {data.recommended_contents.map((content, index) => {
            // 제목 및 과목 정보 조회
            // 우선순위: 1) 저장된 title/subject_category, 2) allRecommendedContents에서 조회, 3) API로 재조회, 4) fallback
            let title = (content as any).title;
            let subjectCategory = (content as any).subject_category;

            // allRecommendedContents에서 조회
            const recommendedContent = allRecommendedContents.find(
              (c) => c.id === content.content_id
            );
            if (recommendedContent) {
              title = title || recommendedContent.title;
              subjectCategory =
                subjectCategory ||
                recommendedContent.subject_category ||
                undefined;
            }

            // 여전히 없으면 "알 수 없음"
            if (!title) {
              title = "알 수 없음";
            }

            const isEditing = editingRangeIndex === index;
            const contentInfo = contentDetails.get(index);
            const isLoading = loadingDetails.has(index);
            const selectedStartId = startDetailId.get(index);
            const selectedEndId = endDetailId.get(index);

            // allRecommendedContents에서 상세 정보 조회
            const recommendedContentDetail = allRecommendedContents.find(
              (c) => c.id === content.content_id
            );

            return (
              <div
                key={index}
                className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {title}
                        </div>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          추천 콘텐츠
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {content.content_type === "book" && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                            📚 교재
                          </span>
                        )}
                        {content.content_type === "lecture" && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                            🎧 강의
                          </span>
                        )}
                        {recommendedContentDetail?.subject && (
                          <>
                            <span>·</span>
                            <span>{recommendedContentDetail.subject}</span>
                          </>
                        )}
                        {recommendedContentDetail?.semester && (
                          <>
                            <span>·</span>
                            <span>{recommendedContentDetail.semester}</span>
                          </>
                        )}
                        {recommendedContentDetail?.revision && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-indigo-600">
                              {recommendedContentDetail.revision} 개정판
                            </span>
                          </>
                        )}
                        {recommendedContentDetail?.difficulty_level && (
                          <>
                            <span>·</span>
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                              {recommendedContentDetail.difficulty_level}
                            </span>
                          </>
                        )}
                        {recommendedContentDetail?.publisher && (
                          <>
                            <span>·</span>
                            <span>{recommendedContentDetail.publisher}</span>
                          </>
                        )}
                        {recommendedContentDetail?.platform && (
                          <>
                            <span>·</span>
                            <span>{recommendedContentDetail.platform}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>·</span>
                    {isEditing ? (
                      <div className="flex-1 space-y-3">
                        {/* 상세정보가 있는 경우 시작/끝 범위 각각 선택 */}
                        {isLoading ? (
                          <div className="text-xs text-gray-500">
                            상세 정보를 불러오는 중...
                          </div>
                        ) : contentInfo && contentInfo.details.length > 0 ? (
                          <div className="space-y-3">
                            {/* 시작 범위 선택 */}
                            <div>
                              <div className="mb-2 text-xs font-medium text-gray-700">
                                시작 범위 선택
                              </div>
                              <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                <div className="space-y-1">
                                  {contentInfo.type === "book"
                                    ? (contentInfo.details as BookDetail[]).map(
                                        (detail) => {
                                          const isSelected =
                                            selectedStartId === detail.id;
                                          return (
                                            <label
                                              key={detail.id}
                                              className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                                isSelected
                                                  ? "border-blue-500 bg-blue-50"
                                                  : "border-gray-200 hover:bg-gray-50"
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                name={`start-recommended-${index}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  setStartRange(
                                                    index,
                                                    detail.id
                                                  )
                                                }
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">
                                                  페이지 {detail.page_number}
                                                </span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-500">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit &&
                                                      ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        }
                                      )
                                    : (
                                        contentInfo.details as LectureEpisode[]
                                      ).map((episode) => {
                                        const isSelected =
                                          selectedStartId === episode.id;
                                        return (
                                          <label
                                            key={episode.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                              isSelected
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`start-recommended-${index}`}
                                              checked={isSelected}
                                              onChange={() =>
                                                setStartRange(index, episode.id)
                                              }
                                              className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex-1 text-xs">
                                              <span className="font-medium">
                                                {episode.episode_number}회차
                                              </span>
                                              {episode.episode_title && (
                                                <span className="ml-2 text-gray-500">
                                                  · {episode.episode_title}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                </div>
                              </div>
                            </div>

                            {/* 끝 범위 선택 */}
                            <div>
                              <div className="mb-2 text-xs font-medium text-gray-700">
                                끝 범위 선택
                              </div>
                              <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                <div className="space-y-1">
                                  {contentInfo.type === "book"
                                    ? (contentInfo.details as BookDetail[]).map(
                                        (detail) => {
                                          const isSelected =
                                            selectedEndId === detail.id;
                                          return (
                                            <label
                                              key={detail.id}
                                              className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                                isSelected
                                                  ? "border-green-500 bg-green-50"
                                                  : "border-gray-200 hover:bg-gray-50"
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                name={`end-recommended-${index}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  setEndRange(index, detail.id)
                                                }
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">
                                                  페이지 {detail.page_number}
                                                </span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-500">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit &&
                                                      ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        }
                                      )
                                    : (
                                        contentInfo.details as LectureEpisode[]
                                      ).map((episode) => {
                                        const isSelected =
                                          selectedEndId === episode.id;
                                        return (
                                          <label
                                            key={episode.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                              isSelected
                                                ? "border-green-500 bg-green-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`end-recommended-${index}`}
                                              checked={isSelected}
                                              onChange={() =>
                                                setEndRange(index, episode.id)
                                              }
                                              className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <div className="flex-1 text-xs">
                                              <span className="font-medium">
                                                {episode.episode_number}회차
                                              </span>
                                              {episode.episode_title && (
                                                <span className="ml-2 text-gray-500">
                                                  · {episode.episode_title}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                </div>
                              </div>
                            </div>

                            {/* 선택된 범위 및 포함된 상세정보 표시 */}
                            {editingRange && (
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                <div className="text-xs font-medium text-gray-700">
                                  선택된 범위: {editingRange.start} ~{" "}
                                  {editingRange.end}
                                  {content.content_type === "book"
                                    ? " 페이지"
                                    : " 회차"}
                                </div>
                                {(() => {
                                  // 범위에 해당하는 모든 상세정보 가져오기
                                  const startNum = Number(editingRange.start);
                                  const endNum = Number(editingRange.end);
                                  if (contentInfo.type === "book") {
                                    const details =
                                      contentInfo.details as BookDetail[];
                                    const rangeDetails = details.filter(
                                      (d) =>
                                        d.page_number >= startNum &&
                                        d.page_number <= endNum
                                    );
                                    if (rangeDetails.length > 0) {
                                      return (
                                        <div className="mt-2 text-xs text-gray-600">
                                          <div className="font-medium">
                                            포함된 단원:
                                          </div>
                                          <div className="mt-1 space-y-0.5">
                                            {rangeDetails.map((d, idx) => (
                                              <div key={idx}>
                                                페이지 {d.page_number}
                                                {d.major_unit && (
                                                  <span className="text-gray-500">
                                                    {" "}
                                                    · {d.major_unit}
                                                    {d.minor_unit &&
                                                      ` - ${d.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                  } else {
                                    const episodes =
                                      contentInfo.details as LectureEpisode[];
                                    const rangeEpisodes = episodes.filter(
                                      (e) =>
                                        e.episode_number >= startNum &&
                                        e.episode_number <= endNum
                                    );
                                    if (rangeEpisodes.length > 0) {
                                      return (
                                        <div className="mt-2 text-xs text-gray-600">
                                          <div className="font-medium">
                                            포함된 회차:
                                          </div>
                                          <div className="mt-1 space-y-0.5">
                                            {rangeEpisodes.map((e, idx) => (
                                              <div key={idx}>
                                                {e.episode_number}회차
                                                {e.episode_title && (
                                                  <span className="text-gray-500">
                                                    {" "}
                                                    · {e.episode_title}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={editingRange?.start || content.start_range}
                              onChange={(e) =>
                                setEditingRange({
                                  start: e.target.value,
                                  end:
                                    editingRange?.end ||
                                    String(content.end_range),
                                })
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                              placeholder="시작"
                            />
                            <span>~</span>
                            <input
                              type="number"
                              min={1}
                              value={editingRange?.end || content.end_range}
                              onChange={(e) =>
                                setEditingRange({
                                  start:
                                    editingRange?.start ||
                                    String(content.start_range),
                                  end: e.target.value,
                                })
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                              placeholder="종료"
                            />
                          </div>
                        )}

                        {/* 저장/취소 버튼 */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingRange) {
                                const start = Number(editingRange.start);
                                const end = Number(editingRange.end);
                                if (
                                  !isNaN(start) &&
                                  !isNaN(end) &&
                                  start <= end &&
                                  start > 0
                                ) {
                                  const updated = [
                                    ...data.recommended_contents,
                                  ];
                                  updated[index] = {
                                    ...content,
                                    start_range: start,
                                    end_range: end,
                                  };
                                  onUpdate({
                                    recommended_contents: updated,
                                  });
                                  setEditingRangeIndex(null);
                                  setEditingRange(null);
                                  // 상세정보 선택 초기화
                                  setStartDetailId((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(index);
                                    return newMap;
                                  });
                                  setEndDetailId((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(index);
                                    return newMap;
                                  });
                                } else {
                                  alert(
                                    "올바른 범위를 입력해주세요. (시작 ≤ 종료, 양수)"
                                  );
                                }
                              }
                            }}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRangeIndex(null);
                              setEditingRange(null);
                              // 상세정보 선택 초기화
                              setStartDetailId((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(index);
                                return newMap;
                              });
                              setEndDetailId((prev) => {
                                const newMap = new Map(prev);
                                newMap.delete(index);
                                return newMap;
                              });
                            }}
                            className="rounded bg-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-400"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span>
                        {content.start_range} ~ {content.end_range}
                      </span>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <div className="ml-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRangeIndex(index);
                        setEditingRange({
                          start: String(content.start_range),
                          end: String(content.end_range),
                        });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      범위 수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = data.recommended_contents.filter(
                          (_, i) => i !== index
                        );
                        onUpdate({ recommended_contents: updated });
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 필수 과목 검증 결과 표시 */}
      {data.show_required_subjects_ui && 
       missingRequiredSubjects.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-800">필수 교과 부족</h4>
              <p className="mt-1 text-xs text-amber-700">
                다음 교과의 콘텐츠를 더 추가해주세요:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                {missingRequiredSubjects.map((missing, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span className="flex-1">
                      <strong>{missing.name}</strong>: 
                      현재 {missing.current}개 / 필요 {missing.required}개 
                      (부족: <strong>{missing.required - missing.current}개</strong>)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모드이고 아직 추천을 받지 않은 경우 - 추천받기 버튼 */}
      {isEditMode && !hasRequestedRecommendations && (
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                추천 콘텐츠 받기
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                추천 받을 교과와 개수를 선택하세요. (최대 9개까지 가능)
              </p>
            </div>
            
            {/* 교과 선택 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                교과 선택 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => {
                      const newSelected = new Set(selectedSubjects);
                      if (newSelected.has(subject)) {
                        newSelected.delete(subject);
                        const newCounts = new Map(recommendationCounts);
                        newCounts.delete(subject);
                        setRecommendationCounts(newCounts);
                      } else {
                        newSelected.add(subject);
                        setRecommendationCounts((prev) => {
                          const newMap = new Map(prev);
                          newMap.set(subject, 1);
                          return newMap;
                        });
                      }
                      setSelectedSubjects(newSelected);
                    }}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                      selectedSubjects.has(subject)
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>

            {/* 교과별 개수 설정 */}
            {selectedSubjects.size > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  교과별 추천 개수
                </label>
                <div className="space-y-3">
                  {Array.from(selectedSubjects).map((subject) => {
                    const currentCount = recommendationCounts.get(subject) || 1;
                    const totalSelectedCount = Array.from(recommendationCounts.values()).reduce((sum, count) => sum + count, 0);
                    const currentStudentCount = data.student_contents.length;
                    const currentRecommendedCount = data.recommended_contents.length;
                    const maxAvailable = 9 - currentStudentCount - currentRecommendedCount;
                    const remainingForOthers = maxAvailable - (totalSelectedCount - currentCount);
                    const maxForThis = Math.max(1, remainingForOthers);

                    return (
                      <div key={subject} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <span className="text-sm font-medium text-gray-900">{subject}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (currentCount > 1) {
                                setRecommendationCounts((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(subject, currentCount - 1);
                                  return newMap;
                                });
                              }
                            }}
                            disabled={currentCount <= 1}
                            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-gray-900">
                            {currentCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (currentCount < maxForThis) {
                                setRecommendationCounts((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(subject, currentCount + 1);
                                  return newMap;
                                });
                              }
                            }}
                            disabled={currentCount >= maxForThis}
                            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                          >
                            +
                          </button>
                          <span className="ml-2 text-xs text-gray-500">
                            (최대 {maxForThis}개)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-800">
                    현재 학생 콘텐츠: {data.student_contents.length}개, 추천 콘텐츠: {data.recommended_contents.length}개
                    <br />
                    추가 가능: {Math.max(0, 9 - data.student_contents.length - data.recommended_contents.length)}개 / 전체 최대 9개
                  </p>
                </div>
              </div>
            )}

            {/* 콘텐츠 자동 배정 옵션 */}
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoAssignContents}
                  onChange={(e) => setAutoAssignContents(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  콘텐츠 자동 배정
                </span>
              </label>
              <p className="text-xs text-gray-500">
                선택 시 추천 받은 콘텐츠를 자동으로 추가 추천 콘텐츠로 이동합니다.
              </p>
            </div>

            {/* 추천받기 버튼 */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  // 최소 제약 검증
                  if (selectedSubjects.size === 0) {
                    alert("최소 1개 이상의 교과를 선택해주세요.");
                    return;
                  }
                  
                  const totalRequested = Array.from(recommendationCounts.values()).reduce((sum, count) => sum + count, 0);
                  const currentTotal = data.student_contents.length + data.recommended_contents.length;
                  
                  if (totalRequested === 0) {
                    alert("최소 1개 이상의 콘텐츠를 추천 받으려면 개수를 설정해주세요.");
                    return;
                  }
                  
                  if (currentTotal + totalRequested > 9) {
                    alert(`추천 받을 수 있는 최대 개수를 초과했습니다. (현재: ${currentTotal}개, 요청: ${totalRequested}개, 최대: 9개)`);
                    return;
                  }

                  // 교과별 추천 개수 정보를 포함하여 추천 요청
                  await fetchRecommendationsWithSubjects(Array.from(selectedSubjects), recommendationCounts, autoAssignContents);
                }}
                disabled={selectedSubjects.size === 0}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                추천받기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">추천 목록을 불러오는 중...</p>
        </div>
      )}

      {/* 새로운 추천 목록이 없을 때 */}
      {hasRequestedRecommendations &&
        !loading &&
        recommendedContents.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
            <p className="text-sm font-medium text-amber-800">
              추천할 콘텐츠가 없습니다.
            </p>
            <p className="mt-2 text-xs text-amber-600">
              성적 데이터를 입력하시면 맞춤형 추천을 받을 수 있습니다.
            </p>
          </div>
        )}

      {/* 새로운 추천 목록 (hasRequestedRecommendations가 true일 때만 표시) */}
      {hasRequestedRecommendations &&
        !loading &&
        recommendedContents.length > 0 && (
          <>
            {/* 과목별 그룹화된 추천 목록 */}
            <div className="space-y-6">
              {sortedSubjects.map((subject) => {
                const contents = contentsBySubject.get(subject) || [];
                const isRequired = requiredSubjectCategories.includes(subject);
                const isSelected = selectedSubjectCategories.has(subject);

                return (
                  <div
                    key={subject}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {subject}
                        </h3>
                        {isRequired && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            필수
                          </span>
                        )}
                        {isRequired && !isSelected && (
                          <span className="text-xs text-red-600">
                            (1개 이상 선택 필요)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {contents.length}개 추천
                        </span>
                        {contents.some(
                          (c) =>
                            c.scoreDetails?.riskScore &&
                            c.scoreDetails.riskScore >= 50
                        ) && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                            ⚠️ 위험도 높음
                          </span>
                        )}
                        {contents.some((c) =>
                          c.reason.includes("취약 과목")
                        ) && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                            취약 과목
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {contents.map((content) => {
                        const isSelected = selectedContentIds.has(content.id);

                        return (
                          <label
                            key={content.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              isSelected
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                toggleContentSelection(content.id)
                              }
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {content.title}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    {content.contentType === "book" && (
                                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                                        📚 교재
                                      </span>
                                    )}
                                    {content.contentType === "lecture" && (
                                      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                                        🎧 강의
                                      </span>
                                    )}
                                    {content.subject && (
                                      <>
                                        <span>·</span>
                                        <span>{content.subject}</span>
                                      </>
                                    )}
                                    {content.semester && (
                                      <>
                                        <span>·</span>
                                        <span>{content.semester}</span>
                                      </>
                                    )}
                                    {content.revision && (
                                      <>
                                        <span>·</span>
                                        <span className="font-medium text-indigo-600">
                                          {content.revision} 개정판
                                        </span>
                                      </>
                                    )}
                                    {content.difficulty_level && (
                                      <>
                                        <span>·</span>
                                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                                          {content.difficulty_level}
                                        </span>
                                      </>
                                    )}
                                    {content.publisher && (
                                      <>
                                        <span>·</span>
                                        <span>{content.publisher}</span>
                                      </>
                                    )}
                                    {content.platform && (
                                      <>
                                        <span>·</span>
                                        <span>{content.platform}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="mt-1">
                                    <div className="text-xs text-gray-600">
                                      <span className="font-medium">
                                        추천 이유:
                                      </span>{" "}
                                      {content.reason}
                                    </div>
                                    {content.scoreDetails && (
                                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                                        {content.scoreDetails
                                          .schoolAverageGrade !== null &&
                                          content.scoreDetails
                                            .schoolAverageGrade !==
                                            undefined && (
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                                              내신 평균{" "}
                                              {formatNumber(
                                                content.scoreDetails
                                                  .schoolAverageGrade
                                              )}
                                              등급
                                            </span>
                                          )}
                                        {content.scoreDetails.mockPercentile !==
                                          null &&
                                          content.scoreDetails
                                            .mockPercentile !== undefined && (
                                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                                              모의고사{" "}
                                              {formatNumber(
                                                content.scoreDetails
                                                  .mockPercentile
                                              )}
                                              %
                                            </span>
                                          )}
                                        {content.scoreDetails.riskScore !==
                                          undefined &&
                                          content.scoreDetails.riskScore >=
                                            50 && (
                                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">
                                              위험도{" "}
                                              {formatNumber(
                                                content.scoreDetails.riskScore
                                              )}
                                              점
                                            </span>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 선택 요약 및 추가 버튼 */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">
                    선택된 추천 콘텐츠: {selectedContentIds.size}개
                    {totalCount > 0 && (
                      <span className="ml-2 text-gray-500">
                        (전체 {totalCount}개 중 학생 {studentCount}개, 추천{" "}
                        {recommendedCount}개)
                      </span>
                    )}
                  </div>
                  {requiredSubjects.length > 0 && missingRequiredSubjects.length > 0 && (
                    <div className="text-xs font-medium text-red-600">
                      필수 과목 미충족:{" "}
                      {missingRequiredSubjects
                        .map((m) => `${m.name} (${m.current}/${m.required})`)
                        .join(", ")}
                    </div>
                  )}
                </div>
                {selectedContentIds.size > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                    <div className="text-xs text-green-800">
                      <span className="font-medium">선택된 추천 콘텐츠:</span>
                      <div className="mt-1 space-y-1">
                        {Array.from(selectedContentIds).map((id) => {
                          const content = recommendedContents.find(
                            (c) => c.id === id
                          );
                          if (!content) return null;
                          return (
                            <div key={id} className="flex items-center gap-2">
                              <span className="text-green-700">
                                {content.contentType === "book" ? "📚" : "🎧"}{" "}
                                {content.title}
                              </span>
                              {content.difficulty_level && (
                                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                                  {content.difficulty_level}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={addSelectedContents}
                disabled={
                  selectedContentIds.size === 0 ||
                  (requiredSubjects.length > 0 && missingRequiredSubjects.length > 0) ||
                  totalCount + selectedContentIds.size > 9
                }
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                선택한 콘텐츠 추가하기 ({totalCount + selectedContentIds.size}
                /9)
              </button>
            </div>
          </>
        )}

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
  onUpdate: (updated: Partial<{ subject_category: string; subject?: string; min_count: number }>) => void;
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
            onChange={(e) => onUpdate({ subject_category: e.target.value, subject: undefined })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">교과 선택</option>
            {availableSubjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
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
            onChange={(e) => onUpdate({ min_count: parseInt(e.target.value) || 1 })}
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
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            {showDetailSubjects ? "세부 과목 숨기기" : "세부 과목 지정 (선택사항)"}
          </button>
          
          {showDetailSubjects && (
            <div className="mt-2">
              {loadingDetailSubjects ? (
                <p className="text-xs text-gray-500">세부 과목 불러오는 중...</p>
              ) : availableDetailSubjects.length > 0 ? (
                <select
                  value={requirement.subject || ""}
                  onChange={(e) => onUpdate({ subject: e.target.value || undefined })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="">세부 과목 선택 (전체)</option>
                  {availableDetailSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500">세부 과목 정보가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
