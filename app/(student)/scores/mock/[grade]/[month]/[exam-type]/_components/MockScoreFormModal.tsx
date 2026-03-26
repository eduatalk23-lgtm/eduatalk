/**
 * 모의고사 성적 추가/수정 모달
 *
 * per-exam view (/scores/mock/[grade]/[month]/[exam-type])에서 사용됩니다.
 * subject_group_id/subject_id FK 필드를 사용합니다.
 */
"use client";

import { useTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { MockScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { addMockScore, updateMockScoreFormAction as updateMockScoreAction } from "@/lib/domains/score";
import { useToast } from "@/components/ui/ToastProvider";
import {
  MOCK_EXAM_TYPES,
  MOCK_EXAM_MONTHS,
  MATH_VARIANTS,
  isGradeOnlyGroup,
  needsSubjectSelection,
  isMathGroup,
} from "@/lib/constants/mock-exam";

type MockScoreFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGrade?: number;
  initialExamType?: string;
  initialMonth?: string;
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  editingScore?: MockScore | null;
  existingScores?: MockScore[];
  onSuccess?: () => void;
};

type FormErrors = {
  grade?: string;
  examType?: string;
  examRound?: string;
  subject_id?: string;
  standard_score?: string;
  percentile?: string;
  grade_score?: string;
  raw_score?: string;
};


export function MockScoreFormModal({
  open,
  onOpenChange,
  initialGrade,
  initialExamType,
  initialMonth,
  subjectGroups,
  subjectTypes,
  editingScore,
  existingScores,
  onSuccess,
}: MockScoreFormModalProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // 폼 상태
  const [formData, setFormData] = useState({
    grade: initialGrade?.toString() || "",
    examType: initialExamType || "",
    examRound: initialMonth || "",
    subject_group_id: "",
    subject_id: "",
    standard_score: "",
    percentile: "",
    grade_score: "",
    raw_score: "",
    math_variant: "",
  });

  // 편집 모드일 때 초기값 설정
  useEffect(() => {
    if (editingScore && open) {
      // exam_title에서 시험 유형 추출 (예: "2024학년도 3월 평가원 모의고사" -> "평가원")
      const examTitle = editingScore.exam_title || "";
      let extractedExamType = initialExamType || "";
      if (examTitle.includes("평가원")) extractedExamType = "평가원";
      else if (examTitle.includes("교육청")) extractedExamType = "교육청";
      else if (examTitle.includes("사설")) extractedExamType = "사설";
      
      // exam_date에서 월 추출
      const examDate = editingScore.exam_date ? new Date(editingScore.exam_date) : null;
      const extractedMonth = examDate ? (examDate.getMonth() + 1).toString() : initialMonth || "";
      
      setFormData({
        grade: editingScore.grade?.toString() || initialGrade?.toString() || "",
        examType: extractedExamType,
        examRound: extractedMonth,
        subject_group_id: editingScore.subject_group_id || "",
        subject_id: editingScore.subject_id || "",
        standard_score: editingScore.standard_score?.toString() || "",
        percentile: editingScore.percentile?.toString() || "",
        grade_score: editingScore.grade_score?.toString() || "",
        raw_score: editingScore.raw_score?.toString() || "",
        math_variant: (editingScore as Record<string, unknown>).math_variant?.toString() || "",
      });
    } else if (!editingScore && open) {
      // 새로 추가하는 경우 초기화
      setFormData({
        grade: initialGrade?.toString() || "",
        examType: initialExamType || "",
        examRound: initialMonth || "",
        subject_group_id: "",
        subject_id: "",
        standard_score: "",
        percentile: "",
        grade_score: "",
        raw_score: "",
        math_variant: "",
      });
    }
    // 모달이 닫힐 때 에러 상태 초기화
    if (!open) {
      setError(null);
      setErrors({});
      setTouched({});
    }
  }, [editingScore, open, initialGrade, initialExamType, initialMonth]);

  const validateField = (name: string, value: string | number | null): string | undefined => {
    switch (name) {
      case "grade":
        if (!value || value === "") {
          return "학년을 선택해주세요.";
        }
        const gradeNum = Number(value);
        if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 3) {
          return "학년은 1~3 사이의 숫자여야 합니다.";
        }
        break;
      case "examType":
        if (!value || value === "") {
          return "시험 유형을 선택해주세요.";
        }
        break;
      case "examRound":
        if (!value || value === "") {
          return "회차를 선택해주세요.";
        }
        break;
      case "subject_id":
        // 사회/과학일 때만 필수
        const group = subjectGroups.find((g) => g.id === formData.subject_group_id);
        const needsSubject = group && needsSubjectSelection(group.name);
        if (needsSubject && (!value || value === "")) {
          return "과목을 선택해주세요.";
        }
        break;
      case "grade_score":
        if (!value || value === "") {
          return "등급을 입력해주세요.";
        }
        const gradeScoreNum = Number(value);
        if (isNaN(gradeScoreNum) || gradeScoreNum < 1 || gradeScoreNum > 9) {
          return "등급은 1~9 사이의 숫자여야 합니다.";
        }
        break;
      case "standard_score":
        // 영어/한국사가 아닌 경우에만 필수
        const standardGroup = subjectGroups.find((g) => g.id === formData.subject_group_id);
        const isEnglishOrKoreanHistoryForStandard = isGradeOnlyGroup(standardGroup?.name ?? "");
        if (!isEnglishOrKoreanHistoryForStandard) {
          if (!value || value === "") {
            return "표준점수를 입력해주세요.";
          }
          const standardNum = Number(value);
          if (isNaN(standardNum)) {
            return "표준점수는 올바른 숫자여야 합니다.";
          }
        }
        break;
      case "percentile":
        // 영어/한국사가 아닌 경우에만 필수
        const percentileGroup = subjectGroups.find((g) => g.id === formData.subject_group_id);
        const isEnglishOrKoreanHistoryForPercentile = isGradeOnlyGroup(percentileGroup?.name ?? "");
        if (!isEnglishOrKoreanHistoryForPercentile) {
          if (!value || value === "") {
            return "백분위를 입력해주세요.";
          }
          const percentileNum = Number(value);
          if (isNaN(percentileNum) || percentileNum < 0 || percentileNum > 100) {
            return "백분위는 0~100 사이의 숫자여야 합니다.";
          }
        }
        break;
      case "raw_score":
        if (value && value !== "") {
          const rawNum = Number(value);
          if (isNaN(rawNum) || rawNum < 0 || rawNum > 300) {
            return "원점수는 0~300 사이의 숫자여야 합니다.";
          }
        }
        break;
    }
    return undefined;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 교과 선택 시 과목 자동 선택 (첫 번째 과목)
    if (name === "subject_group_id") {
      const group = subjectGroups.find((g) => g.id === value);
      const firstSubject = group?.subjects[0];
      setFormData((prev) => ({
        ...prev,
        subject_group_id: value,
        subject_id: firstSubject?.id || "",
      }));
    }

    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrors({});

    const group = subjectGroups.find((g) => g.id === formData.subject_group_id);
    const isEnglishOrKoreanHistory = isGradeOnlyGroup(group?.name ?? "");

    const formErrors: FormErrors = {};

    // 필수 필드 검증
    const requiredFields = [
      "grade",
      "examType",
      "examRound",
      "subject_group_id",
      "grade_score",
    ];
    requiredFields.forEach((field) => {
      const value = formData[field as keyof typeof formData];
      const error = validateField(field, value);
      if (error) {
        formErrors[field as keyof FormErrors] = error;
        setTouched((prev) => ({ ...prev, [field]: true }));
      }
    });

    // 사회/과학일 때만 과목 필수
    const needsSubject = group && needsSubjectSelection(group.name);
    if (needsSubject) {
      const subjectError = validateField("subject_id", formData.subject_id);
      if (subjectError) {
        formErrors.subject_id = subjectError;
        setTouched((prev) => ({ ...prev, subject_id: true }));
      }
    }

    // 영어/한국사가 아닌 경우 표준점수, 백분위 필수
    if (!isEnglishOrKoreanHistory) {
      const standardError = validateField("standard_score", formData.standard_score);
      if (standardError) {
        formErrors.standard_score = standardError;
        setTouched((prev) => ({ ...prev, standard_score: true }));
      }
      const percentileError = validateField("percentile", formData.percentile);
      if (percentileError) {
        formErrors.percentile = percentileError;
        setTouched((prev) => ({ ...prev, percentile: true }));
      }
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    // 중복 점수 체크 (신규 등록 시만)
    if (!editingScore && existingScores) {
      const targetSubjectId = formData.subject_id
        || subjectGroups.find((g) => g.id === formData.subject_group_id)?.subjects[0]?.id
        || "";
      const duplicate = existingScores.find((s) =>
        s.subject_id === targetSubjectId &&
        s.exam_title.includes(formData.examType) &&
        s.exam_date?.includes(`-${formData.examRound.padStart(2, "0")}-`)
      );
      if (duplicate) {
        setError(`이 시험의 동일 과목 성적이 이미 등록되어 있습니다. 기존 성적을 수정해주세요.`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const group = subjectGroups.find((g) => g.id === formData.subject_group_id);
        const subject = formData.subject_id
          ? group?.subjects.find((s) => s.id === formData.subject_id)
          : group?.subjects[0] ?? null;

        if (!group || !subject) {
          throw new Error("교과 또는 과목을 찾을 수 없습니다.");
        }

        // exam_date/exam_title 구성
        const currentYear = new Date().getFullYear();
        const examMonth = formData.examRound.padStart(2, "0");
        const constructedExamDate = `${currentYear}-${examMonth}-01`;
        const constructedExamTitle = `${formData.examRound}월 ${formData.examType} 모의고사`;

        const submitFormData = new FormData();
        submitFormData.append("grade", formData.grade);
        submitFormData.append("exam_type", formData.examType);
        submitFormData.append("exam_round", formData.examRound);
        submitFormData.append("exam_date", constructedExamDate);
        submitFormData.append("exam_title", constructedExamTitle);
        submitFormData.append("subject_group_id", group.id);
        submitFormData.append("subject_id", subject.id);
        if (formData.standard_score) submitFormData.append("standard_score", formData.standard_score);
        if (formData.percentile) submitFormData.append("percentile", formData.percentile);
        if (formData.raw_score) submitFormData.append("raw_score", formData.raw_score);
        if (formData.math_variant) submitFormData.append("math_variant", formData.math_variant);
        submitFormData.append("grade_score", formData.grade_score);
        // 모달에서 사용할 때는 redirect 방지
        submitFormData.append("skipRedirect", "true");

        if (editingScore) {
          await updateMockScoreAction(editingScore.id, submitFormData);
          showSuccess("성적이 성공적으로 수정되었습니다.");
        } else {
          await addMockScore(submitFormData);
          showSuccess("성적이 성공적으로 등록되었습니다.");
        }

        onOpenChange(false);
        router.refresh();
        onSuccess?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "성적 저장에 실패했습니다.";
        setError(errorMessage);
        showError(errorMessage);
      }
    });
  };

  const getSubjectsByGroupId = (groupId: string): Subject[] => {
    if (!groupId) return [];
    const group = subjectGroups.find((g) => g.id === groupId);
    return group?.subjects || [];
  };

  const group = subjectGroups.find((g) => g.id === formData.subject_group_id);
  const groupName = group?.name ?? "";
  const isEnglishOrKoreanHistory = isGradeOnlyGroup(groupName);
  const isMath = isMathGroup(groupName);
  const needsSubject = needsSubjectSelection(groupName);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingScore ? "성적 수정" : "성적 추가"}
      description={`모의고사 성적을 ${editingScore ? "수정" : "추가"}합니다.`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {/* 학년 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="grade"
              className="block text-sm font-medium text-gray-700"
            >
              학년 <span className="text-red-500">*</span>
            </label>
            <select
              id="grade"
              name="grade"
              value={formData.grade}
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.grade
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
            </select>
            {errors.grade && touched.grade && (
              <p className="text-xs text-red-600">{errors.grade}</p>
            )}
          </div>

          {/* 시험 유형 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="examType"
              className="block text-sm font-medium text-gray-700"
            >
              시험 유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="examType"
              name="examType"
              value={formData.examType}
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.examType
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              {MOCK_EXAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.examType && touched.examType && (
              <p className="text-xs text-red-600">{errors.examType}</p>
            )}
          </div>

          {/* 회차 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="examRound"
              className="block text-sm font-medium text-gray-700"
            >
              회차 <span className="text-red-500">*</span>
            </label>
            <select
              id="examRound"
              name="examRound"
              value={formData.examRound}
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.examRound
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              {MOCK_EXAM_MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
            {errors.examRound && touched.examRound && (
              <p className="text-xs text-red-600">{errors.examRound}</p>
            )}
          </div>

          {/* 교과 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="subject_group_id"
              className="block text-sm font-medium text-gray-700"
            >
              교과 <span className="text-red-500">*</span>
            </label>
            <select
              id="subject_group_id"
              name="subject_group_id"
              value={formData.subject_group_id}
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.subject_id && !formData.subject_group_id
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              {subjectGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* 과목 */}
          {needsSubject && (
            <div className="flex flex-col gap-2">
              <label htmlFor="subject_id" className="block text-sm font-medium text-gray-700">
                과목 <span className="text-red-500">*</span>
              </label>
              <select
                id="subject_id"
                name="subject_id"
                value={formData.subject_id}
                onBlur={handleBlur}
                onChange={handleChange}
                disabled={!formData.subject_group_id}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.subject_id
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                }`}
              >
                <option value="">선택하세요</option>
                {getSubjectsByGroupId(formData.subject_group_id).map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              {errors.subject_id && touched.subject_id && (
                <p className="text-xs text-red-600">{errors.subject_id}</p>
              )}
            </div>
          )}

          {/* 표준점수 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="standard_score" className="block text-sm font-medium text-gray-700">
              표준점수 {!isEnglishOrKoreanHistory && <span className="text-red-500">*</span>}
              {isEnglishOrKoreanHistory && (
                <span className="text-xs text-gray-500 font-normal">(영어/한국사 제외)</span>
              )}
            </label>
            <input
              type="number"
              id="standard_score"
              name="standard_score"
              step="0.1"
              value={formData.standard_score}
              onBlur={handleBlur}
              onChange={handleChange}
              disabled={isEnglishOrKoreanHistory}
              placeholder="130"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                errors.standard_score
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.standard_score && touched.standard_score && (
              <p className="text-xs text-red-600">{errors.standard_score}</p>
            )}
          </div>

          {/* 백분위 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="percentile" className="block text-sm font-medium text-gray-700">
              백분위 {!isEnglishOrKoreanHistory && <span className="text-red-500">*</span>}
              {isEnglishOrKoreanHistory && (
                <span className="text-xs text-gray-500 font-normal">(영어/한국사 제외)</span>
              )}
            </label>
            <input
              type="number"
              id="percentile"
              name="percentile"
              step="0.1"
              min="0"
              max="100"
              value={formData.percentile}
              onBlur={handleBlur}
              onChange={handleChange}
              disabled={isEnglishOrKoreanHistory}
              placeholder="95.5"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                errors.percentile
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.percentile && touched.percentile && (
              <p className="text-xs text-red-600">{errors.percentile}</p>
            )}
          </div>

          {/* 등급 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="grade_score" className="block text-sm font-medium text-gray-700">
              등급 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="grade_score"
              name="grade_score"
              min="1"
              max="9"
              value={formData.grade_score}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="1~9"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.grade_score
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.grade_score && touched.grade_score && (
              <p className="text-xs text-red-600">{errors.grade_score}</p>
            )}
            <p className="text-xs text-gray-500">1등급이 가장 높고, 9등급이 가장 낮습니다.</p>
          </div>

          {/* 원점수 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="raw_score" className="block text-sm font-medium text-gray-700">
              원점수
              <span className="text-xs text-gray-500 font-normal ml-1">(선택)</span>
            </label>
            <input
              type="number"
              id="raw_score"
              name="raw_score"
              step="0.1"
              min="0"
              max="300"
              value={formData.raw_score}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="85"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.raw_score
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.raw_score && touched.raw_score && (
              <p className="text-xs text-red-600">{errors.raw_score}</p>
            )}
          </div>

          {/* 수학 선택과목 */}
          {isMath && (
            <div className="flex flex-col gap-2">
              <label htmlFor="math_variant" className="block text-sm font-medium text-gray-700">
                수학 선택과목
              </label>
              <select
                id="math_variant"
                name="math_variant"
                value={formData.math_variant}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                {MATH_VARIANTS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">정시 환산 시 수학 선택과목 구분에 사용됩니다.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (editingScore ? "수정 중..." : "등록 중...") : editingScore ? "수정하기" : "등록하기"}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

