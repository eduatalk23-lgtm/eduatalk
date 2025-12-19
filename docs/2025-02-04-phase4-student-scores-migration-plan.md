# Phase 4: 레거시 student_scores 테이블 마이그레이션 작업 계획

**작성일**: 2025-02-04  
**작업 우선순위**: 높음  
**예상 소요 시간**: 2-3시간

---

## 📋 작업 개요

레거시 `student_scores` 테이블을 새로운 구조로 완전히 마이그레이션합니다:
- **내신 성적**: `student_internal_scores` 테이블
- **모의고사 성적**: `student_mock_scores` 테이블

---

## 🔍 현재 상태 분석

### 1. 레거시 함수 사용 현황

#### `app/actions/scores.ts` (DEPRECATED)
- ✅ **이미 deprecated 표시됨**
- `addStudentScore` - 사용처 미확인 (추가 조사 필요)
- `updateStudentScore` - **사용 중**: `app/(student)/scores/[id]/edit/page.tsx`
- `deleteStudentScore` - **사용 중**: `app/(student)/scores/_components/DeleteScoreButton.tsx`

#### `app/(student)/scores/dashboard/_utils.ts` (DEPRECATED)
- ✅ **이미 deprecated 표시됨**
- `fetchAllScores` - **사용 중**: 
  - `app/(student)/scores/dashboard/page.tsx` (추정)
  - `app/(parent)/parent/_components/ParentDashboardContent.tsx`

#### `app/(student)/analysis/_utils.ts` (DEPRECATED)
- ✅ **이미 deprecated 표시됨**
- `fetchAllScores` - **사용 중**: 분석 페이지에서 사용 (추정)

#### `lib/data/studentScores.ts`
- `getStudentScores` - **deprecated**, 빈 배열 반환
- `createStudentScore`, `updateStudentScore`, `deleteStudentScore` - 레거시 함수들

#### `lib/reports/monthly.ts`
- `getMonthlyWeakSubjectTrend` - **TODO 주석 있음**
- `student_scores` 참조 제거됨, `student_internal_scores`와 `student_mock_scores` 조합 필요

---

## 🎯 마이그레이션 대상 파일

### 우선순위 1: 직접 사용 중인 파일

1. **`app/(student)/scores/[id]/edit/page.tsx`**
   - `updateStudentScore` 사용
   - `student_scores` 테이블 직접 조회
   - **작업**: 새 구조로 마이그레이션

2. **`app/(student)/scores/_components/DeleteScoreButton.tsx`**
   - `deleteStudentScore` 사용
   - **작업**: 새 구조로 마이그레이션

3. **`app/(student)/scores/dashboard/_utils.ts`**
   - `fetchAllScores` 함수
   - **작업**: `getInternalScores`와 `getMockScores` 조합으로 변경

4. **`app/(student)/analysis/_utils.ts`**
   - `fetchAllScores` 함수
   - **작업**: `getInternalScores`와 `getMockScores` 조합으로 변경

5. **`app/(parent)/parent/_components/ParentDashboardContent.tsx`**
   - `fetchAllScores` 사용
   - **작업**: 새 구조로 마이그레이션

### 우선순위 2: Deprecated 함수 정리

6. **`app/actions/scores.ts`**
   - 레거시 함수들 제거 또는 완전히 deprecated 처리
   - **작업**: 사용처 확인 후 제거 또는 에러 처리

7. **`lib/data/studentScores.ts`**
   - 레거시 함수들 정리
   - **작업**: 사용하지 않는 함수 제거

---

## 📝 상세 작업 계획

### Step 1: 사용처 추가 확인

#### 1.1 `addStudentScore` 사용처 확인
```bash
# grep으로 모든 사용처 확인
grep -r "addStudentScore" app/ --include="*.tsx" --include="*.ts"
```

#### 1.2 성적 추가 페이지 확인
- `app/(student)/scores/new/page.tsx` 존재 여부 확인
- 또는 다른 성적 추가 경로 확인

#### 1.3 대시보드 페이지 확인
- `app/(student)/scores/dashboard/page.tsx` 확인
- `fetchAllScores` 사용 여부 확인

### Step 2: 새 구조 함수 확인

#### 2.1 내신 성적 함수
- `lib/data/studentScores.ts`의 `createInternalScore`, `updateInternalScore`, `deleteInternalScore` 확인
- `app/actions/scores-internal.ts`의 `createInternalScore` 확인
- `lib/domains/score/repository.ts`의 `insertInternalScore`, `updateInternalScore`, `deleteInternalScore` 확인

#### 2.2 모의고사 성적 함수
- `lib/data/studentScores.ts`의 `createMockScore`, `updateMockScore`, `deleteMockScore` 확인
- `app/actions/scores-internal.ts`의 `createMockScore` 확인
- `lib/domains/score/repository.ts`의 `insertMockScore`, `updateMockScore`, `deleteMockScore` 확인

#### 2.3 조회 함수
- `lib/data/studentScores.ts`의 `getInternalScores`, `getMockScores` 확인
- `lib/data/scoreQueries.ts`의 `getTermScores`, `getAllTermScores` 확인

### Step 3: 마이그레이션 작업

#### 3.1 성적 수정 페이지 (`app/(student)/scores/[id]/edit/page.tsx`)

**현재 구조**:
- `student_scores` 테이블에서 조회
- `updateStudentScore` 사용

**새 구조**:
- 성적 타입 확인 (내신/모의고사)
- 해당 테이블에서 조회
- `updateInternalScore` 또는 `updateMockScore` 사용

**작업 내용**:
1. 성적 ID로 타입 확인 (내신인지 모의고사인지)
2. 해당 테이블에서 데이터 조회
3. 폼 데이터를 새 구조에 맞게 변환
4. `updateInternalScore` 또는 `updateMockScore` 호출

#### 3.2 성적 삭제 버튼 (`app/(student)/scores/_components/DeleteScoreButton.tsx`)

**현재 구조**:
- `deleteStudentScore` 사용

**새 구조**:
- 성적 타입 확인
- `deleteInternalScore` 또는 `deleteMockScore` 사용

**작업 내용**:
1. 성적 ID로 타입 확인
2. `deleteInternalScore` 또는 `deleteMockScore` 호출
3. 성적 타입 확인을 위한 헬퍼 함수 필요

#### 3.3 대시보드 유틸리티 (`app/(student)/scores/dashboard/_utils.ts`)

**현재 구조**:
- `fetchAllScores` - `student_scores` 테이블 조회

**새 구조**:
- `getInternalScores`와 `getMockScores` 조합
- 두 결과를 통합하여 반환

**작업 내용**:
1. `fetchAllScores` 함수를 새 구조로 변경
2. `getInternalScores`와 `getMockScores` 호출
3. 두 결과를 통합하여 `ScoreRow[]` 형태로 변환
4. 기존 타입과 호환성 유지

#### 3.4 분석 유틸리티 (`app/(student)/analysis/_utils.ts`)

**현재 구조**:
- `fetchAllScores` - `student_scores` 테이블 조회

**새 구조**:
- `getInternalScores`와 `getMockScores` 조합

**작업 내용**:
1. `fetchAllScores` 함수를 새 구조로 변경
2. `getInternalScores`와 `getMockScores` 호출
3. 두 결과를 통합하여 `ScoreRow[]` 형태로 변환

#### 3.5 부모 대시보드 (`app/(parent)/parent/_components/ParentDashboardContent.tsx`)

**현재 구조**:
- `fetchAllScores` 사용

**새 구조**:
- `getInternalScores`와 `getMockScores` 조합
- 또는 통합 대시보드 API 사용 (`fetchScoreDashboard`)

**작업 내용**:
1. `fetchAllScores` 대신 새 구조 사용
2. 또는 `fetchScoreDashboard` API 사용 고려

#### 3.6 레거시 액션 파일 (`app/actions/scores.ts`)

**작업 내용**:
1. 사용처 확인 후 제거 또는 에러 처리
2. 사용 중이면 새 구조로 마이그레이션
3. 사용하지 않으면 제거

#### 3.7 레거시 데이터 함수 (`lib/data/studentScores.ts`)

**작업 내용**:
1. `getStudentScores` - 이미 deprecated, 빈 배열 반환 중
2. `createStudentScore`, `updateStudentScore`, `deleteStudentScore` - 사용처 확인 후 제거

#### 3.8 월간 리포트 (`lib/reports/monthly.ts`)

**현재 상태**:
- `getMonthlyWeakSubjectTrend`에 TODO 주석 있음
- `student_scores` 참조 제거됨

**작업 내용**:
1. `student_internal_scores`와 `student_mock_scores` 조합하여 과목별 등급 계산
2. 월간 성적 변화 계산 로직 구현

### Step 4: 성적 타입 확인 헬퍼 함수

**필요성**:
- 성적 ID만으로는 내신인지 모의고사인지 알 수 없음
- 두 테이블 모두 조회하여 존재 여부 확인 필요

**구현 방안**:
```typescript
// lib/utils/scoreTypeDetector.ts
export async function detectScoreType(
  scoreId: string,
  studentId: string
): Promise<"internal" | "mock" | null> {
  const supabase = await createSupabaseServerClient();
  
  // 내신 성적 확인
  const { data: internal } = await supabase
    .from("student_internal_scores")
    .select("id")
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .maybeSingle();
  
  if (internal) return "internal";
  
  // 모의고사 성적 확인
  const { data: mock } = await supabase
    .from("student_mock_scores")
    .select("id")
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .maybeSingle();
  
  if (mock) return "mock";
  
  return null;
}
```

---

## 🔧 구현 세부사항

### 1. 성적 조회 통합 함수

```typescript
// lib/data/studentScores.ts에 추가
export async function getAllScoresUnified(
  studentId: string,
  tenantId: string
): Promise<ScoreRow[]> {
  const [internalScores, mockScores] = await Promise.all([
    getInternalScores(studentId, tenantId),
    getMockScores(studentId, tenantId),
  ]);
  
  // 두 결과를 ScoreRow 형태로 변환
  const internalRows: ScoreRow[] = internalScores.map(score => ({
    id: score.id,
    subject_type: null, // 새 구조에서는 FK 사용
    semester: score.semester.toString(),
    course: null, // 새 구조에서는 subject_id 사용
    course_detail: null, // 새 구조에서는 subject_id 사용
    raw_score: score.raw_score,
    grade: score.grade,
    score_type_detail: "내신",
    test_date: null, // 내신은 test_date 없음
    created_at: score.created_at,
  }));
  
  const mockRows: ScoreRow[] = mockScores.map(score => ({
    id: score.id,
    subject_type: null,
    semester: null,
    course: null,
    course_detail: null,
    raw_score: score.raw_score,
    grade: score.grade_score ?? null,
    score_type_detail: "모의고사",
    test_date: score.exam_date,
    created_at: score.created_at,
  }));
  
  return [...internalRows, ...mockRows].sort((a, b) => {
    const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
    const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
    return dateA - dateB;
  });
}
```

### 2. 성적 수정 액션

```typescript
// app/actions/scores-internal.ts에 추가 또는 수정
export async function updateScore(
  scoreId: string,
  formData: FormData,
  scoreType: "internal" | "mock"
) {
  if (scoreType === "internal") {
    return updateInternalScore(scoreId, formData);
  } else {
    return updateMockScore(scoreId, formData);
  }
}
```

### 3. 성적 삭제 액션

```typescript
// app/actions/scores-internal.ts에 추가 또는 수정
export async function deleteScore(
  scoreId: string,
  scoreType: "internal" | "mock"
) {
  if (scoreType === "internal") {
    return deleteInternalScore(scoreId);
  } else {
    return deleteMockScore(scoreId);
  }
}
```

---

## ✅ 체크리스트

### 작업 전
- [ ] Git 상태 확인 및 커밋
- [ ] 테스트 환경 준비
- [ ] 모든 사용처 확인 완료
- [ ] 새 구조 함수 확인 완료

### 작업 중
- [ ] 성적 수정 페이지 마이그레이션
- [ ] 성적 삭제 버튼 마이그레이션
- [ ] 대시보드 유틸리티 마이그레이션
- [ ] 분석 유틸리티 마이그레이션
- [ ] 부모 대시보드 마이그레이션
- [ ] 레거시 액션 파일 정리
- [ ] 레거시 데이터 함수 정리
- [ ] 월간 리포트 개선

### 작업 후
- [ ] 모든 테스트 통과
- [ ] 빌드 성공 확인
- [ ] 타입 에러 없음
- [ ] ESLint 에러 없음
- [ ] 문서 업데이트
- [ ] Git 커밋

---

## 🚨 주의사항

### 1. 데이터 호환성
- 기존 `ScoreRow` 타입과의 호환성 유지
- 기존 UI 컴포넌트가 정상 작동하도록 주의

### 2. 성적 타입 구분
- 내신과 모의고사를 구분하는 로직 필요
- 성적 ID만으로는 타입을 알 수 없으므로 두 테이블 모두 확인 필요

### 3. 테스트
- 각 마이그레이션 단계마다 테스트 필수
- 실제 데이터로 테스트 권장

### 4. 점진적 마이그레이션
- 한 번에 모든 것을 변경하지 말고 단계적으로 진행
- 각 단계마다 커밋

---

## 📚 참고 문서

- [Phase 3 마이그레이션 문서](./2025-02-04-phase3-difficulty-level-migration.md)
- [성적 스키마 마이그레이션 가이드](./score-schema-migration.md)
- [다음 단계 작업 정리](./2025-02-04-next-steps-summary.md)

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04

