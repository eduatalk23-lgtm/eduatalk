# 시스템 전반 개선사항 (2025년 12월)

## 1. 보안 개선 (P0 긴급)

### P0-1: 민감 정보 로깅 제거
- `getCurrentUser.ts`: 프로덕션에서 userId/email 로깅 제거
- `getCurrentUserRole.ts`: 프로덕션에서 email 로깅 제거
- `getCurrentUserName.ts`: 에러 객체 전체 → 메시지만 로깅
- `getTenantInfo.ts`: 프로덕션에서 tenantId 로깅 제거

### P0-2: RLS 정책 강화
- `getLinkedStudents()`: is_approved 체크 추가
- `canAccessStudent()`: is_approved 체크 추가
- 미승인 부모-학생 링크 접근 차단

### P0-3: 테넌트 격리 강제
- `getStudentById()`: tenantId 파라미터 실제 적용
- `upsertStudent()`: 기존 학생 쿼리에 tenant 필터 추가
- 크로스 테넌트 작업 방지

### P0-4: 관리자 인증 일관성
- `createAdminUser()`: 테넌트 검증 추가
- `deleteAdminUser()`: tenant 필터 추가
- 크로스 테넌트 관리자 작업 방지

### P0-5: 멱등성 키 시스템
- 중복 요청 방지 시스템 (`d7d74246`)

### P0-6: 원자적 트랜잭션
- PostgreSQL RPC 기반 트랜잭션 지원 (`fba97ae6`)

---

## 2. 동적 권한 관리 시스템

### 테이블 구조
- `role_permissions`: 테넌트별 역할 권한 설정
- `permission_definitions`: 시스템 권한 정의

### 헬퍼 함수 (`lib/auth/permissions.ts`)
```typescript
hasPermission()         // 현재 사용자 권한 확인
requirePermission()     // 권한 필수 체크
getCurrentUserPermissions() // 모든 권한 조회
```

### 기본 권한 정의 (20개)
| 카테고리 | 권한 |
|---------|------|
| 캠프 | create, update, delete, invite |
| 학생 | create, update, delete, view_all |
| 콘텐츠 | create, update, delete |
| 출석 | create, update, delete |
| 설정 | scheduler, sms, tenant |
| 사용자 | create, update, delete |

### UI
- `/admin/settings/permissions`: 권한 관리 페이지
- `PermissionSettingsForm`: 권한 설정 폼

---

## 3. 캠프 시스템 개선

### 알림 시스템
- `notifications` 테이블 (영구 인앱 알림)
- `inAppNotificationService`: DB 기반 알림 서비스
- `sendCampAcceptanceNotificationToAdmins`: 관리자 알림
- `sendPlanCreatedNotificationToStudent`: 학생 알림

### 학습 진도 서비스
- `learningProgressService.ts`: 학습 진도 계산
- `progressCalculation.ts`: 진도 계산 유틸리티
- `total_plans`, `completed_plans` 필드 추가

### 개요 대시보드
- `CampOverviewDashboard`: 통합 메트릭스
- 문제 참가자 자동 감지
- 빠른 액션 버튼 (대량 플랜, 리마인더, 활성화)

### 참가자 관리
- 플랜 그룹 누락 감지
- 초대 만료 검증 및 자동 만료 함수
- 멀티 캠프 관리 페이지

### 출석 관리
- `CampAttendanceInputModal`: 출석 기록 추가
- `CampParticipantAttendanceHistory`: 최근 기록 + 수정 링크
- 다크모드 지원

### 권한 및 에러
- `lib/domains/camp/permissions.ts`: 캠프 권한 (457줄)
- `lib/domains/camp/errors.ts`: 캠프 에러 정의 (492줄)

---

## 4. 성능 최적화 (P1)

### N+1 쿼리 최적화
- `getCampInvitationsByIds()`: 배치 쿼리 추가
- `participants.ts`: Promise.all 루프 → 배치 쿼리
- `management.ts`: 학생 삭제 배치 처리

### 동적 임포트
- `xlsx` 라이브러리: ~650KB 번들 감소
- Step 컴포넌트 lazy loading
- Recharts 지연 로딩

### React 최적화
- `SinglePlanView`: React.memo + 커스텀 비교
- `PlanSelector`: React.memo + useMemo (O(1) 맵 조회)

### 캐싱
- `React.cache()` 레이어: 스케줄러 설정 쿼리
- LRU 캐시: 콘텐츠 데이터

### 데이터베이스 인덱스 (P2-4)
- `student_plan`, `plan_groups`, `attendance_records`
- `parent_student_links`, `academy_schedules`, `exclusion_dates`
- Partial indexes: `WHERE deleted_at IS NULL`

---

## 5. 에러 처리 개선 (P2)

### 에러 복구 가이드 시스템
```typescript
interface RecoveryAction {
  label: string;
  path: string;
  description: string;
}

interface UserFriendlyError {
  message: string;
  recoveryActions: RecoveryAction[];
}
```
- 컨텍스트 기반 복구 제안
- 플랜 생성 실패 시 안내

### 플랜 생성 에러 타입 확장
- `block_set_missing`
- `invalid_period`
- `schedule_conflict`
- `no_available_content`
- `timeline_error`

### 테넌트 격리 유틸리티
- `assertTenantId()`: 필수 테넌트 검증
- `warnIfMissingTenantId()`: 선택적 경고
- `TenantIsolationContext`: 일관된 컨텍스트 명명

---

## 6. 실시간 구독 확장 (P2-5)

```typescript
useAttendanceRealtime()      // 학생 출석 업데이트
useAdminAttendanceRealtime() // 테넌트 전체 업데이트
usePlanGroupRealtime()       // 플랜 그룹 상태 변경
usePlanProgressRealtime()    // 진도 추적
```

---

## 7. UX/DX 개선 (P3)

### 플랜 생성 진행 상태
```typescript
enum PlanGenerationStep {
  VALIDATING,
  FETCHING_DATA,
  CALCULATING_SLOTS,
  GENERATING_SCHEDULE,
  SAVING_PLANS,
  FINALIZING,
  COMPLETED,
  ERROR
}
```
- `PlanGenerationProgressTracker` 클래스
- `PlanGenerationProgress` 컴포넌트
- 단계별 시각적 피드백

### React Query 캐시 키 상수화
```typescript
queryKeys.students.all()
queryKeys.plans.byGroup(id)
invalidationPresets.planUpdated()
CACHE_TIMES, STALE_TIMES
```

### Toast 알림 통합
- `alert()` → toast 알림 전환 (`85f679e6`)
- 일관된 사용자 피드백

---

## 8. 도메인 기반 아키텍처

### 마이그레이션 완료
- `app/actions/*` → `lib/domains/*` 이동
- 135개 파일 업데이트
- ~3,200줄 deprecated 코드 삭제

### 도메인 구조 (23개)
```
lib/domains/
├── admin-plan/   # 관리자 플랜 (이월, 임시플랜)
├── analysis/     # 분석/코칭
├── attendance/   # 출석
├── auth/         # 인증
├── block/        # 블록
├── camp/         # 캠프 (가장 큰 도메인)
├── content/      # 콘텐츠
├── content-metadata/
├── goal/         # 목표
├── master-content/
├── parent/       # 학부모
├── plan/         # 플랜
├── qrCode/       # QR코드
├── school/       # 학교
├── score/        # 성적
├── settings/     # 설정
├── sms/          # SMS
├── student/      # 학생
├── subject/      # 과목
├── superadmin/   # 슈퍼관리자
├── tenant/       # 테넌트
├── today/        # 오늘 (컨테이너 플랜)
└── user/         # 사용자
```

### 클라이언트/서버 분리
- 클라이언트: `lib/domains/*/actions`
- 서버: `lib/domains/*` index
- Next.js 15 Turbopack 빌드 호환

---

## 9. 인증 가드 통합

### 통합 파일
- `lib/auth/guards.ts`: 모든 인증 가드 통합

### 사용 패턴
```typescript
import { requireAuth, requireAdmin, requireStudent } from '@/lib/auth/guards';
```

---

## 10. 프리셋 관리

### 슬롯 프리셋 페이지
- `/admin/camp-templates/presets`
- `PresetList`: CRUD 목록
- `PresetEditor`: 드래그앤드롭 슬롯 구성
- 기본 프리셋 설정 지원

---

## 11. 레거시 정리

### 삭제된 테이블
- `content_masters`
- `content_master_details`
- `student_daily_schedule`

### 정리된 코드
- RLS 정책 정리
- 외래키 제약조건 정리
- deprecated 래퍼 파일 삭제

---

## 12. 타입 안전성

### any 타입 제거
- `lib/` 전체에 proper 타입 적용 (`8b89908e`)
- 타입 가드 추가

### 시간 상수 추가
- `bfd398aa`: 시간 상수화
- 날짜 계산 안전성 개선

---

## 13. 멀티 디바이스 지원

### 세션 충돌 감지 (`8c0610f6`)
- 동일 사용자 여러 기기 감지
- 충돌 시 알림

---

## 14. 감사 로깅

### 시스템 구현 (`b49e1a2e`)
- 관리자 작업 로깅
- 감사 추적 지원

---

## 성능 지표 요약

| 영역 | 개선 내용 | 효과 |
|------|----------|------|
| 번들 | xlsx 동적 임포트 | -650KB |
| 번들 | Step 컴포넌트 lazy | -37% |
| 쿼리 | N+1 → 배치 | 쿼리 수 감소 |
| 렌더 | React.memo | 불필요 리렌더 방지 |
| 캐시 | LRU + React.cache | 중복 요청 방지 |

---

## 관련 파일 경로

```
[보안]
lib/auth/guards.ts
lib/auth/permissions.ts
lib/domains/settings/actions/permissions.ts

[캠프]
lib/domains/camp/ (가장 큰 도메인)
lib/services/campNotificationService.ts

[에러]
lib/errors/handler.ts
lib/errors/recoveryGuide.ts
lib/errors/planGenerationErrors.ts

[실시간]
lib/realtime/

[쿼리]
lib/query/keys.ts
```

---

*마지막 업데이트: 2025-12-26*
