# 시간 블록 관리 UI 통일 및 개선

## 📋 작업 개요

**작업 일자**: 2024년 11월 29일  
**목표**: 시간 블록 관리 페이지의 UI 일관성 개선 및 사용자 경험 향상

## 🔍 문제점

### 기존 문제
1. **블록 세트 탭**: 추가 버튼이 카드 그리드 내부에만 있어 일관성 없음
2. **학습 제외 일정 탭**: 빈 상태 UI 없음, 버튼 스타일이 다름  
3. **학원 일정 탭**: 빈 상태 UI 없음, 레이아웃 구조가 복잡함
4. **전체**: 탭마다 "추가" 버튼 위치와 스타일이 제각각

## ✅ 구현 내용

### 1. 페이지 레이아웃 구조 개선

**변경 파일**: 
- `app/(student)/blocks/page.tsx`
- `app/(student)/blocks/_components/BlockManagementContainer.tsx` (신규)

#### 변경사항
- 서버 컴포넌트(page.tsx)는 데이터 페칭만 담당
- 새로운 클라이언트 컴포넌트(BlockManagementContainer) 생성
- 페이지 상단에 통일된 헤더와 탭별 액션 버튼 영역 추가

#### 구조
```tsx
<BlockManagementContainer>
  ├─ 페이지 헤더 (제목 + 설명)
  ├─ 액션 버튼 (탭별 동적 표시)
  └─ <BlockManagementTabs>
      ├─ 탭 네비게이션
      └─ 탭 내용
```

### 2. 탭 관리 개선

**변경 파일**: `app/(student)/blocks/_components/BlockManagementTabs.tsx`

#### 변경사항
- `ManagementTab` 타입을 export하여 재사용 가능하게 변경
- `onTabChange` 콜백 추가 - 상위 컴포넌트에 현재 탭 전달
- 각 탭 컴포넌트에 액션 핸들러 props 추가:
  - `onBlockSetCreateRequest`: 블록 세트 추가 요청
  - `onExclusionAddRequest`: 제외일 추가 요청
  - `onAcademyAddRequest`: 학원 추가 요청
- 각 탭 컴포넌트에 상태 props 추가:
  - `isCreatingBlockSet`: 블록 세트 생성 중 여부
  - `isAddingExclusion`: 제외일 추가 중 여부
  - `isAddingAcademy`: 학원 추가 중 여부

### 3. 블록 세트 관리 개선

**변경 파일**:
- `app/(student)/blocks/_components/BlockSetManagement.tsx`
- `app/(student)/blocks/_components/BlocksViewer.tsx`

#### BlockSetManagement
- `onCreateSetRequest` props 추가 - 상위에서 전달받은 생성 요청 핸들러
- `creating` props 추가 - 생성 폼 표시 여부를 상위에서 제어

#### BlocksViewer
- **제거**: 카드 그리드 상단의 "새 세트 추가" 버튼 및 헤더
- **추가**: `EmptyState` 컴포넌트를 사용한 빈 상태 UI
- `onCreateSetRequest` props 추가 - 상위로 상태 변경 요청
- `creating` props 추가 - 외부에서 제어되는 생성 폼 표시 여부

```tsx
// 빈 상태 UI
<EmptyState
  title="등록된 블록 세트가 없습니다"
  description="새 블록 세트를 추가하여 학습 시간을 관리하세요."
  icon="📅"
/>
```

### 4. 학습 제외 일정 관리 개선

**변경 파일**: `app/(student)/blocks/_components/ExclusionManagement.tsx`

#### 변경사항
- **제거**: 내부 "제외일 추가" 버튼
- **추가**: 
  - `onAddRequest` props - 상위에서 전달받은 추가 요청 핸들러
  - `isAdding` props - 추가 폼 표시 여부를 상위에서 제어
  - `EmptyState` 컴포넌트를 사용한 빈 상태 UI
- **제거**: 기존 빈 상태 텍스트 (`<p>등록된 학습 제외일이 없습니다.</p>`)

```tsx
// 빈 상태 UI
<EmptyState
  title="등록된 학습 제외 일정이 없습니다"
  description="휴가나 개인 사정으로 학습하지 않는 날을 등록하세요."
  icon="🗓️"
/>
```

### 5. 학원 일정 관리 개선

**변경 파일**: `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`

#### 변경사항
- **제거**: 내부 "학원 추가" 버튼
- **추가**:
  - `onAddRequest` props - 상위에서 전달받은 추가 요청 핸들러
  - `isAddingAcademy` props - 추가 폼 표시 여부를 상위에서 제어
  - `EmptyState` 컴포넌트를 사용한 빈 상태 UI
- **단순화**: 복잡한 레이아웃 구조 개선
  - 학원 목록 헤더와 버튼 영역 분리
  - 빈 상태와 내용 상태의 조건부 렌더링 개선

```tsx
// 빈 상태 UI
<EmptyState
  title="등록된 학원이 없습니다"
  description="다니는 학원을 추가하고 일정을 관리하세요."
  icon="🏫"
/>
```

## 🎨 UI/UX 개선 사항

### 통일된 액션 버튼 스타일

모든 탭의 "추가" 버튼이 페이지 상단 우측에 배치되며, 동일한 스타일 적용:

```tsx
// Primary 버튼 (추가)
className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"

// Secondary 버튼 (취소)
className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
```

### 아이콘 사용
- `lucide-react`의 `Plus` 아이콘 사용
- 크기: `h-4 w-4`

### 빈 상태 디자인
- 기존 `EmptyState` 컴포넌트 활용
- 각 탭에 맞는 아이콘과 설명 텍스트 적용
- 일관된 디자인으로 사용자 경험 향상

## 📊 컴포넌트 구조

### Before (기존)
```
page.tsx (서버)
└─ BlockManagementTabs (클라이언트)
    ├─ BlockSetManagement
    │   └─ BlocksViewer [내부에 추가 버튼]
    ├─ ExclusionManagement [내부에 추가 버튼]
    └─ AcademyScheduleManagement [내부에 추가 버튼]
```

### After (개선)
```
page.tsx (서버)
└─ BlockManagementContainer (클라이언트) [상태 관리]
    ├─ 페이지 헤더
    ├─ 액션 버튼 영역 [탭별 동적 표시]
    └─ BlockManagementTabs (클라이언트) [프레젠테이션]
        ├─ BlockSetManagement
        │   └─ BlocksViewer [props로 제어]
        ├─ ExclusionManagement [props로 제어]
        └─ AcademyScheduleManagement [props로 제어]
```

## 🔄 상태 관리 흐름

```
BlockManagementContainer (상태 보유)
  ├─ activeTab: "blocks" | "exclusions" | "academy"
  ├─ isCreatingBlockSet: boolean
  ├─ isAddingExclusion: boolean
  └─ isAddingAcademy: boolean
       ↓ props 전달
BlockManagementTabs (상태 중계)
       ↓ props 전달
각 탭 컴포넌트 (상태 사용)
  - 추가 폼 표시/숨김
  - 취소 시 상위로 토글 요청
  - 완료 시 상위로 토글 요청
```

## 📝 변경된 파일 목록

1. **`app/(student)/blocks/page.tsx`** - BlockManagementContainer 사용
2. **`app/(student)/blocks/_components/BlockManagementContainer.tsx`** - 신규 생성
3. **`app/(student)/blocks/_components/BlockManagementTabs.tsx`** - props 추가
4. **`app/(student)/blocks/_components/BlockSetManagement.tsx`** - props 추가
5. **`app/(student)/blocks/_components/BlocksViewer.tsx`** - 헤더 제거, 빈 상태 추가
6. **`app/(student)/blocks/_components/ExclusionManagement.tsx`** - 버튼 제거, 빈 상태 추가
7. **`app/(student)/blocks/_components/AcademyScheduleManagement.tsx`** - 버튼 제거, 빈 상태 추가

## ✅ 테스트 결과

### ESLint 검증
- ✅ 모든 파일 linter 오류 없음 확인

### 기능 검증 항목
- [x] 블록 세트 탭: 상단 버튼으로 세트 추가 가능
- [x] 학습 제외 일정 탭: 상단 버튼으로 제외일 추가 가능
- [x] 학원 일정 탭: 상단 버튼으로 학원 추가 가능
- [x] 각 탭에서 빈 상태 UI 정상 표시
- [x] 탭 전환 시 액션 버튼 동적 변경
- [x] 추가/취소 시 상태 토글 정상 작동

## 🎯 기대 효과

1. **일관성 향상**: 모든 탭에서 동일한 위치와 스타일의 액션 버튼
2. **사용성 개선**: 
   - 사용자가 "추가" 기능을 찾기 쉬움
   - 빈 상태에서 명확한 안내 메시지 제공
3. **유지보수성**: 
   - 상태 관리가 상위 컴포넌트에 집중
   - 각 탭 컴포넌트는 프레젠테이션에 집중
4. **확장성**: 
   - 새로운 탭 추가 시 동일한 패턴 적용 가능
   - 액션 버튼 추가/변경 용이

## 🔗 관련 문서

- [프로젝트 가이드라인](../project-guidelines.md)
- [UI 컴포넌트 가이드](../components/ui/README.md)

