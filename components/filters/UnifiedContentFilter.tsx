"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UnifiedContentFilterProps, UnifiedFilterValues } from "./types";

type SubjectGroup = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  name: string;
};

// 기본 정렬 옵션
const DEFAULT_SORT_OPTIONS = [
  { value: "updated_at_desc", label: "최신순" },
  { value: "created_at_desc", label: "최신순" },
  { value: "created_at_asc", label: "오래된순" },
  { value: "title_asc", label: "제목 가나다순" },
  { value: "title_desc", label: "제목 역순" },
  { value: "difficulty_level_asc", label: "난이도 낮은순" },
  { value: "difficulty_level_desc", label: "난이도 높은순" },
];

export function UnifiedContentFilter({
  context,
  contentType,
  basePath,
  initialValues = {},
  filterOptions,
  showDifficulty = true,
  showSort = true,
  sortOptions = DEFAULT_SORT_OPTIONS,
  defaultSort = "updated_at_desc",
  className = "",
}: UnifiedContentFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 필터 상태
  const [values, setValues] = useState<UnifiedFilterValues>({
    curriculum_revision_id: initialValues.curriculum_revision_id || searchParams.get("curriculum_revision_id") || "",
    subject_group_id: initialValues.subject_group_id || searchParams.get("subject_group_id") || "",
    subject_id: initialValues.subject_id || searchParams.get("subject_id") || "",
    publisher_id: initialValues.publisher_id || searchParams.get("publisher_id") || "",
    platform_id: initialValues.platform_id || searchParams.get("platform_id") || "",
    difficulty: initialValues.difficulty || searchParams.get("difficulty") || "",
    search: initialValues.search || searchParams.get("search") || "",
    sort: initialValues.sort || searchParams.get("sort") || defaultSort,
  });

  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Subject[]>>(new Map());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 현재 선택된 교과의 과목 목록
  const currentSubjects = values.subject_group_id 
    ? subjectsMap.get(values.subject_group_id) || []
    : [];

  // 초기 마운트 시 초기값이 있을 경우 데이터 로드
  useEffect(() => {
    if (values.curriculum_revision_id && values.curriculum_revision_id === initialValues.curriculum_revision_id) {
      loadHierarchyData(
        values.curriculum_revision_id,
        initialValues.subject_group_id,
        initialValues.subject_id
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 개정교육과정 변경 시 교과와 과목 목록 로드
  useEffect(() => {
    if (
      values.curriculum_revision_id &&
      values.curriculum_revision_id !== initialValues.curriculum_revision_id
    ) {
      loadHierarchyData(values.curriculum_revision_id);
    } else if (!values.curriculum_revision_id) {
      setSubjectGroups([]);
      setSubjectsMap(new Map());
      setValues((prev) => ({
        ...prev,
        subject_group_id: "",
        subject_id: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.curriculum_revision_id]);

  // 교과 변경 시 과목 초기화
  useEffect(() => {
    if (
      values.subject_group_id &&
      values.subject_group_id !== initialValues.subject_group_id &&
      !subjectsMap.has(values.subject_group_id)
    ) {
      setLoadingSubjects(true);
      fetch(`/api/subjects?subject_group_id=${values.subject_group_id}`)
        .then((res) => res.json())
        .then((data) => {
          const newSubjects = data.data || [];
          setSubjectsMap((prev) => {
            const next = new Map(prev);
            next.set(values.subject_group_id!, newSubjects);
            return next;
          });
          setLoadingSubjects(false);
        })
        .catch((err) => {
          console.error("과목 목록 로드 실패:", err);
          setLoadingSubjects(false);
        });
    }

    if (values.subject_group_id !== initialValues.subject_group_id) {
      setValues((prev) => ({
        ...prev,
        subject_id: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.subject_group_id, initialValues.subject_group_id, subjectsMap]);

  // 계층 구조 데이터 로드
  const loadHierarchyData = async (
    curriculumRevisionId: string,
    preserveSubjectGroupId?: string,
    preserveSubjectId?: string
  ) => {
    setLoadingGroups(true);
    setLoadingSubjects(true);

    try {
      const response = await fetch(
        `/api/subject-groups?curriculum_revision_id=${curriculumRevisionId}&include_subjects=true`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "데이터 로드 실패");
      }

      const groupsWithSubjects = result.data || [];
      const groups: SubjectGroup[] = groupsWithSubjects.map(
        (group: SubjectGroup & { subjects?: Subject[] }) => ({
          id: group.id,
          name: group.name,
        })
      );

      const newSubjectsMap = new Map<string, Subject[]>();
      groupsWithSubjects.forEach((group: SubjectGroup & { subjects?: Subject[] }) => {
        if (group.subjects && group.subjects.length > 0) {
          newSubjectsMap.set(group.id, group.subjects);
        }
      });

      setSubjectGroups(groups);
      setSubjectsMap(newSubjectsMap);

      if (preserveSubjectGroupId && newSubjectsMap.has(preserveSubjectGroupId)) {
        setValues((prev) => ({
          ...prev,
          subject_group_id: preserveSubjectGroupId,
        }));
        const subjects = newSubjectsMap.get(preserveSubjectGroupId) || [];
        if (preserveSubjectId && subjects.some((s) => s.id === preserveSubjectId)) {
          setValues((prev) => ({
            ...prev,
            subject_id: preserveSubjectId,
          }));
        }
      } else if (!preserveSubjectGroupId) {
        setValues((prev) => ({
          ...prev,
          subject_group_id: "",
          subject_id: "",
        }));
      }

      setLoadingGroups(false);
      setLoadingSubjects(false);
    } catch (err) {
      console.error("계층 구조 데이터 로드 실패:", err);
      setLoadingGroups(false);
      setLoadingSubjects(false);
      setSubjectGroups([]);
      setSubjectsMap(new Map());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    
    // 기존 searchParams에서 tab 등 유지해야 할 파라미터 보존
    const currentParams = new URLSearchParams(searchParams.toString());
    const tabParam = currentParams.get("tab");
    if (tabParam) {
      params.set("tab", tabParam);
    }
    
    if (values.curriculum_revision_id) {
      params.set("curriculum_revision_id", values.curriculum_revision_id);
    }
    if (values.subject_group_id) {
      params.set("subject_group_id", values.subject_group_id);
    }
    if (values.subject_id) {
      params.set("subject_id", values.subject_id);
    }
    if (contentType === "book" && values.publisher_id) {
      params.set("publisher_id", values.publisher_id);
    }
    if (contentType === "lecture" && values.platform_id) {
      params.set("platform_id", values.platform_id);
    }
    if (values.search?.trim()) {
      params.set("search", values.search.trim());
    }
    if (showDifficulty && values.difficulty) {
      params.set("difficulty", values.difficulty);
    }
    if (showSort && values.sort && values.sort !== defaultSort) {
      params.set("sort", values.sort);
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  const handleReset = () => {
    const params = new URLSearchParams();
    // 기존 searchParams에서 tab 등 유지해야 할 파라미터 보존
    const currentParams = new URLSearchParams(searchParams.toString());
    const tabParam = currentParams.get("tab");
    if (tabParam) {
      params.set("tab", tabParam);
    }
    const queryString = params.toString();
    router.push(`${basePath}${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-wrap items-end gap-4 ${className}`}
    >
      {/* 개정교육과정 */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-gray-700">
          개정교육과정
        </label>
        <select
          value={values.curriculum_revision_id || ""}
          onChange={(e) => setValues((prev) => ({ ...prev, curriculum_revision_id: e.target.value }))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">전체</option>
          {filterOptions.curriculumRevisions.map((rev) => (
            <option key={rev.id} value={rev.id}>
              {rev.name}
            </option>
          ))}
        </select>
      </div>

      {/* 교과 */}
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs font-medium text-gray-700">교과</label>
        <select
          value={values.subject_group_id || ""}
          onChange={(e) => setValues((prev) => ({ ...prev, subject_group_id: e.target.value }))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!values.curriculum_revision_id || loadingGroups}
        >
          <option value="">전체</option>
          {loadingGroups ? (
            <option value="">로딩 중...</option>
          ) : (
            subjectGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* 과목 */}
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs font-medium text-gray-700">과목</label>
        <select
          value={values.subject_id || ""}
          onChange={(e) => setValues((prev) => ({ ...prev, subject_id: e.target.value }))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!values.subject_group_id || loadingSubjects}
        >
          <option value="">전체</option>
          {loadingSubjects ? (
            <option value="">로딩 중...</option>
          ) : (
            currentSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* 출판사 (교재용) */}
      {contentType === "book" && (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-700">출판사</label>
          <select
            value={values.publisher_id || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, publisher_id: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {filterOptions.publishers?.map((publisher) => (
              <option key={publisher.id} value={publisher.id}>
                {publisher.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 플랫폼 (강의용) */}
      {contentType === "lecture" && (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-700">플랫폼</label>
          <select
            value={values.platform_id || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, platform_id: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {filterOptions.platforms?.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 제목 검색 */}
      <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[300px]">
        <label className="text-xs font-medium text-gray-700">
          제목 검색
        </label>
        <input
          type="text"
          value={values.search || ""}
          onChange={(e) => setValues((prev) => ({ ...prev, search: e.target.value }))}
          placeholder={contentType === "book" ? "교재명 입력" : "강의명 입력"}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* 난이도 */}
      {showDifficulty && (
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className="text-xs font-medium text-gray-700">난이도</label>
          <select
            value={values.difficulty || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, difficulty: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {filterOptions.difficulties?.map((diff) => (
              <option key={diff} value={diff}>
                {diff}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 정렬 */}
      {showSort && (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-700">정렬</label>
          <select
            value={values.sort || defaultSort}
            onChange={(e) => setValues((prev) => ({ ...prev, sort: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 검색 버튼 */}
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        검색
      </button>

      {/* 초기화 버튼 */}
      <button
        type="button"
        onClick={handleReset}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        초기화
      </button>
    </form>
  );
}

