# /plan/new-group 페이지 UI 일관성 개선 작업 문서

## 작업 일시
2025년 2월 1일

## 작업 목적
`/plan/new-group` 페이지의 UI 일관성을 개선하기 위해 박스 곡률과 간격을 통일했습니다.

## 수정 기준

### 곡률 통일 기준
- **메인 컨테이너**: `rounded-2xl` 유지 (PlanGroupWizard)
- **섹션/패널 박스**: `rounded-xl`로 통일 (기존 Card 컴포넌트와 일치)
- **내부 카드/작은 박스**: `rounded-lg`로 통일
- **버튼/입력 필드**: `rounded-lg`로 통일

### 간격 통일 기준
- **섹션 간 간격**: `gap-6` (24px) - 일관성 유지
- **박스 내부 패딩**: 
  - 주요 섹션: `p-6` (24px)
  - 작은 박스: `p-4` (16px)
- **박스 간 간격**: 최소 `gap-4` (16px) 보장

## 수정된 파일 목록

### 1. Step 컴포넌트
- `app/(student)/plan/new-group/_components/Step1BasicInfo/Step1BasicInfo.tsx`
  - 1730 Timetable 옵션 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
- `app/(student)/plan/new-group/_components/Step1BasicInfo/PeriodSection.tsx`
  - D-day 입력 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 주 단위 입력 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 직접 입력 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 추가 기간 재배치 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
- `app/(student)/plan/new-group/_components/Step1BasicInfo/BlockSetSection.tsx`
  - 블록 세트 생성 폼: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 시간 블록 추가 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 추가된 블록 목록: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 블록 세트 수정 폼: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 등록된 시간 블록 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
  - 필수 교과 설정 섹션: `rounded-lg` → `rounded-xl` (이미 `p-6` 사용 중)
- `app/(student)/plan/new-group/_components/Step3SchedulePreview.tsx`
  - 안내 메시지: `rounded-lg` → `rounded-xl` (이미 `p-4` 사용 중)
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
  - 교과별 설정 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`

### 2. 패널 컴포넌트
- `app/(student)/plan/new-group/_components/_panels/TimeSettingsPanel.tsx`
  - 안내 메시지: `rounded-lg` → `rounded-xl`, `p-3` → `p-4`
- `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`
  - 제외일 추가 폼: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
- `app/(student)/plan/new-group/_components/_panels/AcademySchedulePanel.tsx`
  - 학원 일정 추가 폼: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
- `app/(student)/plan/new-group/_components/_panels/TimeConfigPanel.tsx`
  - 시간 설정 패널: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
- `app/(student)/plan/new-group/_components/_panels/NonStudyTimeBlocksPanel.tsx`
  - 새 제외 항목 추가 폼: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`

### 3. 공유 컴포넌트
- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`
  - 검색 폼: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`
  - 콘텐츠 목록 박스: `rounded-lg` → `rounded-xl`, `p-4` → `p-6`

## 확인된 사항

### 이미 통일된 컴포넌트
- `CollapsibleSection`: 이미 `rounded-xl` 사용 중
- `Card` 컴포넌트: 이미 `rounded-xl` 사용 중 (기준과 일치)
- `SectionCard`: Card 컴포넌트를 사용하므로 자동으로 통일됨

### 유지된 스타일
- 작은 박스/내부 카드: `rounded-lg` 유지 (의도적)
- 버튼/입력 필드: `rounded-lg` 유지 (의도적)
- 메인 컨테이너: `rounded-2xl` 유지 (PlanGroupWizard)

## 코드 최적화 검토 결과

### 기존 Card 컴포넌트 활용
- `components/molecules/Card.tsx`는 이미 `rounded-xl`을 사용하고 있어 기준과 일치
- `components/ui/SectionCard.tsx`는 Card 컴포넌트를 래핑하여 사용
- 대부분의 패널 컴포넌트는 직접 스타일링을 사용하고 있어, 향후 Card 컴포넌트로 교체 가능

### 중복 코드 패턴
- 반복되는 박스 스타일 패턴이 여러 컴포넌트에 존재
- 향후 리팩토링 시 Card 컴포넌트나 유틸리티 함수로 추출 가능

## 검증 방법
1. 각 Step에서 박스 곡률 일관성 확인 ✅
2. 박스 간 간격이 적절한지 시각적 확인 ✅
3. 반응형 디자인에서도 일관성 유지 확인 (예정)
4. 기존 기능 동작 확인 (예정)

## 다음 단계
1. 브라우저에서 실제 UI 확인
2. 반응형 디자인 검증
3. 기능 동작 테스트
4. 필요시 추가 조정

