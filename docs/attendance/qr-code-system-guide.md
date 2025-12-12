# 출석 QR 코드 시스템 가이드

## 📋 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기능 분석 및 구현 방법](#기능-분석-및-구현-방법)
4. [작동 방식](#작동-방식)
5. [사용 방법](#사용-방법)
6. [데이터 구조](#데이터-구조)
7. [보안 및 검증](#보안-및-검증)
8. [에러 처리](#에러-처리)
9. [관련 파일 구조](#관련-파일-구조)

---

## 개요

출석 QR 코드 시스템은 학생들이 학원에 도착했을 때 QR 코드를 스캔하여 자동으로 출석을 체크하는 기능입니다. 이 시스템은 다음과 같은 특징을 가지고 있습니다:

- **QR 코드 기반 출석 체크**: 학생이 학원의 QR 코드를 스캔하여 입실/퇴실 기록
- **자동 검증**: QR 코드 유효성, 만료 시간, 테넌트 일치 여부 자동 확인
- **사용 통계 추적**: QR 코드 사용 횟수 및 마지막 사용 시간 자동 기록
- **SMS 알림 연동**: 출석 체크 시 학부모에게 자동 SMS 발송 (설정에 따라)
- **Deep Link 지원**: QR 코드 스캔 시 앱 자동 실행 (URL 형식 지원)

---

## 시스템 아키텍처

### 전체 흐름도

```
[관리자]                    [학생]
   │                          │
   ├─ QR 코드 생성 ────────────┤
   │  (관리자 페이지)          │
   │                          │
   │                          ├─ QR 코드 스캔
   │                          │  (카메라)
   │                          │
   │                          ├─ QR 코드 검증
   │                          │  (서버)
   │                          │
   │                          ├─ 출석 기록 저장
   │                          │  (데이터베이스)
   │                          │
   │                          ├─ SMS 발송
   │                          │  (선택적)
   │                          │
   └─ QR 코드 관리 ────────────┘
      (이력 조회, 비활성화)
```

### 레이어 구조

```
┌─────────────────────────────────────┐
│         UI Layer (Components)        │
│  - QRCodeScanner.tsx                 │
│  - QRCodeDisplay.tsx                 │
│  - CheckInPageContent.tsx            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Actions Layer (Server Actions) │
│  - attendanceActions.ts              │
│  - qrCodeActions.ts                 │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Service Layer (Business Logic) │
│  - qrCodeService.ts                  │
│  - attendance/service.ts              │
│  - qrCode/service.ts                 │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Repository Layer (Data Access)    │
│  - qrCode/repository.ts              │
│  - attendance/repository.ts         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Database (Supabase)          │
│  - attendance_qr_codes              │
│  - attendance_records                │
└─────────────────────────────────────┘
```

---

## 기능 분석 및 구현 방법

### 1. QR 코드 생성

#### 구현 위치
- **서비스**: `lib/services/qrCodeService.ts` - `generateAttendanceQRCode()`
- **도메인 서비스**: `lib/domains/qrCode/service.ts` - `createQRCode()`
- **Repository**: `lib/domains/qrCode/repository.ts` - `createQRCode()`

#### 주요 로직

```typescript
// 1. QR 코드 데이터 생성
const qrData: QRCodeData = {
  qrCodeId: tempId,        // 임시 ID (나중에 실제 ID로 업데이트)
  tenantId: tenantContext.tenantId,
  timestamp: Date.now(),
  type: "attendance"
};

// 2. QR 코드 이미지 생성 (Deep Link URL)
const deepLinkUrl = `${baseUrl}/attendance/check-in/qr?code=${qrCodeId}`;
const qrCodeUrl = await QRCode.toDataURL(deepLinkUrl, {
  width: 400,
  margin: 2,
  errorCorrectionLevel: "M"
});

// 3. 기존 활성 QR 코드 자동 비활성화
await repository.deactivateAllActiveQRCodes(tenantId, userId);

// 4. 새 QR 코드 DB 저장
const qrCodeRecord = await repository.createQRCode(
  tenantId,
  qrDataString,
  qrCodeUrl,
  expiresAt,
  userId
);
```

#### 특징
- **자동 비활성화**: 새 QR 코드 생성 시 기존 활성 QR 코드 자동 비활성화
- **만료 시간**: 기본 24시간 후 만료 (설정 가능)
- **Deep Link 지원**: URL 형식으로 생성하여 카메라 앱에서 스캔 시 자동 실행
- **이중 형식 지원**: JSON 형식(하위 호환) + URL 형식(Deep Link)

### 2. QR 코드 검증

#### 구현 위치
- **서비스**: `lib/services/qrCodeService.ts` - `verifyQRCode()`
- **도메인 서비스**: `lib/domains/qrCode/service.ts` - `verifyAndUpdateQRCode()`

#### 검증 단계

```typescript
// Step 1: URL 형식 또는 JSON 형식 파싱
const urlMatch = qrData.match(/\/attendance\/check-in\/qr\?code=([^&]+)/);
if (urlMatch) {
  // URL 형식: DB에서 직접 조회
  qrCodeId = urlMatch[1];
} else {
  // JSON 형식: 파싱 후 qrCodeId 추출
  const data = JSON.parse(qrData);
  qrCodeId = data.qrCodeId;
}

// Step 2: DB에서 QR 코드 조회
const qrCode = await repository.getQRCodeById(qrCodeId, tenantId);

// Step 3: 활성 상태 확인
if (!qrCode.is_active) {
  throw new AppError("QR 코드가 비활성화되었습니다.");
}

// Step 4: 만료 시간 확인
if (new Date() > new Date(qrCode.expires_at)) {
  throw new AppError("QR 코드가 만료되었습니다.");
}

// Step 5: 테넌트 일치 확인
if (qrCode.tenant_id !== tenantId) {
  throw new AppError("다른 학원의 QR 코드입니다.");
}

// Step 6: 사용 통계 업데이트
await repository.incrementQRCodeUsage(qrCodeId, tenantId);
```

#### 특징
- **이중 형식 지원**: URL 형식과 JSON 형식 모두 지원 (하위 호환성)
- **자동 통계 업데이트**: 검증 성공 시 사용 횟수 및 마지막 사용 시간 자동 업데이트
- **엄격한 검증**: 활성 상태, 만료 시간, 테넌트 일치 여부 모두 확인

### 3. 출석 기록 저장

#### 구현 위치
- **Actions**: `app/(student)/actions/attendanceActions.ts` - `checkInWithQRCode()`, `checkOutWithQRCode()`
- **도메인 서비스**: `lib/domains/attendance/service.ts` - `recordAttendance()`

#### 처리 단계

```typescript
// Step 1: 인증 확인
const user = await requireStudentAuth();

// Step 2: QR 코드 검증
const verification = await verifyQRCode(qrData);
if (!verification.valid) {
  throw new AppError(verification.error);
}

// Step 3: 테넌트 일치 확인
if (verification.tenantId !== tenantContext.tenantId) {
  throw new AppError("다른 학원의 QR 코드입니다.");
}

// Step 4: 중복 체크
const existing = await findAttendanceByStudentAndDate(userId, today);
if (existing && existing.check_in_time) {
  throw new AppError("이미 입실 체크가 완료되었습니다.");
}

// Step 5: 출석 기록 저장
const record = await recordAttendance({
  student_id: userId,
  attendance_date: today,
  check_in_time: now,
  check_in_method: "qr",
  status: "present"
});

// Step 6: SMS 발송 (비동기, 실패해도 출석 기록은 저장됨)
await sendAttendanceSMSIfEnabled(userId, "attendance_check_in", {...});
```

#### 특징
- **중복 방지**: 같은 날짜에 이미 입실 기록이 있으면 에러 반환
- **비동기 SMS**: SMS 발송 실패해도 출석 기록은 정상 저장
- **상세 로깅**: 각 단계별 상세 컨텍스트 로깅으로 디버깅 용이

---

## 작동 방식

### 입실 체크 프로세스

```
1. 학생이 출석 체크 페이지 접속
   ↓
2. "QR 코드" 방법 선택
   ↓
3. "QR 코드 스캔 시작" 버튼 클릭
   ↓
4. 카메라 권한 요청 (최초 1회)
   ↓
5. 카메라 활성화 (후면 카메라 우선)
   ↓
6. QR 코드 스캔 (html5-qrcode 라이브러리)
   ↓
7. 스캔된 데이터 서버로 전송
   ↓
8. 서버에서 QR 코드 검증
   ├─ 유효하지 않음 → 에러 메시지 표시
   └─ 유효함 → 다음 단계
   ↓
9. 중복 체크 (오늘 이미 입실했는지 확인)
   ├─ 이미 입실함 → 에러 메시지 표시
   └─ 입실 안 함 → 다음 단계
   ↓
10. 출석 기록 저장
    ↓
11. SMS 발송 (설정에 따라)
    ↓
12. 성공 메시지 표시 및 출석 상태 업데이트
```

### 퇴실 체크 프로세스

```
1. 학생이 출석 체크 페이지 접속
   ↓
2. 입실 기록 확인
   ├─ 입실 기록 없음 → "먼저 입실 체크를 해주세요" 메시지
   └─ 입실 기록 있음 → 다음 단계
   ↓
3. 입실 방법 확인
   ├─ QR 입실 → QR 코드 스캔 필수
   ├─ 위치 입실 → 위치 기반 또는 버튼 클릭 선택 가능
   └─ 수동 입실 → 버튼 클릭으로 처리
   ↓
4. QR 입실인 경우: QR 코드 스캔 (입실과 동일한 프로세스)
   ↓
5. 퇴실 기록 업데이트
   ↓
6. SMS 발송 (설정에 따라)
   ↓
7. 성공 메시지 표시
```

### QR 코드 생성 프로세스 (관리자)

```
1. 관리자가 QR 코드 페이지 접속
   ↓
2. 활성 QR 코드 조회 시도
   ├─ 활성 QR 코드 있음 → 표시
   └─ 활성 QR 코드 없음 → 새로 생성
   ↓
3. 새 QR 코드 생성
   ├─ 기존 활성 QR 코드 자동 비활성화
   ├─ QR 코드 데이터 생성 (JSON + URL 형식)
   ├─ QR 코드 이미지 생성 (Deep Link URL)
   └─ DB에 저장
   ↓
4. QR 코드 이미지 표시
   ↓
5. 다운로드/인쇄 기능 제공
```

---

## 사용 방법

### 학생 사용 방법

#### 1. 입실 체크

1. **출석 체크 페이지 접속**
   - URL: `/attendance/check-in`
   - 학생 계정으로 로그인 필요

2. **체크인 방법 선택**
   - "QR 코드" 또는 "위치 기반" 중 선택
   - QR 코드 방법 선택 시 다음 단계로 진행

3. **QR 코드 스캔**
   - "QR 코드 스캔 시작" 버튼 클릭
   - 카메라 권한 허용 (최초 1회)
   - 학원 입구에 부착된 QR 코드를 카메라에 비춤
   - 자동으로 스캔 및 검증 진행

4. **결과 확인**
   - 성공: "출석 체크가 완료되었습니다!" 메시지 표시
   - 실패: 에러 메시지 표시 (예: "이미 입실 체크가 완료되었습니다.")

#### 2. 퇴실 체크

1. **출석 체크 페이지 접속**
   - 입실 기록이 있어야 퇴실 체크 가능

2. **퇴실 방법 확인**
   - **QR 입실인 경우**: QR 코드 스캔 필수
   - **위치 입실인 경우**: 위치 기반 또는 버튼 클릭 선택 가능
   - **수동 입실인 경우**: 버튼 클릭으로 처리

3. **QR 코드 스캔 (QR 입실인 경우)**
   - 입실과 동일한 프로세스
   - "퇴실 체크가 완료되었습니다!" 메시지 표시

### 관리자 사용 방법

#### 1. QR 코드 생성 및 표시

1. **QR 코드 페이지 접속**
   - URL: `/admin/attendance/qr-code`
   - 관리자 계정으로 로그인 필요

2. **QR 코드 확인**
   - 활성 QR 코드가 있으면 자동으로 표시
   - 활성 QR 코드가 없으면 자동으로 생성

3. **QR 코드 다운로드/인쇄**
   - "다운로드" 버튼: PNG 이미지로 다운로드
   - "인쇄" 버튼: 인쇄용 페이지 열기
   - "새로고침" 버튼: 새 QR 코드 생성 (기존 QR 코드 자동 비활성화)

4. **QR 코드 정보 확인**
   - 생성 시간
   - 만료 시간 (기본 24시간)
   - 사용 횟수
   - 마지막 사용 시간

#### 2. QR 코드 관리

1. **QR 코드 관리 페이지 접속**
   - URL: `/admin/attendance/qr-code/manage`
   - 관리자 계정으로 로그인 필요

2. **QR 코드 이력 조회**
   - 최근 50개 QR 코드 이력 표시
   - 각 QR 코드의 상태, 생성 시간, 만료 시간, 사용 횟수 확인

3. **QR 코드 비활성화**
   - 활성 QR 코드의 "비활성화" 버튼 클릭
   - 확인 후 비활성화 처리

---

## 데이터 구조

### QR 코드 데이터 형식

#### JSON 형식 (하위 호환)

```typescript
type QRCodeData = {
  qrCodeId: string;      // 데이터베이스 ID
  tenantId: string;      // 테넌트(학원) ID
  timestamp: number;      // 생성 타임스탬프
  type: "attendance";     // QR 코드 타입
};
```

#### URL 형식 (Deep Link)

```
https://domain.com/attendance/check-in/qr?code={qrCodeId}
```

### 데이터베이스 스키마

#### `attendance_qr_codes` 테이블

```sql
CREATE TABLE attendance_qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  qr_data TEXT NOT NULL,              -- JSON 형식 데이터
  qr_code_url TEXT,                    -- QR 코드 이미지 URL (Data URL)
  is_active BOOLEAN DEFAULT true,      -- 활성 상태
  expires_at TIMESTAMPTZ NOT NULL,     -- 만료 시간
  created_by UUID REFERENCES users(id), -- 생성자
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,          -- 비활성화 시간
  deactivated_by UUID REFERENCES users(id), -- 비활성화한 사용자
  usage_count INTEGER DEFAULT 0,       -- 사용 횟수
  last_used_at TIMESTAMPTZ            -- 마지막 사용 시간
);
```

#### `attendance_records` 테이블

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  student_id UUID NOT NULL REFERENCES students(id),
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,            -- 입실 시간
  check_out_time TIMESTAMPTZ,           -- 퇴실 시간
  check_in_method TEXT,                 -- 입실 방법: "qr", "location", "manual"
  check_out_method TEXT,                -- 퇴실 방법: "qr", "location", "manual"
  status TEXT NOT NULL,                 -- 상태: "present", "absent", "late", "early_leave", "excused"
  notes TEXT,                           -- 메모
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, attendance_date)
);
```

---

## 보안 및 검증

### 1. 인증 및 권한

- **학생 인증**: `requireStudentAuth()` - 학생만 출석 체크 가능
- **관리자 인증**: `requireAdminAuth()` - 관리자만 QR 코드 생성/관리 가능
- **테넌트 격리**: 각 학원의 QR 코드는 해당 학원 학생만 사용 가능

### 2. QR 코드 검증

#### 검증 항목

1. **QR 코드 존재 여부**: DB에서 QR 코드 조회
2. **활성 상태**: `is_active = true` 확인
3. **만료 시간**: `expires_at > 현재 시간` 확인
4. **테넌트 일치**: QR 코드의 `tenant_id`와 학생의 `tenant_id` 일치 확인
5. **중복 체크**: 같은 날짜에 이미 입실 기록이 있는지 확인

#### 검증 실패 시나리오

| 시나리오 | 에러 메시지 | HTTP 상태 코드 |
|---------|------------|--------------|
| QR 코드 없음 | "QR 코드를 찾을 수 없습니다." | 404 |
| 비활성화됨 | "QR 코드가 비활성화되었습니다." | 400 |
| 만료됨 | "QR 코드가 만료되었습니다." | 400 |
| 다른 학원 | "다른 학원의 QR 코드입니다." | 403 |
| 이미 입실함 | "이미 입실 체크가 완료되었습니다." | 400 |
| 입실 기록 없음 (퇴실) | "입실 기록이 없습니다. 먼저 입실 체크를 해주세요." | 404 |

### 3. 데이터 무결성

- **고유 제약**: `(student_id, attendance_date)` UNIQUE 제약으로 중복 방지
- **트랜잭션**: 출석 기록 저장과 SMS 발송은 별도 처리 (SMS 실패해도 출석 기록은 저장)
- **타임스탬프**: 모든 시간은 UTC로 저장, 클라이언트에서 로컬 시간으로 변환

---

## 에러 처리

### 에러 처리 계층

```
1. UI Layer (Components)
   ├─ 사용자 친화적 메시지 표시
   └─ 에러 상태 관리 (useState)

2. Actions Layer (Server Actions)
   ├─ 에러 정규화 (normalizeError)
   ├─ 사용자 메시지 추출 (getUserFacingMessage)
   └─ 에러 로깅 (logError)

3. Service Layer
   ├─ AppError 생성 (상세 컨텍스트 포함)
   └─ 비즈니스 로직 검증

4. Repository Layer
   └─ Supabase 에러 그대로 throw
```

### 에러 메시지 예시

#### 클라이언트 에러 (400)

- "QR 코드가 유효하지 않습니다."
- "이미 입실 체크가 완료되었습니다."
- "이미 퇴실 처리되었습니다."
- "입실 기록이 없습니다. 먼저 입실 체크를 해주세요."

#### 서버 에러 (500)

- "출석 기록 저장에 실패했습니다."
- "SMS 발송에 실패했습니다." (출석 기록은 저장됨)

#### 권한 에러 (401, 403)

- "로그인이 필요합니다."
- "다른 학원의 QR 코드입니다."

### SMS 발송 실패 처리

SMS 발송은 비동기로 처리되며, 실패해도 출석 기록은 정상 저장됩니다:

```typescript
// SMS 발송 실패 시
try {
  await sendAttendanceSMSIfEnabled(...);
} catch (smsError) {
  // 로그만 남기고 무시
  logError(normalizeError(smsError), { stepContext });
  // 출석 기록은 이미 저장됨
}
```

설정에 따라 SMS 발송 실패 메시지를 사용자에게 표시할 수 있습니다:
- `tenants.attendance_sms_show_failure_to_user = true`인 경우 사용자에게 경고 표시

---

## 관련 파일 구조

### 주요 파일 목록

#### 클라이언트 컴포넌트

```
app/(student)/attendance/check-in/
├── page.tsx                          # 출석 체크 페이지
├── _components/
│   ├── CheckInPageContent.tsx        # 메인 컨텐츠 컴포넌트
│   ├── QRCodeScanner.tsx             # QR 코드 스캐너 컴포넌트
│   ├── AttendanceStatus.tsx          # 출석 상태 표시
│   ├── LocationCheckIn.tsx           # 위치 기반 체크인
│   └── LocationCheckOut.tsx          # 위치 기반 체크아웃
```

#### 관리자 컴포넌트

```
app/(admin)/admin/attendance/qr-code/
├── page.tsx                          # QR 코드 표시 페이지
├── _components/
│   └── QRCodeDisplay.tsx             # QR 코드 표시 컴포넌트
└── manage/
    ├── page.tsx                      # QR 코드 관리 페이지
    └── _components/
        └── QRCodeManageContent.tsx   # QR 코드 관리 컨텐츠
```

#### 서버 액션

```
app/(student)/actions/
└── attendanceActions.ts              # 출석 관련 액션
    ├── checkInWithQRCode()           # QR 코드 입실
    ├── checkOutWithQRCode()          # QR 코드 퇴실
    ├── checkInWithLocation()         # 위치 기반 입실
    ├── checkOutWithLocation()        # 위치 기반 퇴실
    └── getTodayAttendance()          # 오늘 출석 기록 조회

app/(admin)/actions/
└── qrCodeActions.ts                  # QR 코드 관리 액션
    ├── generateQRCodeAction()        # QR 코드 생성
    ├── getActiveQRCodeAction()       # 활성 QR 코드 조회
    ├── deactivateQRCodeAction()      # QR 코드 비활성화
    └── getQRCodeHistoryAction()      # QR 코드 이력 조회
```

#### 서비스 레이어

```
lib/services/
└── qrCodeService.ts                   # QR 코드 서비스
    ├── generateAttendanceQRCode()    # QR 코드 생성
    └── verifyQRCode()                # QR 코드 검증

lib/domains/qrCode/
├── service.ts                         # QR 코드 도메인 서비스
│   ├── createQRCode()                # QR 코드 생성
│   ├── getActiveQRCode()             # 활성 QR 코드 조회
│   ├── verifyAndUpdateQRCode()       # QR 코드 검증 및 통계 업데이트
│   ├── deactivateQRCode()            # QR 코드 비활성화
│   └── getQRCodeHistory()           # QR 코드 이력 조회
└── repository.ts                      # QR 코드 Repository
    ├── createQRCode()                # QR 코드 생성 (DB)
    ├── getActiveQRCode()             # 활성 QR 코드 조회 (DB)
    ├── getQRCodeById()               # QR 코드 ID로 조회 (DB)
    ├── deactivateAllActiveQRCodes()  # 모든 활성 QR 코드 비활성화
    ├── deactivateQRCode()            # 특정 QR 코드 비활성화
    ├── incrementQRCodeUsage()        # 사용 통계 업데이트
    └── getQRCodeHistory()           # QR 코드 이력 조회 (DB)

lib/domains/attendance/
├── service.ts                         # 출석 도메인 서비스
│   └── recordAttendance()            # 출석 기록 저장
└── repository.ts                      # 출석 Repository
    ├── findAttendanceByStudentAndDate() # 학생별 출석 기록 조회
    ├── insertAttendanceRecord()      # 출석 기록 생성
    └── updateAttendanceRecord()      # 출석 기록 업데이트
```

### 의존성

#### 라이브러리

- **html5-qrcode**: QR 코드 스캔 (클라이언트)
- **qrcode**: QR 코드 이미지 생성 (서버)
- **@supabase/supabase-js**: 데이터베이스 접근

#### 타입 정의

```typescript
// lib/services/qrCodeService.ts
type QRCodeData = {
  qrCodeId: string;
  tenantId: string;
  timestamp: number;
  type: "attendance";
};

type QRCodeRecord = {
  id: string;
  tenant_id: string;
  qr_data: string;
  qr_code_url: string | null;
  is_active: boolean;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
  usage_count: number;
  last_used_at: string | null;
};
```

---

## 추가 정보

### QR 코드 갱신 권장 사항

- **일일 갱신**: 보안을 위해 매일 새 QR 코드 생성 권장
- **자동 비활성화**: 새 QR 코드 생성 시 기존 QR 코드 자동 비활성화
- **만료 시간**: 기본 24시간, 필요에 따라 조정 가능

### Deep Link 동작

QR 코드를 카메라 앱에서 스캔하면:
1. URL 형식으로 인식
2. 브라우저에서 해당 URL 열기
3. `/attendance/check-in/qr?code={qrCodeId}` 페이지로 이동
4. 자동으로 QR 코드 검증 및 출석 체크 진행

### SMS 알림 연동

출석 체크 성공 시:
- 학부모에게 자동 SMS 발송 (설정에 따라)
- SMS 발송 실패해도 출석 기록은 정상 저장
- SMS 발송 실패 메시지는 설정에 따라 사용자에게 표시 가능

---

## 문제 해결

### 자주 발생하는 문제

#### 1. 카메라 권한 오류

**증상**: "카메라 권한이 필요합니다" 메시지

**해결 방법**:
- 브라우저 설정에서 카메라 권한 허용
- HTTPS 환경에서만 작동 (로컬 개발 환경 제외)

#### 2. QR 코드 스캔 실패

**증상**: QR 코드를 인식하지 못함

**해결 방법**:
- QR 코드가 명확하게 보이도록 조정
- 조명이 충분한지 확인
- 카메라 렌즈가 깨끗한지 확인

#### 3. "다른 학원의 QR 코드입니다" 오류

**증상**: 다른 학원의 QR 코드를 스캔한 경우

**해결 방법**:
- 본인 학원의 QR 코드를 스캔해야 함
- 관리자에게 올바른 QR 코드 요청

#### 4. "이미 입실 체크가 완료되었습니다" 오류

**증상**: 같은 날 두 번 입실 체크 시도

**해결 방법**:
- 하루에 한 번만 입실 체크 가능
- 이미 입실했다면 퇴실 체크만 가능

---

## 참고 자료

- [출석 시스템 개선 계획](./attendance-system-improvement-todo-2025-02-01.md)
- [출석 시스템 사용자 가이드](./user-guide.md)
- [SMS 설정 가이드](./sms-settings-guide.md)
- [관리자 매뉴얼](./admin-manual.md)

---

**작성일**: 2025년 2월 1일  
**최종 수정일**: 2025년 2월 1일

