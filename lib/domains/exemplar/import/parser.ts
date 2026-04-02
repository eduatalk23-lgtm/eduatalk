// ============================================
// 합격 생기부 PDF → ExemplarParsedData 파서
// Claude API (multimodal PDF) 사용
// 서버 전용 — scripts 또는 Server Action에서 호출
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import type { ExemplarParsedData, ParseError } from "../types";

const anthropic = new Anthropic();

// 최대 페이지 수 (Claude API 제한)
const MAX_PAGES_PER_REQUEST = 100; // Claude supports up to 100 pages in a PDF

/**
 * PDF 파일을 읽고 Claude API로 구조화된 생기부 데이터 추출
 */
export async function parseExemplarPdf(
  filePath: string,
  options?: { model?: string }
): Promise<ExemplarParsedData> {
  const model = options?.model ?? "claude-sonnet-4-20250514";

  // PDF를 base64로 읽기
  const pdfBuffer = readFileSync(filePath);
  const pdfBase64 = pdfBuffer.toString("base64");
  const fileSizeMB = pdfBuffer.length / (1024 * 1024);

  console.log(`[exemplar-parser] Reading ${filePath} (${fileSizeMB.toFixed(1)}MB)`);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 16384,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: PARSE_PROMPT,
          },
        ],
      },
    ],
  });

  // 응답에서 JSON 추출
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude API 응답에 텍스트 블록이 없습니다");
  }

  const rawText = textBlock.text;

  // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error("Claude API 응답에서 JSON을 추출할 수 없습니다");
  }

  const parsed: ExemplarParsedData = JSON.parse(jsonMatch[1]);

  // 메타데이터 보강
  parsed.metadata = {
    sourceFilePath: filePath,
    sourceFileFormat: "pdf",
    parseQualityScore: calculateQualityScore(parsed),
    parseErrors: validateParsedData(parsed),
    parsedBy: model,
  };

  // 원문 보존: Claude에게 별도로 요청하지 않고 파싱 결과만 저장
  // raw_content는 별도 OCR 패스에서 추출하거나 향후 구현

  return parsed;
}

/**
 * 파싱 품질 점수 산출 (0~100)
 */
function calculateQualityScore(data: ExemplarParsedData): number {
  let score = 0;
  const maxScore = 100;

  // 필수 섹션 존재 (각 20점)
  if (data.grades?.length > 0) score += 20;
  if (data.seteks?.length > 0) score += 20;
  if (data.haengteuk?.length > 0) score += 20;

  // 중요 섹션 (각 10점)
  if (data.creativeActivities?.length > 0) score += 10;
  if (data.attendance?.length > 0) score += 10;

  // 보조 섹션 (각 5점)
  if (data.reading?.length > 0) score += 5;
  if (data.awards?.length > 0) score += 5;
  if (data.enrollment?.length > 0) score += 5;

  // 데이터 풍부도 보너스 (최대 5점)
  const setekCount = data.seteks?.length ?? 0;
  if (setekCount >= 10) score += 5;
  else if (setekCount >= 5) score += 3;

  return Math.min(score, maxScore);
}

/**
 * 파싱 결과 검증
 */
function validateParsedData(data: ExemplarParsedData): ParseError[] {
  const errors: ParseError[] = [];

  if (!data.studentInfo?.schoolName) {
    errors.push({ section: "studentInfo", message: "학교명 미추출", severity: "error" });
  }
  if (!data.studentInfo?.enrollmentYear) {
    errors.push({ section: "studentInfo", message: "입학연도 미추출", severity: "error" });
  }
  if (!data.grades || data.grades.length === 0) {
    errors.push({ section: "grades", message: "교과 성적 미추출", severity: "error" });
  }
  if (!data.seteks || data.seteks.length === 0) {
    errors.push({ section: "seteks", message: "세특 미추출", severity: "error" });
  }
  if (!data.haengteuk || data.haengteuk.length === 0) {
    errors.push({ section: "haengteuk", message: "행특 미추출", severity: "warning" });
  }
  if (!data.creativeActivities || data.creativeActivities.length === 0) {
    errors.push({ section: "creativeActivities", message: "창체 미추출", severity: "warning" });
  }
  if (!data.attendance || data.attendance.length === 0) {
    errors.push({ section: "attendance", message: "출결 미추출", severity: "warning" });
  }

  // 학년 일관성 검증
  const grades = new Set(data.seteks?.map((s) => s.grade) ?? []);
  if (grades.size > 0 && !grades.has(1)) {
    errors.push({ section: "seteks", message: "1학년 세특 누락", severity: "warning" });
  }

  return errors;
}

// ============================================
// Claude에게 보낼 파싱 프롬프트
// ============================================

const PARSE_PROMPT = `이 PDF는 한국 고등학교 학교생활기록부(생기부)입니다.
전체 내용을 아래 JSON 스키마에 맞춰 구조화해주세요.

## 규칙
1. **모든 텍스트를 빠짐없이 추출**합니다. 요약하지 마세요.
2. **개인정보(주민등록번호, 주소)는 제외**합니다. 이름과 학교명은 추출합니다.
3. 학년은 숫자(1, 2, 3), 학기는 숫자(1, 2)로 표기합니다.
4. 성적표의 숫자(원점수, 평균, 표준편차, 등급, 수강자수)를 정확히 추출합니다.
5. 세특(세부능력 및 특기사항)은 과목별로 한 글자도 빠짐없이 전체 본문을 추출합니다.
6. 창체 특기사항도 전문을 추출합니다.
7. 독서활동은 학년/과목 영역별로 전체 텍스트를 추출하되, 가능하면 책 제목과 저자를 분리합니다.
8. 봉사활동 실적은 날짜, 기관, 내용, 시간을 각 행마다 추출합니다.
9. 성취도가 A/B/C만 있고 석차등급이 없는 과목은 rankGrade를 null로 둡니다.
10. 체육/예술 과목(운동과건강생활, 음악, 미술 등)은 peArtGrades에 넣습니다.
11. 해당 섹션이 PDF에 없으면 빈 배열 []을 반환합니다.
12. 진로희망사항이 있으면 (2018년 이전 기록) careerAspirations에 추출합니다.
13. 수상경력의 "참가대상(참가인원)"은 participants 필드에 원문 그대로 넣습니다.

## JSON 스키마

\`\`\`json
{
  "studentInfo": {
    "name": "학생 이름",
    "schoolName": "학교명",
    "enrollmentYear": 2015,
    "graduationYear": 2018
  },
  "admissions": [],
  "enrollment": [
    {
      "grade": 1,
      "className": "06",
      "studentNumber": "1",
      "homeroomTeacher": "정민우"
    }
  ],
  "attendance": [
    {
      "grade": 1,
      "schoolDays": 192,
      "absenceSick": 0, "absenceUnauthorized": 0, "absenceOther": 0,
      "latenessSick": 0, "latenessUnauthorized": 0, "latenessOther": 0,
      "earlyLeaveSick": 0, "earlyLeaveUnauthorized": 0, "earlyLeaveOther": 0,
      "classAbsenceSick": 0, "classAbsenceUnauthorized": 0, "classAbsenceOther": 0,
      "notes": "개근"
    }
  ],
  "awards": [
    {
      "grade": 1,
      "awardName": "학교장 모범학생 표창(자치자율부문)",
      "awardLevel": null,
      "awardDate": "2015.06.03",
      "awardingBody": "영동고등학교장",
      "participants": "전교생 (1,461명)"
    }
  ],
  "certifications": [
    {
      "certName": "경제이해력검증시험(TESAT) 2급",
      "certLevel": "2급",
      "certNumber": null,
      "issuingOrg": "한국경제신문사",
      "certDate": "2016.02.21"
    }
  ],
  "careerAspirations": [
    {
      "grade": 1,
      "studentAspiration": "마케팅 디렉터",
      "parentAspiration": "국제 기구 종사자",
      "reason": "평소 상대방의 의사 표현에 경청하고...",
      "specialSkillsHobbies": "피아노 연주, 영화 감상"
    }
  ],
  "creativeActivities": [
    {
      "grade": 1,
      "activityType": "autonomy",
      "activityName": null,
      "hours": 106,
      "content": "[자치 활동] 제42기 전교학생회 안전부 차장..."
    },
    {
      "grade": 1,
      "activityType": "club",
      "activityName": "경제동아리(Y.E.S)",
      "hours": 33,
      "content": "경제,시사 주제 토론 시 담뱃값 인상이라는..."
    },
    {
      "grade": 1,
      "activityType": "volunteer",
      "activityName": null,
      "hours": null,
      "content": "(봉사 특기사항이 있는 경우만)"
    },
    {
      "grade": 1,
      "activityType": "career",
      "hours": 35,
      "content": "계열탐색과 적성검사를 통해..."
    }
  ],
  "volunteerRecords": [
    {
      "grade": 1,
      "activityDate": "2015.05.09.",
      "location": "(개인)서울국제휠체어마라톤조직위원회",
      "description": "장애 인식 개선 위한 휠체어마라톤 캠페인 참여 및 경기장 정리",
      "hours": 5,
      "cumulativeHours": 5
    }
  ],
  "grades": [
    {
      "grade": 1,
      "semester": 1,
      "subjectName": "국어Ⅰ",
      "subjectType": null,
      "creditHours": 4,
      "rawScore": 96,
      "classAverage": 71.1,
      "stdDev": 19.2,
      "rankGrade": 1,
      "achievementLevel": "A",
      "totalStudents": 429,
      "classRank": null,
      "achievementRatio": null
    }
  ],
  "seteks": [
    {
      "grade": 1,
      "semester": 1,
      "subjectName": "국어Ⅰ",
      "content": "수업 내용에 대한 이해가 빠르고 교사의 질문에 적절하게 답변할 수 있는..."
    }
  ],
  "peArtGrades": [
    {
      "grade": 1,
      "semester": 1,
      "subjectName": "운동과건강생활",
      "creditHours": 2,
      "achievementLevel": "A",
      "content": null
    }
  ],
  "reading": [
    {
      "grade": 1,
      "subjectArea": "사회",
      "bookDescription": "(1학기) 경제동아리 소속으로 기초 경제 상식을 배우고자 '경제공부의 바다에 빠져라(이명로)'를 읽고...",
      "bookTitle": "경제공부의 바다에 빠져라",
      "author": "이명로"
    }
  ],
  "haengteuk": [
    {
      "grade": 1,
      "content": "학교 활동의 여러 방면에 관심을 갖고 모범적으로 참여하는 학생임..."
    }
  ]
}
\`\`\`

위 스키마의 JSON만 출력해주세요. 설명이나 주석 없이 순수 JSON만 \`\`\`json 블록 안에 넣어주세요.`;
