/**
 * 콘텐츠 자동 매칭 함수 테스트
 *
 * autoMatchSlotsToContents 함수의 매칭 로직을 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import {
  autoMatchSlotsToContents,
  calculateMatchScore,
  type ContentSlot,
  type MatchableContent,
} from "@/lib/types/content-selection";

describe("autoMatchSlotsToContents", () => {
  // 테스트용 콘텐츠 데이터
  const mockContents = {
    books: [
      {
        id: "book-math-1",
        title: "수학의 정석",
        content_type: "book" as const,
        subject_category: "수학",
        subject: "수학1",
        total_pages: 300,
        master_content_id: "master-book-1",
      },
      {
        id: "book-korean-1",
        title: "국어 문법",
        content_type: "book" as const,
        subject_category: "국어",
        subject: "국어",
        total_pages: 200,
        master_content_id: "master-book-2",
      },
      {
        id: "book-english-1",
        title: "영어 독해",
        content_type: "book" as const,
        subject_category: "영어",
        subject: "영어",
        total_pages: 250,
        master_content_id: "master-book-3",
      },
    ],
    lectures: [
      {
        id: "lecture-math-1",
        title: "수학 강의",
        content_type: "lecture" as const,
        subject_category: "수학",
        subject: "수학2",
        total_episodes: 20,
        master_content_id: "master-lecture-1",
      },
      {
        id: "lecture-science-1",
        title: "과학 강의",
        content_type: "lecture" as const,
        subject_category: "과학",
        subject: "물리",
        total_episodes: 15,
        master_content_id: "master-lecture-2",
      },
    ],
    custom: [
      {
        id: "custom-1",
        title: "커스텀 학습",
        content_type: "custom" as const,
        subject_category: "기타",
        subject: null,
        total_pages: null,
        total_episodes: null,
        master_content_id: null,
      },
    ],
  };

  describe("기본 매칭 동작", () => {
    it("subject_category가 정확히 일치하는 콘텐츠를 매칭해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
        },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.stats.matchedSlots).toBe(1);
      expect(result.slots[0].content_id).toBe("book-math-1");
      expect(result.slots[0].title).toBe("수학의 정석");
    });

    it("lecture 슬롯에 강의 콘텐츠를 매칭해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "lecture",
          subject_category: "수학",
        },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.stats.matchedSlots).toBe(1);
      expect(result.slots[0].content_id).toBe("lecture-math-1");
    });

    it("여러 슬롯을 순차적으로 매칭해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
        { slot_index: 1, slot_type: "book", subject_category: "국어" },
        { slot_index: 2, slot_type: "lecture", subject_category: "과학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.stats.matchedSlots).toBe(3);
      expect(result.slots[0].content_id).toBe("book-math-1");
      expect(result.slots[1].content_id).toBe("book-korean-1");
      expect(result.slots[2].content_id).toBe("lecture-science-1");
    });
  });

  describe("중복 방지", () => {
    it("동일 콘텐츠를 여러 슬롯에 중복 매칭하지 않아야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
        { slot_index: 1, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      // 첫 번째는 수학 교재, 두 번째는 다른 교재
      expect(result.slots[0].content_id).toBe("book-math-1");
      expect(result.slots[1].content_id).not.toBe("book-math-1");
    });

    it("이미 연결된 콘텐츠는 다른 슬롯에 매칭하지 않아야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-math-1", // 이미 연결됨
          title: "수학의 정석",
        },
        { slot_index: 1, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      // 첫 번째는 그대로 유지
      expect(result.slots[0].content_id).toBe("book-math-1");
      // 두 번째는 다른 교재
      expect(result.slots[1].content_id).not.toBe("book-math-1");
      expect(result.stats.alreadyLinkedSlots).toBe(1);
    });
  });

  describe("특수 슬롯 타입 처리", () => {
    it("self_study 슬롯은 매칭하지 않아야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "self_study", subject_category: "자습" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.slots[0].content_id).toBeUndefined();
      expect(result.stats.matchedSlots).toBe(0);
    });

    it("test 슬롯은 매칭하지 않아야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "test", subject_category: "테스트" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.slots[0].content_id).toBeUndefined();
      expect(result.stats.matchedSlots).toBe(0);
    });

    it("slot_type이 없으면 매칭하지 않아야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: null, subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.slots[0].content_id).toBeUndefined();
      expect(result.stats.unmatchedSlots).toBe(1);
    });
  });

  describe("overwriteExisting 옵션", () => {
    it("overwriteExisting=false일 때 기존 연결을 유지해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "existing-id",
          title: "기존 콘텐츠",
        },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents, {
        overwriteExisting: false,
      });

      expect(result.slots[0].content_id).toBe("existing-id");
      expect(result.stats.alreadyLinkedSlots).toBe(1);
    });

    it("overwriteExisting=true일 때 기존 연결을 덮어써야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "existing-id",
          title: "기존 콘텐츠",
        },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents, {
        overwriteExisting: true,
      });

      expect(result.slots[0].content_id).toBe("book-math-1");
      expect(result.stats.matchedSlots).toBe(1);
    });
  });

  describe("범위 설정", () => {
    it("기본 범위를 적용해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents, {
        defaultRange: { start: 1, end: 50 },
      });

      expect(result.slots[0].start_range).toBe(1);
      expect(result.slots[0].end_range).toBe(50);
    });

    it("콘텐츠의 전체 페이지보다 큰 범위는 조정해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "국어" },
      ];

      // 국어 문법 책은 200페이지
      const result = autoMatchSlotsToContents(slots, mockContents, {
        defaultRange: { start: 1, end: 500 },
      });

      expect(result.slots[0].end_range).toBe(200); // 최대 페이지로 조정
    });

    it("강의의 전체 회차보다 큰 범위는 조정해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "lecture", subject_category: "과학" },
      ];

      // 과학 강의는 15회차
      const result = autoMatchSlotsToContents(slots, mockContents, {
        defaultRange: { start: 1, end: 100 },
      });

      expect(result.slots[0].end_range).toBe(15); // 최대 회차로 조정
    });
  });

  describe("매칭 메타데이터", () => {
    it("매칭된 슬롯에 is_auto_recommended=true를 설정해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.slots[0].is_auto_recommended).toBe(true);
    });

    it("매칭된 슬롯에 recommendation_source='auto'를 설정해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.slots[0].recommendation_source).toBe("auto");
    });

    it("master_content_id를 복사해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.slots[0].master_content_id).toBe("master-book-1");
    });
  });

  describe("통계 및 로그", () => {
    it("정확한 통계를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
        { slot_index: 1, slot_type: "self_study", subject_category: "자습" },
        {
          slot_index: 2,
          slot_type: "book",
          subject_category: "국어",
          content_id: "existing",
        },
        { slot_index: 3, slot_type: null, subject_category: "미지정" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.stats.totalSlots).toBe(4);
      expect(result.stats.matchedSlots).toBe(1); // 수학 book만 매칭
      expect(result.stats.alreadyLinkedSlots).toBe(1); // 국어 book
      expect(result.stats.unmatchedSlots).toBe(1); // null 타입
    });

    it("로그 메시지를 생성해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, mockContents);

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.some((log) => log.includes("매칭 완료"))).toBe(true);
    });
  });

  describe("빈 입력 처리", () => {
    it("빈 슬롯 배열을 처리해야 함", () => {
      const result = autoMatchSlotsToContents([], mockContents);

      expect(result.slots).toHaveLength(0);
      expect(result.stats.totalSlots).toBe(0);
    });

    it("빈 콘텐츠를 처리해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
      ];

      const result = autoMatchSlotsToContents(slots, {
        books: [],
        lectures: [],
        custom: [],
      });

      expect(result.stats.unmatchedSlots).toBe(1);
    });
  });
});

describe("calculateMatchScore", () => {
  it("타입이 다르면 -1을 반환해야 함", () => {
    const slot: ContentSlot = {
      slot_index: 0,
      slot_type: "book",
      subject_category: "수학",
    };
    const content: MatchableContent = {
      id: "1",
      title: "강의",
      content_type: "lecture",
      subject_category: "수학",
    };

    expect(calculateMatchScore(slot, content)).toBe(-1);
  });

  it("subject_category 정확히 일치 시 100점 이상", () => {
    const slot: ContentSlot = {
      slot_index: 0,
      slot_type: "book",
      subject_category: "수학",
    };
    const content: MatchableContent = {
      id: "1",
      title: "교재",
      content_type: "book",
      subject_category: "수학",
    };

    expect(calculateMatchScore(slot, content)).toBeGreaterThanOrEqual(100);
  });

  it("타입만 일치 시 기본 점수 10점", () => {
    const slot: ContentSlot = {
      slot_index: 0,
      slot_type: "book",
      subject_category: "수학",
    };
    const content: MatchableContent = {
      id: "1",
      title: "교재",
      content_type: "book",
      subject_category: "영어",
    };

    expect(calculateMatchScore(slot, content)).toBe(10);
  });
});
