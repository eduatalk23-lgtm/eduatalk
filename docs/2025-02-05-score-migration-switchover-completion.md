# 내신 성적 마이그레이션 전환 작업 완료

## 📋 작업 개요

레거시 테이블(`student_school_scores`) 의존성을 완전히 끊고, 신규 테이블(`student_internal_scores`)을 사용하도록 애플리케이션을 전환했습니다.

**작업 일시**: 2025-02-05  
**작업 범위**: Phase 3 마이그레이션 이후 실제 애플리케이션 전환

---

## ✅ 완료된 작업

### 1. 데이터 조회 로직 교체 (Read Path Switch)

#### 변경 파일
- `app/(student)/scores/school/[grade]/[semester]/page.tsx`

#### 변경 내용
- `getSchoolScores` (레거시) → `getInternalScores` (신규)로 교체
- `InternalScore`를 `SchoolScore`로 변환하는 매퍼 함수 적용
- 필터링 로직을 신규 함수의 필터 파라미터로 전달

```typescript
// 변경 전
const scores = await getSchoolScores(user.id, tenantContext.tenantId);

// 변경 후
const internalScores = await getInternalScores(user.id, tenantContext.tenantId, {
  grade: parseInt(grade),
  semester: parseInt(semester),
});
const scores = mapInternalScoresToSchoolScores(internalScores);
```

---

### 2. 데이터 수정/삭제 로직 교체 (Write Path Switch)

#### 변경 파일
- `app/(student)/scores/school/[grade]/[semester]/_components/SchoolScoresView.tsx`
- `app/(student)/scores/school/[grade]/[semester]/[subject-group]/[id]/edit/page.tsx`
- `app/(student)/scores/school/[grade]/[semester]/[subject-group]/[id]/edit/_components/SchoolScoreEditForm.tsx`

#### 변경 내용

**삭제 로직 (SchoolScoresView.tsx)**
- `deleteSchoolScoreAction` → `deleteInternalScore`로 교체
- 신규 액션은 FormData가 필요 없으므로 직접 호출

```typescript
// 변경 전
await deleteSchoolScoreAction(deletingScoreId, {
  skipRedirect: true,
  grade: initialGrade,
  semester: initialSemester,
});

// 변경 후
await deleteInternalScore(deletingScoreId);
```

**수정 페이지 (edit/page.tsx)**
- 신규 테이블(`student_internal_scores`)에서 데이터 조회
- `InternalScore`를 `SchoolScoreRow`로 변환하여 폼에 전달

**수정 폼 (SchoolScoreEditForm.tsx)**
- `updateSchoolScore` → `updateInternalScore`로 교체
- 필드 매핑 처리:
  - `grade_score` → `rank_grade`
  - `subject_average` → `avg_score`
  - `standard_deviation` → `std_dev`
- `tenant_id`를 hidden input으로 전달

---

### 3. 매퍼 함수 생성

#### 생성 파일
- `lib/data/studentScores.ts`

#### 추가된 함수
- `mapInternalScoreToSchoolScore()`: 단일 InternalScore를 SchoolScore로 변환
- `mapInternalScoresToSchoolScores()`: InternalScore 배열을 SchoolScore 배열로 변환

#### 필드 매핑 규칙
```typescript
{
  id: internalScore.id,
  tenant_id: internalScore.tenant_id,
  student_id: internalScore.student_id,
  grade: internalScore.grade,
  semester: internalScore.semester,
  subject_group_id: internalScore.subject_group_id,
  subject_id: internalScore.subject_id,
  subject_type_id: internalScore.subject_type_id,
  subject_average: internalScore.avg_score,      // 매핑
  standard_deviation: internalScore.std_dev,     // 매핑
  grade_score: internalScore.rank_grade,         // 매핑
  rank_grade: internalScore.rank_grade,
  // ... 기타 필드
}
```

---

### 4. 레거시 함수 Deprecate 처리

#### 대상 파일
- `lib/data/studentScores.ts`
- `app/(student)/actions/scoreActions.ts`

#### Deprecate 처리된 함수
- `getSchoolScores()` - `@deprecated Phase 4 이후 삭제 예정`
- `createSchoolScore()` - `@deprecated Phase 4 이후 삭제 예정`
- `updateSchoolScore()` - `@deprecated Phase 4 이후 삭제 예정`
- `deleteSchoolScore()` - `@deprecated Phase 4 이후 삭제 예정`
- `addSchoolScore()` - `@deprecated Phase 4 이후 삭제 예정`
- `updateSchoolScoreAction()` - `@deprecated Phase 4 이후 삭제 예정`
- `deleteSchoolScoreAction()` - `@deprecated Phase 4 이후 삭제 예정`

모든 레거시 함수에 JSDoc `@deprecated` 태그를 추가하여 IDE에서 취소선이 표시되도록 했습니다.

---

### 5. 마이그레이션 검증용 Admin 페이지 생성

#### 생성 파일
- `app/(admin)/admin/migration-status/page.tsx`

#### 기능
- 레거시 테이블(`student_school_scores`)과 신규 테이블(`student_internal_scores`)의 레코드 수 비교
- 데이터 일치 여부를 배지로 표시
- 불일치 시 차이점과 안내 메시지 표시
- Admin 권한 체크 (admin 또는 superadmin만 접근 가능)

#### 접근 경로
- `/admin/migration-status`

---

## 🔄 데이터 흐름 변경

### 변경 전 (레거시)
```
페이지 요청
  → getSchoolScores()
    → student_school_scores 테이블 조회
      → SchoolScore[] 반환
        → SchoolScoresView 렌더링
```

### 변경 후 (신규)
```
페이지 요청
  → getInternalScores()
    → student_internal_scores 테이블 조회
      → InternalScore[] 반환
        → mapInternalScoresToSchoolScores()
          → SchoolScore[] 변환
            → SchoolScoresView 렌더링
```

---

## 📝 주요 변경 사항 요약

### 타입 변환
- `InternalScore` → `SchoolScore` 변환을 통해 기존 컴포넌트와의 호환성 유지
- 필드명 매핑: `avg_score` → `subject_average`, `std_dev` → `standard_deviation`, `rank_grade` → `grade_score`

### 액션 교체
- 삭제: `deleteSchoolScoreAction` → `deleteInternalScore`
- 수정: `updateSchoolScore` → `updateInternalScore`
- 조회: `getSchoolScores` → `getInternalScores`

### URL 구조 유지
- 기존 URL 구조(`/scores/school/[grade]/[semester]`)는 그대로 유지
- 사용자 경험 변화 없음

---

## ⚠️ 주의 사항

### 1. 필드 매핑
- `InternalScore`에는 `class_rank`, `test_date` 필드가 없으므로 `null`로 설정
- `subject_group`, `subject_type`, `subject_name`은 FK ID로만 관리되므로 텍스트 값은 `null`

### 2. Edit 페이지 제한사항
- 현재 Edit 페이지는 기본 필드만 표시
- 과목 정보(subject_group, subject_type, subject_name)는 FK ID로만 관리되므로 텍스트 입력 필드는 제한적

### 3. Deprecated 함수
- 레거시 함수들은 Phase 4 이후 삭제 예정
- 새로운 코드에서는 신규 함수 사용 필수

---

## 🧪 테스트 권장 사항

1. **조회 테스트**
   - 각 학년/학기별 성적 조회 확인
   - 필터링 기능 동작 확인

2. **수정 테스트**
   - 성적 수정 기능 동작 확인
   - 필드 매핑 정확성 확인

3. **삭제 테스트**
   - 성적 삭제 기능 동작 확인
   - 삭제 후 목록 갱신 확인

4. **마이그레이션 상태 확인**
   - Admin 페이지에서 데이터 개수 일치 여부 확인

---

## 📚 관련 문서

- [Phase 3 마이그레이션 완료 문서](./2025-02-05-score-migration-and-testing-completion.md)
- [스코어 대시보드 리팩토링 문서](./2025-02-05-score-dashboard-component-refactoring-completion.md)

---

## ✅ 체크리스트

- [x] 데이터 조회 로직 교체
- [x] 데이터 수정 로직 교체
- [x] 데이터 삭제 로직 교체
- [x] 매퍼 함수 생성
- [x] 레거시 함수 Deprecate 처리
- [x] 마이그레이션 검증 페이지 생성
- [x] Linter 에러 확인 및 수정
- [x] 타입 안전성 확인

---

**작업 완료**: 모든 작업이 성공적으로 완료되었습니다. 🎉

