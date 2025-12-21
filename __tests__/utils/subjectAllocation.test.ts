/**
 * subjectAllocation 유틸리티 함수 단위 테스트
 */

import { describe, it, expect } from "vitest";
import {
  getEffectiveAllocation,
  validateAllocations,
  type ContentInfo,
  type ContentAllocation,
  type SubjectAllocation,
} from "@/lib/utils/subjectAllocation";

describe("getEffectiveAllocation", () => {
  describe("콘텐츠별 설정 우선순위 테스트", () => {
    it("콘텐츠별 설정이 있으면 콘텐츠별 설정을 반환", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
        subject: "수학",
      };

      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 3,
        },
      ];

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "weakness",
        },
      ];

      const result = getEffectiveAllocation(
        content,
        contentAllocations,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(3);
      expect(result.source).toBe("content");
    });

    it("콘텐츠별 설정이 없으면 교과별 설정을 사용", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
        subject: "수학",
      };

      const contentAllocations: ContentAllocation[] = [];

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        contentAllocations,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(2);
      expect(result.source).toBe("subject");
    });

    it("콘텐츠별 설정과 교과별 설정이 모두 없으면 기본값(취약과목) 반환", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
        subject: "수학",
      };

      const result = getEffectiveAllocation(
        content,
        undefined,
        undefined,
        false
      );

      expect(result.subject_type).toBe("weakness");
      expect(result.weekly_days).toBeUndefined();
      expect(result.source).toBe("default");
    });
  });

  describe("교과별 설정 폴백 테스트", () => {
    it("subject_id로 매칭 (가장 정확)", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_id: "subject-1",
        subject_category: "수학",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_id: "subject-1",
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 3,
        },
        {
          subject_id: "subject-2",
          subject_name: "수학",
          subject_type: "weakness",
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(3);
      expect(result.source).toBe("subject");
    });

    it("subject_name과 subject_category 정확 일치", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(2);
      expect(result.source).toBe("subject");
    });

    it("subject_name에 subject_category가 포함되는지 확인 (부분 매칭)", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학 I",
          subject_type: "strategy",
          weekly_days: 3,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(3);
      expect(result.source).toBe("subject");
    });

    it("subject 필드는 매칭 조건에서 제외 (교과별 설정은 교과만 기준)", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject: "미적분", // 과목 필드
        // subject_category가 없으면 매칭 실패해야 함
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학", // 교과명
          subject_type: "strategy",
          weekly_days: 4,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      // subject 필드만 있고 subject_category가 없으면 매칭 실패
      // 기본값(취약과목) 반환
      expect(result.subject_type).toBe("weakness");
      expect(result.weekly_days).toBeUndefined();
      expect(result.source).toBe("default");
    });
  });

  describe("매칭 로직 정확도 테스트", () => {
    it("대소문자 무시 매칭", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.source).toBe("subject");
    });

    it("공백 정규화 매칭", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학  ",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.source).toBe("subject");
    });

    it("부분 매칭 (subject_name에 subject_category 포함)", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학 I",
          subject_type: "strategy",
          weekly_days: 3,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(3);
      expect(result.source).toBe("subject");
    });
  });

  describe("기본값 적용 테스트", () => {
    it("모든 설정이 없으면 기본값(취약과목) 반환", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
      };

      const result = getEffectiveAllocation(
        content,
        undefined,
        undefined,
        false
      );

      expect(result.subject_type).toBe("weakness");
      expect(result.weekly_days).toBeUndefined();
      expect(result.source).toBe("default");
    });

    it("매칭되지 않는 교과는 기본값(취약과목) 반환", () => {
      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "영어",
      };

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const result = getEffectiveAllocation(
        content,
        undefined,
        subjectAllocations,
        false
      );

      expect(result.subject_type).toBe("weakness");
      expect(result.weekly_days).toBeUndefined();
      expect(result.source).toBe("default");
    });
  });
});

describe("validateAllocations", () => {
  describe("정상 케이스", () => {
    it("유효한 content_allocations 검증 통과", () => {
      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 3,
        },
        {
          content_type: "lecture",
          content_id: "lecture-1",
          subject_type: "weakness",
        },
      ];

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("유효한 subject_allocations 검증 통과", () => {
      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
        {
          subject_name: "영어",
          subject_type: "weakness",
        },
      ];

      const result = validateAllocations(undefined, subjectAllocations);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("유효한 두 할당 모두 검증 통과", () => {
      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 3,
        },
      ];

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const result = validateAllocations(
        contentAllocations,
        subjectAllocations
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("에러 케이스", () => {
    it("content_type이 없으면 검증 실패", () => {
      const contentAllocations = [
        {
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 3,
        },
      ] as any;

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("content_type");
    });

    it("content_id가 없으면 검증 실패", () => {
      const contentAllocations = [
        {
          content_type: "book",
          subject_type: "strategy",
          weekly_days: 3,
        },
      ] as any;

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("content_id");
    });

    it("잘못된 subject_type이면 검증 실패", () => {
      const contentAllocations = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "invalid",
          weekly_days: 3,
        },
      ] as any;

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("subject_type");
    });

    it("전략과목에 weekly_days가 2, 3, 4가 아니면 검증 실패", () => {
      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 5, // 잘못된 값
        },
      ];

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("weekly_days");
    });

    it("subject_name이 없으면 검증 실패", () => {
      const subjectAllocations = [
        {
          subject_type: "strategy",
          weekly_days: 2,
        },
      ] as any;

      const result = validateAllocations(undefined, subjectAllocations);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("subject_name");
    });
  });

  describe("경계값 테스트", () => {
    it("weekly_days가 2, 3, 4인 경우 검증 통과", () => {
      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 2,
        },
        {
          content_type: "book",
          content_id: "book-2",
          subject_type: "strategy",
          weekly_days: 3,
        },
        {
          content_type: "book",
          content_id: "book-3",
          subject_type: "strategy",
          weekly_days: 4,
        },
      ];

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("취약과목은 weekly_days가 없어도 검증 통과", () => {
      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "weakness",
        },
      ];

      const result = validateAllocations(contentAllocations, undefined);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("빈 배열도 검증 통과", () => {
      const result = validateAllocations([], []);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

