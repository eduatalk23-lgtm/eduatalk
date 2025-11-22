# 프로젝트 최적화 및 리팩토링 작업

## 작업 일시
2025-01-XX

## 작업 개요
프로젝트의 코드 품질 개선 및 가이드라인 준수를 위한 최적화 및 리팩토링 작업을 진행했습니다.

## 주요 변경 사항

### 1. Card 컴포넌트 개선
- **파일**: `components/ui/Card.tsx`
- **변경 내용**:
  - `cn` 유틸리티 함수 사용으로 className 병합 개선
  - CardHeader에서 `mb-4`, `mt-1` 등의 margin을 `gap`으로 변경
  - 조건부 클래스 적용 방식 개선

### 2. Spacing-First 정책 적용
가이드라인에 따라 형제 요소 간 간격은 `gap`, 외곽 여백은 `padding`으로 관리하도록 변경했습니다.

#### 수정된 컴포넌트 목록:
- `app/(student)/today/_components/PlanItem.tsx`
  - `mb-4`, `mb-2`, `mb-1`, `mt-2` 등을 `gap`으로 변경
  - 단일 뷰와 일일 뷰 모두 적용

- `app/(parent)/parent/_components/WeakSubjects.tsx`
  - `mb-4`, `mb-2`를 `gap`으로 변경
  - 중첩된 구조의 spacing 개선

- `app/(student)/today/_components/TodayPlanList.tsx`
  - `mb-6`, `mb-4`, `mb-2`를 `gap`으로 변경
  - 에러 상태 표시 부분도 spacing 개선

- `app/(parent)/parent/dashboard/page.tsx`
  - `mb-6`, `mb-2`를 `gap`으로 변경
  - 섹션 간 간격을 `gap-6`으로 통일

- `app/(student)/plan/group/[id]/_components/PlanGroupProgressCard.tsx`
  - `mt-4`, `mt-3`, `mt-1`을 `gap`으로 변경
  - 상세 정보 그리드의 spacing 개선

- `app/(student)/today/_components/PlanGroupCard.tsx`
  - `mb-4`, `mb-2`를 `gap`으로 변경
  - 단일 뷰와 일일 뷰 모두 적용

## 개선 효과

### 코드 품질
- ✅ 가이드라인 준수율 향상
- ✅ 일관된 spacing 패턴 적용
- ✅ 유지보수성 개선

### 성능
- ✅ 불필요한 margin 계산 제거
- ✅ 더 명확한 레이아웃 구조

## 향후 작업 계획

### 진행 중
- [ ] Spacing-First 정책 적용: margin(mb, mt, mx, my)을 gap/padding으로 변환 (주요 컴포넌트 완료, 전체 적용 진행 중)

### 예정
- [ ] 중복 코드 제거: 유사한 컴포넌트 통합 및 공통 유틸리티 추출
- [ ] 타입 안전성 개선: any 타입 제거 및 명시적 타입 정의
- [ ] 성능 최적화: 불필요한 리렌더링 방지 및 메모이제이션 적용

## 참고 사항
- 진행률 바의 동적 width는 인라인 스타일을 유지 (Tailwind로 대체 불가능)
- 모든 변경사항은 가이드라인을 준수하며 기존 기능에 영향을 주지 않도록 주의

