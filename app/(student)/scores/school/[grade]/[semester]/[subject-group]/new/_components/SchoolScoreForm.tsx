/**
 * @deprecated 이 컴포넌트는 레거시 스키마를 사용합니다.
 * 새 스키마(student_internal_scores)에 맞춰 재구축이 필요합니다.
 * 
 * 향후 개선 사항:
 * - subject_id, subject_group_id, subject_type_id FK 필드 사용
 * - createInternalScore (app/actions/scores-internal.ts) 사용
 * - term_id 자동 생성 로직 추가
 */
"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSchoolScore } from "@/app/(student)/actions/scoreActions";
import { Card } from "@/components/molecules/Card";

type SchoolScoreFormProps = {
  grade: string;
  semester: string;
  subjectGroup: string;
};

type FormErrors = {
  subject_type?: string;
  subject_name?: string;
  credit_hours?: string;
  raw_score?: string;
  subject_average?: string;
  standard_deviation?: string;
  grade_score?: string;
  total_students?: string;
  rank_grade?: string;
  class_rank?: string;
};

export default function SchoolScoreForm({
  grade,
  semester,
  subjectGroup,
}: SchoolScoreFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string | number | null): string | undefined => {
    switch (name) {
      case "subject_type":
        if (!value || value === "") {
          return "과목 유형을 선택해주세요.";
        }
        break;
      case "subject_name":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "세부 과목명을 입력해주세요.";
        }
        break;
      case "credit_hours":
        if (value === null || value === undefined || value === "") {
          return "학점수를 입력해주세요.";
        }
        const creditNum = Number(value);
        if (isNaN(creditNum) || creditNum <= 0) {
          return "학점수는 양수여야 합니다.";
        }
        break;
      case "raw_score":
        if (value === null || value === undefined || value === "") {
          return "원점수를 입력해주세요.";
        }
        const rawNum = Number(value);
        if (isNaN(rawNum) || rawNum < 0) {
          return "원점수는 0 이상의 숫자여야 합니다.";
        }
        break;
      case "subject_average":
        if (value !== null && value !== undefined && value !== "") {
          const avgNum = Number(value);
          if (isNaN(avgNum)) {
            return "과목평균은 올바른 숫자여야 합니다.";
          }
        }
        break;
      case "standard_deviation":
        if (value !== null && value !== undefined && value !== "") {
          const stdNum = Number(value);
          if (isNaN(stdNum)) {
            return "표준편차는 올바른 숫자여야 합니다.";
          }
        }
        break;
      case "grade_score":
        if (value === null || value === undefined || value === "") {
          return "성취도 등급을 입력해주세요.";
        }
        const gradeNum = Number(value);
        if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 9) {
          return "등급은 1~9 사이의 숫자여야 합니다.";
        }
        break;
      case "total_students":
        if (value !== null && value !== undefined && value !== "") {
          const totalNum = Number(value);
          if (isNaN(totalNum) || totalNum <= 0) {
            return "수강자수는 양수여야 합니다.";
          }
        }
        break;
      case "rank_grade":
        if (value !== null && value !== undefined && value !== "") {
          const rankGradeNum = Number(value);
          if (isNaN(rankGradeNum) || rankGradeNum < 1 || rankGradeNum > 9) {
            return "석차등급은 1~9 사이의 숫자여야 합니다.";
          }
        }
        break;
      case "class_rank":
        if (value !== null && value !== undefined && value !== "") {
          const rankNum = Number(value);
          if (isNaN(rankNum) || rankNum < 1) {
            return "반 석차는 1 이상의 숫자여야 합니다.";
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
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const formErrors: FormErrors = {};

    // 필수 필드 검증
    const requiredFields = ["subject_type", "subject_name", "credit_hours", "raw_score", "grade_score"];
    requiredFields.forEach((field) => {
      const value = formData.get(field);
      const error = validateField(field, value as string);
      if (error) {
        formErrors[field as keyof FormErrors] = error;
        setTouched((prev) => ({ ...prev, [field]: true }));
      }
    });

    // 선택적 필드 검증
    const optionalFields = ["subject_average", "standard_deviation", "total_students", "rank_grade", "class_rank"];
    optionalFields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        const error = validateField(field, value as string);
        if (error) {
          formErrors[field as keyof FormErrors] = error;
          setTouched((prev) => ({ ...prev, [field]: true }));
        }
      }
    });

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    startTransition(async () => {
      try {
        await addSchoolScore(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "성적 등록에 실패했습니다.");
      }
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Hidden fields */}
        <input type="hidden" name="grade" value={grade} />
        <input type="hidden" name="semester" value={semester} />
        <input type="hidden" name="subject_group" value={subjectGroup} />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {/* 과목 유형 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="subject_type"
              className="block text-sm font-medium text-gray-700"
            >
              과목 유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="subject_type"
              name="subject_type"
              onBlur={handleBlur}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.subject_type
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            >
              <option value="">선택하세요</option>
              <option value="공통">공통</option>
              <option value="일반선택">일반선택</option>
              <option value="진로선택">진로선택</option>
            </select>
            {errors.subject_type && touched.subject_type && (
              <p className="text-xs text-red-600">{errors.subject_type}</p>
            )}
          </div>

          {/* 세부 과목명 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="subject_name"
              className="block text-sm font-medium text-gray-700"
            >
              세부 과목명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject_name"
              name="subject_name"
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 수학Ⅰ"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.subject_name
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.subject_name && touched.subject_name && (
              <p className="text-xs text-red-600">{errors.subject_name}</p>
            )}
          </div>

          {/* 학점수 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="credit_hours"
              className="block text-sm font-medium text-gray-700"
            >
              학점수 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="credit_hours"
              name="credit_hours"
              step="0.5"
              min="0.5"
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
            <label
              htmlFor="raw_score"
              className="block text-sm font-medium text-gray-700"
            >
              원점수 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="raw_score"
              name="raw_score"
              step="0.1"
              min="0"
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
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 78.5"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.subject_average
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.subject_average && touched.subject_average && (
              <p className="text-xs text-red-600">{errors.subject_average}</p>
            )}
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
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 12.5"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.standard_deviation
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.standard_deviation && touched.standard_deviation && (
              <p className="text-xs text-red-600">{errors.standard_deviation}</p>
            )}
          </div>

          {/* 성취도 등급 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="grade_score"
              className="block text-sm font-medium text-gray-700"
            >
              성취도 등급 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="grade_score"
              name="grade_score"
              min="1"
              max="9"
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
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 120"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.total_students
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.total_students && touched.total_students && (
              <p className="text-xs text-red-600">{errors.total_students}</p>
            )}
          </div>

          {/* 석차등급 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="rank_grade"
              className="block text-sm font-medium text-gray-700"
            >
              석차등급
            </label>
            <input
              type="number"
              id="rank_grade"
              name="rank_grade"
              min="1"
              max="9"
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="1~9"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.rank_grade
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.rank_grade && touched.rank_grade && (
              <p className="text-xs text-red-600">{errors.rank_grade}</p>
            )}
          </div>

          {/* 반 석차 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="class_rank"
              className="block text-sm font-medium text-gray-700"
            >
              반 석차
            </label>
            <input
              type="number"
              id="class_rank"
              name="class_rank"
              min="1"
              onBlur={handleBlur}
              onChange={handleChange}
              placeholder="예: 5"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.class_rank
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.class_rank && touched.class_rank && (
              <p className="text-xs text-red-600">{errors.class_rank}</p>
            )}
          </div>

        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "등록 중..." : "등록하기"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </form>
    </Card>
  );
}
