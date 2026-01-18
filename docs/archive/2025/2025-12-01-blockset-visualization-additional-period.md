# 블록 세트 시각화 및 추가 기간 재배치 개선

## 작성 일자
2025-12-01

## 작업 내용

### 1. 블록 세트 시각화 개선

#### 변경 사항
Step1 기본 정보 화면에서 블록 세트 시간 표현을 텍스트 목록에서 세로 타임라인으로 시각화했습니다.

#### 구현 내용

**새 컴포넌트**: `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`

**기능**:
- 요일별 컬럼 배치 (월~일)
- 0시~24시 세로 타임라인
- 12시 기준선으로 오전/오후 구분
- 블록을 시간대에 맞춰 세로 막대로 표시
- block_index에 따른 색상 구분 (파란색 계열)
- 호버 시 정확한 시간 표시
- 범례를 통한 블록 인덱스 정보 제공

**UI 개선 효과**:
- 시각적으로 시간대 파악 용이
- 요일별 학습 시간 분포 한눈에 확인
- 직관적인 타임라인 표현

#### 적용 위치
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx` (라인 2024-2080)
- 기존 텍스트 목록을 BlockSetTimeline 컴포넌트로 교체

---

### 2. 추가 기간 재배치 기능 개선

#### 변경 사항

##### 2.1 설명 문구 개선

**기존**:
```
1730 Timetable은 4주 단위로 진행하며, 추가 기간에는 앞서 4주치 학습한 내용을 다시 반복합니다.
```

**변경**:
```
추가 기간은 복습일로 계산되며, 학습 기간에 배정된 콘텐츠 범위를 추가 기간에 다시 분할 배치합니다.
학습 기간 + 추가 기간이 전체 학습 기간이 됩니다.
```

**효과**: 4주 제약 제거, 유연한 기간 설정 가능

##### 2.2 체크박스 라벨 변경

**기존**: "추가 기간 재배치 사용 (4주 학습 범위 재배치)"  
**변경**: "추가 기간 학습 범위 재배치 사용"

##### 2.3 날짜 검증 추가

추가 기간 시작일에 대한 검증 로직:
- `min` 속성: 학습 기간 종료일 다음날 (`period_end + 1일`)
- `onChange` 검증: 시작일이 종료일 이전이면 경고 메시지 표시

```typescript
const minDate = data.period_end
  ? new Date(new Date(data.period_end).getTime() + 86400000)
      .toISOString()
      .split("T")[0]
  : undefined;

if (minDate && newStartDate < minDate) {
  showError("추가 기간 시작일은 학습 기간 종료일 다음날부터 가능합니다.");
  return;
}
```

##### 2.4 재배치 범위 설명 개선

**기존**:
```
재배치 범위: YYYY-MM-DD ~ YYYY-MM-DD (4주치 학습 내용)
앞서 4주치 학습한 내용을 추가 기간에 재배치하여 복습의 복습을 진행합니다.
```

**변경**:
```
재배치 범위: YYYY-MM-DD ~ YYYY-MM-DD
학습 기간의 콘텐츠를 추가 기간에 재배치하여 복습을 진행합니다.
```

---

### 3. Step3 스케줄 미리보기에 추가 기간 포함

#### 변경 사항

##### 3.1 스케줄 계산 기간 확장

`SchedulePreviewPanel.tsx`에서 추가 기간이 있을 경우 자동으로 포함:

```typescript
// 추가 기간이 있으면 종료일을 추가 기간 종료일로 확장
const effectiveEndDate = data.additional_period_reallocation?.period_end || data.period_end;

return {
  periodStart: data.period_start,
  periodEnd: effectiveEndDate,
  // ...
};
```

##### 3.2 시각적 구분

**추가 기간 안내 배너**:
- 추가 기간 사용 시 상단에 안내 메시지 표시
- 학습 기간과 추가 기간을 명확히 구분
- 보라색 테마로 추가 기간 강조

**일별 스케줄 표시**:
- 추가 기간에 해당하는 날짜는 보라색 배경으로 강조
- "추가 기간" 배지 표시
- 기존 day_type 라벨과 함께 표시

```typescript
const isAdditionalPeriod = data.additional_period_reallocation &&
  day.date >= data.additional_period_reallocation.period_start &&
  day.date <= data.additional_period_reallocation.period_end;

// 배경색: border-purple-300 bg-purple-50
// 배지: "추가 기간"
```

---

## 수정 파일

### 새로 생성된 파일
1. `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`
   - 블록 세트 타임라인 시각화 컴포넌트

### 수정된 파일
1. `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
   - BlockSetTimeline 컴포넌트 import 및 사용
   - 추가 기간 설명 문구 업데이트
   - "4주치" 표현 모두 제거
   - 추가 기간 시작일 검증 로직 추가

2. `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`
   - 추가 기간 포함한 스케줄 계산
   - 추가 기간 안내 배너 추가
   - 추가 기간 날짜 시각적 구분

---

## 검증 사항

### ✅ 완료된 검증
- [x] 블록 세트 타임라인이 요일별로 올바르게 표시됨
- [x] 오전(0-12시), 오후(12-24시) 구분 명확
- [x] 여러 블록이 있을 때 겹치지 않고 표시됨
- [x] 추가 기간 시작일이 학습 종료일 이후로만 선택 가능
- [x] "4주치" 문구가 모두 제거됨
- [x] 추가 기간 설명이 명확하게 업데이트됨
- [x] Step3에서 추가 기간 포함 스케줄 표시
- [x] Linting 오류 없음

---

## UI/UX 개선 효과

### 블록 세트 시각화
1. **시각적 이해도 향상**: 텍스트 나열 → 시각적 타임라인
2. **직관적 정보 전달**: 시간대별 학습 분포 한눈에 파악
3. **요일별 비교 용이**: 7개 요일을 나란히 배치하여 비교 가능

### 추가 기간 재배치
1. **명확한 정보 전달**: 4주 제약 제거, 유연한 기간 설정 가능
2. **데이터 검증 강화**: 날짜 입력 오류 방지
3. **전체 스케줄 파악**: Step3에서 추가 기간까지 포함한 전체 일정 확인
4. **시각적 구분**: 학습 기간과 추가 기간을 색상으로 명확히 구분

---

## 기술적 세부사항

### 블록 타임라인 렌더링
- 시간을 0-24시 범위의 백분율로 변환
- CSS positioning으로 블록 배치
- Hover tooltip으로 정확한 시간 표시

### 추가 기간 계산
- 학습 기간 종료일 + 1일을 최소 시작일로 설정
- `Date.getTime() + 86400000` (1일 = 86,400,000ms)
- ISO 형식 날짜 문자열로 변환

### 스케줄 미리보기 확장
- `effectiveEndDate` 계산으로 추가 기간 포함
- 날짜 문자열 비교로 추가 기간 여부 판단
- 조건부 스타일링으로 시각적 구분

---

## 관련 파일
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`
- `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`
- `lib/scheduler/calculateAvailableDates.ts` (변경 없음)

---

## 향후 개선 사항
- 추가 기간의 콘텐츠 재배치 로직 시각화
- 블록 타임라인에 학습 시간 합계 표시
- 모바일 반응형 최적화

