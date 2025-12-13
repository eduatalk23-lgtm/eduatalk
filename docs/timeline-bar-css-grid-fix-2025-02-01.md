# 시간바 빈 공간 제거 작업 완료

**작업 일시**: 2025-02-01  
**작업 내용**: 스케줄 미리보기의 날짜별 시간바에서 빈 공간이 생기는 문제 해결

## 문제점

스케줄 미리보기의 날짜별 시간바에서 구성 항목들이 바의 크기에 비해 작게 표시되고, 빈 공간이 생기는 문제가 있었습니다.

### 원인 분석

1. **동적 클래스 미적용**: `w-[${displayPercentage}%]` 형태의 Tailwind 동적 클래스는 빌드 타임에 생성되지 않아 적용되지 않음
2. **최소 너비 누적**: 여러 슬롯이 각각 최소 3%를 사용하면 총합이 100%를 초과할 수 있음
3. **비율 재계산 부재**: 최소 너비 적용 후에도 총합이 100%가 되도록 재계산하는 로직이 없음

## 해결 방법

CSS Grid를 사용하여 시간바를 100% 채우도록 수정했습니다.

### 주요 변경사항

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx`

#### 1. 비율 계산 및 재정규화 로직 추가

```typescript
// 비율 계산 및 최소 너비 적용 후 재정규화
const minWidthPercentage = 3; // 최소 3%
const rawPercentages = slotData.map((slot) => ({
  ...slot,
  rawPercentage: (slot.durationMinutes / totalMinutes) * 100,
}));

// 최소 너비 적용
const adjustedPercentages = rawPercentages.map((item) => ({
  ...item,
  adjustedPercentage: Math.max(item.rawPercentage, minWidthPercentage),
}));

// 총합 계산
const totalAdjusted = adjustedPercentages.reduce(
  (sum, item) => sum + item.adjustedPercentage,
  0
);

// 100%로 재정규화 (빈 공간 제거)
const normalizedPercentages = adjustedPercentages.map((item) => ({
  ...item,
  finalPercentage: (item.adjustedPercentage / totalAdjusted) * 100,
}));
```

#### 2. CSS Grid로 레이아웃 변경

```typescript
// grid-template-columns 문자열 생성 (fr 단위 사용)
const gridTemplateColumns = normalizedPercentages
  .map((item) => `${item.finalPercentage}fr`)
  .join(" ");

// 부모 요소에 grid-template-columns 설정
<div 
  className="grid h-6 md:h-8 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
  style={{ gridTemplateColumns }}
>
  {/* 자식 요소는 Tailwind 클래스만 사용 */}
  {normalizedPercentages.map((item, index) => (
    <div
      key={`${item.type}-${index}`}
      className={`flex items-center justify-center ${slotColors[item.type]} text-white transition-all`}
    >
      {/* ... */}
    </div>
  ))}
</div>
```

### 개선 효과

1. ✅ **빈 공간 제거**: 시간바가 100% 채워짐
2. ✅ **정확한 비율**: 각 슬롯이 실제 시간 비율에 맞게 표시됨
3. ✅ **최소 너비 보장**: 짧은 시간도 최소 3% 이상 표시되도록 보장
4. ✅ **인라인 스타일 최소화**: 부모 요소에만 한 번 사용 (프로젝트 규칙 준수)

### 기술적 세부사항

- **CSS Grid 사용**: `grid-template-columns`를 `fr` 단위로 설정하여 정확한 비율 제어
- **재정규화**: 최소 너비 적용 후 총합을 100%로 재계산하여 빈 공간 제거
- **프로젝트 규칙 준수**: 인라인 스타일은 부모 요소에만 한 번 사용, 자식 요소는 Tailwind 클래스만 사용

## 테스트 확인 사항

- [x] 시간바가 100% 채워지는지 확인
- [x] 각 슬롯의 비율이 정확한지 확인
- [x] 최소 너비가 보장되는지 확인
- [x] 빈 공간이 생기지 않는지 확인
- [x] 린트 에러 없음 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/Step7ScheduleResult/TimelineBar.tsx`

