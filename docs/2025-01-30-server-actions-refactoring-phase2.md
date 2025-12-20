# 서버 액션 리팩토링 Phase 2: 핸들러 유틸리티 고도화 및 핵심 비즈니스 로직 적용

**작업 일시**: 2025-01-30  
**작업 범위**: 서버 액션 핸들러 유틸리티 생성 및 핵심 도메인 액션 리팩토링

---

## 📋 작업 개요

Phase 1에서 인증 및 기본 설정 관련 액션의 구조를 정리한 후, Phase 2에서는 핵심 비즈니스 로직을 담당하는 서버 액션들을 표준화했습니다. 주요 목표는:

1. 표준 액션 핸들러 유틸리티 생성
2. 핵심 도메인 액션 리팩토링 (blocks, blockSets, scores-internal, studentDivisionsActions)
3. 클라이언트 컴포넌트 에러 처리 로직 업데이트

---

## ✅ 완료된 작업

### 1. 표준 액션 핸들러 유틸리티 생성

**파일**: `lib/utils/serverActionHandler.ts`

서버 액션을 `ActionResponse`로 래핑하는 표준 유틸리티를 생성했습니다.

#### 주요 기능

- **`withActionResponse<T, Args>`**: 비동기 함수를 `ActionResponse<T>`로 래핑
- **에러 타입별 처리**:
  - `ZodError`: `fieldErrors`로 변환
  - `AppError`: 상태 코드 및 사용자 메시지 처리
  - 일반 `Error`: `normalizeError`를 통한 정규화
- **Next.js 특수 에러 처리**: `redirect()`, `notFound()` 재throw
- **정보성 메시지 처리**: 상태 코드 200인 경우 성공으로 처리

#### 사용 예시

```typescript
// Before
async function _addBlock(formData: FormData): Promise<void> {
  try {
    // 비즈니스 로직
  } catch (error) {
    throw new AppError(...);
  }
}
export const addBlock = withErrorHandling(_addBlock);

// After
async function _addBlock(formData: FormData): Promise<void> {
  // 비즈니스 로직만 집중 (에러는 throw만 하면 됨)
}
export const addBlock = withActionResponse(_addBlock);
```

### 2. 핵심 도메인 액션 리팩토링

#### `app/actions/blocks.ts`

**변경 사항**:
- `withErrorHandling` → `withActionResponse`로 교체
- Zod 검증 에러를 직접 throw하여 `fieldErrors`로 자동 변환
- 모든 함수가 `ActionResponse` 타입 반환

**리팩토링된 함수들**:
- `addBlock`
- `updateBlock`
- `deleteBlock`
- `duplicateBlock`
- `addBlocksToMultipleDays`

#### `app/actions/blockSets.ts`

**변경 사항**:
- `withErrorHandling` → `withActionResponse`로 교체
- 모든 함수가 `ActionResponse` 타입 반환

**리팩토링된 함수들**:
- `createBlockSet` → `ActionResponse<{ blockSetId: string; name: string }>`
- `updateBlockSet`
- `deleteBlockSet`
- `setActiveBlockSet`
- `duplicateBlockSet`
- `getBlockSets` → `ActionResponse<BlockSet[]>`

#### `app/actions/scores-internal.ts`

**변경 사항**:
- `withErrorHandling` → `withActionResponse`로 교체
- 모든 함수가 `ActionResponse` 타입 반환

**리팩토링된 함수들**:
- `createInternalScore` → `ActionResponse<{ success: boolean; scoreId: string }>`
- `createMockScore` → `ActionResponse<{ success: boolean; scoreId: string }>`
- `updateInternalScore` → `ActionResponse<{ success: boolean }>`
- `updateMockScore` → `ActionResponse<{ success: boolean }>`
- `deleteInternalScore` → `ActionResponse<{ success: boolean }>`
- `deleteMockScore` → `ActionResponse<{ success: boolean }>`
- `deleteScore` → `ActionResponse<{ success: boolean }>`
- `createInternalScoresBatch` → `ActionResponse<{ success: boolean; scores: any[] }>`
- `createMockScoresBatch` → `ActionResponse<{ success: boolean; scores: any[] }>`

#### `app/actions/studentDivisionsActions.ts`

**변경 사항**:
- `withErrorHandling` → `withActionResponse`로 교체
- 모든 함수가 `ActionResponse` 타입 반환

**리팩토링된 함수들**:
- `getStudentDivisionsAction` → `ActionResponse<StudentDivision[]>`
- `getActiveStudentDivisionsAction` → `ActionResponse<StudentDivision[]>`
- `createStudentDivisionAction` → `ActionResponse<StudentDivision>`
- `updateStudentDivisionAction` → `ActionResponse<StudentDivision>`
- `deleteStudentDivisionAction` → `ActionResponse<void>`

### 3. 클라이언트 컴포넌트 에러 처리 로직 업데이트

#### `app/(student)/blocks/_components/BlockForm.tsx`

**변경 사항**:
- `addBlocksToMultipleDays` 응답을 `ActionResponse`로 처리
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용
- 에러 메시지 표시 로직 개선

#### `app/(student)/blocks/[setId]/_components/BlockList.tsx`

**변경 사항**:
- `updateBlock`, `deleteBlock` 응답을 `ActionResponse`로 처리
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용
- try-catch 제거 및 표준 응답 처리

#### `app/(student)/blocks/_components/BlockSetTabs.tsx`

**변경 사항**:
- `setActiveBlockSet`, `deleteBlockSet` 응답을 `ActionResponse`로 처리
- `BlockSetCreateForm`, `BlockSetEditForm`, `BlockSetDuplicateForm` 내부 폼 컴포넌트 업데이트
- 모든 폼이 `ActionResponse` 타입으로 상태 관리

#### `app/(student)/scores/_components/ScoreFormModal.tsx`

**변경 사항**:
- `createInternalScore`, `updateInternalScore` 응답을 `ActionResponse`로 처리
- `fieldErrors` 지원으로 필드별 검증 에러 표시
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용

#### `app/(student)/scores/_components/DeleteScoreButton.tsx`

**변경 사항**:
- `deleteScore` 응답을 `ActionResponse`로 처리
- try-catch 제거 및 표준 응답 처리

---

## 📊 변경 통계

### 수정된 파일
- **서버 액션**: 4개 파일
  - `app/actions/blocks.ts`
  - `app/actions/blockSets.ts`
  - `app/actions/scores-internal.ts`
  - `app/actions/studentDivisionsActions.ts`
- **클라이언트 컴포넌트**: 5개 파일
  - `app/(student)/blocks/_components/BlockForm.tsx`
  - `app/(student)/blocks/[setId]/_components/BlockList.tsx`
  - `app/(student)/blocks/_components/BlockSetTabs.tsx`
  - `app/(student)/scores/_components/ScoreFormModal.tsx`
  - `app/(student)/scores/_components/DeleteScoreButton.tsx`
- **유틸리티**: 1개 파일 (신규)
  - `lib/utils/serverActionHandler.ts`

### 리팩토링된 서버 액션 함수
- **blocks.ts**: 5개 함수
- **blockSets.ts**: 6개 함수
- **scores-internal.ts**: 9개 함수
- **studentDivisionsActions.ts**: 5개 함수
- **총 25개 함수**

---

## 🔍 주요 개선 사항

### 1. 코드 간소화

**Before**:
```typescript
async function _addBlock(formData: FormData): Promise<void> {
  try {
    // 비즈니스 로직
    if (error) {
      throw new AppError(...);
    }
  } catch (error) {
    throw new AppError(...);
  }
}
export const addBlock = withErrorHandling(_addBlock);
```

**After**:
```typescript
async function _addBlock(formData: FormData): Promise<void> {
  // 비즈니스 로직에만 집중
  // 에러는 throw만 하면 withActionResponse가 처리
}
export const addBlock = withActionResponse(_addBlock);
```

### 2. 일관된 에러 처리

- 모든 서버 액션이 동일한 `ActionResponse` 타입 반환
- Zod 검증 에러가 자동으로 `fieldErrors`로 변환
- 클라이언트에서 타입 안전한 에러 처리

### 3. 타입 안전성 향상

- `isSuccessResponse`, `isErrorResponse` 타입 가드 활용
- TypeScript가 응답 타입을 정확히 추론
- 컴파일 타임에 에러 처리 누락 방지

### 4. 개발자 경험 개선

- 비즈니스 로직에만 집중 가능
- 에러 처리는 유틸리티가 자동으로 처리
- 일관된 패턴으로 코드 이해도 향상

---

## 🎯 핵심 개선 포인트

### 1. Zod 검증 에러 자동 변환

```typescript
// Before: 수동으로 첫 번째 에러만 추출
const validation = validateFormData(formData, blockSchema);
if (!validation.success) {
  const firstError = validation.errors.issues[0];
  throw new AppError(firstError?.message, ...);
}

// After: Zod 에러를 직접 throw하면 fieldErrors로 자동 변환
const validation = validateFormData(formData, blockSchema);
if (!validation.success) {
  throw validation.errors; // withActionResponse가 fieldErrors로 변환
}
```

### 2. 정보성 메시지 처리

```typescript
// 부분 성공 시 정보성 메시지 (상태 코드 200)
throw new AppError(
  `INFO: ${successDays}요일에 블록이 추가되었습니다. ${skippedDays}요일은 겹치는 시간대가 있어 스킵되었습니다.`,
  ErrorCode.BUSINESS_LOGIC_ERROR,
  200,
  true
);

// withActionResponse가 자동으로 성공 응답으로 변환
// { success: true, message: "..." }
```

### 3. 클라이언트 에러 처리 개선

**Before**:
```typescript
try {
  await addBlock(formData);
  // 성공 처리
} catch (err) {
  alert(err.message);
}
```

**After**:
```typescript
const result = await addBlock(formData);
if (isSuccessResponse(result)) {
  // 성공 처리
} else if (isErrorResponse(result)) {
  // fieldErrors 지원
  if (result.fieldErrors) {
    // 필드별 에러 표시
  }
  alert(result.error);
}
```

---

## ⚠️ 주의사항

### 1. 기존 `withErrorHandling`과의 차이

- **`withErrorHandling`**: 에러를 throw하여 Next.js가 처리
- **`withActionResponse`**: 에러를 `ActionResponse`로 변환하여 반환

두 유틸리티는 서로 다른 용도로 사용됩니다:
- `withErrorHandling`: redirect가 필요한 경우, 에러를 throw해야 하는 경우
- `withActionResponse`: 표준 응답 패턴이 필요한 경우

### 2. Next.js 특수 에러 처리

`redirect()`와 `notFound()`는 Next.js의 특수 에러이므로 `withActionResponse`에서 재throw하여 Next.js가 처리하도록 합니다.

### 3. 비즈니스 로직 보존

- 모든 비즈니스 로직은 변경하지 않았습니다
- 에러 처리 방식만 표준화했습니다
- 기존 동작은 그대로 유지됩니다

---

## 🧪 테스트 권장 사항

다음 시나리오에 대한 테스트를 권장합니다:

1. **시간 블록 관리**
   - 블록 추가/수정/삭제
   - 겹침 검증 에러
   - Zod 검증 에러 (fieldErrors 확인)

2. **블록 세트 관리**
   - 세트 생성/수정/삭제
   - 활성 세트 전환
   - 세트 복제
   - 최대 개수 제한 검증

3. **성적 관리**
   - 내신 성적 입력/수정/삭제
   - 모의고사 성적 입력/수정/삭제
   - 일괄 입력
   - 필드별 검증 에러

4. **학생 구분 관리** (관리자)
   - 구분 항목 조회/생성/수정/삭제
   - 권한 검증

---

## 📝 다음 단계 (Phase 3 예정)

1. 나머지 서버 액션들의 표준 응답 패턴 적용
2. 에러 핸들링 유틸리티 개선 (인증 체크, 권한 체크 주입)
3. 클라이언트 컴포넌트의 에러 처리 패턴 통일
4. 문서화 및 가이드라인 작성

---

## 🔗 관련 파일

- `lib/utils/serverActionHandler.ts` - 표준 액션 핸들러 유틸리티
- `lib/types/actionResponse.ts` - 표준 응답 타입 정의
- `app/actions/blocks.ts` - 시간 블록 관리 액션
- `app/actions/blockSets.ts` - 블록 세트 관리 액션
- `app/actions/scores-internal.ts` - 성적 관리 액션
- `app/actions/studentDivisionsActions.ts` - 학생 구분 관리 액션

