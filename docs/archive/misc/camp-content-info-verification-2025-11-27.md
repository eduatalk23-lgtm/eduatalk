# 캠프모드 콘텐츠 정보 전달 확인 및 관리자 페이지 개선 (2025-11-27)

## 작업 개요

캠프모드에서 학생이 추가한 콘텐츠의 정보 전달을 확인하고, 관리자 페이지의 교재정보 조회 및 추천 콘텐츠 기능을 개선했습니다.

## 작업 내용

### 1. 캠프모드 콘텐츠 정보 전달 확인

#### 문제점
- 캠프모드에서 학생이 추가한 콘텐츠의 정보(콘텐츠 id, 마스터 콘텐츠 id, 상세정보 시작/끝 범위 id)가 제대로 전달되는지 확인이 필요했습니다.

#### 개선 사항
- `app/(student)/actions/campActions.ts`의 `submitCampParticipation` 함수에 로깅 추가
- 학생이 추가한 콘텐츠의 다음 정보를 로깅:
  - `content_id`: 콘텐츠 ID
  - `content_type`: 콘텐츠 유형 (book, lecture, custom)
  - `master_content_id`: 마스터 콘텐츠 ID (학생 콘텐츠가 마스터 콘텐츠와 연계된 경우)
  - `start_range`: 시작 범위 (페이지/회차)
  - `end_range`: 종료 범위 (페이지/회차)
  - `start_detail_id`: 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
  - `end_detail_id`: 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)

#### 관련 파일
- `app/(student)/actions/campActions.ts`: 콘텐츠 정보 로깅 추가
- `lib/utils/planGroupDataSync.ts`: `start_detail_id`, `end_detail_id` 전달 확인 (이미 구현됨)
- `lib/data/planGroups.ts`: `createPlanContents`에서 `start_detail_id`, `end_detail_id` 저장 확인 (이미 구현됨)

### 2. 관리자 페이지 교재정보 조회 개선

#### 문제점
- 관리자 페이지에서 교재정보를 조회할 때 null이나 빈 값이 "—"로 표시되어 "알 수 없음"으로 명확하게 표시되지 않았습니다.
- `total_pages`가 null일 때 `${book.total_pages}p`가 "nullp"로 표시되는 문제가 있었습니다.

#### 개선 사항
- `app/(student)/contents/_components/ContentDetailTable.tsx` 수정:
  - null, undefined, 빈 문자열을 "알 수 없음"으로 표시하도록 개선
- `app/(admin)/admin/master-books/[id]/page.tsx` 수정:
  - `total_pages`가 null일 때 null을 전달하도록 수정
- `app/(admin)/admin/master-lectures/[id]/page.tsx` 수정:
  - `total_episodes`가 null일 때 null을 전달하도록 수정

#### 관련 파일
- `app/(student)/contents/_components/ContentDetailTable.tsx`: null/빈 값 처리 개선
- `app/(admin)/admin/master-books/[id]/page.tsx`: 총 페이지 null 처리
- `app/(admin)/admin/master-lectures/[id]/page.tsx`: 총 회차 null 처리

### 3. 추천 콘텐츠 부족 이유 분석 및 로깅

#### 문제점
- 추천 콘텐츠가 부족한 경우 그 이유를 파악하기 어려웠습니다.
- 마스터 서비스에 테스트할 정도의 콘텐츠는 등록되어 있지만 추천이 부족한 경우 원인 파악이 필요했습니다.

#### 개선 사항
- `lib/recommendations/masterContentRecommendation.ts`에 상세 로깅 추가:
  - 추천 시작 시점 로깅: 취약 과목 수, Risk 과목 수, 성적 데이터 존재 여부
  - 각 취약 과목별 검색 결과 로깅:
    - 요청된 교재/강의 개수
    - 검색된 교재/강의 개수
    - 총 교재/강의 개수
  - 콘텐츠 부족 시 경고 로깅:
    - 요청된 개수 vs 추가된 개수
    - 사용 가능한 개수
    - 부족한 이유 (교재 부족, 강의 부족, 중복 제거)
  - 교과별 개수 파라미터가 있는 경우 부족 경고
  - 최종 추천 결과 로깅:
    - 총 추천 개수
    - 교과별 추천 개수
    - 타입별 추천 개수 (교재/강의)

#### 관련 파일
- `lib/recommendations/masterContentRecommendation.ts`: 상세 로깅 추가

## 데이터 흐름

### 캠프모드 콘텐츠 정보 전달 흐름

1. **Step3Contents.tsx**: 학생이 콘텐츠 선택 및 범위 입력
   - `start_detail_id`, `end_detail_id` 상태 관리
   - `addSelectedContents` 함수에서 콘텐츠 추가 시 상세 정보 ID 포함

2. **planGroupDataSync.ts**: WizardData → PlanGroupCreationData 변환
   - `syncWizardDataToCreationData` 함수에서 `start_detail_id`, `end_detail_id` 포함

3. **campActions.ts**: 캠프 참여 정보 제출
   - `submitCampParticipation` 함수에서:
     - `syncWizardDataToCreationData` 호출로 `start_detail_id`, `end_detail_id` 포함
     - `master_content_id` 조회 및 추가
     - 콘텐츠 정보 로깅

4. **planGroups.ts**: 데이터베이스 저장
   - `createPlanContents` 함수에서 `start_detail_id`, `end_detail_id` 저장

## 테스트 체크리스트

### 캠프모드 콘텐츠 정보 전달
- [ ] 캠프모드에서 학생이 교재를 추가할 때 `content_id`, `master_content_id`, `start_detail_id`, `end_detail_id`가 제대로 전달되는지 확인
- [ ] 캠프모드에서 학생이 강의를 추가할 때 `content_id`, `master_content_id`, `start_detail_id`, `end_detail_id`가 제대로 전달되는지 확인
- [ ] 콘솔 로그에서 콘텐츠 정보가 올바르게 출력되는지 확인

### 관리자 페이지 교재정보 조회
- [ ] 교재 상세 페이지에서 null 값이 "알 수 없음"으로 표시되는지 확인
- [ ] 교재 상세 페이지에서 빈 문자열이 "알 수 없음"으로 표시되는지 확인
- [ ] 교재 상세 페이지에서 `total_pages`가 null일 때 "알 수 없음"으로 표시되는지 확인
- [ ] 강의 상세 페이지에서 `total_episodes`가 null일 때 "알 수 없음"으로 표시되는지 확인

### 추천 콘텐츠 부족 이유 분석
- [ ] 추천 콘텐츠 요청 시 콘솔에 상세 로그가 출력되는지 확인
- [ ] 콘텐츠가 부족한 경우 경고 로그가 출력되는지 확인
- [ ] 최종 추천 결과가 교과별, 타입별로 로깅되는지 확인

## 향후 개선 사항

1. **로깅 개선**: 프로덕션 환경에서는 로깅 레벨을 조정하여 필요한 경우에만 로그 출력
2. **에러 처리**: 추천 콘텐츠 부족 시 사용자에게 더 명확한 메시지 제공
3. **성능 최적화**: 로깅이 성능에 영향을 주지 않도록 비동기 처리 고려

## 관련 문서

- `docs/camp-student-additional-content-storage.md`: 캠프 템플릿 제출 시 학생 추가 콘텐츠 저장 정보
- `docs/camp-student-content-detail-ids-storage.md`: 캠프모드에서 학생 콘텐츠의 상세 정보 ID 저장
- `docs/camp-mode-process-improvements-2025-11-27.md`: 캠프 모드 프로세스 개선 기록

