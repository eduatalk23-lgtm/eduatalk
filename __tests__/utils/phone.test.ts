/**
 * phone 유틸리티 함수 단위 테스트
 */

import { describe, it, expect } from "vitest";
import {
  extractPhoneDigits,
  formatPhoneNumber,
  normalizePhoneNumber,
  maskPhoneNumber,
  validatePhoneNumber,
} from "@/lib/utils/phone";

describe("extractPhoneDigits", () => {
  describe("정상 케이스", () => {
    it("하이픈이 포함된 전화번호에서 숫자만 추출", () => {
      const result = extractPhoneDigits("010-1234-5678");

      expect(result).toBe("01012345678");
    });

    it("공백이 포함된 전화번호에서 숫자만 추출", () => {
      const result = extractPhoneDigits("010 1234 5678");

      expect(result).toBe("01012345678");
    });

    it("특수 문자가 포함된 전화번호에서 숫자만 추출", () => {
      const result = extractPhoneDigits("010-1234-5678 (내선)");

      expect(result).toBe("01012345678");
    });

    it("숫자만 있는 전화번호는 그대로 반환", () => {
      const result = extractPhoneDigits("01012345678");

      expect(result).toBe("01012345678");
    });
  });

  describe("엣지 케이스", () => {
    it("빈 문자열은 빈 문자열 반환", () => {
      const result = extractPhoneDigits("");

      expect(result).toBe("");
    });

    it("숫자가 없으면 빈 문자열 반환", () => {
      const result = extractPhoneDigits("abc-def-ghij");

      expect(result).toBe("");
    });
  });
});

describe("formatPhoneNumber", () => {
  describe("정상 케이스 - 010으로 시작", () => {
    it("11자리 전화번호를 010-1234-5678 형식으로 포맷팅", () => {
      const result = formatPhoneNumber("01012345678");

      expect(result).toBe("010-1234-5678");
    });

    it("10자리 전화번호를 010-123-4567 형식으로 포맷팅", () => {
      const result = formatPhoneNumber("0101234567");

      expect(result).toBe("010-123-4567");
    });

    it("하이픈이 포함된 전화번호도 포맷팅", () => {
      const result = formatPhoneNumber("010-1234-5678");

      expect(result).toBe("010-1234-5678");
    });

    it("입력 중인 3자리 이하는 그대로 반환", () => {
      const result = formatPhoneNumber("010");

      expect(result).toBe("010");
    });

    it("입력 중인 4~7자리는 부분 포맷팅", () => {
      expect(formatPhoneNumber("0101")).toBe("010-1");
      expect(formatPhoneNumber("0101234")).toBe("010-1234");
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열은 빈 문자열 반환", () => {
      const result = formatPhoneNumber("");

      expect(result).toBe("");
    });

    it("11자리 초과는 앞 11자리만 포맷팅", () => {
      const result = formatPhoneNumber("010123456789");

      expect(result).toBe("010-1234-5678");
    });
  });

  describe("엣지 케이스 - 010으로 시작하지 않음", () => {
    it("010으로 시작하지 않으면 포맷팅만 적용", () => {
      const result = formatPhoneNumber("0212345678");

      expect(result).toBe("021-2345-678");
    });

    it("010으로 시작하지 않는 3자리 이하는 그대로 반환", () => {
      const result = formatPhoneNumber("021");

      expect(result).toBe("021");
    });
  });
});

describe("normalizePhoneNumber", () => {
  describe("정상 케이스", () => {
    it("11자리 전화번호를 010-1234-5678 형식으로 정규화", () => {
      const result = normalizePhoneNumber("01012345678");

      expect(result).toBe("010-1234-5678");
    });

    it("10자리 전화번호를 010-123-4567 형식으로 정규화", () => {
      const result = normalizePhoneNumber("0101234567");

      expect(result).toBe("010-123-4567");
    });

    it("하이픈이 포함된 전화번호도 정규화", () => {
      const result = normalizePhoneNumber("010-1234-5678");

      expect(result).toBe("010-1234-5678");
    });

    it("공백이 포함된 전화번호도 정규화", () => {
      const result = normalizePhoneNumber("010 1234 5678");

      expect(result).toBe("010-1234-5678");
    });
  });

  describe("에러 케이스", () => {
    it("010으로 시작하지 않으면 null 반환", () => {
      const result = normalizePhoneNumber("0212345678");

      expect(result).toBeNull();
    });

    it("10자리 미만이면 null 반환", () => {
      const result = normalizePhoneNumber("010123456");

      expect(result).toBeNull();
    });

    it("11자리 초과이면 null 반환", () => {
      const result = normalizePhoneNumber("010123456789");

      expect(result).toBeNull();
    });

    it("빈 문자열이면 null 반환", () => {
      const result = normalizePhoneNumber("");

      expect(result).toBeNull();
    });

    it("공백만 있으면 null 반환", () => {
      const result = normalizePhoneNumber("   ");

      expect(result).toBeNull();
    });
  });

  describe("엣지 케이스", () => {
    it("특수 문자가 포함된 전화번호도 정규화", () => {
      const result = normalizePhoneNumber("010-1234-5678 (내선)");

      expect(result).toBe("010-1234-5678");
    });
  });
});

describe("maskPhoneNumber", () => {
  describe("정상 케이스", () => {
    it("11자리 전화번호를 마스킹", () => {
      const result = maskPhoneNumber("010-1234-5678");

      expect(result).toBe("010-****-5678");
    });

    it("10자리 전화번호를 마스킹", () => {
      const result = maskPhoneNumber("010-123-4567");

      expect(result).toBe("010-***-4567");
    });

    it("하이픈 없이도 마스킹", () => {
      const result = maskPhoneNumber("01012345678");

      expect(result).toBe("010-****-5678");
    });
  });

  describe("경계값 테스트", () => {
    it("4자리 이하는 모두 마스킹", () => {
      expect(maskPhoneNumber("1234")).toBe("****");
      expect(maskPhoneNumber("123")).toBe("123");
    });

    it("빈 문자열은 그대로 반환", () => {
      const result = maskPhoneNumber("");

      expect(result).toBe("");
    });
  });

  describe("엣지 케이스", () => {
    it("짧은 전화번호 처리", () => {
      const result = maskPhoneNumber("010");

      expect(result).toBe("010");
    });

    it("공백이 포함된 전화번호도 마스킹 (공백은 유지됨)", () => {
      const result = maskPhoneNumber("010 1234 5678");

      // 하이픈만 제거하고 공백은 유지되므로 공백이 포함된 결과 반환
      expect(result).toBe("010- **** -5678");
    });
  });
});

describe("validatePhoneNumber", () => {
  describe("정상 케이스", () => {
    it("11자리 전화번호는 유효", () => {
      const result = validatePhoneNumber("010-1234-5678");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("10자리 전화번호는 유효", () => {
      const result = validatePhoneNumber("010-123-4567");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("하이픈 없이도 유효", () => {
      const result = validatePhoneNumber("01012345678");

      expect(result.valid).toBe(true);
    });

    it("빈 값은 유효 (선택사항)", () => {
      const result = validatePhoneNumber("");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("공백만 있어도 유효 (선택사항)", () => {
      const result = validatePhoneNumber("   ");

      expect(result.valid).toBe(true);
    });
  });

  describe("에러 케이스", () => {
    it("010으로 시작하지 않으면 유효하지 않음", () => {
      const result = validatePhoneNumber("0212345678");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("010으로 시작");
    });

    it("10자리 미만이면 유효하지 않음", () => {
      const result = validatePhoneNumber("010123456");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("10자리 이상");
    });

    it("11자리 초과이면 유효하지 않음", () => {
      const result = validatePhoneNumber("010123456789");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("11자리 이하");
    });
  });

  describe("경계값 테스트", () => {
    it("정확히 10자리는 유효", () => {
      const result = validatePhoneNumber("0101234567");

      expect(result.valid).toBe(true);
    });

    it("정확히 11자리는 유효", () => {
      const result = validatePhoneNumber("01012345678");

      expect(result.valid).toBe(true);
    });

    it("9자리는 유효하지 않음", () => {
      const result = validatePhoneNumber("010123456");

      expect(result.valid).toBe(false);
    });

    it("12자리는 유효하지 않음", () => {
      const result = validatePhoneNumber("010123456789");

      expect(result.valid).toBe(false);
    });
  });

  describe("엣지 케이스", () => {
    it("특수 문자가 포함된 전화번호도 검증", () => {
      const result = validatePhoneNumber("010-1234-5678 (내선)");

      expect(result.valid).toBe(true);
    });

    it("공백이 포함된 전화번호도 검증", () => {
      const result = validatePhoneNumber("010 1234 5678");

      expect(result.valid).toBe(true);
    });
  });
});

