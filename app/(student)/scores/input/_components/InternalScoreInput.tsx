"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";
import type { InternalScoreInputForm } from "@/lib/types/scoreInput";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { createInternalScoresBatch } from "@/lib/domains/score/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type InternalScoreInputProps = {
  studentId: string;
  tenantId: string;
  curriculumRevisionId: string;
  subjectGroups: (SubjectGroup & {
    subjects: Array<{
      id: string;
      subject_group_id: string;
      name: string;
      subject_type_id?: string | null;
      subject_type?: string | null;
    }>;
  })[];
  subjectTypes: SubjectType[];
};

type ScoreRow = InternalScoreInputForm & {
  id: string; // 클라이언트용 임시 ID
};

export default function InternalScoreInput({
  studentId,
  tenantId,
  curriculumRevisionId,
  subjectGroups,
  subjectTypes,
}: InternalScoreInputProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [grade, setGrade] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [changedRowIds, setChangedRowIds] = useState<Set<string>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 페이지 이탈 방지
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // 성적 변경 감지
  useEffect(() => {
    if (scores.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [scores]);

  // 새로운 성적 행 추가
  const addScoreRow = () => {
    const newRow: ScoreRow = {
      id: `temp-${Date.now()}`,
      subject_group_id: "",
      subject_id: "",
      subject_type_id: "",
      grade,
      semester,
      credit_hours: 4,
      rank_grade: 1,
      raw_score: null,
      avg_score: null,
      std_dev: null,
      total_students: null,
    };
    setScores([...scores, newRow]);
  };

  // 성적 행 삭제
  const removeScoreRow = (id: string) => {
    setScores(scores.filter((row) => row.id !== id));
  };

  // 필드 업데이트
  const updateScoreField = <K extends keyof ScoreRow>(
    id: string,
    field: K,
    value: ScoreRow[K]
  ) => {
    setScores(
      scores.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    
    // 변경된 행 ID 추적
    setChangedRowIds((prev) => new Set(prev).add(id));
    
    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 2초 후 자동 저장
    setSaveStatus("idle");
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave(id);
    }, 2000);
  };
  
  // 자동 저장 핸들러
  const handleAutoSave = async (rowId: string) => {
    const row = scores.find((r) => r.id === rowId);
    if (!row) return;
    
    // 필수 필드 검증
    if (
      !row.subject_group_id ||
      !row.subject_id ||
      !row.subject_type_id ||
      row.credit_hours <= 0 ||
      row.rank_grade < 1 ||
      row.rank_grade > 9
    ) {
      return; // 필수 필드가 없으면 저장하지 않음
    }
    
    setSaveStatus("saving");
    
    try {
      const formData = new FormData();
      formData.append("student_id", studentId);
      formData.append("tenant_id", tenantId);
      formData.append("curriculum_revision_id", curriculumRevisionId);
      formData.append("school_year", calculateSchoolYear().toString());
      formData.append("scores", JSON.stringify([
        (() => {
          const { id, ...scoreData } = row;
          return scoreData;
        })()
      ]));

      const result = await createInternalScoresBatch(formData);

      if (!result.success) {
        throw new Error("자동 저장에 실패했습니다.");
      }

      // 저장 성공 시 변경된 행 ID 제거
      setChangedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      
      setSaveStatus("saved");
      
      // 3초 후 상태 초기화
      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "자동 저장 중 오류가 발생했습니다.";
      setError(errorMessage);
      setSaveStatus("idle");
    }
  };
  
  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 교과군 변경 시 과목 초기화
  const handleSubjectGroupChange = (id: string, subjectGroupId: string) => {
    setScores(
      scores.map((row) =>
        row.id === id
          ? { ...row, subject_group_id: subjectGroupId, subject_id: "" }
          : row
      )
    );
    
    // 변경된 행 ID 추적
    setChangedRowIds((prev) => new Set(prev).add(id));
    
    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 2초 후 자동 저장
    setSaveStatus("idle");
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave(id);
    }, 2000);
  };

  // 선택된 교과군의 과목 목록
  const getSubjectsForGroup = (subjectGroupId: string) => {
    const group = subjectGroups.find((g) => g.id === subjectGroupId);
    return group?.subjects || [];
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 유효성 검증
    if (scores.length === 0) {
      setError("최소 1개 이상의 성적을 입력하세요.");
      return;
    }

    for (const score of scores) {
      if (
        !score.subject_group_id ||
        !score.subject_id ||
        !score.subject_type_id
      ) {
        setError("교과군, 과목, 과목구분은 필수 항목입니다.");
        return;
      }
      if (score.credit_hours <= 0) {
        setError("학점수는 0보다 커야 합니다.");
        return;
      }
      if (score.rank_grade < 1 || score.rank_grade > 9) {
        setError("석차등급은 1~9 사이여야 합니다.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("student_id", studentId);
        formData.append("tenant_id", tenantId);
        formData.append("curriculum_revision_id", curriculumRevisionId);
        formData.append("school_year", calculateSchoolYear().toString());
        formData.append("scores", JSON.stringify(
          scores.map((s) => {
            const { id, ...scoreData } = s;
            return scoreData;
          })
        ));

        const result = await createInternalScoresBatch(formData);

        if (!result.success) {
          throw new Error("성적 저장에 실패했습니다.");
        }

        // 성공 메시지 표시
        const savedCount = scores.length;
        showSuccess(`${savedCount}건의 성적이 저장되었습니다.`);
        setHasUnsavedChanges(false);

        // 성공 시 통합 대시보드로 이동
        router.push("/scores/dashboard/unified");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        setError(errorMessage);
        showError(errorMessage);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* 저장 상태 표시 */}
      {saveStatus !== "idle" && (
        <div className={cn(
          "rounded-lg border p-3 text-sm",
          saveStatus === "saving"
            ? "bg-blue-50 border-blue-200 text-blue-800"
            : "bg-green-50 border-green-200 text-green-800"
        )}>
          {saveStatus === "saving" ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span>저장 중...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>모든 변경사항이 저장되었습니다.</span>
            </div>
          )}
        </div>
      )}
      
      {/* 학년/학기 선택 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700">
                학년 <span className="text-red-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={1}>1학년</option>
                <option value={2}>2학년</option>
                <option value={3}>3학년</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700">
                학기 <span className="text-red-500">*</span>
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={1}>1학기</option>
                <option value={2}>2학기</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 성적 입력 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">성적 입력</h2>
            <button
              type="button"
              onClick={addScoreRow}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              + 과목 추가
            </button>
          </div>

          {scores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">과목 추가 버튼을 클릭하여 성적을 입력하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      교과군
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      과목
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      과목구분
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      학점
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      석차등급
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      원점수
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      과목평균
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      표준편차
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700">
                      수강자수
                    </th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="px-3 py-3">
                        <select
                          value={row.subject_group_id}
                          onChange={(e) =>
                            handleSubjectGroupChange(row.id, e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                          onChange={(e) =>
                            updateScoreField(row.id, "subject_id", e.target.value)
                          }
                          disabled={!row.subject_group_id}
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
                        >
                          <option value="">선택</option>
                          {getSubjectsForGroup(row.subject_group_id).map(
                            (subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={row.subject_type_id}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "subject_type_id",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">선택</option>
                          {subjectTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.credit_hours}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "credit_hours",
                              Number(e.target.value)
                            )
                          }
                          min="1"
                          step="1"
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.rank_grade}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "rank_grade",
                              Number(e.target.value)
                            )
                          }
                          min="1"
                          max="9"
                          step="1"
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.raw_score ?? ""}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "raw_score",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          step="0.1"
                          placeholder="85.5"
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.avg_score ?? ""}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "avg_score",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          step="0.1"
                          placeholder="78.2"
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.std_dev ?? ""}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "std_dev",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          step="0.1"
                          placeholder="12.5"
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.total_students ?? ""}
                          onChange={(e) =>
                            updateScoreField(
                              row.id,
                              "total_students",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          step="1"
                          placeholder="30"
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeScoreRow(row.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending || scores.length === 0}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isPending ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </form>
  );
}

