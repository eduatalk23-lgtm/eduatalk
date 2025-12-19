# Phase 4: 레거시 student_scores 테이블 마이그레이션 완료

**작성일**: 2025-02-04  
**작업 상태**: ✅ 완료

---

## 📋 작업 개요

레거시 `student_scores` 테이블을 새로운 구조로 완전히 마이그레이션했습니다:
- **내신 성적**: `student_internal_scores` 테이블
- **모의고사 성적**: `student_mock_scores` 테이블

---

## ✅ 완료된 작업

### 1. 성적 타입 확인 헬퍼 함수 구현

**파일**: `lib/utils/scoreTypeDetector.ts`

- `detectScoreType()`: 성적 ID로 타입 확인 (내신/모의고사)
- `getScoreById()`: 성적 데이터 조회 (타입 자동 감지)

### 2. 내신/모의고사 성적 CRUD 함수 추가

**파일**: `lib/data/studentScores.ts`
- `updateInternalScore()`: 내신 성적 업데이트
- `deleteInternalScore()`: 내신 성적 삭제

**파일**: `app/actions/scores-internal.ts`
- `updateInternalScore()`: 내신 성적 수정 (FormData)
- `updateMockScore()`: 모의고사 성적 수정 (FormData)
- `deleteInternalScore()`: 내신 성적 삭제
- `deleteMockScore()`: 모의고사 성적 삭제
- `deleteScore()`: 성적 삭제 (타입 자동 감지)

### 3. 성적 수정 페이지 마이그레이션

**파일**: `app/(student)/scores/[id]/edit/page.tsx`

- 성적 타입 자동 감지
- 내신/모의고사에 따라 적절한 액션 호출
- 레거시 ScoreForm과의 호환성 유지

### 4. 성적 삭제 버튼 마이그레이션

**파일**: `app/(student)/scores/_components/DeleteScoreButton.tsx`

- `deleteScore()` 서버 액션 사용 (타입 자동 감지)
- 클라이언트 컴포넌트에서 간단하게 사용 가능

### 5. 대시보드 유틸리티 마이그레이션

**파일**: `app/(student)/scores/dashboard/_utils.ts`

- `fetchAllScores()` 함수를 새 구조로 변경
- `getInternalScores()`와 `getMockScores()` 조합
- 레거시 `ScoreRow` 형태로 변환하여 하위 호환성 유지

### 6. 분석 유틸리티 마이그레이션

**파일**: `app/(student)/analysis/_utils.ts`

- `fetchAllScores()` 함수를 새 구조로 변경
- `calculateAllRiskIndices()`에 `tenantId` 파라미터 추가

**파일**: `app/(student)/analysis/page.tsx`
- `tenantId` 조회 및 전달

**파일**: `app/(student)/analysis/_actions.ts`
- `tenantId` 조회 및 전달

### 7. 부모 대시보드 마이그레이션

**파일**: `app/(parent)/parent/_components/ParentDashboardContent.tsx`

- `tenantId` 조회 및 `fetchAllScores()` 호출 시 전달
- `calculateAllRiskIndices()` 호출 시 `tenantId` 전달

### 8. 레거시 코드 정리

**파일**: `app/actions/scores.ts`
- 모든 함수에 `@deprecated` 주석 추가
- 사용하지 않도록 명확히 표시

**파일**: `lib/data/studentScores.ts`
- 레거시 함수들에 `@deprecated` 주석 추가
- `createStudentScore`, `updateStudentScore`, `deleteStudentScore` deprecated 표시

---

## 🔄 마이그레이션 전후 비교

### 이전 구조 (레거시)

```typescript
// 단일 테이블 사용
await supabase.from("student_scores").select("*");

// 단일 함수 사용
await addStudentScore(formData);
await updateStudentScore(id, formData);
await deleteStudentScore(id);
```

### 새 구조

```typescript
// 내신/모의고사 분리
await getInternalScores(studentId, tenantId);
await getMockScores(studentId, tenantId);

// 타입별 함수 사용
await createInternalScore(formData);
await createMockScore(formData);
await updateInternalScore(scoreId, formData);
await updateMockScore(scoreId, formData);
await deleteScore(scoreId); // 타입 자동 감지
```

---

## 📊 변경된 파일 목록

### 새로 생성된 파일
- `lib/utils/scoreTypeDetector.ts` - 성적 타입 확인 유틸리티

### 수정된 파일
1. `lib/data/studentScores.ts` - 내신 성적 update/delete 함수 추가, 레거시 함수 deprecated 표시
2. `app/actions/scores-internal.ts` - update/delete 함수 추가
3. `app/(student)/scores/[id]/edit/page.tsx` - 새 구조로 마이그레이션
4. `app/(student)/scores/_components/DeleteScoreButton.tsx` - 새 구조로 마이그레이션
5. `app/(student)/scores/dashboard/_utils.ts` - 새 구조로 마이그레이션
6. `app/(student)/analysis/_utils.ts` - 새 구조로 마이그레이션
7. `app/(student)/analysis/page.tsx` - tenantId 추가
8. `app/(student)/analysis/_actions.ts` - tenantId 추가
9. `app/(parent)/parent/_components/ParentDashboardContent.tsx` - tenantId 추가
10. `app/actions/scores.ts` - deprecated 표시 강화

---

## 🎯 주요 개선사항

### 1. 타입 안전성 향상
- 성적 타입 자동 감지로 오류 방지
- 명시적인 타입 구분 (내신/모의고사)

### 2. 코드 일관성
- 모든 성적 관련 작업이 새 구조 사용
- 레거시 코드는 명확히 deprecated 표시

### 3. 하위 호환성 유지
- 레거시 `ScoreRow` 타입 유지
- 기존 UI 컴포넌트와의 호환성 보장

### 4. 데이터 구조 개선
- `student_terms`를 통한 학기 정보 관리
- 정규화된 데이터 구조

---

## ⚠️ 주의사항

### 1. 레거시 함수 사용 금지
다음 함수들은 더 이상 사용하지 마세요:
- `app/actions/scores.ts`의 모든 함수
- `lib/data/studentScores.ts`의 `createStudentScore`, `updateStudentScore`, `deleteStudentScore`

### 2. tenantId 필수
새 구조의 모든 함수는 `tenantId`가 필수입니다. 호출 시 반드시 전달해야 합니다.

### 3. 성적 타입 확인
성적 ID만으로는 내신인지 모의고사인지 알 수 없으므로, `detectScoreType()` 함수를 사용하세요.

---

## 📝 다음 단계

### 완료된 작업
- ✅ 성적 타입 확인 헬퍼 함수 구현
- ✅ 내신/모의고사 성적 CRUD 함수 추가
- ✅ 성적 수정/삭제 페이지 마이그레이션
- ✅ 대시보드 및 분석 유틸리티 마이그레이션
- ✅ 레거시 코드 정리

### 향후 개선 사항
1. **레거시 함수 완전 제거** (선택사항)
   - `app/actions/scores.ts` 파일 제거 고려
   - `lib/data/studentScores.ts`의 레거시 함수 제거 고려

2. **월간 리포트 개선**
   - `lib/reports/monthly.ts`의 `getMonthlyWeakSubjectTrend` 함수 개선
   - `student_internal_scores`와 `student_mock_scores` 조합하여 과목별 등급 계산

3. **ScoreForm 컴포넌트 개선** (선택사항)
   - 새 구조에 맞는 폼 컴포넌트로 개선
   - 내신/모의고사 구분 입력 폼

---

## 🔗 관련 문서

- [Phase 4 마이그레이션 계획](./2025-02-04-phase4-student-scores-migration-plan.md)
- [다음 단계 작업 정리](./2025-02-04-next-steps-summary.md)
- [성적 스키마 마이그레이션 가이드](./score-schema-migration.md)

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04

