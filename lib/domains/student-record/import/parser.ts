// ============================================
// Gemini 구조화 파싱 — 생기부 콘텐츠 → RecordImportData
// **클라이언트 전용** — 브라우저에서 Gemini API 직접 호출
// 이미지 데이터가 서버를 거치지 않아 페이로드 문제 없음
//
// @google/genai SDK + gemini-2.5-pro
// 원본 변환기 패턴: 전체 PDF를 한번에 전송
// ============================================

import { GoogleGenAI, Type } from "@google/genai";
import type { ExtractedContent, RecordImportData } from "./types";

// 우선순위: 3.1-pro → 3.1-flash-lite (503/404 시 자동 fallback)
const GEMINI_MODELS = ["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview"] as const;

// ============================================
// Structured Output 스키마 (@google/genai Type 사용)
// ============================================

const RECORD_IMPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    studentInfo: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "학생 이름" },
        schoolName: { type: Type.STRING, description: "학교명" },
        schoolYear: { type: Type.INTEGER, description: "입학년도 (예: 2024)" },
      },
      required: ["name", "schoolName", "schoolYear"],
    },
    detailedCompetencies: {
      type: Type.ARRAY,
      description: "교과학습발달상황의 세부능력 및 특기사항 (세특)",
      items: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING, description: "학년 (예: 1학년, 2학년, 3학년)" },
          semester: { type: Type.STRING, description: "학기 (예: 1학기, 2학기)" },
          subject: { type: Type.STRING, description: "과목명 (예: 국어, 수학Ⅰ, 통합과학1)" },
          content: { type: Type.STRING, description: "해당 과목의 세부능력 및 특기사항 내용" },
        },
        required: ["grade", "semester", "subject", "content"],
      },
    },
    creativeActivities: {
      type: Type.ARRAY,
      description: "창의적 체험활동상황 (자율, 동아리, 진로)",
      items: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING, description: "학년 (예: 1학년)" },
          category: { type: Type.STRING, description: "영역 (예: 자율활동, 동아리활동, 진로활동)" },
          content: { type: Type.STRING, description: "해당 영역의 특기사항 내용" },
        },
        required: ["grade", "category", "content"],
      },
    },
    behavioralCharacteristics: {
      type: Type.ARRAY,
      description: "행동특성 및 종합의견",
      items: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING, description: "학년" },
          content: { type: Type.STRING, description: "해당 학년의 행동특성 및 종합의견 내용" },
        },
        required: ["grade", "content"],
      },
    },
    grades: {
      type: Type.ARRAY,
      description: "교과 성적",
      items: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING },
          semester: { type: Type.STRING },
          subject: { type: Type.STRING },
          subjectType: { type: Type.STRING, description: "공통, 일반선택, 진로선택 등" },
          creditHours: { type: Type.INTEGER, description: "단위수" },
          rawScore: { type: Type.NUMBER, description: "원점수" },
          classAverage: { type: Type.NUMBER, description: "과목평균" },
          standardDeviation: { type: Type.NUMBER, description: "표준편차" },
          achievementLevel: { type: Type.STRING, description: "성취도 (A~E)" },
          totalStudents: { type: Type.INTEGER, description: "수강자수" },
          rankGrade: { type: Type.INTEGER, description: "석차등급 (1~9)" },
        },
        required: ["grade", "semester", "subject"],
      },
    },
    attendance: {
      type: Type.ARRAY,
      description: "출결 상황",
      items: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING },
          authorizedAbsence: { type: Type.INTEGER },
          sickAbsence: { type: Type.INTEGER },
          unauthorizedAbsence: { type: Type.INTEGER },
          lateness: { type: Type.INTEGER },
          earlyLeave: { type: Type.INTEGER },
          classAbsence: { type: Type.INTEGER },
        },
        required: ["grade"],
      },
    },
    readingActivities: {
      type: Type.ARRAY,
      description: "독서활동",
      items: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING },
          subjectArea: { type: Type.STRING, description: "교과 영역 또는 공통" },
          bookTitle: { type: Type.STRING },
          author: { type: Type.STRING },
        },
        required: ["grade", "bookTitle"],
      },
    },
  },
  required: [
    "studentInfo", "detailedCompetencies", "creativeActivities",
    "behavioralCharacteristics", "grades", "attendance", "readingActivities",
  ],
};

// ============================================
// 프롬프트 (원본 변환기 기반 + 확장)
// ============================================

const PROMPT = `당신은 한국의 학교생활기록부(School Record)를 분석하고 구조화된 데이터로 변환하는 전문가입니다.
제공된 데이터는 학교생활기록부의 내용(이미지 또는 HTML 코드)입니다.
다음 지침을 엄격하게 준수하여 데이터를 추출하세요:

1. studentInfo: 학생의 이름, 학교명, 입학년도를 추출하세요.
2. detailedCompetencies: '교과학습발달상황'의 '세부능력 및 특기사항' 섹션의 내용을 찾아 학년별, 학기별, 과목별로 추출하세요.
   - 과목명은 원문 그대로 표기하세요 (예: 통합과학1, 공통국어1, 수학Ⅰ)
   - 2022 개정교육과정의 공통과목(통합과학1/2, 통합사회1/2, 공통국어1/2, 공통수학1/2 등)도 정확히 구분하세요.
   - 학기는 "1학기", "2학기"로 표기하세요.
3. creativeActivities: '창의적 체험활동상황' 섹션의 내용을 찾아 학년별, 영역별(자율활동, 동아리활동, 진로활동)로 추출하세요.
4. behavioralCharacteristics: '행동특성 및 종합의견' 섹션의 내용을 찾아 학년별로 추출하세요.
5. grades: '교과학습발달상황'의 성적 표에서 학년별, 학기별, 과목별 성적 데이터를 추출하세요.
6. attendance: '출결상황' 섹션에서 학년별 출결 데이터를 추출하세요.
7. readingActivities: '독서활동상황' 섹션에서 학년별 독서 기록을 추출하세요.

모든 내용은 원본의 의미와 문장을 훼손하지 않고 누락 없이 정확하게 추출해야 합니다.
학년은 "1학년", "2학년", "3학년" 형식으로 표기하세요.`;

// ============================================
// 클라이언트에서 Gemini 직접 호출
// ============================================

export async function parseRecordContent(
  content: ExtractedContent,
  apiKey: string,
): Promise<RecordImportData> {
  const ai = new GoogleGenAI({ apiKey });
  const parts = buildParts(content);

  // 모델 순회 (503 시 fallback)
  let lastError: Error | null = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [...parts, { text: PROMPT }],
        },
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RECORD_IMPORT_SCHEMA,
        },
      });

      let jsonStr = response.text || "{}";
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

      const parsed: RecordImportData = JSON.parse(jsonStr);
      return validateParsedData(parsed);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable = lastError.message.includes("503") || lastError.message.includes("UNAVAILABLE")
        || lastError.message.includes("404") || lastError.message.includes("Not Found");
      if (!isRetryable) throw lastError; // 재시도 불가능한 에러는 즉시 throw
      // 503이면 다음 모델로 fallback
    }
  }

  throw new Error("Gemini API가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.");
}

// ============================================
// Parts 빌드 (형식별 분기)
// ============================================

function buildParts(content: ExtractedContent) {
  switch (content.format) {
    case "pdf":
      return content.pages.map((base64) => ({
        inlineData: { mimeType: "image/png" as const, data: base64 },
      }));

    case "html":
      return [{ text: content.text }];

    case "image":
      return content.images.map((base64) => ({
        inlineData: { mimeType: "image/png" as const, data: base64 },
      }));
  }
}

// ============================================
// 파싱 결과 검증 / 정규화
// ============================================

function validateParsedData(data: RecordImportData): RecordImportData {
  const normalizeGrade = (g: string): string => {
    const match = g.match(/(\d)/);
    if (match) return `${match[1]}학년`;
    return g;
  };

  const normalizeCategory = (c: string): string => {
    if (c.includes("자율")) return "자율활동";
    if (c.includes("동아리")) return "동아리활동";
    if (c.includes("진로")) return "진로활동";
    return c;
  };

  return {
    ...data,
    detailedCompetencies: (data.detailedCompetencies ?? []).map((d) => ({
      ...d,
      grade: normalizeGrade(d.grade),
    })),
    creativeActivities: (data.creativeActivities ?? []).map((a) => ({
      ...a,
      grade: normalizeGrade(a.grade),
      category: normalizeCategory(a.category),
    })),
    behavioralCharacteristics: (data.behavioralCharacteristics ?? []).map((b) => ({
      ...b,
      grade: normalizeGrade(b.grade),
    })),
    grades: (data.grades ?? []).map((g) => ({
      ...g,
      grade: normalizeGrade(g.grade),
      creditHours: g.creditHours ?? 0,
      rawScore: g.rawScore ?? 0,
      classAverage: g.classAverage ?? 0,
      standardDeviation: g.standardDeviation ?? 0,
      totalStudents: g.totalStudents ?? 0,
      rankGrade: g.rankGrade ?? 0,
    })),
    attendance: (data.attendance ?? []).map((a) => ({
      ...a,
      grade: normalizeGrade(a.grade),
      authorizedAbsence: a.authorizedAbsence ?? 0,
      sickAbsence: a.sickAbsence ?? 0,
      unauthorizedAbsence: a.unauthorizedAbsence ?? 0,
      lateness: a.lateness ?? 0,
      earlyLeave: a.earlyLeave ?? 0,
      classAbsence: a.classAbsence ?? 0,
    })),
    readingActivities: (data.readingActivities ?? []).map((r) => ({
      ...r,
      grade: normalizeGrade(r.grade),
      author: r.author ?? "",
    })),
  };
}
