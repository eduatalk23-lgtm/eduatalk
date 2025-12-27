# 도메인 아키텍처 분석 (2025년 12월)

## 도메인 구조 개요

`lib/domains/` 아래 23개 도메인으로 구성됨

```
lib/domains/
├── admin-plan/    # 관리자 플랜 관리
├── analysis/      # 분석/코칭
├── attendance/    # 출석 관리
├── auth/          # 인증
├── block/         # 블록 (시간표)
├── camp/          # 캠프 (가장 큰 도메인)
├── content/       # 콘텐츠 (학생용)
├── content-metadata/  # 콘텐츠 메타데이터
├── goal/          # 학습 목표
├── master-content/    # 마스터 콘텐츠 (관리자용)
├── parent/        # 학부모
├── plan/          # 플랜
├── qrCode/        # QR코드 출석
├── school/        # 학교
├── score/         # 성적
├── settings/      # 설정
├── sms/           # SMS 발송
├── student/       # 학생
├── subject/       # 과목
├── superadmin/    # 슈퍼관리자
├── tenant/        # 테넌트 (학원)
├── today/         # 오늘 학습
└── user/          # 사용자 관리
```

---

## 1. Student 도메인

### 경로
`lib/domains/student/`

### 파일 구조
```
student/
├── repository.ts      # 데이터 접근
├── types.ts           # 타입 정의
├── index.ts           # 내보내기
└── actions/
    ├── consulting.ts  # 상담
    ├── parentLinks.ts # 부모 연결
    ├── notifications.ts # 알림
    ├── management.ts  # 관리 (CRUD)
    ├── profile.ts     # 프로필
    ├── divisions.ts   # 반/분반
    └── sessions.ts    # 세션
```

### 주요 함수 (management.ts)
| 함수 | 설명 |
|------|------|
| `createStudent` | 학생 생성 |
| `updateStudentInfo` | 학생 정보 수정 |
| `deleteStudent` | 학생 삭제 |
| `bulkDeleteStudents` | 대량 삭제 (배치 처리) |
| `toggleStudentStatus` | 상태 토글 |
| `bulkToggleStudentStatus` | 대량 상태 토글 |
| `updateStudentClass` | 반 변경 |
| `generateConnectionCode` | 연결 코드 생성 |
| `regenerateConnectionCode` | 연결 코드 재생성 |

### 타입 정의
```typescript
Student, StudentInsert, StudentUpdate
StudentActionResult
GetStudentsFilter
StudentSearchResult, StudentSearchApiResponse
```

---

## 2. Score 도메인

### 경로
`lib/domains/score/`

### 파일 구조
```
score/
├── validation.ts   # 검증
├── repository.ts   # 데이터 접근
├── types.ts        # 타입 정의
├── service.ts      # 비즈니스 로직
├── index.ts        # 내보내기
└── actions/
    ├── student.ts  # 학생용 액션
    └── core.ts     # 핵심 액션
```

### 주요 함수 (service.ts)
| 함수 | 설명 |
|------|------|
| `getMockScores` | 모의고사 점수 조회 |
| `getMockScoreById` | 개별 모의고사 조회 |
| `createMockScore` | 모의고사 점수 생성 |
| `updateMockScore` | 모의고사 점수 수정 |
| `deleteMockScore` | 모의고사 점수 삭제 |
| `calculateAverageGrade` | 평균 등급 계산 |
| `getScoreTrendBySubject` | 과목별 추이 분석 |

### 타입 정의
```typescript
// 모의고사
MockScore, MockScoreInsert, MockScoreUpdate
MockExamType, CreateMockScoreInput, UpdateMockScoreInput

// 학교 성적
SchoolScore, SchoolScoreInsert, SchoolScoreUpdate
CreateSchoolScoreInput, UpdateSchoolScoreInput

// 내신 (내부)
InternalScore, InternalScoreInsert, InternalScoreUpdate
CreateInternalScoreInput, UpdateInternalScoreInput

// 통합
StudentScore, ScoreActionResult
GetMockScoresFilter, GetSchoolScoresFilter
```

---

## 3. Attendance 도메인

### 경로
`lib/domains/attendance/`

### 파일 구조
```
attendance/
├── repository.ts   # 데이터 접근
├── statistics.ts   # 통계
├── utils.ts        # 유틸리티
├── types.ts        # 타입 정의
├── service.ts      # 비즈니스 로직
├── index.ts        # 내보내기
└── actions/
    ├── student.ts  # 학생용 액션
    ├── smsLogs.ts  # SMS 로그
    ├── settings.ts # 설정
    ├── qrCode.ts   # QR코드
    └── attendance.ts # 출석 기록
```

### 주요 함수 (service.ts)
| 함수 | 설명 |
|------|------|
| `recordAttendance` | 출석 기록 |
| `getAttendanceRecords` | 출석 기록 조회 |
| `getAttendanceByStudent` | 학생별 출석 조회 |
| `deleteAttendanceRecord` | 출석 기록 삭제 |
| `calculateAttendanceStats` | 출석 통계 계산 |
| `calculateAttendanceStatsWithFilters` | 필터링된 통계 |
| `validateAttendanceRecord` | 출석 기록 검증 |
| `validateAttendanceTimes` | 시간 검증 |
| `validateNoDuplicateAttendance` | 중복 체크 |
| `validateAttendanceStatusConsistency` | 상태 일관성 |
| `validateAttendanceMethodConsistency` | 방법 일관성 |

### 타입 정의
```typescript
AttendanceRecord
AttendanceStatus  // 출석/지각/조퇴/결석 등
CheckMethod       // QR/수동/자동 등
AttendanceStatistics
AttendanceFilters
CreateAttendanceRecordInput, UpdateAttendanceRecordInput
ValidationResult, ValidationError

// 상수
ATTENDANCE_STATUS_LABELS
CHECK_METHOD_LABELS
```

---

## 4. Content 도메인

### 경로
`lib/domains/content/`

### 파일 구조
```
content/
├── index.ts
└── actions/
    ├── student.ts          # 학생 콘텐츠 CRUD
    ├── master-admin.ts     # 마스터 콘텐츠 관리
    ├── master-search.ts    # 마스터 콘텐츠 검색
    ├── student-master-ids.ts # 학생-마스터 연결
    ├── details.ts          # 상세 정보
    ├── recommendations.ts  # 추천
    ├── metadata.ts         # 메타데이터
    └── fetch.ts            # 조회
```

### 주요 함수 (student.ts)
| 함수 | 설명 |
|------|------|
| `addBook` | 교재 추가 |
| `addLecture` | 강의 추가 |
| `addCustomContent` | 커스텀 콘텐츠 추가 |
| `updateBook` | 교재 수정 |
| `updateLecture` | 강의 수정 |
| `updateCustomContent` | 커스텀 수정 |
| `deleteBook` | 교재 삭제 |
| `deleteLecture` | 강의 삭제 |
| `deleteBooks` | 교재 대량 삭제 |
| `deleteLectures` | 강의 대량 삭제 |
| `deleteCustomContent` | 커스텀 삭제 |
| `createBookWithoutRedirect` | 리다이렉트 없이 교재 생성 |

### 상세 정보 저장 (details.ts)
```typescript
saveBookDetailsAction     // 교재 상세 (챕터, 페이지)
saveLectureEpisodesAction // 강의 에피소드
```

### 추천 (recommendations.ts)
```typescript
getRecommendedMasterContentsAction // 추천 마스터 콘텐츠
```

---

## 5. Block 도메인

### 경로
`lib/domains/block/`

### 파일 구조
```
block/
├── repository.ts   # 데이터 접근
├── types.ts        # 타입 정의
├── actions.ts      # Server Actions
├── service.ts      # 비즈니스 로직
└── index.ts
```

### 주요 함수 (service.ts)
| 함수 | 설명 |
|------|------|
| `addBlock` | 블록 추가 |
| `updateBlock` | 블록 수정 |
| `deleteBlock` | 블록 삭제 |
| `duplicateBlock` | 블록 복제 |
| `addBlocksToMultipleDays` | 여러 요일에 블록 추가 |
| `checkTimeOverlap` | 시간 중복 체크 |
| `getAcademySchedulesForDay` | 학원 스케줄 조회 |
| `resolveBlockSetId` | 블록세트 ID 해석 |

### 상수
```typescript
DAY_NAMES // 요일 이름
```

---

## 6. Parent 도메인

### 경로
`lib/domains/parent/`

### 파일 구조
```
parent/
├── utils.ts        # 유틸리티
├── types.ts        # 타입 정의
├── index.ts
└── actions/
    ├── settings.ts      # 설정
    └── linkRequests.ts  # 연결 요청
```

### 주요 함수 (linkRequests.ts)
| 함수 | 설명 |
|------|------|
| `createLinkRequest` | 연결 요청 생성 |
| `cancelLinkRequest` | 연결 요청 취소 |
| `getLinkRequests` | 연결 요청 조회 |
| `searchStudentsForLink` | 연결할 학생 검색 |

### 타입
```typescript
LinkRequestWithStudent
```

---

## 7. School 도메인

### 경로
`lib/domains/school/`

### 파일 구조
```
school/
├── validation.ts   # 검증
├── repository.ts   # 데이터 접근
├── types.ts        # 타입 정의
├── service.ts      # 비즈니스 로직
├── index.ts
└── actions/
    ├── student.ts  # 학생용 액션
    ├── admin.ts    # 관리자용 액션
    └── core.ts     # 핵심 액션
```

### 주요 함수 (service.ts)
| 함수 | 설명 |
|------|------|
| `getAllSchools` | 모든 학교 조회 |
| `searchSchools` | 학교 검색 |
| `createSchool` | 학교 생성 |
| `updateSchool` | 학교 수정 |
| `deleteSchool` | 학교 삭제 |
| `getSchoolByName` | 이름으로 학교 조회 |
| `getSchoolByUnifiedId` | 통합 ID로 조회 |
| `getSchoolInfoById` | 학교 정보 조회 |
| `getSchoolInfoList` | 학교 정보 목록 |
| `searchSchoolInfo` | 학교 정보 검색 |
| `autoRegisterSchool` | 자동 등록 |
| `checkDuplicateSchool` | 중복 체크 |
| `getUniversities` | 대학교 목록 |
| `getUniversityCampuses` | 대학 캠퍼스 목록 |
| `searchUniversityCampuses` | 캠퍼스 검색 |
| `getAllRegions` | 모든 지역 |
| `getRegionsByLevel` | 레벨별 지역 |
| `getRegionsByParent` | 상위 지역별 |
| `findRegionIdByName` | 이름으로 지역 ID |
| `isValidRegionId` | 지역 ID 검증 |

### 상수
```typescript
SCHOOL_TYPE_MAP_INTERNAL
SCHOOL_TYPE_REVERSE_MAP_INTERNAL
```

---

## 8. Subject 도메인

### 경로
`lib/domains/subject/`

### 파일 구조
```
subject/
├── types.ts
├── index.ts
└── actions/
    ├── core.ts     # 핵심 액션
    └── excel/
        ├── export.ts  # 엑셀 내보내기
        └── import.ts  # 엑셀 가져오기
```

### 특징
- 과목/교과 관리
- 엑셀 import/export 지원

---

## 9. Tenant 도메인

### 경로
`lib/domains/tenant/`

### 파일 구조
```
tenant/
├── blockSets.ts   # 테넌트 블록세트
├── settings.ts    # 테넌트 설정
├── types.ts       # 타입 정의
├── actions.ts     # Server Actions
├── users.ts       # 테넌트 사용자
└── index.ts
```

### 주요 함수 (blockSets.ts)
| 함수 | 설명 |
|------|------|
| `getTenantBlockSets` | 블록세트 조회 |
| `createTenantBlockSet` | 블록세트 생성 |
| `updateTenantBlockSet` | 블록세트 수정 |
| `deleteTenantBlockSet` | 블록세트 삭제 |
| `addTenantBlock` | 블록 추가 |
| `deleteTenantBlock` | 블록 삭제 |
| `addTenantBlocksToMultipleDays` | 여러 요일에 블록 추가 |

---

## 10. SMS 도메인

### 경로
`lib/domains/sms/`

### 파일 구조
```
sms/
├── types.ts
├── actions.ts
└── index.ts
```

### 주요 함수
| 함수 | 설명 |
|------|------|
| `sendAttendanceSMS` | 출석 SMS 발송 |
| `sendAttendanceSMSInternal` | 내부용 출석 SMS |
| `sendBulkAttendanceSMS` | 대량 출석 SMS |
| `sendGeneralSMS` | 일반 SMS |
| `sendBulkGeneralSMS` | 대량 일반 SMS |
| `determineRecipientPhones` | 수신자 번호 결정 |

---

## 11. Goal 도메인

### 경로
`lib/domains/goal/`

### 파일 구조
```
goal/
├── actions.ts
└── index.ts
```

### 주요 함수
| 함수 | 설명 |
|------|------|
| `getAllGoalsAction` | 모든 목표 조회 |
| `createGoalAction` | 목표 생성 |
| `updateGoalAction` | 목표 수정 |
| `deleteGoalAction` | 목표 삭제 |
| `recordGoalProgressAction` | 목표 진행 기록 |

---

## 12. QRCode 도메인

### 경로
`lib/domains/qrCode/`

### 파일 구조
```
qrCode/
├── repository.ts
├── service.ts
└── index.ts
```

### 주요 함수
| 함수 | 설명 |
|------|------|
| `createQRCode` | QR코드 생성 |
| `getActiveQRCode` | 활성 QR코드 조회 |
| `getQRCodeById` | ID로 QR코드 조회 |
| `getQRCodeHistory` | QR코드 이력 |
| `verifyAndUpdateQRCode` | QR코드 검증 및 업데이트 |
| `deactivateQRCode` | QR코드 비활성화 |

---

## 13. Analysis 도메인

### 경로
`lib/domains/analysis/`

### 파일 구조
```
analysis/
├── utils.ts
├── types.ts
├── index.ts
└── actions/
    └── riskIndex.ts  # 위험 지수
```

### 주요 함수
| 함수 | 설명 |
|------|------|
| `recalculateRiskIndex` | 위험 지수 재계산 |

---

## 14. User 도메인

### 경로
`lib/domains/user/`

### 파일 구조
```
user/
├── index.ts
└── actions/
    ├── admin.ts      # 관리자 사용자
    └── unverified.ts # 미인증 사용자
```

### 주요 함수
| 함수 | 설명 |
|------|------|
| `createAdminUser` | 관리자 생성 |
| `deleteAdminUser` | 관리자 삭제 |

---

## 15. Superadmin 도메인

### 경로
`lib/domains/superadmin/`

### 파일 구조
```
superadmin/
├── types.ts
├── index.ts
└── actions/
    ├── tenantlessUsers.ts    # 테넌트 없는 사용자
    ├── curriculumSettings.ts # 교육과정 설정
    └── terms.ts              # 학기
```

### 주요 함수
| 함수 | 설명 |
|------|------|
| `getCurriculumSettings` | 교육과정 설정 조회 |
| `updateCurriculumSettings` | 교육과정 설정 수정 |

---

## 16. Master-Content 도메인

### 경로
`lib/domains/master-content/`

### 파일 구조
```
master-content/
├── index.ts
└── actions/
    ├── books/
    │   ├── export.ts  # 교재 내보내기
    │   └── import.ts  # 교재 가져오기
    └── lectures/
        ├── export.ts  # 강의 내보내기
        └── import.ts  # 강의 가져오기
```

### 특징
- 마스터 콘텐츠 (관리자용)
- 엑셀 import/export 지원

---

## 도메인별 아키텍처 패턴

### 표준 구조
```
domain/
├── types.ts        # 타입 정의
├── repository.ts   # 데이터 접근 (Supabase)
├── service.ts      # 비즈니스 로직
├── validation.ts   # 검증 (선택)
├── utils.ts        # 유틸리티 (선택)
├── index.ts        # 내보내기
└── actions/
    ├── index.ts    # 액션 통합 내보내기
    └── *.ts        # 세분화된 Server Actions
```

### 함수 명명 규칙
- `_함수명`: 내부 구현 (private)
- `함수명`: 외부에서 사용되는 Variable 래퍼

### 에러 처리
- 각 도메인별 에러 타입 정의
- `ActionResult` 패턴 사용

---

## 도메인 크기 순위

| 순위 | 도메인 | 특징 |
|------|--------|------|
| 1 | camp | 가장 큼 (permissions 457줄, errors 492줄) |
| 2 | plan | 복잡한 위자드, 생성 로직 |
| 3 | school | 학교/대학/지역 관리 |
| 4 | attendance | 출석/통계/검증 |
| 5 | student | 학생 관리/상담/알림 |
| 6 | score | 성적 3종 (모의/학교/내신) |
| 7 | content | 콘텐츠 CRUD/상세/추천 |
| 8 | tenant | 블록세트/설정/사용자 |
| 9 | today | 컨테이너 플랜 |
| 10 | block | 시간표 블록 |

---

*마지막 업데이트: 2025-12-26*
