# 캠프 플랜 그룹 콘텐츠 점검 가이드

## 개요

학생이 캠프 템플릿에 추가해서 제출한 콘텐츠가 관리자 페이지에서 '알 수 없음'으로 표시되는 문제를 점검하기 위한 가이드입니다.

## 문제 현상

관리자 페이지의 '남은 단계 진행하기' 단계에서 학생이 추가한 콘텐츠(book, lecture, custom 모두)가 '알 수 없음'으로 표시됩니다.

## 점검 방법

### 1. 데이터베이스 직접 확인

#### 1.1 검증 스크립트 사용

```bash
npx tsx scripts/check-camp-plan-contents.ts <groupId>
```

이 스크립트는 다음을 확인합니다:
- `plan_contents` 테이블에서 해당 그룹의 모든 콘텐츠 조회
- 각 타입별로 실제 테이블에서 조회:
  - `books` 테이블에서 해당 학생의 교재 조회 (master_content_id 포함)
  - `lectures` 테이블에서 해당 학생의 강의 조회 (master_content_id 포함)
  - `student_custom_contents` 테이블에서 해당 학생의 커스텀 콘텐츠 조회
- `plan_contents.content_id`와 각 테이블의 `id` 일치 여부 확인
- `student_id` 일치 여부 확인
- `master_content_id` 존재 여부 확인

#### 1.2 수동 확인 (Supabase 대시보드)

1. **plan_contents 테이블 확인**
   ```sql
   SELECT * FROM plan_contents 
   WHERE plan_group_id = '<groupId>'
   ORDER BY display_order;
   ```

2. **books 테이블 확인**
   ```sql
   SELECT id, title, subject, master_content_id, student_id 
   FROM books 
   WHERE student_id = '<studentId>' 
   AND id IN (
     SELECT content_id FROM plan_contents 
     WHERE plan_group_id = '<groupId>' AND content_type = 'book'
   );
   ```

3. **lectures 테이블 확인**
   ```sql
   SELECT id, title, subject, master_content_id, student_id 
   FROM lectures 
   WHERE student_id = '<studentId>' 
   AND id IN (
     SELECT content_id FROM plan_contents 
     WHERE plan_group_id = '<groupId>' AND content_type = 'lecture'
   );
   ```

4. **student_custom_contents 테이블 확인**
   ```sql
   SELECT id, title, content_type, student_id 
   FROM student_custom_contents 
   WHERE student_id = '<studentId>' 
   AND id IN (
     SELECT content_id FROM plan_contents 
     WHERE plan_group_id = '<groupId>' AND content_type = 'custom'
   );
   ```

### 2. 로그 확인

개발 환경에서 다음 로그를 확인하세요:

1. **classifyPlanContents 함수 로그**
   - 입력 데이터 로그
   - 각 타입별 조회 쿼리 결과
   - Map 변환 결과
   - 누락된 콘텐츠 정보
   - 최종 결과

2. **getCampPlanGroupForReview 함수 로그**
   - 콘텐츠 상세 정보 조회 시작/완료 로그
   - 누락된 콘텐츠 집계
   - 에러 발생 시 상세 정보

## 예상 원인

### 1. student_id 불일치
- `classifyPlanContents`에 전달되는 `studentId`와 실제 콘텐츠의 소유자 불일치
- `getCampPlanGroupForReview`에서 `result.group.student_id`를 사용하는데, 이 값이 올바른지 확인 필요

### 2. content_id 불일치
- `plan_contents.content_id`와 실제 테이블(`books`, `lectures`, `student_custom_contents`)의 `id` 불일치
- 학생이 콘텐츠를 추가할 때 잘못된 ID가 저장되었을 가능성

### 3. 쿼리 조건 문제
- `classifyPlanContents`의 조회 조건이 너무 엄격하여 실제 데이터를 찾지 못함
- `student_id` 필터링이 잘못되었을 가능성

### 4. 에러 처리 부족
- 조회 실패 시 조용히 실패하여 원인 파악이 어려움
- `contentDetail`이 `null`이 되어도 로그가 없음 (이제 개선됨)

## 해결 방법

### 1. 데이터 불일치 확인
- 검증 스크립트를 실행하여 데이터 불일치 확인
- 불일치가 발견되면 해당 콘텐츠의 `content_id`와 실제 테이블의 `id`를 비교

### 2. 로그 확인
- 개발 환경에서 로그를 확인하여 어느 단계에서 문제가 발생하는지 파악
- 누락된 콘텐츠 정보를 확인하여 원인 추적

### 3. 수정
- 데이터 불일치가 발견되면 `plan_contents` 테이블의 `content_id`를 올바른 값으로 수정
- 또는 학생 콘텐츠가 실제로 존재하는지 확인하고, 없으면 재등록 유도

## 관련 파일

- `lib/data/planContents.ts`: `classifyPlanContents` 함수
- `app/(admin)/actions/campTemplateActions.ts`: `getCampPlanGroupForReview` 함수
- `scripts/check-camp-plan-contents.ts`: 데이터 검증 스크립트

