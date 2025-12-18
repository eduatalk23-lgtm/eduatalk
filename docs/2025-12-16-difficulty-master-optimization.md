# 난이도 마스터 데이터 관리 최적화 및 폼 일관성 개선

**작업 일자**: 2025-12-16  
**작업 범위**: Phase 0-8 전체 구현

## 개요

난이도 필드가 텍스트로 직접 저장되어 데이터 무결성 문제와 관리 어려움이 있었습니다. 이를 해결하기 위해 난이도 마스터 테이블을 생성하고, 모든 폼에서 일관된 컴포넌트를 사용하도록 개선했습니다.

## 구현 내용

### Phase 0: 난이도 마스터 테이블 생성 및 마이그레이션

#### 생성된 마이그레이션 파일

1. **20251216222517_create_difficulty_levels.sql**
   - `difficulty_levels` 테이블 생성
   - 콘텐츠 타입별 난이도 관리 (`book`, `lecture`, `custom`, `common`)
   - 초기 데이터 삽입 (개념/기본/심화, 상/중/하)
   - RLS 정책 설정

2. **20251216222518_migrate_existing_difficulties.sql**
   - 기존 콘텐츠 테이블에 `difficulty_level_id` 컬럼 추가
   - 기존 텍스트 값을 FK로 변환
   - `difficulty_level` 필드는 deprecated 처리 (하위 호환성 유지)

3. **20251216222519_add_difficulty_fk_constraints.sql**
   - 외래키 제약조건 추가
   - `ON DELETE SET NULL` 정책 적용

### Phase 1: 난이도 마스터 데이터 CRUD 구현

#### 생성된 파일

- **lib/data/difficultyLevels.ts**: 데이터 레이어
  - `getDifficultyLevels(contentType?)`: 난이도 목록 조회
  - `getDifficultyLevelById(id)`: ID로 난이도 조회
  - `createDifficultyLevel(data)`: 난이도 생성
  - `updateDifficultyLevel(id, updates)`: 난이도 수정
  - `deleteDifficultyLevel(id)`: 난이도 삭제 (사용 중인 경우 체크)

- **app/(admin)/actions/difficultyLevelActions.ts**: Server Actions
  - `getDifficultyLevelsAction`
  - `createDifficultyLevelAction`
  - `updateDifficultyLevelAction`
  - `deleteDifficultyLevelAction`

- **app/api/difficulty-levels/route.ts**: API 엔드포인트
  - GET `/api/difficulty-levels?contentType=book`

### Phase 2: 난이도 관리자 페이지 생성

#### 생성된 파일

- **app/(admin)/admin/content-metadata/_components/DifficultyLevelsManager.tsx**
  - 난이도 목록 표시 (콘텐츠 타입별 필터)
  - 난이도 생성/수정/삭제
  - 표시 순서 조정
  - 활성화/비활성화 토글

- **app/(admin)/admin/content-metadata/_components/ContentMetadataTabs.tsx** (수정)
  - 난이도 관리 탭 추가

### Phase 3: 공통 컴포넌트 생성

#### 생성된 파일

- **components/forms/DifficultySelectField.tsx**
  - 콘텐츠 타입별 난이도 옵션 동적 로드
  - FormSelect 래퍼로 일관된 UI 제공

- **lib/hooks/useDifficultyOptions.ts**
  - 콘텐츠 타입별 난이도 옵션 조회
  - 캐싱 및 로딩 상태 관리
  - 에러 처리

### Phase 4: MasterLectureForm 통일

#### 수정된 파일

- **app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx**
  - `SubjectSelectionFields` 컴포넌트 적용
  - `useSubjectSelection` 훅 사용
  - 직접 구현된 과목 선택 로직 제거

### Phase 5: 난이도 필드 마이그레이션 및 적용

#### 수정된 파일

- **app/(admin)/admin/master-books/new/MasterBookForm.tsx**
  - `DifficultySelectField` 적용 (contentType='book')

- **app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx**
  - `DifficultySelectField` 적용

- **app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx**
  - `DifficultySelectField` 적용 (contentType='lecture')
  - 연결된 교재 등록 시에도 적용

- **app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx**
  - `DifficultySelectField` 적용
  - `SubjectSelectionFields` 적용

- **app/(admin)/admin/master-custom-contents/new/MasterCustomContentForm.tsx**
  - `DifficultySelectField` 적용 (contentType='custom')

### Phase 6: 데이터 레이어 업데이트

#### 수정된 파일

- **lib/utils/masterContentFormHelpers.ts**
  - `parseMasterBookFormData`: `difficulty_level_id` 지원 추가
  - `parseMasterBookUpdateFormData`: `difficulty_level_id` 지원 추가
  - `parseMasterLectureFormData`: `difficulty_level_id` 지원 추가
  - `parseMasterLectureUpdateFormData`: `difficulty_level_id` 지원 추가
  - `parseMasterCustomContentFormData`: `difficulty_level_id` 지원 추가
  - `parseMasterCustomContentUpdateFormData`: `difficulty_level_id` 지원 추가

- **lib/data/contentMasters.ts**
  - `createMasterBook`: `difficulty_level_id` 필드 추가
  - `updateMasterBook`: `difficulty_level_id` 필드 업데이트 지원
  - `createMasterLecture`: `difficulty_level_id` 필드 추가
  - `updateMasterLecture`: `difficulty_level_id` 필드 업데이트 지원

## 주요 개선 사항

### 1. 데이터 무결성 향상
- 외래키 제약조건으로 데이터 일관성 보장
- 난이도 삭제 시 자동으로 NULL 처리 (ON DELETE SET NULL)

### 2. 관리 편의성 개선
- 관리자 페이지에서 난이도 중앙 관리 가능
- 콘텐츠 타입별 난이도 분리 관리

### 3. 코드 중복 감소
- 모든 폼에서 동일한 `DifficultySelectField` 컴포넌트 사용
- `MasterLectureForm`에 `SubjectSelectionFields` 적용으로 과목 선택 로직 통일

### 4. 하위 호환성 유지
- 기존 `difficulty_level` 필드 유지 (deprecated 처리)
- 마이그레이션 시 기존 데이터 자동 변환

## 데이터베이스 스키마

### difficulty_levels 테이블

```sql
CREATE TABLE difficulty_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  content_type varchar(20) NOT NULL CHECK (content_type IN ('book', 'lecture', 'custom', 'common')),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, content_type)
);
```

### 외래키 관계

- `master_books.difficulty_level_id` → `difficulty_levels.id`
- `master_lectures.difficulty_level_id` → `difficulty_levels.id`
- `master_custom_contents.difficulty_level_id` → `difficulty_levels.id`

## 사용 방법

### DifficultySelectField 컴포넌트 사용

```tsx
<DifficultySelectField
  contentType="book" // 'book' | 'lecture' | 'custom'
  defaultValue={book.difficulty_level_id}
  name="difficulty_level_id"
  label="난이도"
  required={false}
/>
```

### useDifficultyOptions 훅 사용

```tsx
const { options, loading, error } = useDifficultyOptions({
  contentType: "book",
});
```

## 다음 단계

1. 마이그레이션 실행 후 데이터 검증
2. 기존 `difficulty_level` 필드 제거 (선택사항)
3. 타입 정의 업데이트 (`difficulty_level_id` 필드 추가)

## 참고 파일

- 마이그레이션: `supabase/migrations/20251216222517_*.sql`
- 데이터 레이어: `lib/data/difficultyLevels.ts`
- 컴포넌트: `components/forms/DifficultySelectField.tsx`
- 관리자 페이지: `app/(admin)/admin/content-metadata/_components/DifficultyLevelsManager.tsx`




