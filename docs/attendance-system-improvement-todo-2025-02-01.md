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

### Phase 1: 퇴실 QR 스캔 기능 구현

#### 1.1 퇴실 QR 스캔 액션 함수 추가
- [ ] `app/(student)/actions/attendanceActions.ts`에 `checkOutWithQRCode` 함수 추가
  - QR 코드 검증 로직
  - 기존 입실 기록 확인
  - 퇴실 시간 및 방법 기록 (`check_out_method: "qr"`)
  - SMS 발송 처리
  - 에러 핸들링 및 로깅

#### 1.2 퇴실 QR 스캐너 컴포넌트 추가/수정
- [ ] `app/(student)/attendance/check-in/_components/QRCodeScanner.tsx` 수정
  - 입실/퇴실 모드 구분 가능하도록 props 추가
  - 또는 별도 `CheckOutQRCodeScanner.tsx` 컴포넌트 생성
  - 퇴실 전용 메시지 및 UI

#### 1.3 퇴실 페이지 UI 개선
- [ ] `app/(student)/attendance/check-in/_components/CheckInPageContent.tsx` 수정
  - 입실 방법에 따라 퇴실 방법 결정 로직 추가
  - QR 입실인 경우: QR 스캔 필수
  - 위치 입실인 경우: 위치 확인 또는 버튼 클릭 선택 가능
  - 수동 입실인 경우: 버튼 클릭만으로 처리
  - 퇴실 방법 선택 UI 추가

#### 1.4 퇴실 방법별 처리 로직 구현
- [ ] `app/(student)/actions/attendanceActions.ts`에 `checkOutWithLocation` 함수 추가
  - 위치 기반 퇴실 처리
  - 위치 검증 로직
  - 퇴실 시간 및 방법 기록

---

### Phase 2: SMS 발송 시스템 개선

#### 2.1 SMS 발송 설정 확인 로직 개선
- [ ] `lib/services/attendanceSMSService.ts` 수정
  - 설정 확인 실패 시 상세 로그 출력
  - 설정 상태를 반환하여 UI에서 표시 가능하도록 개선
  - 디버깅을 위한 로그 레벨 조정

#### 2.2 SMS 발송 실패 처리 개선
- [ ] `app/(student)/actions/attendanceActions.ts` 수정
  - SMS 발송 실패 시 상세 에러 정보 로깅
  - 설정 비활성화인 경우와 실제 발송 실패 구분
  - 사용자에게 명확한 피드백 제공 (선택사항)

#### 2.3 관리자 설정 페이지 개선
- [ ] `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx` 수정
  - "학생 직접 체크인 시 발송" 설정의 중요성 강조
  - 설정 설명 개선
  - 기본값 변경 고려 (현재: false → true로 변경 검토)

#### 2.4 SMS 발송 로그 확인 기능
- [ ] SMS 발송 이력 확인 기능 추가
  - 관리자 페이지에서 SMS 발송 로그 확인
  - 발송 실패 원인 표시
  - 재발송 기능 (선택사항)

---

### Phase 3: 전체 출석 기능 흐름 개선

#### 3.1 입실/퇴실 방법 일관성 확보
- [ ] `app/(student)/attendance/check-in/_components/CheckInPageContent.tsx` 수정
  - 입실 방법 저장 및 퇴실 시 활용
  - 퇴실 방법 선택 UI 개선
  - 입실/퇴실 방법 불일치 방지

#### 3.2 출석 상태 표시 개선
- [ ] `app/(student)/attendance/check-in/_components/AttendanceStatus.tsx` 수정
  - 입실/퇴실 방법 명확히 표시
  - QR 스캔 필요 여부 표시
  - SMS 발송 상태 표시 (선택사항)

#### 3.3 에러 처리 및 사용자 피드백 개선
- [ ] 모든 출석 관련 액션 함수에 에러 처리 강화
  - 명확한 에러 메시지
  - 사용자 친화적인 피드백
  - 로깅 개선

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
): Promise<{ success: boolean; error?: string }>
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

### 높음 (즉시 처리)
1. ✅ Phase 1.1: 퇴실 QR 스캔 액션 함수 추가
2. ✅ Phase 1.3: 퇴실 페이지 UI 개선
3. ✅ Phase 2.3: 관리자 설정 페이지 개선

### 중간 (단기)
4. Phase 1.2: 퇴실 QR 스캐너 컴포넌트 추가/수정
5. Phase 2.1: SMS 발송 설정 확인 로직 개선
6. Phase 3.1: 입실/퇴실 방법 일관성 확보

### 낮음 (중기)
7. Phase 1.4: 퇴실 방법별 처리 로직 구현
8. Phase 2.2: SMS 발송 실패 처리 개선
9. Phase 3.2: 출석 상태 표시 개선
10. Phase 3.3: 에러 처리 및 사용자 피드백 개선

### 선택사항 (장기)
11. Phase 2.4: SMS 발송 로그 확인 기능
12. Phase 3.4: 출석 기록 검증 로직 추가
13. Phase 4: 테스트 및 문서화

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

---

**마지막 업데이트**: 2025-02-01

