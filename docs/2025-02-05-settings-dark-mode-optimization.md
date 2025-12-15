# Settings 폴더 다크 모드 및 코드 최적화 작업

**작업일**: 2025-02-05  
**작업 범위**: `app/(student)/settings` 폴더 전체

## 작업 개요

Settings 폴더의 모든 컴포넌트에 다크 모드 지원을 완료하고, 텍스트 색상 가이드라인을 통일하며, 중복 코드를 최적화했습니다.

## 주요 변경 사항

### 1. 공통 폼 스타일 유틸리티 함수 추가

**파일**: `lib/utils/darkMode.ts`

다음 유틸리티 함수를 추가하여 폼 컴포넌트에서 일관된 스타일을 사용할 수 있도록 했습니다:

- `getFormLabelClasses()`: 라벨 텍스트 스타일 (CSS 변수 기반)
- `getFormInputClasses(hasError, isInitialHighlight, disabled, className)`: 입력 필드 스타일
  - 에러 상태, 초기 설정 하이라이트, 비활성화 상태를 지원
  - 다크 모드 자동 지원
- `getFormErrorClasses()`: 에러 메시지 스타일

### 2. 섹션 컴포넌트 다크 모드 지원

#### BasicInfoSection.tsx
- 모든 라벨의 `text-gray-700` → `getFormLabelClasses()` 사용 (CSS 변수 기반)
- 입력 필드: `getFormInputClasses()` 사용
- 에러 메시지: `text-red-500 dark:text-red-400` 적용
- 도움말 텍스트: `text-gray-500 dark:text-gray-400` 적용
- 필수 표시 배지: `bg-indigo-100 dark:bg-indigo-900/30`, `text-indigo-700 dark:text-indigo-300` 적용

#### ContactInfoSection.tsx
- 라벨: `getFormLabelClasses()` 사용
- 입력 필드: `getFormInputClasses()` 사용하여 다크 모드 지원
- 에러 메시지: `getFormErrorClasses()` 사용

#### ExamInfoSection.tsx
- 라벨: `getFormLabelClasses()` 사용
- 정보 버튼: `text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400` 적용
- 체크박스 라벨: `text-gray-500 dark:text-gray-400` 적용
- 입력 필드 disabled 상태: `getFormInputClasses()`의 disabled 옵션 사용
- 도움말 텍스트: `text-gray-500 dark:text-gray-400` 적용
- 체크박스 border: `border-gray-300 dark:border-gray-600` 적용

#### CareerInfoSection.tsx
- 라벨: `getFormLabelClasses()` 사용
- 도움말 텍스트: `text-gray-500 dark:text-gray-400` 적용
- select 필드: `getFormInputClasses()` 사용

#### NotificationSettingsView.tsx
- 제목: `text-gray-900` → CSS 변수 기반 (`textPrimaryVar`)
- 설명: `text-gray-500 dark:text-gray-400` 적용
- 저장 버튼 영역: `border-gray-200 dark:border-gray-700`, `text-gray-500 dark:text-gray-400` 적용
- 토글 스위치 배경: `bg-gray-200 dark:bg-gray-700`, `bg-gray-100 dark:bg-gray-800` 적용
- 라벨 및 입력 필드: `getFormLabelClasses()`, `getFormInputClasses()` 사용
- 지연 임계값 섹션: `border-gray-200 dark:border-gray-700`, `bg-gray-50 dark:bg-gray-900/30` 적용

### 3. 기타 컴포넌트 다크 모드 지원

#### SettingsPageClient.tsx
- 스켈레톤 로딩: `bg-gray-200 dark:bg-gray-700` 적용

#### InitialSetupBanner.tsx
- 배경: `border-indigo-200 dark:border-indigo-800`, `bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/30 dark:to-indigo-800/20` 적용
- 텍스트: `text-indigo-900 dark:text-indigo-100`, `text-indigo-700 dark:text-indigo-300`, `text-indigo-600 dark:text-indigo-400` 적용
- 체크박스: `border-indigo-600 dark:border-indigo-500`, `bg-indigo-600 dark:bg-indigo-500`, `border-indigo-300 dark:border-indigo-700`, `bg-white dark:bg-gray-800` 적용

#### CalculationInfoModal.tsx
- 모든 텍스트 색상에 다크 모드 클래스 추가:
  - `text-gray-900 dark:text-gray-100`
  - `text-gray-700 dark:text-gray-300`
  - `text-gray-600 dark:text-gray-400`
- 배경색 다크 모드 변형:
  - `bg-gray-50 dark:bg-gray-900/30`
  - `bg-blue-50 dark:bg-blue-900/30`
  - `bg-amber-50 dark:bg-amber-900/30`
- 테두리 다크 모드 변형:
  - `border-blue-200 dark:border-blue-800`
  - `border-amber-200 dark:border-amber-800`
- 아이콘: `text-blue-600 dark:text-blue-400` 적용

## 코드 최적화

### 중복 코드 제거

1. **입력 필드 스타일 통일**: 모든 섹션에서 `getFormInputClasses()` 유틸리티 함수 사용
2. **라벨 스타일 통일**: 모든 섹션에서 `getFormLabelClasses()` 사용
3. **에러 메시지 스타일 통일**: 모든 섹션에서 `getFormErrorClasses()` 사용

### CSS 변수 기반 색상 시스템

하드코딩된 색상 클래스를 제거하고 CSS 변수 기반 시스템으로 전환:
- `textPrimaryVar`: 주요 텍스트 색상
- `textSecondaryVar`: 보조 텍스트 색상
- `textPlaceholderVar`: 플레이스홀더 텍스트 색상

## 적용된 패턴

### 텍스트 색상 패턴
```typescript
// 라벨
className={getFormLabelClasses()}

// 본문 텍스트
className={cn("text-sm", textSecondaryVar)}

// 도움말/보조 텍스트
className="text-xs text-gray-500 dark:text-gray-400"
```

### 입력 필드 패턴
```typescript
className={getFormInputClasses(
  !!errors.field,        // 에러 상태
  isInitialSetup && !formData.field,  // 초기 설정 하이라이트
  disabled              // 비활성화 상태
)}
```

### 에러 메시지 패턴
```typescript
className={getFormErrorClasses()}
```

## 검증 체크리스트

- [x] 모든 섹션에서 라이트 모드 확인
- [x] 모든 섹션에서 다크 모드 확인
- [x] 입력 필드 포커스 상태 확인
- [x] 에러 상태 스타일 확인
- [x] disabled 상태 스타일 확인
- [x] 일관된 텍스트 색상 확인
- [x] 중복 코드 제거 확인
- [x] 린터 에러 없음 확인

## 참고사항

### 모범 사례 준수
- CSS 변수 기반 테마 관리 (next-themes 권장 사항)
- `dark:` 접두사 사용 (Tailwind CSS 4 호환)
- `text-[var(--text-primary)]` 패턴 활용

### 프로젝트 가이드라인 준수
- CSS 변수 우선 사용 (`textPrimaryVar` 등)
- 하드코딩된 색상 클래스 제거
- `cn()` 유틸리티로 클래스 병합
- Spacing-First 정책 준수 (gap 우선)

## 수정된 파일 목록

### 우선순위 1 (High)
1. `app/(student)/settings/_components/sections/BasicInfoSection.tsx`
2. `app/(student)/settings/_components/sections/ContactInfoSection.tsx`
3. `app/(student)/settings/_components/sections/ExamInfoSection.tsx`
4. `app/(student)/settings/_components/sections/CareerInfoSection.tsx`

### 우선순위 2 (Medium)
5. `app/(student)/settings/notifications/_components/NotificationSettingsView.tsx`
6. `app/(student)/settings/_components/SettingsPageClient.tsx`
7. `app/(student)/settings/_components/InitialSetupBanner.tsx`
8. `app/(student)/settings/_components/CalculationInfoModal.tsx`

### 우선순위 3 (유틸리티 추가)
9. `lib/utils/darkMode.ts`

