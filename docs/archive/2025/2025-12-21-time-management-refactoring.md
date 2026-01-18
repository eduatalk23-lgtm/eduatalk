# 시간 관리(Time Management) 컴포넌트 리팩토링

**작업 일자**: 2025-12-21  
**작업 범위**: 시간 블록 관리 컴포넌트 타입 안정성 강화 및 코드 품질 개선

---

## 📋 작업 개요

시간 관리 관련 컴포넌트들의 타입 안정성을 강화하고, 시간 계산 로직을 분리하여 가독성과 유지보수성을 개선했습니다.

### 주요 개선 사항

1. **타입 정의 강화**: `any` 타입 제거 및 엄격한 TypeScript 타입 정의
2. **Zod 스키마 검증**: 폼 데이터 유효성 검사 강화
3. **시간 계산 로직 분리**: 순수 함수로 추출하여 테스트 용이성 향상
4. **접근성 개선**: ARIA 속성 추가 및 키보드 네비게이션 지원

---

## 📁 생성/수정된 파일

### 새로 생성된 파일

1. **`lib/types/time-management.ts`**
   - `Block`, `BlockSet`, `BlockStats` 등 시간 관리 관련 타입 정의
   - `DayOfWeek`, `TimeString` 등 유틸리티 타입 정의

2. **`lib/validation/timeSchema.ts`**
   - Zod 스키마 정의 (`blockSchema`, `blockSetSchema`, `blockFormSchema`)
   - 시간 유효성 검사 헬퍼 함수 (`isStartTimeBeforeEndTime`)

3. **`lib/utils/timeUtils.ts`**
   - 시간 계산 유틸리티 함수 (`calculateBlockStats`, `calculateTotalTime` 등)
   - 요일별 분포 계산 함수
   - 블록 유효성 검사 함수

### 수정된 파일

1. **`app/(admin)/admin/time-management/[templateId]/_components/TemplateBlocksViewer.tsx`**
   - 타입 정의를 새로 만든 타입으로 교체
   - 시간 계산 로직을 유틸리티 함수로 교체
   - `any` 타입 제거 및 `unknown` 타입으로 변경
   - 접근성 속성 추가 (`aria-label`, `role`, `aria-pressed`)

2. **`app/(admin)/admin/time-management/[templateId]/_components/TemplateBlockForm.tsx`**
   - Zod 스키마를 사용한 폼 유효성 검사 강화
   - 시작 시간/종료 시간 검증 로직 추가
   - 접근성 속성 추가
   - 실시간 시간 유효성 검사 (`useEffect`)

3. **`app/(admin)/admin/time-management/[templateId]/_components/TemplateBlockSetManagement.tsx`**
   - 타입 정의를 새로 만든 타입으로 교체
   - `any` 타입 제거

4. **`app/(admin)/admin/time-management/_components/TemplateBlockSetManagement.tsx`**
   - 타입 정의를 새로 만든 타입으로 교체

5. **`app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlocksViewer.tsx`**
   - 동일한 리팩토링 적용

6. **`app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlockForm.tsx`**
   - 동일한 리팩토링 적용

7. **`app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlockSetManagement.tsx`**
   - 타입 정의를 새로 만든 타입으로 교체

---

## 🔧 주요 변경 사항

### 1. 타입 정의 강화

#### Before
```typescript
type BlockSet = {
  id: string;
  name: string;
  description?: string | null;
  blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
};
```

#### After
```typescript
import type { Block, BlockSet } from "@/lib/types/time-management";

// 엄격한 타입 정의
export interface Block {
  id: string;
  day_of_week: DayOfWeek; // 0 | 1 | 2 | 3 | 4 | 5 | 6
  start_time: TimeString; // "HH:MM" 형식
  end_time: TimeString;
  block_set_id?: string | null;
}
```

### 2. 시간 계산 로직 분리

#### Before
```typescript
const blockSetsWithStats = useMemo(() => {
  return blockSets.map((set) => {
    const setBlocks = set.blocks ?? [];
    const totalMinutes = setBlocks.reduce((acc, block) => {
      const [startH, startM] = (block.start_time ?? "00:00").split(":").map(Number);
      const [endH, endM] = (block.end_time ?? "00:00").split(":").map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      const duration = end - start;
      return acc + (duration > 0 ? duration : 0);
    }, 0);
    // ... 복잡한 계산 로직
  });
}, [blockSets]);
```

#### After
```typescript
import { enrichBlockSetWithStats } from "@/lib/utils/timeUtils";

const blockSetsWithStats = useMemo(() => {
  return blockSets.map((set) => enrichBlockSetWithStats(set));
}, [blockSets]);
```

### 3. Zod 스키마 검증 강화

#### Before
```typescript
if (selectedWeekdays.length === 0) {
  return { error: "최소 1개 이상의 요일을 선택해주세요.", success: false };
}
```

#### After
```typescript
import { blockFormSchema, isStartTimeBeforeEndTime } from "@/lib/validation/timeSchema";

// 시간 유효성 검사
if (startTimeValue && endTimeValue) {
  if (!isStartTimeBeforeEndTime(startTimeValue, endTimeValue)) {
    return { error: "시작 시간은 종료 시간보다 이전이어야 합니다.", success: false };
  }
}

// 폼 데이터 유효성 검사
const formValidation = blockFormSchema.safeParse({
  selectedWeekdays,
  start_time: startTimeValue,
  end_time: endTimeValue,
  block_set_id: blockSetId,
});

if (!formValidation.success) {
  const firstError = formValidation.error.issues[0];
  return { error: firstError?.message || "입력값이 올바르지 않습니다.", success: false };
}
```

### 4. 접근성 개선

#### Before
```typescript
<button
  type="button"
  onClick={() => toggleWeekday(day.value)}
  className={...}
>
  {day.label}요일
</button>
```

#### After
```typescript
<div
  className="flex flex-wrap gap-2"
  role="group"
  aria-label="요일 선택"
>
  {DAY_NAMES.map((dayLabel, dayIndex) => (
    <button
      key={dayIndex}
      type="button"
      onClick={() => toggleWeekday(dayIndex)}
      className={...}
      aria-pressed={selectedWeekdays.includes(dayIndex)}
      aria-label={`${dayLabel}요일 ${selectedWeekdays.includes(dayIndex) ? "선택됨" : "선택 안됨"}`}
    >
      {dayLabel}요일
    </button>
  ))}
</div>
```

### 5. 에러 처리 개선

#### Before
```typescript
} catch (error: any) {
  toast.showError(error.message || "세트 삭제에 실패했습니다.");
}
```

#### After
```typescript
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : "세트 삭제에 실패했습니다.";
  toast.showError(errorMessage);
}
```

---

## ✅ 검증 항목

### 타입 안정성
- [x] `any` 타입 제거
- [x] 모든 에러 처리에서 `unknown` 타입 사용
- [x] 엄격한 타입 정의 적용

### 유효성 검사
- [x] 시작 시간이 종료 시간보다 이전인지 검증
- [x] 최소 1개 이상의 요일 선택 검증
- [x] Zod 스키마를 통한 폼 데이터 검증
- [x] 실시간 시간 유효성 검사 (UI 피드백)

### 접근성
- [x] `aria-label` 속성 추가
- [x] `role` 속성 추가 (요일 선택 그룹)
- [x] `aria-pressed` 속성 추가 (요일 선택 버튼)
- [x] `aria-invalid`, `aria-describedby` 속성 추가 (시간 입력 필드)
- [x] `htmlFor` 속성 추가 (라벨 연결)

### 코드 품질
- [x] 시간 계산 로직을 순수 함수로 분리
- [x] 재사용 가능한 유틸리티 함수 생성
- [x] 중복 코드 제거
- [x] 일관된 타입 정의 사용

---

## 🧪 테스트 권장 사항

### 유닛 테스트
- `lib/utils/timeUtils.ts`의 시간 계산 함수들
- `lib/validation/timeSchema.ts`의 검증 함수들

### 통합 테스트
- 블록 추가 시 시간 유효성 검사
- 요일 선택 검증
- 블록 세트 통계 계산

### 접근성 테스트
- 스크린 리더로 요일 선택 테스트
- 키보드만으로 폼 제출 테스트

---

## 📝 향후 개선 사항

1. **공통 컴포넌트 통합**: `_components`와 `[templateId]/_components`의 중복 파일을 공통 컴포넌트로 통합 고려
2. **테스트 코드 작성**: 유틸리티 함수에 대한 유닛 테스트 추가
3. **에러 메시지 개선**: 사용자 친화적인 에러 메시지 제공
4. **성능 최적화**: 대량의 블록 세트 처리 시 성능 최적화 고려

---

## 🔗 관련 파일

- `lib/types/time-management.ts` - 타입 정의
- `lib/validation/timeSchema.ts` - Zod 스키마
- `lib/utils/timeUtils.ts` - 시간 계산 유틸리티
- `app/(admin)/admin/time-management/[templateId]/_components/` - 컴포넌트 파일들
- `app/(admin)/admin/camp-templates/[id]/time-management/_components/` - 컴포넌트 파일들

---

**작업 완료**: 모든 리팩토링 작업이 완료되었으며, 린터 오류가 없음을 확인했습니다.

