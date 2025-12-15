# 다크 모드 최적화 작업 문서

**작업 일시**: 2025-02-04  
**작업 범위**: 다크 모드 하드코딩된 색상 클래스 교체 및 중복 코드 최적화  
**작업 완료도**: Phase 1-3 완료 (약 75-80%)

## 작업 개요

다크 모드 점검 결과를 바탕으로 하드코딩된 색상 클래스를 유틸리티 함수로 교체하고, 중복 코드를 최적화하여 전체 다크 모드 지원을 개선했습니다.

## 주요 작업 내용

### 1. 중복 코드 최적화

#### 1.1 유틸리티 함수 통합
- **파일**: `lib/utils/themeUtils.ts`
- **변경 사항**: `darkMode.ts`의 모든 export를 re-export하도록 변경
- **기존 코드 호환성**: `themeClasses` 객체는 유지하여 기존 코드와의 호환성 보장
- **결과**: 중복 코드 제거 및 단일 소스 유지

#### 1.2 새로운 유틸리티 함수 추가
- **파일**: `lib/utils/darkMode.ts`
- **추가된 함수**:
  - `riskSignalStyles`: Parent 페이지용 위험 신호 스타일 객체
  - `adminLevelColors`: Admin 대시보드용 레벨 색상 객체

### 2. 하드코딩된 색상 클래스 교체

#### 2.1 Parent 페이지 (완료)

**수정된 파일**:
1. `app/(parent)/parent/_components/RiskSignals.tsx`
   - `border-red-300 bg-red-50` → `riskSignalStyles.container`
   - `text-red-900` → `riskSignalStyles.title`
   - `text-red-700` → `riskSignalStyles.description`
   - `bg-white` → `riskSignalStyles.card`
   - `text-gray-700` → `textSecondary`

2. `app/(parent)/parent/scores/page.tsx`
   - `text-gray-900` → `textPrimary`
   - `text-gray-500` → `textMuted`
   - `text-gray-700` → `textSecondary`
   - `bg-white` → `bgSurface`
   - `border-gray-200` → `borderDefault`
   - `bg-gray-50` → `bgPage`
   - 경고/에러 메시지 색상에 다크 모드 클래스 추가

3. `app/(parent)/parent/goals/page.tsx`
   - 모든 하드코딩된 색상 클래스를 유틸리티 함수로 교체
   - 상태별 색상 카드에 다크 모드 클래스 추가
   - ProgressBar 배경색에 다크 모드 클래스 추가

4. `app/(parent)/parent/_components/RecentScores.tsx`
   - `bg-white border-gray-200` → `bgSurface borderDefault`
   - `text-gray-900` → `textPrimary`
   - `text-gray-500` → `textMuted`
   - 등급 변화 색상에 다크 모드 클래스 추가

5. `app/(parent)/parent/_components/RecommendationSection.tsx`
   - 그라디언트 배경에 다크 모드 클래스 추가
   - `text-gray-900` → `textPrimary`
   - `text-gray-600` → `textSecondary`
   - 배지 색상에 다크 모드 클래스 추가

#### 2.2 Student 페이지 (우선순위 높은 것만 완료)

**수정된 파일**:
1. `app/(student)/scores/_components/ScoreCard.tsx`
   - 템플릿 리터럴을 `cn()` 함수로 변경
   - 모든 `${textMuted}`, `${textPrimary}` 패턴을 `cn("...", textMuted)` 형태로 변경

2. `app/(student)/report/weekly/_components/GoalProgressSection.tsx`
   - 이미 `goalStatusColors` 사용 중 (변경 불필요)

3. `app/(student)/scores/dashboard/school/_components/SchoolWeakSubjectSection.tsx`
   - 이미 `getRiskColorClasses` 사용 중
   - 배지 텍스트 색상에 다크 모드 클래스 추가

### 3. 적용된 패턴

#### 3.1 기본 색상 교체 패턴
```tsx
// Before
<div className="bg-white border-gray-200 text-gray-900">

// After
import { bgSurface, borderDefault, textPrimary } from "@/lib/utils/darkMode";
<div className={cn(bgSurface, borderDefault, textPrimary)}>
```

#### 3.2 상태 색상 객체 교체 패턴
```tsx
// Before
const statusColors = {
  scheduled: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
};

// After
import { goalStatusColors } from "@/lib/utils/darkMode";
const statusColors = goalStatusColors;
```

#### 3.3 템플릿 리터럴을 cn() 함수로 변경
```tsx
// Before
<span className={`text-xs ${textMuted}`}>

// After
<span className={cn("text-xs", textMuted)}>
```

## 수정된 파일 목록

### 유틸리티 파일
- `lib/utils/darkMode.ts` - 새로운 유틸리티 함수 추가
- `lib/utils/themeUtils.ts` - darkMode.ts re-export로 변경

### Parent 페이지
- `app/(parent)/parent/_components/RiskSignals.tsx`
- `app/(parent)/parent/scores/page.tsx`
- `app/(parent)/parent/goals/page.tsx`
- `app/(parent)/parent/_components/RecentScores.tsx`
- `app/(parent)/parent/_components/RecommendationSection.tsx`

### Student 페이지
- `app/(student)/scores/_components/ScoreCard.tsx`
- `app/(student)/scores/dashboard/school/_components/SchoolWeakSubjectSection.tsx`

### Admin 페이지
- `app/(admin)/admin/students/page.tsx`
- `app/(admin)/admin/plan-groups/[id]/page.tsx`

## 검증 결과

### Lint 검사
- ✅ 모든 수정된 파일에서 lint 에러 없음
- ✅ TypeScript 타입 검사 통과

### 코드 품질
- ✅ 일관된 import 패턴 적용
- ✅ `cn()` 함수를 통한 클래스 병합 사용
- ✅ 유틸리티 함수 재사용성 향상

## Phase 4: Admin 페이지 (완료)

### 수정된 파일
1. `app/(admin)/admin/students/page.tsx`
   - 테이블 스타일 유틸리티 함수 적용 (`tableHeaderBase`, `tableCellBase`, `tableContainer`, `tableRowBase`)
   - 모든 입력 필드, 버튼, 링크에 다크 모드 클래스 추가
   - 상태 배지 색상에 다크 모드 클래스 추가
   - 페이지네이션 버튼 스타일 개선

2. `app/(admin)/admin/plan-groups/[id]/page.tsx`
   - 모든 하드코딩된 색상 클래스를 유틸리티 함수로 교체
   - 학생 정보 카드, 헤더 정보 카드, 진행 상황 카드에 다크 모드 지원
   - 템플릿 통계 카드에 다크 모드 클래스 추가

3. `app/(admin)/admin/dashboard/page.tsx`
   - 이미 유틸리티 함수 사용 중 (변경 불필요)

4. `app/(admin)/admin/students/[id]/_components/RiskCard.tsx`
   - 이미 다크 모드 지원 완료 (변경 불필요)

## 남은 작업 (선택적)

### Student 페이지 (추가 작업)
- 리포트 관련 컴포넌트들
- 기타 우선순위 낮은 컴포넌트들

## 향후 유지보수 가이드

### 새로운 컴포넌트 작성 시
1. 하드코딩된 색상 클래스 사용 금지
2. `lib/utils/darkMode.ts`의 유틸리티 함수 사용
3. `cn()` 함수를 통한 클래스 병합

### 색상 추가가 필요한 경우
1. `lib/utils/darkMode.ts`에 새로운 유틸리티 함수 추가
2. 다크 모드 클래스 포함 필수
3. 3곳 이상에서 사용되는 패턴만 추가 (과도한 추상화 금지)

### 기존 코드 수정 시
1. 하드코딩된 색상 클래스 발견 시 유틸리티 함수로 교체
2. 템플릿 리터럴 대신 `cn()` 함수 사용
3. 상태 색상 객체는 기존 유틸리티 함수 활용

## 참고 자료

- 다크 모드 점검 문서: `docs/2025-02-02-dark-mode-review.md`
- 다크 모드 구현 가이드: `docs/2025-02-02-dark-mode-implementation-guide.md`
- 유틸리티 함수: `lib/utils/darkMode.ts`

## 완료 체크리스트

- [x] 중복 코드 최적화 (themeUtils.ts 통합)
- [x] 새로운 유틸리티 함수 추가 (riskSignalStyles, adminLevelColors)
- [x] Parent 페이지 하드코딩된 색상 교체 (5개 파일)
- [x] Student 페이지 우선순위 높은 컴포넌트 수정 (3개 파일)
- [x] Lint 검사 통과
- [x] 문서 작성

## 예상 완성도

- **현재 완성도**: 약 90-95%
- **핵심 기능**: 100% 완료
- **Phase 1-4 완료**: 모든 우선순위 높은 페이지 완료
- **남은 작업**: 기타 Student 페이지 컴포넌트 (선택적)

---

**작업 완료 일시**: 2025-02-04

