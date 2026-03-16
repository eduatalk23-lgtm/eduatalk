import { describe, it, expect, beforeEach } from "vitest";
import { processMessagesWithGrouping } from "../messageGrouping";
import {
  makeMessage,
  makePage,
  mergePages,
  detectPrepend,
  resetCounter,
} from "./helpers";
import type { CacheMessage } from "../cacheTypes";

beforeEach(() => resetCounter());

// ============================================
// 페이지 병합 (allMessages 알고리즘)
// ============================================
describe("mergePages — 페이지 병합 알고리즘", () => {
  it("단일 페이지 → 그대로 반환", () => {
    const msgs = [
      makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" }),
      makeMessage({ id: "m2", created_at: "2026-03-16T10:01:00Z" }),
    ];
    const result = mergePages([makePage(msgs)]);
    expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("다중 페이지 → oldest→newest 순서로 병합", () => {
    // pages: [newest, oldest] 순서
    const newestPage = makePage([
      makeMessage({ id: "m3", created_at: "2026-03-16T10:02:00Z" }),
      makeMessage({ id: "m4", created_at: "2026-03-16T10:03:00Z" }),
    ]);
    const oldestPage = makePage([
      makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" }),
      makeMessage({ id: "m2", created_at: "2026-03-16T10:01:00Z" }),
    ]);
    const result = mergePages([newestPage, oldestPage]);
    expect(result.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("중복 메시지 → 최신 페이지(page 0) 버전이 승리", () => {
    const newestPage = makePage([
      makeMessage({ id: "m2", created_at: "2026-03-16T10:01:00Z", readCount: 0 }),
    ]);
    const oldestPage = makePage([
      makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" }),
      makeMessage({ id: "m2", created_at: "2026-03-16T10:01:00Z", readCount: 3 }),
    ]);
    const result = mergePages([newestPage, oldestPage]);

    expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
    // m2는 newest page 버전 (readCount: 0)
    expect(result[1].readCount).toBe(0);
  });

  it("readCount — 메시지 자체 값 > page.readCounts 딕셔너리", () => {
    const msg = makeMessage({ id: "m1", readCount: 5 });
    const page = makePage([msg], { readCounts: { m1: 3 } });
    const result = mergePages([page]);
    // 메시지 자체 readCount(5)가 우선
    expect(result[0].readCount).toBe(5);
  });

  it("readCount — 메시지에 없으면 page.readCounts에서 가져옴", () => {
    const msg = makeMessage({ id: "m1" }); // readCount 없음
    const page = makePage([msg], { readCounts: { m1: 7 } });
    const result = mergePages([page]);
    expect(result[0].readCount).toBe(7);
  });

  it("3개 페이지 병합 — 순서 보장", () => {
    const p0 = makePage([
      makeMessage({ id: "m5", created_at: "2026-03-16T10:04:00Z" }),
      makeMessage({ id: "m6", created_at: "2026-03-16T10:05:00Z" }),
    ]);
    const p1 = makePage([
      makeMessage({ id: "m3", created_at: "2026-03-16T10:02:00Z" }),
      makeMessage({ id: "m4", created_at: "2026-03-16T10:03:00Z" }),
    ]);
    const p2 = makePage([
      makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" }),
      makeMessage({ id: "m2", created_at: "2026-03-16T10:01:00Z" }),
    ]);
    const result = mergePages([p0, p1, p2]);
    expect(result.map((m) => m.id)).toEqual([
      "m1", "m2", "m3", "m4", "m5", "m6",
    ]);
  });

  it("빈 페이지 → 건너뜀", () => {
    const p0 = makePage([
      makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" }),
    ]);
    const pEmpty = makePage([]);
    const result = mergePages([p0, pEmpty]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });
});

// ============================================
// Prepend 감지 + firstItemIndex 계산
// ============================================
describe("detectPrepend — prepend 감지 알고리즘", () => {
  it("변경 없음 → prependedCount 유지", () => {
    const msgs = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
    ];
    const result = detectPrepend(msgs, msgs, 0);
    expect(result.prependedCount).toBe(0);
    expect(result.firstItemIndex).toBe(10_000);
  });

  it("앞에 2개 prepend → prependedCount += 2", () => {
    const prev = [
      makeMessage({ id: "m3" }),
      makeMessage({ id: "m4" }),
    ];
    const next = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
      makeMessage({ id: "m3" }),
      makeMessage({ id: "m4" }),
    ];
    const result = detectPrepend(prev, next, 0);
    expect(result.prependedCount).toBe(2);
    expect(result.firstItemIndex).toBe(10_000 - 2);
  });

  it("뒤에 append → prependedCount 변경 없음 (첫 ID 동일)", () => {
    const prev = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
    ];
    const next = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
      makeMessage({ id: "m3" }),
    ];
    const result = detectPrepend(prev, next, 0);
    expect(result.prependedCount).toBe(0);
  });

  it("누적 prepend — 2번 연속 prepend", () => {
    const step0 = [makeMessage({ id: "m5" }), makeMessage({ id: "m6" })];

    // 1차 prepend: m3, m4 추가
    const step1 = [
      makeMessage({ id: "m3" }),
      makeMessage({ id: "m4" }),
      ...step0,
    ];
    const result1 = detectPrepend(step0, step1, 0);
    expect(result1.prependedCount).toBe(2);

    // 2차 prepend: m1, m2 추가
    const step2 = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
      ...step1,
    ];
    const result2 = detectPrepend(step1, step2, result1.prependedCount);
    expect(result2.prependedCount).toBe(4);
    expect(result2.firstItemIndex).toBe(10_000 - 4);
  });

  it("빈 → 첫 로드 → prepend 안 됨", () => {
    const prev: CacheMessage[] = [];
    const next = [makeMessage({ id: "m1" }), makeMessage({ id: "m2" })];
    const result = detectPrepend(prev, next, 0);
    // prevFirstId가 undefined이므로 prepend 미감지
    expect(result.prependedCount).toBe(0);
  });

  it("anchor 메시지가 삭제된 경우 (maxPages 초과) → 추정치 사용", () => {
    const prev = [
      makeMessage({ id: "m5" }),
      makeMessage({ id: "m6" }),
    ];
    // m5가 캐시에서 사라지고 새 메시지가 많이 들어옴
    const next = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
      makeMessage({ id: "m3" }),
      makeMessage({ id: "m4" }),
      // m5, m6은 maxPages 초과로 삭제됨
    ];
    const result = detectPrepend(prev, next, 0);
    // anchorIdx === -1 && newLength > prevLength → newLength - prevLength = 2
    expect(result.prependedCount).toBe(2);
  });
});

// ============================================
// messagesWithGrouping fast-path 시뮬레이션
// ============================================
describe("messagesWithGrouping fast-path 시뮬레이션", () => {
  describe("Fast-path 2: append 후 그룹핑", () => {
    it("append 후 경계 메시지가 이전 그룹 컨텍스트를 유지함 (수정됨)", () => {
      // 수정 전: processMessagesWithGrouping(tail)에 앞 메시지 컨텍스트 없음
      // 수정 후: 경계 메시지의 그룹핑을 앞 메시지와의 관계로 보정
      const base = "2026-03-16T10:00:00Z";
      const msgs = [
        makeMessage({ id: "m1", sender_id: "A", created_at: base }),
        makeMessage({
          id: "m2",
          sender_id: "A",
          created_at: "2026-03-16T10:00:30Z",
        }),
      ];

      const grouped1 = processMessagesWithGrouping(msgs);
      expect(grouped1[1].grouping.isGrouped).toBe(true);

      const newMsg = makeMessage({
        id: "m3",
        sender_id: "A",
        created_at: "2026-03-16T10:01:00Z",
      });
      const allMsgs = [...msgs, newMsg];

      // 수정된 fast-path 2 시뮬레이션: 경계 보정 포함
      const regroupStart = Math.max(0, msgs.length - 1);
      const tailGrouped = processMessagesWithGrouping(
        allMsgs.slice(regroupStart)
      );

      // 경계 보정: m2 앞의 m1과의 관계 반영
      const beforeTail = allMsgs[regroupStart - 1]; // m1
      const firstTail = tailGrouped[0]; // m2
      if (beforeTail && firstTail) {
        const sameDay = new Date(beforeTail.created_at).toDateString() === new Date(firstTail.created_at).toDateString();
        const canGroup =
          sameDay &&
          beforeTail.sender_id === firstTail.sender_id &&
          Math.abs(new Date(beforeTail.created_at).getTime() - new Date(firstTail.created_at).getTime()) <= 60_000;
        if (canGroup) {
          tailGrouped[0] = {
            ...firstTail,
            grouping: { ...firstTail.grouping, isGrouped: true, showName: false },
          };
        }
        if (sameDay) {
          tailGrouped[0] = {
            ...tailGrouped[0],
            grouping: { ...tailGrouped[0].grouping, showDateDivider: false, dateDividerText: undefined },
          };
        }
      }

      const result = [...grouped1.slice(0, regroupStart), ...tailGrouped];

      // ✅ 수정됨: m2가 m1과 그룹핑 유지
      expect(result[1].grouping.isGrouped).toBe(true);
      expect(result[1].grouping.showName).toBe(false);

      // 전체 재계산과 동일한 결과
      const fullResult = processMessagesWithGrouping(allMsgs);
      expect(result[1].grouping.isGrouped).toBe(fullResult[1].grouping.isGrouped);
      expect(result[1].grouping.showName).toBe(fullResult[1].grouping.showName);
    });

    it("다른 날짜의 메시지 append → 날짜 구분선 표시", () => {
      // KST 기준 확실히 다른 날
      const msgs = [
        makeMessage({
          id: "m1",
          sender_id: "A",
          created_at: "2026-03-16T14:00:00Z", // KST 3/16 23시
        }),
      ];

      const newMsg = makeMessage({
        id: "m2",
        sender_id: "A",
        created_at: "2026-03-16T16:00:00Z", // KST 3/17 01시
      });
      const allMsgs = [...msgs, newMsg];

      // 전체 재계산으로 검증
      const fullResult = processMessagesWithGrouping(allMsgs);
      expect(fullResult[1].grouping.showDateDivider).toBe(true);
    });

    it("append + readCount 동시 변경 시 기존 메시지의 readCount가 올바르게 갱신됨 (수정됨)", () => {
      // 수정 전: prevGrouped를 그대로 재사용하여 readCount 누락
      // 수정 후: 재사용 구간에도 readCount/status 패치 적용
      const m1_v1 = makeMessage({
        id: "m1",
        sender_id: "A",
        created_at: "2026-03-16T10:00:00Z",
        readCount: 3,
      });
      const m2 = makeMessage({
        id: "m2",
        sender_id: "A",
        created_at: "2026-03-16T10:00:30Z",
      });

      const prev = [m1_v1, m2];
      const grouped1 = processMessagesWithGrouping(prev);

      // m1의 readCount 변경 + m3 append
      const m1_v2 = { ...m1_v1, readCount: 2 };
      const m3 = makeMessage({
        id: "m3",
        sender_id: "A",
        created_at: "2026-03-16T10:01:00Z",
      });
      const allMsgs = [m1_v2, m2, m3];

      // 수정된 fast-path 2: 재사용 구간도 readCount 패치
      const regroupStart = Math.max(0, prev.length - 1);
      const reusedPrev = grouped1.slice(0, regroupStart).map((grouped, idx) => {
        const newMsg = allMsgs[idx];
        if (!newMsg || newMsg === prev[idx]) return grouped;
        const rcChanged = newMsg.readCount !== grouped.readCount;
        if (rcChanged) return { ...grouped, readCount: newMsg.readCount };
        return grouped;
      });

      const result = [
        ...reusedPrev,
        ...processMessagesWithGrouping(allMsgs.slice(regroupStart)),
      ];

      // ✅ 수정됨: readCount가 올바르게 갱신
      expect(result[0].readCount).toBe(2);
      expect(allMsgs[0].readCount).toBe(2);
    });
  });

  describe("Fast-path 1: 비그룹핑 필드 변경", () => {
    it("readCount만 변경 시 그룹핑 구조 재사용", () => {
      const msgs = [
        makeMessage({
          id: "m1",
          sender_id: "A",
          created_at: "2026-03-16T10:00:00Z",
          readCount: 3,
        }),
        makeMessage({
          id: "m2",
          sender_id: "A",
          created_at: "2026-03-16T10:00:30Z",
          readCount: 2,
        }),
      ];

      const grouped = processMessagesWithGrouping(msgs);

      // readCount 변경된 새 메시지 배열 (fast-path 1 시뮬레이션)
      const updated = msgs.map((m, i) =>
        i === 0 ? { ...m, readCount: 1 } : m
      );

      // fast-path 1: 같은 길이, 같은 ID, 다른 참조
      expect(updated.length).toBe(msgs.length);
      expect(updated[0].id).toBe(msgs[0].id);
      expect(updated[0]).not.toBe(msgs[0]); // 다른 참조

      // 패치 적용
      const patched = grouped.map((g, idx) => {
        const newMsg = updated[idx];
        if (!newMsg) return g;
        const rcChanged = newMsg.readCount !== g.readCount;
        if (rcChanged) {
          return { ...g, readCount: newMsg.readCount };
        }
        return g;
      });

      expect(patched[0].readCount).toBe(1); // 갱신됨
      expect(patched[0].grouping).toBe(grouped[0].grouping); // 그룹핑은 동일 참조
      expect(patched[1]).toBe(grouped[1]); // 변경 없는 항목은 동일 참조
    });
  });
});

// ============================================
// 페이지네이션 + prepend → 그룹핑 전체 흐름
// ============================================
describe("페이지네이션 → prepend → 그룹핑 통합 테스트", () => {
  it("backward pagination: 과거 메시지 로드 후 전체 그룹핑 재계산", () => {
    // 초기: m3, m4만 로드
    const page0 = makePage([
      makeMessage({
        id: "m3",
        sender_id: "A",
        created_at: "2026-03-16T10:02:00Z",
      }),
      makeMessage({
        id: "m4",
        sender_id: "B",
        created_at: "2026-03-16T10:03:00Z",
      }),
    ]);

    const initial = mergePages([page0]);
    const initialGrouped = processMessagesWithGrouping(initial);

    // prepend 감지
    const { firstItemIndex: fii1 } = detectPrepend([], initial, 0);
    expect(fii1).toBe(10_000); // 첫 로드이므로 prepend 없음

    // backward pagination: m1, m2 로드 (older page)
    const page1 = makePage([
      makeMessage({
        id: "m1",
        sender_id: "A",
        created_at: "2026-03-16T10:00:00Z",
      }),
      makeMessage({
        id: "m2",
        sender_id: "A",
        created_at: "2026-03-16T10:00:30Z",
      }),
    ]);

    // pages: [newest(page0), oldest(page1)]
    const afterPagination = mergePages([page0, page1]);
    expect(afterPagination.map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m3",
      "m4",
    ]);

    // prepend 감지
    const { prependedCount, firstItemIndex } = detectPrepend(
      initial,
      afterPagination,
      0
    );
    expect(prependedCount).toBe(2); // m1, m2가 앞에 추가됨
    expect(firstItemIndex).toBe(10_000 - 2);

    // 전체 그룹핑 재계산 (pagination → full recompute)
    const regrouped = processMessagesWithGrouping(afterPagination);

    // m1: 그룹 시작, 날짜 구분선
    expect(regrouped[0].grouping.showDateDivider).toBe(true);
    expect(regrouped[0].grouping.showName).toBe(true);

    // m2: m1과 그룹핑 (같은 sender, 30초 차이)
    expect(regrouped[1].grouping.isGrouped).toBe(true);

    // m3: m2와 90초 차이 → 그룹핑 안 됨
    expect(regrouped[2].grouping.isGrouped).toBe(false);
    expect(regrouped[2].grouping.showName).toBe(true);
  });

  it("Virtuoso firstItemIndex가 누적 prepend를 정확히 반영", () => {
    // 시뮬레이션: 3번의 backward pagination

    // 초기
    const p0 = [makeMessage({ id: "m7" }), makeMessage({ id: "m8" })];
    let state = { messages: p0, prependedCount: 0 };

    // 1차 pagination: m5, m6 prepend
    const p1 = [
      makeMessage({ id: "m5" }),
      makeMessage({ id: "m6" }),
      ...state.messages,
    ];
    const r1 = detectPrepend(state.messages, p1, state.prependedCount);
    expect(r1.prependedCount).toBe(2);
    expect(r1.firstItemIndex).toBe(10_000 - 2);
    state = { messages: p1, prependedCount: r1.prependedCount };

    // 2차 pagination: m3, m4 prepend
    const p2 = [
      makeMessage({ id: "m3" }),
      makeMessage({ id: "m4" }),
      ...state.messages,
    ];
    const r2 = detectPrepend(state.messages, p2, state.prependedCount);
    expect(r2.prependedCount).toBe(4);
    expect(r2.firstItemIndex).toBe(10_000 - 4);
    state = { messages: p2, prependedCount: r2.prependedCount };

    // 3차 pagination: m1, m2 prepend
    const p3 = [
      makeMessage({ id: "m1" }),
      makeMessage({ id: "m2" }),
      ...state.messages,
    ];
    const r3 = detectPrepend(state.messages, p3, state.prependedCount);
    expect(r3.prependedCount).toBe(6);
    expect(r3.firstItemIndex).toBe(10_000 - 6);

    // 최종: 8개 메시지, firstItemIndex = 9994
    // Virtuoso에서 인덱스 범위: 9994 ~ 10001
    expect(p3.length).toBe(8);
  });
});
