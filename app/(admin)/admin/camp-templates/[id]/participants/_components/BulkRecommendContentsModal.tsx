"use client";

import { useState, useEffect, useTransition } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { bulkApplyRecommendedContents } from "@/app/(admin)/actions/campTemplateActions";
import { AVAILABLE_SUBJECTS } from "@/app/(student)/plan/new-group/_components/Step4RecommendedContents/constants";
import { Minus, Plus, Users, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

type Participant = {
  groupId: string;
  studentId: string;
  studentName: string;
};

type BulkRecommendContentsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  participants: Participant[];
  onSuccess?: () => void;
};

type SubjectCounts = Record<string, number>; // subject -> count
type StudentSubjectCounts = Record<string, SubjectCounts>; // groupId -> (subject -> count)

export function BulkRecommendContentsModal({
  open,
  onOpenChange,
  templateId,
  participants,
  onSuccess,
}: BulkRecommendContentsModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  
  // 학생별 교과/수량 설정: groupId -> (subject -> count)
  const [subjectCounts, setSubjectCounts] = useState<StudentSubjectCounts>({});
  
  // 학생 선택 체크박스
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(participants.map((p) => p.groupId))
  );
  
  // 개별 조율 팝오버 상태
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  
  // 전체 조율 설정
  const [globalSubjectCounts, setGlobalSubjectCounts] = useState<SubjectCounts>({});
  const [globalAdjustSubject, setGlobalAdjustSubject] = useState<string>("");
  const [globalAdjustAmount, setGlobalAdjustAmount] = useState<number>(0);
  
  // 개별 조율 설정
  const [individualSubjectCounts, setIndividualSubjectCounts] = useState<SubjectCounts>({});
  const [individualAdjustSubject, setIndividualAdjustSubject] = useState<string>("");
  const [individualAdjustAmount, setIndividualAdjustAmount] = useState<number>(0);
  
  // 적용 옵션
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);

  // 초기화: 모든 학생의 수량을 0으로 설정
  useEffect(() => {
    if (open && participants.length > 0) {
      const initialCounts: StudentSubjectCounts = {};
      participants.forEach((p) => {
        initialCounts[p.groupId] = {};
        AVAILABLE_SUBJECTS.forEach((subject) => {
          initialCounts[p.groupId][subject] = 0;
        });
      });
      setSubjectCounts(initialCounts);
      setSelectedStudentIds(new Set(participants.map((p) => p.groupId)));
    }
  }, [open, participants]);

  // 학생당 총합 계산
  const calculateTotal = (groupId: string): number => {
    const counts = subjectCounts[groupId] || {};
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  };

  // 전체 통계 계산
  const calculateSummary = () => {
    let totalContents = 0;
    const subjectTotals: Record<string, number> = {};
    let overLimitCount = 0;

    participants.forEach((p) => {
      const total = calculateTotal(p.groupId);
      totalContents += total;
      if (total > 9) {
        overLimitCount++;
      }

      AVAILABLE_SUBJECTS.forEach((subject) => {
        const count = subjectCounts[p.groupId]?.[subject] || 0;
        subjectTotals[subject] = (subjectTotals[subject] || 0) + count;
      });
    });

    return {
      totalContents,
      subjectTotals,
      overLimitCount,
    };
  };

  // 학생당 최대 9개 제한 검증
  const validateCounts = (): { valid: boolean; errors: Array<{ groupId: string; studentName: string; total: number }> } => {
    const errors: Array<{ groupId: string; studentName: string; total: number }> = [];
    
    participants.forEach((p) => {
      const total = calculateTotal(p.groupId);
      if (total > 9) {
        errors.push({
          groupId: p.groupId,
          studentName: p.studentName,
          total,
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  };

  // 수량 업데이트
  const updateCount = (groupId: string, subject: string, count: number) => {
    setSubjectCounts((prev) => {
      const newCounts = { ...prev };
      if (!newCounts[groupId]) {
        newCounts[groupId] = {};
      }
      newCounts[groupId] = {
        ...newCounts[groupId],
        [subject]: Math.max(0, Math.min(9, count)), // 0-9 범위 제한
      };
      return newCounts;
    });
  };

  // 전체 일괄 적용
  const handleGlobalApply = () => {
    const newCounts = { ...subjectCounts };
    participants.forEach((p) => {
      if (!newCounts[p.groupId]) {
        newCounts[p.groupId] = {};
      }
      AVAILABLE_SUBJECTS.forEach((subject) => {
        newCounts[p.groupId][subject] = globalSubjectCounts[subject] || 0;
      });
    });
    setSubjectCounts(newCounts);
    setGlobalSubjectCounts({});
    toast.showSuccess("모든 학생에게 일괄 적용되었습니다.");
  };

  // 전체 증가/감소
  const handleGlobalAdjust = () => {
    if (!globalAdjustSubject || globalAdjustAmount === 0) {
      toast.showError("교과와 조정량을 선택해주세요.");
      return;
    }

    const newCounts = { ...subjectCounts };
    participants.forEach((p) => {
      if (!newCounts[p.groupId]) {
        newCounts[p.groupId] = {};
      }
      const current = newCounts[p.groupId][globalAdjustSubject] || 0;
      const newValue = Math.max(0, Math.min(9, current + globalAdjustAmount));
      newCounts[p.groupId][globalAdjustSubject] = newValue;
    });
    setSubjectCounts(newCounts);
    setGlobalAdjustSubject("");
    setGlobalAdjustAmount(0);
    toast.showSuccess(`모든 학생의 ${globalAdjustSubject} 수량이 조정되었습니다.`);
  };

  // 선택한 학생 일괄 적용
  const handleIndividualApply = () => {
    if (selectedStudentIds.size === 0) {
      toast.showError("적용할 학생을 선택해주세요.");
      return;
    }

    const newCounts = { ...subjectCounts };
    selectedStudentIds.forEach((groupId) => {
      if (!newCounts[groupId]) {
        newCounts[groupId] = {};
      }
      AVAILABLE_SUBJECTS.forEach((subject) => {
        newCounts[groupId][subject] = individualSubjectCounts[subject] || 0;
      });
    });
    setSubjectCounts(newCounts);
    setIndividualSubjectCounts({});
    setOpenPopoverId(null);
    toast.showSuccess(`${selectedStudentIds.size}명의 학생에게 일괄 적용되었습니다.`);
  };

  // 선택한 학생 증가/감소
  const handleIndividualAdjust = () => {
    if (selectedStudentIds.size === 0) {
      toast.showError("조정할 학생을 선택해주세요.");
      return;
    }
    if (!individualAdjustSubject || individualAdjustAmount === 0) {
      toast.showError("교과와 조정량을 선택해주세요.");
      return;
    }

    const newCounts = { ...subjectCounts };
    selectedStudentIds.forEach((groupId) => {
      if (!newCounts[groupId]) {
        newCounts[groupId] = {};
      }
      const current = newCounts[groupId][individualAdjustSubject] || 0;
      const newValue = Math.max(0, Math.min(9, current + individualAdjustAmount));
      newCounts[groupId][individualAdjustSubject] = newValue;
    });
    setSubjectCounts(newCounts);
    setIndividualAdjustSubject("");
    setIndividualAdjustAmount(0);
    setOpenPopoverId(null);
    toast.showSuccess(`${selectedStudentIds.size}명의 학생의 ${individualAdjustSubject} 수량이 조정되었습니다.`);
  };

  // 선택한 학생 초기화
  const handleIndividualReset = () => {
    if (selectedStudentIds.size === 0) {
      toast.showError("초기화할 학생을 선택해주세요.");
      return;
    }

    const newCounts = { ...subjectCounts };
    selectedStudentIds.forEach((groupId) => {
      if (!newCounts[groupId]) {
        newCounts[groupId] = {};
      }
      AVAILABLE_SUBJECTS.forEach((subject) => {
        newCounts[groupId][subject] = 0;
      });
    });
    setSubjectCounts(newCounts);
    setOpenPopoverId(null);
    toast.showSuccess(`${selectedStudentIds.size}명의 학생이 초기화되었습니다.`);
  };

  // 제출
  const handleSubmit = () => {
    const validation = validateCounts();
    if (!validation.valid) {
      const errorMsg = validation.errors
        .map((e) => `${e.studentName}: ${e.total}개 (최대 9개)`)
        .join(", ");
      toast.showError(`최대 수량을 초과한 학생이 있습니다: ${errorMsg}`);
      return;
    }

    // groupId -> (subject -> count) 형식으로 변환
    const subjectCountsMap: Record<string, Record<string, number>> = {};
    participants.forEach((p) => {
      const counts = subjectCounts[p.groupId] || {};
      const filteredCounts: Record<string, number> = {};
      AVAILABLE_SUBJECTS.forEach((subject) => {
        const count = counts[subject] || 0;
        if (count > 0) {
          filteredCounts[subject] = count;
        }
      });
      if (Object.keys(filteredCounts).length > 0) {
        subjectCountsMap[p.groupId] = filteredCounts;
      }
    });

    if (Object.keys(subjectCountsMap).length === 0) {
      toast.showError("적용할 추천 콘텐츠가 없습니다. 최소 1개 이상의 교과/수량을 설정해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkApplyRecommendedContents(
          templateId,
          participants.map((p) => p.groupId),
          subjectCountsMap,
          { replaceExisting }
        );

        if (result.success) {
          toast.showSuccess(
            `${result.successCount}명의 학생에게 추천 콘텐츠가 적용되었습니다.`
          );
          onSuccess?.();
          onOpenChange(false);
        } else {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? `${result.failureCount}개 실패: ${result.errors[0].error}`
              : "일괄 적용에 실패했습니다.";
          toast.showError(errorMsg);
        }
      } catch (error) {
        console.error("추천 콘텐츠 일괄 적용 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "일괄 적용에 실패했습니다."
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="4xl">
      <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 md:p-8">
        <h2 className="text-xl font-semibold text-gray-900">
          추천 콘텐츠 일괄 적용
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          선택한 {participants.length}명의 학생에게 추천 콘텐츠를 일괄 적용합니다.
          학생당 최대 9개까지 설정할 수 있습니다.
        </p>

        {/* 요약 섹션 */}
        {(() => {
          const summary = calculateSummary();
          return (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>선택된 학생</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {participants.length}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <BookOpen className="h-4 w-4" />
                  <span>전체 콘텐츠</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {summary.totalContents}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>교과별 합계</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {AVAILABLE_SUBJECTS.map((subject) => (
                    <div key={subject} className="text-xs font-semibold text-gray-900">
                      <span className="text-gray-600">{subject}:</span>{" "}
                      <span className="text-gray-900">{summary.subjectTotals[subject] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-lg border p-4 ${
                summary.overLimitCount > 0
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-white"
              }`}>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <AlertTriangle className={`h-4 w-4 ${
                    summary.overLimitCount > 0 ? "text-red-600" : "text-gray-400"
                  }`} />
                  <span>초과 학생</span>
                </div>
                <div className={`mt-1 text-2xl font-bold ${
                  summary.overLimitCount > 0 ? "text-red-600" : "text-gray-900"
                }`}>
                  {summary.overLimitCount}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 전체 조율 컨트롤 */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-5 md:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">전체 조율</h3>
          
          {/* 일괄 적용 */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 mb-3">
              모든 학생에게 일괄 적용
            </label>
            <div className="flex flex-row flex-wrap gap-2 items-center">
              {AVAILABLE_SUBJECTS.map((subject) => {
                const current = globalSubjectCounts[subject] || 0;
                return (
                  <div key={subject} className="flex items-center gap-1.5 shrink-0">
                    <label className="text-xs font-medium text-gray-700 whitespace-nowrap">{subject}:</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setGlobalSubjectCounts({
                            ...globalSubjectCounts,
                            [subject]: Math.max(0, current - 1),
                          })
                        }
                        disabled={current === 0}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white shrink-0"
                        aria-label={`${subject} 감소`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-xs font-semibold text-gray-900">
                        {current}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setGlobalSubjectCounts({
                            ...globalSubjectCounts,
                            [subject]: Math.min(9, current + 1),
                          })
                        }
                        disabled={current === 9}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white shrink-0"
                        aria-label={`${subject} 증가`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleGlobalApply}
                className="ml-auto shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                적용
              </button>
            </div>
          </div>

          {/* 일괄 증가/감소 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-3">
              모든 학생 증가/감소
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={globalAdjustSubject}
                onChange={(e) => setGlobalAdjustSubject(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">교과 선택</option>
                {AVAILABLE_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setGlobalAdjustAmount(-1)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => setGlobalAdjustAmount(1)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50"
              >
                +1
              </button>
              <button
                type="button"
                onClick={handleGlobalAdjust}
                disabled={!globalAdjustSubject || globalAdjustAmount === 0}
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                적용
              </button>
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="mt-8 max-h-[60vh] overflow-y-auto overflow-x-hidden">
          <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.size === participants.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudentIds(new Set(participants.map((p) => p.groupId)));
                      } else {
                        setSelectedStudentIds(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900">
                  학생명
                </th>
                {AVAILABLE_SUBJECTS.map((subject) => (
                  <th
                    key={subject}
                    className="border-b border-gray-200 px-3 py-3 text-center text-xs font-semibold text-gray-900"
                  >
                    {subject}
                  </th>
                ))}
                <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                  총합
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                  조율
                </th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const total = calculateTotal(p.groupId);
                const isSelected = selectedStudentIds.has(p.groupId);
                const isOverLimit = total > 9;
                
                return (
                  <tr
                    key={p.groupId}
                    className={`transition-colors ${
                      isOverLimit
                        ? "bg-red-50 hover:bg-red-100"
                        : total === 9
                        ? "bg-orange-50 hover:bg-orange-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="border-b border-gray-200 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedStudentIds);
                          if (e.target.checked) {
                            newSet.add(p.groupId);
                          } else {
                            newSet.delete(p.groupId);
                          }
                          setSelectedStudentIds(newSet);
                        }}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="border-b border-gray-200 px-4 py-3 font-medium text-gray-900">
                      {p.studentName}
                    </td>
                    {AVAILABLE_SUBJECTS.map((subject) => {
                      const current = subjectCounts[p.groupId]?.[subject] || 0;
                      return (
                        <td key={subject} className="border-b border-gray-200 px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateCount(p.groupId, subject, current - 1)}
                              disabled={current === 0}
                              className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white"
                              aria-label={`${subject} 감소`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-semibold text-gray-900">
                              {current}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCount(p.groupId, subject, current + 1)}
                              disabled={current === 9}
                              className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white"
                              aria-label={`${subject} 증가`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    <td
                      className={`border-b border-gray-200 px-4 py-3 text-center font-semibold ${
                        isOverLimit
                          ? "text-red-600"
                          : total === 9
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {isOverLimit && <AlertTriangle className="h-4 w-4 text-red-600" />}
                        {total === 9 && !isOverLimit && (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                        <span>
                          {total}/9
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-gray-200 px-4 py-3 text-center">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPopoverId(
                              openPopoverId === p.groupId ? null : p.groupId
                            )
                          }
                          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
                        >
                          조율
                        </button>
                        {openPopoverId === p.groupId && (
                          <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  선택한 학생에게 일괄 적용
                                </label>
                                <div className="space-y-2">
                                  {AVAILABLE_SUBJECTS.map((subject) => {
                                    const current = individualSubjectCounts[subject] || 0;
                                    return (
                                      <div key={subject} className="flex items-center justify-between gap-2">
                                        <label className="text-xs font-medium text-gray-700 min-w-[3rem]">{subject}:</label>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setIndividualSubjectCounts({
                                                ...individualSubjectCounts,
                                                [subject]: Math.max(0, current - 1),
                                              })
                                            }
                                            disabled={current === 0}
                                            className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white"
                                            aria-label={`${subject} 감소`}
                                          >
                                            <Minus className="h-3 w-3" />
                                          </button>
                                          <span className="min-w-[1.5rem] text-center text-xs font-semibold text-gray-900">
                                            {current}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setIndividualSubjectCounts({
                                                ...individualSubjectCounts,
                                                [subject]: Math.min(9, current + 1),
                                              })
                                            }
                                            disabled={current === 9}
                                            className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white"
                                            aria-label={`${subject} 증가`}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleIndividualApply}
                                  className="mt-3 w-full rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                >
                                  적용
                                </button>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  선택한 학생 증가/감소
                                </label>
                                <div className="flex items-center gap-1">
                                  <select
                                    value={individualAdjustSubject}
                                    onChange={(e) => setIndividualAdjustSubject(e.target.value)}
                                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                                  >
                                    <option value="">교과 선택</option>
                                    {AVAILABLE_SUBJECTS.map((subject) => (
                                      <option key={subject} value={subject}>
                                        {subject}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setIndividualAdjustAmount(-1)}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIndividualAdjustAmount(1)}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                                  >
                                    +1
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleIndividualAdjust}
                                  disabled={!individualAdjustSubject || individualAdjustAmount === 0}
                                  className="mt-2 w-full rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  적용
                                </button>
                              </div>
                              
                              <div>
                                <button
                                  type="button"
                                  onClick={handleIndividualReset}
                                  className="w-full rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  선택한 학생 초기화
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 적용 옵션 */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-5 md:p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              기존 추천 콘텐츠 교체 (체크 시 기존 추천 콘텐츠를 삭제하고 새로 추가)
            </span>
          </label>
        </div>

        {/* 액션 버튼 */}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "적용 중..." : "적용"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

