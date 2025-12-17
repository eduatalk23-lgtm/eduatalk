# DayTimelineModal dayType 에러 수정

## 날짜
2025-12-17

## 문제
`DayTimelineModal` 컴포넌트에서 `dayType is not defined` 런타임 에러 발생

### 에러 위치
- 파일: `app/(student)/plan/calendar/_components/DayTimelineModal.tsx`
- 라인: 74번째 줄

### 에러 내용
```typescript
const description = dayTypeInfo && dayType !== "normal" ? (
  // dayType 변수가 정의되지 않음
```

## 원인
74번째 줄에서 `dayType` 변수를 사용했지만, 해당 변수가 정의되지 않았습니다. `dayTypeInfo` prop에는 `type` 속성이 있지만, 이를 직접 참조하지 않고 존재하지 않는 `dayType` 변수를 참조했습니다.

## 해결 방법
`dayType` 대신 `dayTypeInfo?.type`을 사용하도록 수정했습니다.

### 수정 전
```typescript
const description = dayTypeInfo && dayType !== "normal" ? (
```

### 수정 후
```typescript
const description = dayTypeInfo && dayTypeInfo.type !== "normal" ? (
```

## 관련 파일
- `app/(student)/plan/calendar/_components/DayTimelineModal.tsx`

## 검증
- 린터 에러 없음 확인
- 타입 안전성 확보 (`dayTypeInfo?.type` 사용)

