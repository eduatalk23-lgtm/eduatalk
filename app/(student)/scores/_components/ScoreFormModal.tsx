"use client";

import { useTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import type { InternalScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { createInternalScore, updateInternalScore } from "@/app/actions/scores-internal";
import { useToast } from "@/components/ui/ToastProvider";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

type ScoreFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGrade?: number;
  initialSemester?: number;
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  editingScore?: InternalScore | null;
  curriculumRevisionId: string;
  onSuccess?: () => void;
};

type FormErrors = {
  grade?: string;
  semester?: string;
  subject_type_id?: string;
  subject_id?: string;
  credit_hours?: string;
  raw_score?: string;
  subject_average?: string;
  standard_deviation?: string;
  grade_score?: string;
  total_students?: string;
  rank_grade?: string;
};

export function ScoreFormModal({
  open,
  onOpenChange,
  initialGrade,
  initialSemester,
  subjectGroups,
  subjectTypes,
  editingScore,
  curriculumRevisionId,
  onSuccess,
}: ScoreFormModalProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // 폼 상태
  const [formData, setFormData] = useState({
    grade: initialGrade?.toString() || "",
    semester: initialSemester?.toString() || "",
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
  });

  // 편집 모드일 때 초기값 설정
  useEffect(() => {
    if (editingScore && open) {
      setFormData({
        grade: editingScore.grade?.toString() || initialGrade?.toString() || "",
        semester: editingScore.semester?.toString() || initialSemester?.toString() || "",
        subject_type_id: editingScore.subject_type_id || "",
        subject_group_id: editingScore.subject_group_id || "",
        subject_id: editingScore.subject_id || "",
        credit_hours: editingScore.credit_hours?.toString() || "",
        raw_score: editingScore.raw_score?.toString() || "",
        subject_average: editingScore.avg_score?.toString() || "", // avg_score -> subject_average (UI용)
        standard_deviation: editingScore.std_dev?.toString() || "", // std_dev -> standard_deviation (UI용)
        grade_score: editingScore.rank_grade?.toString() || "", // rank_grade -> grade_score (UI용)
        total_students: editingScore.total_students?.toString() || "",
        rank_grade: editingScore.rank_grade?.toString() || "",
      });
    } else if (!editingScore && open) {
      // 새로 추가하는 경우 초기화
      setFormData({
        grade: initialGrade?.toString() || "",
        semester: initialSemester?.toString() || "",
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
      });
    }
    // 모달이 닫힐 때 에러 상태 초기화
    if (!open) {
      setError(null);
      setErrors({});
      setTouched({});
    }
  }, [editingScore, open, initialGrade, initialSemester]);

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
      case "semester":
        if (!value || value === "") {
          return "학기를 선택해주세요.";
        }
        const semesterNum = Number(value);
        if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 2) {
          return "학기는 1~2 사이의 숫자여야 합니다.";
        }
        break;
      case "subject_type_id":
        if (!value || value === "") {
          return "과목 유형을 선택해주세요.";
        }
        break;
      case "subject_id":
        if (!value || value === "") {
          return "과목을 선택해주세요.";
        }
        break;
      case "credit_hours":
        if (!value || value === "") {
          return "학점수를 입력해주세요.";
        }
        const creditNum = Number(value);
        if (isNaN(creditNum) || creditNum <= 0) {
          return "학점수는 양수여야 합니다.";
        }
        break;
      case "raw_score":
        if (!value || value === "") {
          return "원점수를 입력해주세요.";
        }
        const rawNum = Number(value);
        if (isNaN(rawNum) || rawNum < 0) {
          return "원점수는 0 이상의 숫자여야 합니다.";
        }
        break;
      case "grade_score":
        if (!value || value === "") {
          return "성취도 등급을 입력해주세요.";
        }
        const gradeScoreNum = Number(value);
        if (isNaN(gradeScoreNum) || gradeScoreNum < 1 || gradeScoreNum > 9) {
          return "등급은 1~9 사이의 숫자여야 합니다.";
        }
        break;
    }
    return undefined;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement> | React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 교과 선택 시 과목 초기화 및 첫 번째 과목 자동 선택
    if (name === "subject_group_id") {
      const group = subjectGroups.find((g) => g.id === value);
      const firstSubject = group?.subjects[0];
      setFormData((prev) => ({
        ...prev,
        subject_group_id: value,
        subject_id: firstSubject?.id || "",
        subject_type_id: firstSubject?.subject_type_id || prev.subject_type_id,
      }));
    }

    // 과목 선택 시 과목구분 자동 설정
    if (name === "subject_id") {
      const group = subjectGroups.find((g) => g.subjects.some((s) => s.id === value));
      const subject = group?.subjects.find((s) => s.id === value);
      setFormData((prev) => ({
        ...prev,
        subject_id: value,
        subject_type_id: subject?.subject_type_id || prev.subject_type_id,
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

    const formErrors: FormErrors = {};

    // 필수 필드 검증
    const requiredFields = [
      "grade",
      "semester",
      "subject_type_id",
      "subject_group_id",
      "subject_id",
      "credit_hours",
      "raw_score",
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

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    startTransition(async () => {
      try {
        const group = subjectGroups.find((g) => g.id === formData.subject_group_id);
        const subject = group?.subjects.find((s) => s.id === formData.subject_id);
        const subjectType = subjectTypes.find((st) => st.id === formData.subject_type_id);

        if (!group || !subject) {
          throw new Error("교과 또는 과목을 찾을 수 없습니다.");
        }

        // tenant_id는 서버 액션에서 getCurrentUser로 가져옴
        const submitFormData = new FormData();
        submitFormData.append("student_id", ""); // 서버 액션에서 getCurrentUser로 가져옴
        submitFormData.append("tenant_id", ""); // 서버 액션에서 getCurrentUser로 가져옴
        submitFormData.append("grade", formData.grade);
        submitFormData.append("semester", formData.semester);
        submitFormData.append("subject_group_id", group.id);
        submitFormData.append("subject_id", subject.id);
        if (formData.subject_type_id) {
          submitFormData.append("subject_type_id", formData.subject_type_id);
        }
        submitFormData.append("credit_hours", formData.credit_hours);
        submitFormData.append("raw_score", formData.raw_score);
        // InternalScore 필드명으로 변환
        if (formData.subject_average)
          submitFormData.append("avg_score", formData.subject_average);
        if (formData.standard_deviation)
          submitFormData.append("std_dev", formData.standard_deviation);
        // rank_grade는 grade_score와 동일한 값
        if (formData.grade_score) {
          submitFormData.append("rank_grade", formData.grade_score);
        }
        if (formData.total_students)
          submitFormData.append("total_students", formData.total_students);
        submitFormData.append("curriculum_revision_id", curriculumRevisionId);

        // createInternalScore와 updateInternalScore는 ActionResponse<{ success: boolean; scoreId?: string }>를 반환
        let result: ActionResponse<{ success: boolean; scoreId?: string }>;
        if (editingScore) {
          result = await updateInternalScore(editingScore.id, submitFormData);
        } else {
          result = await createInternalScore(submitFormData);
        }

        if (isSuccessResponse(result)) {
          showSuccess(result.message || (editingScore ? "성적이 성공적으로 수정되었습니다." : "성적이 성공적으로 등록되었습니다."));
          onOpenChange(false);
          router.refresh();
          onSuccess?.();
        } else if (isErrorResponse(result)) {
          const errorMessage = result.error || "성적 저장에 실패했습니다.";
          setError(errorMessage);
          showError(errorMessage);
          
          // fieldErrors가 있으면 errors 상태에 반영
          if (result.fieldErrors || result.validationErrors) {
            const fieldErrors = result.fieldErrors || result.validationErrors || {};
            setErrors(fieldErrors as FormErrors);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "예기치 않은 오류가 발생했습니다.";
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingScore ? "성적 수정" : "성적 추가"}
      description={`내신 성적을 ${editingScore ? "수정" : "추가"}합니다.`}
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

          {/* 학기 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="semester"
              className="block text-sm font-medium text-gray-700"
            >
              학기 <span className="text-red-500">*</span>
            </label>
            <select
              id="semester"
              name="semester"
              value={formData.semester}
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.semester
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              <option value="1">1학기</option>
              <option value="2">2학기</option>
            </select>
            {errors.semester && touched.semester && (
              <p className="text-xs text-red-600">{errors.semester}</p>
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

          {/* 과목 유형 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="subject_type_id"
              className="block text-sm font-medium text-gray-700"
            >
              과목 유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="subject_type_id"
              name="subject_type_id"
              value={formData.subject_type_id}
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.subject_type_id
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              {subjectTypes.map((subjectType) => (
                <option key={subjectType.id} value={subjectType.id}>
                  {subjectType.name}
                </option>
              ))}
            </select>
            {errors.subject_type_id && touched.subject_type_id && (
              <p className="text-xs text-red-600">{errors.subject_type_id}</p>
            )}
          </div>

          {/* 학점수 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="credit_hours" className="block text-sm font-medium text-gray-700">
              학점수 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="credit_hours"
              name="credit_hours"
              step="0.5"
              min="0.5"
              value={formData.credit_hours}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 4"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.credit_hours
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.credit_hours && touched.credit_hours && (
              <p className="text-xs text-red-600">{errors.credit_hours}</p>
            )}
          </div>

          {/* 원점수 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="raw_score" className="block text-sm font-medium text-gray-700">
              원점수 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="raw_score"
              name="raw_score"
              step="0.1"
              min="0"
              value={formData.raw_score}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 85.5"
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

          {/* 성취도 등급 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="grade_score" className="block text-sm font-medium text-gray-700">
              성취도 등급 <span className="text-red-500">*</span>
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

          {/* 과목평균 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="subject_average"
              className="block text-sm font-medium text-gray-700"
            >
              과목평균
            </label>
            <input
              type="number"
              id="subject_average"
              name="subject_average"
              step="0.1"
              value={formData.subject_average}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 78.5"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 표준편차 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="standard_deviation"
              className="block text-sm font-medium text-gray-700"
            >
              표준편차
            </label>
            <input
              type="number"
              id="standard_deviation"
              name="standard_deviation"
              step="0.1"
              min="0"
              value={formData.standard_deviation}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 12.5"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 수강자수 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="total_students"
              className="block text-sm font-medium text-gray-700"
            >
              수강자수
            </label>
            <input
              type="number"
              id="total_students"
              name="total_students"
              min="1"
              value={formData.total_students}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 120"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 석차등급 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="rank_grade" className="block text-sm font-medium text-gray-700">
              석차등급
            </label>
            <input
              type="number"
              id="rank_grade"
              name="rank_grade"
              min="1"
              max="9"
              value={formData.rank_grade}
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="1~9"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

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

