"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type FormState = {
  error?: string;
  success?: boolean;
};

type ScoreFormProps = {
  action: (formData: FormData) => Promise<void>;
  initialData?: {
    subject_type: string;
    semester: string;
    course: string;
    course_detail: string;
    raw_score: string;
    grade: string;
    score_type_detail: string;
    test_date: string;
  };
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "저장 중..." : "저장하기"}
    </button>
  );
}

export function ScoreForm({ action, initialData }: ScoreFormProps) {
  const [state, formAction] = useActionState<FormState, FormData>(
    async (prevState: FormState, formData: FormData) => {
      try {
        await action(formData);
        return { success: true };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        };
      }
    },
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* 과목 유형 */}
      <div>
        <label
          htmlFor="subject_type"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          과목 유형 <span className="text-red-500">*</span>
        </label>
        <select
          id="subject_type"
          name="subject_type"
          required
          defaultValue={initialData?.subject_type ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        >
          <option value="">선택하세요</option>
          <option value="일반선택">일반선택</option>
          <option value="진로선택">진로선택</option>
          <option value="공통과목">공통과목</option>
        </select>
      </div>

      {/* 학기 */}
      <div>
        <label
          htmlFor="semester"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          학기 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="semester"
          name="semester"
          required
          placeholder="예: 1-1, 1-2, 2-1, 2-2"
          defaultValue={initialData?.semester ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
        <p className="mt-1 text-xs text-gray-500">
          형식: 학년-학기 (예: 1-1, 2-2)
        </p>
      </div>

      {/* 교과 */}
      <div>
        <label
          htmlFor="course"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          교과 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="course"
          name="course"
          required
          placeholder="예: 국어, 수학, 영어"
          defaultValue={initialData?.course ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
      </div>

      {/* 세부 과목명 */}
      <div>
        <label
          htmlFor="course_detail"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          세부 과목명 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="course_detail"
          name="course_detail"
          required
          placeholder="예: 문학, 미적분, 영어독해"
          defaultValue={initialData?.course_detail ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
      </div>

      {/* 원점수 */}
      <div>
        <label
          htmlFor="raw_score"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          원점수 <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="raw_score"
          name="raw_score"
          required
          min="0"
          step="0.1"
          placeholder="예: 95.5"
          defaultValue={initialData?.raw_score ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
      </div>

      {/* 등급 */}
      <div>
        <label
          htmlFor="grade"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          등급 <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="grade"
          name="grade"
          required
          min="1"
          max="9"
          placeholder="1~9"
          defaultValue={initialData?.grade ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
        <p className="mt-1 text-xs text-gray-500">1등급이 가장 높고, 9등급이 가장 낮습니다.</p>
      </div>

      {/* 평가 유형 */}
      <div>
        <label
          htmlFor="score_type_detail"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          평가 유형 <span className="text-red-500">*</span>
        </label>
        <select
          id="score_type_detail"
          name="score_type_detail"
          required
          defaultValue={initialData?.score_type_detail ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        >
          <option value="">선택하세요</option>
          <option value="내신">내신</option>
          <option value="평가원">평가원</option>
          <option value="교육청">교육청</option>
          <option value="사설">사설</option>
        </select>
      </div>

      {/* 시험일 */}
      <div>
        <label
          htmlFor="test_date"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          시험일 <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          id="test_date"
          name="test_date"
          required
          defaultValue={initialData?.test_date ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          성적이 성공적으로 저장되었습니다!
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

