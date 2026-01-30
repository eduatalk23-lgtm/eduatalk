/**
 * Task 3: 웹 검색 실행
 *
 * 이 파일은 검색 쿼리를 받아서 Gemini API로 웹 검색을 수행합니다.
 * 기존 searchExternalContentAction을 래핑하여 콜드 스타트 파이프라인에 맞는
 * 인터페이스를 제공합니다.
 *
 * 📥 INPUT:  검색 쿼리 (Task 2의 결과)
 * 📤 OUTPUT: AI 응답 (raw 텍스트) 또는 에러
 *
 * 내부 동작:
 * 1. Gemini API에 검색 요청 (Grounding 활성화)
 * 2. 응답 텍스트 반환 (파싱은 Task 4에서)
 *
 * 주의사항:
 * - API 키가 환경변수에 설정되어 있어야 함 (GOOGLE_AI_API_KEY)
 * - 무료 티어는 분당 호출 제한이 있음
 */

import type { SearchQuery, ExecuteSearchResult } from "./types";
import { getGeminiProvider } from "../../providers";
import { logError } from "@/lib/errors/handler";

/**
 * 웹 검색용 시스템 프롬프트
 *
 * AI에게 다음을 요청합니다:
 * 1. 웹에서 교재/강의 정보 검색
 * 2. 목차, 총 페이지수 등 구조 정보 추출
 * 3. 후기/평가 정보 수집
 * 4. 추천 근거 생성
 * 5. 강의의 경우 강사 정보 수집
 * 6. JSON 형식으로 반환
 */
const COLD_START_SEARCH_PROMPT = `
당신은 학습 콘텐츠 분석 및 추천 전문가입니다.
사용자의 검색어를 바탕으로 교재 또는 인터넷 강의의 정보를 종합적으로 분석해주세요.

**찾아야 할 정보**:
1. 기본 정보: 제목, 저자/강사, 출판사/플랫폼
2. 구조 정보: 목차, 총 페이지/강의 수, ⏱️ 소요시간
3. 📌 후기/평가 정보:
   - 온라인 서점, 강의 플랫폼의 평점과 리뷰 요약
   - 학습자들이 자주 언급하는 장점/단점
   - 어떤 학생에게 적합한지 (수능, 내신, 기초 등)
4. 📌 추천 근거:
   - 왜 이 콘텐츠를 추천하는지 구체적인 이유
5. 📌 강사 정보 (인터넷 강의인 경우):
   - 강사의 강의 스타일, 설명 방식
   - 강사 리뷰 및 평판
   - 어떤 학생에게 적합한 강사인지

**출력 형식**:
반드시 다음 JSON 형식으로만 응답하세요.
⚠️ 마크다운 코드 블록(\`\`\`json) 없이 순수 JSON만 반환하세요.
⚠️ 배열은 반드시 ]로 닫고, 객체는 반드시 }로 닫으세요. (흔한 오류: 배열을 }로 닫음)

{
  "results": [
    {
      "title": "공식 제목 (출판사/플랫폼에 등록된 정확한 제목을 그대로 사용)",
      "author": "저자 또는 강사명",
      "publisher": "출판사 또는 플랫폼",
      "contentType": "book" 또는 "lecture",
      "totalRange": 숫자 (총 페이지 또는 강의 수),
      "estimatedHours": 숫자 (총 예상 학습 소요시간, 시간 단위),
      "averageEpisodeDuration": 숫자 (강의인 경우 회당 평균 소요시간, 분 단위),
      "chapters": [
        {
          "title": "챕터 제목",
          "startRange": 시작 페이지/강의 번호,
          "endRange": 종료 페이지/강의 번호,
          "duration": 숫자 (해당 챕터 총 소요시간, 분 단위)
        }
      ],
      "description": "콘텐츠 특징 설명",

      "recommendationReasons": [
        "기초 개념을 단계별로 설명하여 이해하기 쉬움",
        "풍부한 예제와 연습문제 제공",
        "수능 출제 경향 반영"
      ],
      "targetStudents": ["기초가 부족한 학생", "수능 준비생", "개념 정리가 필요한 학생"],
      "reviewSummary": {
        "averageRating": 4.5,
        "reviewCount": 1200,
        "positives": ["설명이 쉽다", "구성이 체계적이다", "문제 유형이 다양하다"],
        "negatives": ["문제 수가 적다", "해설이 간략하다"],
        "keywords": ["기초", "개념", "입문", "체계적"]
      },
      "strengths": ["단계별 학습 가능", "핵심 정리 제공", "시험 대비에 효과적"],
      "weaknesses": ["심화 문제 부족", "최신 트렌드 미반영"],

      // 📌 강의(lecture)인 경우에만 포함
      "instructorInfo": {
        "name": "강사명",
        "platform": "메가스터디/이투스/대성마이맥/EBS 등",
        "profileSummary": "경력 15년, 수능 출제위원 경험 등",
        "subjectCategories": ["수학"],
        "subjects": ["미적분", "확률과 통계"],
        "specialty": "개념 설명",
        "teachingStyle": "개념형/문풀형/속성형/심화형/균형형 중 하나",
        "difficultyFocus": "개념/기본/심화/최상위 중 하나",
        "lecturePace": "빠름/보통/느림 중 하나",
        "explanationStyle": "친절함/핵심만/반복강조/비유활용 중 하나",
        "reviewScore": 4.7,
        "reviewCount": 5000,
        "targetStudents": ["기초가 부족한 학생", "개념 정리가 필요한 학생"],
        "strengths": ["개념 설명이 명확함", "반복 학습에 효과적"],
        "weaknesses": ["진도가 느림", "심화 문제 풀이 부족"],
        "recommendationReasons": ["기초부터 차근차근 설명", "비유를 활용한 이해하기 쉬운 설명"]
      }
    }
  ]
}

**규칙**:
1. 실제로 존재하는 교재/강의만 포함하세요
2. ⚠️ **title은 출판사/플랫폼의 공식 제목을 그대로 사용하세요**
   - 임의로 연도, 버전, 부제를 추가하거나 수정하지 마세요
   - 예: "EBS 수능특강 국어영역 문학" (O) / "EBS 수능특강 국어영역 문학 (2026년)" (X)
   - 교보문고, YES24, 알라딘 등에 등록된 정확한 상품명을 사용하세요
3. 총 범위를 모르면 합리적으로 추정 (교재: 200-400페이지, 인강: 20-50강)
4. chapters 배열은 전체 범위를 커버해야 합니다
5. 최신판을 우선하되, 널리 사용되는 버전을 선택하세요
6. 3-5개 정도의 추천 결과를 반환하세요
7. 📌 recommendationReasons는 구체적이고 실용적인 이유를 3개 이상 포함하세요
8. 📌 reviewSummary는 실제 온라인 후기를 기반으로 작성하세요 (정보가 없으면 생략 가능)
9. 📌 targetStudents는 이 콘텐츠가 적합한 학생 유형을 명확히 명시하세요
10. 📌 instructorInfo는 contentType이 "lecture"인 경우에만 포함하세요
11. 📌 강사의 teachingStyle, difficultyFocus, lecturePace, explanationStyle은 제시된 옵션 중에서 선택하세요
12. ⏱️ 소요시간 정보:
    - estimatedHours: 전체 학습에 필요한 시간 (시간 단위). 교재는 페이지당 2-3분, 강의는 실제 강의 시간 기준
    - averageEpisodeDuration: 강의인 경우 회당 평균 소요시간 (분 단위). 보통 30-60분
    - chapters.duration: 각 챕터/파트의 총 소요시간 (분 단위). 강의 수 × 평균 시간으로 계산
`;

/**
 * 웹 검색을 실행합니다.
 *
 * Gemini API의 Grounding 기능을 사용하여 웹에서 교재/강의 정보를 검색합니다.
 * 검색 결과는 JSON 텍스트로 반환되며, 파싱은 Task 4(parseResults)에서 수행합니다.
 *
 * @param searchQuery - 검색 쿼리 (Task 2의 결과)
 * @returns 검색 결과 (성공 시 rawContent, 실패 시 error)
 *
 * @example
 * const result = await executeWebSearch({
 *   query: "고등학교 수학 미적분 개념 교재 추천 목차",
 *   context: "미적분 개념서"
 * });
 *
 * if (result.success) {
 *   console.log("응답:", result.rawContent);
 *   // 다음 단계: parseResults(result.rawContent)
 * } else {
 *   console.error("실패:", result.error);
 * }
 */
export async function executeWebSearch(
  searchQuery: SearchQuery
): Promise<ExecuteSearchResult> {
  // ────────────────────────────────────────────────────────────────────
  // 1단계: 입력 검증
  // ────────────────────────────────────────────────────────────────────

  if (!searchQuery.query || searchQuery.query.trim() === "") {
    return {
      success: false,
      error: "검색어가 비어있습니다",
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 2단계: Gemini Provider 가져오기
  // ────────────────────────────────────────────────────────────────────

  let provider;
  try {
    provider = getGeminiProvider();
  } catch (error) {
    logError(error, { source: "executeWebSearch", phase: "provider-init" });
    return {
      success: false,
      error: "AI 서비스를 초기화할 수 없습니다. API 키를 확인해주세요.",
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 3단계: 검색 요청 생성
  // ────────────────────────────────────────────────────────────────────

  const userPrompt = `
검색어: "${searchQuery.query}"
찾고자 하는 콘텐츠: ${searchQuery.context}

위 조건에 맞는 학습 콘텐츠의 구조 정보(목차, 총 페이지/강의 수)를 찾아주세요.
JSON 형식으로만 응답해주세요.
`;

  // ────────────────────────────────────────────────────────────────────
  // 4단계: API 호출
  // ────────────────────────────────────────────────────────────────────

  try {
    const response = await provider.createMessage({
      system: COLD_START_SEARCH_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2, // 사실적인 정보 추출을 위해 낮은 temperature
      maxTokens: 16384, // JSON 응답이 잘리지 않도록 충분한 토큰 확보 (Gemini Flash 최대: 65535)
      grounding: { enabled: true, mode: "always" }, // 웹 검색 활성화
    });

    // ────────────────────────────────────────────────────────────────────
    // 5단계: 응답 반환
    // ────────────────────────────────────────────────────────────────────

    if (!response.content || response.content.trim() === "") {
      return {
        success: false,
        error: "AI가 빈 응답을 반환했습니다",
      };
    }

    return {
      success: true,
      rawContent: response.content,
    };
  } catch (error) {
    // ────────────────────────────────────────────────────────────────────
    // 에러 처리
    // ────────────────────────────────────────────────────────────────────

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logError(error, { source: "executeWebSearch", phase: "api-call" });

    // 에러 유형별 사용자 친화적 메시지
    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return {
        success: false,
        error: "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    if (errorMessage.includes("401") || errorMessage.includes("403")) {
      return {
        success: false,
        error: "API 인증에 실패했습니다. API 키를 확인해주세요.",
      };
    }

    if (
      errorMessage.includes("network") ||
      errorMessage.includes("ECONNREFUSED")
    ) {
      return {
        success: false,
        error: "네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요.",
      };
    }

    return {
      success: false,
      error: `검색 중 오류가 발생했습니다: ${errorMessage}`,
    };
  }
}

// ============================================================================
// 테스트용 Mock 함수
// ============================================================================

/**
 * Mock 검색 결과를 반환합니다.
 *
 * API 호출 없이 테스트할 때 사용합니다.
 * 실제 검색 결과와 유사한 형식의 데이터를 반환합니다.
 *
 * @param searchQuery - 검색 쿼리
 * @returns Mock 검색 결과
 */
export function getMockSearchResult(searchQuery: SearchQuery): ExecuteSearchResult {
  const mockResponse = {
    results: [
      {
        title: `${searchQuery.context} - 기본서`,
        author: "홍길동",
        publisher: "교육출판사",
        contentType: "book",
        totalRange: 320,
        chapters: [
          { title: "1장. 기초 개념", startRange: 1, endRange: 60 },
          { title: "2장. 핵심 이론", startRange: 61, endRange: 150 },
          { title: "3장. 응용 문제", startRange: 151, endRange: 250 },
          { title: "4장. 실전 연습", startRange: 251, endRange: 320 },
        ],
        description: "기초부터 심화까지 체계적으로 학습할 수 있는 교재",
      },
      {
        title: `${searchQuery.context} - 완성`,
        author: "김영희",
        publisher: "학습미디어",
        contentType: "lecture",
        totalRange: 45,
        chapters: [
          { title: "개념 정리", startRange: 1, endRange: 15 },
          { title: "유형별 풀이", startRange: 16, endRange: 30 },
          { title: "실전 모의고사", startRange: 31, endRange: 45 },
        ],
        description: "단기간에 핵심을 정리할 수 있는 인강",
      },
    ],
  };

  return {
    success: true,
    rawContent: JSON.stringify(mockResponse, null, 2),
  };
}
