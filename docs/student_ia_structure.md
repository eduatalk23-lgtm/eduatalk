# TimeLevelUp 학생 영역 정보구조(IA) 설계

## 📋 개요

이 문서는 TimeLevelUp 서비스의 학생(Student) 영역 전체 정보구조(Information Architecture)를 정의합니다.
카테고리 네비게이션 및 Breadcrumbs 설계를 위한 기반 데이터로 활용됩니다.

---

## 🏗 전체 IA 구조 (JSON 트리)

```json
{
  "id": "student",
  "name": "학생",
  "path": "/",
  "children": [
    {
      "id": "dashboard",
      "name": "대시보드",
      "path": "/dashboard",
      "description": "학습 현황 요약 및 통계",
      "children": [
        {
          "id": "dashboard-main",
          "name": "메인 대시보드",
          "path": "/dashboard",
          "type": "page"
        },
        {
          "id": "dashboard-recommendations",
          "name": "추천 콘텐츠",
          "path": "/dashboard/recommendations",
          "type": "page"
        }
      ]
    },
    {
      "id": "today",
      "name": "오늘 학습",
      "path": "/today",
      "description": "오늘의 학습 계획 및 진행 현황",
      "children": [
        {
          "id": "today-main",
          "name": "오늘 학습 메인",
          "path": "/today",
          "type": "page"
        },
        {
          "id": "today-plan-execution",
          "name": "플랜 실행",
          "path": "/today/plan/[planId]",
          "type": "resource",
          "dynamic": true
        }
      ]
    },
    {
      "id": "plan",
      "name": "학습 계획",
      "path": "/plan",
      "description": "학습 플랜 생성 및 관리",
      "children": [
        {
          "id": "plan-list",
          "name": "플랜 목록",
          "path": "/plan",
          "type": "page",
          "children": [
            {
              "id": "plan-detail",
              "name": "플랜 상세",
              "path": "/plan/[id]",
              "type": "resource",
              "dynamic": true
            },
            {
              "id": "plan-edit",
              "name": "플랜 수정",
              "path": "/plan/[id]/edit",
              "type": "action",
              "dynamic": true
            }
          ]
        },
        {
          "id": "plan-new",
          "name": "새 플랜 생성",
          "path": "/plan/new",
          "type": "action"
        },
        {
          "id": "scheduler",
          "name": "자동 스케줄러",
          "path": "/scheduler",
          "type": "tool",
          "description": "자동 학습 플랜 생성 도구"
        }
      ]
    },
    {
      "id": "contents",
      "name": "콘텐츠",
      "path": "/contents",
      "description": "책, 강의, 커스텀 콘텐츠 관리",
      "children": [
        {
          "id": "contents-list",
          "name": "콘텐츠 목록",
          "path": "/contents",
          "type": "page",
          "params": {
            "tab": ["books", "lectures", "custom"]
          },
          "children": [
            {
              "id": "contents-books-detail",
              "name": "책 상세",
              "path": "/contents/books/[id]",
              "type": "resource",
              "dynamic": true,
              "parentTab": "books"
            },
            {
              "id": "contents-books-edit",
              "name": "책 수정",
              "path": "/contents/books/[id]/edit",
              "type": "action",
              "dynamic": true,
              "parentTab": "books"
            },
            {
              "id": "contents-lectures-detail",
              "name": "강의 상세",
              "path": "/contents/lectures/[id]",
              "type": "resource",
              "dynamic": true,
              "parentTab": "lectures"
            },
            {
              "id": "contents-lectures-edit",
              "name": "강의 수정",
              "path": "/contents/lectures/[id]/edit",
              "type": "action",
              "dynamic": true,
              "parentTab": "lectures"
            },
            {
              "id": "contents-custom-detail",
              "name": "커스텀 상세",
              "path": "/contents/custom/[id]",
              "type": "resource",
              "dynamic": true,
              "parentTab": "custom"
            },
            {
              "id": "contents-custom-edit",
              "name": "커스텀 수정",
              "path": "/contents/custom/[id]/edit",
              "type": "action",
              "dynamic": true,
              "parentTab": "custom"
            }
          ]
        },
        {
          "id": "contents-books-new",
          "name": "책 등록",
          "path": "/contents/books/new",
          "type": "action",
          "parentTab": "books"
        },
        {
          "id": "contents-lectures-new",
          "name": "강의 등록",
          "path": "/contents/lectures/new",
          "type": "action",
          "parentTab": "lectures"
        },
        {
          "id": "contents-custom-new",
          "name": "커스텀 등록",
          "path": "/contents/custom/new",
          "type": "action",
          "parentTab": "custom"
        }
      ]
    },
    {
      "id": "analysis",
      "name": "학습 분석",
      "path": "/analysis",
      "description": "취약 과목 분석 및 Risk Index",
      "children": [
        {
          "id": "analysis-main",
          "name": "취약 과목 분석",
          "path": "/analysis",
          "type": "page"
        }
      ]
    },
    {
      "id": "goals",
      "name": "목표",
      "path": "/goals",
      "description": "학습 목표 설정 및 달성률 추적",
      "children": [
        {
          "id": "goals-list",
          "name": "목표 목록",
          "path": "/goals",
          "type": "page",
          "children": [
            {
              "id": "goals-detail",
              "name": "목표 상세",
              "path": "/goals/[goalId]",
              "type": "resource",
              "dynamic": true
            }
          ]
        },
        {
          "id": "goals-new",
          "name": "새 목표 만들기",
          "path": "/goals/new",
          "type": "action"
        }
      ]
    },
    {
      "id": "scores",
      "name": "성적",
      "path": "/scores",
      "description": "내신 및 모의고사 성적 관리",
      "children": [
        {
          "id": "scores-list",
          "name": "성적 목록",
          "path": "/scores",
          "type": "page",
          "params": {
            "type": ["school", "mock"]
          },
          "children": [
            {
              "id": "scores-school",
              "name": "내신 성적",
              "path": "/scores/school/[grade]/[semester]/[subject]",
              "type": "resource",
              "dynamic": true,
              "params": {
                "grade": "number",
                "semester": "number",
                "subject": "string"
              }
            },
            {
              "id": "scores-school-dashboard",
              "name": "내신 대시보드",
              "path": "/scores/school/dashboard",
              "type": "page"
            },
            {
              "id": "scores-mock",
              "name": "모의고사 성적",
              "path": "/scores/mock/[grade]/[subject]/[examType]",
              "type": "resource",
              "dynamic": true,
              "params": {
                "grade": "number",
                "subject": "string",
                "examType": "string"
              }
            },
            {
              "id": "scores-mock-dashboard",
              "name": "모의고사 대시보드",
              "path": "/scores/mock/dashboard",
              "type": "page"
            },
            {
              "id": "scores-detail",
              "name": "성적 상세",
              "path": "/scores/[id]",
              "type": "resource",
              "dynamic": true
            }
          ]
        },
        {
          "id": "scores-new",
          "name": "새 성적 입력",
          "path": "/scores/new",
          "type": "action"
        }
      ]
    },
    {
      "id": "schedule",
      "name": "스케줄",
      "path": "/schedule",
      "description": "시간표 및 학습 일정 관리",
      "children": [
        {
          "id": "schedule-calendar",
          "name": "스케줄 캘린더",
          "path": "/schedule/[date]",
          "type": "page",
          "dynamic": true,
          "defaultPath": "/schedule",
          "params": {
            "date": "YYYY-MM-DD"
          }
        }
      ]
    },
    {
      "id": "reports",
      "name": "리포트",
      "path": "/reports",
      "description": "주간/월간 학습 리포트",
      "children": [
        {
          "id": "reports-weekly",
          "name": "주간 리포트",
          "path": "/reports",
          "type": "page",
          "params": {
            "period": "weekly"
          }
        },
        {
          "id": "reports-monthly",
          "name": "월간 리포트",
          "path": "/reports",
          "type": "page",
          "params": {
            "period": "monthly"
          }
        }
      ]
    },
    {
      "id": "focus",
      "name": "집중 모드",
      "path": "/focus",
      "description": "집중 타이머 및 학습 세션",
      "children": [
        {
          "id": "focus-timer",
          "name": "포커스 타이머",
          "path": "/focus",
          "type": "page"
        }
      ]
    },
    {
      "id": "blocks",
      "name": "시간 블록",
      "path": "/blocks",
      "description": "학습 가능한 시간 블록 관리",
      "children": [
        {
          "id": "blocks-form",
          "name": "시간 블록 설정",
          "path": "/blocks",
          "type": "page"
        }
      ]
    }
  ]
}
```

---

## 📊 IA 구조표

### Depth 1 (최상위 카테고리)

| ID | 이름 | 경로 | 설명 | 아이콘 |
|---|---|---|---|---|
| `dashboard` | 대시보드 | `/dashboard` | 학습 현황 요약 및 통계 | 📊 |
| `today` | 오늘 학습 | `/today` | 오늘의 학습 계획 및 진행 현황 | 📅 |
| `plan` | 학습 계획 | `/plan` | 학습 플랜 생성 및 관리 | 📋 |
| `contents` | 콘텐츠 | `/contents` | 책, 강의, 커스텀 콘텐츠 관리 | 📚 |
| `analysis` | 학습 분석 | `/analysis` | 취약 과목 분석 및 Risk Index | 📈 |
| `goals` | 목표 | `/goals` | 학습 목표 설정 및 달성률 추적 | 🎯 |
| `scores` | 성적 | `/scores` | 내신 및 모의고사 성적 관리 | 📝 |
| `schedule` | 스케줄 | `/schedule` | 시간표 및 학습 일정 관리 | 🗓️ |
| `reports` | 리포트 | `/reports` | 주간/월간 학습 리포트 | 📄 |
| `focus` | 집중 모드 | `/focus` | 집중 타이머 및 학습 세션 | ⏱️ |
| `blocks` | 시간 블록 | `/blocks` | 학습 가능한 시간 블록 관리 | ⏰ |

### Depth 2 (카테고리 하위)

#### 대시보드 (`dashboard`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `dashboard-main` | 메인 대시보드 | `/dashboard` | page | 학습 현황 요약 |
| `dashboard-recommendations` | 추천 콘텐츠 | `/dashboard/recommendations` | page | AI 기반 콘텐츠 추천 |

#### 오늘 학습 (`today`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `today-main` | 오늘 학습 메인 | `/today` | page | 오늘의 플랜, 목표, 추천 |
| `today-plan-execution` | 플랜 실행 | `/today/plan/[planId]` | resource | 플랜 실행 및 진행률 입력 |

#### 학습 계획 (`plan`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `plan-list` | 플랜 목록 | `/plan` | page | 전체 플랜 조회 및 필터링 |
| `plan-new` | 새 플랜 생성 | `/plan/new` | action | 수동 플랜 생성 |
| `scheduler` | 자동 스케줄러 | `/scheduler` | tool | 자동 플랜 생성 도구 |

#### 콘텐츠 (`contents`)

| ID | 이름 | 경로 | 타입 | 설명 | 탭 |
|---|---|---|---|---|---|
| `contents-list` | 콘텐츠 목록 | `/contents?tab={type}` | page | 책/강의/커스텀 목록 | books, lectures, custom |
| `contents-books-new` | 책 등록 | `/contents/books/new` | action | 새 책 등록 | books |
| `contents-lectures-new` | 강의 등록 | `/contents/lectures/new` | action | 새 강의 등록 | lectures |
| `contents-custom-new` | 커스텀 등록 | `/contents/custom/new` | action | 새 커스텀 등록 | custom |

#### 학습 분석 (`analysis`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `analysis-main` | 취약 과목 분석 | `/analysis` | page | Risk Index 기반 분석 |

#### 목표 (`goals`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `goals-list` | 목표 목록 | `/goals` | page | 전체 목표 조회 |
| `goals-new` | 새 목표 만들기 | `/goals/new` | action | 목표 생성 |

#### 성적 (`scores`)

| ID | 이름 | 경로 | 타입 | 설명 | 성적 타입 |
|---|---|---|---|---|---|
| `scores-list` | 성적 목록 | `/scores?type={type}` | page | 내신/모의고사 목록 | school, mock |
| `scores-new` | 새 성적 입력 | `/scores/new` | action | 성적 등록 | - |
| `scores-school-dashboard` | 내신 대시보드 | `/scores/school/dashboard` | page | 내신 통계 | school |
| `scores-mock-dashboard` | 모의고사 대시보드 | `/scores/mock/dashboard` | page | 모의고사 통계 | mock |

#### 스케줄 (`schedule`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `schedule-calendar` | 스케줄 캘린더 | `/schedule/[date]` | page | 날짜별 학습 일정 |

#### 리포트 (`reports`)

| ID | 이름 | 경로 | 타입 | 설명 | 기간 |
|---|---|---|---|---|---|
| `reports-weekly` | 주간 리포트 | `/reports?period=weekly` | page | 주간 학습 리포트 | weekly |
| `reports-monthly` | 월간 리포트 | `/reports?period=monthly` | page | 월간 학습 리포트 | monthly |

#### 집중 모드 (`focus`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `focus-timer` | 포커스 타이머 | `/focus` | page | 집중 학습 타이머 |

#### 시간 블록 (`blocks`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `blocks-form` | 시간 블록 설정 | `/blocks` | page | 학습 가능 시간 설정 |

### Depth 3 (상세/리소스/액션)

#### 학습 계획 - 플랜 상세 (`plan-detail`)

| ID | 이름 | 경로 | 타입 | 부모 | 설명 |
|---|---|---|---|---|---|
| `plan-detail` | 플랜 상세 | `/plan/[id]` | resource | plan-list | 플랜 상세 정보 |
| `plan-edit` | 플랜 수정 | `/plan/[id]/edit` | action | plan-list | 플랜 수정 폼 |

#### 콘텐츠 - 상세 및 수정

| ID | 이름 | 경로 | 타입 | 부모 탭 | 설명 |
|---|---|---|---|---|---|
| `contents-books-detail` | 책 상세 | `/contents/books/[id]` | resource | books | 책 상세 정보 |
| `contents-books-edit` | 책 수정 | `/contents/books/[id]/edit` | action | books | 책 수정 폼 |
| `contents-lectures-detail` | 강의 상세 | `/contents/lectures/[id]` | resource | lectures | 강의 상세 정보 |
| `contents-lectures-edit` | 강의 수정 | `/contents/lectures/[id]/edit` | action | lectures | 강의 수정 폼 |
| `contents-custom-detail` | 커스텀 상세 | `/contents/custom/[id]` | resource | custom | 커스텀 상세 정보 |
| `contents-custom-edit` | 커스텀 수정 | `/contents/custom/[id]/edit` | action | custom | 커스텀 수정 폼 |

#### 목표 - 목표 상세 (`goals-detail`)

| ID | 이름 | 경로 | 타입 | 부모 | 설명 |
|---|---|---|---|---|---|
| `goals-detail` | 목표 상세 | `/goals/[goalId]` | resource | goals-list | 목표 상세 및 진행률 |

#### 성적 - 상세 리소스

| ID | 이름 | 경로 | 타입 | 부모 | 설명 | 동적 파라미터 |
|---|---|---|---|---|---|---|
| `scores-school` | 내신 성적 상세 | `/scores/school/[grade]/[semester]/[subject]` | resource | scores-list | 학년/학기/과목별 내신 | grade, semester, subject |
| `scores-mock` | 모의고사 성적 상세 | `/scores/mock/[grade]/[subject]/[examType]` | resource | scores-list | 학년/과목/시험유형별 모의고사 | grade, subject, examType |
| `scores-detail` | 성적 상세 | `/scores/[id]` | resource | scores-list | 개별 성적 상세 | id |

---

## 🔗 경로 패턴 설명

### 정적 경로 (Static Routes)

```
/dashboard
/dashboard/recommendations
/today
/plan
/plan/new
/contents
/scheduler
/analysis
/goals
/goals/new
/scores
/scores/new
/reports
/focus
/blocks
```

### 동적 경로 (Dynamic Routes)

```
/today/plan/[planId]
/plan/[id]
/plan/[id]/edit
/contents/books/[id]
/contents/books/[id]/edit
/contents/lectures/[id]
/contents/lectures/[id]/edit
/contents/custom/[id]
/contents/custom/[id]/edit
/goals/[goalId]
/scores/[id]
/scores/school/[grade]/[semester]/[subject]
/scores/mock/[grade]/[subject]/[examType]
/schedule/[date]
```

### 쿼리 파라미터 (Query Parameters)

```
/contents?tab=books|lectures|custom
/plan?date=YYYY-MM-DD
/scores?type=school|mock
/reports?period=weekly|monthly
```

---

## 📱 네비게이션 계층 구조

### 메인 네비게이션 (Depth 1)

```
대시보드 | 오늘 학습 | 학습 계획 | 콘텐츠 | 학습 분석 | 목표 | 성적 | 스케줄 | 리포트 | 집중 모드 | 시간 블록
```

### 서브 네비게이션 예시

#### 학습 계획 서브메뉴
```
📋 학습 계획
  ├─ 플랜 목록
  ├─ 새 플랜 생성
  └─ 자동 스케줄러
```

#### 콘텐츠 서브메뉴
```
📚 콘텐츠
  ├─ 책 (books)
  ├─ 강의 (lectures)
  └─ 커스텀 (custom)
```

#### 성적 서브메뉴
```
📝 성적
  ├─ 내신
  ├─ 모의고사
  └─ 새 성적 입력
```

#### 리포트 서브메뉴
```
📄 리포트
  ├─ 주간 리포트
  └─ 월간 리포트
```

---

## 🍞 Breadcrumbs 구조 예시

### 예시 1: 콘텐츠 상세
```
홈 > 콘텐츠 > 책 > [책 제목]
```

### 예시 2: 플랜 수정
```
홈 > 학습 계획 > 플랜 목록 > [플랜 제목] > 수정
```

### 예시 3: 목표 상세
```
홈 > 목표 > [목표 제목]
```

### 예시 4: 성적 상세 (내신)
```
홈 > 성적 > 내신 > 1학년 1학기 국어
```

### 예시 5: 학습 분석
```
홈 > 학습 분석
```

---

## 📝 노트 및 고려사항

### 1. 동적 라우트 처리

- Next.js 15 App Router 기준으로 설계
- 동적 세그먼트는 `[param]` 형식 사용
- 쿼리 파라미터는 필터링 및 탭 전환에 활용

### 2. 리소스 타입 구분

- **page**: 일반 페이지 (목록, 대시보드 등)
- **resource**: 리소스 상세 페이지 (개별 항목 조회)
- **action**: 생성/수정 액션 페이지 (폼)
- **tool**: 도구/유틸리티 페이지 (스케줄러 등)

### 3. 탭 기반 네비게이션

- 콘텐츠 페이지는 `tab` 쿼리 파라미터로 탭 전환
- 성적 페이지는 `type` 쿼리 파라미터로 내신/모의고사 구분
- 리포트 페이지는 `period` 쿼리 파라미터로 주간/월간 구분

### 4. 권한 및 접근 제어

- 모든 학생 영역 페이지는 `/app/(student)` 그룹 내에 위치
- `StudentLayout`에서 역할 기반 접근 제어 수행
- 학생 역할이 아닌 경우 `/login`으로 리다이렉트

### 5. 확장 고려사항

- 향후 추가될 기능은 기존 Depth 구조에 맞춰 확장 가능
- 새로운 도메인 추가 시 Depth 1에 추가, 이후 Depth 2, 3 순차 확장

---

## 🎯 활용 방안

이 IA 구조는 다음 용도로 활용됩니다:

1. **카테고리 네비게이션 컴포넌트 설계**
2. **Breadcrumbs 컴포넌트 자동 생성**
3. **사이트맵 생성**
4. **SEO 메타데이터 구조화**
5. **사용자 플로우 분석 및 최적화**

---

**작성일**: 2025-01-13  
**버전**: 1.0  
**담당자**: TimeLevelUp 개발팀

