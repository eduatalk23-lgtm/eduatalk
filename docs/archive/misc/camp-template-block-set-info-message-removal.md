# 캠프 템플릿 생성 페이지 블록 세트 안내 메시지 제거

## 작업 개요

관리자 페이지의 캠프 템플릿 생성 페이지(`/admin/camp-templates/new`)에서 "블록 세트 설정 안내" 메시지를 제거했습니다.

## 작업 이유

블록 세트 로직이 변경되어 더 이상 해당 안내 메시지가 필요하지 않습니다.

## 변경 사항

### 파일: `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`

**제거된 내용:**
- 블록 세트 설정 안내 섹션 전체 제거
- "템플릿 생성 후 시간 관리 페이지에서 블록 세트를 생성하고 선택할 수 있습니다. 템플릿 생성 시에는 블록 세트 선택을 건너뛸 수 있습니다." 메시지 제거

**변경 전:**
```tsx
{/* 블록 세트 안내 */}
<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0">
      <span className="text-2xl">ℹ️</span>
    </div>
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-blue-900 mb-1">
        블록 세트 설정 안내
      </h3>
      <p className="text-sm text-blue-800">
        템플릿 생성 후 시간 관리 페이지에서 블록 세트를 생성하고 선택할 수 있습니다.
        템플릿 생성 시에는 블록 세트 선택을 건너뛸 수 있습니다.
      </p>
    </div>
  </div>
</div>
```

**변경 후:**
- 해당 섹션 완전 제거

## 영향 범위

- 관리자 페이지의 캠프 템플릿 생성 UI에서 안내 메시지가 더 이상 표시되지 않음
- 기능적 영향 없음 (UI 개선만 수행)

## 작업 일시

2024년 11월

