import { describe, it, expect, beforeEach } from "vitest";
import { operationTracker } from "../operationTracker";

describe("operationTracker.findPendingSendByContent", () => {
  beforeEach(() => {
    operationTracker.clearAll();
  });

  it("같은 방·같은 content 가 1건 pending 일 때 해당 tempId 반환", () => {
    operationTracker.startSend("temp-1", "안녕하세요", "room-A");
    expect(operationTracker.findPendingSendByContent("안녕하세요", "room-A")).toBe(
      "temp-1"
    );
  });

  it("다른 방의 동일 content 는 매칭하지 않음", () => {
    operationTracker.startSend("temp-1", "안녕", "room-A");
    expect(operationTracker.findPendingSendByContent("안녕", "room-B")).toBeUndefined();
  });

  it("같은 방·같은 content 다중 pending 일 때 가장 먼저 시작된 tempId 반환 (FIFO)", () => {
    operationTracker.startSend("temp-old", "ping", "room-A");
    // startedAt 차이를 만들기 위해 약간의 타임라인 진행
    const before = Date.now();
    while (Date.now() === before) {
      // busy-wait 1ms
    }
    operationTracker.startSend("temp-new", "ping", "room-A");

    expect(operationTracker.findPendingSendByContent("ping", "room-A")).toBe(
      "temp-old"
    );
  });

  it("첫 pending 을 completeSend 처리하면 두 번째 호출은 다음 pending 을 반환", () => {
    operationTracker.startSend("temp-1", "ping", "room-A");
    const before = Date.now();
    while (Date.now() === before) {
      /* 1ms 대기 */
    }
    operationTracker.startSend("temp-2", "ping", "room-A");

    const first = operationTracker.findPendingSendByContent("ping", "room-A");
    expect(first).toBe("temp-1");
    operationTracker.completeSend(first!, "real-1");

    const second = operationTracker.findPendingSendByContent("ping", "room-A");
    expect(second).toBe("temp-2");
  });

  it("매치되는 pending 이 없으면 undefined", () => {
    expect(
      operationTracker.findPendingSendByContent("nothing", "room-A")
    ).toBeUndefined();
  });
});
