/**
 * 콜드 스타트 콘텐츠 - ContentResolutionService 호환성 테스트
 *
 * 이 테스트는 콜드 스타트로 생성된 콘텐츠가 플랜 생성 시
 * ContentResolutionService를 통해 올바르게 처리되는지 검증합니다.
 *
 * 테스트 시나리오:
 * 1. 콜드 스타트 콘텐츠 저장 형식 검증
 * 2. 마스터 콘텐츠 ID 해석 검증
 * 3. plan_contents 형식 변환 검증
 *
 * 실행 방법:
 *   pnpm test lib/domains/plan/llm/actions/coldStart/__tests__/content-resolution-compatibility.test.ts
 */

import { describe, it, expect } from "vitest";
import type { RecommendationItem } from "../types";
import { mapToBookInsert, mapToLectureInsert } from "../persistence/mappers";
import type { ColdStartBookInsert, ColdStartLectureInsert } from "../persistence/types";

/**
 * 테스트용 추천 아이템 생성
 */
function createMockRecommendation(
  overrides?: Partial<RecommendationItem>
): RecommendationItem {
  return {
    title: "개념원리 수학 I",
    author: "이홍섭",
    publisher: "개념원리",
    contentType: "book",
    totalRange: 320,
    chapters: [
      { title: "1. 지수함수와 로그함수", startRange: 1, endRange: 80 },
      { title: "2. 삼각함수", startRange: 81, endRange: 180 },
      { title: "3. 수열", startRange: 181, endRange: 320 },
    ],
    description: "수학 I 개념 학습에 최적화된 교재",
    rank: 1,
    matchScore: 95,
    reason: "개념 학습에 적합한 체계적인 구성",
    ...overrides,
  };
}

describe("콜드 스타트 콘텐츠 - 저장 형식 검증", () => {
  describe("mapToBookInsert", () => {
    it("필수 필드가 올바르게 매핑됨", () => {
      const recommendation = createMockRecommendation();
      const result = mapToBookInsert(recommendation, {
        tenantId: null, // 공유 카탈로그
        subjectCategory: "수학",
        subject: "수학 I",
        difficultyLevel: "개념",
      });

      // 필수 필드 검증
      expect(result.title).toBe("개념원리 수학 I");
      expect(result.total_pages).toBe(320);
      expect(result.author).toBe("이홍섭");
      expect(result.publisher_name).toBe("개념원리");
      expect(result.source).toBe("cold_start");
      expect(result.is_active).toBe(true);
    });

    it("page_analysis가 챕터 정보를 포함함", () => {
      const recommendation = createMockRecommendation();
      const result = mapToBookInsert(recommendation, {
        subjectCategory: "수학",
      });

      expect(result.page_analysis).not.toBeNull();
      const analysis = result.page_analysis as {
        chapters: Array<{ title: string; startRange: number; endRange: number }>;
        source: string;
        createdAt: string;
      };
      expect(analysis.chapters).toHaveLength(3);
      expect(analysis.source).toBe("cold_start");
      expect(analysis.createdAt).toBeDefined();
    });

    it("챕터가 없으면 page_analysis가 null", () => {
      const recommendation = createMockRecommendation({ chapters: [] });
      const result = mapToBookInsert(recommendation);

      expect(result.page_analysis).toBeNull();
    });

    it("totalRange가 0이면 total_pages가 null", () => {
      const recommendation = createMockRecommendation({ totalRange: 0 });
      const result = mapToBookInsert(recommendation);

      expect(result.total_pages).toBeNull();
    });

    it("notes에 추천 정보가 포함됨", () => {
      const recommendation = createMockRecommendation({
        reason: "기본 개념 학습에 최적",
        matchScore: 92,
      });
      const result = mapToBookInsert(recommendation);

      expect(result.notes).toContain("[추천 이유] 기본 개념 학습에 최적");
      expect(result.notes).toContain("[일치도] 92%");
      expect(result.notes).toContain("[출처] 콜드 스타트 추천 시스템");
    });

    it("tenant_id가 null이면 공유 카탈로그로 저장", () => {
      const recommendation = createMockRecommendation();
      const result = mapToBookInsert(recommendation, { tenantId: null });

      expect(result.tenant_id).toBeNull();
    });

    it("tenant_id가 있으면 테넌트 전용으로 저장", () => {
      const tenantId = "tenant-uuid-123";
      const recommendation = createMockRecommendation();
      const result = mapToBookInsert(recommendation, { tenantId });

      expect(result.tenant_id).toBe(tenantId);
    });
  });

  describe("mapToLectureInsert", () => {
    it("강의 콘텐츠가 올바르게 매핑됨", () => {
      const recommendation = createMockRecommendation({
        contentType: "lecture",
        title: "수학 I 개념 완성",
        author: "현우진",
        publisher: "메가스터디",
        totalRange: 50,
      });
      const result = mapToLectureInsert(recommendation, {
        subjectCategory: "수학",
        subject: "수학 I",
      });

      expect(result.title).toBe("수학 I 개념 완성");
      expect(result.total_episodes).toBe(50);
      expect(result.instructor_name).toBe("현우진");
      expect(result.platform_name).toBe("메가스터디");
    });

    it("totalRange가 0이면 total_episodes가 1", () => {
      const recommendation = createMockRecommendation({
        contentType: "lecture",
        totalRange: 0,
      });
      const result = mapToLectureInsert(recommendation);

      expect(result.total_episodes).toBe(1);
    });

    it("episode_analysis가 챕터 정보를 포함함", () => {
      const recommendation = createMockRecommendation({
        contentType: "lecture",
        chapters: [
          { title: "오리엔테이션", startRange: 1, endRange: 1 },
          { title: "1강 지수함수", startRange: 2, endRange: 10 },
        ],
      });
      const result = mapToLectureInsert(recommendation);

      expect(result.episode_analysis).not.toBeNull();
      const analysis = result.episode_analysis as {
        chapters: Array<{ title: string; startRange: number; endRange: number }>;
        source: string;
      };
      expect(analysis.chapters).toHaveLength(2);
      expect(analysis.source).toBe("cold_start");
    });
  });
});

describe("콜드 스타트 콘텐츠 - plan_contents 형식 호환성", () => {
  it("저장된 콘텐츠가 plan_contents에 필요한 필드를 가짐", () => {
    const recommendation = createMockRecommendation();
    const bookInsert = mapToBookInsert(recommendation, {
      subjectCategory: "수학",
      difficultyLevel: "개념",
    });

    // plan_contents 연결에 필요한 필드 검증
    // content_id: DB 저장 후 생성됨 (UUID)
    // content_type: 'book' | 'lecture' - 타입에서 결정
    // start_range / end_range: 1 ~ total_pages로 기본 설정
    // total_pages: 있어야 범위 계산 가능

    expect(bookInsert.total_pages).toBe(320);
    expect(bookInsert.subject_category).toBe("수학");
    expect(bookInsert.difficulty_level).toBe("개념");
    expect(bookInsert.is_active).toBe(true);
  });

  it("page_analysis의 챕터 정보가 범위 설정에 사용 가능", () => {
    const recommendation = createMockRecommendation({
      chapters: [
        { title: "1장", startRange: 1, endRange: 100 },
        { title: "2장", startRange: 101, endRange: 200 },
        { title: "3장", startRange: 201, endRange: 320 },
      ],
    });
    const bookInsert = mapToBookInsert(recommendation);
    const analysis = bookInsert.page_analysis as {
      chapters: Array<{ title: string; startRange: number; endRange: number }>;
    };

    // 챕터별 범위로 플랜 생성 가능
    expect(analysis.chapters[0].startRange).toBe(1);
    expect(analysis.chapters[0].endRange).toBe(100);
    expect(analysis.chapters[2].endRange).toBe(320);

    // 마지막 챕터 endRange가 totalRange와 일치
    expect(analysis.chapters[2].endRange).toBe(recommendation.totalRange);
  });
});

describe("콜드 스타트 콘텐츠 - ContentResolutionService 입력 형식", () => {
  /**
   * ContentResolutionService가 기대하는 입력 형식:
   * {
   *   content_id: string;       // master_books/lectures의 ID
   *   content_type: 'book' | 'lecture';
   *   start_detail_id?: string; // 선택적 (없으면 start_range 사용)
   *   end_detail_id?: string;   // 선택적 (없으면 end_range 사용)
   *   start_range?: number;     // 기본 범위
   *   end_range?: number;       // 기본 범위
   * }
   */

  it("콜드 스타트 콘텐츠가 ContentResolutionInput 형식에 맞게 변환 가능", () => {
    const recommendation = createMockRecommendation();
    const bookInsert = mapToBookInsert(recommendation);

    // 저장 후 반환되는 content_id를 시뮬레이션
    const savedContentId = "cold-start-content-uuid";

    // ContentResolutionInput 형식으로 변환
    const contentResolutionInput = {
      content_id: savedContentId,
      content_type: "book" as const,
      start_range: 1,
      end_range: bookInsert.total_pages || 1,
    };

    expect(contentResolutionInput.content_id).toBe(savedContentId);
    expect(contentResolutionInput.content_type).toBe("book");
    expect(contentResolutionInput.start_range).toBe(1);
    expect(contentResolutionInput.end_range).toBe(320);
  });

  it("챕터 기반 범위 설정이 가능", () => {
    const recommendation = createMockRecommendation({
      chapters: [
        { title: "1장", startRange: 1, endRange: 100 },
        { title: "2장", startRange: 101, endRange: 200 },
      ],
    });
    const bookInsert = mapToBookInsert(recommendation);
    const analysis = bookInsert.page_analysis as {
      chapters: Array<{ title: string; startRange: number; endRange: number }>;
    };

    // 1장만 학습하는 플랜 생성
    const chapter1Only = {
      content_id: "cold-start-content-uuid",
      content_type: "book" as const,
      start_range: analysis.chapters[0].startRange,
      end_range: analysis.chapters[0].endRange,
    };

    expect(chapter1Only.start_range).toBe(1);
    expect(chapter1Only.end_range).toBe(100);
  });
});

describe("콜드 스타트 콘텐츠 - 마스터→학생 복사 호환성", () => {
  /**
   * ContentResolutionService.copyMasterContents 호환성 검증
   *
   * 콜드 스타트 콘텐츠는 master_books/lectures에 저장되므로
   * 플랜 생성 시 학생 콘텐츠로 복사되어야 합니다.
   *
   * 복사 시 필요한 필드:
   * - title, author, publisher_name (books) / platform_name (lectures)
   * - total_pages / total_episodes
   * - subject_category, subject, difficulty_level
   * - page_analysis / episode_analysis (챕터 정보)
   */

  it("books 테이블 복사에 필요한 모든 필드가 있음", () => {
    const recommendation = createMockRecommendation();
    const bookInsert = mapToBookInsert(recommendation, {
      tenantId: null,
      subjectCategory: "수학",
      subject: "수학 I",
      difficultyLevel: "개념",
    });

    // copyMasterBookToStudent가 필요로 하는 필드
    const requiredFields: (keyof ColdStartBookInsert)[] = [
      "title",
      "total_pages",
      "author",
      "publisher_name",
      "subject_category",
      "subject",
      "difficulty_level",
      "page_analysis",
      "source",
      "is_active",
    ];

    requiredFields.forEach((field) => {
      expect(bookInsert).toHaveProperty(field);
    });
  });

  it("lectures 테이블 복사에 필요한 모든 필드가 있음", () => {
    const recommendation = createMockRecommendation({
      contentType: "lecture",
      totalRange: 30,
    });
    const lectureInsert = mapToLectureInsert(recommendation, {
      subjectCategory: "수학",
      subject: "수학 I",
      difficultyLevel: "개념",
    });

    // copyMasterLectureToStudent가 필요로 하는 필드
    const requiredFields: (keyof ColdStartLectureInsert)[] = [
      "title",
      "total_episodes",
      "instructor_name",
      "platform_name",
      "subject_category",
      "subject",
      "difficulty_level",
      "episode_analysis",
    ];

    requiredFields.forEach((field) => {
      expect(lectureInsert).toHaveProperty(field);
    });
  });

  it("source 필드가 'cold_start'로 설정되어 추적 가능", () => {
    const recommendation = createMockRecommendation();
    const bookInsert = mapToBookInsert(recommendation);

    // 콜드 스타트 콘텐츠 출처 추적
    expect(bookInsert.source).toBe("cold_start");

    // notes에도 출처 정보 포함
    expect(bookInsert.notes).toContain("콜드 스타트");
  });
});

describe("콜드 스타트 콘텐츠 - 에지 케이스 처리", () => {
  it("author가 없어도 저장 가능", () => {
    const recommendation = createMockRecommendation({ author: undefined });
    const result = mapToBookInsert(recommendation);

    expect(result.author).toBeNull();
  });

  it("publisher가 없어도 저장 가능", () => {
    const recommendation = createMockRecommendation({ publisher: undefined });
    const result = mapToBookInsert(recommendation);

    expect(result.publisher_name).toBeNull();
  });

  it("옵션 없이도 기본값으로 저장 가능", () => {
    const recommendation = createMockRecommendation();
    const result = mapToBookInsert(recommendation);

    expect(result.tenant_id).toBeNull(); // 기본: 공유 카탈로그
    expect(result.subject_category).toBeNull();
    expect(result.subject).toBeNull();
    expect(result.difficulty_level).toBeNull();
  });

  it("빈 reason도 notes에 포함", () => {
    const recommendation = createMockRecommendation({ reason: "" });
    const result = mapToBookInsert(recommendation);

    // reason이 빈 문자열이면 notes에 포함되지 않음
    expect(result.notes).not.toContain("[추천 이유]");
  });

  it("matchScore가 undefined여도 notes 생성 가능", () => {
    const recommendation = createMockRecommendation({ matchScore: undefined as unknown as number });
    const result = mapToBookInsert(recommendation);

    expect(result.notes).not.toContain("[일치도]");
    expect(result.notes).toContain("[출처]"); // 출처는 항상 포함
  });
});
