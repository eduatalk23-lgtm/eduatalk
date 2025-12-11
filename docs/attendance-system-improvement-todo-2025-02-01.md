# 출석 시스템 개선 TODO

**작성일**: 2025-02-01  
**목적**: 출석 기능 및 SMS 알림 시스템 전반 개선

---

## 📋 개요

### 발견된 문제점

1. **퇴실 처리 문제**

   - QR로 입실했어도 퇴실은 QR 스캔 없이 버튼 클릭만으로 처리됨
   - `check_out_method`가 입실 방법을 따라가지만 실제로는 QR 스캔을 하지 않음

2. **SMS 발송 문제**

   - QR 출석 시 SMS가 발송되지 않음
   - 원인: `attendance_sms_student_checkin_enabled` 설정이 기본값 `false`
   - 관리자가 설정을 활성화하지 않으면 SMS 발송 안 됨

3. **사용자 경험 문제**
   - 퇴실 방법이 입실 방법과 일치하지 않음
   - SMS 발송 실패 시 명확한 피드백 부족

---

## 🎯 작업 계층 구조

### Phase 1: 퇴실 QR 스캔 기능 구현 ✅ **완료**

#### 1.1 퇴실 QR 스캔 액션 함수 추가 ✅

- [x] `app/(student)/actions/attendanceActions.ts`에 `checkOutWithQRCode` 함수 추가
  - QR 코드 검증 로직
  - 기존 입실 기록 확인
  - 퇴실 시간 및 방법 기록 (`check_out_method: "qr"`)
  - SMS 발송 처리
  - 에러 핸들링 및 로깅
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase1-implementation-2025-02-01.md`)

#### 1.2 퇴실 QR 스캐너 컴포넌트 추가/수정 ✅

- [x] `app/(student)/attendance/check-in/_components/QRCodeScanner.tsx` 수정
  - 입실/퇴실 모드 구분 가능하도록 props 추가 (`mode: "check-in" | "check-out"`)
  - 퇴실 전용 메시지 및 UI
  - 하위 호환성 유지 (기본값: `"check-in"`)
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase1-implementation-2025-02-01.md`)

#### 1.3 퇴실 페이지 UI 개선 ✅

- [x] `app/(student)/attendance/check-in/_components/CheckInPageContent.tsx` 수정
  - 입실 방법에 따라 퇴실 방법 결정 로직 추가
  - QR 입실인 경우: QR 스캔 필수
  - 위치 입실인 경우: 버튼 클릭으로 처리
  - 수동 입실인 경우: 버튼 클릭만으로 처리
  - 조건부 렌더링으로 적절한 UI 표시
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase1-implementation-2025-02-01.md`)

#### 1.4 퇴실 방법별 처리 로직 구현 ✅

- [x] `app/(student)/actions/attendanceActions.ts`에 `checkOutWithLocation` 함수 추가
  - 위치 기반 퇴실 처리
  - 위치 검증 로직
  - 퇴실 시간 및 방법 기록 (`check_out_method: "location"`)
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase1-implementation-2025-02-01.md`)
  - **참고**: 현재는 UI에서 사용되지 않지만, 향후 위치 기반 퇴실 기능 확장 시 활용 가능

---

### Phase 2: SMS 발송 시스템 개선 ✅ **완료**

#### 2.1 SMS 발송 설정 확인 로직 개선 ✅

- [x] `lib/services/attendanceSMSService.ts` 수정
  - 설정 확인 실패 시 상세 로그 출력
  - 설정 상태를 반환하여 UI에서 표시 가능하도록 개선 (`ShouldSendAttendanceSMSResult` 타입)
  - 디버깅을 위한 로그 레벨 조정
  - 상세 정보 반환: `shouldSend`, `reason`, `details`
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase2-implementation-2025-02-01.md`)

#### 2.2 SMS 발송 실패 처리 개선 ✅

- [x] `app/(student)/actions/attendanceActions.ts` 수정
  - SMS 발송 실패 시 상세 에러 정보 로깅
  - 설정 비활성화인 경우와 실제 발송 실패 구분 (`SendAttendanceSMSResult` 타입)
  - 로그 레벨 조정: 설정 비활성화는 `console.info`, 발송 실패는 `logError`
  - 모든 출석 액션 함수에 적용 (checkInWithQRCode, checkInWithLocation, checkOutWithQRCode, checkOutWithLocation, checkOut)
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase2-implementation-2025-02-01.md`)

#### 2.3 관리자 설정 페이지 개선 ✅

- [x] `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx` 수정
  - "학생 직접 체크인 시 발송" 설정의 중요성 강조 (경고 배지 및 메시지 박스 추가)
  - 설정 설명 개선 (설정 간 관계 설명 추가)
  - UI 개선: 중요 설정에 경고 아이콘 및 배지 추가
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase2-implementation-2025-02-01.md`)
  - **참고**: 기본값 변경은 검토 중 (현재: false)

#### 2.4 SMS 발송 로그 확인 기능 ✅

- [x] SMS 발송 이력 확인 기능 추가
  - 관리자 페이지에서 SMS 발송 로그 확인 (`/admin/attendance/sms-logs`)
  - 발송 실패 원인 표시
  - 필터링 기능: 날짜 범위, 학생별, 상태별, SMS 타입별
  - 페이지네이션 지원
  - 전화번호 마스킹 처리
  - 통계 카드: 전체/성공/실패/대기
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase2-implementation-2025-02-01.md`)
  - **참고**: 재발송 기능은 향후 개선 사항으로 남겨둠

---

### Phase 3: 전체 출석 기능 흐름 개선

#### 3.1 입실/퇴실 방법 일관성 확보 ✅

- [x] `app/(student)/attendance/check-in/_components/CheckInPageContent.tsx` 수정
  - 입실 방법 저장 및 퇴실 시 활용 (Phase 1에서 완료)
  - 퇴실 방법 선택 UI 개선 (Phase 1에서 완료)
  - 입실/퇴실 방법 불일치 방지 (QR 입실 시 QR 퇴실 강제)
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase1-implementation-2025-02-01.md`)

#### 3.2 출석 상태 표시 개선

- [ ] `app/(student)/attendance/check-in/_components/AttendanceStatus.tsx` 수정
  - 입실/퇴실 방법 명확히 표시
  - QR 스캔 필요 여부 표시
  - SMS 발송 상태 표시 (선택사항)

#### 3.3 에러 처리 및 사용자 피드백 개선 ✅ **부분 완료**

- [x] 모든 출석 관련 액션 함수에 에러 처리 강화
  - 명확한 에러 메시지 (Phase 1, 2에서 완료)
  - 사용자 친화적인 피드백 (Phase 1에서 완료)
  - 로깅 개선 (Phase 1, 2에서 완료)
  - Step-by-step 컨텍스트 로깅으로 디버깅 용이성 향상
  - **완료일**: 2025-02-01 (참고: `docs/attendance-system-phase1-implementation-2025-02-01.md`, `docs/attendance-system-phase2-implementation-2025-02-01.md`)
  - **참고**: SMS 발송 실패 시 사용자 알림은 선택사항으로 남겨둠

#### 3.4 출석 기록 검증 로직 추가

- [ ] `lib/domains/attendance/service.ts` 수정
  - 입실/퇴실 시간 검증
  - 입실/퇴실 방법 일관성 검증
  - 중복 처리 방지 강화

---

### Phase 4: 테스트 및 문서화

#### 4.1 단위 테스트 작성

- [ ] 퇴실 QR 스캔 기능 테스트
- [ ] SMS 발송 로직 테스트
- [ ] 출석 기록 검증 로직 테스트

#### 4.2 통합 테스트

- [ ] 입실 → 퇴실 전체 플로우 테스트
- [ ] SMS 발송 전체 플로우 테스트
- [ ] 에러 케이스 테스트

#### 4.3 문서화

- [ ] 출석 기능 사용 가이드 작성
- [ ] SMS 설정 가이드 작성
- [ ] 관리자 매뉴얼 업데이트

---

## 🔧 기술적 세부사항

### 퇴실 QR 스캔 구현 상세

#### 함수 시그니처

```typescript
export async function checkOutWithQRCode(
  qrData: string
): Promise<{ success: boolean; error?: string }>;
```

#### 처리 흐름

1. 인증 확인
2. QR 코드 검증
3. 오늘 날짜의 입실 기록 확인
4. 입실 기록이 없으면 에러
5. 이미 퇴실 처리되었으면 에러
6. QR 코드 검증 (입실 시 사용한 QR과 동일한지 확인)
7. 퇴실 시간 기록 (`check_out_method: "qr"`)
8. SMS 발송 (설정 확인 후)
9. 성공 반환

### SMS 발송 설정 확인 개선

#### 현재 문제

- 설정 확인 실패 시 조용히 실패
- 설정 상태를 사용자에게 알리지 않음

#### 개선 방안

- 설정 확인 결과를 반환
- 설정 비활성화 시 로그에 명확히 기록
- 관리자에게 설정 상태 알림 (선택사항)

---

## 📝 우선순위

### ✅ 완료된 항목

1. ✅ Phase 1.1: 퇴실 QR 스캔 액션 함수 추가 (2025-02-01)
2. ✅ Phase 1.2: 퇴실 QR 스캐너 컴포넌트 추가/수정 (2025-02-01)
3. ✅ Phase 1.3: 퇴실 페이지 UI 개선 (2025-02-01)
4. ✅ Phase 1.4: 퇴실 방법별 처리 로직 구현 (2025-02-01)
5. ✅ Phase 2.1: SMS 발송 설정 확인 로직 개선 (2025-02-01)
6. ✅ Phase 2.2: SMS 발송 실패 처리 개선 (2025-02-01)
7. ✅ Phase 2.3: 관리자 설정 페이지 개선 (2025-02-01)
8. ✅ Phase 2.4: SMS 발송 로그 확인 기능 (2025-02-01)
9. ✅ Phase 3.1: 입실/퇴실 방법 일관성 확보 (2025-02-01)
10. ✅ Phase 3.3: 에러 처리 및 사용자 피드백 개선 (2025-02-01, 부분 완료)

### 진행 중 / 남은 항목

### 중간 (단기)

1. Phase 3.2: 출석 상태 표시 개선
   - 입실/퇴실 방법 명확히 표시
   - QR 스캔 필요 여부 표시
   - SMS 발송 상태 표시 (선택사항)

### 낮음 (중기)

2. Phase 3.4: 출석 기록 검증 로직 추가
   - 입실/퇴실 시간 검증
   - 입실/퇴실 방법 일관성 검증
   - 중복 처리 방지 강화

### 선택사항 (장기)

3. Phase 4: 테스트 및 문서화
   - 단위 테스트 작성
   - 통합 테스트
   - 문서화

---

## 🚀 시작하기

### 즉시 조치 사항

1. 관리자 페이지에서 "학생 직접 체크인 시 발송" 설정 활성화
   - 경로: `/admin/attendance/settings`
   - 설정: "학생 직접 체크인 시 발송" 토글 ON

### 개발 시작

1. Phase 1.1부터 순차적으로 진행
2. 각 단계 완료 후 테스트
3. 문제 발견 시 즉시 수정

---

## 📌 참고사항

### 관련 파일

- `app/(student)/actions/attendanceActions.ts` - 출석 액션 함수
- `app/(student)/attendance/check-in/_components/CheckInPageContent.tsx` - 출석 페이지 UI
- `app/(student)/attendance/check-in/_components/QRCodeScanner.tsx` - QR 스캐너
- `lib/services/attendanceSMSService.ts` - SMS 발송 서비스
- `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx` - SMS 설정 폼

### 데이터베이스 스키마

- `attendance_records` 테이블
  - `check_in_method`: 'manual' | 'qr' | 'location' | 'auto'
  - `check_out_method`: 'manual' | 'qr' | 'location' | 'auto'
- `tenants` 테이블
  - `attendance_sms_student_checkin_enabled`: boolean (기본값: false)
  - `attendance_sms_check_in_enabled`: boolean (기본값: true)
  - `attendance_sms_check_out_enabled`: boolean (기본값: true)

### 기존 문서

- `docs/qr-attendance-error-logging-improvement-2025-02-01.md` - QR 출석 에러 로깅 개선
- `docs/2025-12-08-attendance-sms-recipient-selection-implementation.md` - SMS 수신자 선택 기능
- `docs/attendance-system-phase1-implementation-2025-02-01.md` - Phase 1 구현 완료 보고서
- `docs/attendance-system-phase2-implementation-2025-02-01.md` - Phase 2 구현 완료 보고서

---

## 📊 구현 현황 요약

### 완료율

- **Phase 1**: 100% 완료 (4/4)
- **Phase 2**: 100% 완료 (4/4)
- **Phase 3**: 50% 완료 (2/4)
- **Phase 4**: 0% 완료 (0/3)

### 전체 진행률

- **총 15개 항목 중 10개 완료**: 66.7%
- **핵심 기능**: 완료 (Phase 1, 2)
- **추가 개선**: 진행 중 (Phase 3, 4)

---

**마지막 업데이트**: 2025-02-01
