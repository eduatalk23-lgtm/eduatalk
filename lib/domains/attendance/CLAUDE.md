# Attendance Domain Rules

## Scope
학생 입실/퇴실 관리 (QR, 위치, 수동), 출석 통계, SMS 알림 발송, 관리자 설정 (위치/SMS).

## Architecture
```
attendance/
├── index.ts          # Public API (types + actions re-export)
├── types.ts          # AttendanceStatus, CheckMethod, Record/Filter/Stats 타입
├── service.ts        # 비즈니스 로직 + 4종 검증 함수 (시간/방법/상태/중복)
├── repository.ts     # Supabase 쿼리 (CRUD + 페이지네이션 + 학생 배치 조회)
├── statistics.ts     # 일별 통계, 입실 방법별 통계, 시간대 분포, 출석률 랭킹
├── utils.ts          # calculateStatsFromRecords (통계 계산 공통)
└── actions/          # Server Actions
    ├── index.ts      # 전체 re-export
    ├── attendance.ts # Admin CRUD (기록/조회/수정/삭제/이력)
    ├── student.ts    # Student 체크인/아웃 (QR, 위치, 수동)
    ├── qrCode.ts     # QR 생성/조회/비활성화/이력
    ├── settings.ts   # 위치 설정, SMS 설정, 학생별 알림 설정
    └── smsLogs.ts    # 출석 SMS 로그 조회
```

## Enforced Rules

1. **Actions > Service > Repository 계층**: 액션에서 repository 직접 호출 금지. 반드시 service.ts를 경유. 단, `findAttendanceByStudentAndDate`는 student.ts에서 중복 체크용으로 직접 호출 허용.
2. **4종 검증 필수 통과**: 출석 기록 생성/수정 시 `validateAttendanceRecord()`가 시간/방법일관성/상태일관성/중복 4개 검증을 모두 수행. 개별 검증 건너뛰기 금지.
3. **SMS 실패 = 출석 기록 성공**: SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리. SMS 에러로 출석 기록 롤백 금지.
4. **RLS 우회 시 Admin Client**: insert/update에서 RLS 우회가 필요한 경우 `getSupabaseClientForRLSBypass()` 또는 `createSupabaseAdminClient()` 사용. 일반 조회는 `createSupabaseServerClient()`.
5. **학생 정보 배치 조회**: N+1 문제 방지를 위해 student_id 목록으로 user_profiles를 한 번에 조회. 레코드별 개별 조회 금지.
6. **출석 상태는 타입 사용**: `AttendanceStatus` / `CheckMethod` 타입 사용. 문자열 리터럴 직접 사용 금지. 라벨은 `ATTENDANCE_STATUS_LABELS` / `CHECK_METHOD_LABELS` 상수 사용.
7. **수정 이력 저장**: `updateAttendanceRecord`에서 `attendance_record_history`에 before/after 스냅샷 저장 필수. 이력 저장 실패는 경고만 (기록 수정 롤백하지 않음).

## Tests
```bash
# 현재 테스트 없음 (작성 필요)
pnpm test lib/domains/attendance
```

## Related Domains
- `qrCode`: QR 코드 생성/검증 (`lib/services/qrCodeService`, `lib/domains/qrCode`)
- `sms/notification`: SMS 발송 (`lib/services/attendanceSMSService`)
- `tenant`: 테넌트 설정 (위치, SMS on/off) - `tenants` 테이블에 설정 컬럼 존재
