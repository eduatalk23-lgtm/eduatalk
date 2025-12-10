# Zod 및 Recharts 빌드 에러 해결

**작업 일자**: 2025-01-27  
**작업자**: AI Assistant

## 문제 상황

### 1. Zod 에러
- **에러 메시지**: `Export slugify doesn't exist in target module`
- **원인**: zod v4.1.13의 내부 모듈 구조와 Next.js 16.0.7의 Turbopack 간 호환성 문제
- **영향**: 빌드 실패

### 2. Recharts 에러
- **에러 메시지**: `Export selectReverseStackOrder doesn't exist in target module`
- **원인**: recharts 3.5.0의 내부 모듈 구조와 Next.js 16.0.7의 Turbopack 간 호환성 문제
- **영향**: 19개의 차트 컴포넌트에서 빌드 실패

## 해결 방법

### 1. Zod 버전 다운그레이드

**변경 사항**:
- `package.json`에서 zod 버전을 `^4.1.12`에서 `^3.23.8`로 변경
- 실제 설치된 버전: `3.25.76`

**파일 수정**:
- `package.json`

### 2. Zod v3 호환성 문제 해결

zod v3로 다운그레이드하면서 발생한 타입 에러를 수정:

#### 2.1. `lib/domains/school/validation.ts`
- **문제**: `ZodEffects`에는 `extend()` 메서드가 없음
- **해결**: base schema를 분리하여 `extend()` 적용 후 `refine()` 적용

```typescript
// 변경 전
export const createSchoolSchema = z.object({...}).refine(...).refine(...);
export const updateSchoolSchema = createSchoolSchema.extend({ id: ... });

// 변경 후
const schoolBaseSchema = z.object({...});
export const createSchoolSchema = schoolBaseSchema.refine(...).refine(...);
export const updateSchoolSchema = schoolBaseSchema.extend({ id: ... }).refine(...).refine(...);
```

#### 2.2. `lib/domains/score/validation.ts`
- **문제**: `ZodEffects`에는 `partial()` 메서드가 없음
- **해결**: base schema를 분리하여 `partial()` 적용

```typescript
// 변경 전
export const createMockScoreSchema = z.object({...}).refine(...);
export const updateMockScoreSchema = createMockScoreSchema.partial();

// 변경 후
const mockScoreBaseSchema = z.object({...});
export const createMockScoreSchema = mockScoreBaseSchema.refine(...);
export const updateMockScoreSchema = mockScoreBaseSchema.partial();
```

### 3. Recharts 버전 업데이트

**변경 사항**:
- `package.json`에서 recharts 버전을 `^3.4.1`에서 `^3.5.1`로 업데이트
- 최신 버전에서 Turbopack 호환성 문제가 해결됨

**파일 수정**:
- `package.json`

## 수정된 파일 목록

1. `package.json` - zod 및 recharts 버전 업데이트
2. `lib/domains/school/validation.ts` - zod v3 호환성 수정
3. `lib/domains/score/validation.ts` - zod v3 호환성 수정

## 검증 결과

- ✅ `npm run build` 성공
- ✅ 모든 타입 에러 해결
- ✅ 빌드 시간: 약 5.6초 (컴파일) + 212.5ms (정적 페이지 생성)

## 참고 사항

### Zod v3 vs v4 차이점
- `ZodEffects` 타입에는 `extend()`, `partial()` 메서드가 없음
- `refine()`을 적용한 스키마에서 `extend()` 또는 `partial()`을 사용하려면 base schema를 먼저 분리해야 함

### Recharts 최신 버전
- recharts 3.5.1에서 Turbopack 호환성 문제가 해결됨
- 모든 차트 컴포넌트는 이미 `"use client"`로 선언되어 있어 추가 수정 불필요

## 향후 개선 사항

- zod v4가 안정화되면 다시 업그레이드 검토 가능
- recharts는 최신 버전 유지 권장

