# 일일 작업 보고서 — 2026-03-13 (목)

> **작업 시간**: 18:20 ~ 23:58 KST (약 5시간 38분)
> **총 커밋**: 12건 | **수정 파일**: 234개 | **+3,639 / -1,744 lines**
> **핵심 키워드**: 인증 최적화, Disk I/O 위기 대응, Realtime WAL 제거, 채팅 가상 스크롤

---

## 목차

1. [작업 개요](#1-작업-개요)
2. [Work Stream 1: 인증 성능 최적화](#2-work-stream-1-인증-성능-최적화)
3. [Work Stream 2: 채팅 양방향 페이지네이션 & 가상 스크롤](#3-work-stream-2-채팅-양방향-페이지네이션--가상-스크롤)
4. [Work Stream 3: UI/UX 개선 (캘린더·모바일·PWA)](#4-work-stream-3-uiux-개선-캘린더모바일pwa)
5. [Work Stream 4: 페이지 로드 성능 최적화](#5-work-stream-4-페이지-로드-성능-최적화)
6. [Work Stream 5: Disk I/O Budget 위기 대응](#6-work-stream-5-disk-io-budget-위기-대응)
7. [Work Stream 6: Realtime WAL → Broadcast 전환](#7-work-stream-6-realtime-wal--broadcast-전환)
8. [Work Stream 7: 캘린더 쿼리 최적화](#8-work-stream-7-캘린더-쿼리-최적화)
9. [Work Stream 8: RLS 정책 최적화 & DB 인프라 정비](#9-work-stream-8-rls-정책-최적화--db-인프라-정비)
10. [DB 변경사항 전체 요약](#10-db-변경사항-전체-요약)
11. [타임라인 요약](#11-타임라인-요약)
12. [향후 개발 시 참고사항](#12-향후-개발-시-참고사항)
13. [관련 문서 목록](#13-관련-문서-목록)

---

## 1. 작업 개요

하루 동안 **성능 위기 대응**과 **기능 개선**을 병행 수행했다. Supabase Disk I/O Budget 고갈로 인한 서비스 장애 조짐(504/522 에러)을 해결하는 것이 최우선 과제였으며, 동시에 인증 레이어와 채팅 시스템의 구조적 문제를 수정했다.

### 작업 분류

| 구분 | Work Stream | 성격 | 긴급도 |
|------|------------|------|:---:|
| WS-1 | 인증 성능 최적화 | 구조적 리팩토링 | 🔴 |
| WS-2 | 채팅 양방향 페이지네이션 | 기능 개선 | 🟡 |
| WS-3 | UI/UX 개선 (캘린더·모바일·PWA) | 버그 수정 | 🟡 |
| WS-4 | 페이지 로드 성능 최적화 | 성능 개선 | 🔴 |
| WS-5 | Disk I/O Budget 위기 대응 | 장애 대응 | 🔴 |
| WS-6 | Realtime WAL → Broadcast 전환 | 아키텍처 변경 | 🔴 |
| WS-7 | 캘린더 쿼리 최적화 | 성능 개선 | 🟡 |
| WS-8 | RLS 정책 최적화 & DB 인프라 정비 | 인프라 개선 | 🔴 |

---

## 2. Work Stream 1: 인증 성능 최적화

### 2.1 문제 정의

**증상**: `GET /admin/dashboard` 응답 15.8초, proxy.ts에서만 1~6초 소요

**근본 원인**: 단일 요청에서 인증/역할 확인이 **13~18회 중복 실행**

```
요청 1회 → proxy.ts(Edge) getUser ×2 + DB ×3
         → layout.tsx(Node) getUser ×1 + DB ×3
         → page.tsx(Node) getUser ×1 + DB ×3
         → guards(Node) getUser ×1 + DB ×3
         = 총 18 라운드트립
```

**구조적 결함 3가지**:
1. Edge/Node 런타임 간 캐시 공유 불가 → 동일 작업 2중 실행
2. `getCachedUserRole()`이 존재하지만 170+개 파일이 원본 `getCurrentUserRole()` 직접 호출
3. 원본/캐시 함수 모두 export → 타입 시스템이 잘못된 사용을 차단 불가

### 2.2 해결 플로우

```
[1] 역할 분리 설계
    proxy.ts → 인증만 (JWT metadata, DB 쿼리 0)
    layout.tsx → 인가 (getCachedUserRole, DB 쿼리 1세트)
    page.tsx → 캐시 재사용 (DB 쿼리 0)

[2] proxy.ts DB 쿼리 완전 제거
    → getUserRole() 함수 삭제
    → getRoleFromMetadata() 신규 (JWT user_metadata 참조)
    → superadmin 역할 누락 즉시 수정 (Critical 보안 이슈)
    → metadata 없는 기존 사용자 통과 처리 (Critical)

[3] 전체 코드베이스 일괄 전환 (175개 파일)
    getCurrentUserRole() → getCachedUserRole()
    supabase.auth.getUser() → getCachedAuthUser()

[4] CLAUDE.md에 "1-Request, 1-Query 원칙" 규칙 추가
```

### 2.3 결과

| 지표 | Before | After | 개선율 |
|------|--------|-------|:---:|
| 요청당 auth 라운드트립 | 18회 | 5회 | **72%** |
| proxy.ts 지연 | 700~1800ms | 200~500ms | **~70%** |
| 수정 파일 | — | 175개 | — |

**커밋**: `56c4cde` (18:20)

---

## 3. Work Stream 2: 채팅 양방향 페이지네이션 & 가상 스크롤

### 3.1 문제 정의

| 문제 | 설명 |
|------|------|
| 안읽은 메시지 진입점 | 항상 최신 메시지부터 로드 → unread divider 위치로 이동 불가 |
| 이미지 URL 재요청 | Virtuoso 가상화 → 스크롤 시 이미지 뷰포트 재진입마다 서명 URL 재생성 |
| 모바일 키보드 떨림 | iOS 키보드 표시/숨김 시 뷰포트 높이 변경으로 레이아웃 jank 발생 |
| 저사양 기기 성능 | 모든 기기에 동일한 Virtuoso 버퍼 → 저사양에서 과다 렌더링 |

### 3.2 해결 플로우

```
[1] 양방향 페이지네이션 구현
    → messages.ts에 around/after 파라미터 추가
    → ChatRoom에서 unread divider 기준 메시지 로드
    → 위/아래 양방향 무한 스크롤 (Virtuoso startReached/endReached)

[2] 첨부파일 URL 캐시
    → 모듈 레벨 Map<string, {url, expiresAt}> 캐시
    → 만료 전까지 캐시 히트 → 서명 URL 재요청 방지

[3] 디바이스 티어별 Virtuoso 설정
    → navigator.deviceMemory + hardwareConcurrency 기반 3티어 분류
    → 저사양: overscan 200, scrollSeek on / 고사양: overscan 800

[4] useVisualViewport 키보드 안정화
    → rAF 폴링으로 키보드 애니메이션 추적
    → 높이 변화율 < 2px 시 "안정" 판단 → 한 번만 레이아웃 업데이트
```

### 3.3 결과

- 채팅방 진입 시 unread divider 위치에서 바로 시작 가능
- 이미지 스크롤 시 깜빡임(서명 URL 재요청) 제거
- 저사양 Android 기기 스크롤 FPS 개선
- 23개 파일 수정, +1,359 / -181 lines

**커밋**: `42d25e7` (18:20)

---

## 4. Work Stream 3: UI/UX 개선 (캘린더·모바일·PWA)

### 4.1 캘린더 반응형 & 프리패치 (bf49552, 18:21)

| 문제 | 해결 |
|------|------|
| 빠른 월 이동 시 프리패치 폭주 | 300ms 디바운스 적용 |
| 월간 뷰 모바일에서 날짜 겹침 | `text-xs`, `py-1` 반응형 크기 조정 |
| overdue 쿼리에 비-태스크 이벤트 포함 | `.eq('is_task', true)` 서버 필터 추가 |
| 사이드바 터치 시 body 스크롤 | `touch-none`, `overscroll-contain` 적용 |
| 모바일 주소창으로 레이아웃 깨짐 | `min-h-dvh` 적용 (100vh → dvh) |

### 4.2 PWA 서비스 워커 수정 (c6c6c92, 18:21)

| 문제 | 해결 |
|------|------|
| SW가 `/api/` 경로를 캐시하여 실시간 데이터 불일치 | fetch 이벤트에서 `/api/`, Supabase WS 패턴을 네트워크 전용으로 우회 |
| 모바일 백그라운드→포그라운드 전환 시 오프라인 상태 유지 | `visibilitychange` 이벤트로 온라인 상태 재감지 |

---

## 5. Work Stream 4: 페이지 로드 성능 최적화

### 5.1 문제 정의

- admin 대시보드: 데이터 fetch 순차 실행 (campStats → fileKpi → 나머지)
- 레이아웃: `is_active` 체크와 tenant/profile 쿼리 순차 실행
- 캘린더: `generateScheduleForCalendar` 매 페이지 렌더 시 실행 (이미 DB에 저장된 데이터)
- proxy.ts: `getUser()` 네트워크 호출 매 요청 실행

### 5.2 해결 플로우

```
[1] proxy.ts JWT 로컬 파싱 (22b4aff)
    → 토큰이 유효하면 getUser() 네트워크 호출 스킵
    → 지연: 1.5~3.7초 → ~0ms

[2] 대시보드 병렬화 (22b4aff)
    → 8개 데이터 fetch를 Promise.all로 병렬화
    → 순차 실행 → 동시 실행

[3] 레이아웃 병렬화 (22b4aff)
    → is_active + tenant/profile 쿼리를 Promise.all
    → admin/parent/student 레이아웃 모두 적용

[4] 캘린더 캐시 레이어 (22b4aff)
    → unstable_cache + tag 기반 invalidation
    → admin client 사용(cookies() 의존 제거)
    → exclusion 변경 시 선택적 invalidation

[5] calculateAvailableDates 메모이제이션 (22b4aff)
    → dayOfWeek+dayType 기준 메모이제이션: 90 계산 → ~14
    → dateCountByDayOfWeek 사전 계산: O(a×n) → O(a+n)

[6] force-dynamic 전환 (221b849)
    → 역할 기반 레이아웃 revalidate:300 → force-dynamic
    → 캐시된 stale 데이터로 인한 불일치 방지

[7] N+1 쿼리 제거 (221b849)
    → subjects 페이지: 개별 getSubject → 배치 getSubjectsByRevision
    → 캘린더 ID: 불변 데이터용 캐시 레이어 추가
```

### 5.3 결과

| 지표 | Before | After |
|------|--------|-------|
| proxy 지연 (JWT 유효 시) | 1.5~3.7초 | ~0ms |
| 대시보드 데이터 fetch | 순차 (waterfall) | 병렬 (Promise.all) |
| 레이아웃 쿼리 | 순차 | 병렬 |
| 캘린더 스케줄 계산 | 매 렌더 | DB 캐시 참조 |
| 날짜 계산 | 90회 | ~14회 (메모이제이션) |

**커밋**: `22b4aff` (19:35), `221b849` (20:48)

---

## 6. Work Stream 5: Disk I/O Budget 위기 대응

### 6.1 문제 정의

**증상**: Supabase에서 "Disk IO Budget 소진 경고" → 504/522 에러 연쇄 발생

**근본 원인 (6가지)**:

| # | 원인 | 심각도 | 수치 |
|---|------|:---:|------|
| 1 | Temp 파일 69GB (work_mem 17MB 부족) | Critical | DB 크기 52MB의 1,300배 |
| 2 | Realtime WAL 폴링 (5개 테이블) | Critical | CPU 54%, 639K WAL 읽기 |
| 3 | pg_cron 매 1분 실행 | High | 장애 시 10초마다 재시도 |
| 4 | user_presence 하트비트 30초 | High | 일 288,000 writes |
| 5 | 캘린더 RRULE 2년 스캔 | Medium | 인덱스 없이 730일 스캔 |
| 6 | 대시보드 27개 쿼리 (JS 집계) | Medium | 전체 행 fetch + 메모리 집계 |

### 6.2 해결 플로우

```
[Phase A] DB 직접 적용 (SQL)
├─ work_mem 17MB → 32MB (Supabase CLI)
├─ Realtime publication 5개 → 2개 테이블 (make_scenario_logs 등 DROP)
├─ pg_cron scheduled_messages: 매 1분 → 매 5분
├─ RRULE 전용 부분 인덱스 2개 생성
├─ user_presence 인덱스 추가
├─ VACUUM FULL 8개 테이블
├─ Dashboard RPC 함수 생성 (get_dashboard_statistics)
└─ cron.job_run_details 정리 + pg_stat_statements 리셋

[Phase B] 코드 변경 (커밋)
├─ Presence 하트비트: 30초 → 120초 (75% write 감소)
├─ RRULE cutoff: 2년 → 6개월 (75% 스캔 감소)
├─ vercel.json cron: 자정 3개 동시 → 5분 간격 분산
├─ Dashboard: 27개 쿼리 → 1 RPC + 3 쿼리
└─ 마이그레이션 파일에 전체 변경 기록
```

### 6.3 결과

| 지표 | Before | After | 개선율 |
|------|--------|-------|:---:|
| CPU (Realtime WAL) | 54% | ~22% | **59%** |
| Dashboard 렌더 | 16~17초 | 3~5초 | **70~80%** |
| Presence writes/일 | 288,000 | 72,000 | **75%** |
| Cron 호출/일 | 1,440 | 288 | **80%** |
| 캘린더 스캔 범위 | 730일 | 180일 | **75%** |
| Dashboard 쿼리 수 | ~27 | 4 | **85%** |

**커밋**: `aebb35ce` (20:48), `221b849` (20:48)

---

## 7. Work Stream 6: Realtime WAL → Broadcast 전환

### 7.1 문제 정의

WAL 폴링이 CPU의 54%를 점유. WS-5에서 publication 테이블을 5→2개로 줄였지만, 남은 `student_plan`과 `calendar_events`도 여전히 WAL 폴링 사용.

### 7.2 해결 플로우

```
[1] DB Trigger 함수 생성 (c502491)
    → broadcast_student_plan_changes(): INSERT/UPDATE/DELETE 시 Broadcast 전송
    → broadcast_calendar_event_changes(): 동일 패턴
    → Trigger → net.http_post → Supabase Realtime Broadcast API

[2] Publication 완전 제거 (c502491)
    → student_plan, calendar_events DROP from supabase_realtime
    → WAL 폴링 0개 → **완전 제거**

[3] 클라이언트 코드 전환 (c502491)
    → usePlanRealtimeUpdates: postgres_changes → broadcast 수신
    → useAdminPlanRealtime: postgres_changes → broadcast 수신
    → usePlanGroupRealtime: postgres_changes → broadcast 수신

[4] private:true 누락 수정 (c180b5c)
    → realtime.send() 기본값이 private=true
    → 클라이언트 subscribe에 config.private=true 추가 필요
    → 3개 훅 모두 수정
```

### 7.3 결과

| 지표 | Before | After |
|------|--------|-------|
| Publication 테이블 수 | 5 → 2 (WS-5) | **0** |
| WAL 폴링 | 활성 | **완전 제거** |
| Realtime CPU | ~54% | ~0% (Broadcast는 DB 무관) |

**커밋**: `c502491` (21:33), `c180b5c` (21:48)

---

## 8. Work Stream 7: 캘린더 쿼리 최적화

### 8.1 문제 정의

| 문제 | 위치 |
|------|------|
| 반복 이벤트 예외 처리가 4개 순차 UPDATE 루프 | `calendarEventActions.ts` |
| 낙관적 업데이트 + Realtime 활성 시에도 onSettled에서 invalidate 실행 | `useCalendarMutations.ts` |
| Realtime 수신 시 6개 쿼리 프리픽스 전체 invalidate | `usePlanRealtimeUpdates.ts` |
| campStats 쿼리 순차 실행 | `dashboard/page.tsx` |
| recentNotes 2-쿼리 패턴 (students 별도 fetch) | `dashboard/page.tsx` |

### 8.2 해결 플로우

```
[1] 배치 쿼리 전환 (f4194fe)
    → 4개 순차 UPDATE → .in() 배치 쿼리 1회

[2] 이중 refetch 제거 (f4194fe)
    → 낙관적 업데이트/Realtime 활성 시 onSettled invalidate 스킵

[3] Realtime invalidation 범위 축소 (f4194fe)
    → 6개 프리픽스 → 채널 특정 2~3개 키만 invalidate
    → 학생 Realtime에 300ms 디바운스 추가

[4] 복합 인덱스 추가 (f4194fe)
    → (recurring_event_id, is_exception) WHERE deleted_at IS NULL

[5] 추가 병렬화 (c41d482)
    → campStats Promise.all, recentNotes FK join
    → admin layout admin_users 쿼리 2→1 통합
    → getTenantInfo React.cache 래핑
    → 캘린더 탭 컴포넌트 next/dynamic 지연 로드
```

### 8.3 결과

- 반복 이벤트 예외 처리: N개 UPDATE → 1개 배치 쿼리
- Realtime invalidation: 불필요 쿼리 ~60% 감소
- 캘린더 탭 전환 시 초기 번들 크기 감소 (dynamic import)

**커밋**: `f4194fe` (22:21), `c41d482` (22:58)

---

## 9. Work Stream 8: RLS 정책 최적화 & DB 인프라 정비

### 9.1 문제 정의

#### RLS initplan 성능 문제

RLS 정책에서 `auth.uid()`, `auth.role()`, `auth.jwt()` 호출이 `(SELECT ...)` 래핑 없이 사용되면, PostgreSQL이 **행마다 함수를 재평가**하여 심각한 성능 저하 발생.

```sql
-- ❌ 행마다 auth.uid() 재평가 (테이블 10만 행 → 10만 번 호출)
CREATE POLICY "example" ON table USING (student_id = auth.uid());

-- ✅ 쿼리당 1회만 평가 (initplan으로 최적화)
CREATE POLICY "example" ON table USING (student_id = (SELECT auth.uid()));
```

이 패턴은 Supabase 공식 권장사항이지만, 기존 RLS 정책과 헬퍼 함수에서 일관되게 적용되지 않았음.

#### DB 직접 적용 작업 미기록

Supabase SQL 콘솔에서 직접 적용한 work_mem, VACUUM, pg_stat_statements 리셋 등이 코드에 기록되지 않으면 재현 불가.

### 9.2 해결 플로우

```
[1] RLS initplan 규칙 수립 (CLAUDE.md)
    → auth.uid()/auth.role()/auth.jwt()는 반드시 (SELECT ...) 래핑
    → 헬퍼 함수(SECURITY DEFINER) 내부에서도 동일 규칙 적용
    → CLAUDE.md "Database" 섹션에 규칙 추가 (코드 리뷰 기준)

[2] 자동 린트 스크립트 생성 (scripts/lint-rls-policies.sh)
    → 마이그레이션 파일에서 미래핑 auth.uid()/role()/jwt() 검출
    → grep -P lookbehind로 (SELECT 없는 호출 패턴 탐지
    → 주석(--) 라인 자동 제외
    → 사용법: ./scripts/lint-rls-policies.sh [file...]
    → 인수 없으면 supabase/migrations/*.sql 전체 스캔

[3] DB 직접 적용 작업 (SQL 콘솔)
    → work_mem: 17MB → 32MB (Supabase CLI)
    → VACUUM FULL: 8개 테이블 (user_presence, chat_attachments 등)
    → pg_stat_statements_reset(): 통계 리셋 (최적화 효과 측정용)
    → cron.job_run_details: 7일 이상 기록 삭제
```

### 9.3 RLS 린트 스크립트 상세

```bash
#!/bin/bash
# scripts/lint-rls-policies.sh
# 사용: ./scripts/lint-rls-policies.sh [file...]
# 인수 없으면 supabase/migrations/*.sql 전체 스캔

# 검출 패턴:
#   auth.uid()  → (SELECT auth.uid()) 로 변경 필요
#   auth.role() → (SELECT auth.role()) 로 변경 필요
#   auth.jwt()  → (SELECT auth.jwt()) 로 변경 필요

# 정상 종료: exit 0 + "✓ All RLS policies use (SELECT auth.uid()) pattern"
# 위반 발견: exit 1 + 파일별 라인 번호 출력
```

### 9.4 DB 직접 적용 작업 상세

아래 작업은 마이그레이션 파일이 아닌 **SQL 콘솔에서 직접 실행**된 항목:

| 작업 | SQL | 효과 | 비고 |
|------|-----|------|------|
| work_mem 증가 | `ALTER SYSTEM SET work_mem = '32MB'` | temp 파일 생성 억제 | Supabase CLI로 적용 |
| VACUUM FULL | 8개 테이블 | dead rows 제거, 디스크 반환 | 테이블 잠금 발생 주의 |
| stat 리셋 | `SELECT pg_stat_statements_reset()` | 최적화 후 새로운 통계 수집 | 1-2시간 후 재조회 필요 |
| cron 기록 정리 | `DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days'` | 마이그레이션에도 포함 | — |

**VACUUM FULL 대상 테이블** (dead row 비율):

| 테이블 | Dead Row % | 비고 |
|--------|:---:|------|
| `chat_attachments` | 1300% | autovacuum 미실행 |
| `storage.objects` | 350% | autovacuum 미실행 |
| `user_presence` | 311% | 고빈도 UPSERT |
| `chat_room_members` | — | 빈번한 UPDATE |
| `calendar_list` | — | — |
| `auth.flow_state` | — | — |
| `auth.sessions` | — | — |
| `auth.users` | — | — |

### 9.5 결과

| 산출물 | 상태 |
|--------|:---:|
| CLAUDE.md RLS initplan 규칙 | ✅ 작성 완료 (미커밋) |
| lint-rls-policies.sh | ✅ 작성 완료 (미커밋) |
| work_mem 32MB | ✅ 적용 완료 (DB) |
| VACUUM FULL 8개 테이블 | ✅ 실행 완료 (DB) |
| pg_stat_statements 리셋 | ✅ 실행 완료 (DB) |

**상태**: 미커밋 파일 2건 (CLAUDE.md, scripts/lint-rls-policies.sh)

---

## 10. DB 변경사항 전체 요약

하루 동안 적용된 모든 데이터베이스 변경사항을 한 곳에 정리한다.

### 10.1 마이그레이션 파일 (3건)

#### Migration 1: `20260323100000_add_disk_io_optimization_indexes.sql`

| 구분 | 내용 |
|------|------|
| **인덱스 3개** | |
| `idx_user_presence_updated_at` | `user_presence (updated_at DESC)` — stale 하트비트 정리용 |
| `idx_cal_events_rrule_time` | `calendar_events (calendar_id, start_at)` WHERE rrule + 시간 이벤트 — 부분 인덱스 |
| `idx_cal_events_rrule_date` | `calendar_events (calendar_id, start_date)` WHERE rrule + 종일 이벤트 — 부분 인덱스 |
| **Publication 변경** | |
| DROP 3개 테이블 | `make_scenario_logs`, `recommended_contents`, `student_content_progress` |
| **Cron 변경** | |
| `scheduled_messages` | `* * * * *` → `*/5 * * * *` (1분 → 5분) |
| `cron.job_run_details` | 7일 이상 기록 삭제 |
| **RPC 함수 1개** | |
| `get_dashboard_statistics(DATE, DATE)` | SECURITY DEFINER, plpgsql. 대시보드 통계 6종 집계 (total_students, active_this_week, with_scores, with_plans, top_study_time, top_plan_completion, top_goal_achievement). 27개 JS 쿼리를 1개 SQL로 대체 |

#### Migration 2: `20260323200000_broadcast_student_plan_calendar_events.sql`

| 구분 | 내용 |
|------|------|
| **Trigger 함수 2개** | |
| `broadcast_student_plan_changes()` | SECURITY DEFINER, plpgsql. INSERT/UPDATE/DELETE 시 `realtime.broadcast_changes()` 호출. 채널: `plan-realtime-{student_id}` |
| `broadcast_calendar_event_changes()` | SECURITY DEFINER, plpgsql. 동일 패턴. `student_id IS NULL` 시 스킵. 채널: `calendar-realtime-{student_id}` |
| **Trigger 2개** | |
| `broadcast_student_plan` | `student_plan` AFTER INSERT/UPDATE/DELETE FOR EACH ROW |
| `broadcast_calendar_events` | `calendar_events` AFTER INSERT/UPDATE/DELETE FOR EACH ROW |
| **Publication 변경** | |
| DROP 2개 테이블 | `student_plan`, `calendar_events` — **WAL 폴링 완전 제거** (publication 0개) |

#### Migration 3: `20260324100000_add_recurring_exception_index.sql`

| 구분 | 내용 |
|------|------|
| **인덱스 1개** | |
| `idx_cal_events_recurring_exception` | `calendar_events (recurring_event_id, is_exception)` WHERE `is_exception = true AND deleted_at IS NULL` — 반복 이벤트 예외 조회용 복합 부분 인덱스 |

### 10.2 DB 직접 적용 (SQL 콘솔, 마이그레이션 외)

| 작업 | 상태 | 재현 방법 |
|------|:---:|------|
| `work_mem = 32MB` | ✅ | `npx supabase postgres-config update --config 'work_mem=32MB'` |
| VACUUM FULL 8개 테이블 | ✅ | `VACUUM FULL public.user_presence, ...` |
| `pg_stat_statements_reset()` | ✅ | 1회성 (재현 불필요) |

### 10.3 SECURITY DEFINER 함수 목록 (신규 3개)

| 함수 | 언어 | 용도 | search_path |
|------|------|------|-------------|
| `get_dashboard_statistics` | plpgsql | 대시보드 통계 RPC | `public` |
| `broadcast_student_plan_changes` | plpgsql | student_plan Realtime Trigger | `''` (빈 문자열) |
| `broadcast_calendar_event_changes` | plpgsql | calendar_events Realtime Trigger | `''` (빈 문자열) |

> **보안 참고**: SECURITY DEFINER 함수는 함수 소유자 권한으로 실행되므로 RLS를 우회한다.
> `search_path`를 명시적으로 설정하여 schema injection 방지.

### 10.4 Publication 변경 이력 (supabase_realtime)

```
시작 시점 (5개):
  student_plan, calendar_events, make_scenario_logs,
  recommended_contents, student_content_progress

Migration 1 (aebb35ce):
  DROP: make_scenario_logs, recommended_contents, student_content_progress
  → 남은 2개: student_plan, calendar_events

Migration 2 (c502491d):
  DROP: student_plan, calendar_events
  → 남은 0개 (WAL 폴링 완전 제거)

최종 상태: supabase_realtime publication = 0개 테이블
```

### 10.5 인덱스 변경 요약 (신규 4개)

| 인덱스명 | 테이블 | 컬럼 | 조건 (WHERE) | 유형 |
|----------|--------|------|-------------|------|
| `idx_user_presence_updated_at` | user_presence | updated_at DESC | — | 일반 |
| `idx_cal_events_rrule_time` | calendar_events | calendar_id, start_at | rrule NOT NULL, !is_all_day, !deleted | 부분 |
| `idx_cal_events_rrule_date` | calendar_events | calendar_id, start_date | rrule NOT NULL, is_all_day, !deleted | 부분 |
| `idx_cal_events_recurring_exception` | calendar_events | recurring_event_id, is_exception | is_exception, !deleted | 복합 부분 |

---

## 11. 타임라인 요약

```
18:20 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-1] 인증 최적화 — 175개 파일 getCachedUserRole 전환
  │  [WS-2] 채팅 양방향 페이지네이션 + 가상 스크롤 최적화
  │  [WS-3] 캘린더 반응형 + PWA SW 수정 + 인증 보고서
19:00 ────────────────────────────────────────────────────────────
  │
19:35 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-4] 페이지 로드 최적화 — proxy JWT 파싱, 쿼리 병렬화, 캐시
20:00 ────────────────────────────────────────────────────────────
  │
20:48 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-4] force-dynamic 전환, N+1 제거
  │  [WS-5] Disk I/O 위기 대응 — RPC, 인덱스, WAL 축소, cron
21:00 ────────────────────────────────────────────────────────────
  │
21:33 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-6] WAL → Broadcast 전환 (publication 완전 제거)
21:48 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-6] private:true 수정 + 캘린더 SSR 최적화
22:00 ────────────────────────────────────────────────────────────
  │
22:21 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-7] 캘린더 N+1 제거, 이중 refetch 제거, invalidation 범위 축소
22:58 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │  [WS-7] 추가 병렬화, barrel import 제거, dynamic import
  │  [WS-8] RLS initplan 규칙 수립 + lint 스크립트 + DB 직접 적용
  ╰──────────────────────────────────────────────────────────────
```

### 시간 배분 추정

| Work Stream | 추정 소요 | 비중 |
|-------------|----------|:---:|
| WS-1 인증 최적화 | ~55분 | 20% |
| WS-2 채팅 페이지네이션 | ~45분 | 16% |
| WS-3 UI/UX (캘린더·PWA) | ~20분 | 7% |
| WS-4 페이지 로드 최적화 | ~65분 | 23% |
| WS-5 Disk I/O 위기 대응 | ~35분 | 13% |
| WS-6 Realtime WAL→Broadcast | ~25분 | 9% |
| WS-7 캘린더 쿼리 최적화 | ~13분 | 5% |
| WS-8 RLS & DB 인프라 정비 | ~20분 | 7% |

---

## 12. 향후 개발 시 참고사항

### 12.1 인증 관련 (MUST READ)

```
✅ DO: getCachedUserRole()          — 역할 확인 시 유일한 진입점
✅ DO: getCachedAuthUser()          — auth.getUser() 대체
✅ DO: getCurrentUser()             — 이미 캐시 적용

❌ DON'T: getCurrentUserRole()      — 캐시 없음, 직접 호출 금지
❌ DON'T: supabase.auth.getUser()   — Node에서 직접 호출 금지
❌ DON'T: proxy.ts에 DB 쿼리 추가   — Edge Runtime, 캐시 공유 불가
```

**새 페이지/서버 액션 작성 시 체크리스트**:
1. 인증이 필요하면 → `getCachedAuthUser()` 또는 가드 함수 사용
2. 역할이 필요하면 → `getCachedUserRole()` 사용
3. proxy.ts 수정 시 → DB 쿼리 절대 추가 금지

### 12.2 Realtime 관련

```
현재 아키텍처:
- WAL polling: 0개 (완전 제거)
- Broadcast: student_plan, calendar_events (DB Trigger 기반)
- 채팅: 기존 Broadcast 유지

새 테이블에 Realtime 필요 시:
1. DB Trigger 함수 생성 (broadcast_[table]_changes)
2. Trigger → net.http_post → Supabase Realtime API
3. 클라이언트: .on('broadcast', ...) 수신
4. ⚠️ subscribe 시 config.private = true 필수
5. ❌ supabase_realtime publication에 테이블 추가 금지 (WAL 폴링 부활)
```

### 12.3 RLS 정책 관련 (MUST READ)

```
새 RLS 정책/헬퍼 함수 작성 시:

✅ DO:
  (SELECT auth.uid())   — initplan으로 쿼리당 1회 평가
  (SELECT auth.role())  — 동일
  (SELECT auth.jwt())   — 동일

❌ DON'T:
  auth.uid()            — 행마다 재평가 (10만 행 = 10만 번 호출)
  auth.role()           — 동일
  auth.jwt()            — 동일

헬퍼 함수(SECURITY DEFINER) 내부에서도 동일 규칙:
  SELECT EXISTS (
    SELECT 1 FROM table
    WHERE id = (SELECT auth.uid())  ← 반드시 래핑
  );

검증 방법:
  ./scripts/lint-rls-policies.sh              # 전체 마이그레이션 스캔
  ./scripts/lint-rls-policies.sh path/to.sql  # 특정 파일 스캔
```

### 12.4 SECURITY DEFINER 함수 작성 규칙

```
SECURITY DEFINER 함수는 RLS를 우회하므로 주의가 필요:

1. search_path 반드시 명시
   → SET search_path TO '' (빈 문자열) 또는 SET search_path = public
   → 미설정 시 schema injection 가능

2. 입력 검증
   → 사용자 입력을 직접 쿼리에 사용하지 말 것
   → 파라미터 바인딩 사용

3. 최소 권한
   → 필요한 테이블/컬럼만 접근
   → 불필요하게 SECURITY DEFINER 사용 금지

현재 프로젝트의 SECURITY DEFINER 함수:
  - get_dashboard_statistics (RPC)
  - broadcast_student_plan_changes (Trigger)
  - broadcast_calendar_event_changes (Trigger)
  - 기존 RLS 헬퍼 함수들
```

### 12.5 성능 관련

```
쿼리 작성 시:
- Promise.all로 독립 쿼리 병렬화
- SELECT *  금지 → 필요한 컬럼만 명시
- .limit() 항상 명시 (특히 JSONB 포함 테이블)
- N+1 감지 시 → 배치 조회 또는 FK join으로 전환

캘린더 관련:
- RRULE 쿼리: 6개월 이내로 제한
- 반복 이벤트 예외: .in() 배치 쿼리 사용
- Realtime invalidation: 채널 특정 키만 (6개 프리픽스 전체 금지)

캐시 관련:
- React.cache() — 같은 RSC 요청 내 공유
- unstable_cache() — 요청 간 공유 (tag 기반 invalidation)
- 불변 데이터 (calendar ID 등) → 별도 캐시 레이어
```

### 12.6 Disk I/O 모니터링

```
정기 점검 (주 1회 권장):
1. Supabase Dashboard → Observability → Disk IO Budget
2. pg_stat_statements Top 15 쿼리 확인
3. temp_files / temp_bytes 확인

위험 신호:
- Disk IO % consumed > 1% → 지속적 초과
- temp_bytes 증가 추세 → work_mem 재검토
- 특정 쿼리 avg_ms > 1000 → 인덱스/RPC 전환 검토
```

### 12.7 보안 주의사항 (이번 작업에서 발견)

| 발견 | 교훈 |
|------|------|
| superadmin 역할 누락 | 역할 목록 하드코딩 시 모든 역할 포함 확인 |
| metadata 없는 사용자 잠김 | 기존 사용자 데이터 호환성 항상 고려 |
| proxy.ts DB 제거 시 보안 격차 | 인증≠인가, 각 레이어의 책임 명확히 분리 |

---

## 13. 관련 문서 목록

| 문서 | 경로 | 내용 |
|------|------|------|
| 인증 최적화 보고서 | `docs/architecture/auth-performance-optimization-report.md` | WS-1 상세 기술 문서 (470줄) |
| Disk I/O 최적화 보고서 | `docs/architecture/disk-io-optimization-report-2026-03-13.md` | WS-5 상세 기술 문서 |
| 채팅 스크롤 로드맵 | `docs/chat-scroll-improvement-roadmap.md` | WS-2 6-Phase 로드맵 |
| DB 마이그레이션 (인덱스) | `supabase/migrations/20260323100000_add_disk_io_optimization_indexes.sql` | WS-5 인덱스 + RPC |
| DB 마이그레이션 (Broadcast) | `supabase/migrations/20260324000000_broadcast_student_plan_calendar_events.sql` | WS-6 Trigger 함수 |
| DB 마이그레이션 (복합 인덱스) | `supabase/migrations/20260324100000_add_recurring_exception_index.sql` | WS-7 반복 이벤트 인덱스 |
| RLS 린트 스크립트 | `scripts/lint-rls-policies.sh` | WS-8 initplan 위반 검출 (미커밋) |
| CLAUDE.md RLS 규칙 | `CLAUDE.md` (Database 섹션) | WS-8 initplan 최적화 규칙 (미커밋) |

---

## 커밋 전체 목록

| # | 시간 | 해시 | 메시지 | 파일 수 | +/- |
|---|------|------|--------|:---:|-----|
| 1 | 18:20 | `56c4cde` | refactor(auth): migrate to getCachedUserRole | 170 | +431/-467 |
| 2 | 18:20 | `42d25e7` | feat(chat): bidirectional pagination, virtual scroll | 23 | +1359/-181 |
| 3 | 18:21 | `bf49552` | fix(ui): calendar responsiveness, prefetch debounce | 8 | +96/-81 |
| 4 | 18:21 | `c6c6c92` | fix(pwa): bypass API routes in service worker | 2 | +24/-0 |
| 5 | 18:22 | `95d3f7a` | docs: auth performance optimization report | 1 | +470/-0 |
| 6 | 19:35 | `22b4aff` | perf: page load optimization (proxy, calendar, dashboard) | 14 | +530/-240 |
| 7 | 20:48 | `221b849` | perf: force-dynamic, N+1 elimination, calendar cache | 11 | +175/-173 |
| 8 | 20:48 | `aebb35c` | perf(db): Disk I/O budget fix (RPC, Realtime, cron) | 5 | +199/-299 |
| 9 | 21:33 | `c502491` | perf(realtime): WAL → Broadcast triggers | 4 | +167/-162 |
| 10 | 21:48 | `c180b5c` | fix(realtime): private:true + calendar SSR | 5 | +23/-21 |
| 11 | 22:21 | `f4194fe` | perf(calendar): N+1 loops, double refetch, invalidation | 5 | +147/-86 |
| 12 | 22:58 | `c41d482` | perf: parallelize queries, dynamic imports | 9 | +61/-77 |
