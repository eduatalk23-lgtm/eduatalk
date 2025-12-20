"use client";

import React, { Component, ReactNode } from "react";
import type { WizardData } from "@/lib/schemas/planWizardSchema";
import type { WizardStep } from "../PlanGroupWizard";

/**
 * StepErrorBoundary Props
 */
type StepErrorBoundaryProps = {
  children: ReactNode;
  stepName?: string;
  step?: WizardStep;
  wizardData?: WizardData;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

/**
 * StepErrorBoundary State
 */
type StepErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * StepErrorBoundary
 * 
 * 각 Step 컴포넌트를 감싸서 렌더링 에러를 격리하고,
 * 특정 Step에서 에러가 발생해도 다른 Step으로 이동하거나
 * 데이터를 저장하는 기능이 마비되지 않도록 보호합니다.
 */
export class StepErrorBoundary extends Component<
  StepErrorBoundaryProps,
  StepErrorBoundaryState
> {
  constructor(props: StepErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): StepErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅 (기본)
    console.error(
      `[StepErrorBoundary] Step ${this.props.stepName || "unknown"}에서 에러 발생:`,
      error,
      errorInfo
    );

    // 컨텍스트 정보와 함께 에러 로깅
    this.logErrorWithContext(error, errorInfo);

    // onError 콜백 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * 에러와 함께 위저드 컨텍스트 정보를 로깅하는 함수
   * 
   * @param error 발생한 에러
   * @param errorInfo React 에러 정보
   */
  private logErrorWithContext(error: Error, errorInfo: React.ErrorInfo) {
    const { stepName, step, wizardData } = this.props;

    // 로깅할 컨텍스트 정보 구성
    const context: Record<string, unknown> = {
      stepName: stepName || "unknown",
      step: step || "unknown",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
    };

    // wizardData가 있는 경우, 민감 정보를 제외하고 포함
    if (wizardData) {
      // 민감 정보 필터링 (예: 개인정보, 비밀번호 등)
      const sanitizedWizardData = this.sanitizeWizardData(wizardData);
      context.wizardData = sanitizedWizardData;
      context.wizardDataSnapshot = {
        name: wizardData.name,
        plan_purpose: wizardData.plan_purpose,
        scheduler_type: wizardData.scheduler_type,
        period_start: wizardData.period_start,
        period_end: wizardData.period_end,
        student_contents_count: wizardData.student_contents?.length || 0,
        recommended_contents_count: wizardData.recommended_contents?.length || 0,
        exclusions_count: wizardData.exclusions?.length || 0,
        academy_schedules_count: wizardData.academy_schedules?.length || 0,
      };
    }

    // 구조화된 로그 출력
    console.error("[StepErrorBoundary] 에러 컨텍스트:", JSON.stringify(context, null, 2));

    // Sentry 등 에러 트래킹 서비스가 설정되어 있다면 전송
    // @ts-expect-error - Sentry는 선택적 의존성
    if (typeof window !== "undefined" && window.Sentry) {
      // @ts-expect-error - Sentry는 선택적 의존성
      window.Sentry.captureException(error, {
        extra: context,
        tags: {
          component: "StepErrorBoundary",
          step: step?.toString() || stepName || "unknown",
        },
      });
    }
  }

  /**
   * WizardData에서 민감 정보를 제거하는 함수
   * 
   * @param data 원본 WizardData
   * @returns 민감 정보가 제거된 WizardData
   */
  private sanitizeWizardData(data: WizardData): Partial<WizardData> {
    // 민감 정보가 포함될 수 있는 필드들을 제외하고 반환
    // 실제 민감 정보가 있다면 여기에 추가
    return {
      name: data.name,
      plan_purpose: data.plan_purpose,
      scheduler_type: data.scheduler_type,
      period_start: data.period_start,
      period_end: data.period_end,
      target_date: data.target_date,
      block_set_id: data.block_set_id,
      // 배열은 길이만 포함
      student_contents: data.student_contents?.map((content) => ({
        content_type: content.content_type,
        content_id: content.content_id.substring(0, 8) + "...", // ID 일부만
        start_range: content.start_range,
        end_range: content.end_range,
      })),
      recommended_contents: data.recommended_contents?.map((content) => ({
        content_type: content.content_type,
        content_id: content.content_id.substring(0, 8) + "...",
        start_range: content.start_range,
        end_range: content.end_range,
      })),
      exclusions: data.exclusions?.map((exclusion) => ({
        exclusion_date: exclusion.exclusion_date,
        exclusion_type: exclusion.exclusion_type,
        // reason은 제외 (개인정보 포함 가능)
      })),
      academy_schedules: data.academy_schedules?.map((schedule) => ({
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        // academy_name, subject는 제외 (개인정보 포함 가능)
      })),
    };
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800">
                  일시적인 오류가 발생했습니다
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {this.props.stepName
                    ? `${this.props.stepName} 단계에서 문제가 발생했습니다.`
                    : "이 단계에서 문제가 발생했습니다."}
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-600">
                      개발자 정보 (개발 모드에서만 표시)
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs text-red-800">
                      {this.state.error.toString()}
                      {this.state.error.stack && `\n${this.state.error.stack}`}
                    </pre>
                  </details>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                다시 시도해주세요
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

