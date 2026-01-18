# 캠프 템플릿 수정 페이지 UI 개선

## 작업 일시
2025-02-02

## 목표
템플릿 수정 페이지(`/admin/camp-templates/[id]/edit`)의 UI를 개선하여 더 깔끔하고 사용하기 편리하게 만들었습니다.

## 요구사항

1. **템플릿 기본 정보 토글로 변경**: 접힘/펼침 기능 추가
2. **기본 정보 체크리스트 삭제**: `TemplateFormChecklist` 컴포넌트 제거
3. **필수요소 점검 영역 삭제**: `TemplateWizardChecklist` 컴포넌트 제거
4. **액션 버튼 이동**: 템플릿 목록, 취소, 저장 버튼을 템플릿 기본 정보 위로 이동

## 구현 내용

### 1. 템플릿 기본 정보 토글로 변경

**파일**: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 변경 사항
- `useState`로 토글 상태 관리 (`isBasicInfoOpen`)
- 기본값은 접힘 상태 (`false`)
- ChevronDown/ChevronUp 아이콘 추가 (lucide-react)
- 클릭하면 펼침/접힘 토글
- 토글 헤더는 항상 표시, 내용은 `isBasicInfoOpen` 상태에 따라 조건부 렌더링

#### 구조
```tsx
<div className="rounded-lg border border-gray-200 bg-white shadow-sm">
  <button onClick={() => setIsBasicInfoOpen(!isBasicInfoOpen)}>
    <h2>템플릿 기본 정보</h2>
    {isBasicInfoOpen ? <ChevronUp /> : <ChevronDown />}
  </button>
  {isBasicInfoOpen && (
    <div className="border-t border-gray-200 p-6">
      {/* 필드들 */}
    </div>
  )}
</div>
```

### 2. 기본 정보 체크리스트 삭제

**파일**: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 변경 사항
- `TemplateFormChecklist` import 제거
- 221-222줄의 체크리스트 컴포넌트 제거

### 3. 필수요소 점검 영역 삭제

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

#### 변경 사항
- `TemplateWizardChecklist` import 제거
- 템플릿 모드일 때 체크리스트 표시 부분 제거 (1170-1174줄)

**변경 전**:
```tsx
{isTemplateMode && (
  <div className="mb-6">
    <TemplateWizardChecklist wizardData={wizardData} />
  </div>
)}
```

**변경 후**: 완전 제거

### 4. 액션 버튼 이동

#### 4-1. CampTemplateEditForm에 액션 버튼 추가

**파일**: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 변경 사항
- 템플릿 기본 정보 위에 액션 버튼 섹션 추가
- 템플릿 목록, 취소, 저장 버튼 포함
- PlanGroupWizard의 저장 함수를 받아서 저장 버튼에 연결
- `onSaveRequest` prop을 통해 PlanGroupWizard의 저장 함수 수신

#### 구조
```tsx
<div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
  <Link href="/admin/camp-templates">템플릿 목록</Link>
  <div className="flex items-center gap-4">
    <button>취소</button>
    <button onClick={wizardSaveFunction}>저장</button>
  </div>
</div>
```

#### 4-2. PlanGroupWizard에서 액션 바 숨김

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

#### 변경 사항
- 템플릿 모드일 때 상단 액션 바 숨김 (`!isTemplateMode` 조건 추가)
- `onSaveRequest` prop 추가: 저장 함수를 외부에 노출
- `useEffect`를 사용하여 템플릿 모드일 때 저장 함수를 외부로 전달

**변경 전**:
```tsx
<div className="flex items-center justify-between...">
  {/* 액션 바 항상 표시 */}
</div>
```

**변경 후**:
```tsx
{!isTemplateMode && (
  <div className="flex items-center justify-between...">
    {/* 템플릿 모드가 아닐 때만 표시 */}
  </div>
)}
```

#### 저장 함수 노출
```tsx
useEffect(() => {
  if (isTemplateMode && onSaveRequest) {
    onSaveRequest(() => handleSaveDraft(false));
  }
}, [isTemplateMode, onSaveRequest, handleSaveDraft]);
```

## 변경된 파일

1. **`app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`**
   - `TemplateFormChecklist` import 제거
   - 토글 상태 추가 (`isBasicInfoOpen`)
   - 템플릿 기본 정보 섹션을 토글로 변경
   - 액션 버튼 섹션 추가 (템플릿 목록, 취소, 저장)
   - PlanGroupWizard에 `onSaveRequest` prop 전달

2. **`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`**
   - `TemplateWizardChecklist` import 제거
   - 템플릿 모드일 때 액션 바 숨김
   - `onSaveRequest` prop 추가
   - `useEffect`로 저장 함수 외부 노출
   - 템플릿 모드일 때 체크리스트 제거

## UI 구조 (변경 후)

```
[impactSummary 알림] (있을 경우만)

[액션 버튼]
├─ 템플릿 목록 (← 아이콘)
└─ 취소 | 저장

[템플릿 기본 정보] (토글)
├─ 헤더: "템플릿 기본 정보" + Chevron 아이콘
└─ 내용 (접혀있음):
   ├─ 템플릿 이름
   ├─ 프로그램 유형
   ├─ 설명
   ├─ 캠프 시작일
   ├─ 캠프 종료일
   └─ 캠프 장소

[PlanGroupWizard]
└─ Step 1, 2, 3, 4...
```

## 개선 효과

1. **화면 단순화**: 불필요한 체크리스트 제거로 화면이 깔끔해짐
2. **사용자 경험 향상**: 기본 정보는 접혀있어 필요한 정보에 집중 가능
3. **일관성**: 액션 버튼이 상단에 위치하여 접근성 향상
4. **공간 효율성**: 토글을 통해 화면 공간 효율적 사용

## 참고 사항

- 템플릿 기본 정보는 기본적으로 접혀있음 (기존에 이미 입력된 정보이므로)
- 저장 버튼은 PlanGroupWizard의 저장 기능을 재사용
- PlanGroupWizard의 액션 바는 템플릿 모드가 아닐 때만 표시됨

