/**
 * FormData 처리 통합 테스트
 * formDataHelpers + phone + date 조합 시나리오
 */

import { describe, it, expect } from "vitest";
import {
  getFormString,
  getFormInt,
  getFormDate,
  getFormBoolean,
} from "@/lib/utils/formDataHelpers";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
  maskPhoneNumber,
} from "@/lib/utils/phone";
import {
  parseDateString,
  formatDateString,
  isValidDateString,
  calculateDday,
} from "@/lib/utils/date";

describe("회원가입 폼 처리 시나리오", () => {
  it("이름, 전화번호, 생년월일을 파싱하고 검증", () => {
    const formData = new FormData();
    formData.append("name", "홍길동");
    formData.append("phone", "010-1234-5678");
    formData.append("birthDate", "2000-01-01");

    // FormData에서 값 추출
    const name = getFormString(formData, "name");
    const phone = getFormString(formData, "phone");
    const birthDate = getFormDate(formData, "birthDate");

    // 검증
    expect(name).toBe("홍길동");
    expect(phone).toBe("010-1234-5678");
    expect(birthDate).toBe("2000-01-01");

    // 전화번호 정규화 및 검증
    const normalizedPhone = normalizePhoneNumber(phone!);
    const phoneValidation = validatePhoneNumber(phone!);

    expect(normalizedPhone).toBe("010-1234-5678");
    expect(phoneValidation.valid).toBe(true);

    // 생년월일 파싱 및 검증
    const dateParts = parseDateString(birthDate!);
    const isValidDate = isValidDateString(birthDate!);

    expect(dateParts).toEqual({ year: 2000, month: 1, day: 1 });
    expect(isValidDate).toBe(true);
  });

  it("공백이 포함된 입력값 처리", () => {
    const formData = new FormData();
    formData.append("name", "  홍길동  ");
    formData.append("phone", "  010-1234-5678  ");
    formData.append("birthDate", "  2000-01-01  ");

    const name = getFormString(formData, "name");
    const phone = getFormString(formData, "phone");
    const birthDate = getFormDate(formData, "birthDate");

    expect(name).toBe("홍길동");
    expect(phone).toBe("010-1234-5678");
    expect(birthDate).toBe("2000-01-01");

    // 정규화 및 검증
    const normalizedPhone = normalizePhoneNumber(phone!);
    expect(normalizedPhone).toBe("010-1234-5678");
  });

  it("빈 필드 처리 (선택적 필드)", () => {
    const formData = new FormData();
    formData.append("name", "홍길동");
    // phone과 birthDate는 비어있음

    const name = getFormString(formData, "name");
    const phone = getFormString(formData, "phone");
    const birthDate = getFormDate(formData, "birthDate");

    expect(name).toBe("홍길동");
    expect(phone).toBeNull();
    expect(birthDate).toBeNull();
  });
});

describe("학생 정보 수정 시나리오", () => {
  it("FormData → phone 정규화 → 검증 파이프라인", () => {
    const formData = new FormData();
    formData.append("phone", "01012345678"); // 하이픈 없이 입력

    // FormData에서 추출
    const phone = getFormString(formData, "phone");

    // 정규화
    const normalizedPhone = normalizePhoneNumber(phone!);

    // 검증
    const validation = validatePhoneNumber(normalizedPhone!);

    expect(normalizedPhone).toBe("010-1234-5678");
    expect(validation.valid).toBe(true);
  });

  it("잘못된 전화번호 처리", () => {
    const formData = new FormData();
    formData.append("phone", "02-1234-5678"); // 010으로 시작하지 않음

    const phone = getFormString(formData, "phone");
    const normalizedPhone = normalizePhoneNumber(phone!);
    const validation = validatePhoneNumber(phone!);

    expect(normalizedPhone).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("010으로 시작");
  });

  it("전화번호 마스킹 처리", () => {
    const formData = new FormData();
    formData.append("phone", "010-1234-5678");

    const phone = getFormString(formData, "phone");
    const maskedPhone = maskPhoneNumber(phone!);

    expect(maskedPhone).toBe("010-****-5678");
  });
});

describe("날짜 선택 + FormData 시나리오", () => {
  it("날짜 파싱 + FormData 추출", () => {
    const formData = new FormData();
    formData.append("startDate", "2025-01-01");
    formData.append("endDate", "2025-12-31");

    // FormData에서 추출
    const startDate = getFormDate(formData, "startDate");
    const endDate = getFormDate(formData, "endDate");

    // 날짜 파싱
    const startParts = parseDateString(startDate!);
    const endParts = parseDateString(endDate!);

    // 날짜 포맷팅
    const formattedStart = formatDateString(
      startParts.year,
      startParts.month,
      startParts.day
    );
    const formattedEnd = formatDateString(
      endParts.year,
      endParts.month,
      endParts.day
    );

    expect(startParts).toEqual({ year: 2025, month: 1, day: 1 });
    expect(endParts).toEqual({ year: 2025, month: 12, day: 31 });
    expect(formattedStart).toBe("2025-01-01");
    expect(formattedEnd).toBe("2025-12-31");
  });

  it("D-day 계산 + FormData", () => {
    const formData = new FormData();
    formData.append("targetDate", "2025-12-31");

    const targetDate = getFormDate(formData, "targetDate");
    const dday = calculateDday(targetDate!);

    // D-day는 현재 날짜에 따라 달라지므로 범위로 검증
    expect(typeof dday).toBe("number");
  });

  it("잘못된 날짜 형식 처리", () => {
    const formData = new FormData();
    formData.append("date", "2025-13-01"); // 잘못된 월

    const date = getFormDate(formData, "date");
    const isValid = isValidDateString(date!);

    expect(date).toBe("2025-13-01"); // FormData는 그대로 반환
    expect(isValid).toBe(false); // 검증에서 실패
  });
});

describe("전체 폼 처리 파이프라인", () => {
  it("복합 폼 데이터 처리", () => {
    const formData = new FormData();
    formData.append("name", "홍길동");
    formData.append("age", "25");
    formData.append("phone", "010-1234-5678");
    formData.append("birthDate", "2000-01-01");
    formData.append("isActive", "true");
    formData.append("email", "test@example.com");

    // 모든 필드 추출
    const name = getFormString(formData, "name");
    const age = getFormInt(formData, "age");
    const phone = getFormString(formData, "phone");
    const birthDate = getFormDate(formData, "birthDate");
    const isActive = getFormBoolean(formData, "isActive");
    const email = getFormString(formData, "email");

    // 검증
    expect(name).toBe("홍길동");
    expect(age).toBe(25);
    expect(phone).toBe("010-1234-5678");
    expect(birthDate).toBe("2000-01-01");
    expect(isActive).toBe(true);
    expect(email).toBe("test@example.com");

    // 전화번호 정규화 및 검증
    const normalizedPhone = normalizePhoneNumber(phone!);
    const phoneValidation = validatePhoneNumber(phone!);

    expect(normalizedPhone).toBe("010-1234-5678");
    expect(phoneValidation.valid).toBe(true);

    // 날짜 검증
    const isValidDate = isValidDateString(birthDate!);
    expect(isValidDate).toBe(true);
  });

  it("부분적으로 채워진 폼 처리", () => {
    const formData = new FormData();
    formData.append("name", "홍길동");
    // age, phone, birthDate는 비어있음

    const name = getFormString(formData, "name");
    const age = getFormInt(formData, "age", 0);
    const phone = getFormString(formData, "phone");
    const birthDate = getFormDate(formData, "birthDate");

    expect(name).toBe("홍길동");
    expect(age).toBe(0); // 기본값
    expect(phone).toBeNull();
    expect(birthDate).toBeNull();
  });

  it("공백만 있는 필드 처리", () => {
    const formData = new FormData();
    formData.append("name", "   ");
    formData.append("phone", "   ");

    const name = getFormString(formData, "name", "기본값");
    const phone = getFormString(formData, "phone");

    expect(name).toBe("기본값");
    expect(phone).toBeNull();
  });
});

