"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MockScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { addMockScore, updateMockScoreAction, deleteMockScoreAction } from "@/app/(student)/actions/scoreActions";

type MockScoresTableProps = {
  grade: number;
  examType: string;
  month: string;
  initialScores: MockScore[];
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
};

type MockScoreFormData = {
  id?: string; // 기존 성적 ID (수정 시)
  subject_group_id: string;
  subject_id: string;
  standard_score: string;
  percentile: string;
  grade_score: string; // 숫자 등급 (1~9)
  exam_round: string; // 회차 (월) - 탭의 월 값으로 자동 설정됨 (UI에서 입력 불가)
};

// 기본 교과 목록은 더 이상 하드코딩하지 않음
// subjectGroups props를 통해 동적으로 처리

export default function MockScoresTable({
  grade,
  examType,
  month,
  initialScores,
  subjectGroups,
  subjectTypes,
}: MockScoresTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // 모든 성적을 단일 배열로 관리
  const [scores, setScores] = useState<MockScoreFormData[]>(() => {
    const scoreMap = new Map<string, MockScoreFormData>();

    // 기존 성적 데이터를 맵에 저장 (subject_group_id:subject_id를 키로 사용)
    initialScores.forEach((score) => {
      // FK 기반으로 교과/과목 찾기
      const group = score.subject_group_id
        ? subjectGroups.find((g) => g.id === score.subject_group_id)
        : null;
      if (!group) return;

      const subject = score.subject_id
        ? group.subjects.find((s) => s.id === score.subject_id)
        : null;

      const key = `${group.id}:${subject?.id || ""}`;
      scoreMap.set(key, {
        id: score.id,
        subject_group_id: group.id,
        subject_id: subject?.id || "",
        standard_score: score.standard_score?.toString() || "",
        percentile: score.percentile?.toString() || "",
        grade_score: score.grade_score?.toString() || "",
        exam_round: month, // 탭의 월 값을 자동 사용
      });
    });

    // subjectGroups를 기반으로 배열 생성 (동적 처리)
    // 모의고사 기본 세트: 국어, 수학, 영어, 사회, 과학 (하위 호환성을 위해 기본값 유지)
    const defaultSubjectGroupNames = ["국어", "수학", "영어", "사회", "과학"];
    
    // 먼저 기본 교과 그룹들을 찾아서 배열 생성
    const result: MockScoreFormData[] = [];
    
    // 기본 교과 그룹들을 순회하며 행 생성
    for (const groupName of defaultSubjectGroupNames) {
      const defaultGroup = subjectGroups.find((g) => g.name === groupName);
      if (!defaultGroup) {
        // 교과 그룹이 없으면 빈 행 추가
        result.push({
          subject_group_id: "",
          subject_id: "",
          standard_score: "",
          percentile: "",
          grade_score: "",
          exam_round: month,
        });
        continue;
      }

      // 국어/수학/영어는 과목을 사용하지 않음
      const shouldUseSubject = ["사회", "과학"].includes(groupName);
      const firstSubject = defaultGroup.subjects[0];
      const key = firstSubject ? `${defaultGroup.id}:${firstSubject.id}` : `${defaultGroup.id}:`;
      const existingScore = scoreMap.get(key);

      if (existingScore) {
        result.push(existingScore);
      } else {
        result.push({
          subject_group_id: defaultGroup.id,
          subject_id: shouldUseSubject ? (firstSubject?.id || "") : "",
          standard_score: "",
          percentile: "",
          grade_score: "",
          exam_round: month,
        });
      }
    }

    // 기본 교과 외 추가된 성적들 추가
    scoreMap.forEach((score, key) => {
      const [groupId] = key.split(":");
      const group = subjectGroups.find((g) => g.id === groupId);
      if (group && !defaultSubjectGroupNames.includes(group.name)) {
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
        await Promise.all(rowsToDelete.map((row) => deleteMockScoreAction(row.id!)));
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
    field: keyof MockScoreFormData,
    value: string
  ) => {
    setScores((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  // 교과 선택 시 과목 필터링
  const handleSubjectGroupChange = (index: number, groupId: string) => {
    const group = subjectGroups.find((g) => g.id === groupId);
    if (!group) {
      updateField(index, "subject_group_id", groupId);
      updateField(index, "subject_id", "");
      return;
    }

    // 사회/과학일 때만 과목 선택, 국어/수학/영어는 과목을 사용하지 않음
    const shouldUseSubject = ["사회", "과학"].includes(group.name);
    const firstSubject = group.subjects[0];

    setScores((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              subject_group_id: group.id,
              subject_id: shouldUseSubject ? (firstSubject?.id || "") : "",
            }
          : row
      )
    );
  };

  // 과목 선택 시 교과 그룹 자동 설정
  const handleSubjectChange = (index: number, subjectId: string) => {
    const group = subjectGroups.find((g) =>
      g.subjects.some((s) => s.id === subjectId)
    );
    if (group) {
      setScores((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                subject_id: subjectId,
                subject_group_id: group.id,
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
        subject_group_id: "",
        subject_id: "",
        standard_score: "",
        percentile: "",
        grade_score: "",
        exam_round: month,
      },
    ]);
  };

  // 과목 선택이 필요한 교과인지 확인
  const shouldShowSubjectSelect = (groupName: string | null): boolean => {
    if (!groupName) return false;
    return ["사회", "과학"].includes(groupName);
  };

  // 필수 필드 검증
  const validateRow = (row: MockScoreFormData): string[] => {
    const missingFields: string[] = [];
    const group = subjectGroups.find((g) => g.id === row.subject_group_id);
    const isEnglishOrKoreanHistory = group?.name === "영어" || group?.name === "한국사";
    const needsSubject = shouldShowSubjectSelect(group?.name || null);
    
    if (!row.subject_group_id) missingFields.push("교과");
    if (needsSubject && !row.subject_id) missingFields.push("과목");
    if (!row.grade_score) missingFields.push("등급");
    if (!isEnglishOrKoreanHistory) {
      if (!row.standard_score) missingFields.push("표준점수");
      if (!row.percentile) missingFields.push("백분위");
    }
    return missingFields;
  };

  // 전체 저장
  const handleSaveAll = async () => {
    const rowsToSave = scores.filter((row) => {
      // 필수 필드가 모두 채워진 행만 저장
      // 영어/한국사가 아닌 경우 표준점수, 백분위도 필수
      const group = subjectGroups.find((g) => g.id === row.subject_group_id);
      const isEnglishOrKoreanHistory = group?.name === "영어" || group?.name === "한국사";
      
      const needsSubject = shouldShowSubjectSelect(group?.name || null);
      return (
        row.subject_group_id &&
        (!needsSubject || row.subject_id) &&
        row.grade_score &&
        (isEnglishOrKoreanHistory || (row.standard_score && row.percentile))
      );
    });

    if (rowsToSave.length === 0) {
      // 어떤 필드가 비어있는지 확인
      const incompleteRows: Array<{ index: number; missingFields: string[] }> = [];
      scores.forEach((row, index) => {
        const missingFields = validateRow(row);
        if (missingFields.length > 0 && (row.subject_group_id || row.subject_id || row.grade_score)) {
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
        alert("저장할 항목이 없습니다. 필수 필드를 모두 입력해주세요.\n\n필수 필드: 교과, 과목, 등급, 표준점수(영어/한국사 제외), 백분위(영어/한국사 제외)");
      }
      return;
    }

    startTransition(async () => {
      try {
        const savePromises = rowsToSave.map((row) => {
          const group = subjectGroups.find((g) => g.id === row.subject_group_id);
          const needsSubject = shouldShowSubjectSelect(group?.name || null);
          const subject = needsSubject && row.subject_id 
            ? group?.subjects.find((s) => s.id === row.subject_id)
            : null;

          if (!group || (needsSubject && !subject)) {
            return Promise.resolve();
          }

          const formData = new FormData();
          formData.append("grade", grade.toString());
          formData.append("exam_type", examType);
          // FK 필드 전달
          formData.append("subject_group_id", group.id);
          if (needsSubject && subject) {
            formData.append("subject_id", subject.id);
            formData.append("subject_name", subject.name);
          } else {
            // 국어/수학/영어는 subject_id를 빈 문자열로 저장
            formData.append("subject_id", "");
            formData.append("subject_name", "");
          }
          // 하위 호환성을 위해 텍스트 필드도 함께 전달
          formData.append("subject_group", group.name);
          // raw_score는 null (모의고사에는 원점수가 없음)
          if (row.standard_score) formData.append("standard_score", row.standard_score);
          if (row.percentile) formData.append("percentile", row.percentile);
          formData.append("grade_score", row.grade_score);
          formData.append("exam_round", month); // 탭의 월 값을 자동 사용

          if (row.id) {
            return updateMockScoreAction(row.id, formData);
          } else {
            return addMockScore(formData);
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
                교과 <span className="text-red-500">*</span>
              </th>
              <th className="w-28 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                과목 <span className="text-red-500">*</span>
              </th>
              <th className="w-22 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                표준점수 <span className="text-red-500 text-xs">*</span>
                <span className="text-xs text-gray-500 block font-normal">(영어/한국사 제외)</span>
              </th>
              <th className="w-22 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                백분위 <span className="text-red-500 text-xs">*</span>
                <span className="text-xs text-gray-500 block font-normal">(영어/한국사 제외)</span>
              </th>
              <th className="w-20 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                등급 <span className="text-red-500">*</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map((row, index) => {
              const subjectsInGroup = getSubjectsByGroupId(row.subject_group_id);
              const missingFields = validateRow(row);
              const group = subjectGroups.find((g) => g.id === row.subject_group_id);
              const isEnglishOrKoreanHistory = group?.name === "영어" || group?.name === "한국사";
              const needsSubject = shouldShowSubjectSelect(group?.name || null);
              const hasIncompleteRequiredFields = missingFields.length > 0 && (row.subject_group_id || (needsSubject && row.subject_id) || row.grade_score);
              
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
                  {needsSubject ? (
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
                  ) : (
                    <td className="px-3 py-3 text-xs text-gray-500">-</td>
                  )}
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      step="0.1"
                      value={row.standard_score}
                      onChange={(e) =>
                        updateField(index, "standard_score", e.target.value)
                      }
                      disabled={isEnglishOrKoreanHistory}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        !row.standard_score && hasIncompleteRequiredFields && !isEnglishOrKoreanHistory
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                      placeholder="130"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={row.percentile}
                      onChange={(e) =>
                        updateField(index, "percentile", e.target.value)
                      }
                      disabled={isEnglishOrKoreanHistory}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        !row.percentile && hasIncompleteRequiredFields && !isEnglishOrKoreanHistory
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
                      placeholder="95.5"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="1"
                      max="9"
                      step="1"
                      value={row.grade_score}
                      onChange={(e) =>
                        updateField(index, "grade_score", e.target.value)
                      }
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        !row.grade_score && hasIncompleteRequiredFields
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-indigo-500"
                      }`}
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

