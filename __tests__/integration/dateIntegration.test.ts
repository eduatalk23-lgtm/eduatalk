/**
 * 날짜 관련 통합 테스트
 * date + phone, date + planUtils 조합 시나리오
 */

import { describe, it, expect } from "vitest";
import {
  parseDateString,
  formatDateString,
  isValidDateString,
  calculateDday,
  getDaysDifference,
  generateDateRange,
  isFutureDate,
} from "@/lib/utils/date";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
  maskPhoneNumber,
} from "@/lib/utils/phone";
import {
  isCompletedPlan,
  calculateCompletionRate,
  filterLearningPlans,
  countCompletedLearningPlans,
  type PlanCompletionFields,
} from "@/lib/utils/planUtils";
import { DUMMY_NON_LEARNING_CONTENT_ID } from "@/lib/constants/plan";

describe("date + phone 조합 시나리오", () => {
  describe("학생 정보 생성: 생년월일 + 전화번호", () => {
    it("생년월일과 전화번호를 함께 처리", () => {
      const birthDate = "2000-01-01";
      const phone = "010-1234-5678";

      // 날짜 검증
      const isValidDate = isValidDateString(birthDate);
      const dateParts = parseDateString(birthDate);

      // 전화번호 검증
      const normalizedPhone = normalizePhoneNumber(phone);
      const phoneValidation = validatePhoneNumber(phone);

      expect(isValidDate).toBe(true);
      expect(dateParts).toEqual({ year: 2000, month: 1, day: 1 });
      expect(normalizedPhone).toBe("010-1234-5678");
      expect(phoneValidation.valid).toBe(true);
    });

    it("잘못된 생년월일과 전화번호 처리", () => {
      const birthDate = "2000-13-01"; // 잘못된 월
      const phone = "02-1234-5678"; // 010으로 시작하지 않음

      const isValidDate = isValidDateString(birthDate);
      const normalizedPhone = normalizePhoneNumber(phone);
      const phoneValidation = validatePhoneNumber(phone);

      expect(isValidDate).toBe(false);
      expect(normalizedPhone).toBeNull();
      expect(phoneValidation.valid).toBe(false);
    });
  });

  describe("날짜 포맷팅 + 전화번호 마스킹: UI 표시용", () => {
    it("생년월일 포맷팅과 전화번호 마스킹", () => {
      const birthDate = "2000-01-01";
      const phone = "010-1234-5678";

      // 날짜 파싱 및 포맷팅
      const dateParts = parseDateString(birthDate);
      const formattedDate = formatDateString(
        dateParts.year,
        dateParts.month,
        dateParts.day
      );

      // 전화번호 마스킹
      const maskedPhone = maskPhoneNumber(phone);

      expect(formattedDate).toBe("2000-01-01");
      expect(maskedPhone).toBe("010-****-5678");
    });

    it("여러 학생 정보 일괄 처리", () => {
      const students = [
        { birthDate: "2000-01-01", phone: "010-1234-5678" },
        { birthDate: "2001-02-02", phone: "010-2345-6789" },
        { birthDate: "2002-03-03", phone: "010-3456-7890" },
      ];

      const processed = students.map((student) => {
        const dateParts = parseDateString(student.birthDate);
        const formattedDate = formatDateString(
          dateParts.year,
          dateParts.month,
          dateParts.day
        );
        const maskedPhone = maskPhoneNumber(student.phone);

        return { formattedDate, maskedPhone };
      });

      expect(processed[0].formattedDate).toBe("2000-01-01");
      expect(processed[0].maskedPhone).toBe("010-****-5678");
      expect(processed[1].formattedDate).toBe("2001-02-02");
      expect(processed[1].maskedPhone).toBe("010-****-6789");
      expect(processed[2].formattedDate).toBe("2002-03-03");
      expect(processed[2].maskedPhone).toBe("010-****-7890");
    });
  });

  describe("날짜 유효성 + 전화번호 유효성 동시 검증", () => {
    it("모든 필드가 유효한 경우", () => {
      const birthDate = "2000-01-01";
      const phone = "010-1234-5678";

      const isValidDate = isValidDateString(birthDate);
      const phoneValidation = validatePhoneNumber(phone);

      expect(isValidDate).toBe(true);
      expect(phoneValidation.valid).toBe(true);
    });

    it("날짜만 유효하지 않은 경우", () => {
      const birthDate = "2000-13-01";
      const phone = "010-1234-5678";

      const isValidDate = isValidDateString(birthDate);
      const phoneValidation = validatePhoneNumber(phone);

      expect(isValidDate).toBe(false);
      expect(phoneValidation.valid).toBe(true);
    });

    it("전화번호만 유효하지 않은 경우", () => {
      const birthDate = "2000-01-01";
      const phone = "02-1234-5678";

      const isValidDate = isValidDateString(birthDate);
      const phoneValidation = validatePhoneNumber(phone);

      expect(isValidDate).toBe(true);
      expect(phoneValidation.valid).toBe(false);
    });

    it("모든 필드가 유효하지 않은 경우", () => {
      const birthDate = "2000-13-01";
      const phone = "02-1234-5678";

      const isValidDate = isValidDateString(birthDate);
      const phoneValidation = validatePhoneNumber(phone);

      expect(isValidDate).toBe(false);
      expect(phoneValidation.valid).toBe(false);
    });
  });
});

describe("date + planUtils 조합 시나리오", () => {
  describe("플랜 그룹 완료율 계산: planUtils + date", () => {
    it("기간별 완료율 계산", () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      // 날짜 범위 생성
      const dateRange = generateDateRange(startDate, endDate);
      const totalDays = getDaysDifference(startDate, endDate) + 1;

      // 플랜 데이터 (예시)
      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          { actual_end_time: "2025-01-05T10:00:00Z", progress: 100 },
          { actual_end_time: "2025-01-10T10:00:00Z", progress: 100 },
          { actual_end_time: null, progress: 50 },
          { actual_end_time: null, progress: null },
        ];

      // 완료율 계산
      const completionRate = calculateCompletionRate(plans);

      expect(dateRange.length).toBe(31);
      expect(totalDays).toBe(31);
      expect(typeof completionRate).toBe("number");
      expect(completionRate).toBeGreaterThanOrEqual(0);
      expect(completionRate).toBeLessThanOrEqual(100);
    });

    it("D-day 계산 + 완료율", () => {
      const targetDate = "2025-12-31";
      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          { actual_end_time: "2025-01-05T10:00:00Z", progress: 100 },
          { actual_end_time: null, progress: 50 },
          { actual_end_time: null, progress: null },
        ];

      // D-day 계산
      const dday = calculateDday(targetDate);

      // 완료율 계산
      const completionRate = calculateCompletionRate(plans);

      expect(typeof dday).toBe("number");
      expect(typeof completionRate).toBe("number");
      expect(completionRate).toBeGreaterThanOrEqual(0);
      expect(completionRate).toBeLessThanOrEqual(100);
    });
  });

  describe("날짜 범위 내 완료율 계산", () => {
    it("특정 기간 내 완료된 플랜 필터링", () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          {
            actual_end_time: "2025-01-05T10:00:00Z",
            progress: 100,
            content_id: "content-1",
          },
          {
            actual_end_time: "2025-01-10T10:00:00Z",
            progress: 100,
            content_id: "content-2",
          },
          {
            actual_end_time: "2025-02-05T10:00:00Z",
            progress: 100,
            content_id: "content-3",
          }, // 기간 밖
          { actual_end_time: null, progress: 50, content_id: "content-4" },
        ];

      // 기간 내 완료된 플랜 필터링
      const completedInRange = plans.filter((plan) => {
        if (!plan.actual_end_time) return false;
        const endDateObj = new Date(plan.actual_end_time);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return endDateObj >= start && endDateObj <= end;
      });

      // 완료율 계산
      const completionRate = calculateCompletionRate(completedInRange);

      expect(completedInRange.length).toBe(2);
      expect(typeof completionRate).toBe("number");
    });

    it("미래 날짜 기반 완료율 계산", () => {
      // 동적으로 1년 후 날짜 생성 (항상 미래 날짜가 되도록)
      const today = new Date();
      const futureYear = today.getFullYear() + 1;
      const futureDate = `${futureYear}-12-31`;

      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          { actual_end_time: null, progress: 100 },
          { actual_end_time: null, progress: 50 },
          { actual_end_time: null, progress: null },
        ];

      const isFuture = isFutureDate(futureDate);
      const completionRate = calculateCompletionRate(plans);

      expect(isFuture).toBe(true);
      expect(typeof completionRate).toBe("number");
    });
  });

  describe("날짜 범위 유효성 + 플랜 완료 판별", () => {
    it("유효한 날짜 범위 내 완료 플랜 판별", () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const plans: PlanCompletionFields[] = [
        { actual_end_time: "2025-01-05T10:00:00Z", progress: 100 },
        { actual_end_time: "2025-01-10T10:00:00Z", progress: 100 },
        { actual_end_time: null, progress: 50 },
      ];

      // 날짜 범위 유효성 검사
      const isValidRange = startDate <= endDate;

      // 완료 플랜 필터링
      const completedPlans = plans.filter((plan) => isCompletedPlan(plan));

      expect(isValidRange).toBe(true);
      expect(completedPlans.length).toBe(2);
    });

    it("학습 플랜만 필터링 후 완료율 계산", () => {
      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          {
            actual_end_time: "2025-01-05T10:00:00Z",
            progress: 100,
            content_id: "content-1",
          },
          {
            actual_end_time: null,
            progress: 50,
            content_id: DUMMY_NON_LEARNING_CONTENT_ID,
          },
          { actual_end_time: null, progress: null, content_id: "content-2" },
        ];

      // 학습 플랜만 필터링
      const learningPlans = filterLearningPlans(plans);

      // 완료율 계산
      const completionRate = calculateCompletionRate(learningPlans);

      expect(learningPlans.length).toBe(2);
      expect(typeof completionRate).toBe("number");
    });
  });
});

