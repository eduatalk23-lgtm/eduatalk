/**
 * date 유틸리티 함수 단위 테스트
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTodayParts,
  parseDateString,
  formatDateString,
  getDaysInMonth,
  getDaysDifference,
  getWeeksDifference,
  calculateEndDate,
  formatDateFromDate,
  addDaysToDate,
  calculateDday,
  isValidDateString,
  isValidDateRange,
  isFutureDate,
  getDayOfWeekName,
  getDayOfWeek,
  generateDateRange,
} from "@/lib/utils/date";

describe("getTodayParts", () => {
  it("오늘 날짜의 연/월/일을 반환", () => {
    const result = getTodayParts();

    expect(result).toHaveProperty("year");
    expect(result).toHaveProperty("month");
    expect(result).toHaveProperty("day");
    expect(typeof result.year).toBe("number");
    expect(typeof result.month).toBe("number");
    expect(typeof result.day).toBe("number");
    expect(result.month).toBeGreaterThanOrEqual(1);
    expect(result.month).toBeLessThanOrEqual(12);
    expect(result.day).toBeGreaterThanOrEqual(1);
    expect(result.day).toBeLessThanOrEqual(31);
  });
});

describe("parseDateString", () => {
  describe("정상 케이스", () => {
    it("날짜 문자열을 연/월/일로 파싱", () => {
      const result = parseDateString("2025-02-04");

      expect(result).toEqual({ year: 2025, month: 2, day: 4 });
    });

    it("한 자리 월/일도 정상 파싱", () => {
      const result = parseDateString("2025-1-1");

      expect(result).toEqual({ year: 2025, month: 1, day: 1 });
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 오늘 날짜 반환", () => {
      const today = getTodayParts();
      const result = parseDateString("");

      expect(result).toEqual(today);
    });

    it("null이나 undefined가 아니면 빈 문자열로 처리", () => {
      // @ts-expect-error - 테스트를 위해 의도적으로 잘못된 타입 전달
      const result = parseDateString(null);

      expect(result).toHaveProperty("year");
      expect(result).toHaveProperty("month");
      expect(result).toHaveProperty("day");
    });
  });
});

describe("formatDateString", () => {
  describe("정상 케이스", () => {
    it("연/월/일을 YYYY-MM-DD 형식으로 변환", () => {
      const result = formatDateString(2025, 2, 4);

      expect(result).toBe("2025-02-04");
    });

    it("한 자리 월/일을 두 자리로 패딩", () => {
      const result = formatDateString(2025, 1, 1);

      expect(result).toBe("2025-01-01");
    });

    it("두 자리 월/일도 정상 처리", () => {
      const result = formatDateString(2025, 12, 31);

      expect(result).toBe("2025-12-31");
    });
  });

  describe("경계값 테스트", () => {
    it("월의 첫날 처리", () => {
      const result = formatDateString(2025, 1, 1);

      expect(result).toBe("2025-01-01");
    });

    it("월의 마지막날 처리", () => {
      const result = formatDateString(2025, 12, 31);

      expect(result).toBe("2025-12-31");
    });
  });
});

describe("getDaysInMonth", () => {
  describe("정상 케이스", () => {
    it("일반 월의 일수 반환", () => {
      expect(getDaysInMonth(2025, 1)).toBe(31); // 1월
      expect(getDaysInMonth(2025, 4)).toBe(30); // 4월
      expect(getDaysInMonth(2025, 6)).toBe(30); // 6월
    });

    it("2월의 일수 반환 (평년)", () => {
      expect(getDaysInMonth(2025, 2)).toBe(28); // 평년
    });

    it("2월의 일수 반환 (윤년)", () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // 윤년
      expect(getDaysInMonth(2000, 2)).toBe(29); // 윤년 (400의 배수)
    });
  });

  describe("경계값 테스트", () => {
    it("100의 배수이지만 400의 배수가 아닌 경우 평년", () => {
      expect(getDaysInMonth(1900, 2)).toBe(28); // 평년
    });

    it("400의 배수인 경우 윤년", () => {
      expect(getDaysInMonth(2000, 2)).toBe(29); // 윤년
    });
  });
});

describe("getDaysDifference", () => {
  describe("정상 케이스", () => {
    it("두 날짜 사이의 일수 계산", () => {
      const result = getDaysDifference("2025-01-01", "2025-01-02");

      expect(result).toBe(1);
    });

    it("같은 날짜는 0일", () => {
      const result = getDaysDifference("2025-01-01", "2025-01-01");

      expect(result).toBe(0);
    });

    it("과거 날짜는 음수", () => {
      const result = getDaysDifference("2025-01-02", "2025-01-01");

      expect(result).toBe(-1);
    });

    it("월을 넘어가는 일수 계산", () => {
      const result = getDaysDifference("2025-01-01", "2025-02-01");

      expect(result).toBe(31);
    });

    it("년을 넘어가는 일수 계산", () => {
      const result = getDaysDifference("2024-12-31", "2025-01-01");

      expect(result).toBe(1);
    });
  });

  describe("경계값 테스트", () => {
    it("윤년 2월 포함 일수 계산", () => {
      const result = getDaysDifference("2024-02-01", "2024-03-01");

      expect(result).toBe(29); // 윤년 2월은 29일
    });

    it("평년 2월 포함 일수 계산", () => {
      const result = getDaysDifference("2025-02-01", "2025-03-01");

      expect(result).toBe(28); // 평년 2월은 28일
    });
  });
});

describe("getWeeksDifference", () => {
  describe("정상 케이스", () => {
    it("두 날짜 사이의 주수 계산", () => {
      const result = getWeeksDifference("2025-01-01", "2025-01-08");

      expect(result).toBe(1);
    });

    it("7일 미만은 0주", () => {
      const result = getWeeksDifference("2025-01-01", "2025-01-05");

      expect(result).toBe(0);
    });

    it("14일은 2주", () => {
      const result = getWeeksDifference("2025-01-01", "2025-01-15");

      expect(result).toBe(2);
    });

    it("과거 날짜는 음수 주수", () => {
      const result = getWeeksDifference("2025-01-08", "2025-01-01");

      expect(result).toBe(-1);
    });
  });
});

describe("calculateEndDate", () => {
  describe("정상 케이스", () => {
    it("시작 날짜와 주수로 종료 날짜 계산", () => {
      const result = calculateEndDate("2025-01-01", 1);

      expect(result).toBe("2025-01-08");
    });

    it("여러 주 후 종료 날짜 계산", () => {
      const result = calculateEndDate("2025-01-01", 4);

      expect(result).toBe("2025-01-29");
    });

    it("0주는 같은 날짜", () => {
      const result = calculateEndDate("2025-01-01", 0);

      expect(result).toBe("2025-01-01");
    });
  });

  describe("경계값 테스트", () => {
    it("월을 넘어가는 종료 날짜 계산", () => {
      const result = calculateEndDate("2025-01-25", 2);

      expect(result).toBe("2025-02-08");
    });

    it("년을 넘어가는 종료 날짜 계산", () => {
      const result = calculateEndDate("2024-12-25", 2);

      expect(result).toBe("2025-01-08");
    });
  });
});

describe("formatDateFromDate", () => {
  describe("정상 케이스", () => {
    it("Date 객체를 YYYY-MM-DD 문자열로 변환", () => {
      const date = new Date(2025, 1, 4); // month는 0부터 시작
      const result = formatDateFromDate(date);

      expect(result).toBe("2025-02-04");
    });

    it("한 자리 월/일도 두 자리로 패딩", () => {
      const date = new Date(2025, 0, 1);
      const result = formatDateFromDate(date);

      expect(result).toBe("2025-01-01");
    });
  });
});

describe("addDaysToDate", () => {
  describe("정상 케이스", () => {
    it("날짜에 일수 더하기", () => {
      const result = addDaysToDate("2025-01-01", 1);

      expect(result).toBe("2025-01-02");
    });

    it("날짜에서 일수 빼기", () => {
      const result = addDaysToDate("2025-01-02", -1);

      expect(result).toBe("2025-01-01");
    });

    it("여러 일수 더하기", () => {
      const result = addDaysToDate("2025-01-01", 10);

      expect(result).toBe("2025-01-11");
    });

    it("0일 더하기는 같은 날짜", () => {
      const result = addDaysToDate("2025-01-01", 0);

      expect(result).toBe("2025-01-01");
    });
  });

  describe("경계값 테스트", () => {
    it("월을 넘어가는 날짜 계산", () => {
      const result = addDaysToDate("2025-01-31", 1);

      expect(result).toBe("2025-02-01");
    });

    it("년을 넘어가는 날짜 계산", () => {
      const result = addDaysToDate("2024-12-31", 1);

      expect(result).toBe("2025-01-01");
    });

    it("윤년 2월 처리", () => {
      const result = addDaysToDate("2024-02-28", 1);

      expect(result).toBe("2024-02-29");
    });

    it("평년 2월 처리", () => {
      const result = addDaysToDate("2025-02-28", 1);

      expect(result).toBe("2025-03-01");
    });
  });
});

describe("calculateDday", () => {
  describe("정상 케이스", () => {
    it("미래 날짜는 양수 D-day", () => {
      const futureDate = addDaysToDate(
        formatDateString(
          getTodayParts().year,
          getTodayParts().month,
          getTodayParts().day
        ),
        10
      );
      const result = calculateDday(futureDate);

      expect(result).toBeGreaterThan(0);
    });

    it("과거 날짜는 음수 D-day", () => {
      const pastDate = addDaysToDate(
        formatDateString(
          getTodayParts().year,
          getTodayParts().month,
          getTodayParts().day
        ),
        -10
      );
      const result = calculateDday(pastDate);

      expect(result).toBeLessThan(0);
    });

    it("오늘 날짜는 0 D-day", () => {
      const today = formatDateString(
        getTodayParts().year,
        getTodayParts().month,
        getTodayParts().day
      );
      const result = calculateDday(today);

      expect(result).toBe(0);
    });
  });
});

describe("isValidDateString", () => {
  describe("정상 케이스", () => {
    it("유효한 날짜 문자열은 true", () => {
      expect(isValidDateString("2025-01-01")).toBe(true);
      expect(isValidDateString("2025-12-31")).toBe(true);
      expect(isValidDateString("2024-02-29")).toBe(true); // 윤년
    });
  });

  describe("에러 케이스", () => {
    it("빈 문자열은 false", () => {
      expect(isValidDateString("")).toBe(false);
    });

    it("잘못된 형식은 false", () => {
      expect(isValidDateString("2025/01/01")).toBe(false);
      expect(isValidDateString("2025-1-1")).toBe(false);
      expect(isValidDateString("25-01-01")).toBe(false);
    });

    it("존재하지 않는 날짜는 false", () => {
      expect(isValidDateString("2025-13-01")).toBe(false);
      expect(isValidDateString("2025-02-30")).toBe(false);
      expect(isValidDateString("2025-04-31")).toBe(false);
    });

    it("윤년이 아닌데 2월 29일은 false", () => {
      expect(isValidDateString("2025-02-29")).toBe(false);
    });

    it("윤년인데 2월 29일은 true", () => {
      expect(isValidDateString("2024-02-29")).toBe(true);
    });
  });

  describe("엣지 케이스", () => {
    it("null이나 undefined는 false", () => {
      // @ts-expect-error - 테스트를 위해 의도적으로 잘못된 타입 전달
      expect(isValidDateString(null)).toBe(false);
      // @ts-expect-error - 테스트를 위해 의도적으로 잘못된 타입 전달
      expect(isValidDateString(undefined)).toBe(false);
    });
  });
});

describe("isValidDateRange", () => {
  describe("정상 케이스", () => {
    it("시작일이 종료일보다 이전이면 true", () => {
      expect(isValidDateRange("2025-01-01", "2025-01-02")).toBe(true);
    });

    it("시작일과 종료일이 같으면 true", () => {
      expect(isValidDateRange("2025-01-01", "2025-01-01")).toBe(true);
    });
  });

  describe("에러 케이스", () => {
    it("시작일이 종료일보다 이후이면 false", () => {
      expect(isValidDateRange("2025-01-02", "2025-01-01")).toBe(false);
    });

    it("시작일이 유효하지 않으면 false", () => {
      expect(isValidDateRange("2025-13-01", "2025-01-02")).toBe(false);
    });

    it("종료일이 유효하지 않으면 false", () => {
      expect(isValidDateRange("2025-01-01", "2025-13-01")).toBe(false);
    });
  });
});

describe("isFutureDate", () => {
  describe("정상 케이스", () => {
    it("미래 날짜는 true", () => {
      const futureDate = addDaysToDate(
        formatDateString(
          getTodayParts().year,
          getTodayParts().month,
          getTodayParts().day
        ),
        10
      );
      expect(isFutureDate(futureDate)).toBe(true);
    });

    it("오늘 날짜는 true (>= today)", () => {
      const today = formatDateString(
        getTodayParts().year,
        getTodayParts().month,
        getTodayParts().day
      );
      expect(isFutureDate(today)).toBe(true);
    });

    it("과거 날짜는 false", () => {
      const pastDate = addDaysToDate(
        formatDateString(
          getTodayParts().year,
          getTodayParts().month,
          getTodayParts().day
        ),
        -10
      );
      expect(isFutureDate(pastDate)).toBe(false);
    });
  });

  describe("에러 케이스", () => {
    it("유효하지 않은 날짜는 false", () => {
      expect(isFutureDate("2025-13-01")).toBe(false);
    });
  });
});

describe("getDayOfWeekName", () => {
  describe("정상 케이스", () => {
    it("요일 번호를 한글 요일로 변환", () => {
      expect(getDayOfWeekName(0)).toBe("일");
      expect(getDayOfWeekName(1)).toBe("월");
      expect(getDayOfWeekName(2)).toBe("화");
      expect(getDayOfWeekName(3)).toBe("수");
      expect(getDayOfWeekName(4)).toBe("목");
      expect(getDayOfWeekName(5)).toBe("금");
      expect(getDayOfWeekName(6)).toBe("토");
    });
  });

  describe("경계값 테스트", () => {
    it("범위를 벗어난 번호는 빈 문자열", () => {
      expect(getDayOfWeekName(-1)).toBe("");
      expect(getDayOfWeekName(7)).toBe("");
      expect(getDayOfWeekName(100)).toBe("");
    });
  });
});

describe("getDayOfWeek", () => {
  describe("정상 케이스", () => {
    it("날짜에서 요일 번호 추출", () => {
      // 2025-02-04는 화요일 (2)
      const result = getDayOfWeek("2025-02-04");

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(6);
    });

    it("일요일은 0", () => {
      // 2025-02-02는 일요일
      const result = getDayOfWeek("2025-02-02");

      expect(result).toBe(0);
    });
  });
});

describe("generateDateRange", () => {
  describe("정상 케이스", () => {
    it("시작일부터 종료일까지 모든 날짜 생성", () => {
      const result = generateDateRange("2025-01-01", "2025-01-03");

      expect(result).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    });

    it("같은 날짜는 하나만 반환", () => {
      const result = generateDateRange("2025-01-01", "2025-01-01");

      expect(result).toEqual(["2025-01-01"]);
    });

    it("단일 날짜 범위", () => {
      const result = generateDateRange("2025-01-01", "2025-01-02");

      expect(result).toEqual(["2025-01-01", "2025-01-02"]);
    });
  });

  describe("경계값 테스트", () => {
    it("월을 넘어가는 날짜 범위 생성", () => {
      const result = generateDateRange("2025-01-30", "2025-02-02");

      expect(result).toEqual([
        "2025-01-30",
        "2025-01-31",
        "2025-02-01",
        "2025-02-02",
      ]);
    });

    it("년을 넘어가는 날짜 범위 생성", () => {
      const result = generateDateRange("2024-12-30", "2025-01-02");

      expect(result).toEqual([
        "2024-12-30",
        "2024-12-31",
        "2025-01-01",
        "2025-01-02",
      ]);
    });

    it("윤년 2월 포함 날짜 범위 생성", () => {
      const result = generateDateRange("2024-02-28", "2024-03-01");

      expect(result).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);
    });

    it("평년 2월 포함 날짜 범위 생성", () => {
      const result = generateDateRange("2025-02-28", "2025-03-01");

      expect(result).toEqual(["2025-02-28", "2025-03-01"]);
    });
  });
});

