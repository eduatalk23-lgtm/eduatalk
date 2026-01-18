# 더미 데이터 삭제 작업

**작업 일자**: 2025-02-02  
**작업 내용**: 데이터베이스의 더미 데이터 삭제 및 삭제 스크립트 개선

---

## 작업 개요

성적 대시보드 API 테스트용으로 생성된 더미 데이터를 삭제하고, 삭제 스크립트를 개선하여 모든 관련 테이블에서 데이터를 안전하게 삭제할 수 있도록 수정했습니다.

---

## 삭제된 데이터

### 삭제 결과
- **내신 성적 (student_internal_scores)**: 85개 삭제
- **학기 정보 (student_terms)**: 17개 삭제
- **학생 (students)**: 19명 삭제
  - 더미학생A_정시우위
  - 더미학생B_수시우위
  - 더미학생C_균형형

---

## 스크립트 개선 사항

### `scripts/cleanupScoreDashboardDummy.ts` 수정

#### 변경 전
- `student_school_scores` 삭제
- `student_mock_scores` 삭제
- `students` 삭제

#### 변경 후
삭제 순서를 외래 키 제약 조건을 고려하여 수정:

1. **student_internal_scores** 삭제 (새로 추가)
2. **student_school_scores** 삭제
3. **student_mock_scores** 삭제
4. **student_terms** 삭제 (새로 추가)
5. **students** 삭제

#### 주요 개선 사항
- `student_internal_scores` 테이블 삭제 로직 추가
- `student_terms` 테이블 삭제 로직 추가
- 외래 키 제약 조건을 고려한 삭제 순서 조정
- 변수명 중복 문제 해결 (`internalScores` → `schoolScores`)
- 에러 처리 개선 (테이블이 없는 경우 무시)

---

## 실행 방법

```bash
npx tsx scripts/cleanupScoreDashboardDummy.ts
```

---

## 관련 파일

- `scripts/cleanupScoreDashboardDummy.ts` - 더미 데이터 삭제 스크립트
- `scripts/seedScoreDashboardDummy.ts` - 더미 데이터 생성 스크립트
- `scripts/generate-dummy-scores.ts` - 더미 성적 생성 스크립트

---

## 참고 사항

- 마스터 테이블(curriculum_revisions, subject_groups, subjects 등)은 삭제하지 않습니다.
- 삭제 스크립트는 Service Role Key를 사용하여 RLS를 우회합니다.
- 외래 키 제약 조건을 고려하여 올바른 순서로 삭제합니다.

