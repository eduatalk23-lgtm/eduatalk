/**
 * Dual Write 변환 함수 테스트
 *
 * slot 포맷과 legacy student_contents 포맷 간의 변환 함수를 테스트합니다.
 * - convertSlotsToContents: ContentSlot[] -> SelectedContent[]
 * - convertContentsToSlots: SelectedContent[] -> ContentSlot[]
 */

import { describe, it, expect } from "vitest";
import {
  convertSlotsToContents,
  convertContentsToSlots,
  type ContentSlot,
  type SelectedContent,
} from "@/lib/types/content-selection";

describe("Dual Write 변환 함수", () => {
  // ============================================================================
  // convertSlotsToContents 테스트
  // ============================================================================

  describe("convertSlotsToContents", () => {
    it("book 슬롯을 SelectedContent로 변환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          title: "수학의 정석",
          master_content_id: "master-1",
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        content_type: "book",
        content_id: "book-1",
        start_range: 1,
        end_range: 50,
        title: "수학의 정석",
        subject_category: "수학",
        master_content_id: "master-1",
      });
    });

    it("lecture 슬롯을 SelectedContent로 변환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "lecture",
          subject_category: "국어",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
          title: "국어 강의",
          start_detail_id: "detail-1",
          end_detail_id: "detail-10",
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        content_type: "lecture",
        content_id: "lecture-1",
        start_range: 1,
        end_range: 10,
        start_detail_id: "detail-1",
        end_detail_id: "detail-10",
      });
    });

    it("custom 슬롯을 SelectedContent로 변환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "custom",
          subject_category: "기타",
          content_id: "custom-1",
          start_range: 1,
          end_range: 5,
          title: "커스텀 학습",
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result).toHaveLength(1);
      expect(result[0].content_type).toBe("custom");
    });

    it("self_study 슬롯은 필터링되어야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "self_study",
          subject_category: "자습",
          content_id: "self-1",
          start_range: 1,
          end_range: 1,
        },
        {
          slot_index: 1,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result).toHaveLength(1);
      expect(result[0].content_type).toBe("book");
    });

    it("test 슬롯은 필터링되어야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "test",
          subject_category: "테스트",
          content_id: "test-1",
          start_range: 1,
          end_range: 1,
        },
        {
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "영어",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 20,
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result).toHaveLength(1);
      expect(result[0].content_type).toBe("lecture");
    });

    it("content_id가 없는 슬롯은 필터링되어야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          // content_id 없음
          start_range: 1,
          end_range: 50,
        },
        {
          slot_index: 1,
          slot_type: "book",
          subject_category: "영어",
          content_id: "book-1",
          start_range: 1,
          end_range: 30,
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result).toHaveLength(1);
      expect(result[0].content_id).toBe("book-1");
    });

    it("start_range, end_range가 undefined일 때 0으로 기본값 설정해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          // start_range, end_range undefined
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result[0].start_range).toBe(0);
      expect(result[0].end_range).toBe(0);
    });

    it("여러 슬롯을 올바르게 변환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
        },
        {
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "국어",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
        },
        {
          slot_index: 2,
          slot_type: "self_study",
          subject_category: "자습",
          content_id: "self-1",
          start_range: 1,
          end_range: 1,
        },
        {
          slot_index: 3,
          slot_type: "custom",
          subject_category: "기타",
          content_id: "custom-1",
          start_range: 1,
          end_range: 5,
        },
      ];

      const result = convertSlotsToContents(slots);

      // self_study는 제외
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.content_type)).toEqual([
        "book",
        "lecture",
        "custom",
      ]);
    });

    it("is_auto_recommended와 recommendation_source가 보존되어야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          is_auto_recommended: true,
          recommendation_source: "auto",
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result[0].is_auto_recommended).toBe(true);
      expect(result[0].recommendation_source).toBe("auto");
    });

    it("빈 배열을 입력하면 빈 배열을 반환해야 함", () => {
      const result = convertSlotsToContents([]);
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // convertContentsToSlots 테스트
  // ============================================================================

  describe("convertContentsToSlots", () => {
    it("SelectedContent를 ContentSlot으로 변환해야 함", () => {
      const contents: SelectedContent[] = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          title: "수학의 정석",
          subject_category: "수학",
          master_content_id: "master-1",
        },
      ];

      const result = convertContentsToSlots(contents);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        slot_index: 0,
        slot_type: "book",
        content_id: "book-1",
        start_range: 1,
        end_range: 50,
        title: "수학의 정석",
        subject_category: "수학",
        master_content_id: "master-1",
      });
    });

    it("여러 콘텐츠를 변환할 때 slot_index가 순차적으로 할당되어야 함", () => {
      const contents: SelectedContent[] = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
        },
        {
          content_type: "lecture",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
        },
        {
          content_type: "custom",
          content_id: "custom-1",
          start_range: 1,
          end_range: 5,
        },
      ];

      const result = convertContentsToSlots(contents);

      expect(result).toHaveLength(3);
      expect(result[0].slot_index).toBe(0);
      expect(result[1].slot_index).toBe(1);
      expect(result[2].slot_index).toBe(2);
    });

    it("subject_category가 없을 때 빈 문자열로 기본값 설정해야 함", () => {
      const contents: SelectedContent[] = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          // subject_category 없음
        },
      ];

      const result = convertContentsToSlots(contents);

      expect(result[0].subject_category).toBe("");
    });

    it("start_detail_id, end_detail_id가 보존되어야 함", () => {
      const contents: SelectedContent[] = [
        {
          content_type: "lecture",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
          start_detail_id: "detail-1",
          end_detail_id: "detail-10",
        },
      ];

      const result = convertContentsToSlots(contents);

      expect(result[0].start_detail_id).toBe("detail-1");
      expect(result[0].end_detail_id).toBe("detail-10");
    });

    it("is_auto_recommended와 recommendation_source가 보존되어야 함", () => {
      const contents: SelectedContent[] = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          is_auto_recommended: true,
          recommendation_source: "admin",
        },
      ];

      const result = convertContentsToSlots(contents);

      expect(result[0].is_auto_recommended).toBe(true);
      expect(result[0].recommendation_source).toBe("admin");
    });

    it("빈 배열을 입력하면 빈 배열을 반환해야 함", () => {
      const result = convertContentsToSlots([]);
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // 라운드트립 (양방향 변환) 테스트
  // ============================================================================

  describe("라운드트립 변환", () => {
    it("Slot → Content → Slot 변환 후 핵심 데이터가 보존되어야 함", () => {
      const originalSlots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          title: "수학의 정석",
          master_content_id: "master-1",
          is_auto_recommended: true,
          recommendation_source: "auto",
        },
        {
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "국어",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
          start_detail_id: "detail-1",
          end_detail_id: "detail-10",
        },
      ];

      const contents = convertSlotsToContents(originalSlots);
      const roundTripSlots = convertContentsToSlots(contents);

      expect(roundTripSlots).toHaveLength(2);

      // 첫 번째 슬롯 검증
      expect(roundTripSlots[0].slot_type).toBe(originalSlots[0].slot_type);
      expect(roundTripSlots[0].content_id).toBe(originalSlots[0].content_id);
      expect(roundTripSlots[0].start_range).toBe(originalSlots[0].start_range);
      expect(roundTripSlots[0].end_range).toBe(originalSlots[0].end_range);
      expect(roundTripSlots[0].title).toBe(originalSlots[0].title);
      expect(roundTripSlots[0].subject_category).toBe(
        originalSlots[0].subject_category
      );
      expect(roundTripSlots[0].master_content_id).toBe(
        originalSlots[0].master_content_id
      );
      expect(roundTripSlots[0].is_auto_recommended).toBe(
        originalSlots[0].is_auto_recommended
      );

      // 두 번째 슬롯 검증
      expect(roundTripSlots[1].slot_type).toBe(originalSlots[1].slot_type);
      expect(roundTripSlots[1].start_detail_id).toBe(
        originalSlots[1].start_detail_id
      );
      expect(roundTripSlots[1].end_detail_id).toBe(
        originalSlots[1].end_detail_id
      );
    });

    it("Content → Slot → Content 변환 후 핵심 데이터가 보존되어야 함", () => {
      const originalContents: SelectedContent[] = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          title: "수학의 정석",
          subject_category: "수학",
          master_content_id: "master-1",
          is_auto_recommended: false,
        },
        {
          content_type: "lecture",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
          start_detail_id: "detail-1",
          end_detail_id: "detail-10",
        },
      ];

      const slots = convertContentsToSlots(originalContents);
      const roundTripContents = convertSlotsToContents(slots);

      expect(roundTripContents).toHaveLength(2);

      // 첫 번째 콘텐츠 검증
      expect(roundTripContents[0].content_type).toBe(
        originalContents[0].content_type
      );
      expect(roundTripContents[0].content_id).toBe(
        originalContents[0].content_id
      );
      expect(roundTripContents[0].start_range).toBe(
        originalContents[0].start_range
      );
      expect(roundTripContents[0].end_range).toBe(
        originalContents[0].end_range
      );
      expect(roundTripContents[0].title).toBe(originalContents[0].title);
      expect(roundTripContents[0].subject_category).toBe(
        originalContents[0].subject_category
      );

      // 두 번째 콘텐츠 검증
      expect(roundTripContents[1].content_type).toBe(
        originalContents[1].content_type
      );
      expect(roundTripContents[1].start_detail_id).toBe(
        originalContents[1].start_detail_id
      );
      expect(roundTripContents[1].end_detail_id).toBe(
        originalContents[1].end_detail_id
      );
    });

    it("self_study와 test 슬롯은 라운드트립에서 손실됨을 인지해야 함", () => {
      const originalSlots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
        },
        {
          slot_index: 1,
          slot_type: "self_study",
          subject_category: "자습",
          content_id: "self-1",
          start_range: 1,
          end_range: 1,
        },
        {
          slot_index: 2,
          slot_type: "test",
          subject_category: "테스트",
          content_id: "test-1",
          start_range: 1,
          end_range: 1,
        },
      ];

      const contents = convertSlotsToContents(originalSlots);
      const roundTripSlots = convertContentsToSlots(contents);

      // self_study와 test는 변환 과정에서 필터링됨
      expect(roundTripSlots).toHaveLength(1);
      expect(roundTripSlots[0].slot_type).toBe("book");
    });

    it("slot_index는 라운드트립 후 재할당됨을 인지해야 함", () => {
      const originalSlots: ContentSlot[] = [
        {
          slot_index: 5, // 임의의 인덱스
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
        },
        {
          slot_index: 10, // 임의의 인덱스
          slot_type: "lecture",
          subject_category: "국어",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 10,
        },
      ];

      const contents = convertSlotsToContents(originalSlots);
      const roundTripSlots = convertContentsToSlots(contents);

      // slot_index는 0부터 순차적으로 재할당됨
      expect(roundTripSlots[0].slot_index).toBe(0);
      expect(roundTripSlots[1].slot_index).toBe(1);
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================

  describe("엣지 케이스", () => {
    it("null 값을 가진 optional 필드가 올바르게 처리되어야 함", () => {
      const slots: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          start_detail_id: null,
          end_detail_id: null,
          master_content_id: null,
        },
      ];

      const result = convertSlotsToContents(slots);

      expect(result[0].start_detail_id).toBeNull();
      expect(result[0].end_detail_id).toBeNull();
      expect(result[0].master_content_id).toBeNull();
    });

    it("undefined 값을 가진 optional 필드가 올바르게 처리되어야 함", () => {
      const contents: SelectedContent[] = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          // title, subject_category, master_content_id 등 undefined
        },
      ];

      const result = convertContentsToSlots(contents);

      expect(result[0].title).toBeUndefined();
      expect(result[0].master_content_id).toBeUndefined();
      expect(result[0].subject_category).toBe(""); // 빈 문자열로 기본값
    });

    it("연계/배타 관계 필드는 Slot에만 존재하고 Content에는 없어야 함", () => {
      const slotsWithRelations: ContentSlot[] = [
        {
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          content_id: "book-1",
          start_range: 1,
          end_range: 50,
          linked_slot_id: "1",
          link_type: "after",
          exclusive_with: ["2"],
        },
      ];

      const contents = convertSlotsToContents(slotsWithRelations);

      // SelectedContent에는 관계 필드가 없음
      expect(contents[0]).not.toHaveProperty("linked_slot_id");
      expect(contents[0]).not.toHaveProperty("link_type");
      expect(contents[0]).not.toHaveProperty("exclusive_with");
    });
  });
});
