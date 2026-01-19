# Unified Plan Generation API Guide

## 작성일: 2025-01-19

---

## 개요

Unified Plan Generation Pipeline은 AI 콘텐츠 추천부터 스케줄 생성, 마크다운 출력까지 통합된 플랜 생성 API입니다.

### 주요 특징

- **7단계 파이프라인**: 입력 검증 → 콘텐츠 해결 → 스케줄 생성 → 검증/조정 → 저장 → 출력
- **AI Cold Start**: 신규 사용자를 위한 콘텐츠 자동 추천
- **1730 Timetable**: 6일 학습 + 1일 복습 사이클 지원
- **마크다운 출력**: 주차별 그룹핑된 학습 플랜 문서 생성

---

## API 엔드포인트

### POST /api/plan/generate

플랜을 생성하고 DB에 저장합니다.

```typescript
// Request Body
{
  "studentId": "uuid",
  "tenantId": "uuid",
  "planName": "1학기 수학 학습",
  "planPurpose": "내신대비", // "내신대비" | "모의고사" | "수능" | "기타"
  "periodStart": "2025-03-01",
  "periodEnd": "2025-03-31",
  "timeSettings": {
    "studyHours": { "start": "09:00", "end": "22:00" },
    "lunchTime": { "start": "12:00", "end": "13:00" }
  },
  "academySchedules": [
    { "dayOfWeek": 1, "startTime": "14:00", "endTime": "16:00", "subject": "수학" }
  ],
  "exclusions": [
    { "date": "2025-03-15", "reason": "휴일" }
  ],
  "contentSelection": {
    "subjectCategory": "수학",
    "subject": "미적분",
    "difficulty": "개념",
    "contentType": "book",
    "maxResults": 5
  },
  "timetableSettings": {
    "studyDays": 6,
    "reviewDays": 1,
    "studentLevel": "medium", // "high" | "medium" | "low"
    "subjectType": "weakness", // "strategy" | "weakness"
    "weeklyDays": 3, // strategy일 때 필수 (2 | 3 | 4)
    "distributionStrategy": "even" // "even" | "front_loaded" | "back_loaded"
  },
  "generationOptions": {
    "saveToDb": true,
    "generateMarkdown": true
  }
}

// Response (Success)
{
  "success": true,
  "planGroup": {
    "id": "uuid",
    "name": "1학기 수학 학습",
    "periodStart": "2025-03-01",
    "periodEnd": "2025-03-31",
    "totalDays": 31,
    "planCount": 24
  },
  "plans": [...],
  "aiRecommendations": {
    "strategy": "ai_recommendation",
    "items": [...],
    "newlySaved": 1
  },
  "markdown": "# 1학기 수학 학습...",
  "validation": {
    "warnings": [],
    "autoAdjustedCount": 0
  }
}
```

### POST /api/plan/generate/preview

DB 저장 없이 미리보기만 수행합니다.

```typescript
// Request Body: 위와 동일 (generationOptions 무시됨)

// Response: 위와 동일 (planGroup.id 없음)
```

### GET /api/plan/[planGroupId]/export/markdown

기존 플랜 그룹을 마크다운으로 내보냅니다.

```typescript
// Response
{
  "success": true,
  "markdown": "# 플랜 이름..."
}
```

---

## 파이프라인 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                   Unified Plan Generation                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage 1: validateInput         ← Zod 스키마 검증           │
│      ↓                                                      │
│  Stage 2: resolveContent        ← AI Cold Start 추천        │
│      ↓                                                      │
│  Stage 3: buildSchedulerContext ← 스케줄러 입력 생성        │
│      ↓                                                      │
│  Stage 4: generateSchedule      ← SchedulerEngine 실행      │
│      ↓                                                      │
│  Stage 5: validateAndAdjust     ← 시간 겹침 검증/조정       │
│      ↓                                                      │
│  Stage 6: persist               ← DB 저장 (선택)            │
│      ↓                                                      │
│  Stage 7: exportMarkdown        ← 마크다운 생성             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 코드 사용법

### 기본 사용

```typescript
import {
  runUnifiedPlanGenerationPipeline,
  previewUnifiedPlanGeneration,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";

// 실제 생성 (DB 저장 포함)
const result = await runUnifiedPlanGenerationPipeline({
  studentId: "...",
  tenantId: "...",
  planName: "1학기 수학 학습",
  planPurpose: "내신대비",
  periodStart: "2025-03-01",
  periodEnd: "2025-03-31",
  // ...
});

if (result.success) {
  console.log("생성된 플랜:", result.plans);
  console.log("마크다운:", result.markdown);
} else {
  console.error("실패 단계:", result.failedAt);
  console.error("에러:", result.error);
}

// 미리보기 (DB 저장 없음)
const preview = await previewUnifiedPlanGeneration(input);
```

### Admin Wizard 연동

```typescript
import {
  mapWizardToUnifiedInput,
  validateWizardDataForPipeline,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";

// Wizard 데이터 검증
const validation = validateWizardDataForPipeline(wizardData);
if (!validation.valid) {
  console.error("검증 실패:", validation.errors);
  return;
}

// Wizard 데이터를 Unified Input으로 변환
const input = mapWizardToUnifiedInput(
  wizardData,
  studentId,
  tenantId,
  { saveToDb: true, generateMarkdown: true }
);

// 플랜 생성
const result = await runUnifiedPlanGenerationPipeline(input);
```

---

## 1730 Timetable 비즈니스 로직

### Study/Review 사이클

- **기본 사이클**: 6일 학습 + 1일 복습 = 7일 주기
- **제외일 처리**: 휴일/개인일정은 사이클 계산에서 완전 제외
- **복습일**: 이전 6일간 학습 범위를 통합 복습

### 과목 분류 (subject_type)

| 분류 | 할당 방식 | 시간 팩터 |
|------|----------|----------|
| **weakness (취약과목)** | 모든 학습일에 배치 | ×1.2 |
| **strategy (전략과목)** | 주당 2-4일만 배치 (weekly_days 필수) | ×1.05 |

### 시간 계산 공식

```
최종_시간 = 기본_시간 × 학생수준팩터 × 과목팩터 × [복습팩터]

학생수준팩터: high(0.85), medium(1.0), low(1.2)
과목팩터: weakness(1.2), strategy(1.05)
복습팩터: 0.4 (복습일), 0.25 (복습의 복습)
```

---

## 파일 구조

```
lib/domains/plan/llm/actions/unifiedPlanGeneration/
├── index.ts                     # Public exports
├── pipeline.ts                  # 메인 오케스트레이션
├── types.ts                     # 타입 정의
├── schemas.ts                   # Zod 검증 스키마
├── stages/
│   ├── validateInput.ts         # Stage 1: 입력 검증
│   ├── resolveContent.ts        # Stage 2: 콘텐츠 해결
│   ├── buildSchedulerContext.ts # Stage 3: 스케줄러 컨텍스트
│   ├── generateSchedule.ts      # Stage 4: 스케줄 생성
│   ├── validateAndAdjust.ts     # Stage 5: 검증/조정
│   ├── persist.ts               # Stage 6: DB 저장
│   └── exportMarkdown.ts        # Stage 7: 마크다운 출력
└── utils/
    ├── contentMapper.ts         # 콘텐츠 타입 변환
    ├── markdownHelpers.ts       # 마크다운 포매팅
    └── wizardMapper.ts          # Admin Wizard 연동
```

---

## 에러 처리

### 실패 응답 형식

```typescript
{
  "success": false,
  "failedAt": "validation" | "content_resolution" | "schedule_generation" | ...,
  "error": "에러 메시지",
  "details": { ... }
}
```

### 주요 에러 코드

| failedAt | 원인 | 해결책 |
|----------|------|--------|
| `validation` | 입력 데이터 형식 오류 | 요청 데이터 확인 |
| `content_resolution` | AI 콘텐츠 추천 실패 | API 키 확인, 재시도 |
| `schedule_generation` | 스케줄 생성 불가 | 기간/시간 설정 확인 |
| `persistence` | DB 저장 실패 | 권한/연결 확인 |

---

## 마크다운 출력 예시

```markdown
# 1학기 수학 학습 플랜

**기간**: 2025-03-01 ~ 2025-03-31
**목적**: 내신대비
**총 플랜 수**: 24개

## 학습 콘텐츠

| 콘텐츠명 | 유형 | 범위 | 출처 |
|---------|------|------|------|
| 개념원리 미적분 | book | 1-280 | AI 추천 |

## 주간 스케줄

### 1주차 (2025-03-03 ~ 2025-03-09)
| 날짜 | 요일 | 시간 | 콘텐츠 | 범위 | 유형 |
|------|------|------|--------|------|------|
| 2025-03-03 | 월 | 19:00-20:30 | 개념원리 미적분 | p.1-35 | 학습 |
| 2025-03-04 | 화 | 19:00-20:30 | 개념원리 미적분 | p.36-70 | 학습 |
...

## 통계

- 총 학습일: 24일
- 총 복습일: 4일
- 총 학습량: 280페이지
- 일평균 학습량: 11.7페이지
```

---

## 관련 문서

- [플랜 생성 종합 가이드](./plan-generation-comprehensive-guide.md)
- [AI 플랜 생성 가이드](./ai-plan-generation-guide.md)
- [Cold Start 시스템 가이드](./cold-start-system-guide.md)
