/**
 * 플랜 생성 프롬프트
 *
 * Claude API를 사용한 학습 플랜 자동 생성을 위한 프롬프트입니다.
 */

import type {
  LLMPlanGenerationRequest,
  StudentInfo,
  SubjectScore,
  ContentInfo,
  LearningHistory,
  PlanGenerationSettings,
  TimeSlotInfo,
} from "../types";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 한국의 대학 입시를 준비하는 학생들을 위한 전문 학습 플래너입니다.
학생의 성적, 학습 이력, 콘텐츠 정보를 분석하여 최적화된 학습 계획을 생성합니다.

## 핵심 원칙

1. **개인화**: 학생의 현재 수준, 목표, 취약점을 고려한 맞춤형 계획
2. **실현 가능성**: 하루 학습량이 설정된 시간을 초과하지 않도록 조절
3. **균형**: 과목 간 균형을 유지하면서 취약 과목에 더 많은 시간 배분
4. **복습 포함**: 에빙하우스 망각 곡선을 고려한 적절한 복습 시점 설정
5. **유연성**: 예비 시간을 두어 일정 지연에 대비

## 출력 형식

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.

\`\`\`json
{
  "weeklyMatrices": [
    {
      "weekNumber": 1,
      "weekStart": "YYYY-MM-DD",
      "weekEnd": "YYYY-MM-DD",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "dayOfWeek": 0,
          "totalMinutes": 180,
          "plans": [
            {
              "date": "YYYY-MM-DD",
              "dayOfWeek": 0,
              "slotId": "slot-1",
              "startTime": "08:00",
              "endTime": "08:50",
              "contentId": "content-uuid",
              "contentTitle": "콘텐츠 제목",
              "subject": "수학",
              "subjectCategory": "수학 가형",
              "rangeStart": 1,
              "rangeEnd": 20,
              "rangeDisplay": "p.1-20",
              "estimatedMinutes": 50,
              "isReview": false,
              "notes": "집중력이 높은 아침에 수학 배치",
              "priority": "high"
            }
          ],
          "dailySummary": "오늘의 핵심: 수학 개념 정리 및 국어 문학 복습"
        }
      ],
      "weeklySummary": "이번 주 목표: 수학 기초 개념 완성, 국어 문학 1회독 완료"
    }
  ],
  "totalPlans": 28,
  "recommendations": {
    "studyTips": [
      "아침 시간에 수학, 오후에 암기 과목 배치 추천",
      "50분 학습 후 10분 휴식 권장"
    ],
    "warnings": [
      "하루 6시간 이상 학습은 집중력 저하 우려"
    ],
    "suggestedAdjustments": [
      "영어 학습 시간을 늘리는 것을 권장"
    ],
    "focusAreas": [
      "수학 미적분 파트 집중 필요"
    ]
  }
}
\`\`\`

## 주의사항

- 모든 시간은 24시간 형식 (HH:mm)
- 날짜는 ISO 형식 (YYYY-MM-DD)
- dayOfWeek: 0=일요일, 6=토요일
- rangeDisplay: 책은 "p.시작-끝", 강의는 "시작-끝강"
- estimatedMinutes: 해당 범위를 학습하는 데 필요한 예상 시간
- isReview: 복습인 경우 true
- priority: "high" | "medium" | "low"
`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

function formatStudentInfo(student: StudentInfo): string {
  return `
## 학생 정보
- 이름: ${student.name}
- 학년: ${student.grade}학년
${student.school ? `- 학교: ${student.school}` : ""}
${student.targetUniversity ? `- 목표 대학: ${student.targetUniversity}` : ""}
${student.targetMajor ? `- 목표 학과: ${student.targetMajor}` : ""}
`.trim();
}

function formatScores(scores: SubjectScore[]): string {
  if (scores.length === 0) return "";

  const scoreLines = scores.map((s) => {
    const parts = [`- ${s.subject}`];
    if (s.subjectCategory) parts.push(`(${s.subjectCategory})`);
    if (s.grade) parts.push(`등급: ${s.grade}`);
    if (s.percentile) parts.push(`백분위: ${s.percentile}`);
    if (s.isWeak) parts.push("⚠️ 취약");
    if (s.recentTrend) {
      const trendEmoji = {
        improving: "📈",
        stable: "➡️",
        declining: "📉",
      }[s.recentTrend];
      parts.push(trendEmoji);
    }
    return parts.join(" ");
  });

  return `
## 성적 현황
${scoreLines.join("\n")}
`.trim();
}

function formatContents(contents: ContentInfo[]): string {
  const contentLines = contents.map((c) => {
    const parts = [`- [${c.id}] ${c.title}`];
    parts.push(`(${c.subject})`);
    if (c.contentType === "book" && c.totalPages) {
      parts.push(`총 ${c.totalPages}페이지`);
    } else if (c.contentType === "lecture" && c.totalLectures) {
      parts.push(`총 ${c.totalLectures}강`);
    }
    if (c.estimatedHoursTotal) {
      parts.push(`예상 ${c.estimatedHoursTotal}시간`);
    }
    if (c.difficulty) {
      const diffEmoji = { easy: "🟢", medium: "🟡", hard: "🔴" }[c.difficulty];
      parts.push(diffEmoji);
    }
    if (c.priority) {
      parts.push(`[${c.priority}]`);
    }
    return parts.join(" ");
  });

  return `
## 학습 콘텐츠 (${contents.length}개)
${contentLines.join("\n")}
`.trim();
}

function formatLearningHistory(history: LearningHistory): string {
  const parts = [
    `- 완료한 플랜 수: ${history.totalPlansCompleted}개`,
    `- 평균 완료율: ${history.averageCompletionRate}%`,
    `- 평균 일일 학습 시간: ${history.averageDailyStudyMinutes}분`,
  ];

  if (history.preferredStudyTimes?.length) {
    const timeLabels = {
      morning: "아침",
      afternoon: "오후",
      evening: "저녁",
      night: "밤",
    };
    const times = history.preferredStudyTimes
      .map((t) => timeLabels[t as keyof typeof timeLabels] || t)
      .join(", ");
    parts.push(`- 선호 학습 시간대: ${times}`);
  }

  if (history.frequentlyIncompleteSubjects?.length) {
    parts.push(
      `- 자주 미완료되는 과목: ${history.frequentlyIncompleteSubjects.join(", ")}`
    );
  }

  return `
## 학습 이력 분석
${parts.join("\n")}
`.trim();
}

function formatSettings(settings: PlanGenerationSettings): string {
  const parts = [
    `- 기간: ${settings.startDate} ~ ${settings.endDate}`,
    `- 하루 학습 시간: ${settings.dailyStudyMinutes}분 (${Math.round(settings.dailyStudyMinutes / 60)}시간)`,
  ];

  if (settings.breakIntervalMinutes) {
    parts.push(`- 쉬는 시간 간격: ${settings.breakIntervalMinutes}분마다`);
  }
  if (settings.breakDurationMinutes) {
    parts.push(`- 쉬는 시간 길이: ${settings.breakDurationMinutes}분`);
  }
  if (settings.excludeDays?.length) {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const excluded = settings.excludeDays.map((d) => dayNames[d]).join(", ");
    parts.push(`- 제외 요일: ${excluded}요일`);
  }
  if (settings.prioritizeWeakSubjects) {
    parts.push("- ⚠️ 취약 과목 우선 배치");
  }
  if (settings.balanceSubjects) {
    parts.push("- ⚖️ 과목 균형 맞추기");
  }
  if (settings.includeReview) {
    const ratio = settings.reviewRatio
      ? `(${Math.round(settings.reviewRatio * 100)}%)`
      : "";
    parts.push(`- 🔄 복습 포함 ${ratio}`);
  }

  return `
## 플랜 설정
${parts.join("\n")}
`.trim();
}

function formatTimeSlots(slots: TimeSlotInfo[]): string {
  if (slots.length === 0) return "";

  const slotLines = slots.map((s) => {
    const typeEmoji = {
      study: "📖",
      break: "☕",
      meal: "🍚",
      free: "🎮",
    }[s.type];
    return `- [${s.id}] ${s.name}: ${s.startTime}-${s.endTime} ${typeEmoji}`;
  });

  return `
## 시간 슬롯
${slotLines.join("\n")}
`.trim();
}

/**
 * 사용자 프롬프트 생성
 */
export function buildUserPrompt(request: LLMPlanGenerationRequest): string {
  const sections = [
    formatStudentInfo(request.student),
    request.scores?.length ? formatScores(request.scores) : "",
    formatContents(request.contents),
    request.learningHistory
      ? formatLearningHistory(request.learningHistory)
      : "",
    formatSettings(request.settings),
    request.timeSlots?.length ? formatTimeSlots(request.timeSlots) : "",
  ].filter(Boolean);

  let prompt = sections.join("\n\n");

  if (request.additionalInstructions) {
    prompt += `\n\n## 추가 지시사항\n${request.additionalInstructions}`;
  }

  prompt += `

---

위 정보를 바탕으로 ${request.settings.startDate}부터 ${request.settings.endDate}까지의 최적화된 학습 계획을 JSON 형식으로 생성해주세요.
각 콘텐츠의 진도를 적절히 분배하고, 학생의 취약점과 선호도를 고려해주세요.
`;

  return prompt;
}

// ============================================
// 프롬프트 토큰 추정
// ============================================

/**
 * 프롬프트 토큰 수 추정
 */
export function estimatePromptTokens(request: LLMPlanGenerationRequest): {
  systemTokens: number;
  userTokens: number;
  totalTokens: number;
} {
  const userPrompt = buildUserPrompt(request);

  // 한글 문자 수 계산
  const countKorean = (text: string) =>
    (text.match(/[가-힣]/g) || []).length;

  // 대략적인 토큰 추정 (한글 1.5토큰, 영어/기호 0.25토큰)
  const estimateTokens = (text: string) => {
    const korean = countKorean(text);
    const other = text.length - korean;
    return Math.ceil(korean * 1.5 + other * 0.25);
  };

  const systemTokens = estimateTokens(SYSTEM_PROMPT);
  const userTokens = estimateTokens(userPrompt);

  return {
    systemTokens,
    userTokens,
    totalTokens: systemTokens + userTokens,
  };
}
