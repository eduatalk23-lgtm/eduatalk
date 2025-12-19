# Phase 3: difficulty_level → difficulty_level_id 마이그레이션 계획

**작업 일시**: 2025-02-04  
**Phase**: 3 - 학생 도메인 핵심 기능 Deprecated 속성 마이그레이션

---

## 📋 현재 상황 분석

### 데이터베이스 스키마 현황

#### ✅ difficulty_level_id가 있는 테이블
- `master_books` - `difficulty_level_id` (uuid, nullable) + `difficulty_level` (deprecated)
- `master_lectures` - `difficulty_level_id` (uuid, nullable) + `difficulty_level` (deprecated)
- `master_custom_contents` - `difficulty_level_id` (uuid, nullable) + `difficulty_level` (deprecated)

#### ❌ difficulty_level_id가 없는 테이블
- `books` - `difficulty_level` (text, nullable)만 존재
- `lectures` - `difficulty_level` (text, nullable)만 존재
- `student_custom_contents` - `difficulty_level` (text, nullable)만 존재

#### 📊 difficulty_levels 테이블
- 총 10개 레코드 (book: 4개, lecture: 3개, custom: 3개)
- `id` (uuid), `name` (varchar), `content_type` (varchar), `display_order` (integer)

### 코드 사용처 현황

#### 마스터 콘텐츠 관련 (우선순위 높음)
- `lib/plan/contentResolver.ts` - 6곳
- `lib/plan/contentDuration.ts` - 1곳
- `lib/data/contentMasters.ts` - `enrichDifficultyLevels` 함수 존재

#### 학생 콘텐츠 관련 (우선순위 중간)
- `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/hooks/useRecommendations.ts` - 3곳
- `app/(student)/plan/new-group/_components/_features/content-selection/utils/recommendationTransform.ts` - 1곳
- `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useContentDetailsBatch.ts` - 1곳
- `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/hooks/useContentInfos.ts` - 4곳
- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentItem.tsx` - 1곳
- `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx` - 1곳
- `app/(student)/plan/new-group/_components/_features/content-selection/components/UnifiedContentsView.tsx` - 2곳

**총 약 17곳**

---

## 🎯 마이그레이션 전략

### 원칙
1. **하위 호환성 유지**: 기존 `difficulty_level` 값도 계속 지원
2. **점진적 마이그레이션**: 단계별로 안전하게 진행
3. **데이터 무결성**: 기존 데이터 손실 방지

---

## 📝 단계별 마이그레이션 계획

### Phase 3-1: 데이터베이스 스키마 확장 (필수)

#### 목표
학생 테이블에 `difficulty_level_id` 컬럼 추가

#### 작업 내용
1. **마이그레이션 파일 생성**
   ```sql
   -- books 테이블에 difficulty_level_id 추가
   ALTER TABLE books 
   ADD COLUMN difficulty_level_id uuid REFERENCES difficulty_levels(id);
   
   -- lectures 테이블에 difficulty_level_id 추가
   ALTER TABLE lectures 
   ADD COLUMN difficulty_level_id uuid REFERENCES difficulty_levels(id);
   
   -- student_custom_contents 테이블에 difficulty_level_id 추가
   ALTER TABLE student_custom_contents 
   ADD COLUMN difficulty_level_id uuid REFERENCES difficulty_levels(id);
   ```

2. **기존 데이터 마이그레이션 (선택적)**
   - `difficulty_level` 문자열 값을 `difficulty_level_id`로 변환
   - 매핑 실패 시 NULL 유지

#### 예상 소요 시간: 30분

---

### Phase 3-2: 마스터 콘텐츠 쿼리 개선 (우선순위 높음)

#### 목표
마스터 테이블 쿼리에서 `difficulty_level_id` 우선 사용

#### 작업 내용
1. **lib/plan/contentResolver.ts**
   - 마스터 콘텐츠 조회 시 `difficulty_level_id` 포함
   - `difficulty_level_id` → `difficulty_level` 변환 로직 추가
   - `enrichDifficultyLevels` 함수 활용

2. **lib/plan/contentDuration.ts**
   - `difficulty_level` 대신 `difficulty_level_id` 사용
   - 변환 로직 추가

3. **lib/data/contentMasters.ts**
   - `enrichDifficultyLevels` 함수 개선 (이미 존재)
   - 마스터 콘텐츠 조회 시 `difficulty_level_id` 포함

#### 예상 소요 시간: 1-2시간

---

### Phase 3-3: 학생 콘텐츠 쿼리 개선 (우선순위 중간)

#### 목표
학생 테이블 쿼리에서 `difficulty_level_id` 우선 사용

#### 작업 내용
1. **lib/plan/contentResolver.ts**
   - 학생 콘텐츠 조회 시 `difficulty_level_id` 포함
   - `difficulty_level_id` → `difficulty_level` 변환 로직 추가

2. **학생 콘텐츠 생성/업데이트 로직**
   - `difficulty_level` 문자열 대신 `difficulty_level_id` 사용
   - 변환 헬퍼 함수 생성

#### 예상 소요 시간: 1-2시간

---

### Phase 3-4: UI 컴포넌트 타입 개선 (우선순위 중간)

#### 목표
프론트엔드 타입에서 `difficulty_level_id` 지원

#### 작업 내용
1. **타입 정의 개선**
   - `difficulty_level_id?: string | null` 추가
   - `difficulty_level`은 하위 호환성을 위해 유지

2. **컴포넌트 수정**
   - `useRecommendations.ts` - API 응답 타입 개선
   - `recommendationTransform.ts` - 변환 로직 개선
   - `useContentDetailsBatch.ts` - 타입 개선
   - `useContentInfos.ts` - 타입 개선
   - `ContentItem.tsx` - 표시 로직 개선
   - `StudentContentsPanel.tsx` - 표시 로직 개선
   - `UnifiedContentsView.tsx` - 표시 로직 개선

#### 예상 소요 시간: 2-3시간

---

### Phase 3-5: API 응답 개선 (우선순위 낮음)

#### 목표
API 응답에 `difficulty_level_id` 포함

#### 작업 내용
1. **Server Actions 개선**
   - 콘텐츠 조회 API에 `difficulty_level_id` 포함
   - 변환 로직 추가

2. **타입 정의 통일**
   - 모든 API 응답 타입에 `difficulty_level_id` 추가

#### 예상 소요 시간: 1-2시간

---

### Phase 3-6: Deprecated 표시 및 문서화 (최종)

#### 목표
`difficulty_level` 속성을 deprecated로 표시

#### 작업 내용
1. **JSDoc 주석 추가**
   - 모든 `difficulty_level` 사용처에 `@deprecated` 표시
   - `difficulty_level_id` 사용 권장 안내

2. **문서화**
   - 마이그레이션 가이드 작성
   - 변경 사항 문서화

#### 예상 소요 시간: 30분

---

## 🚨 주의사항

### 1. 하위 호환성
- 기존 `difficulty_level` 값은 계속 지원해야 함
- `difficulty_level_id`가 없을 때 `difficulty_level`을 fallback으로 사용

### 2. 데이터 변환
- 문자열 `difficulty_level` 값을 `difficulty_level_id`로 변환하는 로직 필요
- 매핑 실패 시 NULL 허용

### 3. 테스트
- 각 단계마다 테스트 필수
- 기존 기능 동작 확인

---

## 📊 예상 총 소요 시간

- **Phase 3-1**: 30분
- **Phase 3-2**: 1-2시간
- **Phase 3-3**: 1-2시간
- **Phase 3-4**: 2-3시간
- **Phase 3-5**: 1-2시간
- **Phase 3-6**: 30분

**총 예상 시간**: 6-10시간

---

## ✅ 체크리스트

### Phase 3-1: 데이터베이스 스키마
- [ ] 마이그레이션 파일 생성
- [ ] 스키마 변경 적용
- [ ] 기존 데이터 마이그레이션 (선택적)

### Phase 3-2: 마스터 콘텐츠
- [ ] `lib/plan/contentResolver.ts` 수정
- [ ] `lib/plan/contentDuration.ts` 수정
- [ ] `lib/data/contentMasters.ts` 검토

### Phase 3-3: 학생 콘텐츠
- [ ] 학생 콘텐츠 쿼리 개선
- [ ] 생성/업데이트 로직 개선

### Phase 3-4: UI 컴포넌트
- [ ] 타입 정의 개선
- [ ] 모든 컴포넌트 수정
- [ ] 표시 로직 개선

### Phase 3-5: API 응답
- [ ] Server Actions 개선
- [ ] 타입 정의 통일

### Phase 3-6: 문서화
- [ ] JSDoc 주석 추가
- [ ] 마이그레이션 가이드 작성

---

## 🎯 권장 진행 순서

1. **Phase 3-1** (데이터베이스 스키마) - 필수 선행 작업
2. **Phase 3-2** (마스터 콘텐츠) - 영향 범위가 명확하고 안전
3. **Phase 3-3** (학생 콘텐츠) - 마스터 콘텐츠 완료 후
4. **Phase 3-4** (UI 컴포넌트) - 백엔드 완료 후
5. **Phase 3-5** (API 응답) - 모든 로직 완료 후
6. **Phase 3-6** (문서화) - 최종 정리

---

## 📝 다음 단계

Phase 3-1부터 시작하여 단계별로 진행하는 것을 권장합니다.

**작업 시작 시간**: 2025-02-04

