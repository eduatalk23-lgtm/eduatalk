# 캠프 템플릿 UI 텍스트 색상 개선

## 📋 작업 개요

캠프 템플릿 관련 UI에서 텍스트 색상이 너무 옅어서 가독성이 떨어지는 문제를 개선했습니다.

## 🎨 개선 내용

### 색상 변경 규칙

- `text-gray-400` → `text-gray-600` (더 진하게)
- `text-gray-500` → `text-gray-700` (더 진하게)
- `text-gray-600` → `text-gray-700` 또는 `text-gray-800` (더 진하게)
- `text-gray-700` → `text-gray-800` (제목 등 중요 텍스트)
- `text-blue-600` → `text-blue-800` (더 진하게)
- `text-blue-700` → `text-blue-800` (더 진하게)

## 📝 수정된 파일 목록

### 1. CampTemplateDetail.tsx
**위치**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

**변경 사항**:
- 헤더 라벨: `text-gray-500` → `text-gray-700`
- 프로그램 유형: `text-gray-500` → `text-gray-700`
- 보관 상태 배지: `text-gray-600` → `text-gray-800`
- 템플릿 정보 섹션의 모든 텍스트: `text-gray-600` → `text-gray-700`
- 템플릿 설정 정보 섹션의 모든 텍스트: `text-gray-600` → `text-gray-700`
- 학생 입력 허용 필드 없음 메시지: `text-gray-500` → `text-gray-700`
- 블록 시간 정보: `text-gray-600` → `text-gray-700`
- 삭제 다이얼로그 설명: `text-gray-600` → `text-gray-700`

### 2. TemplateChecklist.tsx
**위치**: `app/(admin)/admin/camp-templates/_components/TemplateChecklist.tsx`

**변경 사항**:
- 완료 카운트: `text-gray-600` → `text-gray-700`
- 카테고리 제목: `text-gray-700` → `text-gray-800`
- 체크리스트 항목 (미완료): `text-gray-600` → `text-gray-700`
- 설명 텍스트: `text-gray-500` → `text-gray-700`

### 3. TemplateFormChecklist.tsx
**위치**: `app/(admin)/admin/camp-templates/_components/TemplateFormChecklist.tsx`

**변경 사항**:
- 완료 카운트: `text-gray-600` → `text-gray-700`
- 체크리스트 항목 (미완료): `text-gray-600` → `text-gray-700`
- 설명 텍스트: `text-gray-500` → `text-gray-700`

### 4. camp/[invitationId]/page.tsx
**위치**: `app/(student)/camp/[invitationId]/page.tsx`

**변경 사항**:
- 헤더 라벨: `text-gray-500` → `text-gray-700`
- 설명 텍스트: `text-gray-500` → `text-gray-700`
- 템플릿 정보 박스의 모든 텍스트: `text-blue-600/700` → `text-blue-800`

### 5. TemplateCard.tsx
**위치**: `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`

**변경 사항**:
- 프로그램 유형: `text-gray-600` → `text-gray-700`
- 설명 텍스트: `text-gray-500` → `text-gray-700`
- 생성일: `text-gray-400` → `text-gray-600`
- 보관 상태 배지: `text-gray-600` → `text-gray-800`
- 삭제 다이얼로그 설명: `text-gray-600` → `text-gray-700`

### 6. CampInvitationList.tsx
**위치**: `app/(admin)/admin/camp-templates/[id]/CampInvitationList.tsx`

**변경 사항**:
- 로딩 메시지: `text-gray-500` → `text-gray-700`
- 빈 상태 메시지: `text-gray-500` → `text-gray-700`
- 통계 라벨: `text-gray-600` → `text-gray-800`
- 선택 카운트: `text-gray-600` → `text-gray-800`
- 테이블 데이터: `text-gray-600` → `text-gray-800`

### 7. StudentInvitationForm.tsx
**위치**: `app/(admin)/admin/camp-templates/[id]/StudentInvitationForm.tsx`

**변경 사항**:
- 로딩 메시지: `text-gray-500` → `text-gray-700`
- 선택 카운트: `text-gray-600` → `text-gray-800`
- 빈 상태 메시지: `text-gray-500` → `text-gray-700`
- 학생 정보 (학년/반): `text-gray-500` → `text-gray-700`

## ✅ 개선 효과

1. **가독성 향상**: 모든 텍스트가 더 진하게 표시되어 읽기 쉬워졌습니다.
2. **일관성**: 전체적으로 일관된 색상 체계를 적용했습니다.
3. **접근성**: WCAG 가이드라인에 더 부합하는 대비율을 확보했습니다.

## 🎯 적용 원칙

- **주요 텍스트**: `text-gray-900` (제목, 중요 정보)
- **일반 텍스트**: `text-gray-700` 또는 `text-gray-800` (본문, 설명)
- **보조 텍스트**: `text-gray-600` (날짜, 메타 정보)
- **색상 강조**: `text-blue-800` (블루 계열 강조 텍스트)

## 📅 작업 일시

2025년 1월







