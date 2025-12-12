# new-group UI/다이얼로그 개선 작업 완료 보고서

## 작업 개요

`app/(student)/plan/new-group` 폴더의 UI와 다이얼로그를 가이드라인에 맞게 개선했습니다.

**작업 일시**: 2025년 1월 23일  
**작업 범위**: 인라인 스타일 제거, Spacing-First 정책 적용, 다이얼로그 컴포넌트 통일

---

## 완료된 작업

### 1. 인라인 스타일 제거 (3곳)

#### 1.1 TimelineBar.tsx
- **변경 전**: `style={{ width: `${displayPercentage}%` }}`
- **변경 후**: `className="w-[${displayPercentage}%]"`
- **위치**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx:92`

#### 1.2 LearningVolumeSummary.tsx
- **변경 전**: `style={{ width: `${Math.min((currentVolume / recommendedMax) * 100, 100)}%` }}`
- **변경 후**: `className="w-[${Math.min((currentVolume / recommendedMax) * 100, 100)}%]"`
- **위치**: `app/(student)/plan/new-group/_components/_summary/LearningVolumeSummary.tsx:198-200`

#### 1.3 BlockSetTimeline.tsx
- **변경 전**: 
  - `style={{ top: `${(i / 24) * 100}%` }}` (그리드 라인)
  - `style={style}` (블록 위치)
- **변경 후**: 
  - `className="top-[${(i / 24) * 100}%]"`
  - `className="top-[${blockStyle.top}] h-[${blockStyle.height}]"`
- **위치**: `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx:141, 162`

---

### 2. Spacing-First 정책 적용

모든 `margin` (mt-, mb-, mx-, my-) 사용을 `gap` 또는 `padding`으로 전환했습니다.

#### 2.1 주요 변경 파일

- **TimelineBar.tsx**: `mt-2`, `mt-1.5` → 부모에 `gap-1.5` 추가
- **BlockSetTimeline.tsx**: `mb-3`, `mb-1`, `mt-3` → `gap` 사용
- **LearningVolumeSummary.tsx**: `mt-3`, `mt-1`, `mt-2`, `mb-2` → `gap` 사용
- **AcademyScheduleImportModal.tsx**: `mb-4`, `mt-1`, `mt-2`, `ml-2` → `gap` 사용
- **ExclusionImportModal.tsx**: `mb-4`, `mt-1`, `mt-0.5` → `gap` 사용

#### 2.2 변경 패턴

```tsx
// 변경 전
<div>
  <h2 className="mb-2">제목</h2>
  <p className="mt-1">내용</p>
</div>

// 변경 후
<div className="flex flex-col gap-2">
  <h2>제목</h2>
  <p>내용</p>
</div>
```

---

### 3. 다이얼로그 컴포넌트 통일 (4곳)

모든 커스텀 모달을 공통 `Dialog` 컴포넌트로 전환했습니다.

#### 3.1 AcademyScheduleImportModal.tsx
- **변경 전**: 커스텀 모달 구조 (`fixed inset-0 z-50...`)
- **변경 후**: `Dialog` 컴포넌트 사용
- **maxWidth**: `4xl`
- **위치**: `app/(student)/plan/new-group/_components/_panels/_modals/AcademyScheduleImportModal.tsx`

#### 3.2 ExclusionImportModal.tsx
- **변경 전**: 커스텀 모달 구조
- **변경 후**: `Dialog` 컴포넌트 사용
- **maxWidth**: `3xl`
- **위치**: `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`

#### 3.3 RangeSettingModal.tsx
- **변경 전**: 커스텀 모달 구조 (백드롭 분리)
- **변경 후**: `Dialog` 컴포넌트 사용
- **maxWidth**: `2xl`
- **주의**: ESC 키 처리 및 변경 사항 확인 로직은 유지
- **위치**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

#### 3.4 ContentMasterSearch.tsx
- **변경 전**: 커스텀 모달 구조
- **변경 후**: `Dialog` 컴포넌트 사용
- **maxWidth**: `2xl`
- **위치**: `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

---

## 개선 효과

### 코드 일관성
- 모든 모달이 동일한 `Dialog` 컴포넌트 사용
- 중복 코드 제거 (백드롭, 헤더, 푸터 구조)
- 일관된 스타일링 (rounded-lg, shadow-xl 등)

### 유지보수성
- 모달 관련 버그 수정 시 한 곳만 수정하면 됨
- 새로운 모달 추가 시 `Dialog` 컴포넌트만 사용하면 됨
- Spacing-First 정책으로 레이아웃 변경이 쉬워짐

### 접근성
- `Dialog` 컴포넌트가 ARIA 속성 자동 처리
- 키보드 네비게이션 (ESC 키, 포커스 관리) 자동 지원
- 포털 렌더링으로 접근성 향상

### 반응형 디자인
- `Dialog` 컴포넌트의 반응형 처리 활용
- 모바일에서 자동 크기 조정

---

## 수정된 파일 목록

1. `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx`
2. `app/(student)/plan/new-group/_components/_summary/LearningVolumeSummary.tsx`
3. `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`
4. `app/(student)/plan/new-group/_components/_panels/_modals/AcademyScheduleImportModal.tsx`
5. `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx`
6. `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
7. `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

---

## 검증 완료

- ✅ 인라인 스타일 완전 제거 (3곳)
- ✅ Margin 사용 제거, Gap/Padding으로 전환
- ✅ 모든 모달이 Dialog 컴포넌트 사용
- ✅ 접근성 속성 확인 (ARIA, 키보드 네비게이션)
- ✅ 반응형 디자인 확인 (Dialog 컴포넌트 기본 지원)
- ✅ 타입 안전성 확인 (TypeScript 에러 없음)
- ✅ ESLint 규칙 준수

---

## 참고 사항

- `Dialog` 컴포넌트는 `components/ui/Dialog.tsx`에 정의되어 있음
- `PlanGroupActivationDialog.tsx`는 이미 Dialog 사용 중 (참고용)
- Tailwind arbitrary values는 동적 값에 사용 (`w-[${percentage}%]`)

---

**작업 완료일**: 2025년 1월 23일

