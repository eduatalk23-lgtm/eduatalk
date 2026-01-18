/**
 * 배치 대상 목록 테스트
 */

import { describe, it, expect } from "vitest";
import {
  CORE_TARGETS,
  MATH_TARGETS,
  ENGLISH_TARGETS,
  SCIENCE_TARGETS,
  ALL_TARGETS,
  getTargetsForPreset,
  targetToString,
} from "../targets";
import type { BatchTarget } from "../types";

describe("배치 대상 목록", () => {
  describe("CORE_TARGETS", () => {
    it("핵심 교과 목록이 정의되어 있어야 함", () => {
      expect(CORE_TARGETS).toBeDefined();
      expect(CORE_TARGETS.length).toBeGreaterThan(0);
    });

    it("각 항목에 subjectCategory가 있어야 함", () => {
      CORE_TARGETS.forEach((target) => {
        expect(target.subjectCategory).toBeDefined();
        expect(target.subjectCategory.length).toBeGreaterThan(0);
      });
    });

    it("핵심 교과가 모두 포함되어야 함", () => {
      const categories = [...new Set(CORE_TARGETS.map((t) => t.subjectCategory))];
      expect(categories).toContain("국어");
      expect(categories).toContain("수학");
      expect(categories).toContain("영어");
      expect(categories).toContain("한국사");
    });

    it("book과 lecture 타입이 모두 포함되어야 함", () => {
      const contentTypes = [...new Set(CORE_TARGETS.map((t) => t.contentType))];
      expect(contentTypes).toContain("book");
      expect(contentTypes).toContain("lecture");
    });

    it("중복 항목이 없어야 함", () => {
      const serialized = CORE_TARGETS.map((t) => JSON.stringify(t));
      const unique = [...new Set(serialized)];
      expect(unique.length).toBe(CORE_TARGETS.length);
    });
  });

  describe("MATH_TARGETS", () => {
    it("수학 과목만 포함해야 함", () => {
      MATH_TARGETS.forEach((target) => {
        expect(target.subjectCategory).toBe("수학");
      });
    });

    it("주요 수학 과목이 포함되어야 함", () => {
      const subjects = MATH_TARGETS.map((t) => t.subject);
      expect(subjects).toContain("수학I");
      expect(subjects).toContain("수학II");
      expect(subjects).toContain("미적분");
      expect(subjects).toContain("확률과 통계");
      expect(subjects).toContain("기하");
    });

    it("난이도가 포함된 항목이 있어야 함", () => {
      const withDifficulty = MATH_TARGETS.filter((t) => t.difficulty);
      expect(withDifficulty.length).toBeGreaterThan(0);
    });
  });

  describe("ENGLISH_TARGETS", () => {
    it("영어 과목만 포함해야 함", () => {
      ENGLISH_TARGETS.forEach((target) => {
        expect(target.subjectCategory).toBe("영어");
      });
    });

    it("영어 과목이 포함되어야 함", () => {
      const subjects = ENGLISH_TARGETS.map((t) => t.subject);
      expect(subjects).toContain("영어");
      expect(subjects).toContain("영어I");
    });
  });

  describe("SCIENCE_TARGETS", () => {
    it("과학 과목만 포함해야 함", () => {
      SCIENCE_TARGETS.forEach((target) => {
        expect(target.subjectCategory).toBe("과학");
      });
    });

    it("주요 과학 과목이 포함되어야 함", () => {
      const subjects = SCIENCE_TARGETS.map((t) => t.subject);
      expect(subjects).toContain("물리학I");
      expect(subjects).toContain("화학I");
      expect(subjects).toContain("생명과학I");
      expect(subjects).toContain("지구과학I");
    });
  });

  describe("ALL_TARGETS", () => {
    it("CORE_TARGETS보다 많은 항목이 있어야 함", () => {
      expect(ALL_TARGETS.length).toBeGreaterThan(CORE_TARGETS.length);
    });

    it("모든 교과가 포함되어야 함", () => {
      const categories = [...new Set(ALL_TARGETS.map((t) => t.subjectCategory))];
      expect(categories).toContain("국어");
      expect(categories).toContain("수학");
      expect(categories).toContain("영어");
      expect(categories).toContain("한국사");
      expect(categories).toContain("사회");
      expect(categories).toContain("과학");
    });
  });
});

describe("getTargetsForPreset", () => {
  it("core 프리셋은 CORE_TARGETS를 반환해야 함", () => {
    const targets = getTargetsForPreset("core");
    expect(targets).toEqual(CORE_TARGETS);
  });

  it("math 프리셋은 MATH_TARGETS를 반환해야 함", () => {
    const targets = getTargetsForPreset("math");
    expect(targets).toEqual(MATH_TARGETS);
  });

  it("english 프리셋은 ENGLISH_TARGETS를 반환해야 함", () => {
    const targets = getTargetsForPreset("english");
    expect(targets).toEqual(ENGLISH_TARGETS);
  });

  it("science 프리셋은 SCIENCE_TARGETS를 반환해야 함", () => {
    const targets = getTargetsForPreset("science");
    expect(targets).toEqual(SCIENCE_TARGETS);
  });

  it("all 프리셋은 ALL_TARGETS를 반환해야 함", () => {
    const targets = getTargetsForPreset("all");
    expect(targets).toEqual(ALL_TARGETS);
  });

  it("custom 프리셋은 빈 배열을 반환해야 함", () => {
    const targets = getTargetsForPreset("custom");
    expect(targets).toEqual([]);
  });

  it("알 수 없는 프리셋은 CORE_TARGETS를 반환해야 함", () => {
    // @ts-expect-error - 테스트를 위해 잘못된 프리셋 전달
    const targets = getTargetsForPreset("unknown");
    expect(targets).toEqual(CORE_TARGETS);
  });
});

describe("targetToString", () => {
  it("교과만 있는 경우", () => {
    const target: BatchTarget = { subjectCategory: "수학" };
    expect(targetToString(target)).toBe("수학");
  });

  it("교과 + 과목", () => {
    const target: BatchTarget = {
      subjectCategory: "수학",
      subject: "미적분",
    };
    expect(targetToString(target)).toBe("수학 > 미적분");
  });

  it("교과 + 과목 + 난이도", () => {
    const target: BatchTarget = {
      subjectCategory: "수학",
      subject: "미적분",
      difficulty: "개념",
    };
    expect(targetToString(target)).toBe("수학 > 미적분 > (개념)");
  });

  it("교과 + 과목 + 콘텐츠타입", () => {
    const target: BatchTarget = {
      subjectCategory: "수학",
      subject: "미적분",
      contentType: "book",
    };
    expect(targetToString(target)).toBe("수학 > 미적분 > [book]");
  });

  it("전체 조합", () => {
    const target: BatchTarget = {
      subjectCategory: "수학",
      subject: "미적분",
      difficulty: "기본",
      contentType: "lecture",
    };
    expect(targetToString(target)).toBe("수학 > 미적분 > (기본) > [lecture]");
  });
});
