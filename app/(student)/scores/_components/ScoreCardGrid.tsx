"use client";

import { useMemo, useState, memo } from "react";
import { SchoolScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { ScoreCard } from "./ScoreCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Plus, Filter, ArrowUpDown, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { VirtualizedList } from "@/lib/components/VirtualizedList";
import { bgSurface, textPrimary, textSecondary, textMuted, borderDefault, bgPage } from "@/lib/utils/darkMode";

type ScoreCardGridProps = {
  initialGrade?: number;
  initialSemester?: number;
  scores: SchoolScore[];
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  onAddClick?: () => void;
  onEdit: (score: SchoolScore) => void;
  onDelete: (scoreId: string) => void;
};

type SortField = "grade" | "semester" | "grade_score" | "raw_score" | "subject_name";
type SortOrder = "asc" | "desc";

function ScoreCardGridComponent({
  initialGrade,
  initialSemester,
  scores,
  subjectGroups,
  subjectTypes,
  onAddClick,
  onEdit,
  onDelete,
}: ScoreCardGridProps) {
  const [sortField, setSortField] = useState<SortField>("grade");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterGrade, setFilterGrade] = useState<string>(initialGrade?.toString() || "all");
  const [filterSemester, setFilterSemester] = useState<string>(initialSemester?.toString() || "all");
  const [filterSubjectGroup, setFilterSubjectGroup] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterSubjectType, setFilterSubjectType] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // 성적 데이터에 과목 정보 매핑
  const scoresWithInfo = useMemo(() => {
    return scores.map((score) => {
      const group = score.subject_group_id
        ? subjectGroups.find((g) => g.id === score.subject_group_id)
        : subjectGroups.find((g) => g.name === score.subject_group);
      const subject = score.subject_id
        ? group?.subjects.find((s) => s.id === score.subject_id)
        : group?.subjects.find((s) => s.name === score.subject_name);
      const subjectType = score.subject_type_id
        ? subjectTypes.find((st) => st.id === score.subject_type_id)
        : score.subject_type
          ? subjectTypes.find((st) => st.name === score.subject_type)
          : null;

      return {
        score,
        subjectGroupName: group?.name || score.subject_group || "",
        subjectName: subject?.name || score.subject_name || "",
        subjectTypeName: subjectType?.name || score.subject_type || "",
      };
    });
  }, [scores, subjectGroups, subjectTypes]);

  // 필터링 및 정렬
  const filteredAndSortedScores = useMemo(() => {
    let filtered = [...scoresWithInfo];

    // 학년 필터링
    if (filterGrade !== "all") {
      filtered = filtered.filter(
        (item) => item.score.grade === parseInt(filterGrade)
      );
    }

    // 학기 필터링
    if (filterSemester !== "all") {
      filtered = filtered.filter(
        (item) => item.score.semester === parseInt(filterSemester)
      );
    }

    // 교과 필터링
    if (filterSubjectGroup !== "all") {
      filtered = filtered.filter(
        (item) => item.subjectGroupName === filterSubjectGroup
      );
    }

    // 과목 필터링
    if (filterSubject !== "all") {
      filtered = filtered.filter(
        (item) => item.subjectName === filterSubject
      );
    }

    // 과목 유형 필터링
    if (filterSubjectType !== "all") {
      filtered = filtered.filter((item) => item.subjectTypeName === filterSubjectType);
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue: number | string | null = null;
      let bValue: number | string | null = null;

      switch (sortField) {
        case "grade":
          aValue = a.score.grade ?? 0;
          bValue = b.score.grade ?? 0;
          break;
        case "semester":
          aValue = a.score.semester ?? 0;
          bValue = b.score.semester ?? 0;
          break;
        case "grade_score":
          aValue = a.score.grade_score ?? 999;
          bValue = b.score.grade_score ?? 999;
          break;
        case "raw_score":
          aValue = a.score.raw_score ?? 0;
          bValue = b.score.raw_score ?? 0;
          break;
        case "subject_name":
          aValue = a.subjectName;
          bValue = b.subjectName;
          break;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [scoresWithInfo, sortField, sortOrder, filterGrade, filterSemester, filterSubjectGroup, filterSubject, filterSubjectType]);

  // 고유한 교과 및 과목 유형 목록
  const availableSubjectGroups = useMemo(() => {
    const groups = new Set<string>();
    scoresWithInfo.forEach((item) => {
      if (item.subjectGroupName) groups.add(item.subjectGroupName);
    });
    return Array.from(groups).sort();
  }, [scoresWithInfo]);

  const availableSubjectTypes = useMemo(() => {
    const types = new Set<string>();
    scoresWithInfo.forEach((item) => {
      if (item.subjectTypeName) types.add(item.subjectTypeName);
    });
    return Array.from(types).sort();
  }, [scoresWithInfo]);

  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    scoresWithInfo.forEach((item) => {
      if (item.subjectName) subjects.add(item.subjectName);
    });
    return Array.from(subjects).sort();
  }, [scoresWithInfo]);

  const availableGrades = useMemo(() => {
    const grades = new Set<number>();
    scoresWithInfo.forEach((item) => {
      if (item.score.grade) grades.add(item.score.grade);
    });
    return Array.from(grades).sort();
  }, [scoresWithInfo]);

  const availableSemesters = useMemo(() => {
    const semesters = new Set<number>();
    scoresWithInfo.forEach((item) => {
      if (item.score.semester) semesters.add(item.score.semester);
    });
    return Array.from(semesters).sort();
  }, [scoresWithInfo]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  if (scores.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8 text-gray-400" />}
        title="등록된 성적이 없습니다."
        description="성적을 추가하여 학습 진행 상황을 관리하세요."
        actionLabel="성적 추가하기"
        onAction={onAddClick}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 및 정렬 바 */}
      <div className={cn("flex flex-col gap-3 rounded-lg border p-4", bgSurface, borderDefault)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                showFilters
                  ? "border-indigo-500 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  : cn(bgSurface, borderDefault, textSecondary, "hover:bg-gray-50 dark:hover:bg-gray-800")
              )}
            >
              <Filter className="h-4 w-4" />
              필터
            </button>
            {onAddClick && (
              <button
                onClick={onAddClick}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                성적 추가
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-sm", textSecondary)}>
              총 {filteredAndSortedScores.length}개
            </span>
          </div>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <div className={cn("grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", borderDefault)}>
            {/* 학년 필터 */}
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                학년
              </label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {availableGrades.map((grade) => (
                  <option key={grade} value={grade.toString()}>
                    {grade}학년
                  </option>
                ))}
              </select>
            </div>

            {/* 학기 필터 */}
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                학기
              </label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {availableSemesters.map((semester) => (
                  <option key={semester} value={semester.toString()}>
                    {semester}학기
                  </option>
                ))}
              </select>
            </div>

            {/* 교과 필터 */}
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                교과
              </label>
              <select
                value={filterSubjectGroup}
                onChange={(e) => {
                  setFilterSubjectGroup(e.target.value);
                  setFilterSubject("all"); // 교과 변경 시 과목 필터 초기화
                }}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {availableSubjectGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            {/* 과목 필터 */}
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                과목
              </label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {availableSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            {/* 과목 유형 필터 */}
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                과목 유형
              </label>
              <select
                value={filterSubjectType}
                onChange={(e) => setFilterSubjectType(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {availableSubjectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 정렬 순서 */}
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                정렬 순서
              </label>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                  bgSurface,
                  borderDefault,
                  textPrimary,
                  "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === "asc" ? "오름차순" : "내림차순"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 필터 적용 중일 때 결과가 없을 경우 */}
      {(filterGrade !== "all" || filterSemester !== "all" || filterSubjectGroup !== "all" || filterSubject !== "all" || filterSubjectType !== "all") &&
        filteredAndSortedScores.length === 0 && (
          <div className={cn("flex flex-col gap-2 rounded-lg border p-8 text-center", bgSurface, borderDefault)}>
            <p className={cn("text-sm", textMuted)}>
              선택한 필터 조건에 맞는 성적이 없습니다.
            </p>
            <button
              onClick={() => {
                setFilterGrade("all");
                setFilterSemester("all");
                setFilterSubjectGroup("all");
                setFilterSubject("all");
                setFilterSubjectType("all");
              }}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              필터 초기화
            </button>
          </div>
        )}

      {/* 카드 그리드 - 20개 이상일 때 가상화 적용 */}
      {filteredAndSortedScores.length > 0 && (
        filteredAndSortedScores.length > 20 ? (
          <VirtualizedList
            items={filteredAndSortedScores}
            itemHeight={180} // ScoreCard의 예상 높이
            containerHeight={600} // 컨테이너 높이
            renderItem={(item, index) => (
              <div className="p-2">
                <ScoreCard
                  key={item.score.id}
                  score={item.score}
                  subjectGroupName={item.subjectGroupName}
                  subjectName={item.subjectName}
                  subjectTypeName={item.subjectTypeName}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            )}
            className={cn("rounded-xl border p-4", bgSurface, borderDefault)}
            overscan={3}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedScores.map((item) => (
              <ScoreCard
                key={item.score.id}
                score={item.score}
                subjectGroupName={item.subjectGroupName}
                subjectName={item.subjectName}
                subjectTypeName={item.subjectTypeName}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export const ScoreCardGrid = memo(ScoreCardGridComponent, (prevProps, nextProps) => {
  // scores 배열의 길이와 주요 속성 비교
  if (prevProps.scores.length !== nextProps.scores.length) {
    return false;
  }
  
  // scores 배열의 각 항목 비교 (id와 주요 속성만)
  for (let i = 0; i < prevProps.scores.length; i++) {
    const prev = prevProps.scores[i];
    const next = nextProps.scores[i];
    if (
      prev.id !== next.id ||
      prev.grade !== next.grade ||
      prev.semester !== next.semester ||
      prev.raw_score !== next.raw_score ||
      prev.grade_score !== next.grade_score
    ) {
      return false;
    }
  }
  
  return (
    prevProps.initialGrade === nextProps.initialGrade &&
    prevProps.initialSemester === nextProps.initialSemester &&
    prevProps.subjectGroups.length === nextProps.subjectGroups.length &&
    prevProps.subjectTypes.length === nextProps.subjectTypes.length
  );
});

