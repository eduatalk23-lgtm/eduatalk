# QR 코드 관리 시스템 개선

## 개요

출석용 QR 코드를 데이터베이스에 저장하고 관리하여, 하나의 활성 QR 코드만 유효하도록 하고 생성 이력을 추적할 수 있도록 개선했습니다.

## 구현 내용

### 1. 데이터베이스 스키마 추가

**파일**: `supabase/migrations/20250108000000_create_attendance_qr_codes_table.sql`

- `attendance_qr_codes` 테이블 생성
- 필드: id, tenant_id, qr_data, qr_code_url, is_active, expires_at, created_by, created_at, deactivated_at, deactivated_by, usage_count, last_used_at
- 인덱스: tenant_id, (tenant_id, is_active, expires_at) WHERE is_active = true
- RLS 정책: 관리자 조회/생성/수정, 학생 활성 QR 코드 조회

### 2. QR 코드 도메인 생성

**파일**: 
- `lib/domains/qrCode/repository.ts` - 데이터 접근 계층
- `lib/domains/qrCode/service.ts` - 비즈니스 로직 계층
- `lib/domains/qrCode/index.ts` - Public API

**주요 함수**:
- `createQRCode()`: QR 코드 생성 (기존 활성 QR 자동 비활성화)
- `getActiveQRCode()`: 활성 QR 코드 조회
- `verifyAndUpdateQRCode()`: QR 코드 검증 및 사용 통계 업데이트
- `deactivateQRCode()`: QR 코드 비활성화
- `getQRCodeHistory()`: QR 코드 이력 조회

### 3. QR 코드 서비스 수정

**파일**: `lib/services/qrCodeService.ts`

**변경 사항**:
- `QRCodeData` 타입에 `qrCodeId` 필드 추가
- `QRCodeRecord` 타입 추가
- `generateAttendanceQRCode()`: DB 저장 및 기존 QR 비활성화 로직 추가
- `verifyQRCode()`: DB 기반 검증으로 변경 (비동기 함수)

### 4. 서버 액션 수정

**파일**: `app/(admin)/actions/qrCodeActions.ts`

**변경 사항**:
- `generateQRCodeAction()`: 반환값에 `qrCodeId` 추가
- `getActiveQRCodeAction()`: 활성 QR 코드 조회 액션 추가
- `deactivateQRCodeAction()`: QR 코드 비활성화 액션 추가
- `getQRCodeHistoryAction()`: QR 코드 이력 조회 액션 추가

**파일**: `app/(student)/actions/attendanceActions.ts`

**변경 사항**:
- `checkInWithQRCode()`: DB 기반 검증으로 변경
- `withErrorHandling` 제거, 직접 try-catch 처리

### 5. UI 컴포넌트 수정

**파일**: `app/(admin)/admin/attendance/qr-code/_components/QRCodeDisplay.tsx`

**변경 사항**:
- 활성 QR 코드 정보 표시 (생성 시간, 만료 시간, 사용 횟수, 마지막 사용 시간)
- 활성 QR 코드가 있으면 새로 생성하지 않고 표시
- 활성 QR 코드가 없으면 새로 생성

**파일**: `app/(admin)/admin/attendance/qr-code/manage/page.tsx` (신규)
**파일**: `app/(admin)/admin/attendance/qr-code/manage/_components/QRCodeManageContent.tsx` (신규)

**기능**:
- QR 코드 이력 목록 표시
- 활성 QR 코드 비활성화 버튼
- 통계 정보 표시 (생성 시간, 만료 시간, 사용 횟수, 마지막 사용 시간)

## 주요 개선 사항

### 1. 하나의 활성 QR 코드만 유효
- 새 QR 코드 생성 시 기존 활성 QR 코드 자동 비활성화
- 활성 QR 코드만 검증 통과

### 2. 생성 이력 추적
- 모든 QR 코드 생성 이력 저장
- 생성자, 생성 시간, 비활성화 시간, 비활성화자 기록

### 3. 사용 통계 추적
- QR 코드 사용 횟수 자동 증가
- 마지막 사용 시간 기록

### 4. 만료 시간 관리
- 기본 24시간 만료
- 만료된 QR 코드는 자동으로 비활성화

### 5. 관리 기능
- 활성 QR 코드 조회
- QR 코드 수동 비활성화
- QR 코드 이력 조회

## 데이터 구조

### QR 코드 데이터 (JSON)
```json
{
  "qrCodeId": "uuid",
  "tenantId": "uuid",
  "timestamp": 1234567890,
  "type": "attendance"
}
```

### QR 코드 레코드 (DB)
- id: UUID
- tenant_id: UUID
- qr_data: JSON 문자열
- qr_code_url: Data URL (선택적)
- is_active: boolean
- expires_at: timestamptz
- created_by: UUID
- created_at: timestamptz
- deactivated_at: timestamptz (nullable)
- deactivated_by: UUID (nullable)
- usage_count: integer
- last_used_at: timestamptz (nullable)

## 사용 방법

### 관리자
1. `/admin/attendance/qr-code`: QR 코드 생성 및 표시
2. `/admin/attendance/qr-code/manage`: QR 코드 이력 조회 및 관리

### 학생
1. `/attendance/check-in`: QR 코드 스캔하여 출석 체크

## 보안 고려사항

1. RLS 정책으로 테넌트별 데이터 격리
2. 관리자만 QR 코드 생성/비활성화 가능
3. 학생은 활성 QR 코드만 조회 가능
4. 테넌트 일치 검증

## 향후 개선 사항

1. 만료 시간 관리자 설정 가능
2. QR 코드 자동 만료 처리 (스케줄러)
3. 만료 전 알림 기능
4. QR 코드 사용 통계 대시보드

