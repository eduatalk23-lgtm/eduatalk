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
  MasterContentsPanel,
  ProgressIndicator,
  UnifiedContentsView,
} from "./_shared";
import { BookOpen, Sparkles, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { getRecommendedMasterContentsAction } from "@/app/(student)/actions/getRecommendedMasterContents";
import { fetchDetailSubjects } from "@/app/(student)/actions/fetchDetailSubjects";
import {
  getCurriculumRevisionsAction,
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
} from "@/app/(student)/actions/contentMetadataActions";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup } from "@/lib/data/subjects";
import RequiredSubjectItem from "./Step4RecommendedContents/components/RequiredSubjectItem";

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
  isTemplateMode = false,
  studentId,
  editable = true,
  isAdminContinueMode = false,
}: Step3ContentSelectionProps & { isTemplateMode?: boolean; isAdminContinueMode?: boolean }) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<
    "student" | "recommended" | "master"
  >("student");

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
  const [availableSubjectGroups, setAvailableSubjectGroups] = useState<
    SubjectGroup[]
  >([]);
  const [curriculumRevisions, setCurriculumRevisions] = useState<
    CurriculumRevision[]
  >([]);
  const [loadingSubjectGroups, setLoadingSubjectGroups] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // 교과 그룹 목록 조회
  useEffect(() => {
    if (isTemplateMode) {
      setLoadingSubjectGroups(true);
      getSubjectGroupsAction()
        .then((groups) => {
          setAvailableSubjectGroups(groups || []);
        })
        .catch((error) => {
          console.error("교과 그룹 조회 실패:", error);
        })
        .finally(() => {
          setLoadingSubjectGroups(false);
        });
    }
  }, [isTemplateMode]);

  // 개정교육과정 목록 조회 (템플릿 모드일 때만)
  useEffect(() => {
    if (isTemplateMode) {
      setLoadingRevisions(true);
      getCurriculumRevisionsAction()
        .then((revisions) => {
          setCurriculumRevisions(revisions || []);
        })
        .catch((error) => {
          console.error("개정교육과정 조회 실패:", error);
        })
        .finally(() => {
          setLoadingRevisions(false);
        });
    }
  }, [isTemplateMode]);

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
      data.subject_constraints?.required_subjects
        ?.map((req) => req.subject_category)
        .filter(Boolean) || [];

    // 필수 교과가 설정되지 않았으면 빈 배열 반환
    if (requiredSubjectCategories.length === 0) {
      return [];
    }

    const allContents = [
      ...data.student_contents,
      ...data.recommended_contents,
    ];
    const subjectSet = new Set(
      allContents.map((c) => c.subject_category).filter((s): s is string => !!s)
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
  }, [
    currentTotal,
    allRequiredSelected,
    requiredSubjects,
    isCampMode,
    maxContents,
  ]);

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
    console.log("[Step3ContentSelection] 추천 받기 요청 시작:", {
      recommendationSettings: {
        selectedSubjects: Array.from(recommendationSettings.selectedSubjects),
        recommendationCounts: Object.fromEntries(
          recommendationSettings.recommendationCounts
        ),
        autoAssignContents: recommendationSettings.autoAssignContents,
      },
      studentId,
    });

    setRecommendationLoading(true);

    try {
      // 과목과 개수 배열로 변환
      const subjects = Array.from(recommendationSettings.selectedSubjects);
      // Record<string, number> 형식으로 변환
      const counts: Record<string, number> = {};
      subjects.forEach((subject) => {
        counts[subject] = recommendationSettings.recommendationCounts.get(subject) || 1;
      });

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

      const rawRecommendations = result.data.recommendations || [];

      // API 응답을 RecommendedContent로 변환 (contentType 보장)
      const recommendations: RecommendedContent[] = rawRecommendations.map(
        (r: any) => {
          // contentType 결정: camelCase 우선, 없으면 snake_case, 없으면 추정
          let contentType = r.contentType || r.content_type;

          if (!contentType) {
            // publisher가 있으면 book, platform이 있으면 lecture로 추정
            if (r.publisher) {
              contentType = "book";
            } else if (r.platform) {
              contentType = "lecture";
            } else {
              // 기본값: book
              contentType = "book";
            }

            console.warn(
              "[Step3ContentSelection] contentType이 없어 추정값 사용:",
              {
                id: r.id,
                title: r.title,
                estimatedContentType: contentType,
                publisher: r.publisher,
                platform: r.platform,
                allKeys: Object.keys(r),
              }
            );
          }

          // 타입 검증
          if (contentType !== "book" && contentType !== "lecture") {
            console.error("[Step3ContentSelection] 잘못된 contentType:", {
              id: r.id,
              title: r.title,
              contentType,
              rawData: r,
            });
            // 잘못된 타입은 기본값으로 변경
            contentType = "book";
          }

          return {
            id: r.id,
            contentType: contentType as "book" | "lecture",
            title: r.title,
            subject_category: r.subject_category,
            subject: r.subject,
            semester: r.semester,
            revision: r.revision,
            publisher: r.publisher,
            platform: r.platform,
            difficulty_level: r.difficulty_level,
            reason: r.reason || "",
            priority: r.priority || 0,
            scoreDetails: r.scoreDetails,
          };
        }
      );

      // 성적 데이터 유무 확인
      const hasDetailedReasons = recommendations.some(
        (r: RecommendedContent) =>
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
      recommendations.forEach((c: RecommendedContent) => {
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
      console.log("[Step3ContentSelection] 자동 배정 체크:", {
        autoAssign: recommendationSettings.autoAssignContents,
        filteredRecommendationsCount: filteredRecommendations.length,
        willAutoAssign:
          recommendationSettings.autoAssignContents &&
          filteredRecommendations.length > 0,
      });

      // 자동 배정 조건 명확화
      const shouldAutoAssign =
        recommendationSettings.autoAssignContents &&
        filteredRecommendations.length > 0;

      console.log("[Step3ContentSelection] 자동 배정 조건 확인:", {
        autoAssignContents: recommendationSettings.autoAssignContents,
        filteredRecommendationsCount: filteredRecommendations.length,
        shouldAutoAssign,
      });

      if (shouldAutoAssign) {
        console.log("[Step3ContentSelection] 자동 배정 시작:", {
          recommendationsCount: filteredRecommendations.length,
          recommendations: filteredRecommendations.map((r) => ({
            id: r.id,
            title: r.title,
            contentType: r.contentType,
          })),
        });

        // 자동 배정 로직 구현
        const contentsToAutoAdd: Array<{
          content_type: "book" | "lecture";
          content_id: string;
          start_range: number;
          end_range: number;
          title?: string;
          subject_category?: string;
          is_auto_recommended?: boolean;
        }> = [];

        for (const r of filteredRecommendations) {
          try {
            let startRange = 1;
            let endRange = 100;

            // 상세 정보 조회
            let detailsResult: any = null;
            let hasDetails = false;

            const detailsResponse = await fetch(
              `/api/master-content-details?contentType=${r.contentType}&contentId=${r.id}`
            );

            if (detailsResponse.ok) {
              detailsResult = await detailsResponse.json();

              if (detailsResult.success && detailsResult.data) {
                if (r.contentType === "book") {
                  const details = detailsResult.data.details || [];
                  hasDetails = details.length > 0;
                  if (hasDetails) {
                    startRange = details[0].page_number || 1;
                    endRange = details[details.length - 1].page_number || 100;
                  }
                } else if (r.contentType === "lecture") {
                  const episodes = detailsResult.data.episodes || [];
                  hasDetails = episodes.length > 0;
                  if (hasDetails) {
                    startRange = episodes[0].episode_number || 1;
                    endRange =
                      episodes[episodes.length - 1].episode_number || 100;
                  }
                }
              }
            }

            // 상세 정보가 없거나 기본값일 때 총량 조회
            if (!hasDetails || (startRange === 1 && endRange === 100)) {
              try {
                const infoResponse = await fetch(
                  `/api/master-content-info?content_type=${r.contentType}&content_id=${r.id}`
                );

                if (infoResponse.ok) {
                  const infoResult = await infoResponse.json();
                  if (infoResult.success && infoResult.data) {
                    if (
                      r.contentType === "book" &&
                      infoResult.data.total_pages
                    ) {
                      endRange = infoResult.data.total_pages;
                    } else if (
                      r.contentType === "lecture" &&
                      infoResult.data.total_episodes
                    ) {
                      endRange = infoResult.data.total_episodes;
                    }
                  }
                }
              } catch (infoError) {
                // 총량 조회 실패는 무시 (기본값 100 사용)
              }
            }

            contentsToAutoAdd.push({
              content_type: r.contentType,
              content_id: r.id,
              start_range: startRange,
              end_range: endRange,
              title: r.title,
              subject_category: r.subject_category || undefined,
              is_auto_recommended: true, // 자동 배정 플래그
            });
          } catch (error) {
            console.warn(
              `[Step3ContentSelection] 콘텐츠 ${r.id} 상세 정보 조회 실패:`,
              error
            );
            // 조회 실패 시 기본값 사용
            contentsToAutoAdd.push({
              content_type: r.contentType,
              content_id: r.id,
              start_range: 1,
              end_range: 100,
              title: r.title,
              subject_category: r.subject_category || undefined,
              is_auto_recommended: true, // 자동 배정 플래그
            });
          }
        }

        // 함수형 업데이트를 사용하여 최신 상태 보장
        console.log(
          "[Step3ContentSelection] 자동 배정 실행 - 함수형 업데이트 호출:",
          {
            contentsToAutoAdd: contentsToAutoAdd.map((c) => ({
              content_id: c.content_id,
              content_type: c.content_type,
              start_range: c.start_range,
              end_range: c.end_range,
              title: c.title,
            })),
          }
        );

        try {
          onUpdate((prev) => {
            const currentTotal =
              prev.student_contents.length + prev.recommended_contents.length;
            const toAdd = contentsToAutoAdd.length;

            console.log(
              "[Step3ContentSelection] 자동 배정 실행 (함수형 업데이트 내부):",
              {
                currentTotal,
                toAdd,
                currentRecommendedContents: prev.recommended_contents.length,
                currentStudentContents: prev.student_contents.length,
              }
            );

            if (currentTotal + toAdd > 9) {
              const maxToAdd = 9 - currentTotal;
              const trimmed = contentsToAutoAdd.slice(0, maxToAdd);

              if (trimmed.length > 0) {
                const newRecommendedContents = [
                  ...prev.recommended_contents,
                  ...trimmed,
                ];
                console.log("[Step3ContentSelection] 자동 배정 (제한 적용):", {
                  trimmed: trimmed.length,
                  excluded: toAdd - trimmed.length,
                });
                setTimeout(() => {
                  alert(
                    `추천 콘텐츠 ${
                      trimmed.length
                    }개가 자동으로 추가되었습니다. (최대 9개 제한으로 ${
                      toAdd - trimmed.length
                    }개 제외됨)`
                  );
                }, 0);
                return {
                  recommended_contents: newRecommendedContents,
                };
              } else {
                setTimeout(() => {
                  alert("추가할 수 있는 콘텐츠가 없습니다. (최대 9개 제한)");
                }, 0);
                return {};
              }
            } else {
              const newRecommendedContents = [
                ...prev.recommended_contents,
                ...contentsToAutoAdd,
              ];
              console.log("[Step3ContentSelection] 자동 배정 성공:", {
                added: contentsToAutoAdd.length,
                newRecommendedContents: newRecommendedContents.length,
              });
              setTimeout(() => {
                alert(
                  `추천 콘텐츠 ${contentsToAutoAdd.length}개가 자동으로 추가되었습니다.`
                );
              }, 0);
              return {
                recommended_contents: newRecommendedContents,
              };
            }
          });

          console.log("[Step3ContentSelection] onUpdate 호출 완료");

          // 자동 배정된 콘텐츠를 추천 목록에서 제거
          const autoAssignedIds = new Set(
            filteredRecommendations.map((r) => r.id)
          );
          setRecommendedContents((prev) => {
            const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
            console.log("[Step3ContentSelection] 자동 배정 후 목록 업데이트:", {
              before: prev.length,
              after: filtered.length,
              autoAssigned: autoAssignedIds.size,
            });
            return filtered;
          });
        } catch (error) {
          console.error(
            "[Step3ContentSelection] 자동 배정 중 오류 발생:",
            error
          );
          alert("자동 배정 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      } else {
        console.log("[Step3ContentSelection] 자동 배정 스킵:", {
          autoAssign: recommendationSettings.autoAssignContents,
          filteredRecommendationsCount: filteredRecommendations.length,
          reason: !recommendationSettings.autoAssignContents
            ? "자동 배정 옵션이 비활성화됨"
            : "추천 콘텐츠가 없음",
        });
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
  // 개정교육과정별 세부 과목 불러오기
  const handleLoadSubjects = useCallback(
    async (
      subjectGroupId: string,
      curriculumRevisionId: string
    ): Promise<Array<{ id: string; name: string }>> => {
      try {
        // 해당 개정교육과정의 교과 그룹 찾기
        const selectedGroup = availableSubjectGroups.find(
          (g) => g.id === subjectGroupId
        );
        if (!selectedGroup) {
          return [];
        }

        // 같은 이름의 교과 그룹 중 해당 개정교육과정의 것 찾기
        const curriculumGroup = availableSubjectGroups.find(
          (g) =>
            g.name === selectedGroup.name &&
            g.curriculum_revision_id === curriculumRevisionId
        );

        if (!curriculumGroup) {
          return [];
        }

        // 해당 교과 그룹의 과목 조회
        const subjects = await getSubjectsByGroupAction(curriculumGroup.id);
        return subjects.map((s) => ({ id: s.id, name: s.name }));
      } catch (error) {
        console.error("세부 과목 조회 실패:", error);
        return [];
      }
    },
    [availableSubjectGroups]
  );

  // 필수 교과 추가
  const handleAddRequiredSubject = useCallback(() => {
    if (!editable) return;
    const currentConstraints = data.subject_constraints || {
      enable_required_subjects_validation: true,
      required_subjects: [],
      excluded_subjects: [],
      constraint_handling: "warning",
    };

    const newRequirement = {
      subject_group_id: "",
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
        subject_group_id: string;
        subject_category: string;
        min_count: number;
        subjects_by_curriculum?: Array<{
          curriculum_revision_id: string;
          subject_id?: string;
          subject_name?: string;
        }>;
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
      if (!editable) return;
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
      {/* 필수 교과 설정 섹션 - 템플릿 모드에서만 표시 */}
      {isTemplateMode && (
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
              플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다.
              개정교육과정별로 세부 과목을 지정하여 더 정확한 제약 조건을 설정할
              수 있습니다.
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
                      availableSubjectGroups={availableSubjectGroups}
                      curriculumRevisions={curriculumRevisions}
                      onLoadSubjects={handleLoadSubjects}
                      onUpdate={(updated) =>
                        handleRequiredSubjectUpdate(index, updated)
                      }
                      onRemove={() => handleRequiredSubjectRemove(index)}
                    />
                  )
                )}
              </div>
            )}

            {/* 교과 추가 버튼 */}
            <button
              type="button"
              onClick={handleAddRequiredSubject}
              disabled={!editable}
              className={`w-full rounded-lg border-2 border-dashed p-3 text-sm transition-colors ${
                !editable
                  ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                  : "border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-600"
              }`}
            >
              + 필수 교과 추가
            </button>

            {/* 제약 조건 처리 방식 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                제약 조건 처리 방식
              </label>
              <select
                value={
                  data.subject_constraints?.constraint_handling || "warning"
                }
                onChange={(e) =>
                  handleConstraintHandlingChange(
                    e.target.value as "strict" | "warning" | "auto_fix"
                  )
                }
                disabled={!editable}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
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
              <p className="mt-1 text-xs text-gray-600">
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

      {/* 탭 UI - 읽기 전용 모드에서는 숨김 */}
      {editable && (
        <div className="flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              setActiveTab("student");
            }}
            disabled={!editable}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "student"
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-600 hover:text-gray-900",
              !editable && "cursor-not-allowed opacity-60"
            )}
          >
            <BookOpen className="h-4 w-4" />
            <span>학생 콘텐츠</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === "student"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {data.student_contents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              setActiveTab("recommended");
            }}
            disabled={!editable}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "recommended"
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-600 hover:text-gray-900",
              !editable && "cursor-not-allowed opacity-60"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span>추천 콘텐츠</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === "recommended"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {data.recommended_contents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              setActiveTab("master");
            }}
            disabled={!editable}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "master"
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-600 hover:text-gray-900",
              !editable && "cursor-not-allowed opacity-60"
            )}
          >
            <Package className="h-4 w-4" />
            <span>마스터 콘텐츠</span>
          </button>
        </div>
      )}

      {/* 탭 내용 또는 통합 뷰 */}
      <div>
        {editable ? (
          // 편집 모드: 탭별 표시
          activeTab === "student" ? (
            <StudentContentsPanel
              contents={contents}
              selectedContents={data.student_contents}
              maxContents={maxContents}
              currentTotal={currentTotal}
              onUpdate={handleStudentContentsUpdate}
              editable={editable}
              isCampMode={isCampMode}
            />
          ) : activeTab === "recommended" ? (
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
              isAdminContinueMode={isAdminContinueMode}
              editable={editable}
            />
          ) : (
            <MasterContentsPanel
              selectedContents={data.student_contents}
              maxContents={maxContents}
              currentTotal={currentTotal}
              onUpdate={handleStudentContentsUpdate}
              editable={editable}
              isCampMode={isCampMode}
            />
          )
        ) : (
          // 읽기 전용 모드: 통합 뷰
          <UnifiedContentsView
            studentContents={data.student_contents}
            recommendedContents={data.recommended_contents}
            contents={contents}
            allRecommendedContents={allRecommendedContents}
            isCampMode={isCampMode}
          />
        )}
      </div>
    </div>
  );
}
