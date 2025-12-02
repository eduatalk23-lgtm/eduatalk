# 블록 세트 설명 아이콘 개선

## 작업 일시
2025-02-02

## 작업 개요
캠프 템플릿 수정 화면에서 블록 세트 설명 아이콘을 헤드 섹션의 항목 옆으로 이동하고, 아이콘을 물음표 형식으로 변경하며, 설명 표시를 다이얼로그 형식으로 변경했습니다.

## 변경 사항

### 1. CollapsibleSection 컴포넌트 수정
**파일**: `app/(student)/plan/new-group/_components/_summary/CollapsibleSection.tsx`

- `title` prop의 타입을 `string | React.ReactNode`로 변경하여 아이콘을 포함할 수 있도록 수정
- 제목 렌더링 부분에 `flex items-center gap-2` 클래스 추가하여 아이콘과 텍스트를 나란히 표시

**변경 전**:
```tsx
export type CollapsibleSectionProps = {
  title: string;
  // ...
};

<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
```

**변경 후**:
```tsx
export type CollapsibleSectionProps = {
  title: string | React.ReactNode;
  // ...
};

<h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
  {title}
</h3>
```

### 2. Step1BasicInfo 컴포넌트 수정
**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

#### 2.1. Import 변경
- `MessageCircle`을 `HelpCircle`로 변경
- `Dialog` 컴포넌트 import 추가

**변경 전**:
```tsx
import { RefreshCw, Pencil, Plus, MessageCircle } from "lucide-react";
```

**변경 후**:
```tsx
import { RefreshCw, Pencil, Plus, HelpCircle } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
```

#### 2.2. 상태 변수명 변경
- `showBlockSetDesc`를 `showBlockSetDescDialog`로 변경

**변경 전**:
```tsx
const [showBlockSetDesc, setShowBlockSetDesc] = useState(false);
```

**변경 후**:
```tsx
const [showBlockSetDescDialog, setShowBlockSetDescDialog] = useState(false);
```

#### 2.3. 아이콘을 헤더로 이동
- 블록 세트 CollapsibleSection의 `title`에 HelpCircle 아이콘 추가
- 섹션 내부의 아이콘 버튼 제거

**변경 전**:
```tsx
<CollapsibleSection
  title="블록 세트 *"
  // ...
>
  <div className="mb-2 flex items-center justify-between">
    <button
      type="button"
      onClick={() => setShowBlockSetDesc(!showBlockSetDesc)}
      className="flex items-center rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      title="블록 세트 설명"
    >
      <MessageCircle className="h-4 w-4" />
    </button>
    {/* ... */}
  </div>
```

**변경 후**:
```tsx
<CollapsibleSection
  title={
    <>
      블록 세트 *
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowBlockSetDescDialog(true);
        }}
        className="ml-1 inline-flex items-center text-gray-400 hover:text-gray-600"
        title="블록 세트 설명"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </>
  }
  // ...
>
  <div className="mb-2 flex items-center justify-end">
    {/* 아이콘 버튼 제거됨 */}
```

#### 2.4. 토글 형식 설명 제거 및 다이얼로그 추가
- 기존 토글 형식의 설명 표시 제거
- Dialog 컴포넌트를 사용하여 설명을 다이얼로그로 표시

**변경 전**:
```tsx
{/* 블록 세트 설명 */}
{showBlockSetDesc && (
  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
    <h4 className="mb-2 font-semibold text-blue-900">블록 세트란?</h4>
    {/* 설명 내용 */}
  </div>
)}
```

**변경 후**:
```tsx
{/* 블록 세트 설명 다이얼로그 */}
<Dialog
  open={showBlockSetDescDialog}
  onOpenChange={setShowBlockSetDescDialog}
  title="블록 세트란?"
  maxWidth="md"
>
  <div className="space-y-3 text-sm text-gray-700">
    <p>
      블록 세트는{" "}
      <strong>
        고정적인 학습 제외 시간을 제외한 요일별 학습 시작~끝 시간
      </strong>
      을 정의합니다.
    </p>
    <p className="text-xs text-gray-600">
      예를 들어, 평일 오후 3시~6시, 오후 7시~10시와 같이 규칙적인 학습
      시간대를 설정할 수 있습니다.
    </p>
    <p className="text-xs text-gray-600">
      주의: 중간에 학원이나 점심 시간 등이 있는 경우, 이는 이후 입력하는
      항목에서 별도로 수집됩니다.
    </p>
  </div>
</Dialog>
```

## 수정된 파일 목록
1. `app/(student)/plan/new-group/_components/_summary/CollapsibleSection.tsx`
2. `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

## 개선 효과
- **사용성 향상**: 설명 아이콘이 헤더에 있어 더 쉽게 발견 가능
- **시각적 개선**: 물음표 아이콘으로 도움말임을 명확히 표시
- **UI 정리**: 다이얼로그 형식으로 설명이 섹션 내부를 차지하지 않음
- **일관성**: 다른 도움말 아이콘과 일관된 패턴 유지

## 테스트 확인 사항
- [x] 블록 세트 헤더에 HelpCircle 아이콘이 표시되는지 확인
- [x] 아이콘 클릭 시 다이얼로그가 열리는지 확인
- [x] 다이얼로그에 설명 내용이 올바르게 표시되는지 확인
- [x] 다이얼로그 닫기 기능이 정상 작동하는지 확인
- [x] 섹션 내부의 기존 아이콘 버튼이 제거되었는지 확인
- [x] 토글 형식의 설명 표시가 제거되었는지 확인

## 참고 사항
- `CollapsibleSection`의 `title`이 `ReactNode`를 받을 수 있도록 변경하여 다른 섹션에서도 아이콘을 사용할 수 있음
- 아이콘 버튼에 `e.stopPropagation()`을 추가하여 섹션 접기/펼치기와 충돌하지 않도록 처리
- 다이얼로그는 `maxWidth="md"`로 설정하여 적절한 크기로 표시

