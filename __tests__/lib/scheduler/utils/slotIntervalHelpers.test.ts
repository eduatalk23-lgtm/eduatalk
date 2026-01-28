import { describe, it, expect } from "vitest";
import {
  findFirstFreeGap,
  findLargestFreeGap,
  insertOccupiedInterval,
  buildOccupiedIntervals,
} from "@/lib/scheduler/utils/slotIntervalHelpers";

describe("slotIntervalHelpers", () => {
  describe("findFirstFreeGap", () => {
    it("빈 슬롯에서 시작 위치 반환", () => {
      const result = findFirstFreeGap(600, 1140, [], 30);
      expect(result).toBe(600); // 10:00
    });

    it("슬롯 시작 부분에 gap이 있으면 해당 위치 반환", () => {
      // 슬롯 10:00-19:00, 기존 플랜 10:30-11:00
      const occupied: [number, number][] = [[630, 660]];
      const result = findFirstFreeGap(600, 1140, occupied, 30);
      expect(result).toBe(600); // 10:00 (10:00-10:30 gap에 배치)
    });

    it("슬롯 중간에 gap이 있으면 해당 위치 반환", () => {
      // 슬롯 10:00-12:00, 점유: 10:00-10:30, 11:00-11:30
      const occupied: [number, number][] = [
        [600, 630],
        [660, 690],
      ];
      // 30분짜리 gap: 10:30-11:00, 11:30-12:00
      const result = findFirstFreeGap(600, 720, occupied, 30);
      expect(result).toBe(630); // 10:30
    });

    it("슬롯 끝부분에만 gap이 있으면 해당 위치 반환", () => {
      // 슬롯 10:00-12:00, 점유: 10:00-11:30
      const occupied: [number, number][] = [[600, 690]];
      const result = findFirstFreeGap(600, 720, occupied, 30);
      expect(result).toBe(690); // 11:30
    });

    it("충분한 gap이 없으면 null 반환", () => {
      // 슬롯 10:00-11:00, 점유: 10:00-10:30, 10:40-11:00 (gap 10분만)
      const occupied: [number, number][] = [
        [600, 630],
        [640, 660],
      ];
      const result = findFirstFreeGap(600, 660, occupied, 30);
      expect(result).toBeNull();
    });

    it("슬롯이 완전히 점유되면 null 반환", () => {
      const occupied: [number, number][] = [[600, 720]];
      const result = findFirstFreeGap(600, 720, occupied, 30);
      expect(result).toBeNull();
    });

    it("requiredMinutes가 0이면 첫 빈 위치 반환", () => {
      // 슬롯 시작이 점유되어 있으면 점유 구간 끝부터
      const occupied: [number, number][] = [[600, 630]];
      const result = findFirstFreeGap(600, 720, occupied, 0);
      expect(result).toBe(630);
    });
  });

  describe("findLargestFreeGap", () => {
    it("빈 슬롯에서 전체 슬롯 크기 반환", () => {
      const result = findLargestFreeGap(600, 720, []);
      expect(result).toEqual({ start: 600, size: 120 });
    });

    it("여러 gap 중 가장 큰 것 반환", () => {
      // 슬롯 10:00-13:00, 점유: 10:30-11:00 (gap: 30, 120)
      const occupied: [number, number][] = [[630, 660]];
      const result = findLargestFreeGap(600, 780, occupied);
      expect(result).toEqual({ start: 660, size: 120 }); // 11:00-13:00
    });

    it("슬롯이 완전히 점유되면 null 반환", () => {
      const occupied: [number, number][] = [[600, 720]];
      const result = findLargestFreeGap(600, 720, occupied);
      expect(result).toBeNull();
    });

    it("동일 크기 gap에서 첫 번째 반환", () => {
      // 점유: 10:30-11:00, 11:30-12:00 (gap 30, 30, 60)
      const occupied: [number, number][] = [
        [630, 660],
        [690, 720],
      ];
      // gaps: 10:00-10:30(30), 11:00-11:30(30), 12:00-13:00(60)
      const result = findLargestFreeGap(600, 780, occupied);
      expect(result).toEqual({ start: 720, size: 60 });
    });
  });

  describe("insertOccupiedInterval", () => {
    it("빈 배열에 삽입", () => {
      const result = insertOccupiedInterval([], 600, 630);
      expect(result).toEqual([[600, 630]]);
    });

    it("기존 구간 앞에 삽입", () => {
      const result = insertOccupiedInterval([[660, 720]], 600, 630);
      expect(result).toEqual([
        [600, 630],
        [660, 720],
      ]);
    });

    it("기존 구간 뒤에 삽입", () => {
      const result = insertOccupiedInterval([[600, 630]], 660, 720);
      expect(result).toEqual([
        [600, 630],
        [660, 720],
      ]);
    });

    it("겹치는 구간 병합", () => {
      const result = insertOccupiedInterval([[600, 660]], 630, 720);
      expect(result).toEqual([[600, 720]]);
    });

    it("인접 구간 병합", () => {
      const result = insertOccupiedInterval([[600, 630]], 630, 660);
      // 인접 구간 (e < merged[0]가 아니고 s > merged[1]도 아니므로 병합)
      expect(result).toEqual([[600, 660]]);
    });

    it("여러 구간을 한번에 병합", () => {
      const intervals: [number, number][] = [
        [600, 620],
        [640, 660],
        [680, 700],
      ];
      // 620-680 범위를 삽입하면 첫 두 구간과 병합
      const result = insertOccupiedInterval(intervals, 620, 680);
      expect(result).toEqual([
        [600, 700],
      ]);
    });

    it("원본 배열을 변경하지 않음", () => {
      const original: [number, number][] = [[600, 630]];
      insertOccupiedInterval(original, 660, 720);
      expect(original).toEqual([[600, 630]]);
    });
  });

  describe("buildOccupiedIntervals", () => {
    it("기존 플랜이 없으면 빈 배열 반환", () => {
      const result = buildOccupiedIntervals(600, 720, []);
      expect(result).toEqual([]);
    });

    it("슬롯 내 플랜을 구간으로 변환", () => {
      const plans = [
        { start_time: "10:30", end_time: "11:00" },
        { start_time: "11:30", end_time: "12:00" },
      ];
      const result = buildOccupiedIntervals(600, 720, plans);
      expect(result).toEqual([
        [630, 660],
        [690, 720],
      ]);
    });

    it("슬롯 경계로 클리핑", () => {
      // 플랜이 슬롯을 벗어나는 경우
      const plans = [
        { start_time: "09:00", end_time: "10:30" }, // 슬롯 시작 전부터
        { start_time: "11:30", end_time: "13:00" }, // 슬롯 끝 이후까지
      ];
      const result = buildOccupiedIntervals(600, 720, plans);
      expect(result).toEqual([
        [600, 630], // 10:00-10:30으로 클리핑
        [690, 720], // 11:30-12:00으로 클리핑
      ]);
    });

    it("슬롯 범위 밖 플랜은 무시", () => {
      const plans = [
        { start_time: "08:00", end_time: "09:00" }, // 완전히 밖
        { start_time: "13:00", end_time: "14:00" }, // 완전히 밖
      ];
      const result = buildOccupiedIntervals(600, 720, plans);
      expect(result).toEqual([]);
    });

    it("겹치는 플랜 구간 병합", () => {
      const plans = [
        { start_time: "10:00", end_time: "11:00" },
        { start_time: "10:30", end_time: "11:30" }, // 겹침
      ];
      const result = buildOccupiedIntervals(600, 720, plans);
      expect(result).toEqual([[600, 690]]);
    });

    it("정렬되지 않은 플랜도 올바르게 처리", () => {
      const plans = [
        { start_time: "11:00", end_time: "11:30" },
        { start_time: "10:00", end_time: "10:30" },
      ];
      const result = buildOccupiedIntervals(600, 720, plans);
      expect(result).toEqual([
        [600, 630],
        [660, 690],
      ]);
    });
  });

  describe("원본 버그 시나리오", () => {
    it("기존 플랜이 슬롯 중간에 있을 때 앞쪽 gap에 배치", () => {
      // 슬롯: 10:00-19:00 (600-1140), 기존 플랜: 10:30-11:00 (630-660)
      const slotStart = 600; // 10:00
      const slotEnd = 1140; // 19:00
      const occupied: [number, number][] = [[630, 660]]; // 10:30-11:00

      // 30분짜리 새 플랜 배치
      const gapStart = findFirstFreeGap(slotStart, slotEnd, occupied, 30);

      // 기대: 10:00-10:30 gap에 배치 (기존 버그: 10:30 시작으로 겹침 발생)
      expect(gapStart).toBe(600); // 10:00
      expect(gapStart).not.toBe(630); // 10:30이 아님 (기존 버그 시나리오)
    });

    it("여러 기존 플랜 사이의 gap에 올바르게 배치", () => {
      // 슬롯: 10:00-12:00, 기존 플랜: 10:00-10:30, 11:00-11:30
      const slotStart = 600;
      const slotEnd = 720;
      const occupied: [number, number][] = [
        [600, 630],
        [660, 690],
      ];

      // 첫 번째 30분 gap: 10:30-11:00
      const gap1 = findFirstFreeGap(slotStart, slotEnd, occupied, 30);
      expect(gap1).toBe(630); // 10:30

      // 배치 후 구간 업데이트
      const updated = insertOccupiedInterval(occupied, 630, 660);
      expect(updated).toEqual([
        [600, 690],
      ]);

      // 다음 gap: 11:30-12:00
      const gap2 = findFirstFreeGap(slotStart, slotEnd, updated, 30);
      expect(gap2).toBe(690); // 11:30
    });
  });
});
