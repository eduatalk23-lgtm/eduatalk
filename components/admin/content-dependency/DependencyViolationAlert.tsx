"use client";

/**
 * 의존성 위반 경고 알림 컴포넌트
 *
 * 플랜 생성/미리보기 시 의존성 위반이 있을 때 경고를 표시합니다.
 */

import { AlertTriangle, ChevronDown, ChevronUp, ArrowRight, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { DependencyViolation } from "@/lib/types/content-dependency";

interface DependencyViolationAlertProps {
  violations: DependencyViolation[];
  /** 컴팩트 모드 (접기/펼치기 가능) */
  collapsible?: boolean;
  /** 클래스명 추가 */
  className?: string;
}

/**
 * 의존성 위반 경고 알림
 *
 * @example
 * ```tsx
 * <DependencyViolationAlert
 *   violations={validationResult.violations}
 *   collapsible
 * />
 * ```
 */
export function DependencyViolationAlert({
  violations,
  collapsible = false,
  className = "",
}: DependencyViolationAlertProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  if (violations.length === 0) return null;

  const orderViolations = violations.filter((v) => v.type === "order_violation");
  const missingPrerequisites = violations.filter((v) => v.type === "missing_prerequisite");

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 ${className}`}>
      {/* 헤더 */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${
          collapsible ? "cursor-pointer" : ""
        }`}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="font-medium text-amber-800">
            선수학습 순서 권장 사항 ({violations.length}건)
          </span>
        </div>
        {collapsible && (
          <button
            type="button"
            className="text-amber-600 hover:text-amber-700"
            aria-label={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {/* 본문 */}
      {isExpanded && (
        <div className="border-t border-amber-200 px-4 py-3">
          {/* 순서 위반 */}
          {orderViolations.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <ArrowRight className="h-4 w-4" />
                순서 조정 권장 ({orderViolations.length}건)
              </h4>
              <ul className="space-y-2">
                {orderViolations.map((violation, index) => (
                  <li
                    key={`order-${index}`}
                    className="rounded-md bg-white px-3 py-2 text-sm text-amber-900"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{violation.prerequisiteTitle}</span>
                      <ArrowRight className="h-3 w-3 text-amber-500" />
                      <span className="font-medium">{violation.dependentTitle}</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-700">{violation.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 선수학습 누락 */}
          {missingPrerequisites.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertCircle className="h-4 w-4" />
                선수학습 누락 ({missingPrerequisites.length}건)
              </h4>
              <ul className="space-y-2">
                {missingPrerequisites.map((violation, index) => (
                  <li
                    key={`missing-${index}`}
                    className="rounded-md bg-white px-3 py-2 text-sm text-amber-900"
                  >
                    <p>{violation.message}</p>
                    <p className="mt-1 text-xs text-amber-700">
                      "{violation.prerequisiteTitle}"을(를) 플랜에 추가하는 것을 권장합니다.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 안내 메시지 */}
          <p className="mt-4 text-xs text-amber-600">
            위 권장 사항은 학습 효과를 높이기 위한 안내입니다. 플랜 생성은 계속 진행됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * ValidationWarning에서 의존성 위반만 추출하는 헬퍼
 */
export function extractDependencyViolations(
  warnings: Array<{ type: string; message: string }>
): DependencyViolation[] {
  return warnings
    .filter((w) => w.type === "content_dependency")
    .map((w) => {
      // 메시지에서 콘텐츠 정보 추출 시도
      // 예: "미적분 기초"이(가) "미적분 심화" 이전에 배치되어야 합니다.
      const orderMatch = w.message.match(/"([^"]+)"이\(가\)\s*"([^"]+)"\s*이전에/);
      const missingMatch = w.message.match(/"([^"]+)"은\(는\)\s*"([^"]+)"을\(를\)\s*선수/);

      if (orderMatch) {
        return {
          prerequisiteContentId: "",
          prerequisiteTitle: orderMatch[1],
          dependentContentId: "",
          dependentTitle: orderMatch[2],
          type: "order_violation" as const,
          message: w.message,
          severity: "warning" as const,
        };
      } else if (missingMatch) {
        return {
          prerequisiteContentId: "",
          prerequisiteTitle: missingMatch[2],
          dependentContentId: "",
          dependentTitle: missingMatch[1],
          type: "missing_prerequisite" as const,
          message: w.message,
          severity: "warning" as const,
        };
      }

      // 기본 형식
      return {
        prerequisiteContentId: "",
        prerequisiteTitle: "알 수 없음",
        dependentContentId: "",
        dependentTitle: "알 수 없음",
        type: "order_violation" as const,
        message: w.message,
        severity: "warning" as const,
      };
    });
}

/**
 * 간단한 인라인 경고 뱃지
 */
export function DependencyWarningBadge({
  count,
  onClick,
}: {
  count: number;
  onClick?: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200"
    >
      <AlertTriangle className="h-3 w-3" />
      선수학습 {count}건
    </button>
  );
}
