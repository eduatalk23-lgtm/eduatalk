# Student Domain Rules

## Scope
학생 CRUD, 프로필 관리, 학부모 연결, 학습 세션, 알림 설정, 학년 진급, 계정 연결/해제, 검색. Admin(관리)과 Student(셀프서비스) 양쪽 Server Actions을 모두 포함한다.

## Architecture
```
student/
├── index.ts          # Public API (types + actions re-export)
├── types.ts          # DB 파생 타입 (Student, StudentInsert, StudentUpdate, 검색 타입)
├── repository.ts     # lib/data/students.ts 래퍼 (getStudentById, upsertStudent, division 관련)
└── actions/
    ├── index.ts            # 전체 actions re-export
    ├── management.ts       # [Admin] 활성화/비활성화, 삭제, 비재원 처리, 정보 수정
    ├── profile.ts          # [Student] 회원가입 정보 저장, 마이페이지 프로필 수정
    ├── sessions.ts         # [Student] 학습 세션 시작/종료/취소/일시정지/재개
    ├── search.ts           # [Admin] RPC 기반 학생 검색 (search_students_admin)
    ├── detail.ts           # [Admin] 학생 상세 조회 (students + auth)
    ├── divisions.ts        # [Admin] 학부·학년 배치 (단건/배치)
    ├── gradePromotion.ts   # [Admin] 학년 자동 진급 (1→2→3→졸업) + 수강 추천
    ├── parentLinks.ts      # [Admin] 학부모-학생 연결 CRUD
    ├── siblings.ts         # [Admin] 형제 관계 조회 (부모 공유 기반)
    ├── connectionStatus.ts # [Admin] 계정 연결 상태 (connected/pending/disconnected)
    ├── disconnect.ts       # [Admin] 계정 연결 해제 (UUID 변경, FK CASCADE 보존)
    ├── classification.ts   # 학과 소분류 조회 (KEDI 분류)
    ├── consulting.ts       # [Admin] 상담 노트 추가/삭제
    └── notifications.ts    # [Student] 알림·푸시 설정 관리
```

## Enforced Rules

1. **Admin Actions → `requireAdminOrConsultant()` 필수**: management, search, detail, parentLinks, disconnect 등 Admin 액션은 반드시 가드 함수로 권한 검증. `requireAdmin()`은 진급 등 파괴적 작업에만 사용.
2. **Student Actions → `getCachedAuthUser()` 사용**: profile.ts, notifications.ts 등 학생 셀프서비스 액션에서는 `getCachedAuthUser()`로 인증. `supabase.auth.getUser()` 직접 호출 금지.
3. **비활성화/비재원 처리 시 Auth ban 동기화**: `toggleStudentStatus`, `withdrawStudentAction`, 진급 졸업 시 반드시 `syncAuthBanStatus()` 호출. user_profiles.is_active만 변경하고 Auth ban을 빠뜨리면 로그인 차단 불가.
4. **전화번호 정규화 필수**: 전화번호 저장 시 반드시 `normalizePhoneNumber()` + `validatePhoneNumber()` 사용 (`lib/utils/studentFormUtils`). 학부모 전화번호는 `upsertParentContact()`로 ghost parent 자동 생성.
5. **계정 연결 해제 → FK CASCADE 의존**: disconnect.ts에서 students.id를 임시 UUID로 변경할 때, 학습 데이터는 `ON UPDATE CASCADE`로 자동 보존. FK에 CASCADE 없으면 데이터 유실.
6. **학습 세션 중복 방지**: 같은 플랜에 대한 활성 세션은 1개만 허용. 일시정지 상태(paused_at 있고 resumed_at 없음)는 새 세션 생성 허용. DB unique 제약으로 race condition 방어.
7. **revalidatePath 호출 위치 주의**: 세션 actions(start)은 호출자(startPlan 등)에게 revalidation을 위임. 나머지 Admin actions은 `/admin/students` 경로 직접 revalidate.

## Tests
```bash
# 현재 도메인 전용 테스트 없음 — 통합 테스트에서 간접 커버
pnpm test lib/domains/student    # 향후 테스트 추가 시
```

## Related Domains
- `student-record`: 생기부/세특/진단 — 학생 프로필 데이터 참조, 진급 시 수강 추천 연동
- `plan`: 학습 플랜 — 세션 시작 시 planId 참조, contentType/contentId 조회
- `admission`: 입시 — desired_university_ids, target_major 등 진로 정보 활용
- `notification` / `push`: 알림 설정(notifications.ts)이 푸시 발송 시스템과 연결
- `chat`: 채팅 알림 설정(ChatNotificationPrefs)이 이 도메인에서 관리됨
