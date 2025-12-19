/**
 * formDataHelpers 유틸리티 함수 단위 테스트
 */

import { describe, it, expect } from "vitest";
import {
  getFormString,
  getFormInt,
  getFormFloat,
  getFormUuid,
  getFormBoolean,
  getFormDate,
  getFormArray,
  getFormTags,
  getNumberFromFormData,
} from "@/lib/utils/formDataHelpers";

describe("getFormString", () => {
  describe("정상 케이스", () => {
    it("문자열 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("name", "홍길동");

      const result = getFormString(formData, "name");

      expect(result).toBe("홍길동");
    });

    it("공백이 포함된 문자열을 trim하여 반환", () => {
      const formData = new FormData();
      formData.append("name", "  홍길동  ");

      const result = getFormString(formData, "name");

      expect(result).toBe("홍길동");
    });

    it("기본값을 지정하면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormString(formData, "name", "기본값");

      expect(result).toBe("기본값");
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("name", "");

      const result = getFormString(formData, "name", "기본값");

      expect(result).toBe("기본값");
    });

    it("공백만 있으면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("name", "   ");

      const result = getFormString(formData, "name", "기본값");

      expect(result).toBe("기본값");
    });

    it("키가 없으면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormString(formData, "nonexistent", "기본값");

      expect(result).toBe("기본값");
    });

    it("기본값이 null이면 null 반환", () => {
      const formData = new FormData();

      const result = getFormString(formData, "name", null);

      expect(result).toBeNull();
    });
  });

  describe("엣지 케이스", () => {
    it("특수 문자가 포함된 문자열 처리", () => {
      const formData = new FormData();
      formData.append("text", "Hello!@#$%^&*()");

      const result = getFormString(formData, "text");

      expect(result).toBe("Hello!@#$%^&*()");
    });

    it("줄바꿈 문자가 포함된 문자열 처리", () => {
      const formData = new FormData();
      formData.append("text", "  line1\nline2  ");

      const result = getFormString(formData, "text");

      expect(result).toBe("line1\nline2");
    });
  });
});

describe("getFormInt", () => {
  describe("정상 케이스", () => {
    it("정수 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("age", "25");

      const result = getFormInt(formData, "age");

      expect(result).toBe(25);
    });

    it("음수 값 추출", () => {
      const formData = new FormData();
      formData.append("value", "-10");

      const result = getFormInt(formData, "value");

      expect(result).toBe(-10);
    });

    it("0 값 추출", () => {
      const formData = new FormData();
      formData.append("count", "0");

      const result = getFormInt(formData, "count");

      expect(result).toBe(0);
    });

    it("기본값을 지정하면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormInt(formData, "age", 0);

      expect(result).toBe(0);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("age", "");

      const result = getFormInt(formData, "age", 0);

      expect(result).toBe(0);
    });

    it("공백만 있으면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("age", "   ");

      const result = getFormInt(formData, "age", 0);

      expect(result).toBe(0);
    });

    it("키가 없으면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormInt(formData, "age", 0);

      expect(result).toBe(0);
    });
  });

  describe("에러 케이스", () => {
    it("숫자가 아닌 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("age", "abc");

      const result = getFormInt(formData, "age", 0);

      expect(result).toBe(0);
    });

    it("부동소수점 문자열이면 정수 부분만 추출", () => {
      const formData = new FormData();
      formData.append("value", "3.14");

      const result = getFormInt(formData, "value");

      expect(result).toBe(3);
    });
  });

  describe("엣지 케이스", () => {
    it("공백이 포함된 숫자 문자열 처리", () => {
      const formData = new FormData();
      formData.append("age", "  25  ");

      const result = getFormInt(formData, "age");

      expect(result).toBe(25);
    });

    it("큰 정수 값 처리", () => {
      const formData = new FormData();
      formData.append("value", "2147483647");

      const result = getFormInt(formData, "value");

      expect(result).toBe(2147483647);
    });
  });
});

describe("getFormFloat", () => {
  describe("정상 케이스", () => {
    it("부동소수점 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("price", "3.14");

      const result = getFormFloat(formData, "price");

      expect(result).toBe(3.14);
    });

    it("정수 값을 부동소수점으로 추출", () => {
      const formData = new FormData();
      formData.append("value", "10");

      const result = getFormFloat(formData, "value");

      expect(result).toBe(10);
    });

    it("음수 부동소수점 값 추출", () => {
      const formData = new FormData();
      formData.append("value", "-3.14");

      const result = getFormFloat(formData, "value");

      expect(result).toBe(-3.14);
    });

    it("기본값을 지정하면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormFloat(formData, "price", 0.0);

      expect(result).toBe(0.0);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("price", "");

      const result = getFormFloat(formData, "price", 0.0);

      expect(result).toBe(0.0);
    });

    it("공백만 있으면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("price", "   ");

      const result = getFormFloat(formData, "price", 0.0);

      expect(result).toBe(0.0);
    });
  });

  describe("에러 케이스", () => {
    it("숫자가 아닌 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("price", "abc");

      const result = getFormFloat(formData, "price", 0.0);

      expect(result).toBe(0.0);
    });
  });

  describe("엣지 케이스", () => {
    it("공백이 포함된 부동소수점 문자열 처리", () => {
      const formData = new FormData();
      formData.append("price", "  3.14  ");

      const result = getFormFloat(formData, "price");

      expect(result).toBe(3.14);
    });

    it("과학적 표기법 처리", () => {
      const formData = new FormData();
      formData.append("value", "1e10");

      const result = getFormFloat(formData, "value");

      expect(result).toBe(10000000000);
    });
  });
});

describe("getFormUuid", () => {
  describe("정상 케이스", () => {
    it("UUID 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("id", "550e8400-e29b-41d4-a716-446655440000");

      const result = getFormUuid(formData, "id");

      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("공백이 포함된 UUID를 trim하여 반환", () => {
      const formData = new FormData();
      formData.append("id", "  550e8400-e29b-41d4-a716-446655440000  ");

      const result = getFormUuid(formData, "id");

      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("기본값을 지정하면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormUuid(formData, "id", "default-id");

      expect(result).toBe("default-id");
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("id", "");

      const result = getFormUuid(formData, "id", "default-id");

      expect(result).toBe("default-id");
    });

    it("공백만 있으면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("id", "   ");

      const result = getFormUuid(formData, "id", "default-id");

      expect(result).toBe("default-id");
    });

    it("키가 없으면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormUuid(formData, "id", "default-id");

      expect(result).toBe("default-id");
    });
  });
});

describe("getFormBoolean", () => {
  describe("정상 케이스", () => {
    it("'true' 문자열을 true로 변환", () => {
      const formData = new FormData();
      formData.append("enabled", "true");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(true);
    });

    it("'false' 문자열을 false로 변환", () => {
      const formData = new FormData();
      formData.append("enabled", "false");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(false);
    });

    it("'1' 문자열을 true로 변환", () => {
      const formData = new FormData();
      formData.append("enabled", "1");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(true);
    });

    it("'yes' 문자열을 true로 변환", () => {
      const formData = new FormData();
      formData.append("enabled", "yes");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(true);
    });

    it("'on' 문자열을 true로 변환", () => {
      const formData = new FormData();
      formData.append("enabled", "on");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(true);
    });

    it("대소문자 구분 없이 처리", () => {
      const formData = new FormData();
      formData.append("enabled", "TRUE");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(true);
    });

    it("기본값을 지정하면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormBoolean(formData, "enabled", false);

      expect(result).toBe(false);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("enabled", "");

      const result = getFormBoolean(formData, "enabled", false);

      expect(result).toBe(false);
    });

    it("공백만 있으면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("enabled", "   ");

      const result = getFormBoolean(formData, "enabled", false);

      expect(result).toBe(false);
    });

    it("키가 없으면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormBoolean(formData, "enabled", false);

      expect(result).toBe(false);
    });
  });

  describe("엣지 케이스", () => {
    it("'0' 문자열은 false로 변환되지 않음 (기본값 반환)", () => {
      const formData = new FormData();
      formData.append("enabled", "0");

      const result = getFormBoolean(formData, "enabled", false);

      expect(result).toBe(false);
    });

    it("'no' 문자열은 false로 변환되지 않음 (기본값 반환)", () => {
      const formData = new FormData();
      formData.append("enabled", "no");

      const result = getFormBoolean(formData, "enabled", false);

      expect(result).toBe(false);
    });

    it("공백이 포함된 'true' 문자열 처리", () => {
      const formData = new FormData();
      formData.append("enabled", "  true  ");

      const result = getFormBoolean(formData, "enabled");

      expect(result).toBe(true);
    });
  });
});

describe("getFormDate", () => {
  describe("정상 케이스", () => {
    it("날짜 문자열을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("date", "2025-02-04");

      const result = getFormDate(formData, "date");

      expect(result).toBe("2025-02-04");
    });

    it("공백이 포함된 날짜 문자열을 trim하여 반환", () => {
      const formData = new FormData();
      formData.append("date", "  2025-02-04  ");

      const result = getFormDate(formData, "date");

      expect(result).toBe("2025-02-04");
    });

    it("기본값을 지정하면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormDate(formData, "date", "2025-01-01");

      expect(result).toBe("2025-01-01");
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("date", "");

      const result = getFormDate(formData, "date", "2025-01-01");

      expect(result).toBe("2025-01-01");
    });

    it("공백만 있으면 기본값 반환", () => {
      const formData = new FormData();
      formData.append("date", "   ");

      const result = getFormDate(formData, "date", "2025-01-01");

      expect(result).toBe("2025-01-01");
    });

    it("키가 없으면 기본값 반환", () => {
      const formData = new FormData();

      const result = getFormDate(formData, "date", "2025-01-01");

      expect(result).toBe("2025-01-01");
    });
  });
});

describe("getFormArray", () => {
  describe("정상 케이스", () => {
    it("단일 값을 배열로 반환", () => {
      const formData = new FormData();
      formData.append("tags", "tag1");

      const result = getFormArray(formData, "tags");

      expect(result).toEqual(["tag1"]);
    });

    it("여러 값을 배열로 반환", () => {
      const formData = new FormData();
      formData.append("tags", "tag1");
      formData.append("tags", "tag2");
      formData.append("tags", "tag3");

      const result = getFormArray(formData, "tags");

      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("공백이 포함된 값을 trim하여 반환", () => {
      const formData = new FormData();
      formData.append("tags", "  tag1  ");
      formData.append("tags", "  tag2  ");

      const result = getFormArray(formData, "tags");

      expect(result).toEqual(["tag1", "tag2"]);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 배열 반환 (키가 없는 경우)", () => {
      const formData = new FormData();

      const result = getFormArray(formData, "tags");

      expect(result).toEqual([]);
    });

    it("빈 문자열 값은 필터링됨", () => {
      const formData = new FormData();
      formData.append("tags", "tag1");
      formData.append("tags", "");
      formData.append("tags", "tag2");

      const result = getFormArray(formData, "tags");

      expect(result).toEqual(["tag1", "tag2"]);
    });

    it("공백만 있는 값은 trim 후 빈 문자열로 포함됨", () => {
      const formData = new FormData();
      formData.append("tags", "tag1");
      formData.append("tags", "   ");
      formData.append("tags", "tag2");

      const result = getFormArray(formData, "tags");

      // filter(Boolean)은 falsy만 필터링하므로 공백 문자열은 trim 후 빈 문자열로 포함됨
      expect(result).toEqual(["tag1", "", "tag2"]);
    });
  });
});

describe("getFormTags", () => {
  describe("정상 케이스", () => {
    it("쉼표로 구분된 태그를 배열로 파싱", () => {
      const formData = new FormData();
      formData.append("tags", "tag1,tag2,tag3");

      const result = getFormTags(formData, "tags");

      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("공백이 포함된 태그를 trim하여 반환", () => {
      const formData = new FormData();
      formData.append("tags", "tag1, tag2 , tag3");

      const result = getFormTags(formData, "tags");

      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("빈 태그는 필터링됨", () => {
      const formData = new FormData();
      formData.append("tags", "tag1,,tag2, ,tag3");

      const result = getFormTags(formData, "tags");

      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 null 반환", () => {
      const formData = new FormData();
      formData.append("tags", "");

      const result = getFormTags(formData, "tags");

      expect(result).toBeNull();
    });

    it("공백만 있으면 null 반환", () => {
      const formData = new FormData();
      formData.append("tags", "   ");

      const result = getFormTags(formData, "tags");

      expect(result).toBeNull();
    });

    it("키가 없으면 null 반환", () => {
      const formData = new FormData();

      const result = getFormTags(formData, "tags");

      expect(result).toBeNull();
    });
  });

  describe("엣지 케이스", () => {
    it("단일 태그 처리", () => {
      const formData = new FormData();
      formData.append("tags", "tag1");

      const result = getFormTags(formData, "tags");

      expect(result).toEqual(["tag1"]);
    });

    it("쉼표만 있는 경우 빈 배열 반환", () => {
      const formData = new FormData();
      formData.append("tags", ",");

      const result = getFormTags(formData, "tags");

      // 쉼표만 있으면 split 후 filter(Boolean)로 빈 배열 반환
      expect(result).toEqual([]);
    });
  });
});

describe("getNumberFromFormData", () => {
  describe("정상 케이스", () => {
    it("숫자 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("age", "25");

      const result = getNumberFromFormData(formData, "age");

      expect(result).toBe(25);
    });

    it("부동소수점 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("price", "3.14");

      const result = getNumberFromFormData(formData, "price");

      expect(result).toBe(3.14);
    });

    it("음수 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("value", "-10");

      const result = getNumberFromFormData(formData, "value");

      expect(result).toBe(-10);
    });

    it("0 값을 정상적으로 추출", () => {
      const formData = new FormData();
      formData.append("count", "0");

      const result = getNumberFromFormData(formData, "count");

      expect(result).toBe(0);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 문자열이면 null 반환", () => {
      const formData = new FormData();
      formData.append("age", "");

      const result = getNumberFromFormData(formData, "age");

      expect(result).toBeNull();
    });

    it("공백만 있으면 null 반환", () => {
      const formData = new FormData();
      formData.append("age", "   ");

      const result = getNumberFromFormData(formData, "age");

      expect(result).toBeNull();
    });

    it("키가 없으면 null 반환", () => {
      const formData = new FormData();

      const result = getNumberFromFormData(formData, "age");

      expect(result).toBeNull();
    });
  });

  describe("에러 케이스", () => {
    it("숫자가 아닌 문자열이면 null 반환", () => {
      const formData = new FormData();
      formData.append("age", "abc");

      const result = getNumberFromFormData(formData, "age");

      expect(result).toBeNull();
    });

    it("필수 필드가 비어있으면 에러 throw", () => {
      const formData = new FormData();
      formData.append("age", "");

      expect(() => {
        getNumberFromFormData(formData, "age", { required: true });
      }).toThrow("age는 필수입니다.");
    });

    it("필수 필드가 없으면 에러 throw", () => {
      const formData = new FormData();

      expect(() => {
        getNumberFromFormData(formData, "age", { required: true });
      }).toThrow("age는 필수입니다.");
    });

    it("필수 필드가 숫자가 아니면 에러 throw", () => {
      const formData = new FormData();
      formData.append("age", "abc");

      expect(() => {
        getNumberFromFormData(formData, "age", { required: true });
      }).toThrow("age는 숫자여야 합니다.");
    });

    it("min 범위를 벗어나면 에러 throw", () => {
      const formData = new FormData();
      formData.append("age", "5");

      expect(() => {
        getNumberFromFormData(formData, "age", { min: 10 });
      }).toThrow("age는 10 이상이어야 합니다.");
    });

    it("max 범위를 벗어나면 에러 throw", () => {
      const formData = new FormData();
      formData.append("age", "100");

      expect(() => {
        getNumberFromFormData(formData, "age", { max: 99 });
      }).toThrow("age는 99 이하여야 합니다.");
    });

    it("min과 max 범위 내 값은 정상 처리", () => {
      const formData = new FormData();
      formData.append("age", "25");

      const result = getNumberFromFormData(formData, "age", {
        min: 10,
        max: 100,
      });

      expect(result).toBe(25);
    });

    it("min 경계값은 정상 처리", () => {
      const formData = new FormData();
      formData.append("age", "10");

      const result = getNumberFromFormData(formData, "age", { min: 10 });

      expect(result).toBe(10);
    });

    it("max 경계값은 정상 처리", () => {
      const formData = new FormData();
      formData.append("age", "100");

      const result = getNumberFromFormData(formData, "age", { max: 100 });

      expect(result).toBe(100);
    });
  });

  describe("엣지 케이스", () => {
    it("공백이 포함된 숫자 문자열 처리", () => {
      const formData = new FormData();
      formData.append("age", "  25  ");

      const result = getNumberFromFormData(formData, "age");

      expect(result).toBe(25);
    });

    it("과학적 표기법 처리", () => {
      const formData = new FormData();
      formData.append("value", "1e10");

      const result = getNumberFromFormData(formData, "value");

      expect(result).toBe(10000000000);
    });

    it("모든 옵션을 함께 사용", () => {
      const formData = new FormData();
      formData.append("age", "25");

      const result = getNumberFromFormData(formData, "age", {
        required: true,
        min: 10,
        max: 100,
      });

      expect(result).toBe(25);
    });
  });
});

