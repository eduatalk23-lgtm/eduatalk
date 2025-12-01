# 스케줄 미리보기 학습일/복습일 개별 카드 구현

**작업 날짜**: 2025-12-01  
**작업 범위**: 스케줄 미리보기 UI 개선 - 카드 분리

## 작업 개요

학습일과 복습일을 별도의 카드로 분리하여 각각의 정보를 명확하게 표시하고, 5개 카드를 한 줄에 배치하여 가독성을 향상시켰습니다.

## 변경 사항

### SchedulePreviewPanel.tsx - 요약 통계 카드 분리

**파일**: `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

#### 1. 아이콘 import 추가 (4줄)

**변경 전**:
```typescript
import { Calendar, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
```

**변경 후**:
```typescript
import { Calendar, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, XCircle, BookOpen, RotateCcw } from "lucide-react";
```

- `BookOpen`: 학습일 카드 아이콘
- `RotateCcw`: 복습일 카드 아이콘 (복습 개념 시각화)

#### 2. Grid 레이아웃 변경 (287줄)

**변경 전**:
```typescript
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
```

**변경 후**:
```typescript
<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
```

- 모바일: 2열 그리드 유지
- 데스크톱: 4열 → 5열로 변경 (5개 카드 한 줄 배치)

#### 3. 학습일 카드 분리 (312-321줄)

**변경 전** (통합 카드):
```typescript
<div className="rounded-lg border border-gray-200 bg-white p-4">
  <div className="flex items-center gap-2">
    <Calendar className="h-5 w-5 text-green-400" />
    <span className="text-xs font-medium text-gray-500">학습일 + 복습일</span>
  </div>
  <p className="mt-2 text-2xl font-bold text-gray-900">
    {result.summary.total_study_days}일
    {result.summary.total_review_days > 0 && (
      <> + {result.summary.total_review_days}일(복습)</>
    )}
  </p>
  <p className="text-xs text-gray-500">일</p>
</div>
```

**변경 후** (학습일 카드):
```typescript
<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
  <div className="flex items-center gap-2">
    <BookOpen className="h-5 w-5 text-blue-500" />
    <span className="text-xs font-medium text-blue-700">학습일</span>
  </div>
  <p className="mt-2 text-2xl font-bold text-blue-900">
    {result.summary.total_study_days}
  </p>
  <p className="text-xs text-blue-600">일</p>
</div>
```

**디자인 특징**:
- 배경색: 파란색 계열 (`bg-blue-50`)
- 테두리: `border-blue-200`
- 텍스트 색상: `text-blue-700` (라벨), `text-blue-900` (숫자), `text-blue-600` (단위)
- 아이콘: `BookOpen` (책 펼치기 - 학습 의미)

#### 4. 복습일 카드 추가 (323-332줄)

**신규 추가**:
```typescript
<div className="rounded-lg border border-green-200 bg-green-50 p-4">
  <div className="flex items-center gap-2">
    <RotateCcw className="h-5 w-5 text-green-500" />
    <span className="text-xs font-medium text-green-700">복습일</span>
  </div>
  <p className="mt-2 text-2xl font-bold text-green-900">
    {result.summary.total_review_days}
  </p>
  <p className="text-xs text-green-600">일</p>
</div>
```

**디자인 특징**:
- 배경색: 초록색 계열 (`bg-green-50`)
- 테두리: `border-green-200`
- 텍스트 색상: `text-green-700` (라벨), `text-green-900` (숫자), `text-green-600` (단위)
- 아이콘: `RotateCcw` (반시계 방향 회전 - 복습/반복 의미)

## 최종 카드 구성

### 5개 카드 순서
1. **총 기간** - 회색 (기존 유지)
2. **제외일** - 빨강색 (기존 유지)
3. **학습일** - 파란색 (신규 분리)
4. **복습일** - 초록색 (신규 분리)
5. **총 학습 시간** - 회색 (기존 유지)

### 색상 시스템

| 카드 | 배경색 | 테두리 | 아이콘 | 라벨 | 숫자 | 단위 |
|------|--------|--------|--------|------|------|------|
| 총 기간 | `bg-white` | `border-gray-200` | `text-gray-400` | `text-gray-500` | `text-gray-900` | `text-gray-500` |
| 제외일 | `bg-white` | `border-gray-200` | `text-red-400` | `text-gray-500` | `text-gray-900` | `text-gray-500` |
| 학습일 | `bg-blue-50` | `border-blue-200` | `text-blue-500` | `text-blue-700` | `text-blue-900` | `text-blue-600` |
| 복습일 | `bg-green-50` | `border-green-200` | `text-green-500` | `text-green-700` | `text-green-900` | `text-green-600` |
| 총 학습 시간 | `bg-white` | `border-gray-200` | `text-blue-400` | `text-gray-500` | `text-gray-900` | `text-gray-500` |

## 반응형 동작

### 모바일 (< md 브레이크포인트)
- `grid-cols-2`: 2열 그리드
- 카드 배치:
  ```
  [총 기간]  [제외일]
  [학습일]  [복습일]
  [총 학습 시간]  (빈 공간)
  ```

### 데스크톱 (≥ md 브레이크포인트)
- `md:grid-cols-5`: 5열 그리드
- 카드 배치:
  ```
  [총 기간]  [제외일]  [학습일]  [복습일]  [총 학습 시간]
  ```

## 기술적 고려사항

### 1. 아이콘 선택 근거
- **BookOpen** (학습일): 책을 펼치는 행위는 새로운 지식을 습득하는 학습을 의미
- **RotateCcw** (복습일): 반시계 방향 회전은 복습/반복 학습을 직관적으로 표현

### 2. 색상 선택 근거
- **파란색 (학습일)**: 집중력, 학습, 지식을 상징하는 색상
- **초록색 (복습일)**: 성장, 반복, 정착을 상징하는 색상
- 기존 디자인 시스템과 일관성 유지

### 3. 복습일 0일 처리
- 복습일이 0일인 경우에도 카드는 표시됨
- "0일"로 명시적으로 표시하여 정보의 일관성 유지
- 조건부 렌더링으로 카드를 숨기지 않음 (레이아웃 안정성)

## 테스트 시나리오

### ✅ 테스트 완료
1. **데스크톱 레이아웃**
   - 5개 카드가 한 줄에 정렬되는지 확인 ✓
   - 각 카드의 너비가 균등한지 확인 ✓

2. **모바일 레이아웃**
   - 2열 그리드로 올바르게 배치되는지 확인 ✓
   - 마지막 카드가 홀수로 남아도 레이아웃이 깨지지 않는지 확인 ✓

3. **색상 및 아이콘**
   - 학습일 카드: 파란색 배경 + BookOpen 아이콘 ✓
   - 복습일 카드: 초록색 배경 + RotateCcw 아이콘 ✓

4. **복습일 0일 케이스**
   - 복습일이 0일인 경우에도 카드가 표시되는지 확인 ✓
   - "0일"로 명시적으로 표시되는지 확인 ✓

5. **가독성**
   - 이전 통합 형식보다 정보가 더 명확하게 구분되는지 확인 ✓
   - 각 카드의 목적이 한눈에 파악되는지 확인 ✓

## 영향 범위

### 수정된 파일
- `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx` (4줄, 287-344줄)

### 영향받는 기능
- 학습 계획 그룹 생성 마법사의 스케줄 미리보기 패널

### 영향받지 않는 기능
- 주차별 스케줄 테이블 (이전 작업에서 이미 개선됨)
- 기타 스케줄 관련 컴포넌트

## 이전 작업과의 연계

### 이전 작업 (2025-12-01)
- 주차별 스케줄 테이블에서 학습일/복습일을 통합 형식으로 표시
- "학습일 25일 + 복습일 3일" 형식

### 이번 작업 (2025-12-01)
- 스케줄 미리보기 요약 통계에서 학습일/복습일을 개별 카드로 분리
- 각 카드에 고유한 색상과 아이콘 적용

### 일관성
- 주차별 테이블: 공간 절약을 위해 통합 표시 유지
- 요약 통계: 가독성을 위해 개별 카드로 분리
- 각 컨텍스트에 적합한 UI 패턴 적용

## 향후 개선 가능 사항

1. 카드 호버 효과 추가 (상세 정보 툴팁)
2. 복습일 비율 표시 (예: "복습일 3일 (10%)")
3. 학습일/복습일 비율에 따른 색상 강도 조정
4. 애니메이션 효과 추가 (카드 로딩 시)
5. 다크모드 지원 시 색상 팔레트 조정

