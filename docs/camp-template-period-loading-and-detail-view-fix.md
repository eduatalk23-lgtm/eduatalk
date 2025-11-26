# 캠프 템플릿 학습기간 조회 수정 및 상세보기 화면 구성

## 작업 일시
2025-01-XX

## 작업 내용

### 1. 학습기간 조회 수정

#### 변경 파일
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

#### 문제점
- 템플릿 수정 시 `directState`가 초기값으로만 설정되고 `data.period_start`와 `data.period_end` 변경 시 업데이트되지 않음
- `periodInputType`이 항상 "direct"로 초기화되어 저장된 입력 타입을 반영하지 않음
- `ddayState`와 `weeksState`가 데이터가 있어도 초기화되지 않음

#### 구현 내용
- `useEffect`를 추가하여 `data.period_start`와 `data.period_end`가 변경될 때 `directState` 업데이트
- `target_date`가 있으면 `ddayState` 업데이트 및 `periodInputType`을 "dday"로 설정
- `period_start`와 `period_end`의 차이를 계산하여 주 단위로 나누어떨어지면 `weeksState` 업데이트 및 `periodInputType`을 "weeks"로 설정
- 그 외의 경우는 "direct" 모드로 설정

#### 주요 변경사항
```typescript
// 학습기간 데이터 변경 시 directState 업데이트
useEffect(() => {
  if (data.period_start || data.period_end) {
    const startParts = data.period_start
      ? parseDateString(data.period_start)
      : getTodayParts();
    const endParts = data.period_end
      ? parseDateString(data.period_end)
      : getTodayParts();
    
    setDirectState((prev) => {
      // 값이 실제로 변경된 경우에만 업데이트 (무한 루프 방지)
      // ...
    });
  }
}, [data.period_start, data.period_end]);

// target_date가 있으면 ddayState 업데이트
useEffect(() => {
  if (data.target_date) {
    setDdayState({ date: data.target_date, calculated: true });
    setPeriodInputType("dday");
  }
}, [data.target_date]);

// weeksState 업데이트
useEffect(() => {
  if (data.period_start && !data.target_date) {
    // 주 단위 계산 로직
    // ...
  }
}, [data.period_start, data.period_end, data.target_date]);
```

### 2. 템플릿 상세보기 화면 구성

#### 변경 파일
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

#### 구현 내용
- 템플릿 데이터 섹션 추가
- `template.template_data`에서 다음 정보 표시:
  - 학습 기간 (period_start, period_end)
  - 스케줄러 유형
  - 플랜 목적
  - 학습일/복습일 주기 (study_review_cycle)
  - 목표 날짜 (target_date)
  - 학생 입력 허용 필드 정보

#### 주요 변경사항
```typescript
{/* 템플릿 데이터 상세 정보 */}
{template.template_data && (
  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <h2 className="mb-4 text-lg font-semibold text-gray-900">템플릿 설정 정보</h2>
    <div className="grid gap-4 md:grid-cols-2">
      {/* 학습 기간, 스케줄러 유형, 플랜 목적 등 표시 */}
    </div>
  </div>
)}
```

## 테스트 항목

### 학습기간 조회
- [ ] 템플릿 수정 페이지에서 학습기간이 올바르게 표시되는지 확인
- [ ] 직접 선택 모드에서 연도/월/일이 올바르게 설정되는지 확인
- [ ] D-day 모드에서 target_date가 올바르게 표시되는지 확인
- [ ] 주 단위 모드에서 주수와 시작일이 올바르게 표시되는지 확인

### 템플릿 상세보기
- [ ] 템플릿 상세 페이지에 "템플릿 설정 정보" 섹션이 표시되는지 확인
- [ ] 학습 기간이 올바르게 표시되는지 확인
- [ ] 스케줄러 유형과 플랜 목적이 올바르게 표시되는지 확인
- [ ] 학습일/복습일 주기가 올바르게 표시되는지 확인
- [ ] 학생 입력 허용 필드가 올바르게 표시되는지 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `lib/constants/planLabels.ts`

