# TimeLevelUp 전체 페이지 Depth 분석 및 Route 패턴 통합 분석

## 📋 개요

이 문서는 TimeLevelUp 서비스의 전체 페이지 구조를 역할별(학생/관리자/학부모)로 통합 분석하고, Depth 1/2/3 구조로 일관되게 재정렬합니다.
또한 Route 패턴 일관성을 제안하고, 중복 라우트 및 혼란 요소를 지적하여 개선 방안을 제시합니다.

---

## 🏗 전체 라우트 트리 구조

### 역할별 라우트 그룹

```
TimeLevelUp
├─ 인증 (Auth)
│  ├─ /login
│  ├─ /signup
│  ├─ /post-login
│  └─ /student-setup
│
├─ 학생 (Student) - /(student)
│  ├─ /dashboard (Depth 1)
│  │  ├─ /dashboard (Depth 2)
│  │  └─ /dashboard/recommendations (Depth 2)
│  │
│  ├─ /today (Depth 1)
│  │  ├─ /today (Depth 2)
│  │  └─ /today/plan/[planId] (Depth 3 - 동적)
│  │
│  ├─ /plan (Depth 1)
│  │  ├─ /plan (Depth 2 - 목록)
│  │  ├─ /plan/new (Depth 2 - 생성)
│  │  ├─ /plan/[id] (Depth 3 - 상세, 동적)
│  │  └─ /plan/[id]/edit (Depth 3 - 수정, 동적)
│  │
│  ├─ /contents (Depth 1)
│  │  ├─ /contents (Depth 2 - 목록, 탭: books|lectures|custom)
│  │  ├─ /contents/books (Depth 2)
│  │  │  ├─ /contents/books/new (Depth 3 - 생성)
│  │  │  ├─ /contents/books/[id] (Depth 3 - 상세, 동적)
│  │  │  └─ /contents/books/[id]/edit (Depth 3 - 수정, 동적)
│  │  ├─ /contents/lectures (Depth 2)
│  │  │  ├─ /contents/lectures/new (Depth 3 - 생성)
│  │  │  ├─ /contents/lectures/[id] (Depth 3 - 상세, 동적)
│  │  │  └─ /contents/lectures/[id]/edit (Depth 3 - 수정, 동적)
│  │  └─ /contents/custom (Depth 2)
│  │     ├─ /contents/custom/new (Depth 3 - 생성)
│  │     ├─ /contents/custom/[id] (Depth 3 - 상세, 동적)
│  │     └─ /contents/custom/[id]/edit (Depth 3 - 수정, 동적)
│  │
│  ├─ /analysis (Depth 1)
│  │  └─ /analysis (Depth 2)
│  │
│  ├─ /goals (Depth 1)
│  │  ├─ /goals (Depth 2 - 목록)
│  │  ├─ /goals/new (Depth 2 - 생성)
│  │  └─ /goals/[goalId] (Depth 3 - 상세, 동적)
│  │
│  ├─ /scores (Depth 1)
│  │  ├─ /scores (Depth 2 - 목록)
│  │  ├─ /scores/new (Depth 2 - 생성)
│  │  ├─ /scores/[id] (Depth 3 - 상세, 동적)
│  │  ├─ /scores/school/[grade] (Depth 3 - 내신, 동적)
│  │  └─ /scores/mock/[grade] (Depth 3 - 모의고사, 동적)
│  │
│  ├─ /schedule (Depth 1)
│  │  └─ /schedule/[date] (Depth 2 - 동적)
│  │
│  ├─ /reports (Depth 1) ⚠️ 혼란 요소
│  │  ├─ /reports (Depth 2 - 주간/월간 탭)
│  │  ├─ /report/weekly (Depth 2) ⚠️ 경로 불일치
│  │  └─ /report/monthly (Depth 2) ⚠️ 경로 불일치
│  │
│  ├─ /scheduler (Depth 1)
│  │  └─ /scheduler (Depth 2)
│  │
│  ├─ /focus (Depth 1)
│  │  └─ /focus (Depth 2)
│  │
│  └─ /blocks (Depth 1)
│     └─ /blocks (Depth 2)
│
├─ 관리자 (Admin/Consultant) - /(admin)
│  ├─ /admin/dashboard (Depth 1)
│  │  └─ /admin/dashboard (Depth 2)
│  │
│  ├─ /admin/students (Depth 1)
│  │  ├─ /admin/students (Depth 2 - 목록)
│  │  └─ /admin/students/[id] (Depth 3 - 상세, 동적)
│  │     └─ 탭: basic|plan|content|score|session|analysis|consulting
│  │
│  ├─ /admin/consulting (Depth 1)
│  │  └─ /admin/consulting (Depth 2)
│  │
│  ├─ /admin/reports (Depth 1) ⚠️ 혼란 요소
│  │  └─ /admin/reports (Depth 2 - 주간/월간 탭)
│  │
│  ├─ /admin/compare (Depth 1)
│  │  └─ /admin/compare (Depth 2)
│  │
│  ├─ /admin/settings (Depth 1)
│  │  ├─ /admin/settings (Depth 2)
│  │  └─ /admin/tenant/settings (Depth 2)
│  │
│  ├─ /admin/tools (Depth 1)
│  │  └─ /admin/tools (Depth 2)
│  │
│  └─ /admin/superadmin/tenants (Depth 1)
│     └─ /admin/superadmin/tenants (Depth 2)
│
└─ 학부모 (Parent) - /(parent)
   ├─ /parent/dashboard (Depth 1)
   │  └─ /parent/dashboard (Depth 2)
   │
   ├─ /parent/reports (Depth 1) ⚠️ 혼란 요소
   │  ├─ /parent/report/weekly (Depth 2) ⚠️ 경로 불일치
   │  └─ /parent/report/monthly (Depth 2) ⚠️ 경로 불일치
   │
   ├─ /parent/scores (Depth 1)
   │  └─ /parent/scores (Depth 2)
   │
   ├─ /parent/goals (Depth 1)
   │  └─ /parent/goals (Depth 2)
   │
   ├─ /parent/history (Depth 1)
   │  └─ /parent/history (Depth 2)
   │
   └─ /parent/settings (Depth 1)
      └─ /parent/settings (Depth 2)
```

---

## 📊 Depth 매핑 테이블

### Depth 1 (최상위 카테고리)

| 역할 | ID | 이름 | 경로 | 설명 |
|---|---|---|---|---|
| 공통 | `auth` | 인증 | `/login`, `/signup` | 로그인/회원가입 |
| 학생 | `dashboard` | 대시보드 | `/dashboard` | 학습 현황 요약 |
| 학생 | `today` | 오늘 학습 | `/today` | 오늘의 학습 계획 |
| 학생 | `plan` | 학습 계획 | `/plan` | 플랜 관리 |
| 학생 | `contents` | 콘텐츠 | `/contents` | 책/강의/커스텀 관리 |
| 학생 | `analysis` | 학습 분석 | `/analysis` | 취약 과목 분석 |
| 학생 | `goals` | 목표 | `/goals` | 목표 설정 |
| 학생 | `scores` | 성적 | `/scores` | 성적 관리 |
| 학생 | `schedule` | 스케줄 | `/schedule` | 시간표 관리 |
| 학생 | `reports` | 리포트 | `/reports` | 주간/월간 리포트 |
| 학생 | `scheduler` | 스케줄러 | `/scheduler` | 자동 스케줄 생성 |
| 학생 | `focus` | 집중 모드 | `/focus` | 포커스 타이머 |
| 학생 | `blocks` | 시간 블록 | `/blocks` | 시간 블록 설정 |
| 관리자 | `admin-dashboard` | 대시보드 | `/admin/dashboard` | 전체 학생 현황 |
| 관리자 | `admin-students` | 학생 관리 | `/admin/students` | 학생 목록/상세 |
| 관리자 | `admin-consulting` | 상담 노트 | `/admin/consulting` | 상담 노트 관리 |
| 관리자 | `admin-reports` | 리포트 | `/admin/reports` | 학생별 리포트 |
| 관리자 | `admin-compare` | 비교 분석 | `/admin/compare` | 학생 비교 분석 |
| 관리자 | `admin-settings` | 설정 | `/admin/settings` | 계정/기관 설정 |
| 관리자 | `admin-tools` | 도구 | `/admin/tools` | 관리자 도구 |
| 관리자 | `admin-tenants` | 기관 관리 | `/admin/superadmin/tenants` | 테넌트 관리 |
| 학부모 | `parent-dashboard` | 대시보드 | `/parent/dashboard` | 자녀 현황 |
| 학부모 | `parent-reports` | 리포트 | `/parent/report` | 주간/월간 리포트 |
| 학부모 | `parent-scores` | 성적 | `/parent/scores` | 성적 추세 |
| 학부모 | `parent-goals` | 목표 | `/parent/goals` | 목표 현황 |
| 학부모 | `parent-history` | 이력 | `/parent/history` | 학습 이력 |
| 학부모 | `parent-settings` | 설정 | `/parent/settings` | 계정 설정 |

### Depth 2 (카테고리 하위)

#### 학생 영역 (Depth 2)

| 부모 | ID | 이름 | 경로 | 타입 | 동적 파라미터 |
|---|---|---|---|---|---|
| `dashboard` | `dashboard-main` | 메인 대시보드 | `/dashboard` | page | - |
| `dashboard` | `dashboard-recommendations` | 추천 콘텐츠 | `/dashboard/recommendations` | page | - |
| `today` | `today-main` | 오늘 학습 메인 | `/today` | page | - |
| `plan` | `plan-list` | 플랜 목록 | `/plan` | page | `?date=YYYY-MM-DD` |
| `plan` | `plan-new` | 새 플랜 생성 | `/plan/new` | action | - |
| `contents` | `contents-list` | 콘텐츠 목록 | `/contents` | page | `?tab=books|lectures|custom` |
| `contents` | `contents-books` | 책 목록 | `/contents/books` | page | - |
| `contents` | `contents-lectures` | 강의 목록 | `/contents/lectures` | page | - |
| `contents` | `contents-custom` | 커스텀 목록 | `/contents/custom` | page | - |
| `analysis` | `analysis-main` | 취약 과목 분석 | `/analysis` | page | - |
| `goals` | `goals-list` | 목표 목록 | `/goals` | page | - |
| `goals` | `goals-new` | 새 목표 만들기 | `/goals/new` | action | - |
| `scores` | `scores-list` | 성적 목록 | `/scores` | page | `?type=school|mock` |
| `scores` | `scores-new` | 새 성적 입력 | `/scores/new` | action | - |
| `schedule` | `schedule-calendar` | 스케줄 캘린더 | `/schedule/[date]` | page | `[date]` |
| `reports` | `reports-list` | 리포트 목록 | `/reports` | page | `?period=weekly|monthly` |
| `scheduler` | `scheduler-main` | 자동 스케줄러 | `/scheduler` | tool | - |
| `focus` | `focus-timer` | 포커스 타이머 | `/focus` | page | - |
| `blocks` | `blocks-form` | 시간 블록 설정 | `/blocks` | page | - |

#### 관리자 영역 (Depth 2)

| 부모 | ID | 이름 | 경로 | 타입 | 동적 파라미터 |
|---|---|---|---|---|---|
| `admin-dashboard` | `admin-dashboard-main` | 대시보드 | `/admin/dashboard` | page | - |
| `admin-students` | `admin-students-list` | 학생 목록 | `/admin/students` | page | `?search&grade&has_score&sort&page` |
| `admin-consulting` | `admin-consulting-list` | 상담 노트 | `/admin/consulting` | page | `?search&student_id` |
| `admin-reports` | `admin-reports-list` | 리포트 | `/admin/reports` | page | `?period=weekly|monthly&search` |
| `admin-compare` | `admin-compare-main` | 비교 분석 | `/admin/compare` | page | - |
| `admin-settings` | `admin-settings-main` | 계정 설정 | `/admin/settings` | page | - |
| `admin-settings` | `admin-tenant-settings` | 기관 설정 | `/admin/tenant/settings` | page | - |
| `admin-tools` | `admin-tools-main` | 도구 | `/admin/tools` | page | - |
| `admin-tenants` | `admin-tenants-list` | 테넌트 목록 | `/admin/superadmin/tenants` | page | - |

#### 학부모 영역 (Depth 2)

| 부모 | ID | 이름 | 경로 | 타입 | 동적 파라미터 |
|---|---|---|---|---|---|
| `parent-dashboard` | `parent-dashboard-main` | 대시보드 | `/parent/dashboard` | page | `?studentId` |
| `parent-reports` | `parent-reports-weekly` | 주간 리포트 | `/parent/report/weekly` | page | `?studentId` |
| `parent-reports` | `parent-reports-monthly` | 월간 리포트 | `/parent/report/monthly` | page | `?studentId&month=YYYY-MM` |
| `parent-scores` | `parent-scores-main` | 성적 현황 | `/parent/scores` | page | `?studentId` |
| `parent-goals` | `parent-goals-main` | 목표 현황 | `/parent/goals` | page | `?studentId` |
| `parent-history` | `parent-history-main` | 학습 활동 이력 | `/parent/history` | page | `?studentId` |
| `parent-settings` | `parent-settings-main` | 설정 | `/parent/settings` | page | - |

### Depth 3 (상세/리소스/액션)

#### 학생 영역 (Depth 3)

| 부모 | ID | 이름 | 경로 | 타입 | 동적 파라미터 |
|---|---|---|---|---|---|
| `today-main` | `today-plan-execution` | 플랜 실행 | `/today/plan/[planId]` | resource | `[planId]` |
| `plan-list` | `plan-detail` | 플랜 상세 | `/plan/[id]` | resource | `[id]` |
| `plan-list` | `plan-edit` | 플랜 수정 | `/plan/[id]/edit` | action | `[id]` |
| `contents-books` | `contents-books-new` | 책 등록 | `/contents/books/new` | action | - |
| `contents-books` | `contents-books-detail` | 책 상세 | `/contents/books/[id]` | resource | `[id]` |
| `contents-books` | `contents-books-edit` | 책 수정 | `/contents/books/[id]/edit` | action | `[id]` |
| `contents-lectures` | `contents-lectures-new` | 강의 등록 | `/contents/lectures/new` | action | - |
| `contents-lectures` | `contents-lectures-detail` | 강의 상세 | `/contents/lectures/[id]` | resource | `[id]` |
| `contents-lectures` | `contents-lectures-edit` | 강의 수정 | `/contents/lectures/[id]/edit` | action | `[id]` |
| `contents-custom` | `contents-custom-new` | 커스텀 등록 | `/contents/custom/new` | action | - |
| `contents-custom` | `contents-custom-detail` | 커스텀 상세 | `/contents/custom/[id]` | resource | `[id]` |
| `contents-custom` | `contents-custom-edit` | 커스텀 수정 | `/contents/custom/[id]/edit` | action | `[id]` |
| `goals-list` | `goals-detail` | 목표 상세 | `/goals/[goalId]` | resource | `[goalId]` |
| `scores-list` | `scores-detail` | 성적 상세 | `/scores/[id]` | resource | `[id]` |
| `scores-list` | `scores-school` | 내신 성적 | `/scores/school/[grade]/[semester]/[subject]` | resource | `[grade]`, `[semester]`, `[subject]` |
| `scores-list` | `scores-mock` | 모의고사 성적 | `/scores/mock/[grade]/[subject]/[examType]` | resource | `[grade]`, `[subject]`, `[examType]` |

#### 관리자 영역 (Depth 3)

| 부모 | ID | 이름 | 경로 | 타입 | 동적 파라미터 |
|---|---|---|---|---|---|
| `admin-students-list` | `admin-students-detail` | 학생 상세 | `/admin/students/[id]` | resource | `[id]`, `?tab=basic|plan|...` |

---

## ⚠️ 중복 라우트 및 혼란 요소

### 1. 리포트 경로 불일치 ⚠️ **심각**

**문제점**:
- 학생: `/reports` (목록), `/report/weekly`, `/report/monthly` (상세) - 단수형/복수형 혼재
- 관리자: `/admin/reports` (단수형 없음)
- 학부모: `/parent/report/weekly`, `/parent/report/monthly` (단수형, 복수형 없음)

**현재 구조**:
```
학생:
  /reports (목록)
  /report/weekly (주간 리포트)
  /report/monthly (월간 리포트)

관리자:
  /admin/reports (목록, 주간/월간 탭)

학부모:
  /parent/report/weekly (주간 리포트)
  /parent/report/monthly (월간 리포트)
```

**개선 제안**:
```
통일된 패턴:
  /reports (학생 목록)
  /reports/weekly (학생 주간 리포트)
  /reports/monthly (학생 월간 리포트)
  
  /admin/reports (관리자 목록)
  /admin/reports/weekly (관리자 주간 리포트)
  /admin/reports/monthly (관리자 월간 리포트)
  
  /parent/reports (학부모 목록)
  /parent/reports/weekly (학부모 주간 리포트)
  /parent/reports/monthly (학부모 월간 리포트)
```

### 2. PDF 다운로드 경로 불일치 ⚠️ **심각**

**문제점**:
- 학생/학부모: `/report/weekly/pdf`, `/report/monthly/pdf` (공통 경로 사용)
- 관리자: PDF 경로 명확하지 않음

**현재 구조**:
```
/report/weekly/pdf?studentId=[id]&week=[date]
/report/monthly/pdf?studentId=[id]&month=[YYYY-MM]
```

**개선 제안**:
```
역할별 명시적 경로:
  /reports/weekly/pdf?studentId=[id]&week=[date]
  /reports/monthly/pdf?studentId=[id]&month=[YYYY-MM]
  
  /admin/reports/weekly/pdf?studentId=[id]&week=[date]
  /admin/reports/monthly/pdf?studentId=[id]&month=[YYYY-MM]
  
  /parent/reports/weekly/pdf?studentId=[id]&week=[date]
  /parent/reports/monthly/pdf?studentId=[id]&month=[YYYY-MM]
```

### 3. 성적 라우트 패턴 복잡성 ⚠️ **보통**

**문제점**:
- `/scores/school/[grade]/[semester]/[subject]` - 3단계 동적 세그먼트
- `/scores/mock/[grade]/[subject]/[examType]` - 3단계 동적 세그먼트
- 쿼리 파라미터 사용이 더 적합할 수 있음

**현재 구조**:
```
/scores/school/[grade]/[semester]/[subject]
/scores/mock/[grade]/[subject]/[examType]
```

**개선 제안**:
```
쿼리 파라미터 사용 (RESTful 하지 않지만 더 명확):
  /scores/school?grade=[grade]&semester=[semester]&subject=[subject]
  /scores/mock?grade=[grade]&subject=[subject]&examType=[examType]

또는 계층적 구조 유지:
  /scores/school/[grade]/[semester]?subject=[subject]
  /scores/mock/[grade]?subject=[subject]&examType=[examType]
```

### 4. 콘텐츠 라우트 패턴 일관성 ✅ **양호**

**현재 구조** (일관성 있음):
```
/contents/books/new
/contents/books/[id]
/contents/books/[id]/edit

/contents/lectures/new
/contents/lectures/[id]
/contents/lectures/[id]/edit

/contents/custom/new
/contents/custom/[id]
/contents/custom/[id]/edit
```

**평가**: ✅ RESTful 패턴을 잘 따르고 있음

### 5. 플랜 라우트 패턴 일관성 ✅ **양호**

**현재 구조** (일관성 있음):
```
/plan
/plan/new
/plan/[id]
/plan/[id]/edit
```

**평가**: ✅ RESTful 패턴을 잘 따르고 있음

### 6. 목표 라우트 패턴 ⚠️ **보통**

**문제점**:
- `/goals/[goalId]` - `goalId` 네이밍 (일관성)
- `/goals/[goalId]/edit` - 편집 경로가 없음 (현재 상세 페이지에서 수정)

**현재 구조**:
```
/goals
/goals/new
/goals/[goalId]
/goals/[goalId]/edit (미구현, 계획 중으로 보임)
```

**개선 제안**:
```
일관된 패턴:
  /goals
  /goals/new
  /goals/[id]
  /goals/[id]/edit
```

### 7. 관리자 학생 상세 탭 구조 ✅ **양호**

**현재 구조**:
```
/admin/students/[id]?tab=basic|plan|content|score|session|analysis|consulting
```

**평가**: ✅ 쿼리 파라미터로 탭 전환하는 것이 적절함

---

## 🔧 Route 패턴 일관성 제안

### 패턴 1: 리소스 중심 (RESTful)

**규칙**:
```
/{resource}           → 목록 (Depth 2)
/{resource}/new       → 생성 (Depth 2)
/{resource}/[id]      → 상세 (Depth 3)
/{resource}/[id]/edit → 수정 (Depth 3)
```

**적용 예시**:
```
✅ /plan
✅ /plan/new
✅ /plan/[id]
✅ /plan/[id]/edit

✅ /contents/books
✅ /contents/books/new
✅ /contents/books/[id]
✅ /contents/books/[id]/edit

⚠️ /goals (목표)
⚠️ /goals/new
⚠️ /goals/[goalId] → /goals/[id]로 통일 권장
⚠️ /goals/[goalId]/edit → 추가 권장
```

### 패턴 2: 계층적 구조 (Nested Resources)

**규칙**:
```
/{parent}/{child}           → 하위 리소스 목록 (Depth 2)
/{parent}/{child}/new       → 하위 리소스 생성 (Depth 2)
/{parent}/{child}/[id]      → 하위 리소스 상세 (Depth 3)
/{parent}/{child}/[id]/edit → 하위 리소스 수정 (Depth 3)
```

**적용 예시**:
```
✅ /contents/books
✅ /contents/books/new
✅ /contents/books/[id]
✅ /contents/books/[id]/edit

✅ /admin/students
✅ /admin/students/[id]
```

### 패턴 3: 역할별 접두사

**규칙**:
```
/                  → 학생 영역 (기본)
/admin/...         → 관리자 영역
/parent/...        → 학부모 영역
```

**적용 예시**:
```
✅ /dashboard
✅ /admin/dashboard
✅ /parent/dashboard

✅ /plan
✅ /admin/students/[id]?tab=plan

⚠️ /reports vs /report (불일치)
⚠️ /parent/report vs /parent/reports (불일치)
```

### 패턴 4: 리포트 통일 패턴 (개선 제안)

**제안 규칙**:
```
/{role}/reports           → 리포트 목록 (Depth 2)
/{role}/reports/weekly    → 주간 리포트 (Depth 2)
/{role}/reports/monthly   → 월간 리포트 (Depth 2)
/{role}/reports/weekly/pdf → PDF 다운로드 (Depth 3)
/{role}/reports/monthly/pdf → PDF 다운로드 (Depth 3)
```

**적용 예시**:
```
학생:
  /reports
  /reports/weekly
  /reports/monthly
  /reports/weekly/pdf
  /reports/monthly/pdf

관리자:
  /admin/reports
  /admin/reports/weekly
  /admin/reports/monthly
  /admin/reports/weekly/pdf
  /admin/reports/monthly/pdf

학부모:
  /parent/reports
  /parent/reports/weekly
  /parent/reports/monthly
  /parent/reports/weekly/pdf
  /parent/reports/monthly/pdf
```

---

## 📋 개선해야 할 부분 요약

### 🔴 심각 (즉시 개선 권장)

1. **리포트 경로 불일치**
   - 문제: `/reports` vs `/report/weekly` vs `/parent/report/weekly`
   - 개선: 모든 역할에서 `/reports/weekly`, `/reports/monthly`로 통일
   - 영향도: 높음 (사용자 혼란, 개발 복잡도)

2. **PDF 다운로드 경로 불일치**
   - 문제: 공통 경로 `/report/weekly/pdf` 사용
   - 개선: 역할별 명시적 경로로 분리
   - 영향도: 높음 (권한 관리, 로깅)

### 🟡 보통 (개선 권장)

3. **성적 라우트 패턴 복잡성**
   - 문제: 3단계 동적 세그먼트 (`/scores/school/[grade]/[semester]/[subject]`)
   - 개선: 쿼리 파라미터 또는 계층 구조 간소화
   - 영향도: 중간 (가독성, 유지보수)

4. **목표 라우트 네이밍**
   - 문제: `/goals/[goalId]` vs `/plan/[id]` (네이밍 불일치)
   - 개선: `/goals/[id]`로 통일
   - 영향도: 낮음 (코드 일관성)

5. **목표 수정 경로 누락**
   - 문제: `/goals/[goalId]/edit` 미구현
   - 개선: 다른 리소스와 동일한 패턴으로 추가
   - 영향도: 중간 (사용자 경험)

### 🟢 양호 (유지)

6. **콘텐츠 라우트 패턴** ✅
7. **플랜 라우트 패턴** ✅
8. **관리자 학생 상세 탭 구조** ✅
9. **역할별 접두사 패턴** ✅

---

## 🎯 통합 Route 패턴 규칙

### 기본 규칙

1. **역할별 접두사 사용**
   ```
   /           → 학생 (기본)
   /admin/...  → 관리자
   /parent/... → 학부모
   ```

2. **리소스 중심 RESTful 패턴**
   ```
   /{resource}           → 목록
   /{resource}/new       → 생성
   /{resource}/[id]      → 상세
   /{resource}/[id]/edit → 수정
   ```

3. **계층적 리소스 (Nested Resources)**
   ```
   /{parent}/{child}           → 하위 리소스 목록
   /{parent}/{child}/new       → 하위 리소스 생성
   /{parent}/{child}/[id]      → 하위 리소스 상세
   /{parent}/{child}/[id]/edit → 하위 리소스 수정
   ```

4. **복수형 사용 (명확성)**
   ```
   ✅ /reports/weekly
   ❌ /report/weekly
   
   ✅ /contents/books
   ❌ /content/books
   ```

5. **동적 세그먼트 최소화**
   ```
   ✅ /scores/school?grade=[grade]&semester=[semester]&subject=[subject]
   ⚠️ /scores/school/[grade]/[semester]/[subject]
   ```

6. **네이밍 일관성**
   ```
   ✅ /goals/[id]
   ❌ /goals/[goalId]
   ```

---

## 📊 Depth 구조 재정렬 제안

### 학생 영역 재정렬

```
Depth 1                    Depth 2                        Depth 3
────────────────────────────────────────────────────────────────────────
dashboard                  dashboard                      (section)
                          dashboard/recommendations       (section)

today                      today                          (section)
                          today/plan/[planId]             [planId]

plan                       plan                           (list)
                          plan/new                        (create)
                          plan/[id]                       (detail)
                          plan/[id]/edit                  (edit)

contents                   contents                       (list, tabs)
                          contents/books                  (list)
                          contents/books/new              (create)
                          contents/books/[id]             (detail)
                          contents/books/[id]/edit        (edit)
                          contents/lectures               (list)
                          contents/lectures/new           (create)
                          contents/lectures/[id]          (detail)
                          contents/lectures/[id]/edit     (edit)
                          contents/custom                 (list)
                          contents/custom/new             (create)
                          contents/custom/[id]            (detail)
                          contents/custom/[id]/edit       (edit)

analysis                   analysis                       (page)

goals                      goals                          (list)
                          goals/new                       (create)
                          goals/[id]                      (detail)
                          goals/[id]/edit                 (edit) ⚠️ 추가 필요

scores                     scores                         (list)
                          scores/new                      (create)
                          scores/[id]                     (detail)
                          scores/school                   (school list)
                          scores/school/[grade]           (grade list)
                          scores/mock                     (mock list)
                          scores/mock/[grade]             (grade list)

schedule                   schedule                       (redirect)
                          schedule/[date]                 [date]

reports                    reports                        (list, tabs) ⚠️ 개선
                          reports/weekly                  (weekly) ⚠️ 개선
                          reports/monthly                 (monthly) ⚠️ 개선
                          reports/weekly/pdf              (pdf) ⚠️ 개선
                          reports/monthly/pdf             (pdf) ⚠️ 개선

scheduler                  scheduler                      (tool)

focus                      focus                          (timer)

blocks                     blocks                         (form)
```

### 관리자 영역 재정렬

```
Depth 1                    Depth 2                        Depth 3
────────────────────────────────────────────────────────────────────────
admin/dashboard            admin/dashboard                (page)

admin/students             admin/students                 (list)
                          admin/students/[id]             (detail)
                          admin/students/[id]?tab=...     (tabs)

admin/consulting           admin/consulting               (list)

admin/reports              admin/reports                  (list, tabs) ⚠️ 개선
                          admin/reports/weekly            (weekly) ⚠️ 개선
                          admin/reports/monthly           (monthly) ⚠️ 개선
                          admin/reports/weekly/pdf        (pdf) ⚠️ 개선
                          admin/reports/monthly/pdf       (pdf) ⚠️ 개선

admin/compare              admin/compare                  (compare)

admin/settings             admin/settings                 (account)
                          admin/tenant/settings           (tenant)

admin/tools                admin/tools                    (tools)

admin/superadmin/tenants   admin/superadmin/tenants       (list)
```

### 학부모 영역 재정렬

```
Depth 1                    Depth 2                        Depth 3
────────────────────────────────────────────────────────────────────────
parent/dashboard           parent/dashboard               (page, ?studentId)

parent/reports             parent/reports                 (list) ⚠️ 추가 권장
                          parent/reports/weekly           (weekly) ⚠️ 개선
                          parent/reports/monthly          (monthly) ⚠️ 개선
                          parent/reports/weekly/pdf       (pdf) ⚠️ 개선
                          parent/reports/monthly/pdf      (pdf) ⚠️ 개선

parent/scores              parent/scores                  (scores, ?studentId)

parent/goals               parent/goals                   (goals, ?studentId)

parent/history             parent/history                 (history, ?studentId)

parent/settings            parent/settings                (settings)
```

---

## ✅ 우선순위별 개선 작업

### Phase 1: 즉시 개선 (심각도 높음)

1. **리포트 경로 통일**
   - [ ] `/report/weekly` → `/reports/weekly` (학생)
   - [ ] `/report/monthly` → `/reports/monthly` (학생)
   - [ ] `/parent/report/weekly` → `/parent/reports/weekly` (학부모)
   - [ ] `/parent/report/monthly` → `/parent/reports/monthly` (학부모)
   - [ ] PDF 경로도 역할별로 분리

2. **PDF 다운로드 경로 명시화**
   - [ ] `/report/weekly/pdf` → `/reports/weekly/pdf` (학생)
   - [ ] `/report/monthly/pdf` → `/reports/monthly/pdf` (학생)
   - [ ] `/parent/reports/weekly/pdf` (학부모)
   - [ ] `/admin/reports/weekly/pdf` (관리자)

### Phase 2: 단기 개선 (심각도 중간)

3. **목표 라우트 네이밍 통일**
   - [ ] `/goals/[goalId]` → `/goals/[id]`
   - [ ] `/goals/[id]/edit` 경로 추가

4. **학부모 리포트 목록 페이지 추가**
   - [ ] `/parent/reports` 페이지 생성 (주간/월간 탭)

### Phase 3: 장기 개선 (심각도 낮음)

5. **성적 라우트 패턴 간소화 검토**
   - [ ] 3단계 동적 세그먼트 → 쿼리 파라미터 검토
   - [ ] 성능 및 SEO 영향도 분석

---

## 📝 마이그레이션 체크리스트

### 리포트 경로 마이그레이션

- [ ] 기존 `/report/weekly` → `/reports/weekly` 리다이렉트 추가
- [ ] 기존 `/report/monthly` → `/reports/monthly` 리다이렉트 추가
- [ ] 기존 `/parent/report/weekly` → `/parent/reports/weekly` 리다이렉트 추가
- [ ] 기존 `/parent/report/monthly` → `/parent/reports/monthly` 리다이렉트 추가
- [ ] PDF 경로 업데이트
- [ ] 네비게이션 링크 업데이트
- [ ] Breadcrumbs 로직 업데이트
- [ ] 테스트 케이스 업데이트

### 목표 라우트 마이그레이션

- [ ] 기존 `/goals/[goalId]` → `/goals/[id]` 리다이렉트 추가
- [ ] 파라미터 이름 변경 (`goalId` → `id`)
- [ ] `/goals/[id]/edit` 경로 구현
- [ ] 네비게이션 링크 업데이트

---

**작성일**: 2025-01-13  
**버전**: 1.0  
**담당자**: TimeLevelUp 개발팀

