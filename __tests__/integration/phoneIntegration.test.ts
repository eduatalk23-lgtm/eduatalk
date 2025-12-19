/**
 * 전화번호 관련 통합 테스트
 * phone + date 조합 시나리오
 * 
 * 참고: date + phone 조합의 주요 시나리오는 dateIntegration.test.ts에 포함되어 있습니다.
 * 이 파일은 전화번호 중심의 추가 통합 시나리오를 다룹니다.
 */

import { describe, it, expect } from "vitest";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
  maskPhoneNumber,
  formatPhoneNumber,
} from "@/lib/utils/phone";
import {
  parseDateString,
  formatDateString,
  isValidDateString,
} from "@/lib/utils/date";

describe("전화번호 + 날짜 조합 시나리오", () => {
  describe("학생 정보 생성 파이프라인", () => {
    it("생년월일과 전화번호를 함께 검증 및 포맷팅", () => {
      const birthDate = "2000-01-01";
      const phone = "01012345678";

      // 날짜 파싱 및 검증
      const dateParts = parseDateString(birthDate);
      const formattedDate = formatDateString(
        dateParts.year,
        dateParts.month,
        dateParts.day
      );
      const isValidDate = isValidDateString(formattedDate);

      // 전화번호 정규화 및 검증
      const normalizedPhone = normalizePhoneNumber(phone);
      const phoneValidation = validatePhoneNumber(phone);

      expect(formattedDate).toBe("2000-01-01");
      expect(isValidDate).toBe(true);
      expect(normalizedPhone).toBe("010-1234-5678");
      expect(phoneValidation.valid).toBe(true);
    });

    it("여러 학생 정보 일괄 처리", () => {
      const students = [
        { birthDate: "2000-01-01", phone: "01012345678" },
        { birthDate: "2001-02-02", phone: "01023456789" },
        { birthDate: "2002-03-03", phone: "01034567890" },
      ];

      const processed = students.map((student) => {
        const dateParts = parseDateString(student.birthDate);
        const formattedDate = formatDateString(
          dateParts.year,
          dateParts.month,
          dateParts.day
        );
        const normalizedPhone = normalizePhoneNumber(student.phone);
        const phoneValidation = validatePhoneNumber(student.phone);

        return {
          formattedDate,
          normalizedPhone,
          isValidPhone: phoneValidation.valid,
        };
      });

      expect(processed[0].formattedDate).toBe("2000-01-01");
      expect(processed[0].normalizedPhone).toBe("010-1234-5678");
      expect(processed[0].isValidPhone).toBe(true);
      expect(processed[1].formattedDate).toBe("2001-02-02");
      expect(processed[1].normalizedPhone).toBe("010-2345-6789");
      expect(processed[1].isValidPhone).toBe(true);
    });
  });

  describe("UI 표시용 포맷팅 파이프라인", () => {
    it("전화번호 실시간 포맷팅 + 날짜 포맷팅", () => {
      const phone = "01012345678";
      const birthDate = "2000-01-01";

      // 실시간 포맷팅
      const formattedPhone = formatPhoneNumber(phone);

      // 날짜 포맷팅
      const dateParts = parseDateString(birthDate);
      const formattedDate = formatDateString(
        dateParts.year,
        dateParts.month,
        dateParts.day
      );

      expect(formattedPhone).toBe("010-1234-5678");
      expect(formattedDate).toBe("2000-01-01");
    });

    it("전화번호 마스킹 + 날짜 포맷팅", () => {
      const phone = "010-1234-5678";
      const birthDate = "2000-01-01";

      // 마스킹
      const maskedPhone = maskPhoneNumber(phone);

      // 날짜 포맷팅
      const dateParts = parseDateString(birthDate);
      const formattedDate = formatDateString(
        dateParts.year,
        dateParts.month,
        dateParts.day
      );

      expect(maskedPhone).toBe("010-****-5678");
      expect(formattedDate).toBe("2000-01-01");
    });
  });

  describe("검증 파이프라인", () => {
    it("날짜와 전화번호 동시 검증", () => {
      const birthDate = "2000-01-01";
      const phone = "010-1234-5678";

      const isValidDate = isValidDateString(birthDate);
      const phoneValidation = validatePhoneNumber(phone);

      const allValid = isValidDate && phoneValidation.valid;

      expect(isValidDate).toBe(true);
      expect(phoneValidation.valid).toBe(true);
      expect(allValid).toBe(true);
    });

    it("하나만 유효하지 않은 경우 처리", () => {
      const invalidDate = "2000-13-01";
      const validPhone = "010-1234-5678";

      const isValidDate = isValidDateString(invalidDate);
      const phoneValidation = validatePhoneNumber(validPhone);

      const allValid = isValidDate && phoneValidation.valid;

      expect(isValidDate).toBe(false);
      expect(phoneValidation.valid).toBe(true);
      expect(allValid).toBe(false);
    });
  });
});

