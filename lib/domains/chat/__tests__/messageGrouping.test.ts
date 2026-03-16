import { describe, it, expect, beforeEach } from "vitest";
import {
  processMessagesWithGrouping,
  isSameMessageDay,
  isWithinGroupingThreshold,
  formatDateDivider,
} from "../messageGrouping";
import { makeMessage, resetCounter } from "./helpers";

beforeEach(() => resetCounter());

describe("processMessagesWithGrouping", () => {
  describe("기본 동작", () => {
    it("빈 배열 → 빈 결과", () => {
      expect(processMessagesWithGrouping([])).toEqual([]);
    });

    it("단일 메시지 → showDateDivider=true, showName=true, showTime=true", () => {
      const msg = makeMessage({ id: "m1" });
      const result = processMessagesWithGrouping([msg]);
      expect(result).toHaveLength(1);
      expect(result[0].grouping).toEqual({
        showDateDivider: true,
        dateDividerText: expect.any(String),
        showName: true,
        showTime: true,
        isGrouped: false,
        showUnreadDivider: false,
      });
    });
  });

  describe("그룹핑 규칙", () => {
    it("같은 sender, 60초 이내 → 그룹핑됨", () => {
      const base = "2026-03-16T10:00:00Z";
      const m1 = makeMessage({ id: "m1", sender_id: "A", created_at: base });
      const m2 = makeMessage({
        id: "m2",
        sender_id: "A",
        created_at: "2026-03-16T10:00:30Z",
      });
      const result = processMessagesWithGrouping([m1, m2]);

      // m1: 그룹 시작 → showName=true, 다음과 그룹됨 → showTime=false
      expect(result[0].grouping.showName).toBe(true);
      expect(result[0].grouping.showTime).toBe(false);
      expect(result[0].grouping.isGrouped).toBe(false);

      // m2: 이전과 그룹됨 → showName=false, 그룹 끝 → showTime=true
      expect(result[1].grouping.showName).toBe(false);
      expect(result[1].grouping.showTime).toBe(true);
      expect(result[1].grouping.isGrouped).toBe(true);
    });

    it("같은 sender, 61초 이상 → 그룹핑 안 됨", () => {
      const m1 = makeMessage({
        id: "m1",
        sender_id: "A",
        created_at: "2026-03-16T10:00:00Z",
      });
      const m2 = makeMessage({
        id: "m2",
        sender_id: "A",
        created_at: "2026-03-16T10:01:01Z",
      });
      const result = processMessagesWithGrouping([m1, m2]);

      expect(result[0].grouping.showTime).toBe(true);
      expect(result[1].grouping.showName).toBe(true);
      expect(result[1].grouping.isGrouped).toBe(false);
    });

    it("다른 sender → 그룹핑 안 됨", () => {
      const base = "2026-03-16T10:00:00Z";
      const m1 = makeMessage({ id: "m1", sender_id: "A", created_at: base });
      const m2 = makeMessage({
        id: "m2",
        sender_id: "B",
        created_at: "2026-03-16T10:00:10Z",
      });
      const result = processMessagesWithGrouping([m1, m2]);

      expect(result[1].grouping.isGrouped).toBe(false);
      expect(result[1].grouping.showName).toBe(true);
    });

    it("system 메시지 → 그룹핑 중단", () => {
      const m1 = makeMessage({
        id: "m1",
        sender_id: "A",
        created_at: "2026-03-16T10:00:00Z",
      });
      const m2 = makeMessage({
        id: "m2",
        sender_id: "A",
        message_type: "system",
        created_at: "2026-03-16T10:00:10Z",
      });
      const m3 = makeMessage({
        id: "m3",
        sender_id: "A",
        created_at: "2026-03-16T10:00:20Z",
      });
      const result = processMessagesWithGrouping([m1, m2, m3]);

      // m1: showTime=true (system이 끊음)
      expect(result[0].grouping.showTime).toBe(true);
      // m3: showName=true (system 이후)
      expect(result[2].grouping.showName).toBe(true);
      expect(result[2].grouping.isGrouped).toBe(false);
    });

    it("reply 메시지 → 그룹핑 중단", () => {
      const m1 = makeMessage({
        id: "m1",
        sender_id: "A",
        created_at: "2026-03-16T10:00:00Z",
      });
      const m2 = makeMessage({
        id: "m2",
        sender_id: "A",
        reply_to_id: "m0",
        created_at: "2026-03-16T10:00:10Z",
      });
      const result = processMessagesWithGrouping([m1, m2]);

      expect(result[1].grouping.isGrouped).toBe(false);
      expect(result[1].grouping.showName).toBe(true);
    });
  });

  describe("날짜 구분선", () => {
    it("첫 메시지에 항상 날짜 구분선 표시", () => {
      const result = processMessagesWithGrouping([
        makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" }),
      ]);
      expect(result[0].grouping.showDateDivider).toBe(true);
      expect(result[0].grouping.dateDividerText).toBeTruthy();
    });

    it("같은 날 → 날짜 구분선 없음", () => {
      // 로컬 타임존(KST=UTC+9) 기준 같은 날이어야 함
      const result = processMessagesWithGrouping([
        makeMessage({ id: "m1", created_at: "2026-03-16T01:00:00Z" }),
        makeMessage({ id: "m2", created_at: "2026-03-16T12:00:00Z" }),
      ]);
      expect(result[1].grouping.showDateDivider).toBe(false);
    });

    it("다른 날 → 날짜 구분선 표시 + 그룹핑 중단", () => {
      // 로컬 타임존(KST) 기준 확실히 다른 날 (15시 UTC = 3/17 00시 KST)
      const result = processMessagesWithGrouping([
        makeMessage({
          id: "m1",
          sender_id: "A",
          created_at: "2026-03-16T14:00:00Z", // KST 3/16 23시
        }),
        makeMessage({
          id: "m2",
          sender_id: "A",
          created_at: "2026-03-16T16:00:00Z", // KST 3/17 01시
        }),
      ]);
      expect(result[1].grouping.showDateDivider).toBe(true);
      expect(result[1].grouping.isGrouped).toBe(false);
    });
  });

  describe("읽지 않은 구분선", () => {
    it("lastReadAt 이후 첫 타인 메시지에 구분선 표시", () => {
      const result = processMessagesWithGrouping(
        [
          makeMessage({
            id: "m1",
            sender_id: "A",
            created_at: "2026-03-16T10:00:00Z",
          }),
          makeMessage({
            id: "m2",
            sender_id: "B",
            created_at: "2026-03-16T10:01:00Z",
          }),
          makeMessage({
            id: "m3",
            sender_id: "B",
            created_at: "2026-03-16T10:02:00Z",
          }),
        ],
        { lastReadAt: "2026-03-16T10:00:30Z", currentUserId: "A" }
      );

      expect(result[0].grouping.showUnreadDivider).toBe(false);
      expect(result[1].grouping.showUnreadDivider).toBe(true);
      // 두 번째 이후는 표시 안 함
      expect(result[2].grouping.showUnreadDivider).toBe(false);
    });

    it("본인 메시지에는 구분선 표시 안 함", () => {
      const result = processMessagesWithGrouping(
        [
          makeMessage({
            id: "m1",
            sender_id: "A",
            created_at: "2026-03-16T10:00:00Z",
          }),
          makeMessage({
            id: "m2",
            sender_id: "A",
            created_at: "2026-03-16T10:01:00Z",
          }),
        ],
        { lastReadAt: "2026-03-16T10:00:30Z", currentUserId: "A" }
      );

      expect(result[0].grouping.showUnreadDivider).toBe(false);
      expect(result[1].grouping.showUnreadDivider).toBe(false);
    });
  });

  describe("3개 메시지 그룹핑 (중간 메시지)", () => {
    it("A-A-A 연속 → 중간 메시지는 이름/시간 모두 안 보임", () => {
      const base = new Date("2026-03-16T10:00:00Z");
      const result = processMessagesWithGrouping([
        makeMessage({
          id: "m1",
          sender_id: "A",
          created_at: base.toISOString(),
        }),
        makeMessage({
          id: "m2",
          sender_id: "A",
          created_at: new Date(base.getTime() + 20_000).toISOString(),
        }),
        makeMessage({
          id: "m3",
          sender_id: "A",
          created_at: new Date(base.getTime() + 40_000).toISOString(),
        }),
      ]);

      // 첫 번째: 이름 O, 시간 X
      expect(result[0].grouping).toMatchObject({
        showName: true,
        showTime: false,
        isGrouped: false,
      });
      // 중간: 이름 X, 시간 X
      expect(result[1].grouping).toMatchObject({
        showName: false,
        showTime: false,
        isGrouped: true,
      });
      // 마지막: 이름 X, 시간 O
      expect(result[2].grouping).toMatchObject({
        showName: false,
        showTime: true,
        isGrouped: true,
      });
    });
  });
});

describe("유틸리티 함수", () => {
  it("isSameMessageDay — 같은 날 (로컬 타임존 기준)", () => {
    // KST(UTC+9) 기준 모두 3/16
    expect(
      isSameMessageDay("2026-03-16T01:00:00Z", "2026-03-16T12:00:00Z")
    ).toBe(true);
  });

  it("isSameMessageDay — 다른 날 (로컬 타임존 기준)", () => {
    // KST 기준 3/16 23시 vs 3/17 01시
    expect(
      isSameMessageDay("2026-03-16T14:00:00Z", "2026-03-16T16:00:00Z")
    ).toBe(false);
  });

  it("isWithinGroupingThreshold — 60초 이내", () => {
    expect(
      isWithinGroupingThreshold(
        "2026-03-16T10:00:00Z",
        "2026-03-16T10:01:00Z"
      )
    ).toBe(true);
  });

  it("isWithinGroupingThreshold — 61초 이상", () => {
    expect(
      isWithinGroupingThreshold(
        "2026-03-16T10:00:00Z",
        "2026-03-16T10:01:01Z"
      )
    ).toBe(false);
  });

  it("formatDateDivider — 유효한 날짜", () => {
    const result = formatDateDivider("2026-03-16T10:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("3월");
    expect(result).toContain("16일");
  });

  it("formatDateDivider — 잘못된 날짜 → 빈 문자열", () => {
    expect(formatDateDivider("invalid-date")).toBe("");
  });
});
