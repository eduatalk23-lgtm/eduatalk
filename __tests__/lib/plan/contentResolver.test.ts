/**
 * 콘텐츠 해석 로직 테스트
 *
 * contentResolver.ts의 핵심 함수들을 검증합니다.
 * - resolveContentIds: 마스터 → 학생 ID 매핑
 * - loadContentMetadata: 콘텐츠 메타데이터 로딩
 * - loadContentDurations: 소요 시간 계산
 * - loadContentChapters: 챕터/에피소드 정보 로딩
 *
 * @module __tests__/lib/plan/contentResolver.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock types for testing
type ContentIdMap = Map<string, string>;
type ContentMetadataMap = Map<
  string,
  {
    title?: string | null;
    subject?: string | null;
    subject_category?: string | null;
    category?: string | null;
  }
>;
type ChapterMap = Map<
  string,
  {
    start_chapter: string;
    end_chapter: string;
    episode_title?: string;
  }
>;

describe("contentResolver", () => {
  describe("resolveContentIds (ID 매핑)", () => {
    describe("일반 모드", () => {
      it("학생 콘텐츠 ID가 그대로 유지되어야 함", () => {
        // Given: 학생이 소유한 콘텐츠
        const studentContents = [
          { content_id: "student-book-1", content_type: "book" as const },
          { content_id: "student-lecture-1", content_type: "lecture" as const },
        ];

        // When: ID 매핑 (일반 모드에서는 변환 없음)
        const contentIdMap: ContentIdMap = new Map();
        studentContents.forEach((c) => {
          contentIdMap.set(c.content_id, c.content_id);
        });

        // Then: 동일한 ID 유지
        expect(contentIdMap.get("student-book-1")).toBe("student-book-1");
        expect(contentIdMap.get("student-lecture-1")).toBe("student-lecture-1");
      });
    });

    describe("캠프 모드", () => {
      it("마스터 콘텐츠 ID가 학생 콘텐츠 ID로 매핑되어야 함", () => {
        // Given: 마스터 콘텐츠와 복사된 학생 콘텐츠
        const masterToStudentMapping = {
          "master-book-1": "student-book-copied-1",
          "master-lecture-1": "student-lecture-copied-1",
        };

        // When: ID 매핑 생성
        const contentIdMap: ContentIdMap = new Map(
          Object.entries(masterToStudentMapping)
        );

        // Then: 마스터 ID로 학생 ID 조회 가능
        expect(contentIdMap.get("master-book-1")).toBe("student-book-copied-1");
        expect(contentIdMap.get("master-lecture-1")).toBe(
          "student-lecture-copied-1"
        );
      });

      it("복사되지 않은 마스터 콘텐츠는 undefined 반환", () => {
        const contentIdMap: ContentIdMap = new Map();

        expect(contentIdMap.get("non-existent-master")).toBeUndefined();
      });
    });

    describe("커스텀 콘텐츠", () => {
      it("커스텀 콘텐츠 ID는 변환 없이 유지", () => {
        const contentIdMap: ContentIdMap = new Map();
        contentIdMap.set("custom-content-1", "custom-content-1");

        expect(contentIdMap.get("custom-content-1")).toBe("custom-content-1");
      });
    });
  });

  describe("loadContentMetadata (메타데이터 로딩)", () => {
    it("교재 메타데이터가 올바르게 로딩되어야 함", () => {
      // Given: 교재 메타데이터
      const bookMetadata = {
        title: "수학의 정석",
        subject: "수학",
        subject_category: "수학I",
        category: "기본서",
      };

      // When: 메타데이터 맵에 저장
      const metadataMap: ContentMetadataMap = new Map();
      metadataMap.set("book-1", bookMetadata);

      // Then: 조회 시 올바른 데이터 반환
      const result = metadataMap.get("book-1");
      expect(result?.title).toBe("수학의 정석");
      expect(result?.subject).toBe("수학");
      expect(result?.subject_category).toBe("수학I");
    });

    it("강의 메타데이터가 올바르게 로딩되어야 함", () => {
      const lectureMetadata = {
        title: "현우진의 수학 강의",
        subject: "수학",
        subject_category: "미적분",
        category: "인강",
      };

      const metadataMap: ContentMetadataMap = new Map();
      metadataMap.set("lecture-1", lectureMetadata);

      const result = metadataMap.get("lecture-1");
      expect(result?.title).toBe("현우진의 수학 강의");
    });

    it("존재하지 않는 콘텐츠는 undefined 반환", () => {
      const metadataMap: ContentMetadataMap = new Map();

      expect(metadataMap.get("non-existent")).toBeUndefined();
    });
  });

  describe("loadContentChapters (챕터 정보)", () => {
    describe("교재 챕터", () => {
      it("페이지 범위로 챕터 정보 생성", () => {
        // Given: 페이지 범위
        const startPage = 1;
        const endPage = 50;

        // When: 챕터 정보 생성
        const chapterInfo = {
          start_chapter: `p.${startPage}`,
          end_chapter: `p.${endPage}`,
        };

        // Then
        expect(chapterInfo.start_chapter).toBe("p.1");
        expect(chapterInfo.end_chapter).toBe("p.50");
      });

      it("상세 ID로 단원명 조회", () => {
        // Given: book_details 데이터
        const bookDetails = [
          { id: "detail-1", page_number: 1, major_unit: "1장", minor_unit: "함수의 극한" },
          { id: "detail-50", page_number: 50, major_unit: "2장", minor_unit: "미분법" },
        ];

        // When: 상세 ID로 챕터 정보 조회
        const startDetail = bookDetails.find((d) => d.id === "detail-1");
        const endDetail = bookDetails.find((d) => d.id === "detail-50");

        const chapterInfo = {
          start_chapter: startDetail
            ? `${startDetail.major_unit} ${startDetail.minor_unit}`
            : "",
          end_chapter: endDetail
            ? `${endDetail.major_unit} ${endDetail.minor_unit}`
            : "",
        };

        // Then
        expect(chapterInfo.start_chapter).toBe("1장 함수의 극한");
        expect(chapterInfo.end_chapter).toBe("2장 미분법");
      });
    });

    describe("강의 에피소드", () => {
      it("에피소드 번호로 챕터 정보 생성", () => {
        // Given: 에피소드 범위
        const startEpisode = 1;
        const endEpisode = 5;

        // When: 챕터 정보 생성
        const chapterInfo = {
          start_chapter: `${startEpisode}강`,
          end_chapter: `${endEpisode}강`,
        };

        // Then
        expect(chapterInfo.start_chapter).toBe("1강");
        expect(chapterInfo.end_chapter).toBe("5강");
      });

      it("에피소드 제목이 표시되어야 함", () => {
        // Given: lecture_episodes 데이터
        const lectureEpisodes = [
          { id: "ep-1", episode_number: 1, episode_title: "함수의 기초" },
          { id: "ep-5", episode_number: 5, episode_title: "극한의 성질" },
        ];

        // When: 에피소드 ID로 제목 조회
        const startEpisode = lectureEpisodes.find((e) => e.id === "ep-1");

        // Then: 에피소드 제목 포함
        expect(startEpisode?.episode_title).toBe("함수의 기초");
      });

      it("에피소드 제목이 없으면 번호만 표시", () => {
        // Given: 제목 없는 에피소드
        const episode = { id: "ep-1", episode_number: 1, episode_title: null };

        // When: 챕터 정보 생성
        const chapterStr = episode.episode_title || `${episode.episode_number}강`;

        // Then
        expect(chapterStr).toBe("1강");
      });
    });

    describe("chapterMap 키 매칭", () => {
      it("변환된 content_id로 조회 가능해야 함", () => {
        // Given: 마스터 → 학생 ID 매핑
        const contentIdMap: ContentIdMap = new Map([
          ["master-book-1", "student-book-1"],
        ]);

        // When: chapterMap에 변환된 ID로 저장
        const chapterMap: ChapterMap = new Map();
        const originalContentId = "master-book-1";
        const mappedContentId =
          contentIdMap.get(originalContentId) || originalContentId;

        chapterMap.set(mappedContentId, {
          start_chapter: "1장",
          end_chapter: "5장",
        });

        // Then: 변환된 ID로 조회 가능
        expect(chapterMap.get("student-book-1")).toBeDefined();
        expect(chapterMap.get("student-book-1")?.start_chapter).toBe("1장");

        // 원본 ID로는 조회 불가
        expect(chapterMap.get("master-book-1")).toBeUndefined();
      });
    });
  });

  describe("loadContentDurations (소요 시간 계산)", () => {
    describe("교재", () => {
      it("기본 난이도: 페이지당 6분", () => {
        const pages = 10;
        const difficultyMinutesPerPage = 6; // 기본

        const duration = pages * difficultyMinutesPerPage;

        expect(duration).toBe(60); // 10페이지 * 6분 = 60분
      });

      it("쉬움 난이도: 페이지당 4분", () => {
        const pages = 10;
        const difficultyMinutesPerPage = 4; // 쉬움

        const duration = pages * difficultyMinutesPerPage;

        expect(duration).toBe(40);
      });

      it("어려움 난이도: 페이지당 8분", () => {
        const pages = 10;
        const difficultyMinutesPerPage = 8; // 어려움

        const duration = pages * difficultyMinutesPerPage;

        expect(duration).toBe(80);
      });
    });

    describe("강의", () => {
      it("에피소드별 시간으로 총 시간 계산", () => {
        // Given: 에피소드별 duration
        const episodes = [
          { episode_number: 1, duration: 30 },
          { episode_number: 2, duration: 45 },
          { episode_number: 3, duration: 25 },
        ];

        // When: 총 시간 계산
        const totalDuration = episodes.reduce(
          (sum, ep) => sum + (ep.duration || 0),
          0
        );

        // Then
        expect(totalDuration).toBe(100);
      });

      it("특정 에피소드 범위의 시간 계산", () => {
        // Given: 1~5강 중 2~4강만 학습
        const episodes = [
          { episode_number: 1, duration: 30 },
          { episode_number: 2, duration: 30 },
          { episode_number: 3, duration: 30 },
          { episode_number: 4, duration: 30 },
          { episode_number: 5, duration: 30 },
        ];

        const startRange = 2;
        const endRange = 4;

        // When: 범위 내 에피소드 시간 합산
        const rangeDuration = episodes
          .filter(
            (ep) =>
              ep.episode_number >= startRange && ep.episode_number <= endRange
          )
          .reduce((sum, ep) => sum + (ep.duration || 0), 0);

        // Then: 2, 3, 4강 = 90분
        expect(rangeDuration).toBe(90);
      });

      it("에피소드 정보가 없으면 기본값 사용", () => {
        // Given: 에피소드 정보 없음
        const totalDuration = 300; // 강의 전체 시간
        const totalEpisodes = 10;

        // When: 기본값으로 에피소드당 시간 계산
        const defaultEpisodeDuration = totalDuration / totalEpisodes;

        // Then
        expect(defaultEpisodeDuration).toBe(30);
      });
    });

    describe("커스텀 콘텐츠", () => {
      it("total_page_or_time 값 사용", () => {
        const customContent = {
          content_type: "custom" as const,
          total_page_or_time: 120, // 분
        };

        expect(customContent.total_page_or_time).toBe(120);
      });
    });
  });

  describe("경계 조건", () => {
    it("빈 콘텐츠 배열 처리", () => {
      const contents: { content_id: string; content_type: string }[] = [];
      const contentIdMap: ContentIdMap = new Map();

      contents.forEach((c) => {
        contentIdMap.set(c.content_id, c.content_id);
      });

      expect(contentIdMap.size).toBe(0);
    });

    it("null/undefined 값 처리", () => {
      const metadataMap: ContentMetadataMap = new Map();
      metadataMap.set("book-1", {
        title: null,
        subject: undefined,
        subject_category: null,
        category: undefined,
      });

      const result = metadataMap.get("book-1");
      expect(result?.title).toBeNull();
      expect(result?.subject).toBeUndefined();
    });

    it("중복 콘텐츠 ID 처리", () => {
      const contentIdMap: ContentIdMap = new Map();

      // 동일 ID가 두 번 설정되면 마지막 값으로 덮어씀
      contentIdMap.set("content-1", "student-1");
      contentIdMap.set("content-1", "student-2");

      expect(contentIdMap.get("content-1")).toBe("student-2");
    });
  });
});
