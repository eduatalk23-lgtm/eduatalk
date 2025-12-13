"use client";

import { useMemo, useState } from "react";
import { MockScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { MockScoreCard } from "./MockScoreCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Plus, Filter, ArrowUpDown, FileText } from "lucide-react";
import { cn } from "@/lib/cn";

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

  // 필터링 및 정렬
  const filteredAndSortedScores = useMemo(() => {
    let filtered = [...scoresWithInfo];

    // 학년 필터링
    if (filterGrade !== "all") {
      filtered = filtered.filter(
        (item) => item.score.grade === parseInt(filterGrade)
      );
    }

    // 시험 유형 필터링 (exam_title에서 추출)
    if (filterExamType !== "all") {
      filtered = filtered.filter(
        (item) => item.score.exam_title.includes(filterExamType)
      );
    }

    // 회차 필터링 (exam_date에서 월 추출)
    if (filterMonth !== "all") {
      filtered = filtered.filter(
        (item) => {
          const month = (new Date(item.score.exam_date).getMonth() + 1).toString();
          return month === filterMonth;
        }
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
        case "examType":
          aValue = a.score.exam_title ?? "";
          bValue = b.score.exam_title ?? "";
          break;
        case "month":
          aValue = (new Date(a.score.exam_date).getMonth() + 1).toString();
          bValue = (new Date(b.score.exam_date).getMonth() + 1).toString();
          break;
        case "grade_score":
          aValue = a.score.grade_score ?? 999;
          bValue = b.score.grade_score ?? 999;
          break;
        case "standard_score":
          aValue = a.score.standard_score ?? 0;
          bValue = b.score.standard_score ?? 0;
          break;
        case "percentile":
          aValue = a.score.percentile ?? 0;
          bValue = b.score.percentile ?? 0;
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
  }, [scoresWithInfo, sortField, sortOrder, filterGrade, filterExamType, filterMonth, filterSubjectGroup, filterSubject, filterSubjectType]);

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
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                showFilters
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
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
            <span className="text-sm text-gray-600">
              총 {filteredAndSortedScores.length}개
            </span>
          </div>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <div className="flex flex-col gap-4 border-t border-gray-200 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* 학년 필터 */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-gray-700">
                학년
              </label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">전체</option>
                {availableGrades.map((grade) => (
                  <option key={grade} value={grade.toString()}>
                    {grade}학년
                  </option>
                ))}
              </select>
            </div>

            {/* 시험 유형 필터 */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-gray-700">
                시험 유형
              </label>
              <select
                value={filterExamType}
                onChange={(e) => setFilterExamType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">전체</option>
                {availableExamTypes.map((examType) => (
                  <option key={examType} value={examType}>
                    {examType}
                  </option>
                ))}
              </select>
            </div>

            {/* 회차 필터 */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-gray-700">
                회차
              </label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">전체</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                ))}
              </select>
            </div>

            {/* 교과 필터 */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-gray-700">
                교과
              </label>
              <select
                value={filterSubjectGroup}
                onChange={(e) => {
                  setFilterSubjectGroup(e.target.value);
                  setFilterSubject("all"); // 교과 변경 시 과목 필터 초기화
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <label className="block text-xs font-medium text-gray-700">
                과목
              </label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <label className="block text-xs font-medium text-gray-700">
                과목 유형
              </label>
              <select
                value={filterSubjectType}
                onChange={(e) => setFilterSubjectType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <label className="block text-xs font-medium text-gray-700">
                정렬 순서
              </label>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition hover:bg-gray-50"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === "asc" ? "오름차순" : "내림차순"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

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

