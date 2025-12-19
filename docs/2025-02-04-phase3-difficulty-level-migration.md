# Phase 3: difficulty_level → difficulty_level_id 마이그레이션

## 📋 개요

`difficulty_level` 텍스트 필드를 `difficulty_level_id` UUID Foreign Key로 마이그레이션하여 데이터 정규화 및 일관성 향상.

## 🎯 목표

1. 데이터베이스 스키마 확장 (Phase 3-1)
2. 마스터 콘텐츠 쿼리 개선 (Phase 3-2)
3. 학생 콘텐츠 쿼리 개선 (Phase 3-3)
4. UI 컴포넌트 타입 개선 (Phase 3-4) - 예정
5. API 응답 개선 (Phase 3-5) - 예정
6. Deprecated 표시 및 문서화 (Phase 3-6) - 예정

---

## ✅ Phase 3-1: 데이터베이스 스키마 확장

### 작업 내용

**마이그레이션 파일**: `supabase/migrations/20250204120000_add_difficulty_level_id_to_student_tables.sql`

1. **컬럼 추가**
   - `books.difficulty_level_id` (uuid, nullable)
   - `lectures.difficulty_level_id` (uuid, nullable)
   - `student_custom_contents.difficulty_level_id` (uuid, nullable)

2. **Foreign Key 제약조건 추가**
   - `books.difficulty_level_id` → `difficulty_levels.id`
   - `lectures.difficulty_level_id` → `difficulty_levels.id`
   - `student_custom_contents.difficulty_level_id` → `difficulty_levels.id`

3. **인덱스 추가**
   - `idx_books_difficulty_level_id`
   - `idx_lectures_difficulty_level_id`
   - `idx_student_custom_contents_difficulty_level_id`

4. **기존 데이터 마이그레이션**
   - `difficulty_level` 문자열 값을 `difficulty_level_id`로 자동 변환
   - `content_type`별 매칭 (book, lecture, custom)

5. **Deprecated 주석 추가**
   - `difficulty_level` 컬럼에 deprecated 주석 추가

### 결과

- ✅ 학생 테이블에 `difficulty_level_id` 컬럼 추가 완료
- ✅ Foreign Key 제약조건 및 인덱스 생성 완료
- ✅ 기존 데이터 자동 마이그레이션 완료

---

## ✅ Phase 3-2: 마스터 콘텐츠 쿼리 개선

### 작업 내용

**파일**: `lib/plan/contentResolver.ts`

1. **마스터 콘텐츠 조회 개선**
   - `master_books` 조회 시 `difficulty_level_id` 포함
   - 학생 콘텐츠 조회 시 `difficulty_level_id` 포함

2. **변환 로직 추가**
   - `difficulty_level_id` → `difficulty_level` 변환 (배치 조회)
   - `difficulty_levels` 테이블에서 `name` 조회
   - 하위 호환성 유지 (기존 `difficulty_level` fallback)

3. **타입 정의 개선**
   - `MasterBookResult` 타입에 `difficulty_level_id` 추가
   - `BookDurationResult` 타입에 `difficulty_level_id` 추가

### 개선 효과

- ✅ `difficulty_level_id` 우선 사용
- ✅ N+1 쿼리 방지 (배치 조회)
- ✅ 하위 호환성 유지

---

## ✅ Phase 3-3: 학생 콘텐츠 쿼리 개선

### 작업 내용

**파일**: `lib/utils/difficultyLevelConverter.ts` (신규 생성)

1. **변환 헬퍼 함수 생성**
   - `convertDifficultyLevelToId`: 단일 변환 함수
   - `convertDifficultyLevelsToIds`: 배치 변환 함수

**파일**: `lib/data/studentContents.ts`

2. **생성 함수 개선**
   - `createBook`: `difficulty_level` → `difficulty_level_id` 자동 변환
   - `createLecture`: `difficulty_level` → `difficulty_level_id` 자동 변환

3. **업데이트 함수 개선**
   - `updateBook`: `difficulty_level` 변경 시 `difficulty_level_id` 자동 업데이트
   - `updateLecture`: `difficulty_level` 변경 시 `difficulty_level_id` 자동 업데이트

### 개선 효과

- ✅ 하위 호환성 유지 (`difficulty_level` 문자열도 지원)
- ✅ `difficulty_level_id` 우선 사용
- ✅ 자동 변환으로 마이그레이션 부담 감소

---

## 📊 통계

### Phase 3-1
- 마이그레이션 파일: 1개
- 추가된 컬럼: 3개
- Foreign Key 제약조건: 3개
- 인덱스: 3개

### Phase 3-2
- 수정된 파일: 1개 (`lib/plan/contentResolver.ts`)
- 추가된 변환 로직: 2곳 (학생 콘텐츠, 마스터 콘텐츠)
- 타입 정의 개선: 2개

### Phase 3-3
- 신규 파일: 1개 (`lib/utils/difficultyLevelConverter.ts`)
- 수정된 파일: 1개 (`lib/data/studentContents.ts`)
- 개선된 함수: 4개 (createBook, createLecture, updateBook, updateLecture)

---

## 🔄 다음 단계

### Phase 3-4: UI 컴포넌트 타입 개선 (예정)
- 폼 컴포넌트에서 `difficulty_level_id` 사용
- 타입 정의 개선

### Phase 3-5: API 응답 개선 (예정)
- API 응답에 `difficulty_level_id` 포함
- 클라이언트에서 `difficulty_level_id` 우선 사용

### Phase 3-6: Deprecated 표시 및 문서화 (예정)
- `difficulty_level` 사용처에 deprecated 주석 추가
- 마이그레이션 가이드 문서화

---

## 📝 참고 사항

1. **하위 호환성**: `difficulty_level` 컬럼은 유지되며, 자동 변환 로직으로 마이그레이션 부담 감소
2. **데이터 정규화**: `difficulty_levels` 테이블을 통한 일관성 있는 난이도 관리
3. **성능**: Foreign Key 인덱스로 조회 성능 향상
4. **타입 안전성**: TypeScript 타입 정의 개선으로 컴파일 타임 검증 강화

---

**작업 완료일**: 2025-02-04  
**작업자**: AI Assistant  
**Git 커밋**: 
- `e87b35fe`: Phase 3-1, 3-2 difficulty_level 마이그레이션
- `d1dd5678`: Phase 3-3 difficulty_level_id 변환 로직 추가

