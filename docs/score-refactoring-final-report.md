# 성적 시스템 리팩토링 최종 보고서

**작업 완료 일시**: 2025-02-05  
**프로젝트 상태**: ✅ 완료

## 📋 프로젝트 개요

성적 시스템을 레거시 테이블(`student_school_scores`)에서 신규 정규화 테이블(`student_internal_scores`, `student_mock_scores`)로 완전히 마이그레이션하고, 프론트엔드와 백엔드 코드를 네이티브 타입(`InternalScore`)으로 전환하는 작업을 완료했습니다.

## 🔄 변경 전/후 비교

### 데이터베이스 구조

#### 변경 전 (레거시)
- **`student_school_scores`**: 비정규화된 단일 테이블
  - 텍스트 필드: `subject_group`, `subject_type`, `subject_name`
  - 필드명: `subject_average`, `standard_deviation`, `grade_score`, `class_rank`
  - `test_date` 필드 존재

#### 변경 후 (신규)
- **`student_internal_scores`**: 정규화된 내신 성적 테이블
  - FK 필드: `subject_group_id`, `subject_type_id`, `subject_id`
  - 필드명: `avg_score`, `std_dev`, `rank_grade`
  - `student_term_id` FK 추가 (학년도/학기 관리)
  - `class_rank` 필드 제거

- **`student_mock_scores`**: 정규화된 모의고사 성적 테이블
  - FK 필드: `subject_group_id`, `subject_id`
  - `exam_date`, `exam_title` 필드
  - `standard_score`, `percentile`, `grade_score` 필드

### 타입 시스템

#### 변경 전
```typescript
// 레거시 타입 (비정규화)
type SchoolScore = {
  subject_group?: string | null;  // 텍스트 필드
  subject_average?: number | null;
  standard_deviation?: number | null;
  grade_score?: number | null;
  class_rank?: number | null;
  // ...
};
```

#### 변경 후
```typescript
// 신규 타입 (정규화)
type InternalScore = {
  subject_group_id: string;  // FK
  subject_type_id: string;   // FK
  subject_id: string;        // FK
  avg_score: number | null;
  std_dev: number | null;
  rank_grade: number | null;
  // class_rank 제거됨
  // ...
};
```

## 🔀 데이터 흐름

### 내신 성적 생성 흐름

```
Client Component (ScoreFormModal)
  ↓
Server Action (createInternalScore)
  ↓
Data Layer (createInternalScore in lib/data/studentScores.ts)
  ↓
Repository (insertInternalScore in lib/domains/score/repository.ts)
  ↓
Database (student_internal_scores 테이블)
```

### 내신 성적 조회 흐름

```
Server Component (page.tsx)
  ↓
Data Layer (getInternalScores in lib/data/studentScores.ts)
  ↓
Database Query (student_internal_scores 테이블)
  ↓
InternalScore[] 반환
  ↓
Client Component (SchoolScoresView → ScoreCardGrid → ScoreCard)
```

### 내신 성적 수정/삭제 흐름

```
Client Component (ScoreFormModal / Delete Dialog)
  ↓
Server Action (updateInternalScore / deleteInternalScore)
  ↓
Data Layer (updateInternalScore / deleteInternalScore)
  ↓
Database Update/Delete (student_internal_scores 테이블)
```

## 📁 주요 파일 위치

### 프론트엔드 컴포넌트

- **페이지 컴포넌트**: `app/(student)/scores/school/[grade]/[semester]/page.tsx`
  - `getInternalScores` 호출하여 `InternalScore[]` 조회
  - `SchoolScoresView`에 전달

- **뷰 컴포넌트**: `app/(student)/scores/school/[grade]/[semester]/_components/SchoolScoresView.tsx`
  - `InternalScore[]` Props 타입
  - `ScoreCardGrid`에 전달

- **카드 그리드**: `app/(student)/scores/_components/ScoreCardGrid.tsx`
  - `InternalScore[]` Props 타입
  - 필터링 및 정렬 로직

- **카드 컴포넌트**: `app/(student)/scores/_components/ScoreCard.tsx`
  - `InternalScore` Props 타입
  - `rank_grade`, `avg_score`, `std_dev` 필드 사용

- **폼 모달**: `app/(student)/scores/_components/ScoreFormModal.tsx`
  - `createInternalScore`, `updateInternalScore` 사용
  - 레거시 필드명(`subject_average` 등)을 신규 필드명(`avg_score` 등)으로 변환

### Server Actions

- **내신 성적 Actions**: `app/actions/scores-internal.ts`
  - `createInternalScore`: 내신 성적 생성
  - `updateInternalScore`: 내신 성적 수정
  - `deleteInternalScore`: 내신 성적 삭제

### 데이터 레이어

- **데이터 함수**: `lib/data/studentScores.ts`
  - `getInternalScores`: 내신 성적 목록 조회
  - `createInternalScore`: 내신 성적 생성 (student_term 관리 포함)
  - `updateInternalScore`: 내신 성적 수정
  - `deleteInternalScore`: 내신 성적 삭제

### 도메인 레이어

- **Repository**: `lib/domains/score/repository.ts`
  - `findInternalScores`: 내신 성적 조회 (정규화 버전)
  - `insertInternalScore`: 내신 성적 생성 (정규화 버전)
  - `updateInternalScoreById`: 내신 성적 수정 (정규화 버전)
  - `deleteInternalScoreById`: 내신 성적 삭제 (정규화 버전)

- **Service**: `lib/domains/score/service.ts`
  - `getScoreTrendBySubject`: 과목별 성적 추이 조회 (`InternalScore[]` 반환)
  - `calculateAverageGrade`: 평균 등급 계산 (`findInternalScores` 사용)

- **Actions**: `lib/domains/score/actions.ts`
  - `getScoreTrendAction`: 과목별 성적 추이 조회 (`InternalScore[]` 반환)

- **타입 정의**: `lib/domains/score/types.ts`
  - `InternalScore`: 내신 성적 타입 (정규화 버전)
  - `SchoolScore`: 레거시 타입 (deprecated, 타입만 유지)

### 마이그레이션 검증

- **Admin 페이지**: `app/(admin)/admin/migration-status/page.tsx`
  - `student_school_scores`와 `student_internal_scores` 레코드 수 비교
  - 마이그레이션 상태 확인

## 🛠 유지보수 가이드

### 새로운 성적 추가 시 확인해야 할 파일들

1. **프론트엔드 컴포넌트**
   - `app/(student)/scores/_components/ScoreFormModal.tsx`
     - 폼 필드 추가/수정
     - 유효성 검증 로직 추가

2. **Server Actions**
   - `app/actions/scores-internal.ts`
     - FormData 파싱 로직 추가
     - 필드명 매핑 확인 (`subject_average` → `avg_score` 등)

3. **데이터 레이어**
   - `lib/data/studentScores.ts`
     - `createInternalScore` 함수의 입력 타입 확인
     - `student_term` 생성 로직 확인

4. **도메인 레이어**
   - `lib/domains/score/repository.ts`
     - `insertInternalScore` 함수의 payload 구조 확인
   - `lib/domains/score/types.ts`
     - `InternalScoreInsert` 타입 확인

### 필드명 매핑 참고

| 레거시 필드명 (UI) | 신규 필드명 (DB) | 위치 |
|-------------------|-----------------|------|
| `subject_average` | `avg_score` | `ScoreFormModal.tsx` → `scores-internal.ts` |
| `standard_deviation` | `std_dev` | `ScoreFormModal.tsx` → `scores-internal.ts` |
| `grade_score` | `rank_grade` | `ScoreFormModal.tsx` → `scores-internal.ts` |
| `class_rank` | (제거됨) | - |

### 타입 사용 가이드

#### ✅ 권장 방식
```typescript
import type { InternalScore } from "@/lib/domains/score/types";
// 또는
import type { InternalScore } from "@/lib/data/studentScores";

const scores: InternalScore[] = await getInternalScores(studentId, tenantId);
```

#### ❌ 사용 금지
```typescript
// 레거시 타입 사용 금지
import type { SchoolScore } from "@/lib/domains/score/types"; // @deprecated

// 레거시 함수 사용 금지
import { getSchoolScores } from "@/lib/domains/score/service"; // 제거됨
```

## 🗑 제거된 레거시 코드

### Service 레이어
- ❌ `getSchoolScores` (제거됨)
- ❌ `getSchoolScoreById` (제거됨)
- ❌ `createSchoolScore` (제거됨)
- ❌ `updateSchoolScore` (제거됨)
- ❌ `deleteSchoolScore` (제거됨)

### Actions 레이어
- ❌ `getSchoolScoresAction` (제거됨)
- ❌ `getSchoolScoreByIdAction` (제거됨)
- ❌ `createSchoolScoreAction` (제거됨)
- ❌ `updateSchoolScoreAction` (제거됨)
- ❌ `deleteSchoolScoreAction` (제거됨)

### Repository 레이어
- ❌ `findSchoolScores` (제거됨)
- ❌ `findSchoolScoreById` (제거됨)
- ❌ `insertSchoolScore` (제거됨)
- ❌ `updateSchoolScoreById` (제거됨)
- ❌ `deleteSchoolScoreById` (제거됨)

### 유지된 레거시 타입 (타입만 유지)
- ⚠️ `SchoolScore` (deprecated, 타입만 유지 - `validation.ts`에서 사용)
- ⚠️ `CreateSchoolScoreInput` (deprecated, 타입만 유지)
- ⚠️ `UpdateSchoolScoreInput` (deprecated, 타입만 유지)

## 📊 마이그레이션 상태

### 완료된 작업

1. ✅ **프론트엔드 컴포넌트**: 모든 컴포넌트가 `InternalScore` 타입 사용
2. ✅ **Server Actions**: 신규 액션(`createInternalScore`, `updateInternalScore`, `deleteInternalScore`) 사용
3. ✅ **데이터 레이어**: `getInternalScores` 사용
4. ✅ **도메인 서비스**: `getScoreTrendBySubject`가 `InternalScore[]` 반환
5. ✅ **레거시 함수 제거**: 사용되지 않는 함수들 완전 제거
6. ✅ **마이그레이션 검증 페이지**: Admin 페이지 생성

### 남아있는 레거시 코드

- **타입 정의**: `lib/domains/score/types.ts`의 `SchoolScore` 타입 (deprecated)
  - `lib/domains/score/validation.ts`에서 사용 중이므로 유지
  - 향후 validation 스키마도 마이그레이션 시 제거 가능

- **데이터 레이어**: `lib/data/studentScores.ts`의 레거시 함수들
  - `getStudentScores`, `createStudentScore`, `updateStudentScore`, `deleteStudentScore`
  - `student_scores` 테이블 관련 함수들 (이미 사용되지 않음)
  - 향후 완전 제거 가능

## 🎯 아키텍처 개선 효과

### 1. 타입 안전성 향상
- 정규화된 FK 필드 사용으로 타입 안전성 확보
- 레거시 타입 변환 로직 제거로 코드 단순화

### 2. 데이터 일관성 보장
- `student_term_id` FK를 통한 학년도/학기 관리
- 정규화된 구조로 데이터 중복 제거

### 3. 유지보수성 향상
- 명확한 데이터 흐름 (Client → Action → Data → Repository → DB)
- 레거시 코드 제거로 코드베이스 단순화

### 4. 성능 최적화
- 불필요한 타입 변환 로직 제거
- 정규화된 구조로 쿼리 최적화 가능

## 📝 참고 문서

- `docs/2025-02-05-phase5-native-type-migration-completion.md`: Phase 5 완료 보고서
- `docs/2025-02-05-score-migration-switchover-completion.md`: 마이그레이션 전환 완료 보고서
- `docs/2025-02-05-score-migration-and-testing-completion.md`: 마이그레이션 및 테스트 완료 보고서

## ✅ 프로젝트 종료

성적 시스템 리팩토링 프로젝트가 성공적으로 완료되었습니다. 모든 프론트엔드 컴포넌트와 주요 백엔드 로직이 신규 타입(`InternalScore`)을 사용하도록 전환되었으며, 레거시 코드가 제거되어 코드베이스가 단순화되었습니다.
