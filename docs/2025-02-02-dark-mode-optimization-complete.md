# 다크모드 개선 및 최적화 완료 보고서

**작업 일자**: 2025-02-02  
**작업 범위**: 다크모드 유틸리티 확장, 중복 코드 통합, Student/Admin 컴포넌트 다크모드 적용

---

## 📋 작업 개요

재점검 보고서에서 발견된 문제점들을 해결하고, 중복 코드를 통합하여 유틸리티 함수로 최적화했습니다.

---

## ✅ 완료된 작업

### Phase 1: 유틸리티 함수 확장 및 중복 코드 통합

#### 1.1 lib/utils/darkMode.ts 확장

**추가된 유틸리티**:

1. **상태 색상 유틸리티**
   - `goalStatusColors`: 목표 상태 색상 (Goal Progress용)
   - `planStatusColors`: 플랜 상태 색상 (Plan Status용)

2. **위험도 색상 유틸리티**
   - `riskLevelColors`: 위험도 레벨 색상 (Admin Dashboard용)
   - `getRiskColorClasses(riskScore)`: 위험도 점수에 따른 색상 클래스 반환 함수
   - `riskSectionGradient`: 위험도 섹션용 그라디언트 배경

**코드 예시**:
```typescript
export const goalStatusColors: Record<string, string> = {
  scheduled: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

export function getRiskColorClasses(riskScore: number): string {
  if (riskScore >= 70) {
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800";
  }
  if (riskScore >= 50) {
    return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800";
  }
  return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800";
}
```

#### 1.2 lib/constants/planLabels.ts 수정

- `statusColors` 객체를 `planStatusColors`로 통합
- 기존 코드 호환성을 위해 `statusColors`는 `planStatusColors`를 참조하도록 변경
- `@deprecated` 주석 추가

---

### Phase 2: Student 페이지 컴포넌트 수정

#### 2.1 ScoreCard 컴포넌트 (`app/(student)/scores/_components/ScoreCard.tsx`)

**변경 사항**:
- `text-gray-500` → `textMuted` 유틸리티 사용
- `text-gray-900` → `textPrimary` 유틸리티 사용
- `border-gray-200` → `borderDefault` 유틸리티 사용
- 기간 배지에 다크모드 추가 (`bg-blue-50 dark:bg-blue-900/30`, `text-blue-700 dark:text-blue-300`)

#### 2.2 GoalProgressSection 컴포넌트

**Weekly** (`app/(student)/report/weekly/_components/GoalProgressSection.tsx`):
- 중복된 `statusColors` 객체 제거
- `goalStatusColors` 유틸리티 사용
- 모든 하드코딩된 색상을 다크모드 유틸리티로 교체

**Monthly** (`app/(student)/report/monthly/_components/GoalProgressSection.tsx`):
- 동일한 패턴으로 수정

#### 2.3 WeakSubjectSection 컴포넌트

**School** (`app/(student)/scores/dashboard/school/_components/SchoolWeakSubjectSection.tsx`):
- `getRiskColor` 함수 제거
- `getRiskColorClasses` 유틸리티 함수 사용
- 텍스트 색상 다크모드 적용

**Mock** (`app/(student)/scores/dashboard/mock/_components/MockWeakSubjectSection.tsx`):
- 동일한 패턴으로 수정
- EmptyState 섹션에도 다크모드 적용

---

### Phase 3: Admin 페이지 컴포넌트 수정

#### 3.1 RiskCard 컴포넌트 (`app/(admin)/admin/students/[id]/_components/RiskCard.tsx`)

**변경 사항**:
- `levelColors`와 `levelBadgeColors` 객체를 `riskLevelColors` 유틸리티로 교체
- 모든 텍스트 색상을 다크모드 유틸리티로 교체
- 배경색, 테두리, 호버 상태에 다크모드 추가

**코드 예시**:
```typescript
// Before
const levelBadgeColors = {
  high: "bg-red-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-green-500 text-white",
};

// After
import { riskLevelColors } from "@/lib/utils/darkMode";
// riskLevelColors는 이미 다크모드를 포함한 클래스를 제공
```

#### 3.2 Admin Dashboard (`app/(admin)/admin/dashboard/page.tsx`)

**변경 사항**:
- 위험 학생 리스트 섹션의 `levelColors` 객체를 `riskLevelColors` 유틸리티로 교체
- 위험 학생 리스트 섹션 전체에 다크모드 적용
  - 배경 그라디언트: `from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20`
  - 테두리: `border-red-200 dark:border-red-800`
  - 텍스트: `text-red-900 dark:text-red-300`
  - 카드 호버: `hover:bg-red-50 dark:hover:bg-red-900/30`

---

## 📊 통계

### 수정된 파일 수
- **총 10개 파일** 수정
- **393줄 추가**, **139줄 삭제**

### 중복 코드 제거
1. **statusColors 객체**: 3곳 → 1곳 (유틸리티 함수로 통합)
2. **getRiskColor 함수**: 2곳 → 1곳 (유틸리티 함수로 통합)
3. **levelColors 객체**: 2곳 → 1곳 (유틸리티 함수로 통합)

### 다크모드 적용 범위
- **Student 컴포넌트**: 5개 파일
- **Admin 컴포넌트**: 2개 파일
- **유틸리티 함수**: 1개 파일 확장

---

## 🎯 개선 효과

### 1. 코드 중복 제거
- 중복된 색상 객체와 함수를 유틸리티로 통합하여 유지보수성 향상
- 색상 변경 시 한 곳만 수정하면 전체에 반영

### 2. 일관성 향상
- 모든 컴포넌트에서 동일한 다크모드 색상 패턴 사용
- 하드코딩된 색상 제거로 일관된 디자인 시스템 구축

### 3. 확장성 향상
- 새로운 상태나 위험도 레벨 추가 시 유틸리티 함수만 확장하면 됨
- 재사용 가능한 색상 유틸리티로 개발 속도 향상

---

## 📝 주요 변경 파일 목록

1. `lib/utils/darkMode.ts` - 유틸리티 함수 확장
2. `lib/constants/planLabels.ts` - statusColors 통합
3. `app/(student)/scores/_components/ScoreCard.tsx` - 다크모드 적용
4. `app/(student)/report/weekly/_components/GoalProgressSection.tsx` - 유틸리티 사용
5. `app/(student)/report/monthly/_components/GoalProgressSection.tsx` - 유틸리티 사용
6. `app/(student)/scores/dashboard/school/_components/SchoolWeakSubjectSection.tsx` - 유틸리티 사용
7. `app/(student)/scores/dashboard/mock/_components/MockWeakSubjectSection.tsx` - 유틸리티 사용
8. `app/(admin)/admin/students/[id]/_components/RiskCard.tsx` - 유틸리티 사용
9. `app/(admin)/admin/dashboard/page.tsx` - 유틸리티 사용

---

## 🔍 검증 완료

- ✅ ESLint 에러 없음
- ✅ TypeScript 타입 안전성 유지
- ✅ 모든 하드코딩된 색상 제거
- ✅ 다크모드 클래스 일관성 확인

---

## 🚀 다음 단계 (선택 사항)

1. **추가 Admin 컴포넌트**: 다른 Admin 페이지의 하드코딩된 색상 점검
2. **Parent 컴포넌트**: Parent 페이지의 다크모드 적용
3. **성능 최적화**: 다크모드 전환 시 애니메이션 추가 검토

---

**작업 완료일**: 2025-02-02  
**커밋**: `feat: 다크모드 개선 및 최적화 완료`

