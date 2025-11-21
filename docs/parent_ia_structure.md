# TimeLevelUp 학부모(Parent) 영역 정보구조(IA) 설계

## 📋 개요

이 문서는 TimeLevelUp 서비스의 학부모(Parent) 영역 전체 정보구조(Information Architecture)를 정의합니다.
역할 기반 네비게이션 및 Breadcrumbs 설계를 위한 기반 데이터로 활용됩니다.

**특징**:
- 다중 자녀 지원 (자녀 선택 기능)
- 자녀별 독립적인 정보 조회
- 읽기 전용 데이터 제공 (학생 데이터 조회 중심)
- 주간/월간 리포트 제공

---

## 🏗 전체 IA 구조 (JSON 트리)

```json
{
  "id": "parent",
  "name": "학부모",
  "path": "/parent",
  "role": "parent",
  "children": [
    {
      "id": "dashboard",
      "name": "대시보드",
      "path": "/parent/dashboard",
      "description": "자녀 현황 대시보드 - 오늘 학습, 계획, 성과 요약",
      "type": "page",
      "params": {
        "studentId": "string"
      },
      "children": [
        {
          "id": "dashboard-today-summary",
          "name": "오늘 학습 요약",
          "type": "section",
          "description": "오늘의 학습 시간, 완료한 플랜, 달성한 목표"
        },
        {
          "id": "dashboard-weekly-summary",
          "name": "주간/월간 요약",
          "type": "section",
          "description": "이번 주 및 이번 달 학습 요약 통계"
        },
        {
          "id": "dashboard-risk-signals",
          "name": "위험 신호",
          "type": "section",
          "description": "학습 집중도 저하, 성적 하락 등 위험 요소"
        },
        {
          "id": "dashboard-recent-scores",
          "name": "최근 성적",
          "type": "section",
          "description": "최근 입력된 성적 및 추이"
        },
        {
          "id": "dashboard-weak-subjects",
          "name": "취약 과목",
          "type": "section",
          "description": "Risk Index 기반 취약 과목 분석"
        },
        {
          "id": "dashboard-recommendations",
          "name": "추천 사항",
          "type": "section",
          "description": "학습 방향성 및 개선 제안"
        }
      ]
    },
    {
      "id": "reports",
      "name": "리포트",
      "path": "/parent/report",
      "description": "학습 리포트 - 주간/월간 상세 리포트",
      "children": [
        {
          "id": "reports-weekly",
          "name": "주간 리포트",
          "path": "/parent/report/weekly",
          "type": "page",
          "description": "이번 주 학습 리포트",
          "params": {
            "studentId": "string"
          },
          "children": [
            {
              "id": "reports-weekly-summary",
              "name": "주간 요약",
              "type": "section",
              "description": "학습 시간, 플랜 완료율, 목표 진행률"
            },
            {
              "id": "reports-weekly-coaching",
              "name": "주간 코칭",
              "type": "section",
              "description": "AI 기반 학습 코칭 메시지"
            },
            {
              "id": "reports-weekly-charts",
              "name": "주간 차트",
              "type": "section",
              "description": "일별/과목별 학습 시간, 플랜 완료율 차트"
            },
            {
              "id": "reports-weekly-goals",
              "name": "목표 진행률",
              "type": "section",
              "description": "주간 목표 달성 현황"
            },
            {
              "id": "reports-weekly-weak-subjects",
              "name": "취약 과목",
              "type": "section",
              "description": "주간 취약 과목 분석"
            },
            {
              "id": "reports-weekly-daily-breakdown",
              "name": "일별 상세",
              "type": "section",
              "description": "요일별 학습 상세 분석"
            },
            {
              "id": "reports-weekly-pdf",
              "name": "PDF 리포트",
              "path": "/report/weekly/pdf?studentId=[id]&week=[date]",
              "type": "action",
              "description": "PDF 리포트 다운로드",
              "dynamic": true
            }
          ]
        },
        {
          "id": "reports-monthly",
          "name": "월간 리포트",
          "path": "/parent/report/monthly",
          "type": "page",
          "description": "월간 학습 리포트",
          "params": {
            "studentId": "string",
            "month": "YYYY-MM"
          },
          "children": [
            {
              "id": "reports-monthly-summary",
              "name": "월간 요약",
              "type": "section",
              "description": "월간 학습 시간, 완료율, 목표 달성률"
            },
            {
              "id": "reports-monthly-charts",
              "name": "월간 차트",
              "type": "section",
              "description": "주간별/과목별 학습 통계 차트"
            },
            {
              "id": "reports-monthly-subjects",
              "name": "과목 분석",
              "type": "section",
              "description": "강점/취약 과목 분석"
            },
            {
              "id": "reports-monthly-goals",
              "name": "목표 진행률",
              "type": "section",
              "description": "월간 목표 달성 현황"
            },
            {
              "id": "reports-monthly-content",
              "name": "콘텐츠 진행률",
              "type": "section",
              "description": "학습 콘텐츠 진행 상황"
            },
            {
              "id": "reports-monthly-history",
              "name": "학습 이력",
              "type": "section",
              "description": "월간 주요 학습 이벤트"
            },
            {
              "id": "reports-monthly-pdf",
              "name": "PDF 리포트",
              "path": "/report/monthly/pdf?studentId=[id]&month=[YYYY-MM]",
              "type": "action",
              "description": "PDF 리포트 다운로드",
              "dynamic": true
            }
          ]
        }
      ]
    },
    {
      "id": "performance",
      "name": "성과",
      "path": "/parent",
      "description": "자녀의 학습 성과 및 통계",
      "children": [
        {
          "id": "scores",
          "name": "성적",
          "path": "/parent/scores",
          "type": "page",
          "description": "성적 추세 및 변화 분석",
          "params": {
            "studentId": "string"
          },
          "children": [
            {
              "id": "scores-recent-trend",
              "name": "최근 성적 변화",
              "type": "section",
              "description": "최근 10개 성적 변화 추이"
            },
            {
              "id": "scores-subject-history",
              "name": "과목별 등급 변화",
              "type": "section",
              "description": "과목별 등급 변화 그래프"
            },
            {
              "id": "scores-summary",
              "name": "성적 요약",
              "type": "section",
              "description": "전체 성적 통계 요약"
            }
          ]
        },
        {
          "id": "goals",
          "name": "목표",
          "path": "/parent/goals",
          "type": "page",
          "description": "학습 목표 진행 상황",
          "params": {
            "studentId": "string"
          },
          "children": [
            {
              "id": "goals-current-progress",
              "name": "현재 목표 진행률",
              "type": "section",
              "description": "진행 중인 목표 달성률"
            },
            {
              "id": "goals-summary",
              "name": "목표 달성률 요약",
              "type": "section",
              "description": "예정/진행중/완료/실패 목표 통계"
            },
            {
              "id": "goals-weak-subject",
              "name": "취약 과목 목표",
              "type": "section",
              "description": "취약 과목 개선 목표 현황"
            }
          ]
        },
        {
          "id": "history",
          "name": "이력",
          "path": "/parent/history",
          "type": "page",
          "description": "학습 활동 이력 조회",
          "params": {
            "studentId": "string"
          },
          "children": [
            {
              "id": "history-recent-activities",
              "name": "최근 활동 요약",
              "type": "section",
              "description": "최근 50개 학습 활동 이벤트"
            }
          ]
        }
      ]
    },
    {
      "id": "notifications",
      "name": "알림/공지",
      "path": "/parent/notifications",
      "type": "page",
      "description": "알림 및 공지사항 (계획 중)",
      "status": "planned",
      "params": {
        "studentId": "string",
        "type": "all|alert|notice|achievement"
      },
      "children": [
        {
          "id": "notifications-alerts",
          "name": "알림",
          "type": "section",
          "status": "planned",
          "description": "학습 관련 실시간 알림"
        },
        {
          "id": "notifications-notices",
          "name": "공지사항",
          "type": "section",
          "status": "planned",
          "description": "시스템 공지사항"
        },
        {
          "id": "notifications-achievements",
          "name": "성취 알림",
          "type": "section",
          "status": "planned",
          "description": "목표 달성, 성적 향상 등 성취 알림"
        }
      ]
    },
    {
      "id": "settings",
      "name": "설정",
      "path": "/parent/settings",
      "type": "page",
      "description": "계정 설정 및 자녀 관리",
      "children": [
        {
          "id": "settings-account",
          "name": "나의 정보",
          "type": "section",
          "description": "계정 정보 조회 (이름, 가입일)"
        },
        {
          "id": "settings-linked-children",
          "name": "연결된 자녀",
          "type": "section",
          "description": "연결된 자녀 목록 및 관계 정보"
        },
        {
          "id": "settings-add-child",
          "name": "자녀 연결 추가",
          "type": "section",
          "status": "planned",
          "description": "자녀 연결 추가 기능 (추후 구현)"
        }
      ]
    }
  ]
}
```

---

## 📊 IA 구조표

### Depth 1 (최상위 카테고리)

| ID | 이름 | 경로 | 설명 | 타입 | 아이콘 |
|---|---|---|---|---|---|
| `dashboard` | 대시보드 | `/parent/dashboard` | 자녀 현황 대시보드 - 오늘 학습, 계획, 성과 요약 | page | 📊 |
| `reports` | 리포트 | `/parent/report` | 학습 리포트 - 주간/월간 상세 리포트 | category | 📄 |
| `performance` | 성과 | `/parent` | 자녀의 학습 성과 및 통계 | category | 📈 |
| `notifications` | 알림/공지 | `/parent/notifications` | 알림 및 공지사항 | page | 🔔 |
| `settings` | 설정 | `/parent/settings` | 계정 설정 및 자녀 관리 | page | ⚙️ |

### Depth 2 (카테고리 하위)

#### 대시보드 (`dashboard`)

| ID | 이름 | 타입 | 설명 |
|---|---|---|---|
| `dashboard-today-summary` | 오늘 학습 요약 | section | 오늘의 학습 시간, 완료한 플랜, 달성한 목표 |
| `dashboard-weekly-summary` | 주간/월간 요약 | section | 이번 주 및 이번 달 학습 요약 통계 |
| `dashboard-risk-signals` | 위험 신호 | section | 학습 집중도 저하, 성적 하락 등 위험 요소 |
| `dashboard-recent-scores` | 최근 성적 | section | 최근 입력된 성적 및 추이 |
| `dashboard-weak-subjects` | 취약 과목 | section | Risk Index 기반 취약 과목 분석 |
| `dashboard-recommendations` | 추천 사항 | section | 학습 방향성 및 개선 제안 |

#### 리포트 (`reports`)

| ID | 이름 | 경로 | 타입 | 설명 | 기간 |
|---|---|---|---|---|---|
| `reports-weekly` | 주간 리포트 | `/parent/report/weekly` | page | 이번 주 학습 리포트 | weekly |
| `reports-monthly` | 월간 리포트 | `/parent/report/monthly` | page | 월간 학습 리포트 | monthly |

#### 성과 (`performance`)

| ID | 이름 | 경로 | 타입 | 설명 |
|---|---|---|---|---|
| `scores` | 성적 | `/parent/scores` | page | 성적 추세 및 변화 분석 |
| `goals` | 목표 | `/parent/goals` | page | 학습 목표 진행 상황 |
| `history` | 이력 | `/parent/history` | page | 학습 활동 이력 조회 |

#### 알림/공지 (`notifications`)

| ID | 이름 | 타입 | 설명 | 상태 |
|---|---|---|---|---|
| `notifications-alerts` | 알림 | section | 학습 관련 실시간 알림 | planned |
| `notifications-notices` | 공지사항 | section | 시스템 공지사항 | planned |
| `notifications-achievements` | 성취 알림 | section | 목표 달성, 성적 향상 등 성취 알림 | planned |

#### 설정 (`settings`)

| ID | 이름 | 타입 | 설명 | 상태 |
|---|---|---|---|---|
| `settings-account` | 나의 정보 | section | 계정 정보 조회 (이름, 가입일) | active |
| `settings-linked-children` | 연결된 자녀 | section | 연결된 자녀 목록 및 관계 정보 | active |
| `settings-add-child` | 자녀 연결 추가 | section | 자녀 연결 추가 기능 | planned |

### Depth 3 (상세/리소스/액션)

#### 주간 리포트 (`reports-weekly`)

| ID | 이름 | 타입 | 설명 |
|---|---|---|---|
| `reports-weekly-summary` | 주간 요약 | section | 학습 시간, 플랜 완료율, 목표 진행률 |
| `reports-weekly-coaching` | 주간 코칭 | section | AI 기반 학습 코칭 메시지 |
| `reports-weekly-charts` | 주간 차트 | section | 일별/과목별 학습 시간, 플랜 완료율 차트 |
| `reports-weekly-goals` | 목표 진행률 | section | 주간 목표 달성 현황 |
| `reports-weekly-weak-subjects` | 취약 과목 | section | 주간 취약 과목 분석 |
| `reports-weekly-daily-breakdown` | 일별 상세 | section | 요일별 학습 상세 분석 |
| `reports-weekly-pdf` | PDF 리포트 | action | PDF 리포트 다운로드 |

#### 월간 리포트 (`reports-monthly`)

| ID | 이름 | 타입 | 설명 |
|---|---|---|---|
| `reports-monthly-summary` | 월간 요약 | section | 월간 학습 시간, 완료율, 목표 달성률 |
| `reports-monthly-charts` | 월간 차트 | section | 주간별/과목별 학습 통계 차트 |
| `reports-monthly-subjects` | 과목 분석 | section | 강점/취약 과목 분석 |
| `reports-monthly-goals` | 목표 진행률 | section | 월간 목표 달성 현황 |
| `reports-monthly-content` | 콘텐츠 진행률 | section | 학습 콘텐츠 진행 상황 |
| `reports-monthly-history` | 학습 이력 | section | 월간 주요 학습 이벤트 |
| `reports-monthly-pdf` | PDF 리포트 | action | PDF 리포트 다운로드 |

#### 성적 (`scores`)

| ID | 이름 | 타입 | 설명 |
|---|---|---|---|
| `scores-recent-trend` | 최근 성적 변화 | section | 최근 10개 성적 변화 추이 |
| `scores-subject-history` | 과목별 등급 변화 | section | 과목별 등급 변화 그래프 |
| `scores-summary` | 성적 요약 | section | 전체 성적 통계 요약 |

#### 목표 (`goals`)

| ID | 이름 | 타입 | 설명 |
|---|---|---|---|
| `goals-current-progress` | 현재 목표 진행률 | section | 진행 중인 목표 달성률 |
| `goals-summary` | 목표 달성률 요약 | section | 예정/진행중/완료/실패 목표 통계 |
| `goals-weak-subject` | 취약 과목 목표 | section | 취약 과목 개선 목표 현황 |

#### 이력 (`history`)

| ID | 이름 | 타입 | 설명 |
|---|---|---|---|
| `history-recent-activities` | 최근 활동 요약 | section | 최근 50개 학습 활동 이벤트 |

---

## 🔗 경로 패턴 설명

### 정적 경로 (Static Routes)

```
/parent/dashboard
/parent/report/weekly
/parent/report/monthly
/parent/scores
/parent/goals
/parent/history
/parent/settings
/parent/notifications (planned)
```

### 동적 경로 (Dynamic Routes)

```
/report/weekly/pdf?studentId=[id]&week=[date]
/report/monthly/pdf?studentId=[id]&month=[YYYY-MM]
```

### 쿼리 파라미터 (Query Parameters)

#### 공통 파라미터 (대부분의 페이지에서 사용)

```
?studentId=학생ID
```

**특징**:
- 자녀 선택 드롭다운을 통해 변경 가능
- 선택된 자녀 ID가 없으면 첫 번째 연결된 자녀로 자동 설정
- 각 페이지는 선택된 자녀의 데이터만 표시

#### 리포트 전용 파라미터

**주간 리포트** (`/parent/report/weekly`)
```
?studentId=학생ID
```

**월간 리포트** (`/parent/report/monthly`)
```
?studentId=학생ID
&month=YYYY-MM  (선택적, 없으면 현재 월)
```

#### 알림/공지 파라미터 (계획 중)
```
?studentId=학생ID
&type=all|alert|notice|achievement  (선택적, 없으면 전체)
```

---

## 📱 네비게이션 계층 구조

### 메인 네비게이션 (Depth 1)

#### 대시보드 카테고리
```
📊 대시보드
  └─ 📊 대시보드
```

#### 리포트 카테고리
```
📄 리포트
  ├─ 📅 주간 리포트
  └─ 📆 월간 리포트
```

#### 성과 카테고리
```
📈 성과
  ├─ 📈 성적
  ├─ 🎯 목표
  └─ 📜 이력
```

#### 설정 카테고리
```
⚙️ 설정
  └─ ⚙️ 설정
```

### 서브 네비게이션 예시

#### 대시보드 서브메뉴
```
📊 대시보드
  ├─ 오늘 학습 요약
  ├─ 주간/월간 요약
  ├─ 위험 신호
  ├─ 최근 성적
  ├─ 취약 과목
  └─ 추천 사항
```

#### 리포트 서브메뉴
```
📄 리포트
  ├─ 주간 리포트
  │   ├─ 주간 요약
  │   ├─ 주간 코칭
  │   ├─ 주간 차트
  │   ├─ 목표 진행률
  │   ├─ 취약 과목
  │   ├─ 일별 상세
  │   └─ PDF 리포트
  └─ 월간 리포트
      ├─ 월간 요약
      ├─ 월간 차트
      ├─ 과목 분석
      ├─ 목표 진행률
      ├─ 콘텐츠 진행률
      ├─ 학습 이력
      └─ PDF 리포트
```

---

## 🍞 Breadcrumbs 구조 예시

### 예시 1: 대시보드 (기본)
```
홈 > 대시보드 > [자녀 이름]
```

### 예시 2: 주간 리포트
```
홈 > 리포트 > 주간 리포트 > [자녀 이름]
```

### 예시 3: 성적 추세
```
홈 > 성과 > 성적 > [자녀 이름]
```

### 예시 4: 목표 현황
```
홈 > 성과 > 목표 > [자녀 이름]
```

### 예시 5: 학습 이력
```
홈 > 성과 > 이력 > [자녀 이름]
```

### 예시 6: 설정
```
홈 > 설정
```

---

## 🔐 접근 권한 및 데이터 제한

### 학부모 권한

**읽기 전용 접근**:
- ✅ 자녀의 학습 데이터 조회
- ✅ 성적 추이 확인
- ✅ 학습 리포트 조회 및 PDF 다운로드
- ✅ 목표 진행 상황 확인
- ✅ 학습 활동 이력 조회

**읽기/수정 가능**:
- ✅ 본인 계정 정보 조회
- ✅ 연결된 자녀 목록 확인

**접근 불가**:
- ❌ 자녀의 학습 데이터 직접 수정
- ❌ 성적 입력/수정
- ❌ 학습 플랜 생성/수정
- ❌ 목표 생성/수정

### 자녀 선택 기능

**특징**:
- 모든 페이지에서 자녀 선택 드롭다운 제공
- 선택된 자녀 ID는 쿼리 파라미터로 유지
- 연결된 자녀가 없으면 경고 메시지 표시
- 접근 권한이 없는 자녀 선택 시 오류 메시지 표시

---

## 📝 노트 및 고려사항

### 1. 자녀 선택 패턴

**현재 구현**:
- 모든 페이지 상단에 `StudentSelector` 컴포넌트 배치
- `studentId` 쿼리 파라미터로 자녀 구분
- 쿼리 파라미터가 없으면 첫 번째 연결된 자녀로 자동 선택

**권장 패턴**:
```
?studentId=학생ID
```

### 2. 동적 라우트 처리

- Next.js 15 App Router 기준으로 설계
- PDF 다운로드는 별도 경로 사용 (`/report/weekly/pdf`, `/report/monthly/pdf`)
- 쿼리 파라미터로 학생 ID 및 기간 정보 전달

### 3. 리소스 타입 구분

- **page**: 일반 페이지 (목록, 대시보드 등)
- **category**: 카테고리 (하위 항목을 가진 그룹)
- **section**: 페이지 내 섹션 (스크롤하여 확인)
- **action**: 액션 (PDF 다운로드 등)

### 4. 상태 관리

- **active**: 현재 구현되어 사용 가능
- **planned**: 향후 구현 예정

### 5. 다중 자녀 지원

**특징**:
- 한 학부모가 여러 자녀를 연결할 수 있음
- 각 페이지는 선택된 자녀의 데이터만 표시
- 자녀 전환 시 URL이 업데이트되어 북마크 가능

### 6. 알림/공지 기능 (계획 중)

**예상 기능**:
- 실시간 학습 알림 (플랜 완료, 목표 달성 등)
- 시스템 공지사항
- 성취 알림 (성적 향상, 목표 달성 등)
- 위험 신호 알림 (학습 집중도 저하 등)

**구현 고려사항**:
- 자녀별 알림 필터링
- 읽음/읽지 않음 상태 관리
- 알림 타입별 필터링 (알림/공지/성취)

### 7. 확장 고려사항

- 향후 추가될 기능은 기존 Depth 구조에 맞춰 확장 가능
- 새로운 도메인 추가 시 Depth 1에 추가, 이후 Depth 2, 3 순차 확장
- 자녀 선택 기능은 모든 페이지에서 일관되게 유지

---

## 🎯 활용 방안

이 IA 구조는 다음 용도로 활용됩니다:

1. **역할 기반 네비게이션 컴포넌트 설계**
2. **Breadcrumbs 컴포넌트 자동 생성**
3. **사이트맵 생성**
4. **SEO 메타데이터 구조화**
5. **사용자 플로우 분석 및 최적화**
6. **자녀 선택 기능 통합 설계**

---

## 📊 기능 매핑 체크리스트

### 요구사항 대응 확인

| 요구사항 | 구현 상태 | 경로/위치 |
|---|---|---|
| 자녀 현황 대시보드 | ✅ 구현됨 | `/parent/dashboard` |
| 자녀별 오늘 학습/계획/성과 | ✅ 구현됨 | 대시보드 내 섹션 |
| 성적 추세 | ✅ 구현됨 | `/parent/scores` |
| 학습 리포트 (주간/월간) | ✅ 구현됨 | `/parent/report/weekly`, `/parent/report/monthly` |
| 알림/공지 | ⚠️ 계획 중 | `/parent/notifications` (planned) |
| 계정 설정 | ✅ 구현됨 | `/parent/settings` |

---

## 🔄 자녀 선택 플로우

### 플로우 다이어그램

```
1. 페이지 접근
   ↓
2. 연결된 자녀 목록 조회
   ↓
3. 쿼리 파라미터에서 studentId 확인
   ├─ 있음 → 해당 자녀 선택
   └─ 없음 → 첫 번째 자녀 선택
   ↓
4. 접근 권한 확인
   ├─ 권한 있음 → 데이터 조회 및 표시
   └─ 권한 없음 → 오류 메시지 표시
   ↓
5. 자녀 선택 드롭다운 표시
   ↓
6. 자녀 선택 변경 시
   → URL 업데이트 (studentId 쿼리 파라미터 변경)
   → 페이지 데이터 새로고침
```

---

## 💡 UI/UX 고려사항

### 자녀 선택 드롭다운

**위치**: 모든 페이지 상단
**기능**:
- 연결된 자녀 목록 표시
- 현재 선택된 자녀 하이라이트
- 자녀 선택 시 URL 업데이트 (페이지 새로고침 없이)
- 자녀 정보 표시 (이름, 학년, 반)

### 데이터 로딩 상태

- 자녀 선택 변경 시 로딩 인디케이터 표시
- 데이터가 없을 때 Empty State 표시
- 접근 권한 없을 때 명확한 오류 메시지

### 반응형 디자인

- 모바일에서도 자녀 선택 드롭다운 접근 가능
- 사이드바 네비게이션 반응형 처리
- 차트 및 그래프 모바일 최적화

---

**작성일**: 2025-01-13  
**버전**: 1.0  
**담당자**: TimeLevelUp 개발팀

