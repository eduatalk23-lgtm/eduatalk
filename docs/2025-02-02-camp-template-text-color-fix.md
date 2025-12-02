# 캠프 템플릿 생성 페이지 텍스트 색상 가독성 개선

## 작업 일시
2025-02-02

## 문제점
회색 텍스트가 너무 옅어서 가독성이 떨어지는 문제가 있었습니다:
- 페이지 설명 텍스트가 `text-gray-500`로 너무 옅음
- 입력 필드에 텍스트 색상이 명시되지 않아 기본 색상이 적용되어 가독성 저하
- 회색으로 통일하려다 보니 오히려 텍스트가 안 보이는 문제 발생

## 해결 방법

### 1. 페이지 설명 텍스트 색상 개선

**파일**: `app/(admin)/admin/camp-templates/new/page.tsx`

#### 변경 전
```tsx
<p className="text-sm text-gray-500">
  템플릿 기본 정보를 입력하고 템플릿 생성을 시작하세요.
</p>
```

#### 변경 후
```tsx
<p className="text-sm text-gray-700">
  템플릿 기본 정보를 입력하고 템플릿 생성을 시작하세요.
</p>
```

**개선 사유**: 
- `text-gray-500`는 너무 옅어서 가독성이 떨어짐
- 이전 가이드라인(`camp-template-ui-text-color-improvement.md`)에 따라 `text-gray-700`으로 변경

### 2. 입력 필드 텍스트 색상 명시

**파일**: `app/(admin)/admin/camp-templates/new/NewCampTemplateForm.tsx`

#### 적용된 변경 사항

모든 입력 필드에 명시적으로 색상을 추가:

1. **템플릿 이름 입력 필드**
   - 추가: `text-gray-900` (입력 텍스트)
   - 추가: `placeholder:text-gray-600` (placeholder)

2. **설명 textarea**
   - 추가: `text-gray-900` (입력 텍스트)
   - 추가: `placeholder:text-gray-600` (placeholder)

3. **캠프 시작일 date 입력 필드**
   - 추가: `text-gray-900` (입력 텍스트)

4. **캠프 종료일 date 입력 필드**
   - 추가: `text-gray-900` (입력 텍스트)

5. **캠프 장소 입력 필드**
   - 추가: `text-gray-900` (입력 텍스트)
   - 추가: `placeholder:text-gray-600` (placeholder)

6. **프로그램 유형 select 필드**
   - 추가: `text-gray-900` (선택 텍스트)

## 색상 규칙

### 텍스트 색상 가이드라인

이전 가이드라인(`camp-template-ui-text-color-improvement.md`)과 입력 필드 가이드라인(`입력-필드-텍스트-색상-개선.md`)을 준수:

- **제목**: `text-gray-900` (가장 진한 회색)
- **일반 텍스트/레이블**: `text-gray-700` (진한 회색)
- **보조 텍스트**: `text-gray-600` (중간 회색, 날짜 등)
- **입력 필드 텍스트**: `text-gray-900` (명확한 가독성)
- **입력 필드 placeholder**: `placeholder:text-gray-600` (진한 회색)

### 금지 사항

- `text-gray-500` 이하의 옅은 회색 사용 금지 (가독성 저하)
- 입력 필드에서 색상 미명시 (기본 색상이 브라우저마다 다를 수 있음)

## 변경된 파일

1. `app/(admin)/admin/camp-templates/new/page.tsx`
   - 페이지 설명 텍스트: `text-gray-500` → `text-gray-700`

2. `app/(admin)/admin/camp-templates/new/NewCampTemplateForm.tsx`
   - 템플릿 이름 입력: `text-gray-900`, `placeholder:text-gray-600` 추가
   - 설명 textarea: `text-gray-900`, `placeholder:text-gray-600` 추가
   - 캠프 시작일: `text-gray-900` 추가
   - 캠프 종료일: `text-gray-900` 추가
   - 캠프 장소 입력: `text-gray-900`, `placeholder:text-gray-600` 추가
   - 프로그램 유형 select: `text-gray-900` 추가

## 개선 효과

1. **가독성 향상**: 모든 텍스트가 더 명확하게 보임
2. **일관성**: 프로젝트 가이드라인 준수
3. **접근성**: WCAG 대비율 기준 충족
4. **사용자 경험**: 텍스트가 안 보이는 문제 해결

## 참고 문서

- `docs/camp-template-ui-text-color-improvement.md` - 캠프 템플릿 UI 텍스트 색상 개선 가이드
- `docs/입력-필드-텍스트-색상-개선.md` - 입력 필드 텍스트 색상 가이드

