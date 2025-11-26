# 캠프 템플릿 시간 관리 기능 구현

## 작업 개요

캠프 템플릿 관리자 페이지에 시간 관리 메뉴를 추가하고, 블록 세트 관리 기능을 구현했습니다. 기존 기본값 자동 생성 로직을 제거하고 명시적 선택 방식으로 변경했습니다.

## 주요 변경 사항

### 1. 시간 관리 페이지 추가

**파일**: `app/(admin)/admin/camp-templates/[id]/time-management/page.tsx`

- 템플릿별 시간 관리 전용 페이지 생성
- 템플릿 블록 세트 목록 조회 및 표시
- 학생 블록 관리 페이지(`app/(student)/blocks/page.tsx`) 구조 참고

**컴포넌트 구조**:
- `TemplateBlockSetManagement.tsx` - 블록 세트 관리 메인 컴포넌트
- `TemplateBlocksViewer.tsx` - 블록 세트 목록 표시 및 생성
- `TemplateBlockForm.tsx` - 블록 추가 폼
- `TemplateBlockSetDetail.tsx` - 블록 세트 상세 페이지

### 2. 템플릿 블록 세트 관리 기능

**주요 기능**:
- 블록 세트 생성/수정/삭제
- 블록 추가/삭제
- 블록 세트를 템플릿에 연결 (선택하기 버튼)
- 블록 세트 상세 보기

**액션 함수 활용**:
- `createTemplateBlockSet` - 블록 세트 생성
- `updateTemplateBlockSet` - 블록 세트 수정
- `deleteTemplateBlockSet` - 블록 세트 삭제
- `addTemplateBlock` - 블록 추가
- `deleteTemplateBlock` - 블록 삭제
- `getTemplateBlockSets` - 블록 세트 목록 조회

### 3. 템플릿 생성 폼 개선

**파일**: `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`

- 템플릿 생성 시 블록 세트 선택 안내 메시지 추가
- 템플릿 생성 후 시간 관리 페이지로 자동 리다이렉트
- 템플릿 생성 시에는 블록 세트 선택을 건너뛸 수 있음 (생성 후 시간 관리 페이지에서 설정)

### 4. 기본값 자동 생성 로직 제거

**파일**: `app/(admin)/actions/campTemplateActions.ts`

- `createCampTemplateAction`의 기본 블록 세트 자동 생성 로직 제거 (408-497줄)
- 템플릿 생성 시 블록 세트가 없어도 생성 가능
- 템플릿 생성 후 시간 관리 페이지에서 블록 세트를 생성하도록 변경

### 5. 템플릿 상세 페이지 개선

**파일**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

- "시간 관리" 버튼 추가 (참여자 목록 버튼 옆)
- 블록 세트 정보 표시 개선

**파일**: `app/(admin)/admin/camp-templates/[id]/page.tsx`

- 템플릿 블록 세트 조회 로직 개선
- `template_data.block_set_id` 확인
- `tenant_id` 검증 추가
- 에러 처리 개선

### 6. 제출 후 상세페이지 조회 로직 재작성

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

- 기본값 블록 사용 로직 제거 (366-397줄)
- `getDefaultBlocks`, `DEFAULT_BLOCK_SET_NAME` import 제거
- 템플릿 블록 세트가 없으면 블록이 표시되지 않음 (에러 표시 없음)
- 조회 우선순위: `scheduler_options.template_block_set_id` → `template_data.block_set_id`

**파일**: `app/(student)/plan/group/[id]/page.tsx`

- 기본값 블록 사용 로직 제거 (294-327줄)
- `getDefaultBlocks`, `DEFAULT_BLOCK_SET_NAME` import 제거
- 동일한 조회 로직 적용

## 데이터 흐름

### 템플릿 생성 및 블록 세트 연결

1. 템플릿 생성 시
   - `template_data.block_set_id`는 선택 사항 (없을 수 있음)
   - 템플릿 생성 후 시간 관리 페이지로 리다이렉트

2. 시간 관리 페이지에서
   - 블록 세트 생성
   - 블록 세트 선택하기 버튼으로 템플릿에 연결
   - `template_data.block_set_id`에 선택한 블록 세트 ID 저장

3. 학생 제출 시
   - `scheduler_options.template_block_set_id`에 저장 (학생이 선택한 블록 세트)
   - 템플릿 원본은 `template_data.block_set_id`에 유지

### 조회 우선순위

1. **학생 제출 상세페이지**:
   - `scheduler_options.template_block_set_id` (우선) - 학생이 선택한 블록 세트
   - `template_data.block_set_id` (fallback) - 템플릿 원본 블록 세트

2. **템플릿 상세페이지**:
   - `template_data.block_set_id` - 템플릿에 연결된 블록 세트

## 유지 사항

- 학생 입력 허용 로직 (`templateLockedFields`) 유지
- 기존 템플릿 블록 세트 액션 함수 유지
- 템플릿 수정 기능 유지

## 개선 사항

1. **명시적 블록 세트 관리**
   - 기본값 자동 생성 제거로 관리자가 명시적으로 블록 세트를 생성하고 선택
   - 템플릿별로 여러 블록 세트를 생성하고 선택할 수 있음

2. **사용자 경험 개선**
   - 템플릿 생성 후 시간 관리 페이지로 자동 이동하여 블록 세트 생성 유도
   - 블록 세트 선택 상태를 시각적으로 표시 (선택됨 배지)
   - 블록 세트를 템플릿에 연결하는 간단한 버튼 제공

3. **에러 처리 개선**
   - 기본값 블록 사용 로직 제거로 데이터 일관성 향상
   - 템플릿 블록 세트가 없으면 명확하게 표시되지 않음

## 관련 파일

### 새로 생성된 파일
- `app/(admin)/admin/camp-templates/[id]/time-management/page.tsx`
- `app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlockSetManagement.tsx`
- `app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlocksViewer.tsx`
- `app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlockForm.tsx`
- `app/(admin)/admin/camp-templates/[id]/time-management/[setId]/page.tsx`
- `app/(admin)/admin/camp-templates/[id]/time-management/[setId]/_components/TemplateBlockSetDetail.tsx`

### 수정된 파일
- `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
- `app/(admin)/actions/campTemplateActions.ts`
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `app/(admin)/admin/camp-templates/[id]/page.tsx`
- `app/(student)/camp/[invitationId]/submitted/page.tsx`
- `app/(student)/plan/group/[id]/page.tsx`

