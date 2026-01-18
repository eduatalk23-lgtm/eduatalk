# 관리자 시간 관리 메뉴 - 템플릿 독립적 시간 블록 생성 기능

## 작업 개요

관리자 페이지의 시간 관리 메뉴에서 템플릿을 생성하지 않아도 시간 블록을 생성할 수 있도록 변경했습니다. 학생 페이지 시간 관리 메뉴를 참고하여 동일한 구조로 구현했습니다.

## 주요 변경 사항

### 1. 템플릿 블록 세트 액션 함수 수정

**파일**: `app/(admin)/actions/templateBlockSets.ts`

- `_createTemplateBlockSet`: `template_id`를 선택적으로 변경
  - `template_id`가 제공되지 않으면 `null`로 저장
  - 템플릿이 없는 경우에도 블록 세트 생성 가능
- `_getTemplateBlockSets`: `templateId` 파라미터를 `string | null`로 변경
  - `null`인 경우 템플릿에 연결되지 않은 블록 세트만 조회
- `_getAllTemplateBlockSets`: 새로운 함수 추가
  - 템플릿에 연결된/연결되지 않은 모든 블록 세트 조회
- 모든 revalidatePath에 `/admin/time-management` 추가

### 2. 관리자 시간 관리 메인 페이지 변경

**파일**: `app/(admin)/admin/time-management/page.tsx`

- 템플릿 목록 표시 제거
- 학생 페이지(`/blocks`)와 동일한 구조로 변경
- 템플릿 없이도 시간 블록 생성 가능
- `getAllTemplateBlockSets`를 사용하여 모든 블록 세트 조회

### 3. 템플릿 블록 세트 관리 컴포넌트 생성

**파일**: `app/(admin)/admin/time-management/_components/TemplateBlockSetManagement.tsx`

- 학생 페이지의 `BlockSetManagement`를 참고하여 생성
- 템플릿 ID 없이도 동작하도록 구현
- `templateId={null}`로 `TemplateBlocksViewer`에 전달

### 4. TemplateBlocksViewer 컴포넌트 수정

**파일**: `app/(admin)/admin/time-management/[templateId]/_components/TemplateBlocksViewer.tsx`

- `templateId` 타입을 `string | null`로 변경
- 템플릿이 없는 경우 "선택하기" 버튼 숨김
- 상세 보기 링크를 템플릿 유무에 따라 분기 처리
  - 템플릿 있음: `/admin/time-management/${templateId}/${setId}`
  - 템플릿 없음: `/admin/time-management/global/${setId}`

### 5. 템플릿 없는 블록 세트 상세 페이지 생성

**파일**: `app/(admin)/admin/time-management/global/[setId]/page.tsx`

- 템플릿에 연결되지 않은 블록 세트의 상세 페이지
- `template_id`가 `null`인 블록 세트만 조회
- `TemplateBlockSetDetail` 컴포넌트 재사용

### 6. TemplateBlockSetDetail 컴포넌트 수정

**파일**: `app/(admin)/admin/time-management/[templateId]/[setId]/_components/TemplateBlockSetDetail.tsx`

- `templateId` 타입을 `string | null`로 변경
- 삭제 후 리다이렉트 경로를 템플릿 유무에 따라 분기 처리
  - 템플릿 있음: `/admin/time-management/${templateId}`
  - 템플릿 없음: `/admin/time-management`

## 데이터베이스 스키마

`template_block_sets` 테이블의 `template_id` 컬럼이 `NULL`을 허용해야 합니다. 기존 스키마가 이미 `NULL`을 허용하는 경우 추가 마이그레이션은 필요하지 않습니다.

## 사용자 경험 개선

### 이전
1. 템플릿 생성 필요
2. 템플릿 선택
3. 시간 블록 생성

### 변경 후
1. 시간 블록 직접 생성 가능 (템플릿 생성 불필요)
2. 템플릿 생성 후 기존 블록 세트 연결 가능

## 관련 파일

- `app/(admin)/actions/templateBlockSets.ts` - 액션 함수
- `app/(admin)/admin/time-management/page.tsx` - 메인 페이지
- `app/(admin)/admin/time-management/_components/TemplateBlockSetManagement.tsx` - 관리 컴포넌트
- `app/(admin)/admin/time-management/[templateId]/_components/TemplateBlocksViewer.tsx` - 뷰어 컴포넌트
- `app/(admin)/admin/time-management/[templateId]/[setId]/_components/TemplateBlockSetDetail.tsx` - 상세 컴포넌트
- `app/(admin)/admin/time-management/global/[setId]/page.tsx` - 템플릿 없는 상세 페이지

## 참고

- 학생 페이지 시간 관리: `app/(student)/blocks/page.tsx`
- 학생 페이지 블록 관리 컴포넌트: `app/(student)/blocks/_components/BlockSetManagement.tsx`

