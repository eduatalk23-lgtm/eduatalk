# 캠프 참여 페이지 중복 정보 제거

**날짜**: 2025년 12월 2일  
**작업 유형**: UI 개선

---

## 🎯 작업 목표

캠프 참여 페이지(`/camp/[invitationId]`)에서 중복된 "캠프 프로그램" 정보 제거

---

## 🔍 문제 상황

캠프 참여 페이지에서 다음과 같은 중복이 발생했습니다:

1. **상단 헤더 영역** (366번째 줄)
   - `<p className="text-sm font-medium text-gray-700">캠프 프로그램</p>`

2. **페이지 상단의 캠프 프로그램 정보 섹션** (384-391번째 줄)
   - `<h3 className="font-semibold text-blue-900">캠프 프로그램 정보</h3>`
   - 템플릿 이름, 프로그램 타입, 설명 등 상세 정보 표시

3. **Step1BasicInfo 컴포넌트 내부의 캠프 프로그램 섹션** (888-897번째 줄)
   - `<h3 className="font-semibold text-blue-800">캠프 프로그램</h3>`
   - 템플릿 이름, 프로그램 타입 표시

페이지 상단의 "캠프 프로그램 정보" 섹션이 Step1BasicInfo 컴포넌트 내부의 "캠프 프로그램" 섹션과 중복되어 불필요했습니다.

---

## ✅ 해결 방법

1. **상단 헤더 영역의 중복된 "캠프 프로그램" 텍스트 제거** (1차 수정)
2. **페이지 상단의 "캠프 프로그램 정보" 섹션 전체 제거** (2차 수정)
3. **Step1BasicInfo 컴포넌트 내부의 "캠프 프로그램" 섹션 제거** (3차 수정)
   - 사용자 요청에 따라 모든 중복 섹션 제거

### 1차 변경 (상단 헤더 텍스트 제거)

**변경 전:**
```tsx
<div className="flex-1">
  <p className="text-sm font-medium text-gray-700">캠프 프로그램</p>
  <h1 className="text-3xl font-semibold text-gray-900">
    {template.name} 참여하기
  </h1>
  {/* ... */}
</div>
```

**변경 후:**
```tsx
<div className="flex-1">
  <h1 className="text-3xl font-semibold text-gray-900">
    {template.name} 참여하기
  </h1>
  {/* ... */}
</div>
```

### 2차 변경 (페이지 상단 섹션 제거)

**변경 전:**
```tsx
      </div>

      {/* 템플릿 정보 표시 */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900">캠프 프로그램 정보</h3>
        <p className="text-sm text-blue-800">{template.name}</p>
        <p className="text-xs text-blue-800">{template.program_type}</p>
        {template.description && (
          <p className="mt-2 text-sm text-blue-800">{template.description}</p>
        )}
      </div>

      <PlanGroupWizard
```

**변경 후:**
```tsx
      </div>

      <PlanGroupWizard
```

### 3차 변경 (Step1BasicInfo 내부 섹션 제거)

**변경 전:**
```tsx
      </div>

      {/* 캠프 템플릿 정보 표시 */}
      {campTemplateInfo && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-800">캠프 프로그램</h3>
          <p className="text-sm text-blue-800">{campTemplateInfo.name}</p>
          <p className="text-xs text-blue-800">
            {campTemplateInfo.program_type}
          </p>
        </div>
      )}

      {/* 플랜/캠프 이름 (필수) */}
```

**변경 후:**
```tsx
      </div>

      {/* 플랜/캠프 이름 (필수) */}
```

---

## 📝 수정 파일

- `app/(student)/camp/[invitationId]/page.tsx`
  - 366번째 줄: 상단 헤더의 중복된 "캠프 프로그램" 텍스트 제거
  - 383-391번째 줄: 페이지 상단의 "캠프 프로그램 정보" 섹션 전체 제거

- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
  - 888-897번째 줄: Step1BasicInfo 컴포넌트 내부의 "캠프 프로그램" 섹션 제거

---

## ✨ 개선 효과

- 모든 중복된 "캠프 프로그램" 정보 섹션 제거로 UI 간결성 대폭 향상
- 불필요한 정보 반복 제거로 사용자 경험 개선
- 페이지 구조가 더 깔끔하고 직관적으로 개선됨

---

## 🔗 관련 이슈

- 캠프 참여 페이지 UI 개선

