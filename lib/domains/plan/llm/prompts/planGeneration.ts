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
  LearningStyle,
  ExamSchedule,
  PlanGenerationSettings,
  TimeSlotInfo,
} from "../types";
import type {
  ExtendedLLMPlanGenerationRequest,
  BlockInfoForPrompt,
  AcademyScheduleForPrompt,
  SubjectAllocationForPrompt,
} from "../transformers/requestBuilder";

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

## 시간 슬롯 활용 규칙

- 제공된 시간 슬롯(timeSlots)이 있으면 **반드시** 해당 슬롯에 맞춰 플랜 배치
- slotId를 응답에 포함하여 어떤 슬롯에 배치했는지 명시
- 슬롯의 type이 "study"인 것만 학습 플랜 배치 가능
- 슬롯이 없으면 dailyStudyMinutes를 기준으로 자유 배치

## 취약 과목 우선 배치 전략

**prioritizeWeakSubjects=true인 경우 반드시 적용:**
- 집중력이 높은 아침/오전 시간(08:00-12:00)에 취약 과목(⚠️ 표시) 우선 배치
- 취약 과목에 30-50% 더 많은 시간 할당
- 하루에 최소 1개 이상의 취약 과목 플랜 포함
- 취약 과목 플랜의 priority는 "high"로 설정

## 복습 비율 적용

**includeReview=true인 경우:**
- reviewRatio 값에 따라 전체 플랜 중 복습 플랜 비율 조절 (예: 0.2 = 전체의 20%)
- 에빙하우스 망각곡선 기반 복습 시점: 1일, 3일, 7일 후
- 복습 플랜은 isReview=true로 표시
- 복습 시 이전에 학습한 범위를 notes에 명시

## 콘텐츠 진도 분배

- **책**: 총 페이지를 학습 일수로 나누어 균등 분배, rangeStart/rangeEnd가 연속되도록 배치
- **강의**: 1강당 평균 30-50분 소요 가정, 하루 1-2강 권장
- 난이도가 "hard"(🔴)인 콘텐츠는 더 많은 시간 할당
- 각 콘텐츠의 rangeStart는 이전 플랜의 rangeEnd+1부터 시작

## 제외 규칙

- excludeDays에 명시된 요일에는 플랜 생성 금지
- excludeDates에 명시된 날짜에는 플랜 생성 금지

## 학습 스타일 반영

**learningStyle이 제공된 경우 다음을 적용:**

| 스타일 | 설명 | 권장 배치 |
|--------|------|----------|
| visual (시각형) | 그림, 도표, 영상 선호 | 영상 강의 우선, 아침에 배치 |
| auditory (청각형) | 듣기, 설명 선호 | 오디오 강의 우선, 오후에 배치 |
| kinesthetic (체험형) | 실습, 문제풀이 선호 | 문제집 우선, 집중 시간에 배치 |
| reading (독서형) | 읽기, 텍스트 선호 | 교재 우선, 조용한 시간에 배치 |

- primary 스타일에 맞는 콘텐츠를 60% 이상 배치
- secondary 스타일 콘텐츠를 25% 정도 배치
- preferences가 있으면 해당 선호도 반영

## 시험 일정 고려

**examSchedules가 제공된 경우 다음을 적용:**

### D-day 기반 학습 강도 조절
- **D-30 이상**: 기초 개념 학습, 신규 콘텐츠 진도
- **D-14 ~ D-30**: 심화 학습, 취약 부분 보강
- **D-7 ~ D-14**: 문제 풀이 집중, 오답 정리
- **D-3 ~ D-7**: 핵심 정리, 빈출 유형 반복
- **D-1 ~ D-3**: 최종 점검, 가벼운 복습만

### 시험 유형별 전략
- **midterm/final (내신)**: 학교 교재 위주, 세부 내용 암기
- **mock (모의고사)**: 실전 문제 풀이, 시간 관리 연습
- **suneung (수능)**: EBS 연계, 기출 분석, 컨디션 관리

### 중요도별 시간 배분
- **high**: 해당 과목에 40% 추가 시간
- **medium**: 기본 배분
- **low**: 20% 감소, 다른 과목에 재배분

## Few-shot 예시

### 예시 1: 취약 과목 집중 (1주일, 수학 취약)
입력: 기간 7일, 일일 180분, 수학(취약), 영어, 국어
\`\`\`json
{
  "weeklyMatrices": [{
    "weekNumber": 1,
    "weekStart": "2026-01-06",
    "weekEnd": "2026-01-12",
    "days": [{
      "date": "2026-01-06",
      "dayOfWeek": 1,
      "totalMinutes": 180,
      "plans": [
        {"startTime": "08:00", "endTime": "09:00", "subject": "수학", "contentId": "math-1", "priority": "high", "notes": "오전 집중력 높을 때 취약 과목"},
        {"startTime": "09:10", "endTime": "09:50", "subject": "수학", "contentId": "math-1", "priority": "high", "isReview": false},
        {"startTime": "14:00", "endTime": "14:50", "subject": "영어", "contentId": "eng-1", "priority": "medium"},
        {"startTime": "15:00", "endTime": "15:40", "subject": "국어", "contentId": "kor-1", "priority": "medium"}
      ],
      "dailySummary": "수학 2시간(취약 집중) + 영어/국어 각 50분"
    }],
    "weeklySummary": "수학 집중 강화 주간: 일일 수학 100분 이상 배치"
  }],
  "totalPlans": 28,
  "recommendations": {
    "studyTips": ["수학은 오전에 집중 배치됨", "50분 학습 후 10분 휴식 권장"],
    "warnings": [],
    "focusAreas": ["수학 기초 개념 정립"]
  }
}
\`\`\`

### 예시 2: 시험 D-7 (중간고사 일주일 전)
입력: 시험 D-7, 중간고사, 전 과목
\`\`\`json
{
  "weeklyMatrices": [{
    "weekNumber": 1,
    "days": [{
      "date": "2026-01-06",
      "totalMinutes": 240,
      "plans": [
        {"startTime": "08:00", "endTime": "09:30", "subject": "수학", "notes": "핵심 공식 정리 및 빈출 유형", "isReview": true, "priority": "high"},
        {"startTime": "10:00", "endTime": "11:00", "subject": "영어", "notes": "단어 암기 및 독해 실전", "isReview": true, "priority": "high"},
        {"startTime": "14:00", "endTime": "15:00", "subject": "국어", "notes": "문학 작품 핵심 정리", "isReview": true, "priority": "high"},
        {"startTime": "19:00", "endTime": "20:00", "subject": "수학", "notes": "오답 노트 복습", "isReview": true, "priority": "high"}
      ],
      "dailySummary": "D-7: 전 과목 핵심 정리 및 빈출 유형 집중"
    }]
  }],
  "recommendations": {
    "studyTips": ["새로운 내용보다 복습에 집중", "컨디션 관리 중요"],
    "warnings": ["시험 직전이므로 무리하지 마세요"],
    "focusAreas": ["오답 정리", "핵심 공식 암기"]
  }
}
\`\`\`

### 예시 3: 시각형 학습자 (영상 강의 선호)
입력: 시각형(visual), 강의 콘텐츠 3개, 교재 2개
\`\`\`json
{
  "weeklyMatrices": [{
    "days": [{
      "date": "2026-01-06",
      "plans": [
        {"startTime": "08:00", "endTime": "09:00", "subject": "수학", "contentId": "video-math", "contentTitle": "수학 개념 영상", "notes": "시각형 학습자: 영상으로 개념 이해"},
        {"startTime": "09:10", "endTime": "10:00", "subject": "수학", "contentId": "book-math", "contentTitle": "수학 문제집", "notes": "영상 학습 후 문제로 확인"},
        {"startTime": "14:00", "endTime": "15:00", "subject": "영어", "contentId": "video-eng", "contentTitle": "영어 강의", "notes": "시각형 학습자: 자막 있는 영상 선호"}
      ],
      "dailySummary": "영상 강의 70% + 교재 30% 배치 (시각형 학습자)"
    }]
  }],
  "recommendations": {
    "studyTips": ["영상 강의는 1.25배속 권장", "노트 필기와 병행하면 효과 UP"],
    "focusAreas": ["시각 자료 활용 극대화"]
  }
}
\`\`\`

## 학원 일정 규칙 (CRITICAL)

학원 일정이 제공된 경우 **반드시** 다음 규칙을 적용:
- 학원 시간에는 **절대** 학습 플랜 배치 금지
- 이동 시간(travelTime)도 학습 불가 시간으로 처리
- 예: 학원 16:00-18:00, 이동시간 30분 → 15:30-18:00 학습 불가

## 시간 블록 규칙

블록 정보(blocks)가 제공된 경우:
- 각 플랜은 블록 시간 범위 내에 배치
- blockIndex를 응답에 포함하여 어떤 블록에 배치했는지 명시
- 블록 경계를 넘는 플랜은 분할 권장

## 과목 할당 규칙

과목 할당 정보(subjectAllocations)가 제공된 경우:
- **strategy (전략 과목)**: 오후/저녁에 배치, 유지/보강 목적
- **weakness (취약 과목)**: 오전 집중력 높은 시간에 우선 배치
- subjectType을 응답에 포함

## 주의사항

- 모든 시간은 24시간 형식 (HH:mm)
- 날짜는 ISO 형식 (YYYY-MM-DD)
- dayOfWeek: 0=일요일, 6=토요일
- rangeDisplay: 책은 "p.시작-끝", 강의는 "시작-끝강"
- estimatedMinutes: 해당 범위를 학습하는 데 필요한 예상 시간
- isReview: 복습인 경우 true
- priority: "high" | "medium" | "low"
- **contentId는 반드시 제공된 콘텐츠 목록의 ID만 사용**
- **시험 일정이 있으면 D-day 기반 강도 조절 필수**
- **학습 스타일이 있으면 해당 스타일 콘텐츠 우선 배치**
- **학원 일정이 있으면 해당 시간 학습 배치 금지**

## 확장 출력 필드 (선택)

플랜 아이템에 다음 필드를 포함하면 더 정확한 저장이 가능합니다:
- contentType: "book" | "lecture" | "custom" (콘텐츠 유형)
- blockIndex: 0, 1, 2... (해당 시간의 블록 인덱스)
- subjectType: "strategy" | "weakness" | null (전략/취약 구분)
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
  if (settings.excludeDates?.length) {
    parts.push(`- 🚫 제외 날짜: ${settings.excludeDates.join(", ")}`);
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

// ============================================
// Phase 2: 확장 포맷 함수
// ============================================

/**
 * 학원 일정 포맷 (CRITICAL - 학습 불가 시간)
 */
function formatAcademySchedules(schedules: AcademyScheduleForPrompt[]): string {
  if (schedules.length === 0) return "";

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const scheduleLines = schedules.map((s) => {
    const dayName = dayNames[s.dayOfWeek];
    const travelNote = s.travelTime ? ` (이동시간 ${s.travelTime}분)` : "";
    const academyNote = s.academyName ? `${s.academyName}` : "학원";
    const subjectNote = s.subject ? ` - ${s.subject}` : "";
    return `- ${dayName}요일 ${s.startTime}-${s.endTime}: ${academyNote}${subjectNote}${travelNote}`;
  });

  return `
## 🚨 학원 일정 (학습 불가 시간 - CRITICAL)
**이 시간에는 절대로 학습 플랜을 배치하지 마세요!**
${scheduleLines.join("\n")}
`.trim();
}

/**
 * 블록 정보 포맷
 */
function formatBlocks(blocks: BlockInfoForPrompt[]): string {
  if (blocks.length === 0) return "";

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 요일별로 그룹화
  const blocksByDay = new Map<number, BlockInfoForPrompt[]>();
  for (const block of blocks) {
    const dayBlocks = blocksByDay.get(block.dayOfWeek) || [];
    dayBlocks.push(block);
    blocksByDay.set(block.dayOfWeek, dayBlocks);
  }

  const dayLines: string[] = [];
  for (let day = 0; day < 7; day++) {
    const dayBlocks = blocksByDay.get(day);
    if (!dayBlocks || dayBlocks.length === 0) continue;

    const sorted = dayBlocks.sort((a, b) => a.blockIndex - b.blockIndex);
    const blockTexts = sorted.map((b) => {
      const name = b.blockName ? ` (${b.blockName})` : "";
      return `[${b.blockIndex}] ${b.startTime}-${b.endTime}${name}`;
    });
    dayLines.push(`- ${dayNames[day]}요일: ${blockTexts.join(", ")}`);
  }

  return `
## 시간 블록
플랜 배치 시 다음 블록 인덱스를 참고하세요:
${dayLines.join("\n")}
`.trim();
}

/**
 * 과목 할당 정보 포맷
 */
function formatSubjectAllocations(allocations: SubjectAllocationForPrompt[]): string {
  if (allocations.length === 0) return "";

  const strategyItems = allocations.filter((a) => a.subjectType === "strategy");
  const weaknessItems = allocations.filter((a) => a.subjectType === "weakness");

  const lines: string[] = [];

  if (strategyItems.length > 0) {
    const strategyText = strategyItems
      .map((a) => `${a.subject}${a.subjectCategory ? ` (${a.subjectCategory})` : ""}`)
      .join(", ");
    lines.push(`- 📈 **전략 과목**: ${strategyText}`);
    lines.push(`  → 오후/저녁에 배치, 유지/보강 목적`);
  }

  if (weaknessItems.length > 0) {
    const weaknessText = weaknessItems
      .map((a) => `${a.subject}${a.subjectCategory ? ` (${a.subjectCategory})` : ""}`)
      .join(", ");
    lines.push(`- ⚠️ **취약 과목**: ${weaknessText}`);
    lines.push(`  → 오전 집중력 높은 시간에 우선 배치`);
  }

  if (lines.length === 0) return "";

  return `
## 과목 할당 전략
${lines.join("\n")}
`.trim();
}

function formatLearningStyle(style: LearningStyle): string {
  const styleLabels: Record<string, string> = {
    visual: "시각형 (영상, 도표, 그림 선호)",
    auditory: "청각형 (듣기, 설명 선호)",
    kinesthetic: "체험형 (실습, 문제풀이 선호)",
    reading: "독서형 (읽기, 텍스트 선호)",
  };

  const parts = [`- 주요 스타일: 🎯 ${styleLabels[style.primary] || style.primary}`];

  if (style.secondary) {
    parts.push(`- 보조 스타일: ${styleLabels[style.secondary] || style.secondary}`);
  }

  if (style.preferences) {
    const prefs: string[] = [];
    if (style.preferences.preferVideo) prefs.push("📹 영상 강의");
    if (style.preferences.preferProblemSolving) prefs.push("✏️ 문제 풀이");
    if (style.preferences.preferSummary) prefs.push("📝 요약 정리");
    if (style.preferences.preferRepetition) prefs.push("🔁 반복 학습");
    if (prefs.length > 0) {
      parts.push(`- 선호 학습법: ${prefs.join(", ")}`);
    }
  }

  return `
## 학습 스타일
${parts.join("\n")}
`.trim();
}

function formatExamSchedules(exams: ExamSchedule[], startDate: string): string {
  if (exams.length === 0) return "";

  const start = new Date(startDate);

  const examLines = exams.map((exam) => {
    const examDate = new Date(exam.examDate);
    const diffTime = examDate.getTime() - start.getTime();
    const dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const typeLabels: Record<string, string> = {
      midterm: "중간고사",
      final: "기말고사",
      mock: "모의고사",
      suneung: "수능",
      other: "기타 시험",
    };

    const importanceEmoji: Record<string, string> = {
      high: "🔴",
      medium: "🟡",
      low: "🟢",
    };

    const parts = [
      `- ${importanceEmoji[exam.importance || "medium"]} **${exam.examName}** (${typeLabels[exam.examType] || exam.examType})`,
      `  - 📅 시험일: ${exam.examDate} (D-${dDay > 0 ? dDay : "Day"})`,
    ];

    if (exam.subjects?.length) {
      parts.push(`  - 📚 과목: ${exam.subjects.join(", ")}`);
    }

    return parts.join("\n");
  });

  // D-day 기반 현재 상태 안내
  const nearestExam = exams.reduce((nearest, exam) => {
    const examDate = new Date(exam.examDate);
    const nearestDate = new Date(nearest.examDate);
    return examDate < nearestDate ? exam : nearest;
  });
  const nearestDate = new Date(nearestExam.examDate);
  const daysUntil = Math.ceil((nearestDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  let phaseGuide = "";
  if (daysUntil <= 3) {
    phaseGuide = "⚡ **D-3 이내**: 최종 점검 모드 - 가벼운 복습만, 컨디션 관리 우선";
  } else if (daysUntil <= 7) {
    phaseGuide = "🎯 **D-7 이내**: 핵심 정리 모드 - 빈출 유형 반복, 오답 정리";
  } else if (daysUntil <= 14) {
    phaseGuide = "📝 **D-14 이내**: 문제 풀이 모드 - 실전 연습, 취약 보강";
  } else if (daysUntil <= 30) {
    phaseGuide = "📖 **D-30 이내**: 심화 학습 모드 - 개념 완성, 응용력 강화";
  } else {
    phaseGuide = "🌱 **D-30 이상**: 기초 학습 모드 - 신규 콘텐츠 진도, 기본기 다지기";
  }

  return `
## 시험 일정
${examLines.join("\n")}

### 현재 학습 페이즈
${phaseGuide}
`.trim();
}

/**
 * 사용자 프롬프트 생성
 */
export function buildUserPrompt(request: LLMPlanGenerationRequest | ExtendedLLMPlanGenerationRequest): string {
  // Extended request인지 확인
  const extRequest = request as ExtendedLLMPlanGenerationRequest;
  const hasAcademySchedules = extRequest.academySchedules && extRequest.academySchedules.length > 0;
  const hasBlocks = extRequest.blocks && extRequest.blocks.length > 0;
  const hasAllocations = extRequest.subjectAllocations && extRequest.subjectAllocations.length > 0;

  const sections = [
    formatStudentInfo(request.student),
    request.scores?.length ? formatScores(request.scores) : "",
    formatContents(request.contents),
    request.learningHistory
      ? formatLearningHistory(request.learningHistory)
      : "",
    request.learningStyle
      ? formatLearningStyle(request.learningStyle)
      : "",
    request.examSchedules?.length
      ? formatExamSchedules(request.examSchedules, request.settings.startDate)
      : "",
    formatSettings(request.settings),
    request.timeSlots?.length ? formatTimeSlots(request.timeSlots) : "",
    // Phase 2: 확장 섹션
    hasAcademySchedules ? formatAcademySchedules(extRequest.academySchedules!) : "",
    hasBlocks ? formatBlocks(extRequest.blocks!) : "",
    hasAllocations ? formatSubjectAllocations(extRequest.subjectAllocations!) : "",
  ].filter(Boolean);

  let prompt = sections.join("\n\n");

  if (request.additionalInstructions) {
    prompt += `\n\n## 추가 지시사항\n${request.additionalInstructions}`;
  }

  // 시험 일정이 있으면 강조
  const hasExam = request.examSchedules && request.examSchedules.length > 0;
  const hasStyle = !!request.learningStyle;

  let contextNote = "";
  if (hasExam && hasStyle) {
    contextNote = "시험 일정과 학습 스타일을 모두 고려하여 ";
  } else if (hasExam) {
    contextNote = "시험 일정(D-day)을 고려하여 ";
  } else if (hasStyle) {
    contextNote = "학생의 학습 스타일을 고려하여 ";
  }

  // Phase 2: 학원 일정 강조
  let academyNote = "";
  if (hasAcademySchedules) {
    academyNote = "\n**중요: 학원 일정 시간에는 절대로 학습 플랜을 배치하지 마세요!**";
  }

  prompt += `

---

위 정보를 바탕으로 ${request.settings.startDate}부터 ${request.settings.endDate}까지의 ${contextNote}최적화된 학습 계획을 JSON 형식으로 생성해주세요.
각 콘텐츠의 진도를 적절히 분배하고, 학생의 취약점과 선호도를 고려해주세요.${academyNote}
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
