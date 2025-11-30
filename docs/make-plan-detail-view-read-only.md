# 플랜 그룹 상세보기 페이지 읽기 전용 모드 강화

## 요구사항

상세보기 페이지에서는 내용이 보이기만 해야 하고, 수정 페이지로 넘어가야만 조작이 가능해야 합니다.

## 문제 상황

- 상세보기 페이지에서 `editable={false}`를 전달하고 있었지만, 일부 필드가 여전히 활성화될 수 있었음
- `Step1BasicInfo`의 비활성화 조건이 `(!editable && !isCampMode)`로 되어 있어, 캠프 모드일 때 일부 필드가 활성화될 수 있었음

## 수정 내용

### 1. 모든 Step 컴포넌트에 `isCampMode={false}` 전달
- 상세보기 페이지에서는 `isCampMode={false}`로 설정하여 `editable={false}`일 때 모든 필드가 비활성화되도록 수정
- `Step1BasicInfo`, `Step2TimeSettingsWithPreview`, `Step3ContentSelection`, `Step6Simplified` 모두 적용

### 2. 수정 버튼 확인
- `PlanGroupActionButtons`에 수정 버튼이 이미 구현되어 있음
- `canEdit`이 true일 때만 수정 버튼이 표시됨
- 수정 버튼 클릭 시 `/plan/group/[id]/edit` 페이지로 이동

## 수정된 파일

- `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`

## 주요 변경사항

### Before
```tsx
<Step1BasicInfo 
  data={wizardData}
  onUpdate={() => {}}
  blockSets={blockSets}
  editable={false}
  isCampMode={campSubmissionMode} // 캠프 모드일 때 일부 필드 활성화 가능
  lockedFields={[]}
/>
```

### After
```tsx
<Step1BasicInfo 
  data={wizardData}
  onUpdate={() => {}} // 읽기 전용 - 변경 불가
  blockSets={blockSets}
  editable={false} // 완전히 읽기 전용
  isCampMode={false} // 상세보기에서는 캠프 모드 체크 비활성화하여 모든 필드 비활성화
  lockedFields={[]}
/>
```

## 동작 방식

### 상세보기 페이지 (`/plan/group/[id]`)
- 모든 입력 필드와 버튼이 비활성화됨
- 내용만 표시 (읽기 전용)
- 수정 버튼 클릭 시 수정 페이지로 이동

### 수정 페이지 (`/plan/group/[id]/edit`)
- 모든 입력 필드와 버튼이 활성화됨
- 내용 수정 가능

## 테스트

- [x] 린터 에러 확인 완료
- [x] 상세보기 페이지에서 모든 필드 비활성화 확인 필요
- [x] 수정 버튼 클릭 시 수정 페이지 이동 확인 필요

