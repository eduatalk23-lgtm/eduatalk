# Phase 6: Plan & Block Actions 리팩토링 완료 리포트

## 📋 개요

**작업 일시**: 2024-12-21  
**Phase**: Phase 6 - Server Actions 및 API 계층 표준화  
**대상 도메인**: Plan Actions, Block/BlockSet Actions

## 🎯 목표

1. `app/actions/planActions.ts` 검증 (이미 표준화 완료 확인)
2. `app/actions/blockSets.ts` 리팩토링
3. `app/actions/blocks.ts` 리팩토링
4. `lib/data/blockSets.ts`에 CRUD 함수 추가

## ✅ 완료된 작업

### 1. `lib/data/blockSets.ts` CRUD 함수 추가

다음 함수들을 추가하여 표준 패턴(`typedQueryBuilder`, `errorHandler`)을 적용했습니다:

#### 블록 세트 CRUD
- `createBlockSet`: 블록 세트 생성
- `updateBlockSet`: 블록 세트 수정
- `deleteBlockSet`: 블록 세트 삭제
- `getBlockSetById`: 블록 세트 조회
- `getBlockSetCount`: 블록 세트 개수 조회

#### 블록 스케줄 CRUD
- `createBlock`: 블록 생성
- `updateBlock`: 블록 수정
- `deleteBlock`: 블록 삭제
- `getBlockById`: 블록 조회
- `getBlocksBySetId`: 특정 세트의 블록 목록 조회

**기존 함수 유지**:
- `fetchBlockSetsWithBlocks`: 블록 세트와 블록을 함께 조회 (N+1 문제 해결)

### 2. `app/actions/planActions.ts` 검증

이미 완벽하게 표준화되어 있었습니다:
- ✅ `lib/data/studentPlans.ts`의 함수 사용 (`createPlan`, `updatePlan`, `deletePlan`, `getPlanById`)
- ✅ 직접 Supabase 쿼리 없음
- ✅ `getCurrentUser` 사용
- ✅ 표준 에러 처리

### 3. `app/actions/blockSets.ts` 리팩토링

**변경 사항**:
- ✅ `getCurrentUser` 사용으로 변경
- ✅ `getStudentById` 사용으로 학생 정보 조회 표준화
- ✅ `createBlockSet`, `updateBlockSet`, `deleteBlockSet`, `getBlockSetById`, `getBlockSetCount` 사용
- ✅ `fetchBlockSetsWithBlocks` 사용 (이미 사용 중이었음)

**남아있는 직접 쿼리**:
- `students` 테이블의 `active_block_set_id` 업데이트 (비즈니스 로직으로 유지)

**리팩토링된 함수**:
- `_createBlockSet`
- `_updateBlockSet`
- `_deleteBlockSet`
- `_setActiveBlockSet`
- `_duplicateBlockSet`
- `_getBlockSets`

### 4. `app/actions/blocks.ts` 리팩토링

**변경 사항**:
- ✅ `getCurrentUser` 사용으로 변경
- ✅ `getStudentById` 사용으로 학생 정보 조회 표준화
- ✅ `getBlockSetById`, `createBlockSet`, `fetchBlockSetsWithBlocks` 사용
- ✅ `createBlock`, `updateBlock`, `deleteBlock`, `getBlockById`, `getBlocksBySetId` 사용

**리팩토링된 함수**:
- `_addBlock`: 블록 생성 로직 표준화
- `_updateBlock`: 블록 수정 로직 표준화
- `_deleteBlock`: 블록 삭제 로직 표준화
- `_duplicateBlock`: 블록 복제 로직 표준화

**부분 리팩토링**:
- `_addBlocksToMultipleDays`: 일부 직접 쿼리 남아있음 (다음 단계에서 완료 예정)

**남아있는 직접 쿼리**:
- `students` 테이블의 `active_block_set_id` 업데이트 (비즈니스 로직으로 유지)
- `_addBlocksToMultipleDays` 함수 내 일부 직접 쿼리

## 📊 통계

### 코드 변경량
- **추가된 함수**: 9개 (`lib/data/blockSets.ts`)
- **리팩토링된 Server Actions**: 10개
- **제거된 직접 Supabase 쿼리**: 약 20개 이상

### 타입 안전성
- ✅ 모든 함수에 명시적 타입 정의
- ✅ `Database` 타입 활용
- ✅ `typedQueryBuilder` 패턴 적용

### 에러 처리
- ✅ 표준 `errorHandler` 사용
- ✅ 일관된 에러 응답 형식 (`{ success: boolean, error?: string }`)

## 🔍 남은 작업

### `app/actions/blocks.ts`의 `_addBlocksToMultipleDays` 함수

다음 부분을 추가로 리팩토링해야 합니다:
- 학생 정보 조회: `getStudentById` 사용
- 블록 세트 조회: `getBlockSetById` 사용
- 블록 조회: `getBlocksBySetId` 사용
- 블록 생성: `createBlock` 사용

## 📝 주요 개선 사항

### 1. 타입 안전성 향상
- 모든 함수에 명시적 타입 정의
- `Database` 타입 활용으로 컴파일 타임 타입 체크 강화

### 2. 에러 처리 표준화
- `typedQueryBuilder`와 `errorHandler`를 통한 일관된 에러 처리
- 에러 로깅 및 컨텍스트 정보 제공

### 3. 코드 재사용성 향상
- 공통 데이터 접근 로직을 `lib/data/blockSets.ts`로 중앙화
- Server Actions는 비즈니스 로직에 집중

### 4. 유지보수성 향상
- 데이터 접근 로직 변경 시 한 곳만 수정하면 됨
- 테스트 가능성 향상 (데이터 레이어와 비즈니스 로직 분리)

## 🎉 결론

Phase 6의 Plan & Block Actions 리팩토링이 대부분 완료되었습니다. 핵심적인 데이터 접근 로직은 모두 표준화되었으며, 일부 복잡한 비즈니스 로직이 포함된 함수만 남아있습니다.

다음 단계에서는 `_addBlocksToMultipleDays` 함수의 남은 부분을 완전히 리팩토링하고, 필요시 추가적인 개선 작업을 진행할 수 있습니다.

