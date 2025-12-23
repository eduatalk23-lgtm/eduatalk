import { describe, it, expect } from "vitest";
import {
  ContentSlot,
  createEmptySlot,
  getNextSlotIndex,
  validateSlotConfiguration,
  validateContentLinking,
  validateSlotRelationships,
  getSlotCompletionStatus,
} from "@/lib/types/content-selection";

describe("Slot Configuration Utilities", () => {
  describe("createEmptySlot", () => {
    it("빈 슬롯을 생성해야 함", () => {
      const slot = createEmptySlot(0);

      expect(slot).toEqual({
        slot_index: 0,
        slot_type: null,
        subject_category: "",
      });
    });

    it("주어진 인덱스로 슬롯을 생성해야 함", () => {
      const slot = createEmptySlot(5);

      expect(slot.slot_index).toBe(5);
    });
  });

  describe("getNextSlotIndex", () => {
    it("빈 배열이면 0을 반환해야 함", () => {
      const nextIndex = getNextSlotIndex([]);

      expect(nextIndex).toBe(0);
    });

    it("슬롯이 있으면 최대 인덱스 + 1을 반환해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
        { slot_index: 2, slot_type: "lecture", subject_category: "영어" },
      ];

      const nextIndex = getNextSlotIndex(slots);

      expect(nextIndex).toBe(3);
    });

    it("연속되지 않은 인덱스에서도 최대값 + 1을 반환해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 5, slot_type: "book", subject_category: "수학" },
        { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
      ];

      const nextIndex = getNextSlotIndex(slots);

      expect(nextIndex).toBe(6);
    });
  });

  describe("validateSlotConfiguration", () => {
    it("빈 슬롯 배열은 유효해야 함", () => {
      const result = validateSlotConfiguration([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("9개 이하 슬롯은 유효해야 함", () => {
      const slots: ContentSlot[] = Array.from({ length: 9 }, (_, i) => ({
        slot_index: i,
        slot_type: "book",
        subject_category: "수학",
      }));

      const result = validateSlotConfiguration(slots);

      expect(result.valid).toBe(true);
    });

    it("9개 초과 슬롯은 에러를 반환해야 함", () => {
      const slots: ContentSlot[] = Array.from({ length: 10 }, (_, i) => ({
        slot_index: i,
        slot_type: "book",
        subject_category: "수학",
      }));

      const result = validateSlotConfiguration(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("9개"))).toBe(true);
    });

    it("동일한 교과-과목 조합 중복 시 경고를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "book", subject_category: "수학" },
        { slot_index: 1, slot_type: "book", subject_category: "수학" },
      ];

      const result = validateSlotConfiguration(slots);

      // 동일한 교과-과목 조합 중복 시 경고
      expect(result.warnings.some((w) => w.includes("중복"))).toBe(true);
    });
  });

  describe("validateContentLinking", () => {
    it("자습 타입에 목적이 없으면 경고를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        { slot_index: 0, slot_type: "self_study", subject_category: "수학" },
      ];

      const result = validateContentLinking(slots);

      // 자습 타입에 목적이 없으면 경고가 있어야 함
      expect(
        result.warnings.some((w) => w.includes("자습") || w.includes("목적"))
      ).toBe(true);
    });
  });

  describe("getSlotCompletionStatus", () => {
    it("빈 슬롯은 'empty' 상태여야 함", () => {
      const slot: ContentSlot = {
        slot_index: 0,
        slot_type: null,
        subject_category: "",
      };

      const status = getSlotCompletionStatus(slot);

      expect(status).toBe("empty");
    });

    it("타입만 선택된 슬롯은 'type_selected' 상태여야 함", () => {
      const slot: ContentSlot = {
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
      };

      const status = getSlotCompletionStatus(slot);

      expect(status).toBe("type_selected");
    });

    it("콘텐츠가 연결된 슬롯은 'content_linked' 상태여야 함", () => {
      const slot: ContentSlot = {
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
        content_id: "content-123",
        title: "수학의 정석",
      };

      const status = getSlotCompletionStatus(slot);

      expect(status).toBe("content_linked");
    });
  });
});

describe("Slot Reordering Logic", () => {
  // SlotConfigurationPanel의 드래그앤드롭 로직 테스트

  const reorderSlots = (
    slots: ContentSlot[],
    fromIndex: number,
    toIndex: number
  ): ContentSlot[] => {
    const newSlots = [...slots];
    const [removed] = newSlots.splice(fromIndex, 1);
    newSlots.splice(toIndex, 0, removed);

    // 인덱스 재정렬
    return newSlots.map((slot, i) => ({
      ...slot,
      slot_index: i,
    }));
  };

  it("슬롯을 앞으로 이동해야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
      { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
      { slot_index: 2, slot_type: "custom", subject_category: "과학" },
    ];

    const result = reorderSlots(slots, 2, 0);

    expect(result[0].slot_type).toBe("custom");
    expect(result[0].slot_index).toBe(0);
    expect(result[1].slot_type).toBe("book");
    expect(result[1].slot_index).toBe(1);
    expect(result[2].slot_type).toBe("lecture");
    expect(result[2].slot_index).toBe(2);
  });

  it("슬롯을 뒤로 이동해야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
      { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
      { slot_index: 2, slot_type: "custom", subject_category: "과학" },
    ];

    const result = reorderSlots(slots, 0, 2);

    expect(result[0].slot_type).toBe("lecture");
    expect(result[0].slot_index).toBe(0);
    expect(result[1].slot_type).toBe("custom");
    expect(result[1].slot_index).toBe(1);
    expect(result[2].slot_type).toBe("book");
    expect(result[2].slot_index).toBe(2);
  });

  it("같은 위치로 이동해도 인덱스는 유지되어야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
      { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
    ];

    const result = reorderSlots(slots, 0, 0);

    expect(result[0].slot_index).toBe(0);
    expect(result[1].slot_index).toBe(1);
  });
});

describe("Slot Duplication Logic", () => {
  const duplicateSlot = (
    slots: ContentSlot[],
    index: number,
    maxSlots: number = 9
  ): ContentSlot[] | null => {
    if (slots.length >= maxSlots) return null;

    const slotToCopy = slots[index];
    if (slotToCopy.is_locked) return null;

    const newSlot: ContentSlot = {
      ...slotToCopy,
      id: undefined,
      slot_index: index + 1,
      is_locked: false,
      is_ghost: false,
      ghost_message: undefined,
    };

    const newSlots = [...slots];
    newSlots.splice(index + 1, 0, newSlot);

    // 인덱스 재정렬
    return newSlots.map((slot, i) => ({
      ...slot,
      slot_index: i,
    }));
  };

  it("슬롯을 복제해야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
      { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
    ];

    const result = duplicateSlot(slots, 0);

    expect(result).not.toBeNull();
    expect(result!.length).toBe(3);
    expect(result![0].slot_type).toBe("book");
    expect(result![1].slot_type).toBe("book"); // 복제된 슬롯
    expect(result![2].slot_type).toBe("lecture");
  });

  it("최대 슬롯 수에 도달하면 null을 반환해야 함", () => {
    const slots: ContentSlot[] = Array.from({ length: 9 }, (_, i) => ({
      slot_index: i,
      slot_type: "book",
      subject_category: "수학",
    }));

    const result = duplicateSlot(slots, 0);

    expect(result).toBeNull();
  });

  it("잠금 슬롯은 복제할 수 없어야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학", is_locked: true },
    ];

    const result = duplicateSlot(slots, 0);

    expect(result).toBeNull();
  });

  it("복제된 슬롯은 잠금 상태가 해제되어야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
    ];

    const result = duplicateSlot(slots, 0);

    expect(result![1].is_locked).toBeFalsy();
    expect(result![1].is_ghost).toBeFalsy();
  });
});

describe("Slot Move Up/Down Logic", () => {
  const moveSlotUp = (
    slots: ContentSlot[],
    index: number
  ): ContentSlot[] | null => {
    if (index <= 0) return null;

    const newSlots = [...slots];
    [newSlots[index - 1], newSlots[index]] = [
      newSlots[index],
      newSlots[index - 1],
    ];

    return newSlots.map((slot, i) => ({
      ...slot,
      slot_index: i,
    }));
  };

  const moveSlotDown = (
    slots: ContentSlot[],
    index: number
  ): ContentSlot[] | null => {
    if (index >= slots.length - 1) return null;

    const newSlots = [...slots];
    [newSlots[index], newSlots[index + 1]] = [
      newSlots[index + 1],
      newSlots[index],
    ];

    return newSlots.map((slot, i) => ({
      ...slot,
      slot_index: i,
    }));
  };

  it("슬롯을 위로 이동해야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
      { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
    ];

    const result = moveSlotUp(slots, 1);

    expect(result).not.toBeNull();
    expect(result![0].slot_type).toBe("lecture");
    expect(result![1].slot_type).toBe("book");
  });

  it("첫 번째 슬롯은 위로 이동할 수 없어야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
    ];

    const result = moveSlotUp(slots, 0);

    expect(result).toBeNull();
  });

  it("슬롯을 아래로 이동해야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
      { slot_index: 1, slot_type: "lecture", subject_category: "영어" },
    ];

    const result = moveSlotDown(slots, 0);

    expect(result).not.toBeNull();
    expect(result![0].slot_type).toBe("lecture");
    expect(result![1].slot_type).toBe("book");
  });

  it("마지막 슬롯은 아래로 이동할 수 없어야 함", () => {
    const slots: ContentSlot[] = [
      { slot_index: 0, slot_type: "book", subject_category: "수학" },
    ];

    const result = moveSlotDown(slots, 0);

    expect(result).toBeNull();
  });
});

// ============================================================================
// 슬롯 관계 검증 테스트
// ============================================================================

describe("validateSlotRelationships", () => {
  describe("연계 슬롯 (Linked Slots) 검증", () => {
    it("유효한 연계 슬롯은 에러 없이 통과해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "lecture",
          subject_category: "수학",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "self_study",
          subject_category: "수학",
          linked_slot_id: "slot-1",
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("자기 자신을 연결하면 에러를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          linked_slot_id: "slot-1", // 자기 자신 참조
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("자기 자신"))).toBe(true);
    });

    it("존재하지 않는 슬롯을 연결하면 경고를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          linked_slot_id: "non-existent-slot", // 존재하지 않는 슬롯
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.warnings.some((w) => w.includes("존재하지 않"))).toBe(true);
    });
  });

  describe("배타적 슬롯 (Exclusive Slots) 검증", () => {
    it("유효한 배타적 관계는 에러 없이 통과해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "영어",
          exclusive_with: ["slot-2"],
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "영어",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("배타적 관계에 자기 자신을 포함하면 에러를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          exclusive_with: ["slot-1"], // 자기 자신 참조
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("배타적") && e.includes("자기 자신"))
      ).toBe(true);
    });

    it("배타적 관계에 존재하지 않는 슬롯이 있으면 경고를 반환해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          exclusive_with: ["non-existent-slot"],
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.warnings.some((w) => w.includes("배타적") && w.includes("존재하지 않"))).toBe(true);
    });
  });

  describe("순환 참조 (Circular Reference) 검증", () => {
    it("순환 참조가 없으면 에러 없이 통과해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "lecture",
          subject_category: "수학",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "self_study",
          subject_category: "수학",
          linked_slot_id: "slot-1",
          link_type: "after",
        },
        {
          id: "slot-3",
          slot_index: 2,
          slot_type: "test",
          subject_category: "수학",
          linked_slot_id: "slot-2",
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("2개 슬롯 간 순환 참조 (A→B→A)를 감지해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          linked_slot_id: "slot-2",
          link_type: "after",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "수학",
          linked_slot_id: "slot-1",
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("순환 참조"))).toBe(true);
    });

    it("3개 슬롯 간 순환 참조 (A→B→C→A)를 감지해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          linked_slot_id: "slot-2",
          link_type: "after",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "수학",
          linked_slot_id: "slot-3",
          link_type: "after",
        },
        {
          id: "slot-3",
          slot_index: 2,
          slot_type: "self_study",
          subject_category: "수학",
          linked_slot_id: "slot-1",
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("순환 참조"))).toBe(true);
    });

    it("부분적인 순환 참조도 감지해야 함", () => {
      // A → B → C → B (C와 B 사이 순환)
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
          linked_slot_id: "slot-2",
          link_type: "after",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "수학",
          linked_slot_id: "slot-3",
          link_type: "after",
        },
        {
          id: "slot-3",
          slot_index: 2,
          slot_type: "self_study",
          subject_category: "수학",
          linked_slot_id: "slot-2", // slot-2로 다시 연결
          link_type: "after",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("순환 참조"))).toBe(true);
    });
  });

  describe("복합 시나리오", () => {
    it("연계와 배타 관계가 함께 있어도 유효성 검증이 통과해야 함", () => {
      const slots: ContentSlot[] = [
        {
          id: "slot-1",
          slot_index: 0,
          slot_type: "lecture",
          subject_category: "수학",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "self_study",
          subject_category: "수학",
          linked_slot_id: "slot-1",
          link_type: "after",
          self_study_purpose: "review",
        },
        {
          id: "slot-3",
          slot_index: 2,
          slot_type: "book",
          subject_category: "영어",
          exclusive_with: ["slot-4"],
        },
        {
          id: "slot-4",
          slot_index: 3,
          slot_type: "lecture",
          subject_category: "영어",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("ID가 없는 슬롯은 관계 검증을 건너뛰어야 함", () => {
      const slots: ContentSlot[] = [
        {
          // id 없음
          slot_index: 0,
          slot_type: "book",
          subject_category: "수학",
        },
        {
          id: "slot-2",
          slot_index: 1,
          slot_type: "lecture",
          subject_category: "수학",
        },
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
    });

    it("빈 슬롯 배열은 유효해야 함", () => {
      const result = validateSlotRelationships([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe("validateSlotConfiguration with Relationships", () => {
  it("슬롯 구성 검증이 관계 검증을 포함해야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
        linked_slot_id: "slot-1", // 자기 자신 참조 - 에러
      },
    ];

    const result = validateSlotConfiguration(slots);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("자기 자신"))).toBe(true);
  });

  it("순환 참조가 있으면 슬롯 구성이 유효하지 않아야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
        linked_slot_id: "slot-2",
        link_type: "after",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "수학",
        linked_slot_id: "slot-1",
        link_type: "after",
      },
    ];

    const result = validateSlotConfiguration(slots);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("순환 참조"))).toBe(true);
  });
});
