/**
 * Backward Pagination 깜빡임 원인 분석 테스트
 *
 * 채팅방에서 위로 스크롤하여 이전 대화를 로드할 때 발생하는
 * 깜빡임/점프 현상의 근본 원인을 검증합니다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { processMessagesWithGrouping } from "../messageGrouping";
import type { ChatMessageWithGrouping } from "../types";
import {
  makeMessage,
  makePage,
  mergePages,
  resetCounter,
} from "./helpers";
import type { CacheMessage, MessagesPage } from "../cacheTypes";

beforeEach(() => resetCounter());

// ============================================
// allMessages 병합 시 객체 참조 안정성 테스트
// ============================================
describe("allMessages 병합 — 객체 참조 안정성", () => {
  it("readCount가 dict에만 있어도 mergePages 자체는 매번 새 객체 (순수 함수)", () => {
    // mergePages는 테스트 헬퍼 (순수 함수)이므로 매번 새 객체.
    // 실제 useChatRoomLogic에서는 rcCacheRef로 캐싱하여 참조 안정성 확보.
    const msg = makeMessage({ id: "m1" });
    delete (msg as Partial<CacheMessage>).readCount;
    const page = makePage([msg], { readCounts: { m1: 3 } });

    const result1 = mergePages([page]);
    const result2 = mergePages([page]);

    // 순수 함수 mergePages는 매번 새 객체 (캐싱 없음)
    expect(result1[0]).not.toBe(result2[0]);
    // 실제 코드에서는 rcCacheRef가 동일 (msg, rc) 조합을 캐싱하여 동일 참조 반환
  });

  it("readCount가 메시지 자체에 있으면 동일 참조 유지", () => {
    const msg = makeMessage({ id: "m1", readCount: 3 });
    const page = makePage([msg]);

    const result1 = mergePages([page]);
    const result2 = mergePages([page]);

    // readCount가 이미 메시지에 있으므로 새 객체 생성 불필요
    expect(result1[0]).toBe(result2[0]); // 동일 참조 ✅
  });

  it("backward pagination 시 기존 메시지의 참조 (mergePages 순수 함수 한계)", () => {
    // 초기: page0에 m3, m4 (readCount는 dict에만)
    const m3 = makeMessage({ id: "m3", created_at: "2026-03-16T10:02:00Z" });
    const m4 = makeMessage({ id: "m4", created_at: "2026-03-16T10:03:00Z" });
    delete (m3 as Partial<CacheMessage>).readCount;
    delete (m4 as Partial<CacheMessage>).readCount;

    const page0 = makePage([m3, m4], { readCounts: { m3: 2, m4: 1 } });
    const before = mergePages([page0]);

    // backward pagination: m1, m2 로드 (새 oldest page)
    const m1 = makeMessage({ id: "m1", created_at: "2026-03-16T10:00:00Z" });
    const m2 = makeMessage({ id: "m2", created_at: "2026-03-16T10:01:00Z" });
    const page1 = makePage([m1, m2]);
    const after = mergePages([page0, page1]);

    expect(after.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);

    // ⚠️ m3, m4는 변경되지 않았는데도 새 객체
    // → processMessagesWithGrouping의 fast-path가 작동하지 않음
    expect(after[2]).not.toBe(before[0]); // m3: 다른 참조! (BUG)
    expect(after[3]).not.toBe(before[1]); // m4: 다른 참조! (BUG)
  });
});

// ============================================
// messagesWithGrouping — prepend 시 fast-path 부재 테스트
// ============================================
describe("messagesWithGrouping — backward pagination 전체 재계산 문제", () => {
  /**
   * messagesWithGrouping의 fast-path 조건 확인:
   * - fast-path 1: 같은 길이 + 같은 first/last ID → 비그룹핑 필드 패치
   * - fast-path 2: 뒤에 1-3개 추가 → tail 재계산
   * - 둘 다 해당 안 되면: 전체 재계산 (processMessagesWithGrouping)
   *
   * backward pagination은 앞에 메시지가 추가되므로 두 fast-path 모두 적용 불가.
   */

  it("backward pagination → prepend fast-path 적용 가능 조건 확인", () => {
    // 초기 상태: [m3, m4]
    const prev = [
      makeMessage({ id: "m3", sender_id: "A", created_at: "2026-03-16T10:02:00Z" }),
      makeMessage({ id: "m4", sender_id: "B", created_at: "2026-03-16T10:03:00Z" }),
    ];
    const prevGrouped = processMessagesWithGrouping(prev);

    // backward pagination 후: [m1, m2, m3, m4]
    const allMessages = [
      makeMessage({ id: "m1", sender_id: "A", created_at: "2026-03-16T10:00:00Z" }),
      makeMessage({ id: "m2", sender_id: "A", created_at: "2026-03-16T10:01:00Z" }),
      ...prev,
    ];

    // prepend fast-path 조건: 마지막 ID 동일 + 첫 ID 다름
    const isPrepend =
      allMessages[allMessages.length - 1]?.id === prev[prev.length - 1]?.id &&
      allMessages[0]?.id !== prev[0]?.id;
    expect(isPrepend).toBe(true);

    // prepend 개수 계산
    const prependCount = allMessages.findIndex((m) => m.id === prev[0]?.id);
    expect(prependCount).toBe(2); // m1, m2가 prepend됨

    // prepend fast-path 적용: head + 경계 재계산, 나머지 재사용
    const regroupEnd = prependCount + 1;
    const headGrouped = processMessagesWithGrouping(allMessages.slice(0, regroupEnd));

    // 경계 메시지(m3) 그룹핑 비교
    const newFirstGrouping = headGrouped[headGrouped.length - 1].grouping;

    // m4는 동일 참조 재사용 가능
    expect(prevGrouped[1].id).toBe("m4");
    // m4의 그룹핑은 prepend에 의해 변경되지 않음
  });

  it("전체 재계산 → Virtuoso가 모든 visible 아이템을 리렌더", () => {
    // 20개 메시지로 현실적 시나리오 시뮬레이션
    const initialMessages = Array.from({ length: 20 }, (_, i) =>
      makeMessage({
        id: `m${i + 21}`,
        sender_id: i % 3 === 0 ? "A" : "B",
        created_at: new Date(Date.UTC(2026, 2, 16, 10, i)).toISOString(),
      })
    );

    const prevGrouped = processMessagesWithGrouping(initialMessages);

    // backward pagination: 20개 더 로드
    const olderMessages = Array.from({ length: 20 }, (_, i) =>
      makeMessage({
        id: `m${i + 1}`,
        sender_id: i % 3 === 0 ? "A" : "B",
        created_at: new Date(Date.UTC(2026, 2, 16, 9, i)).toISOString(),
      })
    );

    const allMessages = [...olderMessages, ...initialMessages];
    const fullResult = processMessagesWithGrouping(allMessages);

    // 기존 20개 메시지(index 20-39)의 grouping이 동일한지 확인
    let identicalGroupingCount = 0;
    let changedGroupingCount = 0;

    for (let i = 0; i < initialMessages.length; i++) {
      const prevG = prevGrouped[i].grouping;
      const newG = fullResult[i + 20].grouping;

      // grouping 내용 비교 (참조가 아닌 값)
      const isSame =
        prevG.showName === newG.showName &&
        prevG.showTime === newG.showTime &&
        prevG.isGrouped === newG.isGrouped &&
        prevG.showDateDivider === newG.showDateDivider;

      if (isSame) identicalGroupingCount++;
      else changedGroupingCount++;
    }

    // 기존 메시지의 대부분은 grouping이 동일 (첫 메시지만 날짜 구분선이 바뀔 수 있음)
    // 하지만 전체 재계산으로 인해 모든 메시지가 새 객체로 생성됨
    expect(identicalGroupingCount).toBeGreaterThan(15); // 대부분 그룹핑 동일

    // ⚠️ 핵심: 그룹핑이 동일해도 새 객체이므로 Virtuoso는 모든 아이템을 리렌더
    // → 이것이 backward pagination 시 깜빡임의 원인
    for (let i = 0; i < initialMessages.length; i++) {
      expect(fullResult[i + 20]).not.toBe(prevGrouped[i]); // 항상 새 객체
    }
  });

  it("prepend fast-path가 있다면: 기존 메시지의 grouping을 재사용할 수 있음", () => {
    // 이상적인 prepend fast-path 구현을 시뮬레이션

    const existing = [
      makeMessage({ id: "m3", sender_id: "A", created_at: "2026-03-16T10:02:00Z" }),
      makeMessage({ id: "m4", sender_id: "B", created_at: "2026-03-16T10:03:00Z" }),
    ];
    const prevGrouped = processMessagesWithGrouping(existing);

    const prepended = [
      makeMessage({ id: "m1", sender_id: "A", created_at: "2026-03-16T10:00:00Z" }),
      makeMessage({ id: "m2", sender_id: "A", created_at: "2026-03-16T10:01:00Z" }),
    ];
    const allMessages = [...prepended, ...existing];

    // === 이상적인 prepend fast-path ===
    // 1. prepend 감지: first ID 변경, last ID 동일
    const isPrepend =
      allMessages[allMessages.length - 1]?.id === existing[existing.length - 1]?.id &&
      allMessages[0]?.id !== existing[0]?.id;
    expect(isPrepend).toBe(true);

    // 2. prepend 개수 계산
    const prependCount = allMessages.findIndex((m) => m.id === existing[0]?.id);
    expect(prependCount).toBe(2);

    // 3. head(prepend된 부분) + 경계 1개 재계산
    const regroupEnd = prependCount + 1; // 경계 메시지 1개 포함
    const headMessages = allMessages.slice(0, regroupEnd);
    const headGrouped = processMessagesWithGrouping(headMessages);

    // 4. head의 마지막 메시지(경계)가 기존 첫 메시지와 같은 날이면 날짜 구분선 제거
    // (이미 processMessagesWithGrouping에서 처리됨)

    // 5. 기존 그룹핑에서 첫 메시지의 grouping만 업데이트 (경계 효과)
    const existingFirstGrouping = prevGrouped[0].grouping;
    const newFirstGrouping = headGrouped[headGrouped.length - 1].grouping;

    // 경계 메시지의 그룹핑이 변경되었는지 확인
    const firstGroupingChanged =
      existingFirstGrouping.showName !== newFirstGrouping.showName ||
      existingFirstGrouping.isGrouped !== newFirstGrouping.isGrouped ||
      existingFirstGrouping.showDateDivider !== newFirstGrouping.showDateDivider;

    // 6. 결과 조합
    const result: ChatMessageWithGrouping[] = [
      ...headGrouped.slice(0, -1), // prepend된 메시지들 (마지막 제외)
      firstGroupingChanged
        ? { ...prevGrouped[0], grouping: newFirstGrouping }
        : prevGrouped[0], // 경계 메시지: 변경 시만 새 객체
      ...prevGrouped.slice(1), // 나머지 기존 메시지: 동일 참조 재사용
    ];

    // 검증: 결과가 전체 재계산과 동일한 grouping을 가짐
    const fullResult = processMessagesWithGrouping(allMessages);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].grouping.showName).toBe(fullResult[i].grouping.showName);
      expect(result[i].grouping.showTime).toBe(fullResult[i].grouping.showTime);
      expect(result[i].grouping.isGrouped).toBe(fullResult[i].grouping.isGrouped);
      expect(result[i].grouping.showDateDivider).toBe(fullResult[i].grouping.showDateDivider);
    }

    // ✅ 핵심: 기존 메시지(m4)는 동일 참조 → Virtuoso 리렌더 안 함
    expect(result[3]).toBe(prevGrouped[1]); // m4: 동일 참조!
  });
});

// ============================================
// 연쇄 반응 체인 테스트: 전체 깜빡임 경로
// ============================================
describe("깜빡임 전체 경로 (page merge → grouping → Virtuoso)", () => {
  it("backward pagination 깜빡임 경로 전체 추적", () => {
    // === Step 1: 초기 상태 (page0만 로드) ===
    const m3 = makeMessage({
      id: "m3", sender_id: "A",
      created_at: "2026-03-16T10:02:00Z",
    });
    const m4 = makeMessage({
      id: "m4", sender_id: "B",
      created_at: "2026-03-16T10:03:00Z",
    });
    // 서버에서 가져온 메시지: readCount는 dict에만 있음
    delete (m3 as Partial<CacheMessage>).readCount;
    delete (m4 as Partial<CacheMessage>).readCount;

    const page0 = makePage([m3, m4], { readCounts: { m3: 2, m4: 1 } });

    const allMsgs1 = mergePages([page0]);
    const grouped1 = processMessagesWithGrouping(allMsgs1);
    expect(grouped1).toHaveLength(2);

    // === Step 2: backward pagination (page1 로드) ===
    const m1 = makeMessage({
      id: "m1", sender_id: "A",
      created_at: "2026-03-16T10:00:00Z",
    });
    const m2 = makeMessage({
      id: "m2", sender_id: "A",
      created_at: "2026-03-16T10:01:00Z",
    });
    const page1 = makePage([m1, m2]);

    const allMsgs2 = mergePages([page0, page1]);
    expect(allMsgs2.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);

    // === Step 3: 깜빡임 원인 분석 ===

    // 원인 1: allMessages에서 m3, m4가 새 객체 (readCount dict → embed)
    const m3InResult = allMsgs2.find((m) => m.id === "m3")!;
    const m3Original = allMsgs1.find((m) => m.id === "m3")!;
    expect(m3InResult).not.toBe(m3Original); // 새 객체! (readCount embed 때문)

    // 원인 2: fast-path 모두 실패 → 전체 재계산
    const grouped2 = processMessagesWithGrouping(allMsgs2);

    // 원인 3: 기존 m3, m4가 새 객체로 교체 → Virtuoso 리렌더
    expect(grouped2[2]).not.toBe(grouped1[0]); // m3: 새 객체
    expect(grouped2[3]).not.toBe(grouped1[1]); // m4: 새 객체

    // 원인 4: m3의 grouping은 실제로 변경됨 (날짜 구분선 제거)
    // 전체 재계산 전: m3는 첫 메시지 → showDateDivider=true
    expect(grouped1[0].grouping.showDateDivider).toBe(true);
    // 전체 재계산 후: m3 앞에 m1, m2가 추가 → showDateDivider=false
    expect(grouped2[2].grouping.showDateDivider).toBe(false);

    // 원인 5: m4의 grouping은 변경 안 됨 (하지만 새 객체이므로 리렌더)
    expect(grouped1[1].grouping.showName).toBe(grouped2[3].grouping.showName);
    expect(grouped1[1].grouping.showTime).toBe(grouped2[3].grouping.showTime);
    expect(grouped1[1].grouping.isGrouped).toBe(grouped2[3].grouping.isGrouped);
    // grouping 값은 동일하지만 객체 참조가 다르므로 memo 비교 실패 → 리렌더
  });
});
