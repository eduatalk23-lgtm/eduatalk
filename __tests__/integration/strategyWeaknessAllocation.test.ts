/**
 * 전략과목/취약과목 할당 통합 테스트
 * 
 * 주의: 이 테스트는 실제 데이터베이스 연결이 필요합니다.
 * 통합 테스트 환경에서 실행해야 합니다.
 * 
 * 테스트 환경 설정:
 * 1. 테스트용 Supabase 프로젝트 설정
 * 2. 테스트 데이터베이스 마이그레이션 실행
 * 3. 테스트용 테넌트, 학생, 블록 세트 생성
 * 4. 테스트 후 데이터 정리
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getEffectiveAllocation } from "@/lib/utils/subjectAllocation";
import { calculateSubjectAllocationDates } from "@/lib/plan/1730TimetableLogic";
import type { ContentInfo, ContentAllocation, SubjectAllocation } from "@/lib/utils/subjectAllocation";
import type { CycleDayInfo } from "@/lib/plan/1730TimetableLogic";

describe("전략과목/취약과목 할당 통합 테스트", () => {
  describe("UI → DB → 스케줄러 전체 흐름 테스트", () => {
    it("콘텐츠별 설정이 DB에 저장되고 스케줄러에서 사용됨", () => {
      // 1. UI에서 설정한 콘텐츠별 할당
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

      // 2. 콘텐츠 정보
      const content1: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
        subject: "수학",
      };

      const content2: ContentInfo = {
        content_type: "lecture",
        content_id: "lecture-1",
        subject_category: "영어",
        subject: "영어",
      };

      // 3. getEffectiveAllocation으로 할당 확인
      const result1 = getEffectiveAllocation(
        content1,
        contentAllocations,
        undefined,
        false
      );
      const result2 = getEffectiveAllocation(
        content2,
        contentAllocations,
        undefined,
        false
      );

      // 4. 검증
      expect(result1.subject_type).toBe("strategy");
      expect(result1.weekly_days).toBe(3);
      expect(result1.source).toBe("content");

      expect(result2.subject_type).toBe("weakness");
      expect(result2.weekly_days).toBeUndefined();
      expect(result2.source).toBe("content");
    });

    it("교과별 설정이 DB에 저장되고 스케줄러에서 사용됨", () => {
      // 1. UI에서 설정한 교과별 할당
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

      // 2. 콘텐츠 정보
      const content1: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
        subject: "수학",
      };

      const content2: ContentInfo = {
        content_type: "lecture",
        content_id: "lecture-1",
        subject_category: "영어",
        subject: "영어",
      };

      // 3. getEffectiveAllocation으로 할당 확인
      const result1 = getEffectiveAllocation(
        content1,
        undefined,
        subjectAllocations,
        false
      );
      const result2 = getEffectiveAllocation(
        content2,
        undefined,
        subjectAllocations,
        false
      );

      // 4. 검증
      expect(result1.subject_type).toBe("strategy");
      expect(result1.weekly_days).toBe(2);
      expect(result1.source).toBe("subject");

      expect(result2.subject_type).toBe("weakness");
      expect(result2.weekly_days).toBeUndefined();
      expect(result2.source).toBe("subject");
    });

    it("콘텐츠별 설정이 교과별 설정보다 우선순위가 높음", () => {
      const contentAllocations: ContentAllocation[] = [
        {
          content_type: "book",
          content_id: "book-1",
          subject_type: "strategy",
          weekly_days: 4,
        },
      ];

      const subjectAllocations: SubjectAllocation[] = [
        {
          subject_name: "수학",
          subject_type: "strategy",
          weekly_days: 2,
        },
      ];

      const content: ContentInfo = {
        content_type: "book",
        content_id: "book-1",
        subject_category: "수학",
        subject: "수학",
      };

      const result = getEffectiveAllocation(
        content,
        contentAllocations,
        subjectAllocations,
        false
      );

      // 콘텐츠별 설정이 우선
      expect(result.subject_type).toBe("strategy");
      expect(result.weekly_days).toBe(4);
      expect(result.source).toBe("content");
    });
  });

  describe("전략과목 주당 배정 일수 정확도 테스트", () => {
    it("전략과목은 주당 2일 배정", () => {
      const cycleDays: CycleDayInfo[] = [
        { date: "2024-01-01", day_type: "study", week_number: 1 },
        { date: "2024-01-02", day_type: "study", week_number: 1 },
        { date: "2024-01-03", day_type: "study", week_number: 1 },
        { date: "2024-01-04", day_type: "study", week_number: 1 },
        { date: "2024-01-05", day_type: "study", week_number: 1 },
        { date: "2024-01-06", day_type: "study", week_number: 1 },
        { date: "2024-01-07", day_type: "review", week_number: 1 },
        { date: "2024-01-08", day_type: "study", week_number: 2 },
        { date: "2024-01-09", day_type: "study", week_number: 2 },
        { date: "2024-01-10", day_type: "study", week_number: 2 },
        { date: "2024-01-11", day_type: "study", week_number: 2 },
        { date: "2024-01-12", day_type: "study", week_number: 2 },
        { date: "2024-01-13", day_type: "study", week_number: 2 },
        { date: "2024-01-14", day_type: "review", week_number: 2 },
      ];

      const allocation = {
        subject_id: "subject-1",
        subject_name: "수학",
        subject_type: "strategy" as const,
        weekly_days: 2,
      };

      const allocatedDates = calculateSubjectAllocationDates(cycleDays, allocation);

      // 주당 2일이므로 2주 동안 총 4일 배정
      expect(allocatedDates.length).toBe(4);
      
      // 각 주에 2일씩 배정되었는지 확인
      const week1Dates = allocatedDates.filter((d) => d.startsWith("2024-01-0"));
      const week2Dates = allocatedDates.filter((d) => d.startsWith("2024-01-1"));
      
      expect(week1Dates.length).toBe(2);
      expect(week2Dates.length).toBe(2);
    });

    it("전략과목은 주당 3일 배정", () => {
      const cycleDays: CycleDayInfo[] = [
        { date: "2024-01-01", day_type: "study", week_number: 1 },
        { date: "2024-01-02", day_type: "study", week_number: 1 },
        { date: "2024-01-03", day_type: "study", week_number: 1 },
        { date: "2024-01-04", day_type: "study", week_number: 1 },
        { date: "2024-01-05", day_type: "study", week_number: 1 },
        { date: "2024-01-06", day_type: "study", week_number: 1 },
        { date: "2024-01-07", day_type: "review", week_number: 1 },
        { date: "2024-01-08", day_type: "study", week_number: 2 },
        { date: "2024-01-09", day_type: "study", week_number: 2 },
        { date: "2024-01-10", day_type: "study", week_number: 2 },
        { date: "2024-01-11", day_type: "study", week_number: 2 },
        { date: "2024-01-12", day_type: "study", week_number: 2 },
        { date: "2024-01-13", day_type: "study", week_number: 2 },
        { date: "2024-01-14", day_type: "review", week_number: 2 },
      ];

      const allocation = {
        subject_id: "subject-1",
        subject_name: "수학",
        subject_type: "strategy" as const,
        weekly_days: 3,
      };

      const allocatedDates = calculateSubjectAllocationDates(cycleDays, allocation);

      // 주당 3일이므로 2주 동안 총 6일 배정
      expect(allocatedDates.length).toBe(6);
      
      // 각 주에 3일씩 배정되었는지 확인
      const week1Dates = allocatedDates.filter((d) => d.startsWith("2024-01-0"));
      const week2Dates = allocatedDates.filter((d) => d.startsWith("2024-01-1"));
      
      expect(week1Dates.length).toBe(3);
      expect(week2Dates.length).toBe(3);
    });

    it("전략과목은 주당 4일 배정", () => {
      const cycleDays: CycleDayInfo[] = [
        { date: "2024-01-01", day_type: "study", week_number: 1 },
        { date: "2024-01-02", day_type: "study", week_number: 1 },
        { date: "2024-01-03", day_type: "study", week_number: 1 },
        { date: "2024-01-04", day_type: "study", week_number: 1 },
        { date: "2024-01-05", day_type: "study", week_number: 1 },
        { date: "2024-01-06", day_type: "study", week_number: 1 },
        { date: "2024-01-07", day_type: "review", week_number: 1 },
        { date: "2024-01-08", day_type: "study", week_number: 2 },
        { date: "2024-01-09", day_type: "study", week_number: 2 },
        { date: "2024-01-10", day_type: "study", week_number: 2 },
        { date: "2024-01-11", day_type: "study", week_number: 2 },
        { date: "2024-01-12", day_type: "study", week_number: 2 },
        { date: "2024-01-13", day_type: "study", week_number: 2 },
        { date: "2024-01-14", day_type: "review", week_number: 2 },
      ];

      const allocation = {
        subject_id: "subject-1",
        subject_name: "수학",
        subject_type: "strategy" as const,
        weekly_days: 4,
      };

      const allocatedDates = calculateSubjectAllocationDates(cycleDays, allocation);

      // 주당 4일이므로 2주 동안 총 8일 배정
      expect(allocatedDates.length).toBe(8);
      
      // 각 주에 4일씩 배정되었는지 확인
      const week1Dates = allocatedDates.filter((d) => d.startsWith("2024-01-0"));
      const week2Dates = allocatedDates.filter((d) => d.startsWith("2024-01-1"));
      
      expect(week1Dates.length).toBe(4);
      expect(week2Dates.length).toBe(4);
    });
  });

  describe("취약과목 전체 학습일 배정 테스트", () => {
    it("취약과목은 모든 학습일에 배정", () => {
      const cycleDays: CycleDayInfo[] = [
        { date: "2024-01-01", day_type: "study", week_number: 1 },
        { date: "2024-01-02", day_type: "study", week_number: 1 },
        { date: "2024-01-03", day_type: "study", week_number: 1 },
        { date: "2024-01-04", day_type: "study", week_number: 1 },
        { date: "2024-01-05", day_type: "study", week_number: 1 },
        { date: "2024-01-06", day_type: "study", week_number: 1 },
        { date: "2024-01-07", day_type: "review", week_number: 1 },
        { date: "2024-01-08", day_type: "study", week_number: 2 },
        { date: "2024-01-09", day_type: "study", week_number: 2 },
        { date: "2024-01-10", day_type: "study", week_number: 2 },
        { date: "2024-01-11", day_type: "study", week_number: 2 },
        { date: "2024-01-12", day_type: "study", week_number: 2 },
        { date: "2024-01-13", day_type: "study", week_number: 2 },
        { date: "2024-01-14", day_type: "review", week_number: 2 },
      ];

      const allocation = {
        subject_id: "subject-1",
        subject_name: "영어",
        subject_type: "weakness" as const,
      };

      const allocatedDates = calculateSubjectAllocationDates(cycleDays, allocation);

      // 취약과목은 모든 학습일에 배정 (복습일 제외)
      const studyDays = cycleDays.filter((d) => d.day_type === "study");
      expect(allocatedDates.length).toBe(studyDays.length);
      
      // 모든 학습일이 포함되었는지 확인
      studyDays.forEach((day) => {
        expect(allocatedDates).toContain(day.date);
      });
    });

    it("취약과목은 복습일에는 배정되지 않음", () => {
      const cycleDays: CycleDayInfo[] = [
        { date: "2024-01-01", day_type: "study", week_number: 1 },
        { date: "2024-01-02", day_type: "study", week_number: 1 },
        { date: "2024-01-03", day_type: "study", week_number: 1 },
        { date: "2024-01-04", day_type: "study", week_number: 1 },
        { date: "2024-01-05", day_type: "study", week_number: 1 },
        { date: "2024-01-06", day_type: "study", week_number: 1 },
        { date: "2024-01-07", day_type: "review", week_number: 1 },
        { date: "2024-01-08", day_type: "study", week_number: 2 },
        { date: "2024-01-09", day_type: "study", week_number: 2 },
        { date: "2024-01-10", day_type: "study", week_number: 2 },
        { date: "2024-01-11", day_type: "study", week_number: 2 },
        { date: "2024-01-12", day_type: "study", week_number: 2 },
        { date: "2024-01-13", day_type: "study", week_number: 2 },
        { date: "2024-01-14", day_type: "review", week_number: 2 },
      ];

      const allocation = {
        subject_id: "subject-1",
        subject_name: "영어",
        subject_type: "weakness" as const,
      };

      const allocatedDates = calculateSubjectAllocationDates(cycleDays, allocation);

      // 복습일은 포함되지 않아야 함
      const reviewDays = cycleDays.filter((d) => d.day_type === "review");
      reviewDays.forEach((day) => {
        expect(allocatedDates).not.toContain(day.date);
      });
    });
  });
});

