"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WizardData } from "./PlanGroupWizard";
import { formatNumber } from "@/lib/utils/formatNumber";
import { PlanGroupError, toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";

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

  // 추천 목록 조회 함수
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/recommended-master-contents");
      if (response.ok) {
        const result = await response.json();
        const recommendations = result.recommendations || [];

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
        const filteredRecommendations = recommendations.filter(
          (r: RecommendedContent) => !existingIds.has(r.id)
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
  }, [data.student_contents, data.recommended_contents]);

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

    // 선택 초기화
    setSelectedContentIds(new Set());
  };

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
  const subjects = Array.from(allContentSubjects).sort();

  // subject_allocations 핸들러
  const handleSubjectAllocationChange = (
    subject: string,
    allocation: {
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    const currentAllocations = data.subject_allocations || [];
    const updatedAllocations = currentAllocations.filter(
      (a) => a.subject_name !== subject
    );
    updatedAllocations.push(allocation);
    onUpdate({ subject_allocations: updatedAllocations });
  };

  // 캠프 모드이고 1730_timetable인 경우 취약과목/전략과목 설정 표시
  const showSubjectAllocations =
    isCampMode && data.scheduler_type === "1730_timetable";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              서비스 추천 콘텐츠
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              성적 데이터를 기반으로 추천된 교재와 강의를 선택하세요. (최대 9개,
              국어/수학/영어 각 1개 이상 필수)
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {totalCount}/9
            </div>
            <div className="text-xs text-gray-500">
              학생 {studentCount}개 / 추천 {recommendedCount}개
            </div>
          </div>
        </div>
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

      {/* 편집 모드이고 아직 추천을 받지 않은 경우 - 추천받기 버튼 */}
      {isEditMode && !hasRequestedRecommendations && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                추천 콘텐츠 받기
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                성적 데이터를 기반으로 맞춤형 추천 콘텐츠를 받아보세요.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchRecommendations}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              추천받기
            </button>
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

      {/* 취약과목/전략과목 설정 (캠프 모드이고 1730_timetable인 경우) */}
      {showSubjectAllocations && subjects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            전략과목/취약과목 정보 <span className="text-red-500">*</span>
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            각 과목을 전략과목 또는 취약과목으로 분류하여 학습 배정 방식을 결정합니다.
            이 설정은 Step 5에서 검증됩니다.
          </p>

          <div className="space-y-4">
            {subjects.map((subject) => {
              const existingAllocation = (data.subject_allocations || []).find(
                (a) => a.subject_name === subject
              );
              const subjectType = existingAllocation?.subject_type || "weakness";
              const weeklyDays = existingAllocation?.weekly_days || 3;

              // 해당 과목의 콘텐츠 개수 계산
              const subjectContentCount =
                data.student_contents.filter(
                  (sc) => (sc as any).subject_category === subject
                ).length +
                data.recommended_contents.filter((rc) => {
                  const subjectCategory =
                    (rc as any).subject_category ||
                    allRecommendedContents.find((c) => c.id === rc.content_id)
                      ?.subject_category;
                  return subjectCategory === subject;
                }).length;

              return (
                <div
                  key={subject}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {subject}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {subjectContentCount}개 콘텐츠
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-700">
                        과목 유형
                      </label>
                      <div className="flex gap-3">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                          <input
                            type="radio"
                            name={`subject_type_${subject}`}
                            value="weakness"
                            checked={subjectType === "weakness"}
                            onChange={() => {
                              handleSubjectAllocationChange(subject, {
                                subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                                subject_name: subject,
                                subject_type: "weakness",
                              });
                            }}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              취약과목
                            </div>
                            <div className="text-xs text-gray-500">
                              전체 학습일에 플랜 배정 (더 많은 시간 필요)
                            </div>
                          </div>
                        </label>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                          <input
                            type="radio"
                            name={`subject_type_${subject}`}
                            value="strategy"
                            checked={subjectType === "strategy"}
                            onChange={() => {
                              handleSubjectAllocationChange(subject, {
                                subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                                subject_name: subject,
                                subject_type: "strategy",
                                weekly_days: 3,
                              });
                            }}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              전략과목
                            </div>
                            <div className="text-xs text-gray-500">
                              주당 배정 일수에 따라 배정
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {subjectType === "strategy" && (
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-700">
                          주당 배정 일수
                        </label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                          value={weeklyDays}
                          onChange={(e) => {
                            handleSubjectAllocationChange(subject, {
                              subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                              subject_name: subject,
                              subject_type: "strategy",
                              weekly_days: Number(e.target.value),
                            });
                          }}
                        >
                          <option value="2">주 2일</option>
                          <option value="3">주 3일</option>
                          <option value="4">주 4일</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          선택한 주당 일수에 따라 학습일에 균등하게 배정됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
