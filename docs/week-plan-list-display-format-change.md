# 주별 플랜 목록 표시 형식 변경

## 작업 일자
2025-01-23

## 작업 내용
주별 플랜 목록의 표시 형식을 변경하고 스크롤을 제거했습니다. 플랜 정보를 3행 구조로 명확하게 표시하도록 개선했습니다.

## 변경 사항

### 파일
- `app/(student)/plan/calendar/_components/WeekView.tsx`

### 주요 변경 내용

1. **플랜 목록 표시 형식 변경**: 3행 구조로 변경
   - 1행: 플랜 시작시간 (예: 10:00)
   - 2행: 아이콘 + 교과 + 회차 (예: 📚 국어 1강)
   - 3행: 과목 (예: 문학)

2. **스크롤 제거**: 플랜 목록 영역에서 스크롤을 제거
   - 기존: `max-h-[300px] overflow-y-auto` 사용
   - 변경: 스크롤 없이 모든 플랜 표시

3. **PlanCard 컴포넌트 제거**: 주별 플랜 목록에서 PlanCard 대신 직접 간단한 카드로 렌더링
   - 기존: PlanCard 컴포넌트 사용
   - 변경: WeekView 내에서 직접 간단한 플랜 카드 렌더링

### 변경 코드

```tsx
// 변경 전
<div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
  {/* ... */}
  items.push(
    <PlanCard
      key={`${dateStr}-plan-${plan.id}`}
      plan={plan}
      compact={false}
      showTime={true}
      showProgress={true}
    />
  );
  {/* ... */}
</div>

// 변경 후
<div className="flex flex-col gap-1.5">
  {/* ... */}
  items.push(
    <div
      key={`${dateStr}-plan-${plan.id}`}
      className={`rounded border p-2 text-xs ${cardBorderClass}`}
    >
      {/* 1행: 플랜 시작시간 */}
      {plan.start_time && (
        <div className="mb-1 font-semibold text-gray-900">
          {plan.start_time}
        </div>
      )}
      {/* 2행: 아이콘 + 교과 + 회차 */}
      <div className="mb-1 flex items-center gap-1">
        <span className="text-sm">{contentTypeIcon}</span>
        {plan.contentSubjectCategory && (
          <span className="font-medium text-gray-700">
            {plan.contentSubjectCategory}
          </span>
        )}
        {plan.contentEpisode && (
          <span className="text-gray-600">
            {plan.contentEpisode}
          </span>
        )}
      </div>
      {/* 3행: 과목 */}
      {plan.contentSubject && (
        <div className="text-gray-600">
          {plan.contentSubject}
        </div>
      )}
    </div>
  );
  {/* ... */}
</div>
```

### 플랜 카드 표시 구조

```
┌─────────────────────┐
│ 10:00               │  ← 1행: 시작시간
│ 📚 국어 1강          │  ← 2행: 아이콘 + 교과 + 회차
│ 문학                │  ← 3행: 과목
└─────────────────────┘
```

### 플랜 상태별 스타일

- **완료된 플랜**: `border-green-300 bg-green-50`
- **학습 중 플랜**: `border-blue-300 bg-blue-50`
- **대기 중 플랜**: `border-gray-200 bg-white`

### 불필요한 Import 제거

- `PlanCard` import 제거
- `StatCard` import 제거

## UI 개선 효과

- **명확한 정보 표시**: 3행 구조로 플랜 정보를 명확하게 구분
- **스크롤 제거**: 모든 플랜을 한 눈에 볼 수 있도록 스크롤 제거
- **공간 효율성**: 간단한 카드 구조로 공간 효율적 사용
- **가독성 향상**: 시간, 교과, 과목이 명확하게 구분되어 가독성 향상

## 커밋 정보
- 커밋 해시: `284b6ff`
- 커밋 메시지: "주별 플랜 목록 표시 형식 변경 및 스크롤 제거: 1행 시간, 2행 아이콘+교과+회차, 3행 과목"

