"use client";

import { useMemo, useState } from "react";
import { MockScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { MockScoreCard } from "./MockScoreCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { useScoreFilter } from "@/lib/hooks/useScoreFilter";
import { ScoreGridFilterBar } from "@/app/(student)/scores/_components/ScoreGridFilterBar";

type MockScoreCardGridProps = {
  initialGrade?: number;
  initialExamType?: string;
  initialMonth?: string;
  scores: MockScore[];
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  onAddClick?: () => void;
  onEdit: (score: MockScore) => void;
  onDelete: (scoreId: string) => void;
};

type SortField = "grade" | "examType" | "month" | "grade_score" | "standard_score" | "percentile" | "subject_name";
type SortOrder = "asc" | "desc";

const examTypes = ["평가원", "교육청", "사설"];
const months = ["3", "4", "5", "6", "7", "8", "9", "10", "11"];

export function MockScoreCardGrid({
  initialGrade,
  initialExamType,
  initialMonth,
  scores,
  subjectGroups,
  subjectTypes,
  onAddClick,
  onEdit,
  onDelete,
}: MockScoreCardGridProps) {
  const [sortField, setSortField] = useState<SortField>("grade");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterGrade, setFilterGrade] = useState<string>(initialGrade?.toString() || "all");
  const [filterExamType, setFilterExamType] = useState<string>(initialExamType || "all");
  const [filterMonth, setFilterMonth] = useState<string>(initialMonth || "all");
  const [filterSubjectGroup, setFilterSubjectGroup] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterSubjectType, setFilterSubjectType] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // 성적 데이터에 과목 정보 매핑
  const scoresWithInfo = useMemo(() => {
    return scores.map((score) => {
      const group = score.subject_group_id
        ? subjectGroups.find((g) => g.id === score.subject_group_id)
        : null;
      const subject = score.subject_id && group
        ? group.subjects.find((s) => s.id === score.subject_id)
        : null;
      // MockScore 타입에 subject_type_id가 없으므로 subjectType은 항상 null
      const subjectType = null;

      return {
        score,
        subjectGroupName: group?.name || "",
        subjectName: subject?.name || "",
        subjectTypeName: "", // MockScore 타입에 subject_type_id가 없으므로 항상 빈 문자열
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
  } = useScoreFilter<MockScore>(
    scoresWithInfo,
    {
      grade: filterGrade,
      examType: filterExamType,
      month: filterMonth,
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
          case "examType":
            return item.score.exam_title ?? "";
          case "month":
            return (new Date(item.score.exam_date).getMonth() + 1).toString();
          case "grade_score":
            return item.score.grade_score ?? 999;
          case "standard_score":
            return item.score.standard_score ?? 0;
          case "percentile":
            return item.score.percentile ?? 0;
          case "subject_name":
            return item.subjectName;
          default:
            return null;
        }
      },
    }
  );

  const availableExamTypes = useMemo(() => {
    const types = new Set<string>();
    scoresWithInfo.forEach((item) => {
      // exam_title에서 시험 유형 추출 (예: "2024학년도 3월 평가원 모의고사" -> "평가원")
      const examTitle = item.score.exam_title || "";
      if (examTitle.includes("평가원")) types.add("평가원");
      if (examTitle.includes("교육청")) types.add("교육청");
      if (examTitle.includes("사설")) types.add("사설");
    });
    return Array.from(types).sort();
  }, [scoresWithInfo]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    scoresWithInfo.forEach((item) => {
      const month = (new Date(item.score.exam_date).getMonth() + 1).toString();
      monthsSet.add(month);
    });
    return Array.from(monthsSet).sort((a, b) => parseInt(a) - parseInt(b));
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
          examType: filterExamType,
          month: filterMonth,
          subjectGroup: filterSubjectGroup,
          subject: filterSubject,
          subjectType: filterSubjectType,
        }}
        sortOrder={sortOrder}
        showFilters={showFilters}
        totalCount={filteredAndSortedScores.length}
        filterOptions={{
          availableGrades,
          availableExamTypes,
          availableMonths,
          availableSubjectGroups,
          availableSubjects,
          availableSubjectTypes,
        }}
        onFilterChange={(updates) => {
          if (updates.grade !== undefined) setFilterGrade(updates.grade || "all");
          if (updates.examType !== undefined) setFilterExamType(updates.examType || "all");
          if (updates.month !== undefined) setFilterMonth(updates.month || "all");
          if (updates.subjectGroup !== undefined) setFilterSubjectGroup(updates.subjectGroup);
          if (updates.subject !== undefined) setFilterSubject(updates.subject);
          if (updates.subjectType !== undefined) setFilterSubjectType(updates.subjectType);
        }}
        onSortOrderChange={setSortOrder}
        onShowFiltersToggle={() => setShowFilters(!showFilters)}
        onAddClick={onAddClick}
        variant="mock"
      />

      {/* 필터 적용 중일 때 결과가 없을 경우 */}
      {(filterGrade !== "all" || filterExamType !== "all" || filterMonth !== "all" || filterSubjectGroup !== "all" || filterSubject !== "all" || filterSubjectType !== "all") &&
        filteredAndSortedScores.length === 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              선택한 필터 조건에 맞는 성적이 없습니다.
            </p>
            <button
              onClick={() => {
                setFilterGrade("all");
                setFilterExamType("all");
                setFilterMonth("all");
                setFilterSubjectGroup("all");
                setFilterSubject("all");
                setFilterSubjectType("all");
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              필터 초기화
            </button>
          </div>
        )}

      {/* 카드 그리드 */}
      {filteredAndSortedScores.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedScores.map((item) => (
            <MockScoreCard
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
      )}
    </div>
  );
}

