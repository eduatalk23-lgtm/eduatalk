# 추가 기간 날짜 선택 제약 조건 수정

## 📋 개요

추가 기간 학습 범위 재배치에서 날짜 선택 시 제약 조건을 추가하여, 추가 기간 종료일이 추가 기간 시작일 이후로만 선택 가능하도록 수정했습니다.

## 🔍 문제점

### 기존 문제
- **추가 기간 시작일**: 학습 기간 종료일 다음날부터 선택 가능 (이미 구현됨)
- **추가 기간 종료일**: 제약 조건 없음
- **결과**: 추가 기간 종료일이 시작일보다 이전인 날짜도 선택 가능

### 원인
- 추가 기간 종료일 input에 `min` 속성이 없음
- 추가 기간 종료일 onChange에서 검증 로직 없음
- 추가 기간 시작일 변경 시 종료일 자동 조정 없음

## ✅ 수정 내용

### 1. 추가 기간 종료일 `min` 속성 추가

#### 수정 전
```typescript
<input
  type="date"
  value={data.additional_period_reallocation.period_end}
  onChange={(e) => {
    // 검증 없이 바로 업데이트
    onUpdate({
      additional_period_reallocation: {
        ...data.additional_period_reallocation!,
        period_end: e.target.value,
      },
    });
  }}
/>
```

#### 수정 후
```typescript
<input
  type="date"
  value={data.additional_period_reallocation.period_end}
  min={
    data.additional_period_reallocation.period_start
      ? new Date(
          new Date(data.additional_period_reallocation.period_start).getTime() + 86400000
        )
          .toISOString()
          .split("T")[0]
      : undefined
  }
  onChange={(e) => {
    const newEndDate = e.target.value;
    const minDate = data.additional_period_reallocation.period_start
      ? new Date(
          new Date(data.additional_period_reallocation.period_start).getTime() + 86400000
        )
          .toISOString()
          .split("T")[0]
      : null;
    
    if (minDate && newEndDate < minDate) {
      showError(
        "추가 기간 종료일은 추가 기간 시작일 다음날부터 가능합니다."
      );
      return;
    }
    
    onUpdate({
      additional_period_reallocation: {
        ...data.additional_period_reallocation!,
        period_end: newEndDate,
      },
    });
  }}
/>
```

### 2. 추가 기간 시작일 변경 시 종료일 자동 조정

#### 수정 전
```typescript
onUpdate({
  additional_period_reallocation: {
    ...data.additional_period_reallocation!,
    period_start: newStartDate,
  },
});
```

#### 수정 후
```typescript
// 추가 기간 종료일이 새로운 시작일보다 이전이면 종료일도 조정
let newEndDate = data.additional_period_reallocation.period_end;
if (newEndDate && newEndDate < newStartDate) {
  const adjustedEndDate = new Date(
    new Date(newStartDate).getTime() + 86400000
  )
    .toISOString()
    .split("T")[0];
  newEndDate = adjustedEndDate;
}

onUpdate({
  additional_period_reallocation: {
    ...data.additional_period_reallocation!,
    period_start: newStartDate,
    period_end: newEndDate,
  },
});
```

## 🎯 수정 사항 상세

### 1. 추가 기간 종료일 제약 조건
- `min` 속성: 추가 기간 시작일 + 1일
- onChange 검증: 시작일보다 이전 날짜 선택 시 에러 메시지 표시
- 브라우저 레벨에서도 이전 날짜 선택 불가

### 2. 시작일 변경 시 종료일 자동 조정
- 추가 기간 시작일을 변경할 때, 종료일이 새로운 시작일보다 이전이면 자동으로 조정
- 조정된 종료일: 새로운 시작일 + 1일

### 3. 일관성 유지
- 추가 기간 시작일: 학습 기간 종료일 + 1일 이후
- 추가 기간 종료일: 추가 기간 시작일 + 1일 이후
- 두 제약 조건이 모두 적용되어 유효한 날짜만 선택 가능

## 📝 테스트 시나리오

### 시나리오 1: 추가 기간 종료일 선택
- **입력**: 
  - 학습 기간: 2025-01-01 ~ 2025-01-31
  - 추가 기간 시작일: 2025-02-01
  - 추가 기간 종료일 선택 시도: 2025-01-30
- **기대 결과**: 
  - 날짜 선택 불가 (min 속성)
  - 또는 선택 시 에러 메시지 표시

### 시나리오 2: 추가 기간 시작일 변경
- **입력**: 
  - 추가 기간 시작일: 2025-02-01
  - 추가 기간 종료일: 2025-02-05
  - 추가 기간 시작일 변경: 2025-02-10
- **기대 결과**: 
  - 종료일이 자동으로 2025-02-11로 조정됨

### 시나리오 3: 정상적인 날짜 선택
- **입력**: 
  - 학습 기간: 2025-01-01 ~ 2025-01-31
  - 추가 기간 시작일: 2025-02-01
  - 추가 기간 종료일: 2025-02-07
- **기대 결과**: 
  - 모든 날짜가 정상적으로 선택됨
  - 에러 없이 저장 가능

## 🚀 배포 전 확인사항

1. [x] 추가 기간 종료일이 시작일 이후로만 선택 가능한지 확인
2. [x] 추가 기간 시작일 변경 시 종료일 자동 조정 확인
3. [x] 브라우저 레벨 제약 조건(min 속성) 동작 확인
4. [x] 에러 메시지가 올바르게 표시되는지 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

