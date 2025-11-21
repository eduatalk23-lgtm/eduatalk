# 플랜 캘린더 UI 개선

## 작업 개요

플랜 캘린더의 UI를 개선하여 더 많은 플랜을 표시하고, 크기를 최적화하여 공간 효율성을 높였습니다.

## 개선 내용

### 1. 플랜 목록 표시 개수 증가

**변경 전**: 최대 3개까지만 표시
**변경 후**: 최대 6개까지 표시

```typescript
// 변경 전
const maxDisplay = 3;

// 변경 후
const maxDisplay = 6;
```

**효과**: 한 날짜에 여러 플랜이 있어도 더 많은 정보를 한눈에 볼 수 있습니다.

### 2. "+n개 더" 버튼을 아이콘 형식으로 변경

**변경 전**: 텍스트 버튼 (`+{n}개 더`)
**변경 후**: 아이콘 표시 (`⋯`)

```typescript
// 변경 전
<button className="mt-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200">
  +{totalItems - maxDisplay}개 더
</button>

// 변경 후
<div 
  className="mt-1 flex items-center justify-center rounded-md bg-gray-100 px-1.5 py-1 text-gray-600"
  title={`${totalItems - maxDisplay}개 더 있음`}
>
  <span className="text-xs">⋯</span>
</div>
```

**효과**: 
- 공간 절약
- 항목이 더 있다는 것만 간단히 표시
- 호버 시 툴팁으로 정확한 개수 확인 가능

### 3. PlanCard compact 모드 크기 최적화

**변경 사항**:
- 패딩: `p-1.5` → `p-1 py-0.5`
- 아이콘 크기: `text-sm` → `text-xs`
- 텍스트 크기: `text-xs` → `text-[10px]`
- 상태 배지 크기: `px-1.5 py-0.5 text-xs` → `px-1 py-0.5 text-[10px]`
- 간격: `gap-1` → `gap-0.5`

**효과**: 점심시간 표시와 비슷한 크기로 통일되어 일관된 UI를 제공합니다.

### 4. 날짜 및 아이콘 크기 축소

**날짜 헤더**:
- 날짜 텍스트: `text-xl` → `text-lg`
- 마진: `mb-2` → `mb-1.5`

**날짜 타입 배지**:
- 패딩: `p-1.5` → `p-1`
- 텍스트 크기: `text-base` → `text-sm`

**날짜 셀**:
- 최소 높이: `min-h-[140px]` → `min-h-[120px]`
- 패딩: `p-3` → `p-2`

**효과**: 
- 더 컴팩트한 레이아웃
- 더 많은 정보를 표시할 수 있는 공간 확보
- 전체적인 시각적 밀도 향상

## 변경 전후 비교

### 표시 개수
- **변경 전**: 최대 3개 플랜 표시
- **변경 후**: 최대 6개 플랜 표시

### 크기 비교
- **PlanCard**: 약 30% 크기 감소
- **날짜 헤더**: 약 20% 크기 감소
- **날짜 셀**: 약 15% 크기 감소

### 공간 효율성
- 더 많은 플랜을 표시하면서도 전체 레이아웃이 더 컴팩트해짐
- 불필요한 여백 제거로 정보 밀도 향상

## 관련 파일

- `app/(student)/plan/calendar/_components/MonthView.tsx`: 월별 뷰 컴포넌트
- `app/(student)/plan/calendar/_components/PlanCard.tsx`: 플랜 카드 컴포넌트

## 사용자 경험 개선

1. **더 많은 정보 표시**: 한 날짜에 여러 플랜이 있어도 더 많이 볼 수 있음
2. **일관된 크기**: 모든 항목이 비슷한 크기로 통일되어 시각적으로 깔끔함
3. **공간 효율성**: 컴팩트한 디자인으로 더 많은 정보를 한 화면에 표시
4. **직관적인 표시**: 아이콘으로 항목이 더 있다는 것을 간단히 표시

## 커밋 정보

- 커밋 해시: (최신 커밋)
- 커밋 메시지: "feat: 플랜 캘린더 UI 개선 - 목록 표시 개수 증가 및 크기 최적화"

