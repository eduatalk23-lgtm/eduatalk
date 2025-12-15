# TypeScript 타입 에러 수정 (2025-02-05)

## 작업 개요

플랜 그룹 위저드 컴포넌트들에서 발생한 TypeScript 타입 에러를 수정했습니다.

## 발생한 문제

### 1. `data`가 `undefined`일 수 있는 문제
- `Step1BasicInfo.tsx`, `Step2TimeSettings.tsx`, `Step6Simplified.tsx`에서 `data`가 optional prop이거나 context에서 가져올 때 `undefined`가 될 수 있음
- 하지만 하위 컴포넌트들은 `data`를 필수 prop으로 요구하여 타입 에러 발생

### 2. `periodStart`, `periodEnd`가 `undefined`일 수 있는 문제
- `Step2TimeSettings.tsx`에서 이 값들이 `undefined`일 수 있는데, `TimeSettingsPanel`은 string 타입을 요구

### 3. `onEditStep`이 `undefined`일 수 있는 문제
- `Step6Simplified.tsx`에서 `onEditStep`이 `undefined`일 수 있는데 함수 호출 시 에러 발생

## 수정 내용

### Step1BasicInfo.tsx
```typescript
// data가 없으면 early return 추가
if (!data) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
    </div>
  );
}

// toggleFieldControl에서도 data 체크 추가
const toggleFieldControl = (fieldName: keyof NonNullable<TemplateLockedFields["step1"]>) => {
  if (!isTemplateMode || !data) return;
  // ...
};
```

### Step2TimeSettings.tsx
```typescript
// periodStart, periodEnd에 기본값 제공
const periodStart = periodStartProp ?? contextData?.period_start ?? "";
const periodEnd = periodEndProp ?? contextData?.period_end ?? "";

// data가 없으면 early return
if (!data) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
    </div>
  );
}
```

### Step6Simplified.tsx
```typescript
// data가 없으면 early return
if (!data) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
    </div>
  );
}

// onEditStep이 있을 때만 호출
onEdit={onEditStep ? () => onEditStep(1) : undefined}
```

## 결과

- 모든 TypeScript 타입 에러 해결 (54개 → 0개)
- TypeScript strict mode 준수
- 런타임 안전성 향상 (undefined 접근 방지)

## 관련 파일

- `app/(student)/plan/new-group/_components/_features/basic-info/Step1BasicInfo.tsx`
- `app/(student)/plan/new-group/_components/_features/scheduling/Step2TimeSettings.tsx`
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

