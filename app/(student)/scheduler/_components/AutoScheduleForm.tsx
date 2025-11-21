"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAutoSchedule } from "@/app/actions/autoSchedule";

type FormState = {
  error?: string;
  success?: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "생성 중..." : "자동 스케줄 생성하기"}
    </button>
  );
}

export function AutoScheduleForm() {
  const [useSingleDate, setUseSingleDate] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    async (prevState: FormState, formData: FormData) => {
      try {
        await createAutoSchedule(formData);
        return { success: true };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        };
      }
    },
    {}
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="space-y-6">
      {/* 단일 날짜 옵션 */}
      <div>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={useSingleDate}
            onChange={(e) => setUseSingleDate(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span>특정 날짜만 생성 (단일 날짜 모드)</span>
        </label>
        {useSingleDate && (
          <div className="mt-3">
            <label
              htmlFor="single_date"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              날짜 선택
            </label>
            <input
              type="date"
              id="single_date"
              name="single_date"
              defaultValue={today}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              선택한 날짜의 플랜만 생성합니다.
            </p>
          </div>
        )}
      </div>

      {/* 생성 기간 (단일 날짜 모드가 아닐 때만 표시) */}
      {!useSingleDate && (
        <div>
          <label
            htmlFor="period"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            생성 기간
          </label>
          <select
            id="period"
            name="period"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            defaultValue="7"
          >
            <option value="1">1일</option>
            <option value="7">7일 (1주)</option>
            <option value="30">30일 (1개월)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            생성할 학습 플랜의 기간을 선택하세요.
          </p>
        </div>
      )}

      {/* 성적 기반 배정 활성화 */}
      <div>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <input
            type="checkbox"
            id="enable_score_based"
            name="enable_score_based"
            value="on"
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            onChange={(e) => {
              const scoreWeightInput = document.getElementById(
                "score_weight"
              ) as HTMLInputElement;
              const scoreWeightSection = document.getElementById(
                "score_weight_section"
              ) as HTMLElement;
              const weakSubjectSection = document.getElementById(
                "weak_subject_section"
              ) as HTMLElement;

              const examUrgencySection = document.getElementById(
                "exam_urgency_section"
              ) as HTMLElement;

              if (e.target.checked) {
                if (scoreWeightSection) {
                  scoreWeightSection.style.display = "block";
                }
                if (weakSubjectSection) {
                  weakSubjectSection.style.display = "block";
                }
                if (examUrgencySection) {
                  examUrgencySection.style.display = "block";
                }
              } else {
                if (scoreWeightInput) {
                  scoreWeightInput.value = "0";
                }
                if (scoreWeightSection) {
                  scoreWeightSection.style.display = "none";
                }
                if (weakSubjectSection) {
                  weakSubjectSection.style.display = "none";
                }
                if (examUrgencySection) {
                  examUrgencySection.style.display = "none";
                }
              }
            }}
          />
          <span>성적 기반 배정 활성화</span>
        </label>
        <p className="mt-1 text-xs text-gray-500 ml-7">
          성적 데이터를 기반으로 취약과목을 우선 배정합니다.
        </p>
      </div>

      {/* 가중치 조정 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          우선순위 가중치 조정
        </h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="difficulty_weight"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              난이도 가중치: <span id="difficulty_value">50</span>%
            </label>
            <input
              type="range"
              id="difficulty_weight"
              name="difficulty_weight"
              min="0"
              max="100"
              defaultValue="50"
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              난이도가 낮은 콘텐츠를 얼마나 우선시할지 설정합니다.
            </p>
          </div>

          <div>
            <label
              htmlFor="progress_weight"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              진행률 가중치: <span id="progress_value">50</span>%
            </label>
            <input
              type="range"
              id="progress_weight"
              name="progress_weight"
              min="0"
              max="100"
              defaultValue="50"
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              진행률이 낮은 콘텐츠를 얼마나 우선시할지 설정합니다.
            </p>
          </div>

          {/* 성적 가중치 (성적 기반 배정 활성화 시에만 표시) */}
          <div id="score_weight_section" style={{ display: "none" }}>
            <label
              htmlFor="score_weight"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              성적 가중치: <span id="score_value">0</span>%
            </label>
            <input
              type="range"
              id="score_weight"
              name="score_weight"
              min="0"
              max="100"
              defaultValue="0"
              className="w-full"
              onChange={(e) => {
                const scoreValue = document.getElementById(
                  "score_value"
                ) as HTMLElement;
                if (scoreValue) {
                  scoreValue.textContent = e.target.value;
                }
              }}
            />
            <p className="mt-1 text-xs text-gray-500">
              성적이 낮은 과목을 얼마나 우선시할지 설정합니다. (정렬 우선순위에 반영)
            </p>
          </div>
        </div>
      </div>

      {/* 취약과목 집중 모드 (성적 기반 배정 활성화 시에만 표시) */}
      <div id="weak_subject_section" style={{ display: "none" }}>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <input
            type="checkbox"
            name="weak_subject_focus"
            value="on"
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span>취약과목 집중 모드</span>
        </label>
        <p className="mt-1 text-xs text-gray-500 ml-7">
          Risk Score 30 이상인 취약과목만 배정합니다.
        </p>
      </div>

      {/* 시험 임박도 반영 (성적 기반 배정 활성화 시에만 표시) */}
      <div id="exam_urgency_section" style={{ display: "none" }}>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <input
            type="checkbox"
            name="exam_urgency_enabled"
            value="on"
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span>시험 임박도 반영</span>
        </label>
        <p className="mt-1 text-xs text-gray-500 ml-7">
          다가오는 시험일이 가까운 과목을 우선 배정합니다.
        </p>
      </div>

      {/* 충돌 처리 모드 */}
      <div>
        <label
          htmlFor="conflict_mode"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          기존 플랜 충돌 처리
        </label>
        <select
          id="conflict_mode"
          name="conflict_mode"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          defaultValue="empty_only"
        >
          <option value="empty_only">비어 있는 블록만 생성</option>
          <option value="overwrite">기존 플랜 덮어쓰기</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          기존 플랜이 있는 블록을 어떻게 처리할지 선택하세요.
        </p>
      </div>

      {/* 연속 블록 옵션 */}
      <div>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <input
            type="checkbox"
            name="allow_consecutive"
            value="on"
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span>연속 블록에 동일 콘텐츠 배정 허용</span>
        </label>
        <p className="mt-1 text-xs text-gray-500 ml-7">
          같은 날의 연속된 블록에 같은 콘텐츠를 배정할 수 있습니다.
        </p>
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          플랜이 성공적으로 생성되었습니다!
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

