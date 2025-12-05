"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SchoolScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { numericToAlphabetGrade, alphabetToNumericGrade, ALPHABET_GRADES } from "@/lib/scores/gradeScoreUtils";
import { addSchoolScore, updateSchoolScoreAction, deleteSchoolScoreAction } from "@/app/(student)/actions/scoreActions";

type SchoolScoresTableProps = {
  grade: number;
  semester: number;
  initialScores: SchoolScore[];
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
};

type ScoreFormData = {
  id?: string; // 기존 성적 ID (수정 시)
  subject_type_id: string; // 과목구분 ID (FK)
  subject_group_id: string;
  subject_id: string;
  credit_hours: string;
  raw_score: string;
  subject_average: string;
  standard_deviation: string;
  grade_score: string; // 알파벳 (A~E)
  total_students: string;
  rank_grade: string;
};

// 기본 교과 목록 (항상 표시) - 2022 개정 교육과정 기준
const DEFAULT_SUBJECT_GROUP_NAMES = ["국어", "수학", "영어", "한국사", "사회", "과학"];

export default function SchoolScoresTable({
  grade,
  semester,
  initialScores,
  subjectGroups,
  subjectTypes,
}: SchoolScoresTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // 모든 성적을 단일 배열로 관리
  const [scores, setScores] = useState<ScoreFormData[]>(() => {
    const scoreMap = new Map<string, ScoreFormData>();

    // 기존 성적 데이터를 맵에 저장 (subject_group:subject_name을 키로 사용)
    initialScores.forEach((score) => {
      // FK 기반으로 교과/과목 찾기
      const group = score.subject_group_id
        ? subjectGroups.find((g) => g.id === score.subject_group_id)
        : subjectGroups.find((g) => g.name === score.subject_group);
      if (!group) return;

      const subject = score.subject_id
        ? group.subjects.find((s) => s.id === score.subject_id)
        : group.subjects.find((s) => s.name === score.subject_name);
      if (!subject) return;

      // 과목구분 ID 찾기 (FK 우선, 없으면 텍스트로 찾기)
      let subjectTypeId = score.subject_type_id || "";
      if (!subjectTypeId && score.subject_type) {
        const subjectType = subjectTypes.find((st) => st.name === score.subject_type);
        subjectTypeId = subjectType?.id || "";
      }
      // 과목에 과목구분이 설정되어 있으면 사용
      if (!subjectTypeId && subject.subject_type_id) {
        subjectTypeId = subject.subject_type_id;
      }

      const key = `${group.id}:${subject.id}`;
      scoreMap.set(key, {
        id: score.id,
        subject_type_id: subjectTypeId,
        subject_group_id: group.id,
        subject_id: subject.id,
        credit_hours: score.credit_hours?.toString() || "",
        raw_score: score.raw_score?.toString() || "",
        subject_average: score.subject_average?.toString() || "",
        standard_deviation: score.standard_deviation?.toString() || "",
        grade_score: numericToAlphabetGrade(score.grade_score),
        total_students: score.total_students?.toString() || "",
        rank_grade: score.rank_grade?.toString() || "",
      });
    });

    // 기본 교과 목록을 기반으로 배열 생성
    const result: ScoreFormData[] = DEFAULT_SUBJECT_GROUP_NAMES.map((groupName) => {
      // 해당 교과 그룹 찾기
      const defaultGroup = subjectGroups.find((g) => g.name === groupName);
      if (!defaultGroup) {
        // 교과 그룹이 없으면 빈 행
        // 교과 그룹이 없으면 빈 값
        return {
          subject_type_id: "",
          subject_group_id: "",
          subject_id: "",
          credit_hours: "",
          raw_score: "",
          subject_average: "",
          standard_deviation: "",
          grade_score: "",
          total_students: "",
          rank_grade: "",
        };
      }

      // 해당 교과의 모든 과목 중 기존 성적이 있는 것 찾기
      let existingScore: ScoreFormData | undefined;
      for (const subject of defaultGroup.subjects) {
        const key = `${groupName}:${subject.name}`;
        const score = scoreMap.get(key);
        if (score) {
          existingScore = score;
          break;
        }
      }

      if (existingScore) {
        return existingScore;
      }

      // 첫 번째 과목의 과목구분 ID 사용 (없으면 빈 값)
      const firstSubject = defaultGroup.subjects[0];
      return {
        subject_type_id: firstSubject?.subject_type_id || "",
        subject_group_id: defaultGroup.id,
        subject_id: firstSubject?.id || "",
        credit_hours: "",
        raw_score: "",
        subject_average: "",
        standard_deviation: "",
        grade_score: "",
        total_students: "",
        rank_grade: "",
      };
    });

    // 기본 교과 외 추가된 성적들 추가
    scoreMap.forEach((score, key) => {
      const [groupName] = key.split(":");
      if (!DEFAULT_SUBJECT_GROUP_NAMES.includes(groupName)) {
        result.push(score);
      }
    });

    return result;
  });


  // 체크박스 토글
  const toggleRowSelection = (index: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const toggleAllSelection = () => {
    if (selectedRows.size === scores.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(scores.map((_, i) => i)));
    }
  };

  // 선택된 행들 삭제
  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) {
      alert("삭제할 항목을 선택해주세요.");
      return;
    }

    if (!confirm(`선택한 ${selectedRows.size}개 항목을 삭제하시겠습니까?`)) {
      return;
    }

    const selectedIndices = Array.from(selectedRows).sort((a, b) => b - a);
    const rowsToDelete = selectedIndices
      .map((index) => scores[index])
      .filter((row) => row.id);

    startTransition(async () => {
      try {
        // DB에서 삭제
        await Promise.all(rowsToDelete.map((row) => deleteSchoolScoreAction(row.id!)));
        // 선택된 행들을 상태에서 제거 (뒤에서부터 제거하여 인덱스 문제 방지)
        setScores((prev) => prev.filter((_, i) => !selectedRows.has(i)));
        setSelectedRows(new Set());
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "성적 삭제에 실패했습니다.");
      }
    });
  };

  // 필드 값 변경
  const updateField = (
    index: number,
    field: keyof ScoreFormData,
    value: string
  ) => {
    setScores((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };


  // 교과 선택 시 과목 필터링 및 과목구분 자동 설정
  const handleSubjectGroupChange = (index: number, groupId: string) => {
    const group = subjectGroups.find((g) => g.id === groupId);
    if (!group) {
      updateField(index, "subject_group_id", groupId);
      updateField(index, "subject_id", "");
      updateField(index, "subject_type_id", "");
      return;
    }

    // 교과 선택 시 첫 번째 과목 자동 선택 (없으면 빈 값)
    const firstSubject = group.subjects[0];
    // 첫 번째 과목의 과목구분 ID 사용 (없으면 빈 값)
    const autoSubjectTypeId = firstSubject?.subject_type_id || "";

    setScores((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              subject_group_id: group.id,
              subject_id: firstSubject?.id || "",
              subject_type_id: autoSubjectTypeId,
            }
          : row
      )
    );
  };

  // 과목 선택 시 교과 그룹 자동 설정 및 과목구분 자동 설정
  const handleSubjectChange = (index: number, subjectId: string) => {
    const group = subjectGroups.find((g) =>
      g.subjects.some((s) => s.id === subjectId)
    );
    if (group) {
      const subject = group.subjects.find((s) => s.id === subjectId);
      // 과목의 과목구분 ID 사용 (없으면 빈 값)
      const autoSubjectTypeId = subject?.subject_type_id || "";

      setScores((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                subject_id: subjectId,
                subject_group_id: group.id,
                subject_type_id: autoSubjectTypeId,
              }
            : row
        )
      );
    } else {
      updateField(index, "subject_id", subjectId);
    }
  };

  // 선택된 교과 그룹의 과목 목록만 반환
  const getSubjectsByGroupId = (groupId: string): Subject[] => {
    if (!groupId) return [];
    const group = subjectGroups.find((g) => g.id === groupId);
    return group?.subjects || [];
  };

  // 빈 행 추가
  const handleAddRow = () => {
    setScores((prev) => [
      ...prev,
      {
        subject_type_id: "",
        subject_group_id: "",
        subject_id: "",
        credit_hours: "",
        raw_score: "",
        subject_average: "",
        standard_deviation: "",
        grade_score: "",
        total_students: "",
        rank_grade: "",
      },
    ]);
  };

  // 필수 필드 검증
  const validateRow = (row: ScoreFormData): string[] => {
    const missingFields: string[] = [];
    if (!row.subject_group_id) missingFields.push("교과");
    if (!row.subject_id) missingFields.push("과목");
    if (!row.subject_type_id) missingFields.push("과목구분");
    if (!row.credit_hours) missingFields.push("학점수");
    if (!row.raw_score) missingFields.push("원점수");
    if (!row.grade_score) missingFields.push("성취도");
    return missingFields;
  };

  // 전체 저장
  const handleSaveAll = async () => {
    const rowsToSave = scores.filter((row) => {
      // 필수 필드가 모두 채워진 행만 저장
      return (
        row.subject_group_id &&
        row.subject_id &&
        row.subject_type_id &&
        row.credit_hours &&
        row.raw_score &&
        row.grade_score
      );
    });

    if (rowsToSave.length === 0) {
      // 어떤 필드가 비어있는지 확인
      const incompleteRows: Array<{ index: number; missingFields: string[] }> = [];
      scores.forEach((row, index) => {
        const missingFields = validateRow(row);
        if (missingFields.length > 0 && (row.subject_group_id || row.subject_id || row.raw_score)) {
          incompleteRows.push({ index: index + 1, missingFields });
        }
      });

      if (incompleteRows.length > 0) {
        const message = `저장할 항목이 없습니다.\n\n비어있는 필수 필드:\n${incompleteRows
          .slice(0, 3)
          .map((r) => `  ${r.index}행: ${r.missingFields.join(", ")}`)
          .join("\n")}${incompleteRows.length > 3 ? `\n  ... 외 ${incompleteRows.length - 3}개 행` : ""}`;
        alert(message);
      } else {
        alert("저장할 항목이 없습니다. 필수 필드를 모두 입력해주세요.\n\n필수 필드: 교과, 과목, 과목 유형, 학점수, 원점수, 성취도");
      }
      return;
    }

    startTransition(async () => {
      try {
        const savePromises = rowsToSave.map((row) => {
          const group = subjectGroups.find((g) => g.id === row.subject_group_id);
          const subject = group?.subjects.find((s) => s.id === row.subject_id);

          if (!group || !subject) {
            return Promise.resolve();
          }

          const formData = new FormData();
          formData.append("grade", grade.toString());
          formData.append("semester", semester.toString());
          // FK 필드 전달
          formData.append("subject_group_id", group.id);
          formData.append("subject_id", subject.id);
          if (row.subject_type_id) formData.append("subject_type_id", row.subject_type_id);
          // 하위 호환성을 위해 텍스트 필드도 함께 전달
          formData.append("subject_group", group.name);
          const subjectType = subjectTypes.find((st) => st.id === row.subject_type_id);
          if (subjectType) formData.append("subject_type", subjectType.name);
          formData.append("subject_name", subject.name);
          formData.append("credit_hours", row.credit_hours);
          formData.append("raw_score", row.raw_score);
          if (row.subject_average) formData.append("subject_average", row.subject_average);
          if (row.standard_deviation)
            formData.append("standard_deviation", row.standard_deviation);
          formData.append("grade_score", alphabetToNumericGrade(row.grade_score).toString());
          if (row.total_students) formData.append("total_students", row.total_students);
          if (row.rank_grade) formData.append("rank_grade", row.rank_grade);

          if (row.id) {
            return updateSchoolScoreAction(row.id, formData);
          } else {
            return addSchoolScore(formData);
          }
        });

        await Promise.all(savePromises);
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "성적 저장에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 버튼 영역 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            + 과목 추가
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            전체 저장
          </button>
          {selectedRows.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                선택 삭제 ({selectedRows.size})
              </button>
              <button
                type="button"
                onClick={() => setSelectedRows(new Set())}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                선택 취소
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="w-12 px-2 py-3 text-center text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedRows.size === scores.length && scores.length > 0}
                  onChange={toggleAllSelection}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="w-24 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                과목 유형 <span className="text-red-500">*</span>
              </th>
              <th className="w-24 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                교과 <span className="text-red-500">*</span>
              </th>
              <th className="w-28 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                과목 <span className="text-red-500">*</span>
              </th>
              <th className="w-20 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                학점수 <span className="text-red-500">*</span>
              </th>
              <th className="w-20 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                원점수 <span className="text-red-500">*</span>
              </th>
              <th className="w-22 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                과목평균
              </th>
              <th className="w-22 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                표준편차
              </th>
              <th className="w-20 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                성취도 <span className="text-red-500">*</span>
              </th>
              <th className="w-20 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                수강자수
              </th>
              <th className="w-22 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                석차등급
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map((row, index) => {
              const subjectsInGroup = getSubjectsByGroupId(row.subject_group_id);
              const missingFields = validateRow(row);
              const hasIncompleteRequiredFields = missingFields.length > 0 && (row.subject_group_id || row.subject_id || row.raw_score);
              
              return (
                <tr
                  key={index}
                  className={`border-b border-gray-100 transition hover:bg-gray-50 ${
                    hasIncompleteRequiredFields ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => toggleRowSelection(index)}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.subject_type_id}
                      onChange={(e) =>
                        updateField(index, "subject_type_id", e.target.value)
                      }
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        !row.subject_type_id && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                    >
                      <option value="">선택</option>
                      {subjectTypes.map((subjectType) => (
                        <option key={subjectType.id} value={subjectType.id}>
                          {subjectType.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.subject_group_id}
                      onChange={(e) => handleSubjectGroupChange(index, e.target.value)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        !row.subject_group_id && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                    >
                      <option value="">선택</option>
                      {subjectGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.subject_id}
                      onChange={(e) => handleSubjectChange(index, e.target.value)}
                      disabled={!row.subject_group_id}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        !row.subject_id && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                    >
                      <option value="">선택</option>
                      {subjectsInGroup.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={row.credit_hours}
                      onChange={(e) =>
                        updateField(index, "credit_hours", e.target.value)
                      }
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        !row.credit_hours && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                      placeholder="4"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.raw_score}
                      onChange={(e) =>
                        updateField(index, "raw_score", e.target.value)
                      }
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        !row.raw_score && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                      placeholder="85.5"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      step="0.1"
                      value={row.subject_average}
                      onChange={(e) =>
                        updateField(index, "subject_average", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="78.5"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.standard_deviation}
                      onChange={(e) =>
                        updateField(index, "standard_deviation", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="12.5"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.grade_score}
                      onChange={(e) =>
                        updateField(index, "grade_score", e.target.value)
                      }
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        !row.grade_score && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                    >
                      <option value="">선택</option>
                      {ALPHABET_GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="1"
                      value={row.total_students}
                      onChange={(e) =>
                        updateField(index, "total_students", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="120"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="1"
                      max="9"
                      value={row.rank_grade}
                      onChange={(e) =>
                        updateField(index, "rank_grade", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="1~9"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

