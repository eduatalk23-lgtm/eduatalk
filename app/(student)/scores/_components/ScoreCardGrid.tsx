"use client";

import { useMemo, useState, memo } from "react";
import { SchoolScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { ScoreCard } from "./ScoreCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { VirtualizedList } from "@/lib/components/VirtualizedList";
import { bgSurface, textSecondary, textMuted, borderDefault } from "@/lib/utils/darkMode";
import { useScoreFilter } from "@/lib/hooks/useScoreFilter";
import { ScoreGridFilterBar } from "./ScoreGridFilterBar";

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

  // useScoreFilter 훅 사용
  const {
    filteredAndSortedScores,
    availableSubjectGroups,
    availableSubjectTypes,
    availableSubjects,
    availableGrades,
  } = useScoreFilter<SchoolScore>(
    scoresWithInfo,
    {
      grade: filterGrade,
      semester: filterSemester,
      subjectGroup: filterSubjectGroup,
      subject: filterSubject,
      subjectType: filterSubjectType,
    },
    {
      field: sortField,
      order: sortOrder,
      getValue: (item, field) => {
        switch (field) {
          case "grade":
            return item.score.grade ?? 0;
          case "semester":
            return item.score.semester ?? 0;
          case "grade_score":
            return item.score.grade_score ?? 999;
          case "raw_score":
            return item.score.raw_score ?? 0;
          case "subject_name":
            return item.subjectName;
          default:
            return null;
        }
      },
    }
  );

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
      <ScoreGridFilterBar
        filters={{
          grade: filterGrade,
          semester: filterSemester,
          subjectGroup: filterSubjectGroup,
          subject: filterSubject,
          subjectType: filterSubjectType,
        }}
        sortOrder={sortOrder}
        showFilters={showFilters}
        totalCount={filteredAndSortedScores.length}
        filterOptions={{
          availableGrades,
          availableSemesters,
          availableSubjectGroups,
          availableSubjects,
          availableSubjectTypes,
        }}
        onFilterChange={(updates) => {
          if (updates.grade !== undefined) setFilterGrade(updates.grade || "all");
          if (updates.semester !== undefined) setFilterSemester(updates.semester || "all");
          if (updates.subjectGroup !== undefined) setFilterSubjectGroup(updates.subjectGroup);
          if (updates.subject !== undefined) setFilterSubject(updates.subject);
          if (updates.subjectType !== undefined) setFilterSubjectType(updates.subjectType);
        }}
        onSortOrderChange={setSortOrder}
        onShowFiltersToggle={() => setShowFilters(!showFilters)}
        onAddClick={onAddClick}
        variant="internal"
      />

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

