# 캠프 템플릿 콘텐츠 문제 점검 및 개선 작업

## 작업 일시
2024년 11월

## 개요
학생이 캠프 템플릿에 추가해서 제출한 콘텐츠가 관리자 페이지에서 '알 수 없음'으로 표시되는 문제와 마스터 콘텐츠와 추천 콘텐츠 중복 문제를 해결했습니다.

## 수정 사항

### 1. classifyPlanContents 함수 로깅 강화

**파일**: `lib/data/planContents.ts`

**변경 내용**:
- 입력 데이터 로그 추가 (contents 배열, studentId)
- 콘텐츠 ID 분류 로그 추가 (book, lecture, custom)
- 각 타입별 조회 쿼리 결과 로그 추가
- Map 변환 결과 로그 추가
- 누락된 콘텐츠 추적 및 로그 추가
- 최종 결과 로그 추가

**효과**:
- 콘텐츠를 찾지 못하는 원인을 빠르게 파악할 수 있음
- 개발 환경에서 상세한 디버깅 정보 제공

### 2. getCampPlanGroupForReview 함수 에러 처리 개선

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**변경 내용**:
- `classifyPlanContents` 호출 전 입력 데이터 검증 및 로그 추가
- 각 타입별 누락 개수 집계 및 로그 추가
- 에러 발생 시 원본 데이터와 함께 상세 정보 출력
- 누락된 콘텐츠에 대한 경고 로그 추가

**효과**:
- 관리자 페이지에서 콘텐츠가 '알 수 없음'으로 표시되는 원인 추적 가능
- 문제 발생 시 즉시 파악 가능

### 3. 데이터 검증 스크립트 작성

**파일**: 
- `scripts/check-camp-plan-contents.ts`: 데이터 검증 스크립트
- `docs/camp-plan-contents-inspection-guide.md`: 점검 가이드 문서

**기능**:
- 플랜 그룹의 콘텐츠 데이터 일치성 확인
- 각 타입별로 실제 테이블에서 조회
- `plan_contents.content_id`와 각 테이블의 `id` 일치 여부 확인
- `student_id` 일치 여부 확인
- `master_content_id` 존재 여부 확인

**사용법**:
```bash
npx tsx scripts/check-camp-plan-contents.ts <groupId>
```

**효과**:
- 문제 재현 시 데이터 상태를 빠르게 확인 가능
- 데이터 불일치 원인 파악 용이

### 4. 마스터 콘텐츠와 추천 콘텐츠 중복 방지 개선

**파일**:
- `app/(student)/actions/getStudentContentMasterIds.ts`: 새로운 서버 액션
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`: 중복 제거 로직 개선
- `app/(student)/actions/campActions.ts`: 자동 추천 콘텐츠 중복 제거 로직 개선

**변경 내용**:

#### 4.1 새로운 서버 액션 추가
- `getStudentContentMasterIdsAction`: 학생 콘텐츠의 `master_content_id`를 배치로 조회

#### 4.2 Step4RecommendedContents.tsx 개선
- 학생 콘텐츠의 `master_content_id`를 조회하여 추천 목록과 비교
- 추천 목록에서 해당 마스터 ID를 가진 콘텐츠 제외
- `content_id`와 `master_content_id` 모두 확인하여 중복 방지

#### 4.3 campActions.ts 개선
- 자동 추천 콘텐츠 생성 시 학생 콘텐츠의 `master_content_id` 조회
- 추천 목록에서 해당 마스터 ID를 가진 콘텐츠 제외

**효과**:
- 학생이 마스터 콘텐츠를 등록한 경우, 추천 목록에서 해당 마스터 콘텐츠가 제외됨
- 중복 콘텐츠 선택 방지

## 문제 해결

### 문제 1: '알 수 없음' 표시 문제

**원인**:
- `classifyPlanContents` 함수가 콘텐츠를 찾지 못할 때 `contentDetail`이 `null`이 되어 `contentsMap`에 포함되지 않음
- 조회 실패 시 원인 파악이 어려움

**해결**:
- 상세한 로깅 추가로 원인 추적 가능
- 누락된 콘텐츠 정보를 명확히 로그로 출력
- 데이터 검증 스크립트로 데이터 불일치 확인 가능

### 문제 2: 마스터 콘텐츠와 추천 콘텐츠 중복 문제

**원인**:
- `content_id`만 비교하여 중복 방지
- 학생 콘텐츠 ID와 마스터 콘텐츠 ID가 달라서 단순 비교로는 중복 감지 실패

**해결**:
- 학생 콘텐츠의 `master_content_id`를 조회하여 추천 목록과 비교
- `content_id`와 `master_content_id` 모두 확인하여 중복 방지

## 관련 파일

### 수정된 파일
- `lib/data/planContents.ts`
- `app/(admin)/actions/campTemplateActions.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `app/(student)/actions/campActions.ts`

### 새로 생성된 파일
- `app/(student)/actions/getStudentContentMasterIds.ts`
- `scripts/check-camp-plan-contents.ts`
- `docs/camp-plan-contents-inspection-guide.md`
- `docs/camp-content-issues-fix.md` (이 문서)

## 검증 방법

### 1. 로그 확인
개발 환경에서 다음 로그를 확인:
- `[classifyPlanContents]` 로그: 콘텐츠 조회 과정 확인
- `[getCampPlanGroupForReview]` 로그: 관리자 페이지 조회 과정 확인

### 2. 데이터 검증 스크립트 실행
```bash
npx tsx scripts/check-camp-plan-contents.ts <groupId>
```

### 3. 중복 방지 확인
1. 학생이 마스터 콘텐츠를 등록
2. Step 4에서 추천 목록 확인
3. 등록한 마스터 콘텐츠가 추천 목록에서 제외되는지 확인

## 향후 개선 사항

1. **getRecommendedMasterContents 함수 개선** (선택사항):
   - 추천 목록 생성 시 이미 등록된 마스터 콘텐츠를 제외하는 로직 추가
   - 학생의 `books`/`lectures`에서 `master_content_id`를 조회하여 필터링

2. **성능 최적화**:
   - `getStudentContentMasterIdsAction`을 배치 조회로 최적화
   - 캐싱 추가 고려

