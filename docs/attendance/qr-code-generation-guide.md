# QR 코드 생성 기능 가이드

## 📋 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기능 분석 및 구현 방법](#기능-분석-및-구현-방법)
4. [작동 방식](#작동-방식)
5. [사용 방법](#사용-방법)
6. [데이터 구조](#데이터-구조)
7. [보안 및 권한 관리](#보안-및-권한-관리)
8. [에러 처리](#에러-처리)
9. [관련 파일 구조](#관련-파일-구조)

---

## 개요

QR 코드 생성 기능은 관리자가 학원 출석 체크를 위한 QR 코드를 생성, 관리하는 기능입니다. 이 기능은 다음과 같은 특징을 가지고 있습니다:

- **자동 비활성화**: 새 QR 코드 생성 시 기존 활성 QR 코드 자동 비활성화
- **이중 형식 지원**: JSON 형식(하위 호환) + Deep Link URL 형식
- **만료 시간 관리**: 기본 24시간 후 자동 만료 (설정 가능)
- **사용 통계 추적**: QR 코드 사용 횟수 및 마지막 사용 시간 자동 기록
- **이력 관리**: 생성된 모든 QR 코드의 이력 조회 및 관리
- **다운로드/인쇄**: QR 코드 이미지 다운로드 및 인쇄 기능 제공

---

## 시스템 아키텍처

### 전체 흐름도

```
[관리자]
   │
   ├─ QR 코드 페이지 접속
   │  (/admin/attendance/qr-code)
   │
   ├─ 활성 QR 코드 조회 시도
   │  ├─ 활성 QR 코드 있음 → 표시
   │  └─ 활성 QR 코드 없음 → 새로 생성
   │
   ├─ QR 코드 생성 프로세스
   │  ├─ 기존 활성 QR 코드 자동 비활성화
   │  ├─ QR 코드 데이터 생성 (JSON + URL)
   │  ├─ QR 코드 이미지 생성 (Deep Link)
   │  └─ 데이터베이스 저장
   │
   ├─ QR 코드 표시
   │  ├─ 이미지 표시
   │  ├─ 정보 표시 (생성 시간, 만료 시간, 사용 횟수)
   │  └─ 다운로드/인쇄 기능
   │
   └─ QR 코드 관리
      ├─ 이력 조회
      └─ 비활성화
```

### 레이어 구조

```
┌─────────────────────────────────────┐
│         UI Layer (Components)        │
│  - QRCodeDisplay.tsx                 │
│  - QRCodeManageContent.tsx            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Actions Layer (Server Actions) │
│  - qrCodeActions.ts                  │
│    ├─ generateQRCodeAction()        │
│    ├─ getActiveQRCodeAction()        │
│    ├─ deactivateQRCodeAction()       │
│    └─ getQRCodeHistoryAction()       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Service Layer (Business Logic) │
│  - qrCodeService.ts                   │
│    └─ generateAttendanceQRCode()     │
│  - qrCode/service.ts                  │
│    ├─ createQRCode()                 │
│    ├─ getActiveQRCode()              │
│    ├─ deactivateQRCode()             │
│    └─ getQRCodeHistory()             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Repository Layer (Data Access)    │
│  - qrCode/repository.ts               │
│    ├─ createQRCode()                 │
│    ├─ getActiveQRCode()               │
│    ├─ deactivateAllActiveQRCodes()   │
│    ├─ deactivateQRCode()             │
│    └─ getQRCodeHistory()             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Database (Supabase)          │
│  - attendance_qr_codes               │
└─────────────────────────────────────┘
```

---

## 기능 분석 및 구현 방법

### 1. QR 코드 생성 프로세스

#### 구현 위치
- **서비스**: `lib/services/qrCodeService.ts` - `generateAttendanceQRCode()`
- **도메인 서비스**: `lib/domains/qrCode/service.ts` - `createQRCode()`
- **Repository**: `lib/domains/qrCode/repository.ts` - `createQRCode()`

#### 상세 단계

```typescript
// Step 1: 테넌트 컨텍스트 확인
const tenantContext = await getTenantContext();
if (!tenantContext?.tenantId) {
  throw new Error("테넌트 정보를 찾을 수 없습니다.");
}

// Step 2: 만료 시간 설정 (기본 24시간)
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24);

// Step 3: 임시 ID 생성 (실제 ID는 DB에서 생성됨)
const tempId = crypto.randomUUID();

// Step 4: QR 코드 데이터 생성 (임시 ID 사용)
const qrData: QRCodeData = {
  qrCodeId: tempId,
  tenantId: tenantContext.tenantId,
  timestamp: Date.now(),
  type: "attendance"
};
const qrDataString = JSON.stringify(qrData);

// Step 5: QR 코드 이미지 생성 (JSON 데이터용, 임시)
const qrCodeUrl = await QRCode.toDataURL(qrDataString, {
  width: 400,
  margin: 2,
  errorCorrectionLevel: "M"
});

// Step 6: 기존 활성 QR 코드 자동 비활성화
await repository.deactivateAllActiveQRCodes(tenantId, userId);

// Step 7: 새 QR 코드 DB 저장 (임시 데이터로)
const qrCodeRecord = await repository.createQRCode(
  tenantId,
  qrDataString,
  qrCodeUrl,
  expiresAt,
  userId
);

// Step 8: 실제 ID로 QR 코드 데이터 업데이트
const actualQrData: QRCodeData = {
  ...qrData,
  qrCodeId: qrCodeRecord.id,
};
const actualQrDataString = JSON.stringify(actualQrData);

// Step 9: Deep Link URL 생성
const baseUrl = getBaseUrl(headersList);
const deepLinkUrl = `${baseUrl}/attendance/check-in/qr?code=${qrCodeRecord.id}`;

// Step 10: Deep Link URL로 QR 코드 이미지 생성
const deepLinkQrCodeUrl = await QRCode.toDataURL(deepLinkUrl, {
  width: 400,
  margin: 2,
  errorCorrectionLevel: "M"
});

// Step 11: DB에 실제 QR 코드 데이터 및 이미지 URL 업데이트
await supabase
  .from("attendance_qr_codes")
  .update({
    qr_data: actualQrDataString,      // JSON 데이터 (하위 호환)
    qr_code_url: deepLinkQrCodeUrl,   // Deep Link 이미지
  })
  .eq("id", qrCodeRecord.id);
```

#### 특징
- **2단계 생성**: 임시 ID로 먼저 생성 후 실제 ID로 업데이트
- **이중 형식**: JSON 형식(하위 호환) + Deep Link URL 형식
- **자동 비활성화**: 새 QR 코드 생성 시 기존 활성 QR 코드 자동 비활성화
- **Deep Link 지원**: 카메라 앱에서 스캔 시 자동으로 앱 실행

### 2. 활성 QR 코드 조회

#### 구현 위치
- **도메인 서비스**: `lib/domains/qrCode/service.ts` - `getActiveQRCode()`
- **Repository**: `lib/domains/qrCode/repository.ts` - `getActiveQRCode()`

#### 조회 로직

```typescript
// 활성 QR 코드 조회 조건
const qrCode = await supabase
  .from("attendance_qr_codes")
  .select("*")
  .eq("tenant_id", tenantId)
  .eq("is_active", true)                    // 활성 상태
  .gt("expires_at", new Date().toISOString()) // 만료되지 않음
  .order("created_at", { ascending: false }) // 최신순
  .limit(1)
  .maybeSingle();
```

#### 특징
- **자동 필터링**: 활성 상태이고 만료되지 않은 QR 코드만 조회
- **최신 우선**: 생성 시간 기준 최신 QR 코드 우선 조회
- **단일 결과**: 하나의 활성 QR 코드만 반환

### 3. 기존 활성 QR 코드 비활성화

#### 구현 위치
- **Repository**: `lib/domains/qrCode/repository.ts` - `deactivateAllActiveQRCodes()`

#### 비활성화 로직

```typescript
// 모든 활성 QR 코드 비활성화
await supabase
  .from("attendance_qr_codes")
  .update({
    is_active: false,
    deactivated_at: new Date().toISOString(),
    deactivated_by: userId,
  })
  .eq("tenant_id", tenantId)
  .eq("is_active", true);
```

#### 특징
- **일괄 처리**: 테넌트의 모든 활성 QR 코드를 한 번에 비활성화
- **이력 추적**: 비활성화 시간 및 비활성화한 사용자 기록
- **원자적 연산**: 트랜잭션으로 안전하게 처리

### 4. QR 코드 이력 조회

#### 구현 위치
- **도메인 서비스**: `lib/domains/qrCode/service.ts` - `getQRCodeHistory()`
- **Repository**: `lib/domains/qrCode/repository.ts` - `getQRCodeHistory()`

#### 조회 로직

```typescript
// QR 코드 이력 조회 (최근 N개)
const history = await supabase
  .from("attendance_qr_codes")
  .select("*")
  .eq("tenant_id", tenantId)
  .order("created_at", { ascending: false })
  .limit(limit);
```

#### 특징
- **최신순 정렬**: 생성 시간 기준 내림차순 정렬
- **제한 조회**: 기본 50개, 필요에 따라 조정 가능
- **전체 이력**: 활성/비활성 상태와 관계없이 모든 QR 코드 조회

---

## 작동 방식

### QR 코드 생성 프로세스

```
1. 관리자가 QR 코드 페이지 접속
   ↓
2. 활성 QR 코드 조회 시도
   ├─ 활성 QR 코드 있음 → 표시 및 종료
   └─ 활성 QR 코드 없음 → 다음 단계
   ↓
3. 테넌트 컨텍스트 확인
   ├─ 테넌트 정보 없음 → 에러 반환
   └─ 테넌트 정보 있음 → 다음 단계
   ↓
4. 만료 시간 설정 (현재 시간 + 24시간)
   ↓
5. 임시 ID 생성 (crypto.randomUUID())
   ↓
6. QR 코드 데이터 생성 (임시 ID 사용)
   - qrCodeId: 임시 ID
   - tenantId: 테넌트 ID
   - timestamp: 현재 타임스탬프
   - type: "attendance"
   ↓
7. QR 코드 이미지 생성 (JSON 데이터용, 임시)
   ↓
8. 기존 활성 QR 코드 자동 비활성화
   - is_active = false
   - deactivated_at = 현재 시간
   - deactivated_by = 현재 사용자 ID
   ↓
9. 새 QR 코드 DB 저장 (임시 데이터)
   - id: 실제 UUID (DB에서 생성)
   - qr_data: JSON 문자열 (임시 ID 포함)
   - qr_code_url: 임시 이미지 URL
   - is_active: true
   - expires_at: 만료 시간
   - created_by: 현재 사용자 ID
   ↓
10. 실제 ID로 QR 코드 데이터 업데이트
    - qrCodeId를 실제 DB ID로 변경
    ↓
11. Deep Link URL 생성
    - 형식: {baseUrl}/attendance/check-in/qr?code={qrCodeId}
    ↓
12. Deep Link URL로 QR 코드 이미지 생성
    ↓
13. DB에 실제 데이터 업데이트
    - qr_data: 실제 ID 포함 JSON 데이터
    - qr_code_url: Deep Link 이미지 URL
    ↓
14. QR 코드 이미지 및 정보 표시
```

### QR 코드 표시 프로세스

```
1. 페이지 로드 시 활성 QR 코드 조회
   ↓
2. 활성 QR 코드 있음
   ├─ QR 코드 이미지 표시 (qr_code_url)
   ├─ 생성 시간 표시
   ├─ 만료 시간 표시
   ├─ 사용 횟수 표시
   └─ 마지막 사용 시간 표시 (있는 경우)
   ↓
3. 활성 QR 코드 없음
   └─ 자동으로 새 QR 코드 생성
```

### QR 코드 비활성화 프로세스

```
1. 관리자가 "비활성화" 버튼 클릭
   ↓
2. 확인 다이얼로그 표시
   ├─ 취소 → 종료
   └─ 확인 → 다음 단계
   ↓
3. QR 코드 비활성화 요청
   ↓
4. DB 업데이트
   - is_active = false
   - deactivated_at = 현재 시간
   - deactivated_by = 현재 사용자 ID
   ↓
5. 이력 목록 새로고침
```

---

## 사용 방법

### 관리자 사용 방법

#### 1. QR 코드 생성 및 표시

1. **QR 코드 페이지 접속**
   - URL: `/admin/attendance/qr-code`
   - 관리자 계정으로 로그인 필요

2. **자동 생성 또는 표시**
   - 활성 QR 코드가 있으면 자동으로 표시
   - 활성 QR 코드가 없으면 자동으로 생성 후 표시

3. **QR 코드 정보 확인**
   - **생성 시간**: QR 코드가 생성된 시간
   - **만료 시간**: QR 코드가 만료되는 시간 (기본 24시간 후)
   - **사용 횟수**: 현재까지 스캔된 횟수
   - **마지막 사용**: 가장 최근에 스캔된 시간

4. **QR 코드 다운로드**
   - "다운로드" 버튼 클릭
   - PNG 이미지로 다운로드
   - 파일명: `attendance-qr-code.png`

5. **QR 코드 인쇄**
   - "인쇄" 버튼 클릭
   - 인쇄용 페이지가 새 창으로 열림
   - 인쇄 대화상자에서 인쇄 실행

6. **새 QR 코드 생성**
   - "새로고침" 버튼 클릭
   - 기존 활성 QR 코드 자동 비활성화
   - 새 QR 코드 생성 및 표시

#### 2. QR 코드 관리

1. **QR 코드 관리 페이지 접속**
   - URL: `/admin/attendance/qr-code/manage`
   - 관리자 계정으로 로그인 필요

2. **QR 코드 이력 조회**
   - 최근 50개 QR 코드 이력 표시
   - 각 QR 코드의 상세 정보 확인:
     - **상태**: 활성/비활성
     - **만료 여부**: 만료됨/유효
     - **생성 시간**: QR 코드 생성 시간
     - **만료 시간**: QR 코드 만료 시간
     - **사용 횟수**: 스캔된 횟수
     - **마지막 사용**: 가장 최근 스캔 시간
     - **비활성화 시간**: 비활성화된 시간 (있는 경우)

3. **QR 코드 비활성화**
   - 활성 QR 코드의 "비활성화" 버튼 클릭
   - 확인 다이얼로그에서 "확인" 클릭
   - QR 코드가 비활성화되고 이력 목록 새로고침

---

## 데이터 구조

### QR 코드 데이터 형식

#### JSON 형식 (하위 호환)

```typescript
type QRCodeData = {
  qrCodeId: string;      // 데이터베이스 ID (UUID)
  tenantId: string;      // 테넌트(학원) ID (UUID)
  timestamp: number;      // 생성 타임스탬프 (밀리초)
  type: "attendance";     // QR 코드 타입 (고정값)
};
```

**예시**:
```json
{
  "qrCodeId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": 1704067200000,
  "type": "attendance"
}
```

#### Deep Link URL 형식

```
https://domain.com/attendance/check-in/qr?code={qrCodeId}
```

**예시**:
```
https://eduatalk.com/attendance/check-in/qr?code=550e8400-e29b-41d4-a716-446655440000
```

### 데이터베이스 스키마

#### `attendance_qr_codes` 테이블

```sql
CREATE TABLE attendance_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  qr_data text NOT NULL,              -- JSON 형식 데이터
  qr_code_url text,                    -- QR 코드 이미지 URL (Data URL)
  is_active boolean DEFAULT true,      -- 활성 상태
  expires_at timestamptz NOT NULL,     -- 만료 시간
  created_by uuid,                     -- 생성자 ID
  created_at timestamptz DEFAULT now(),
  deactivated_at timestamptz,          -- 비활성화 시간
  deactivated_by uuid,                 -- 비활성화한 사용자 ID
  usage_count integer DEFAULT 0,       -- 사용 횟수
  last_used_at timestamptz            -- 마지막 사용 시간
);
```

#### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | QR 코드 고유 ID (PK) |
| `tenant_id` | uuid | 테넌트(학원) ID (FK) |
| `qr_data` | text | QR 코드 데이터 (JSON 문자열) |
| `qr_code_url` | text | QR 코드 이미지 URL (Data URL) |
| `is_active` | boolean | 활성 상태 (true: 활성, false: 비활성) |
| `expires_at` | timestamptz | 만료 시간 |
| `created_by` | uuid | 생성자 사용자 ID |
| `created_at` | timestamptz | 생성 시간 |
| `deactivated_at` | timestamptz | 비활성화 시간 (NULL: 활성) |
| `deactivated_by` | uuid | 비활성화한 사용자 ID (NULL: 활성) |
| `usage_count` | integer | 사용 횟수 (스캔된 횟수) |
| `last_used_at` | timestamptz | 마지막 사용 시간 (NULL: 미사용) |

#### 인덱스

```sql
-- 테넌트별 조회 최적화
CREATE INDEX idx_attendance_qr_codes_tenant_id 
  ON attendance_qr_codes(tenant_id);

-- 활성 QR 코드 조회 최적화
CREATE INDEX idx_attendance_qr_codes_active 
  ON attendance_qr_codes(tenant_id, is_active, expires_at) 
  WHERE is_active = true;

-- 생성 시간 기준 정렬 최적화
CREATE INDEX idx_attendance_qr_codes_created_at 
  ON attendance_qr_codes(tenant_id, created_at DESC);
```

### RLS (Row Level Security) 정책

#### 관리자 정책

```sql
-- 관리자는 자신의 테넌트 내 모든 QR 코드 조회 가능
CREATE POLICY "attendance_qr_codes_select_admin" 
  ON attendance_qr_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 QR 코드 생성 가능
CREATE POLICY "attendance_qr_codes_insert_admin" 
  ON attendance_qr_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 QR 코드 수정 가능
CREATE POLICY "attendance_qr_codes_update_admin" 
  ON attendance_qr_codes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );
```

#### 학생 정책

```sql
-- 학생은 활성 QR 코드만 조회 가능 (검증용)
CREATE POLICY "attendance_qr_codes_select_student" 
  ON attendance_qr_codes FOR SELECT
  USING (
    is_active = true
    AND expires_at > now()
    AND EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.tenant_id = attendance_qr_codes.tenant_id
    )
  );
```

---

## 보안 및 권한 관리

### 1. 인증 및 권한

- **관리자 인증**: `requireAdminAuth()` - 관리자만 QR 코드 생성/관리 가능
- **테넌트 격리**: 각 학원의 QR 코드는 해당 학원 관리자만 생성/관리 가능
- **RLS 정책**: 데이터베이스 레벨에서 권한 제어

### 2. QR 코드 보안

#### 보안 특징

1. **고유 ID**: 각 QR 코드는 고유한 UUID 사용
2. **테넌트 격리**: 테넌트별로 QR 코드 격리
3. **만료 시간**: 기본 24시간 후 자동 만료
4. **활성 상태 관리**: 비활성화된 QR 코드는 사용 불가
5. **사용 통계**: 사용 횟수 및 마지막 사용 시간 추적

#### 보안 권장 사항

- **정기 갱신**: 보안을 위해 매일 새 QR 코드 생성 권장
- **자동 비활성화**: 새 QR 코드 생성 시 기존 QR 코드 자동 비활성화
- **만료 시간**: 필요에 따라 만료 시간 조정 가능
- **이력 관리**: 모든 QR 코드 생성/비활성화 이력 추적

### 3. 데이터 무결성

- **외래키 제약**: `tenant_id`는 `tenants` 테이블 참조
- **CASCADE 삭제**: 테넌트 삭제 시 관련 QR 코드 자동 삭제
- **고유 제약**: 각 QR 코드는 고유한 ID 보장
- **타임스탬프**: 모든 시간은 UTC로 저장

---

## 에러 처리

### 에러 처리 계층

```
1. UI Layer (Components)
   ├─ 사용자 친화적 메시지 표시
   ├─ 로딩 상태 관리
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

- "QR 코드 생성에 실패했습니다."
- "테넌트 정보를 찾을 수 없습니다."

#### 서버 에러 (500)

- "QR 코드 생성 중 오류가 발생했습니다."
- "데이터베이스 오류가 발생했습니다."

#### 권한 에러 (401, 403)

- "로그인이 필요합니다."
- "관리자 권한이 필요합니다."

### 에러 처리 예시

```typescript
// Actions Layer
try {
  await requireAdminAuth();
  const result = await generateAttendanceQRCode();
  return { success: true, qrCodeUrl: result.qrCodeUrl };
} catch (error) {
  // Next.js의 redirect()와 notFound()는 재throw
  if (error?.digest?.startsWith("NEXT_REDIRECT")) {
    throw error;
  }
  
  const normalizedError = normalizeError(error);
  logError(normalizedError, { function: "generateQRCodeAction" });
  
  return {
    success: false,
    error: getUserFacingMessage(normalizedError),
  };
}
```

---

## 관련 파일 구조

### 주요 파일 목록

#### 클라이언트 컴포넌트

```
app/(admin)/admin/attendance/qr-code/
├── page.tsx                          # QR 코드 표시 페이지
├── _components/
│   └── QRCodeDisplay.tsx              # QR 코드 표시 컴포넌트
└── manage/
    ├── page.tsx                      # QR 코드 관리 페이지
    └── _components/
        └── QRCodeManageContent.tsx    # QR 코드 관리 컨텐츠
```

#### 서버 액션

```
app/(admin)/actions/
└── qrCodeActions.ts                  # QR 코드 관리 액션
    ├── generateQRCodeAction()         # QR 코드 생성
    ├── getActiveQRCodeAction()        # 활성 QR 코드 조회
    ├── deactivateQRCodeAction()      # QR 코드 비활성화
    └── getQRCodeHistoryAction()      # QR 코드 이력 조회
```

#### 서비스 레이어

```
lib/services/
└── qrCodeService.ts                   # QR 코드 서비스
    └── generateAttendanceQRCode()    # QR 코드 생성

lib/domains/qrCode/
├── service.ts                         # QR 코드 도메인 서비스
│   ├── createQRCode()                 # QR 코드 생성
│   ├── getActiveQRCode()              # 활성 QR 코드 조회
│   ├── deactivateQRCode()             # QR 코드 비활성화
│   └── getQRCodeHistory()             # QR 코드 이력 조회
└── repository.ts                      # QR 코드 Repository
    ├── createQRCode()                 # QR 코드 생성 (DB)
    ├── getActiveQRCode()              # 활성 QR 코드 조회 (DB)
    ├── deactivateAllActiveQRCodes()  # 모든 활성 QR 코드 비활성화
    ├── deactivateQRCode()             # 특정 QR 코드 비활성화
    └── getQRCodeHistory()            # QR 코드 이력 조회 (DB)
```

#### 데이터베이스 마이그레이션

```
supabase/migrations/
└── 20251208180000_create_attendance_qr_codes_table.sql
    ├── 테이블 생성
    ├── RLS 정책 설정
    └── 인덱스 생성
```

### 의존성

#### 라이브러리

- **qrcode**: QR 코드 이미지 생성 (서버)
- **@supabase/supabase-js**: 데이터베이스 접근
- **next/headers**: HTTP 헤더 접근 (Base URL 추출)

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

### QR 코드 생성 옵션

#### QR 코드 이미지 설정

```typescript
await QRCode.toDataURL(data, {
  width: 400,                    // 이미지 너비 (픽셀)
  margin: 2,                     // 여백 (QR 코드 모듈 단위)
  errorCorrectionLevel: "M",     // 오류 정정 레벨: L, M, Q, H
});
```

#### 오류 정정 레벨

- **L (Low)**: 약 7% 오류 복구 가능
- **M (Medium)**: 약 15% 오류 복구 가능 (기본값)
- **Q (Quartile)**: 약 25% 오류 복구 가능
- **H (High)**: 약 30% 오류 복구 가능

### Deep Link 동작

QR 코드를 카메라 앱에서 스캔하면:
1. URL 형식으로 인식
2. 브라우저에서 해당 URL 열기
3. `/attendance/check-in/qr?code={qrCodeId}` 페이지로 이동
4. 자동으로 QR 코드 검증 및 출석 체크 진행

### 만료 시간 관리

- **기본 만료 시간**: 24시간
- **설정 방법**: `expiresAt.setHours(expiresAt.getHours() + 24)`
- **권장 갱신 주기**: 매일 새 QR 코드 생성
- **만료 후 동작**: 만료된 QR 코드는 자동으로 비활성화

### 사용 통계

- **사용 횟수**: QR 코드가 스캔된 총 횟수
- **마지막 사용 시간**: 가장 최근에 스캔된 시간
- **자동 업데이트**: QR 코드 검증 시 자동으로 업데이트

---

## 문제 해결

### 자주 발생하는 문제

#### 1. QR 코드 생성 실패

**증상**: "QR 코드 생성에 실패했습니다" 메시지

**해결 방법**:
- 관리자 권한 확인
- 테넌트 정보 확인
- 데이터베이스 연결 확인
- 브라우저 콘솔에서 상세 에러 확인

#### 2. QR 코드 이미지가 표시되지 않음

**증상**: QR 코드 이미지가 보이지 않음

**해결 방법**:
- Data URL 형식 확인
- 이미지 로딩 에러 확인
- 브라우저 개발자 도구에서 네트워크 탭 확인

#### 3. 기존 QR 코드가 비활성화되지 않음

**증상**: 새 QR 코드 생성 시 기존 QR 코드가 여전히 활성 상태

**해결 방법**:
- 데이터베이스에서 직접 확인
- `deactivateAllActiveQRCodes` 함수 실행 확인
- 트랜잭션 로그 확인

#### 4. Deep Link가 작동하지 않음

**증상**: QR 코드 스캔 시 앱이 자동으로 열리지 않음

**해결 방법**:
- Base URL 설정 확인
- Deep Link URL 형식 확인
- 카메라 앱 설정 확인 (일부 앱은 Deep Link 미지원)

---

## 참고 자료

- [출석 QR 코드 시스템 가이드](./qr-code-system-guide.md)
- [출석 시스템 개선 계획](../attendance-system-improvement-todo-2025-02-01.md)
- [출석 시스템 사용자 가이드](./user-guide.md)
- [관리자 매뉴얼](./admin-manual.md)

---

**작성일**: 2025년 2월 1일  
**최종 수정일**: 2025년 2월 1일

