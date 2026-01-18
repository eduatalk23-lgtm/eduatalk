# 성적 관리 메뉴 대체 및 통합 완료 문서

## 📋 개요

기존 레거시 성적 대시보드를 새로운 통합 성적 대시보드로 완전히 대체하고, 학생/학부모/관리자 영역의 성적 관련 페이지를 새 스키마(`student_internal_scores`, `student_mock_scores`)에 맞춰 업데이트했습니다.

**작업 일자**: 2024년 11월  
**기준 API**: `/api/students/[id]/score-dashboard`

---

## ✅ 완료된 작업

### 1. 네비게이션 메뉴 업데이트

#### 학생 영역
- **파일**: `components/navigation/global/categoryConfig.ts`
- **변경 사항**: 성적 대시보드 링크를 `/scores/dashboard` → `/scores/dashboard/unified`로 변경

### 2. 학생 영역 - 대시보드 라우트 변경

#### 리다이렉트 설정
- **파일**: `app/(student)/scores/page.tsx`
  - `/scores/dashboard` → `/scores/dashboard/unified`로 리다이렉트

- **파일**: `app/(student)/scores/dashboard/page.tsx`
  - 레거시 대시보드 페이지를 통합 대시보드로 리다이렉트하도록 단순화
  - `@deprecated` 주석 추가

#### 레거시 컴포넌트 Deprecated 처리
다음 컴포넌트들에 `@deprecated` 주석 추가:
- `SummarySection.tsx`
- `SemesterChartsSection.tsx`
- `SubjectTrendSection.tsx`
- `MockExamTrendSection.tsx`
- `CompareSection.tsx`
- `WeakSubjectSection.tsx`
- `InsightPanel.tsx`
- `IntegratedComparisonChart.tsx`
- `ScoreConsistencyAnalysis.tsx`
- `DashboardSubTabs.tsx`

#### 공통 컴포넌트 업데이트
- **파일**: `app/(student)/scores/_components/ScoreTypeTabs.tsx`
  - 대시보드 링크를 `/scores/dashboard/unified`로 변경

### 3. 학생 영역 - 성적 입력 페이지

#### 내신 성적 입력
- **파일**: `app/(student)/scores/school/[grade]/[semester]/page.tsx`
  - `getSchoolScores()` 함수 사용 (이미 `student_internal_scores` 테이블 참조)
  - deprecated 경고 주석 추가

- **파일**: `app/(student)/scores/school/[grade]/[semester]/[subject-group]/new/_components/SchoolScoreForm.tsx`
  - `@deprecated` 주석 추가
  - 향후 개선 사항 명시 (FK 필드 사용, 새 API 사용)

- **파일**: `app/(student)/scores/school/[grade]/[semester]/[subject-group]/[id]/edit/_components/SchoolScoreEditForm.tsx`
  - `@deprecated` 주석 추가

#### 모의고사 성적 입력
- **파일**: `app/(student)/scores/mock/[grade]/[month]/[exam-type]/page.tsx`
  - `getMockScores()` 함수 사용 (이미 `student_mock_scores` 테이블 사용)
  - 확인 주석 추가

- **파일**: `app/(student)/scores/mock/[grade]/[month]/[exam-type]/_components/MockScoreFormModal.tsx`
  - `@deprecated` 주석 추가
  - 향후 개선 사항 명시

### 4. 관리자 영역 - 성적 관련 페이지 업데이트

#### 학생 상세 페이지 내 성적 탭
- **파일**: `app/(admin)/admin/students/[id]/_components/ScoreSummarySection.tsx`
  - 기존: `student_school_scores`, `student_mock_scores` 직접 쿼리
  - 변경: `fetchScoreDashboard()` API 사용
  - API 응답 구조에 맞춰 UI 재구성 (내신 분석, 모의고사 분석 표시)

- **파일**: `app/(admin)/admin/students/[id]/_components/ScoreTrendSection.tsx`
  - 기존: `getStudentScoreTrendForAdmin()` 함수 사용
  - 변경: `fetchScoreDashboard()` API 사용
  - 통계 및 전략 분석 표시로 단순화

#### 학생 목록 페이지 필터링
- **파일**: `app/(admin)/admin/students/page.tsx`
  - `student_school_scores` → `student_internal_scores` 테이블 참조 변경

### 5. 학부모 영역 - 성적 페이지 업데이트

- **파일**: `app/(parent)/parent/scores/page.tsx`
  - 기존: `fetchAllScores()` 함수 사용 (레거시 스키마)
  - 변경: `fetchScoreDashboard()` API 사용
  - 자녀 선택 로직 유지, 데이터 표시 방식을 새 API 구조에 맞춤
  - 내신 분석, 모의고사 분석, 입시 전략 카드 표시

### 6. 데이터 레이어 업데이트

#### lib/data 폴더
- **파일**: `lib/data/studentScores.ts`
  - `getSchoolScores()` 함수: 이미 `student_internal_scores` 테이블 참조
  - fallback 쿼리에서 `student_school_scores` → `student_internal_scores` 변경

- **파일**: `lib/data/studentStats.ts`
  - `student_school_scores` → `student_internal_scores` 테이블 참조 변경

- **파일**: `lib/data/admin/studentData.ts`
  - `student_school_scores` → `student_internal_scores` 테이블 참조 변경

---

## 🔄 변경된 라우트 목록

| 기존 라우트 | 새 라우트 | 상태 |
|------------|----------|------|
| `/scores/dashboard` | `/scores/dashboard/unified` | 리다이렉트 |
| `/scores/dashboard/school` | (레거시, deprecated) | 유지 (deprecated) |
| `/scores/dashboard/mock` | (레거시, deprecated) | 유지 (deprecated) |

---

## 📝 새 API 사용 방법

### 학생 영역
```typescript
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";

const data = await fetchScoreDashboard({
  studentId: user.id,
  tenantId: tenantContext.tenantId,
  grade: 2,
  semester: 1,
});
```

### 관리자/학부모 영역
```typescript
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

const tenantContext = await getTenantContext();
const data = await fetchScoreDashboard({
  studentId: selectedStudentId,
  tenantId: tenantContext.tenantId,
});
```

---

## ⚠️ Deprecated 컴포넌트 목록

다음 컴포넌트들은 레거시 성적 대시보드에서 사용되며, 새로운 통합 대시보드에서는 사용되지 않습니다:

### 대시보드 컴포넌트
- `app/(student)/scores/dashboard/_components/SummarySection.tsx`
- `app/(student)/scores/dashboard/_components/SemesterChartsSection.tsx`
- `app/(student)/scores/dashboard/_components/SubjectTrendSection.tsx`
- `app/(student)/scores/dashboard/_components/MockExamTrendSection.tsx`
- `app/(student)/scores/dashboard/_components/CompareSection.tsx`
- `app/(student)/scores/dashboard/_components/WeakSubjectSection.tsx`
- `app/(student)/scores/dashboard/_components/InsightPanel.tsx`
- `app/(student)/scores/dashboard/_components/IntegratedComparisonChart.tsx`
- `app/(student)/scores/dashboard/_components/ScoreConsistencyAnalysis.tsx`
- `app/(student)/scores/dashboard/_components/DashboardSubTabs.tsx`

### 성적 입력 폼 컴포넌트
- `app/(student)/scores/school/[grade]/[semester]/[subject-group]/new/_components/SchoolScoreForm.tsx`
- `app/(student)/scores/school/[grade]/[semester]/[subject-group]/[id]/edit/_components/SchoolScoreEditForm.tsx`
- `app/(student)/scores/mock/[grade]/[month]/[exam-type]/_components/MockScoreFormModal.tsx`

**참고**: 이 컴포넌트들은 향후 새 스키마에 맞춰 완전히 재구축될 예정입니다.

---

## 🗄️ 스키마 변경 사항

### 테이블명 변경
- `student_school_scores` → `student_internal_scores`
- `student_mock_scores` (변경 없음)

### 주요 필드 변경
새 스키마에서는 FK 필드를 사용합니다:
- `subject_id` (FK to subjects)
- `subject_group_id` (FK to subject_groups)
- `subject_type_id` (FK to subject_types)
- `term_id` (FK to student_terms)

---

## 📚 참고 문서

- `docs/score-dashboard-frontend-implementation.md` - 통합 대시보드 프론트엔드 구현 가이드
- `app/api/students/[id]/score-dashboard/route.ts` - API 엔드포인트
- `lib/api/scoreDashboard.ts` - API 클라이언트 함수
- `lib/types/scoreDashboard.ts` - API 응답 타입 정의

---

## 🚧 향후 개선 사항

### 성적 입력 페이지 완전 재구축
현재 성적 입력 폼 컴포넌트들은 레거시 스키마를 사용하고 있습니다. 향후 다음 사항을 개선해야 합니다:

1. **내신 성적 입력 폼**
   - `subject_id`, `subject_group_id`, `subject_type_id` FK 필드 사용
   - `createInternalScore` (app/actions/scores-internal.ts) 사용
   - `term_id` 자동 생성 로직 추가

2. **모의고사 성적 입력 폼**
   - `subject_id`, `subject_group_id` FK 필드 사용
   - `exam_year`, `exam_month` 필드 추가
   - `createMockScore` (app/actions/scores-internal.ts) 사용

### 레거시 컴포넌트 제거
모든 deprecated 컴포넌트들이 안전하게 제거될 수 있도록 확인 후 삭제 예정입니다.

---

## ✅ 검증 체크리스트

- [x] 학생 영역 네비게이션 메뉴 업데이트
- [x] 레거시 대시보드 리다이렉트 설정
- [x] 레거시 컴포넌트 deprecated 처리
- [x] 관리자 영역 성적 페이지 새 API 사용
- [x] 학부모 영역 성적 페이지 새 API 사용
- [x] 데이터 레이어 테이블 참조 변경
- [x] 문서 작성

---

**작업 완료일**: 2024년 11월

