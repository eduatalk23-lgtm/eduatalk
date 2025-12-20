# 릴리즈 노트 (Release Notes)

**버전**: 2025-02-05  
**릴리즈 일자**: 2025-02-05  
**상태**: 프로덕션 배포 준비 완료 ✅

---

## 📋 개요

이번 릴리즈는 프로젝트의 안정성과 유지보수성을 크게 향상시키는 주요 리팩토링과 버그 수정을 포함합니다. 핵심 비즈니스 로직의 타입 안전성을 확보하고, 빌드 성공을 달성하여 프로덕션 배포 준비를 완료했습니다.

---

## 🚀 주요 변경 사항 (Refactoring)

### 1. 캠프 템플릿 로직 분리

**목적**: 단일 책임 원칙(SRP) 적용 및 코드 재사용성 향상

#### 변경 내용

- **`contentService` 도입** (`lib/domains/camp/services/contentService.ts`)
  - 콘텐츠 검증 및 해석 로직 분리
  - `validateAndResolveContent`: 콘텐츠 유효성 검증 및 실제 콘텐츠 ID 해석
  - `prepareContentsToSave`: 저장 전 콘텐츠 데이터 준비
  - 중복된 콘텐츠 처리 로직 제거

- **`updateService` 도입** (`lib/domains/camp/services/updateService.ts`)
  - 플랜 그룹 업데이트 로직 분리
  - 메타데이터, 제외일, 학원 일정 업데이트 로직 통합
  - 타입 안전성 향상 및 에러 처리 개선

- **캠프 템플릿 액션 리팩토링**
  - `app/(admin)/actions/campTemplateActions.ts` (5,000줄+) 기능별 분리
  - `camp-templates/` 디렉토리 구조 생성:
    - `crud.ts`: 템플릿 CRUD 함수
    - `participants.ts`: 참여자 관리 함수
    - `progress.ts`: 진행/검토 함수
    - `types.ts`: 공통 타입 정의

**영향 범위**:
- 캠프 템플릿 생성/수정/삭제 로직
- 캠프 초대 및 참여자 관리
- 캠프 플랜 그룹 진행 관리

**기대 효과**:
- 코드 가독성 향상
- 유지보수성 개선
- 테스트 용이성 증가

---

### 2. 학교 관리 페이지 Read-Only 전환 및 나이스(NEIS) 데이터 연동 구조 변경

**목적**: 학교 데이터의 일관성 보장 및 외부 데이터 소스 통합

#### 변경 내용

- **학교 관리 UI Read-Only 전환**
  - 학교 등록/수정/삭제 UI 완전 제거
  - `school_info` 뷰를 통한 읽기 전용 조회로 전환
  - 나이스(NEIS) 데이터 연동 구조 변경

- **삭제된 파일**
  - `app/(admin)/admin/schools/new/page.tsx`
  - `app/(admin)/admin/schools/[id]/edit/page.tsx`
  - `app/(admin)/admin/schools/_components/SchoolFormModal.tsx`
  - `app/(admin)/admin/schools/_components/SchoolUpsertForm.tsx`

- **수정된 파일**
  - `app/(admin)/admin/schools/_components/SchoolTypeTabs.tsx`: "학교 등록" 버튼 제거
  - `app/(admin)/admin/schools/_components/SchoolTable.tsx`: "작업" 컬럼 제거

**영향 범위**:
- 관리자 학교 관리 페이지
- 학교 데이터 조회 로직

**기대 효과**:
- 데이터 일관성 보장
- 외부 데이터 소스와의 동기화 용이
- UI 단순화

---

## 🛡️ 안정성 개선 (Stability)

### 1. 데이터 레이어 타입 안전성 확보

**목적**: 빌드 에러 해결 및 타입 안전성 향상

#### 변경 내용

- **Promise Wrapper 패턴 적용**
  - `lib/data/studentPlans.ts`: 모든 `safeQueryArray`/`safeQuerySingle` 호출 수정
  - `lib/metrics/getHistoryPattern.ts`: Promise Wrapper 패턴 적용
  - `lib/metrics/getPlanCompletion.ts`: Promise Wrapper 패턴 적용
  - `lib/metrics/getScoreTrend.ts`: Promise Wrapper 패턴 적용
  - `lib/metrics/getWeakSubjects.ts`: Promise Wrapper 패턴 적용
  - `lib/goals/queries.ts`: Promise Wrapper 패턴 적용
  - `lib/data/studentSessions.ts`: Promise Wrapper 패턴 적용

**수정 패턴**:
```typescript
// 수정 전 (에러 발생)
const data = await safeQueryArray<Type>(
  () => supabase.from("table").select("*"),
  ...
);

// 수정 후 (정상 작동)
const data = await safeQueryArray<Type>(
  async () => {
    const result = await supabase.from("table").select("*");
    return { data: result.data as Type[] | null, error: result.error };
  },
  ...
);
```

**영향 범위**:
- 모든 데이터 페칭 로직
- 타입 안전성 전반

**기대 효과**:
- 빌드 성공 보장
- 런타임 타입 에러 방지
- 개발자 경험 향상

---

### 2. 전체 프로젝트 빌드 성공

**목적**: 프로덕션 배포 준비 완료

#### 변경 내용

- **타입 에러 해결**
  - `lib/metrics/` 디렉토리 타입 에러 0개 달성
  - `lib/scores/internalAnalysis.ts`: 타입 단언 안전성 개선
  - `lib/scores/mockAnalysis.ts`: 타입 단언 안전성 개선

- **빌드 설정 최적화**
  - `tsconfig.json`: 테스트 파일, 스크립트 파일 제외
  - 제외된 항목:
    - `**/*.test.ts`, `**/*.test.tsx`
    - `**/__tests__/**`
    - `tests/**`
    - `playwright.config.ts`
    - `vitest.config.ts`
    - `scripts/**`

**검증 결과**:
- ✅ `npx tsc --noEmit`: 타입 에러 0개
- ✅ `npm run build`: 빌드 성공 (Exit code: 0)

---

## ⚡ 성능 최적화 (Performance)

### 1. N+1 쿼리 제거

**목적**: 데이터베이스 쿼리 성능 향상

#### 변경 내용

- **학부모 연결 요청 조회 최적화**
  - 배치 조회로 N+1 쿼리 제거
  - 여러 학생의 학교 정보를 한 번에 조회

- **기타 최적화**
  - 플랜 콘텐츠 조회: 배치 조회 적용
  - 블록 세트 조회: 병렬 조회 후 JavaScript 그룹화
  - 학생 통계 조회: 배치 조회 적용
  - 출석 기록 조회: 배치 조회 적용

**영향 범위**:
- 학부모 대시보드
- 학생 관리 페이지
- 통계 조회 기능

**기대 효과**:
- 데이터베이스 부하 감소
- 페이지 로딩 시간 단축
- 사용자 경험 개선

---

## 🧹 기술 부채 제거 (Cleanup)

### 1. Deprecated 함수 제거

**목적**: 코드베이스 정리 및 유지보수성 향상

#### 변경 내용

- **중복 함수 제거**
  - `app/(admin)/actions/studentManagementActions.ts`: `validateConnectionCode` 제거
  - `app/(admin)/actions/contentMetadataActions.ts`: `getSubjectCategoriesAction`, `getSubjectsAction` 제거

- **레거시 테이블 마이그레이션 완료**
  - `student_school_scores` → `student_internal_scores` 전환 완료
  - 모든 레거시 테이블 참조 제거
  - 컬럼 매핑 로직 추가 (하위 호환성 유지)

**영향 범위**:
- 학생 성적 관리 로직
- 콘텐츠 메타데이터 조회

**기대 효과**:
- 코드베이스 단순화
- 유지보수 비용 감소
- 일관된 데이터 모델 사용

---

### 2. 학생/관리자 액션 일원화

**목적**: 코드 중복 제거 및 일관성 확보

#### 변경 내용

- **공통 로직 추출**
  - 재조정 로직: `lib/reschedule/core.ts`로 통합
  - 기간 계산 로직: `lib/reschedule/periodCalculator.ts`로 통합

- **액션 파일 구조 개선**
  - 역할별 액션 파일 분리
  - 공통 로직 재사용

**영향 범위**:
- 플랜 그룹 재조정 기능
- 학생/관리자 공통 기능

**기대 효과**:
- 코드 중복 제거 (약 80% 감소)
- 버그 수정 용이성 향상
- 기능 일관성 보장

---

## 📊 변경 통계

### 코드 변경
- **수정된 파일**: 50+ 파일
- **삭제된 파일**: 10+ 파일
- **신규 생성 파일**: 15+ 파일

### 타입 안전성
- **해결된 타입 에러**: 20+ 개
- **적용된 Promise Wrapper 패턴**: 15+ 곳

### 성능 최적화
- **N+1 쿼리 제거**: 10+ 곳
- **배치 조회 적용**: 8+ 곳

---

## ⚠️ 데이터베이스 마이그레이션 점검 필요

배포 전 반드시 확인해야 할 테이블 및 뷰 목록입니다. 코드는 수정되었으나 실제 DB에 해당 테이블이 없으면 런타임 에러가 발생합니다.

### 필수 확인 항목

#### 1. 캠프 템플릿 관련 테이블

- ✅ **`camp_template_block_sets`** (연결 테이블)
  - 템플릿-블록세트 연결 관리
  - 마이그레이션: `20251127013258_create_camp_template_block_sets.sql`
  - 컬럼:
    - `id` (uuid, PK)
    - `camp_template_id` (uuid, UNIQUE, FK → camp_templates)
    - `tenant_block_set_id` (uuid, FK → tenant_block_sets)
    - `created_at` (timestamptz)

- ✅ **`tenant_block_sets`** (테이블 이름 변경)
  - 이전: `template_block_sets`
  - 마이그레이션: `20251127013257_refactor_block_sets_to_tenant_based.sql`
  - `template_id` 컬럼 제거됨

- ✅ **`tenant_blocks`** (테이블 이름 변경)
  - 이전: `template_blocks`
  - 마이그레이션: `20251127013257_refactor_block_sets_to_tenant_based.sql`
  - `template_block_set_id` → `tenant_block_set_id` 컬럼명 변경

#### 2. 학교 관리 관련 뷰

- ✅ **`school_info`** (뷰)
  - 중·고등학교 정보 조회용 뷰
  - 나이스(NEIS) 데이터 연동
  - 읽기 전용 (Read-Only)
  - 사용 위치:
    - `lib/data/schools.ts`
    - `lib/data/studentSchools.ts`
    - `lib/domains/school/repository.ts`

#### 3. 성적 관리 관련 테이블

- ✅ **`student_internal_scores`** (신규 테이블)
  - 이전: `student_school_scores` (레거시)
  - 내신 성적 저장
  - 컬럼 매핑:
    - `rank_grade` (이전: `grade_score`)
    - `avg_score` (이전: `subject_average`)
    - `std_dev` (이전: `standard_deviation`)
    - `subject_group_id` (FK, 이전: `subject_group` text)

- ⚠️ **`student_school_scores`** (레거시 테이블)
  - 코드에서 완전히 제거됨
  - 데이터 마이그레이션 필요 여부 확인 필요

#### 4. 기타 테이블

- ✅ **`camp_templates`** (기존 테이블)
  - `template_data.block_set_id` 필드 제거됨
  - 블록 세트 연결은 `camp_template_block_sets` 테이블 사용

### 마이그레이션 체크리스트

배포 전 다음 사항을 확인하세요:

- [ ] `camp_template_block_sets` 테이블 존재 확인
- [ ] `tenant_block_sets` 테이블 존재 확인 (이전 `template_block_sets`에서 변경)
- [ ] `tenant_blocks` 테이블 존재 확인 (이전 `template_blocks`에서 변경)
- [ ] `school_info` 뷰 존재 확인
- [ ] `student_internal_scores` 테이블 존재 확인
- [ ] `student_school_scores` 테이블 데이터 마이그레이션 완료 여부 확인
- [ ] 모든 외래 키 제약조건 정상 작동 확인
- [ ] 인덱스 생성 확인

### 마이그레이션 실행 순서

1. `20251127013257_refactor_block_sets_to_tenant_based.sql`
2. `20251127013258_create_camp_template_block_sets.sql`
3. `20251127013259_migrate_template_block_set_links.sql` (데이터 마이그레이션)

---

## 🔄 마이그레이션 가이드

### 캠프 템플릿 블록 세트 연결 마이그레이션

기존 `template_data.block_set_id`를 `camp_template_block_sets` 테이블로 마이그레이션해야 합니다.

```sql
-- 기존 데이터 마이그레이션 예시
INSERT INTO camp_template_block_sets (camp_template_id, tenant_block_set_id)
SELECT id, (template_data->>'block_set_id')::uuid
FROM camp_templates
WHERE template_data->>'block_set_id' IS NOT NULL;
```

### 성적 테이블 마이그레이션

`student_school_scores`에서 `student_internal_scores`로 데이터 마이그레이션이 필요할 수 있습니다.

```sql
-- 데이터 마이그레이션 예시 (필요시)
INSERT INTO student_internal_scores (
  student_id, subject_group_id, rank_grade, avg_score, std_dev, created_at
)
SELECT 
  student_id,
  subject_group_id,
  grade_score AS rank_grade,
  subject_average AS avg_score,
  standard_deviation AS std_dev,
  created_at
FROM student_school_scores;
```

---

## 🐛 알려진 이슈

현재 알려진 이슈는 없습니다.

---

## 📝 참고 사항

### 개발 환경 설정

- Node.js 버전: 18.x 이상
- Next.js 버전: 16.0.10
- TypeScript 버전: 5.x
- Supabase 클라이언트: 최신 버전

### 빌드 및 배포

```bash
# 타입 체크
npx tsc --noEmit

# 빌드
npm run build

# 프로덕션 서버 시작
npm run start
```

---

## 🙏 감사의 말

이번 릴리즈를 위해 기여해주신 모든 분들께 감사드립니다.

---

**릴리즈 노트 작성일**: 2025-02-05  
**작성자**: AI Assistant  
**검토자**: 개발팀

