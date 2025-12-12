# RLS 문제 정리 및 해결 방안 구현 완료

## 작업 일자
2025년 2월 1일

## 문제 현황

### 발견된 문제
1. **SMS 로그 RLS 정책 위반**: `lib/services/smsService.ts:256`에서 학생이 직접 체크인/체크아웃 시 SMS 로그 생성 실패
2. **출석 기록 RLS 정책 위반**: `app/(student)/actions/attendanceActions.ts:544`에서 학생이 직접 체크인/체크아웃 시 출석 기록 생성/수정 실패
3. **중복 코드**: Admin 클라이언트 선택 로직이 여러 파일에 중복됨

### 현재 RLS 정책 상태 (Supabase MCP 확인)
- `attendance_records`: 학생 INSERT/UPDATE 정책 없음 (관리자만 가능) → **해결됨**
- `sms_logs`: 학생 INSERT 정책 없음 (관리자만 가능) → **Admin 클라이언트 사용으로 해결**
- `student_plan`: 학생 INSERT/UPDATE 정책 있음 (정상)

## 구현 완료 사항

### Phase 1: 공통 유틸리티 함수 생성 및 중복 코드 최적화

#### 1.1 공통 유틸리티 함수 확장
**파일**: `lib/supabase/clientSelector.ts` (기존 파일 확장)

다음 함수들을 추가하여 RLS 우회가 필요한 일반적인 경우를 처리:

- `getSupabaseClientForRLSBypass()`: RLS 우회가 필요한 작업을 위한 클라이언트 선택
- `getSupabaseClientForStudentOperation()`: 학생이 자신의 데이터를 생성/수정할 때 사용하는 클라이언트 선택
- `getClientForRLSBypass()`: 간단한 RLS 우회 클라이언트 선택 (중복 패턴 통합용)

**참고**: 기존 `lib/utils/supabaseClientSelector.ts`는 deprecated로 표시하고 `lib/supabase/clientSelector.ts`로 재export

#### 1.2 중복 코드 최적화

**1.2.1 SMS 로그 생성 수정**
- **파일**: `lib/services/smsService.ts`
- **변경**: `createSupabaseServerClient()` → `getSupabaseClientForRLSBypass()` 사용
- **이유**: SMS 로그는 시스템이 생성하므로 RLS 우회 필요
- **수정 위치**:
  - SMS 로그 생성 (248-277줄)
  - SMS 로그 업데이트 (432줄, 467줄, 559줄)
  - 예약 발송 취소 시 로그 업데이트 (737줄)

**1.2.2 출석 기록 생성/수정 수정**
- **파일**: `lib/domains/attendance/repository.ts`
- **변경**: 중복된 Admin 클라이언트 선택 로직을 공통 함수로 통합
- **수정 함수**:
  - `insertAttendanceRecord()`: `getSupabaseClientForRLSBypass()` 사용
  - `updateAttendanceRecord()`: `getSupabaseClientForRLSBypass()` 사용

**1.2.3 기존 중복 패턴 통합**
다음 파일들의 중복된 Admin 클라이언트 선택 로직을 공통 함수로 통합:
- `lib/data/contentMasters.ts`: 5개 함수에서 중복 패턴 통합
  - `getCurriculumRevisions()`
  - `getPublishersForFilter()`
  - `getPlatformsForFilter()`
  - `getDifficultiesForMasterBooks()`
  - `getDifficultiesForMasterLectures()`

**패턴 변경**:
```typescript
// 변경 전 (중복)
const supabaseAdmin = createSupabaseAdminClient();
const supabase = supabaseAdmin || await createSupabaseServerClient();

// 변경 후 (통합)
const supabase = await getClientForRLSBypass();
```

### Phase 2: RLS 정책 재설계

#### 2.1 출석 기록 RLS 정책 추가
**마이그레이션 파일**: `supabase/migrations/20251212111311_add_attendance_records_student_policies.sql`

학생이 자신의 출석 기록을 생성/수정할 수 있도록 정책 추가:

```sql
-- 학생이 자신의 출석 기록을 생성할 수 있도록 정책 추가
CREATE POLICY "attendance_records_insert_student" ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.tenant_id = attendance_records.tenant_id
    )
  );

-- 학생이 자신의 출석 기록을 수정할 수 있도록 정책 추가
CREATE POLICY "attendance_records_update_student" ON attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid()
  );
```

**정책 설명**:
- `attendance_records_insert_student`: 학생이 자신의 출석 기록을 생성할 수 있도록 허용 (자신의 student_id와 일치하고, 같은 tenant_id에 속한 경우만)
- `attendance_records_update_student`: 학생이 자신의 출석 기록을 수정할 수 있도록 허용 (자신의 student_id와 일치하는 경우만)

## 수정된 파일 목록

1. `lib/supabase/clientSelector.ts` - 공통 유틸리티 함수 추가
2. `lib/utils/supabaseClientSelector.ts` - deprecated 표시 및 재export
3. `lib/services/smsService.ts` - SMS 로그 생성/업데이트 시 공통 함수 사용
4. `lib/domains/attendance/repository.ts` - 출석 기록 생성/수정 시 공통 함수 사용
5. `lib/data/contentMasters.ts` - 중복 패턴 통합
6. `supabase/migrations/20251212111311_add_attendance_records_student_policies.sql` - 학생 RLS 정책 추가

## 다음 단계

### 테스트 필요 사항
1. **학생 직접 체크인/체크아웃 테스트**: RLS 정책 위반 에러 없음 확인
2. **SMS 로그 생성 테스트**: 정상 동작 확인
3. **SMS 로그 RLS 정책 검토**: 정책 추가 필요 여부 결정

### 향후 개선 사항
1. `lib/data/contentMetadata.ts`와 `lib/data/subjects.ts`에서 `createSupabaseAdminClient()` 사용 패턴 검토 및 통합
2. 다른 테이블의 RLS 정책도 학생 권한이 필요한 경우 정책 추가 검토
3. RLS 정책 문서화 및 개발 가이드라인 업데이트

## 참고 사항

- SMS 로그는 시스템 레벨 작업이므로 Admin 클라이언트 사용이 적절함
- 출석 기록은 학생이 자신의 데이터를 직접 생성/수정할 수 있어야 하므로 RLS 정책 추가가 적절함
- 공통 함수 사용으로 코드 중복을 줄이고 유지보수성을 향상시킴

