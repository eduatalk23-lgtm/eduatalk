# 캘린더 날짜 타입 뱃지 통일

## 📋 요구사항

1. **제외일(휴가, 기타, 개인사정)도 뱃지로 표시**
2. **모든 날짜 타입 뱃지 스타일 통일**: 학습일/복습일처럼 아이콘 + 텍스트 형태
3. **색상만 타입별로 다르게**: 각 타입의 색상은 유지

## 🔧 수정 내용

### 1. "기타" 제외일 label 설정 (`lib/date/calendarDayTypes.ts`)

**변경 전:**
- "기타" 제외일도 "지정휴일"로 표시

**변경 후:**
- "기타" 제외일은 label을 "기타"로 표시
- 각 제외일 타입별로 올바른 label 설정

```typescript
let exclusionDayType: DayType = "지정휴일";
let exclusionLabel = "지정휴일";

if (exclusion.exclusion_type === "휴가") {
  exclusionDayType = "휴가";
  exclusionLabel = "휴가";
} else if (exclusion.exclusion_type === "개인사정") {
  exclusionDayType = "개인일정";
  exclusionLabel = "개인사정";
} else if (exclusion.exclusion_type === "휴일지정") {
  exclusionDayType = "지정휴일";
  exclusionLabel = "휴일지정";
} else if (exclusion.exclusion_type === "기타") {
  exclusionDayType = "지정휴일";
  exclusionLabel = "기타"; // "기타"로 표시
}

dayTypeMap.set(dateStr, {
  ...dayTypeInfo,
  type: exclusionDayType,
  label: exclusionLabel, // exclusion_type에 따라 label 변경
  exclusion: { ... },
});
```

### 2. MonthView: 모든 타입을 아이콘 + 텍스트로 통일

**변경 전:**
- 제외일은 배지 형태 (`rounded-full`, `border`, `shadow` 등)
- 학습일/복습일은 아이콘 + 텍스트

**변경 후:**
- 모든 타입을 아이콘 + 텍스트 형태로 통일

```typescript
{/* 날짜 타입 배지 - 학습일/복습일과 동일한 구조로 통일 */}
{dayTypeInfo && dayType !== "normal" && (
  <div className="flex items-center gap-0.5 shrink-0">
    {dayTypeInfo.icon && (
      <span className="text-[10px] md:text-xs">{dayTypeInfo.icon}</span>
    )}
    <span className={cn("text-[9px] md:text-[10px] font-medium", textColorClass)}>
      {dayTypeInfo.label}
    </span>
  </div>
)}
```

### 3. WeekView: 제외일도 학습일/복습일처럼 표시

**변경 전:**
- 학습일/복습일: 아이콘 + 텍스트
- 제외일: 배지 형태

**변경 후:**
- 모든 타입을 아이콘 + 텍스트 형태로 통일

```typescript
{/* 날짜 타입 표시 - 모든 타입을 동일한 구조로 통일 */}
{dayTypeInfo && dayTypeInfo.type !== "normal" && (
  <div className="flex items-center gap-1">
    {dayTypeInfo.icon && (
      <span className="text-xs">{dayTypeInfo.icon}</span>
    )}
    <span className={`text-xs font-medium ${textColorClass}`}>
      {dayTypeInfo.label}
    </span>
  </div>
)}
```

### 4. DayView: 모든 타입을 아이콘 + 텍스트로 통일

**변경 전:**
- 모든 타입이 배지 형태 (`rounded-full`, `border-2`, `shadow` 등)

**변경 후:**
- 모든 타입을 아이콘 + 텍스트 형태로 통일

```typescript
{/* 날짜 타입 배지 - 학습일/복습일과 동일한 구조로 통일 */}
{dayTypeInfo && dayType !== "normal" && (
  <div className="flex items-center gap-2 flex-wrap">
    {dayTypeInfo.icon && (
      <span className="text-sm">{dayTypeInfo.icon}</span>
    )}
    <span className={cn("text-sm font-bold", textColorClass)}>
      {dayTypeInfo.label}
    </span>
    {/* 제외일 상세 정보는 유지 */}
    {dayExclusions.length > 0 && dayExclusions[0].exclusion_type && (
      <span className={cn("text-sm font-medium", textTertiary)}>
        ({dayExclusions[0].exclusion_type})
      </span>
    )}
    {dayExclusions.length > 0 && dayExclusions[0].reason && (
      <span className={cn("text-sm font-medium", textTertiary)}>
        - {dayExclusions[0].reason}
      </span>
    )}
  </div>
)}
```

## ✅ 결과

### 날짜 타입별 표시 방식

| 날짜 타입 | 표시 형태 | 아이콘 | 텍스트 | 색상 |
|----------|---------|--------|--------|------|
| **학습일** | 아이콘 + 텍스트 | ✏️ | 학습일 | 파란색 계열 |
| **복습일** | 아이콘 + 텍스트 | 🔄 | 복습일 | 초록색 계열 |
| **지정휴일** | 아이콘 + 텍스트 | 🏖️ | 휴일지정 | 노란색 계열 |
| **휴가** | 아이콘 + 텍스트 | 🏖️ | 휴가 | 회색 계열 |
| **개인사정** | 아이콘 + 텍스트 | 🏖️ | 개인사정 | 보라색 계열 |
| **기타** | 아이콘 + 텍스트 | 🏖️ | 기타 | 빨간색 계열 |

### 주요 변경사항

1. **스타일 통일**
   - 모든 날짜 타입이 아이콘 + 텍스트 형태로 통일됨
   - 배지 형태(`rounded-full`, `border`, `shadow`) 제거

2. **제외일 표시**
   - 휴가, 기타, 개인사정도 뱃지로 표시됨
   - 각 제외일 타입별로 올바른 label 표시

3. **색상 유지**
   - 각 타입별 색상은 기존과 동일하게 유지
   - `textColorClass`를 통해 타입별 색상 적용

## 📝 관련 파일

- `lib/date/calendarDayTypes.ts`: 기타 제외일 label 설정
- `app/(student)/plan/calendar/_components/MonthView.tsx`: 모든 타입을 아이콘 + 텍스트로 통일
- `app/(student)/plan/calendar/_components/WeekView.tsx`: 제외일도 학습일/복습일처럼 표시
- `app/(student)/plan/calendar/_components/DayView.tsx`: 모든 타입을 아이콘 + 텍스트로 통일

## 🔍 테스트 시나리오

1. **학습일/복습일 확인**
   - 아이콘 + 텍스트 형태로 표시되는지 확인
   - 색상이 올바르게 적용되는지 확인

2. **제외일 확인**
   - 휴가, 기타, 개인사정이 아이콘 + 텍스트 형태로 표시되는지 확인
   - 각 제외일 타입별로 올바른 label이 표시되는지 확인
   - 색상이 올바르게 적용되는지 확인

3. **지정휴일 확인**
   - 아이콘 + 텍스트 형태로 표시되는지 확인
   - "휴일지정" label이 표시되는지 확인
   - 색상이 올바르게 적용되는지 확인

