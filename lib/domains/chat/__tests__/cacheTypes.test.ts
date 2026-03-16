import { describe, it, expect, beforeEach } from "vitest";
import {
  addMessageToFirstPage,
  replaceMessageInFirstPage,
  removeMessageFromCache,
  updateMessageInCache,
  decrementReadCountsForReceipt,
  findMessageInCache,
} from "../cacheTypes";
import { makeMessage, makePage, makeCache, resetCounter } from "./helpers";

beforeEach(() => resetCounter());

describe("addMessageToFirstPage", () => {
  it("빈 캐시 → 초기 페이지 구조 생성", () => {
    const msg = makeMessage({ id: "m1", readCount: 3 });
    const result = addMessageToFirstPage(undefined, msg);

    expect(result?.pages).toHaveLength(1);
    expect(result?.pages[0].messages).toHaveLength(1);
    expect(result?.pages[0].messages[0].id).toBe("m1");
    expect(result?.pages[0].readCounts).toEqual({ m1: 3 });
  });

  it("기존 캐시 → 첫 페이지 끝에 추가", () => {
    const existing = makeCache([
      makePage([makeMessage({ id: "m1" }), makeMessage({ id: "m2" })]),
    ]);
    const newMsg = makeMessage({ id: "m3" });
    const result = addMessageToFirstPage(existing, newMsg);

    expect(result?.pages[0].messages).toHaveLength(3);
    expect(result?.pages[0].messages[2].id).toBe("m3");
  });

  it("readCount가 있는 메시지 → readCounts 딕셔너리에도 반영", () => {
    const existing = makeCache([makePage([makeMessage({ id: "m1" })])]);
    const newMsg = makeMessage({ id: "m2", readCount: 5 });
    const result = addMessageToFirstPage(existing, newMsg);

    expect(result?.pages[0].readCounts["m2"]).toBe(5);
  });

  it("다른 페이지는 변경 안 됨", () => {
    const page1 = makePage([makeMessage({ id: "m1" })]);
    const page2 = makePage([makeMessage({ id: "m0" })]);
    const existing = makeCache([page1, page2]);
    const result = addMessageToFirstPage(
      existing,
      makeMessage({ id: "m2" })
    );

    // 두 번째 페이지는 동일 참조
    expect(result?.pages[1]).toBe(page2);
  });
});

describe("replaceMessageInFirstPage", () => {
  it("tempId → realId 교체", () => {
    const tempMsg = makeMessage({ id: "temp-1", content: "Hello", readCount: 2 });
    const cache = makeCache([makePage([tempMsg])]);

    const result = replaceMessageInFirstPage(cache, "temp-1", {
      id: "real-1",
    });

    const msg = result?.pages[0].messages[0];
    expect(msg?.id).toBe("real-1");
    expect(msg?.status).toBe("sent");
    // readCount 보존
    expect(msg?.readCount).toBe(2);
  });

  it("readCounts 딕셔너리에서도 tempId → realId 이관", () => {
    const tempMsg = makeMessage({ id: "temp-1", readCount: 3 });
    const cache = makeCache([
      makePage([tempMsg], { readCounts: { "temp-1": 3 } }),
    ]);

    const result = replaceMessageInFirstPage(cache, "temp-1", {
      id: "real-1",
    });

    expect(result?.pages[0].readCounts["real-1"]).toBe(3);
    expect(result?.pages[0].readCounts["temp-1"]).toBeUndefined();
  });

  it("존재하지 않는 tempId → 변경 없이 반환", () => {
    const cache = makeCache([
      makePage([makeMessage({ id: "m1" })]),
    ]);
    const result = replaceMessageInFirstPage(cache, "nonexistent", {
      id: "real-1",
    });
    expect(result).toBe(cache);
  });
});

describe("removeMessageFromCache", () => {
  it("메시지 제거", () => {
    const cache = makeCache([
      makePage([makeMessage({ id: "m1" }), makeMessage({ id: "m2" })]),
    ]);
    const result = removeMessageFromCache(cache, "m1");
    expect(result?.pages[0].messages).toHaveLength(1);
    expect(result?.pages[0].messages[0].id).toBe("m2");
  });

  it("여러 페이지에서 동일 ID 제거", () => {
    const cache = makeCache([
      makePage([makeMessage({ id: "m1" }), makeMessage({ id: "m2" })]),
      makePage([makeMessage({ id: "m1" }), makeMessage({ id: "m0" })]),
    ]);
    const result = removeMessageFromCache(cache, "m1");
    expect(result?.pages[0].messages).toHaveLength(1);
    expect(result?.pages[1].messages).toHaveLength(1);
  });
});

describe("updateMessageInCache", () => {
  it("특정 메시지의 content 수정", () => {
    const cache = makeCache([
      makePage([
        makeMessage({ id: "m1", content: "old" }),
        makeMessage({ id: "m2" }),
      ]),
    ]);
    const result = updateMessageInCache(cache, "m1", (m) => ({
      ...m,
      content: "new",
    }));

    expect(result?.pages[0].messages[0].content).toBe("new");
    expect(result?.pages[0].messages[1].content).not.toBe("new");
  });
});

describe("decrementReadCountsForReceipt", () => {
  it("시간 범위 내 본인 메시지의 readCount 감소", () => {
    const cache = makeCache([
      makePage([
        makeMessage({
          id: "m1",
          sender_id: "me",
          created_at: "2026-03-16T10:00:00Z",
          readCount: 3,
        }),
        makeMessage({
          id: "m2",
          sender_id: "me",
          created_at: "2026-03-16T10:01:00Z",
          readCount: 3,
        }),
        makeMessage({
          id: "m3",
          sender_id: "other",
          created_at: "2026-03-16T10:02:00Z",
          readCount: 2,
        }),
      ]),
    ]);

    const result = decrementReadCountsForReceipt(
      cache,
      "me",
      "2026-03-16T10:01:30Z", // readAt
      "2026-03-16T09:59:00Z"  // prevReadAt
    );

    // m1: sender=me, 10:00 > prevReadAt(09:59) && 10:00 <= readAt(10:01:30) → 감소
    expect(result?.pages[0].messages[0].readCount).toBe(2);
    // m2: sender=me, 10:01 > prevReadAt(09:59) && 10:01 <= readAt(10:01:30) → 감소
    expect(result?.pages[0].messages[1].readCount).toBe(2);
    // m3: sender=other → 변경 없음
    expect(result?.pages[0].messages[2].readCount).toBe(2);
  });

  it("시간 범위 밖 메시지는 변경 안 됨", () => {
    const cache = makeCache([
      makePage([
        makeMessage({
          id: "m1",
          sender_id: "me",
          created_at: "2026-03-16T09:00:00Z",
          readCount: 3,
        }),
      ]),
    ]);

    const result = decrementReadCountsForReceipt(
      cache,
      "me",
      "2026-03-16T10:01:00Z",
      "2026-03-16T10:00:00Z" // m1의 created_at(09:00)은 prevReadAt(10:00) 이전
    );

    // 변경 없으면 원본 반환
    expect(result).toBe(cache);
  });

  it("readCount가 0이면 더 이상 감소하지 않음", () => {
    const cache = makeCache([
      makePage([
        makeMessage({
          id: "m1",
          sender_id: "me",
          created_at: "2026-03-16T10:00:00Z",
          readCount: 0,
        }),
      ]),
    ]);

    const result = decrementReadCountsForReceipt(
      cache,
      "me",
      "2026-03-16T10:01:00Z",
      "2026-03-16T09:00:00Z"
    );

    expect(result).toBe(cache); // 변경 없음
  });
});

describe("findMessageInCache", () => {
  it("여러 페이지에서 메시지 찾기", () => {
    const cache = makeCache([
      makePage([makeMessage({ id: "m3" })]),
      makePage([makeMessage({ id: "m1" }), makeMessage({ id: "m2" })]),
    ]);

    expect(findMessageInCache(cache, "m2")?.id).toBe("m2");
    expect(findMessageInCache(cache, "nonexistent")).toBeUndefined();
  });
});
