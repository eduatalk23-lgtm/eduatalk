# Calendar Domain Rules

## Scope
캘린더 이벤트 CRUD, RRULE 반복 이벤트, 레거시 어댑터, 공휴일, 리마인더. Google Calendar API v3 패턴 기반으로 calendar_events + event_study_data 테이블을 관리한다.

## Architecture
```
calendar/
├── index.ts                  # Public API (types + actions re-export)
├── types.ts                  # DB 타입 별칭 + 리터럴 타입 + 조합 타입 + 필터/응답 타입
├── helpers.ts                # calendar_id resolve (student/admin/tenant) + ensure/subscribe
├── adapters.ts               # CalendarEvent → DailyPlan/AllDayItem/PlanItemData 레거시 변환
├── rrule.ts                  # RFC 5545 RRULE 확장/파싱/빌드/분할 (rrule npm 패키지)
├── eventClassification.ts    # 이벤트 기간 분류 (same-day vs cross-day)
├── labelPresets.ts           # label 프리셋 (event_type 대체)
├── koreanHolidays.ts         # 한국 공휴일 데이터 (2025~2027)
├── mapCalendarSettings.ts    # DB row → CalendarSettings 매핑
├── reminders.ts              # useEventReminders 클라이언트 훅
└── actions/
    ├── index.ts              # 액션 re-export
    ├── calendars.ts          # Calendar/CalendarList CRUD + Settings (802줄)
    ├── events.ts             # Event CRUD + study data 관리 (592줄)
    └── calendarEventActions.ts # 반복 이벤트 처리 + 리오더 + 상태 변경 (1,828줄, 분리 대상)
```

## Enforced Rules

1. **Calendar-First 모델**: 모든 이벤트는 `calendar_id` 필수. 학생/관리자/테넌트별 Primary Calendar을 `helpers.ts`의 `ensure*PrimaryCalendar()`로 보장. 직접 `calendars` 테이블 INSERT 금지.
2. **label 기반 분류 (event_type deprecated)**: `event_type` 컬럼은 제거 예정. 새 코드는 반드시 `label` + `is_task` + `is_exclusion` 조합 사용. `EventType` 리터럴은 마이그레이션 호환성 전용.
3. **done이 완료 상태의 단일 진실 공급원**: `event_study_data.done` (boolean)으로 완료 판정. `status` 컬럼은 순수 이벤트 상태(confirmed/tentative/cancelled)만 표현. `mapEventStatusToPlanStatus()`로 레거시 매핑.
4. **RRULE 확장은 `rrule.ts` 전용**: 반복 이벤트 인스턴스 생성은 반드시 `expandRecurringEvents()` 사용. KST 날짜 처리, exception 대체, exdate 필터링이 모두 포함됨. 직접 날짜 계산 금지.
5. **race-safe Primary Calendar 생성**: `ensure*PrimaryCalendar()`는 unique violation(23505)을 잡아 기존 캘린더 반환. 동시 요청 안전. `invalidateCalendarId()`로 캐시 무효화.
6. **KST 시간 변환**: Supabase PostgREST는 timestamptz를 UTC 반환. `extractTimeHHMM()`, `extractDateYMD()`는 항상 KST 기준. `split('T')[0]` 사용 금지 (09:00 KST 미만 이벤트에서 전날 날짜 반환).
7. **calendarEventActions.ts 분리 필요**: 1,828줄 대형 파일. 신규 기능은 별도 파일로 추가. Phase 0 미착수 항목.

## Tests
```bash
# 현재 calendar 전용 테스트 없음 — 통합 테스트로 커버
pnpm test lib/domains/admin-plan  # 관련 스케줄/이벤트 테스트
pnpm build                        # 타입 검증
```

## Related Domains
- `admin-plan`: 관리자 캘린더 뷰, 스케줄 쿼리, 배치 플랜 생성 (주요 소비자)
- `googleCalendar`: Google Calendar 양방향 동기화 (`syncService`, `calendarEventSync`)
- `plan`: 학습 플랜 CRUD, Dock 연동 (`plan/actions/dock.ts`)
- `consulting`: 상담 일정 + 리마인더 (`consulting/actions/schedule.ts`)
- `notification`: 클라이언트 리마인더 → `clientNotificationRouter` 연동
