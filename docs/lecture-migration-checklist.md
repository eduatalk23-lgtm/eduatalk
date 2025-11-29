# 강의 스키마 마이그레이션 체크리스트

> **작성일**: 2024년 11월 29일  
> **담당**: 백엔드/프론트엔드 개발팀  
> **예상 소요 시간**: 2-4주

---

## 📋 Phase 1: 즉시 수정 (긴급, 1-2일)

### 데이터베이스
- [x] 마이그레이션 파일 적용 (`refactor_master_lectures_and_episodes.sql`)
- [x] 마이그레이션 파일 적용 (`refactor_lectures_and_student_episodes.sql`)
- [ ] 프로덕션 DB 백업
- [ ] 스테이징 환경에서 마이그레이션 테스트
- [ ] 프로덕션 환경 마이그레이션 (배포 시)

### TypeScript 타입 정의
- [ ] `lib/types/lecture.ts` 생성 또는 업데이트
  - [ ] `MasterLecture` 인터페이스
  - [ ] `LectureEpisode` 인터페이스
  - [ ] `Lecture` 인터페이스
  - [ ] `StudentLectureEpisode` 인터페이스
- [ ] 타입 export 확인
- [ ] 기존 타입 사용 코드 확인

### 빌드 에러 수정
- [ ] TypeScript 빌드 실행 (`npm run build`)
- [ ] 에러 발생 파일 목록 작성
- [ ] 컬럼명 변경 에러 수정
  - [ ] `master_content_id` → `master_lecture_id`
  - [ ] `platform` → `platform_name`
  - [ ] `episode_title` → `title`
  - [ ] `duration` 삭제 대응
- [ ] 빌드 성공 확인

---

## 🔧 Phase 2: 코드 수정 (1주)

### Server Actions

#### `app/actions/lectures.ts` (또는 해당 파일)
- [ ] 파일 존재 여부 확인
- [ ] 강의 CRUD 함수 수정
  - [ ] `createLecture`: master_lecture_id 사용
  - [ ] `updateLecture`: 새 컬럼 지원
  - [ ] `deleteLecture`: CASCADE 확인
- [ ] 회차 관리 함수 추가
  - [ ] `createLectureEpisode`
  - [ ] `updateLectureEpisode`
  - [ ] `deleteLectureEpisode`

#### `app/(student)/actions/masterContentActions.ts`
- [ ] `master_content_id` → `master_lecture_id` 변경
- [ ] 강의 할당 로직 수정
- [ ] 진도 업데이트 함수 수정

### Data Fetching

#### `lib/data/lectures.ts` (생성 필요)
- [ ] 파일 생성
- [ ] 기본 CRUD 함수
  - [ ] `getLectureById`
  - [ ] `getLecturesByStudent`
  - [ ] `getLecturesByTenant`
- [ ] JOIN 쿼리 함수
  - [ ] `getLectureWithMaster`
  - [ ] `getLectureWithEpisodes`
  - [ ] `getLectureWithProgress`

#### `lib/data/masterLectures.ts` (생성 필요)
- [ ] 파일 생성
- [ ] 마스터 강의 조회 함수
  - [ ] `getMasterLectureById`
  - [ ] `getMasterLectures` (필터링 지원)
  - [ ] `searchMasterLectures` (검색)
- [ ] 교육과정 기반 필터링
  - [ ] `getMasterLecturesByCurriculum`
  - [ ] `getMasterLecturesBySubject`
  - [ ] `getMasterLecturesByGrade`

#### 기존 데이터 페칭 파일 수정
- [ ] 컬럼명 변경 대응
- [ ] 새 컬럼 추가
- [ ] JOIN 쿼리 업데이트

### Components

#### 관리자 UI (`app/(admin)/admin/master-lectures/`)
- [ ] 디렉토리 존재 여부 확인
- [ ] 강의 목록 페이지
  - [ ] 컬럼명 변경 대응
  - [ ] 새 필드 표시 (플랫폼, 과목, 학년 등)
  - [ ] 필터링 기능 추가
- [ ] 강의 등록 페이지
  - [ ] 교육과정 선택 UI
  - [ ] 과목 선택 UI
  - [ ] 플랫폼 선택 UI
  - [ ] 학년 범위 입력
  - [ ] 태그 입력
- [ ] 강의 수정 페이지
  - [ ] 기존 데이터 로드 확인
  - [ ] 새 필드 수정 지원
- [ ] 회차 관리 UI
  - [ ] 회차 목록 표시
  - [ ] 회차 추가/수정/삭제

#### 학생 UI (`app/(student)/contents/`)
- [ ] 강의 목록 페이지
  - [ ] 컬럼명 변경 대응
  - [ ] 진도율 표시 (`progress`)
  - [ ] 필터링 (과목, 난이도 등)
- [ ] 강의 상세 페이지
  - [ ] 마스터 정보 표시 (JOIN)
  - [ ] 회차 목록 표시
  - [ ] 진도 상태 표시
- [ ] 강의 시청 페이지
  - [ ] 시청 시간 추적 (`watched_seconds`)
  - [ ] 완료 처리 (`is_completed`)
  - [ ] 메모 기능 (`note`)

---

## ✨ Phase 3: 새 기능 개발 (1-2주)

### 진도 관리 시스템
- [ ] 회차별 진도 추적
  - [ ] 시청 시간 기록
  - [ ] 완료 여부 표시
  - [ ] 마지막 시청 시간 저장
- [ ] 강의별 진도율 계산
  - [ ] `completed_episodes` 자동 업데이트
  - [ ] `progress` 자동 계산
- [ ] 진도 현황 대시보드
  - [ ] 학생별 강의 진도 차트
  - [ ] 과목별 진도 통계

### 교육과정 기반 필터링
- [ ] 교육과정 개정 필터
- [ ] 과목 필터
- [ ] 학년 필터
- [ ] 난이도 필터
- [ ] 플랫폼 필터
- [ ] 태그 기반 검색

### 강의 추천 시스템
- [ ] 학생 성적 기반 추천
- [ ] 교육과정 기반 추천
- [ ] 난이도 기반 추천
- [ ] 인기 강의 추천

---

## 🔄 Phase 4: 레거시 코드 정리 (2-3주)

### lectures 테이블 레거시 컬럼 마이그레이션
- [ ] `platform` 사용 코드 → `master_lectures.platform_id` 변경
- [ ] `subject` 사용 코드 → `master_lectures.subject_id` 변경
- [ ] `chapter_info` 사용 코드 → `lecture_episodes` 변경
- [ ] 코드 검증 완료 후 레거시 컬럼 제거 고려

### master_episode_id 활용
- [ ] `student_lecture_episodes`에서 `master_episode_id` 설정
- [ ] 마스터 회차 정보 동기화 로직 구현
- [ ] 회차 정보 변경 시 자동 업데이트

---

## ✅ 테스트 체크리스트

### 단위 테스트
- [ ] 강의 CRUD 함수 테스트
- [ ] 회차 CRUD 함수 테스트
- [ ] 진도 업데이트 함수 테스트
- [ ] 교육과정 필터링 테스트

### 통합 테스트
- [ ] 관리자: 강의 등록 플로우
- [ ] 관리자: 회차 관리 플로우
- [ ] 학생: 강의 조회 플로우
- [ ] 학생: 강의 시청 플로우
- [ ] 진도 추적 정확성

### E2E 테스트
- [ ] 강의 생명주기 전체 (등록 → 할당 → 시청 → 완료)
- [ ] 진도 동기화 (회차 완료 → 강의 진도율 업데이트)
- [ ] CASCADE 삭제 (강의 삭제 → 회차 삭제)

### 성능 테스트
- [ ] 강의 목록 조회 속도
- [ ] 강의 상세 조회 (JOIN) 속도
- [ ] 진도 업데이트 속도
- [ ] 인덱스 최적화 필요 여부 확인

---

## 📊 진행 상황 추적

### 전체 진행률
- Phase 1: ▓▓░░░░░░░░ 20% (2/10 완료)
- Phase 2: ░░░░░░░░░░ 0% (0/15 완료)
- Phase 3: ░░░░░░░░░░ 0% (0/10 완료)
- Phase 4: ░░░░░░░░░░ 0% (0/5 완료)

**총 진행률**: 5% (2/40 완료)

### 담당자 배정
- [ ] Phase 1 담당자: ________________
- [ ] Phase 2 담당자: ________________
- [ ] Phase 3 담당자: ________________
- [ ] Phase 4 담당자: ________________

### 일정
- [ ] Phase 1 완료 목표일: ____/____/____
- [ ] Phase 2 완료 목표일: ____/____/____
- [ ] Phase 3 완료 목표일: ____/____/____
- [ ] Phase 4 완료 목표일: ____/____/____

---

## 🐛 이슈 트래킹

### 발견된 이슈
| 번호 | 이슈 내용 | 심각도 | 상태 | 담당자 |
|------|-----------|--------|------|--------|
| 1 | - | - | - | - |

### 해결된 이슈
| 번호 | 이슈 내용 | 해결 방법 | 해결일 |
|------|-----------|-----------|--------|
| 1 | - | - | - |

---

## 📚 참고 자료

- [강의 스키마 리팩토링 상세 가이드](./lecture-schema-refactoring.md)
- [강의 스키마 빠른 참조](./lecture-schema-quick-reference.md)
- [ERD 다이어그램](../timetable/erd-cloud/)

---

## 💬 회의록

### 2024-11-29: 킥오프 미팅
- 참석자: 
- 결정 사항:
- 다음 회의 일정:

---

**마지막 업데이트**: 2024년 11월 29일  
**다음 검토일**: ____/____/____

