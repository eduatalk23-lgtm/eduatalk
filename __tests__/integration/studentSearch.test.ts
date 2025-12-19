/**
 * 학생 통합 검색 기능 통합 테스트
 * 
 * 주의: 이 테스트는 실제 데이터베이스 연결이 필요합니다.
 * 통합 테스트 환경에서 실행해야 합니다.
 * 
 * 테스트 환경 설정:
 * 1. 테스트용 Supabase 프로젝트 설정
 * 2. 테스트 데이터베이스 마이그레이션 실행
 * 3. 테스트용 테넌트, 학생 데이터 생성
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { searchStudentsUnified } from "@/lib/data/studentSearch";
import {
  createTestTenant,
  createTestStudent,
  cleanupTestData,
} from "../helpers/supabase";

describe("학생 통합 검색 기능 통합 테스트", () => {
  // 테스트용 데이터
  let testTenantId: string;
  let testStudentId1: string;
  let testStudentId2: string;

  beforeAll(async () => {
    // 실제 구현 시 주석 해제:
    // testTenantId = await createTestTenant("통합 검색 테스트 테넌트");
    // testStudentId1 = await createTestStudent(testTenantId, "홍길동");
    // testStudentId2 = await createTestStudent(testTenantId, "김철수");
    
    // 스킵: 실제 데이터베이스 연결 필요
    // 테스트 환경 설정 가이드는 docs/integration-test-setup.md 참조
  });

  afterAll(async () => {
    // 실제 구현 시 주석 해제:
    // if (testTenantId && testStudentId1) {
    //   await cleanupTestData(testTenantId, testStudentId1);
    // }
    // if (testTenantId && testStudentId2) {
    //   await cleanupTestData(testTenantId, testStudentId2);
    // }
  });

  describe("이름 검색", () => {
    it.skip("이름으로 학생 검색", async () => {
      // const result = await searchStudentsUnified({
      //   query: "홍길동",
      //   searchType: "name",
      //   filters: {
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // expect(result.students.length).toBeGreaterThanOrEqual(0);
      // expect(result.total).toBeGreaterThanOrEqual(0);
      // 
      // // 검색 결과에 홍길동이 포함되어야 함
      // const hongFound = result.students.some((s) => s.name?.includes("홍길동"));
      // expect(hongFound).toBe(true);
    });

    it.skip("부분 이름 검색", async () => {
      // const result = await searchStudentsUnified({
      //   query: "홍",
      //   searchType: "name",
      //   filters: {
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // expect(result.students.length).toBeGreaterThanOrEqual(0);
      // 
      // // 검색 결과에 "홍"이 포함된 이름이 있어야 함
      // const hasHong = result.students.some((s) => s.name?.includes("홍"));
      // expect(hasHong).toBe(true);
    });
  });

  describe("연락처 검색", () => {
    it.skip("4자리 연락처 검색", async () => {
      // const result = await searchStudentsUnified({
      //   query: "0101",
      //   searchType: "phone",
      //   filters: {
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // expect(result.students.length).toBeGreaterThanOrEqual(0);
      // 
      // // 검색 결과의 연락처에 "0101"이 포함되어야 함
      // const hasPhoneMatch = result.students.some((s) => {
      //   return (
      //     s.phone?.includes("0101") ||
      //     s.mother_phone?.includes("0101") ||
      //     s.father_phone?.includes("0101")
      //   );
      // });
      // expect(hasPhoneMatch).toBe(true);
    });

    it.skip("연락처 검색 - matched_field 확인", async () => {
      // const result = await searchStudentsUnified({
      //   query: "0101",
      //   searchType: "phone",
      //   filters: {
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // // matched_field가 올바르게 설정되어야 함
      // result.students.forEach((student) => {
      //   if (student.matched_field) {
      //     expect(["phone", "mother_phone", "father_phone"]).toContain(
      //       student.matched_field
      //     );
      //   }
      // });
    });
  });

  describe("검색 타입 자동 감지", () => {
    it.skip("숫자만 입력 시 연락처 검색으로 자동 감지", async () => {
      // const result = await searchStudentsUnified({
      //   query: "0101",
      //   // searchType을 지정하지 않으면 자동 감지
      //   filters: {
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // // 연락처 검색 결과가 나와야 함
      // expect(result.students.length).toBeGreaterThanOrEqual(0);
    });

    it.skip("한글 입력 시 이름 검색으로 자동 감지", async () => {
      // const result = await searchStudentsUnified({
      //   query: "홍길동",
      //   // searchType을 지정하지 않으면 자동 감지
      //   filters: {
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // // 이름 검색 결과가 나와야 함
      // expect(result.students.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("필터링", () => {
    it.skip("학년 필터링", async () => {
      // const result = await searchStudentsUnified({
      //   query: "홍",
      //   filters: {
      //     grade: "1",
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // // 모든 결과가 1학년이어야 함
      // result.students.forEach((student) => {
      //   expect(student.grade).toBe("1");
      // });
    });

    it.skip("반 필터링", async () => {
      // const result = await searchStudentsUnified({
      //   query: "홍",
      //   filters: {
      //     class: "1",
      //     isActive: true,
      //   },
      //   limit: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // // 모든 결과가 1반이어야 함
      // result.students.forEach((student) => {
      //   expect(student.class).toBe("1");
      // });
    });
  });

  describe("페이지네이션", () => {
    it.skip("첫 페이지 조회", async () => {
      // const result = await searchStudentsUnified({
      //   query: "홍",
      //   limit: 10,
      //   offset: 0,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // expect(result.students.length).toBeLessThanOrEqual(10);
    });

    it.skip("두 번째 페이지 조회", async () => {
      // const firstPage = await searchStudentsUnified({
      //   query: "홍",
      //   limit: 10,
      //   offset: 0,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // const secondPage = await searchStudentsUnified({
      //   query: "홍",
      //   limit: 10,
      //   offset: 10,
      //   role: "admin",
      //   tenantId: testTenantId,
      // });
      // 
      // // 중복 없어야 함
      // const firstPageIds = new Set(firstPage.students.map((s) => s.id));
      // const secondPageIds = new Set(secondPage.students.map((s) => s.id));
      // 
      // const intersection = [...firstPageIds].filter((id) =>
      //   secondPageIds.has(id)
      // );
      // expect(intersection.length).toBe(0);
    });
  });
});

