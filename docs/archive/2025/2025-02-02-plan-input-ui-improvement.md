# 플랜 정보 입력 화면 UI 개선

## 작업 일자
2025-02-02

## 목표
플랜 정보 입력 화면(Step 1-7)의 UI를 개선하여 항목별 영역을 명확히 구분하고, 주요 섹션에 토글 기능을 추가하며, 학생 입력 허용 체크박스 위치를 섹션 헤더로 통합합니다.

## 완료된 작업

### 1. CollapsibleSection 컴포넌트 확장
**파일**: `app/(student)/plan/new-group/_components/_summary/CollapsibleSection.tsx`

- 학생 입력 허용 체크박스를 헤더에 추가할 수 있도록 prop 확장
- 추가된 props:
  - `studentInputAllowed?: boolean` - 학생 입력 허용 여부
  - `onStudentInputToggle?: (enabled: boolean) => void` - 토글 콜백
  - `showStudentInputToggle?: boolean` - 템플릿 모드일 때만 표시
- 헤더 우측에 체크박스 배치 (수정 버튼과 함께)

### 2. Step 1: 기본 정보 섹션화
**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

각 주요 항목을 CollapsibleSection으로 감싸기:

1. **플랜/캠프 이름** 섹션
   - 학생 입력 허용 체크박스를 헤더로 이동
   - 기본값: 펼침 (`defaultOpen={true}`)

2. **플랜 목적** 섹션
   - 학생 입력 허용 체크박스를 헤더로 이동
   - 기본값: 펼침

3. **학습 기간** 섹션
   - 학생 입력 허용 체크박스를 헤더로 이동
   - 기본값: 펼침

4. **스케줄러 유형** 섹션
   - 학생 입력 허용 체크박스를 헤더로 이동
   - 기본값: 접힘 (`defaultOpen={false}`) - 설명이 많아서

5. **블록 세트 생성/선택** 섹션
   - 학생 입력 허용 체크박스를 헤더로 이동
   - 기본값: 펼침

### 3. Step 2: 패널 개선
**파일**: `app/(student)/plan/new-group/_components/_panels/TimeSettingsPanel.tsx`

각 패널을 CollapsibleSection으로 감싸기:

1. **학습 제외일** (ExclusionsPanel)
   - CollapsibleSection으로 감싸짐
   - 학생 입력 허용 체크박스 헤더에 통합
   - 기본값: 펼침

2. **학원 일정** (AcademySchedulePanel)
   - CollapsibleSection으로 감싸짐
   - 학생 입력 허용 체크박스 헤더에 통합
   - 기본값: 펼침

3. **시간 설정** (TimeConfigPanel)
   - CollapsibleSection으로 감싸짐
   - 학생 입력 허용 체크박스 헤더에 통합
   - 기본값: 펼침

4. **학습 시간 제외 항목** (NonStudyTimeBlocksPanel)
   - CollapsibleSection으로 감싸짐
   - 학생 입력 허용 체크박스 헤더에 통합
   - 기본값: 펼침

## 변경된 파일

1. `app/(student)/plan/new-group/_components/_summary/CollapsibleSection.tsx`
   - 학생 입력 허용 체크박스를 헤더에 추가

2. `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
   - 각 주요 섹션을 CollapsibleSection으로 감싸기
   - 학생 입력 허용 체크박스를 헤더로 이동

3. `app/(student)/plan/new-group/_components/_panels/TimeSettingsPanel.tsx`
   - 각 패널을 CollapsibleSection으로 감싸기
   - 학생 입력 허용 체크박스를 헤더에 통합

## 완료된 추가 작업

### 1. Step 3-5: 섹션 구조 확인
- Step3ContentSelection, Step4RecommendedContents 등은 이미 탭 구조로 잘 정리되어 있음
- 추가 CollapsibleSection 적용 불필요

### 2. 학생 입력 허용 체크박스 위치 통일
- 각 패널 내부의 학생 입력 허용 체크박스 제거 완료
- CollapsibleSection 헤더의 체크박스만 사용하도록 통일
- 수정된 패널:
  - ExclusionsPanel
  - AcademySchedulePanel
  - TimeConfigPanel
  - NonStudyTimeBlocksPanel

## 예상 효과

1. ✅ 각 주요 항목이 명확히 구분된 섹션으로 표시
2. ✅ 섹션별로 접기/펼치기 가능하여 화면 정리
3. ✅ 학생 입력 허용 체크박스가 섹션 헤더에 통일되게 배치 (진행 중)
4. ✅ 일관된 UI/UX 패턴 적용

## 참고사항

- 템플릿 모드에서만 학생 입력 허용 체크박스 표시
- 기본 상태는 대부분 펼침 (사용자가 바로 입력할 수 있도록)
- 설명이 많은 섹션은 기본 접힘 (스케줄러 유형 등)

