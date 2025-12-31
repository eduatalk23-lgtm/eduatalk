/**
 * 전략과목/취약과목 할당 관련 유틸리티 함수
 *
 * UI와 서버 로직에서 공통으로 사용하는 함수들을 제공합니다.
 */

import { logActionDebug } from "@/lib/logging/actionLogger";

/**
 * 콘텐츠별 할당 타입
 */
export type ContentAllocation = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number;
};

/**
 * 교과별 할당 타입
 */
export type SubjectAllocation = {
  subject_id?: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number;
};

/**
 * 콘텐츠 정보 타입
 */
export type ContentInfo = {
  content_type: string;
  content_id: string;
  subject_category?: string | null;
  subject?: string | null;
  subject_id?: string;
};

/**
 * 슬롯 정보 타입 (content_slots에서 필요한 필드만 추출)
 */
export type SlotInfo = {
  id: string;
  subject_category?: string | null;
  subject_id?: string | null;
  content_id?: string | null;
  subject_type?: "strategy" | "weakness" | null;
  weekly_days?: number | null;
};

/**
 * 할당 결과 타입
 */
export type AllocationResult = {
  subject_type: "strategy" | "weakness";
  weekly_days?: number;
  source: "content" | "subject" | "slot" | "default";
};

/**
 * 문자열 정규화 (대소문자 무시, 공백 제거)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * 부분 매칭 검사 (대소문자 무시, 공백 정규화)
 */
function isPartialMatch(str1: string, str2: string): boolean {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  return normalized1.includes(normalized2) || normalized2.includes(normalized1);
}

/**
 * weekly_days 값 검증
 */
function validateWeeklyDays(weeklyDays: number | undefined): boolean {
  if (weeklyDays === undefined) return true;
  return weeklyDays === 2 || weeklyDays === 3 || weeklyDays === 4;
}

/**
 * 할당 데이터 유효성 검증
 */
export function validateAllocations(
  contentAllocations?: ContentAllocation[],
  subjectAllocations?: SubjectAllocation[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // content_allocations 검증
  if (contentAllocations) {
    contentAllocations.forEach((alloc, index) => {
      if (!alloc.content_type || !alloc.content_id) {
        errors.push(`content_allocations[${index}]: content_type 또는 content_id가 없습니다.`);
      }
      if (alloc.subject_type !== "strategy" && alloc.subject_type !== "weakness") {
        errors.push(`content_allocations[${index}]: 잘못된 subject_type입니다: ${alloc.subject_type}`);
      }
      if (alloc.subject_type === "strategy" && !validateWeeklyDays(alloc.weekly_days)) {
        errors.push(
          `content_allocations[${index}]: 전략과목은 weekly_days가 2, 3, 4 중 하나여야 합니다. (현재: ${alloc.weekly_days})`
        );
      }
    });
  }

  // subject_allocations 검증
  if (subjectAllocations) {
    subjectAllocations.forEach((alloc, index) => {
      if (!alloc.subject_name) {
        errors.push(`subject_allocations[${index}]: subject_name이 없습니다.`);
      }
      if (alloc.subject_type !== "strategy" && alloc.subject_type !== "weakness") {
        errors.push(`subject_allocations[${index}]: 잘못된 subject_type입니다: ${alloc.subject_type}`);
      }
      if (alloc.subject_type === "strategy" && !validateWeeklyDays(alloc.weekly_days)) {
        errors.push(
          `subject_allocations[${index}]: 전략과목은 weekly_days가 2, 3, 4 중 하나여야 합니다. (현재: ${alloc.weekly_days})`
        );
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 콘텐츠의 전략/취약 설정을 가져오는 통합 함수
 *
 * 우선순위:
 * 1. content_allocations (콘텐츠별 설정)
 * 2. content_slots (슬롯 모드 설정)
 *    - content_id로 매칭 (슬롯에 연결된 콘텐츠)
 *    - subject_id로 매칭
 *    - subject_category로 매칭
 * 3. subject_allocations (교과별 설정)
 *    - subject_id로 매칭 (가장 정확)
 *    - subject_name과 subject_category 정확 일치
 *    - subject_name에 subject_category가 포함되는지 확인 (부분 매칭)
 *    주의: 교과별 설정은 subject_category(교과)만 기준으로 매칭합니다.
 *          subject 필드(과목)는 매칭 조건에서 제외됩니다.
 * 4. 기본값 (취약과목)
 *
 * @param content - 콘텐츠 정보
 * @param contentAllocations - 콘텐츠별 설정 (선택사항)
 * @param subjectAllocations - 교과별 설정 (선택사항)
 * @param contentSlots - 슬롯 모드 설정 (선택사항)
 * @param enableLogging - 상세 로깅 활성화 여부 (기본값: 개발 환경에서만)
 * @returns 전략/취약 설정 및 주당 배정 일수, 출처 정보
 */
export function getEffectiveAllocation(
  content: ContentInfo,
  contentAllocations?: ContentAllocation[],
  subjectAllocations?: SubjectAllocation[],
  contentSlots?: SlotInfo[],
  enableLogging: boolean = process.env.NODE_ENV === "development"
): AllocationResult {
  const log = (message: string, data?: unknown) => {
    if (enableLogging) {
      logActionDebug(
        { domain: "utils", action: "getEffectiveAllocation" },
        message,
        data ? { data } : undefined
      );
    }
  };

  log("시작", {
    content_id: content.content_id,
    content_type: content.content_type,
    subject_category: content.subject_category,
    subject: content.subject,
    subject_id: content.subject_id,
  });

  // 1순위: 콘텐츠별 설정
  if (contentAllocations && contentAllocations.length > 0) {
    const contentAlloc = contentAllocations.find(
      (a) => a.content_type === content.content_type && a.content_id === content.content_id
    );
    if (contentAlloc) {
      log("콘텐츠별 설정 매칭 성공", {
        content_id: content.content_id,
        subject_type: contentAlloc.subject_type,
        weekly_days: contentAlloc.weekly_days,
      });
      return {
        subject_type: contentAlloc.subject_type,
        weekly_days: contentAlloc.weekly_days,
        source: "content",
      };
    }
    log("콘텐츠별 설정 매칭 실패", {
      content_id: content.content_id,
      available_content_allocations: contentAllocations.length,
    });
  }

  // 2순위: 슬롯 모드 설정
  if (contentSlots && contentSlots.length > 0) {
    // 2-1: content_id로 매칭 (슬롯에 연결된 콘텐츠)
    const slotByContentId = contentSlots.find(
      (s) => s.content_id && s.content_id === content.content_id
    );
    if (slotByContentId && slotByContentId.subject_type) {
      log("슬롯 설정 매칭 성공 (content_id)", {
        slot_id: slotByContentId.id,
        content_id: content.content_id,
        subject_type: slotByContentId.subject_type,
        weekly_days: slotByContentId.weekly_days,
      });
      return {
        subject_type: slotByContentId.subject_type,
        weekly_days: slotByContentId.weekly_days ?? undefined,
        source: "slot",
      };
    }

    // 2-2: subject_id로 매칭
    if (content.subject_id) {
      const slotBySubjectId = contentSlots.find(
        (s) => s.subject_id && s.subject_id === content.subject_id
      );
      if (slotBySubjectId && slotBySubjectId.subject_type) {
        log("슬롯 설정 매칭 성공 (subject_id)", {
          slot_id: slotBySubjectId.id,
          subject_id: content.subject_id,
          subject_type: slotBySubjectId.subject_type,
          weekly_days: slotBySubjectId.weekly_days,
        });
        return {
          subject_type: slotBySubjectId.subject_type,
          weekly_days: slotBySubjectId.weekly_days ?? undefined,
          source: "slot",
        };
      }
    }

    // 2-3: subject_category로 매칭
    if (content.subject_category) {
      const slotByCategory = contentSlots.find(
        (s) =>
          s.subject_category &&
          normalizeString(s.subject_category) === normalizeString(content.subject_category!)
      );
      if (slotByCategory && slotByCategory.subject_type) {
        log("슬롯 설정 매칭 성공 (subject_category)", {
          slot_id: slotByCategory.id,
          subject_category: content.subject_category,
          subject_type: slotByCategory.subject_type,
          weekly_days: slotByCategory.weekly_days,
        });
        return {
          subject_type: slotByCategory.subject_type,
          weekly_days: slotByCategory.weekly_days ?? undefined,
          source: "slot",
        };
      }
    }

    log("슬롯 설정 매칭 실패 (모든 조건)", {
      content_id: content.content_id,
      subject_id: content.subject_id,
      subject_category: content.subject_category,
      available_slots: contentSlots.length,
    });
  }

  // 3순위: 교과별 설정 (폴백)
  // 교과별 설정은 subject_category(교과)만 기준으로 매칭
  // subject 필드(과목)는 매칭 조건에서 제외
  if (subjectAllocations && subjectAllocations.length > 0) {
    // 3-1: subject_id로 매칭 (가장 정확)
    if (content.subject_id) {
      const subjectAlloc = subjectAllocations.find(
        (a) => a.subject_id && a.subject_id === content.subject_id
      );
      if (subjectAlloc) {
        log("교과별 설정 매칭 성공 (subject_id)", {
          subject_id: content.subject_id,
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
        });
        return {
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
          source: "subject",
        };
      }
      log("교과별 설정 매칭 실패 (subject_id)", {
        subject_id: content.subject_id,
        available_subject_allocations: subjectAllocations.length,
      });
    }

    // 3-2: subject_name과 subject_category 정확 일치
    if (content.subject_category) {
      const subjectAlloc = subjectAllocations.find(
        (a) => normalizeString(a.subject_name) === normalizeString(content.subject_category!)
      );
      if (subjectAlloc) {
        log("교과별 설정 매칭 성공 (정확 일치)", {
          subject_category: content.subject_category,
          subject_name: subjectAlloc.subject_name,
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
        });
        return {
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
          source: "subject",
        };
      }
    }

    // 3-3: subject_name에 subject_category가 포함되는지 확인 (부분 매칭)
    if (content.subject_category) {
      const subjectAlloc = subjectAllocations.find((a) =>
        isPartialMatch(a.subject_name, content.subject_category!)
      );
      if (subjectAlloc) {
        log("교과별 설정 매칭 성공 (부분 매칭 - subject_category)", {
          subject_category: content.subject_category,
          subject_name: subjectAlloc.subject_name,
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
        });
        return {
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
          source: "subject",
        };
      }
    }

    log("교과별 설정 매칭 실패 (모든 조건)", {
      subject_category: content.subject_category,
      subject_id: content.subject_id,
      available_subject_allocations: subjectAllocations.map((a) => ({
        subject_id: a.subject_id,
        subject_name: a.subject_name,
      })),
    });
  }

  // 4순위: 기본값 (취약과목)
  log("기본값 사용 (취약과목)", {
    content_id: content.content_id,
  });
  return {
    subject_type: "weakness",
    weekly_days: undefined,
    source: "default",
  };
}

