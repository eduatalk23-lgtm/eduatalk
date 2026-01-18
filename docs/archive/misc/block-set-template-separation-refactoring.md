# 블록 세트 템플릿 분리 및 테넌트 기준 관리 개선

## 개요

블록 세트를 템플릿과 완전히 분리하고, 테넌트 ID 기준으로만 관리하도록 리팩토링했습니다. 템플릿-블록세트 연결은 별도 테이블(`camp_template_block_sets`)로 관리하여 1:N 관계를 지원합니다.

## 주요 변경 사항

### 1. 데이터베이스 마이그레이션

#### 1.1 테이블 이름 변경 및 구조 수정
- `template_block_sets` → `tenant_block_sets`로 테이블 이름 변경
- `template_id` 컬럼 완전 제거
- `template_blocks` → `tenant_blocks`로 테이블 이름 변경
- `template_block_set_id` → `tenant_block_set_id`로 컬럼명 변경

**파일**: `supabase/migrations/20251127013257_refactor_block_sets_to_tenant_based.sql`

#### 1.2 템플릿-블록세트 연결 테이블 생성
- `camp_template_block_sets` 테이블 생성 (1:N 관계)
- 하나의 템플릿은 하나의 블록 세트만 연결 가능 (`camp_template_id UNIQUE`)
- 하나의 블록 세트는 여러 템플릿에서 사용 가능

**파일**: `supabase/migrations/20251127013258_create_camp_template_block_sets.sql`

#### 1.3 기존 데이터 마이그레이션
- `template_data.block_set_id`를 `camp_template_block_sets`로 마이그레이션

**파일**: `supabase/migrations/20251127013259_migrate_template_block_set_links.sql`

### 2. 코드 리팩토링

#### 2.1 액션 파일 변경
- `app/(admin)/actions/templateBlockSets.ts` → `app/(admin)/actions/tenantBlockSets.ts`
- 모든 함수명 변경: `createTemplateBlockSet` → `createTenantBlockSet` 등
- `template_id` 관련 로직 완전 제거
- `getTemplateBlockSets` → `getTenantBlockSets` (templateId 파라미터 제거)

#### 2.2 템플릿-블록세트 연결 액션 추가
**파일**: `app/(admin)/actions/campTemplateBlockSets.ts` (신규)
- `linkBlockSetToTemplate`: 템플릿에 블록 세트 연결 (UPSERT)
- `unlinkBlockSetFromTemplate`: 템플릿에서 블록 세트 연결 해제
- `getTemplateBlockSet`: 특정 템플릿에 연결된 블록 세트 조회
- `getBlockSetTemplates`: 특정 블록 세트를 사용하는 템플릿 목록 조회

#### 2.3 템플릿 편집 페이지 수정
- `getTemplateBlockSets(id)` → `getTenantBlockSets()` (모든 테넌트 블록 세트 조회)
- 템플릿에 연결된 블록 세트는 `getTemplateBlockSet(templateId)`로 별도 조회
- `selectedBlockSetId` prop 추가하여 현재 연결된 블록 세트 표시

#### 2.4 템플릿 저장 로직 수정
- `template_data.block_set_id` 저장 로직 제거
- 템플릿 저장 시 `camp_template_block_sets` 테이블에 연결 정보 저장
- `createCampTemplateAction`, `updateCampTemplateAction` 수정

#### 2.5 Step1BasicInfo 컴포넌트 수정
- `createTemplateBlockSet` → `createTenantBlockSet`
- `getTemplateBlockSets` → `getTenantBlockSets`
- `templateId` 파라미터 제거
- 블록 세트 생성 시 `tenant_id`만 사용

#### 2.6 캠프 참여/제출 관련 페이지 수정
- `app/(student)/camp/[invitationId]/page.tsx`: 연결 테이블에서 블록 세트 조회
- `app/(student)/camp/[invitationId]/submitted/page.tsx`: 연결 테이블 기반 조회
- `app/(student)/actions/campActions.ts`: 연결 테이블에서 블록 세트 조회

#### 2.7 기타 조회 로직 수정
- `app/(student)/actions/plan-groups/queries.ts`: 연결 테이블 기반 조회
- `app/(student)/actions/plan-groups/plans.ts`: 연결 테이블 기반 조회
- `lib/plan/generators/planDataPreparer.ts`: 연결 테이블 기반 조회

#### 2.8 관리 페이지 수정
- `app/(admin)/admin/time-management/global/[setId]/page.tsx`: 테이블 이름 변경 반영
- `app/(admin)/admin/time-management/[templateId]/[setId]/page.tsx`: 연결 테이블 기반 조회

## 테이블 구조 변경 요약

### 변경 전
- `template_block_sets`: `template_id` (NULL 허용)
- `template_blocks`: `template_block_set_id`
- 템플릿: `template_data.block_set_id`에 블록 세트 ID 저장

### 변경 후
- `tenant_block_sets`: `template_id` 컬럼 제거, `tenant_id`만 사용
- `tenant_blocks`: `tenant_block_set_id` (이름 변경)
- `camp_template_block_sets`: 템플릿-블록세트 연결 테이블 (신규)
  - `camp_template_id UNIQUE`: 하나의 템플릿은 하나의 블록 세트만
  - 하나의 블록 세트는 여러 템플릿에서 사용 가능
- 템플릿: `template_data.block_set_id` 제거, 연결 테이블 사용

## 주요 개선 사항

1. **블록 세트는 완전히 독립적**: 템플릿과 무관하게 테넌트별로 관리
2. **템플릿-블록세트 연결**: 별도 테이블로 관리하여 1:N 관계 지원
   - 하나의 블록 세트가 여러 템플릿에서 재사용 가능
   - 하나의 템플릿은 하나의 블록 세트만 연결 가능
3. **기존 데이터 호환성**: 마이그레이션 스크립트로 기존 연결 정보 보존
4. **코드 단순화**: `template_id` 조건 제거로 조회 로직 단순화
5. **블록 세트 재사용성 향상**: 하나의 블록 세트를 여러 템플릿에서 공유 가능

## 하위 호환성

마이그레이션 전 데이터를 위해 `template_data.block_set_id`도 확인하는 로직을 일부 파일에 추가했습니다:
- `app/(student)/camp/[invitationId]/page.tsx`
- `app/(student)/camp/[invitationId]/submitted/page.tsx`
- `app/(student)/actions/campActions.ts`
- `app/(student)/actions/plan-groups/queries.ts`
- `app/(student)/actions/plan-groups/plans.ts`
- `lib/plan/generators/planDataPreparer.ts`

## 영향 범위

- **데이터베이스 마이그레이션**: 3개
- **코드 파일 수정**: 15개 이상
- **기존 템플릿 데이터 마이그레이션**: 자동 처리
- **테이블 이름 변경**: 모든 쿼리 수정 완료

## 테스트 체크리스트

- [ ] 템플릿 편집 시 블록 세트 조회 및 선택
- [ ] 템플릿 저장 시 블록 세트 연결 저장
- [ ] 캠프 참여 시 템플릿 블록 세트 표시
- [ ] 캠프 제출 시 블록 세트 정보 저장
- [ ] 플랜 생성 시 템플릿 블록 사용
- [ ] 블록 세트 관리 페이지 동작 확인

