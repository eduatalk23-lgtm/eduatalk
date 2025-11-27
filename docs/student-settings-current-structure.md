# 학생 마이페이지 현재 구성 분석

## 개요

학생 마이페이지는 `/settings` 경로를 중심으로 4개의 주요 페이지로 구성되어 있습니다. 각 페이지는 독립적으로 운영되며, 사이드바 네비게이션을 통해 접근할 수 있습니다.

## 네비게이션 구조

### 사이드바 메뉴 구성
- **설정** 카테고리 하위
  - 마이페이지 (`/settings`) - 👤
  - 알림 설정 (`/settings/notifications`) - 🔔
  - 로그인 기기 관리 (`/settings/devices`) - 📱
  - 계정 관리 (`/settings/account`) - 🔐

## 1. 메인 마이페이지 (`/settings`)

### 페이지 정보
- **경로**: `/app/(student)/settings/page.tsx`
- **타입**: Client Component
- **제목**: "마이페이지"
- **레이아웃**: 중앙 정렬, 최대 너비 2xl

### UI 구조

#### 상단 영역
- **제목**: "마이페이지" (text-3xl, font-semibold)
- **초기 설정 모드 안내** (학생 정보가 없을 때만 표시)
  - 환영 메시지 배너 (indigo 배경)
  - 진행 단계 표시 (현재 단계/전체 단계)
  - 진행률 바
  - 단계별 체크리스트 (기본 정보, 시험 정보, 진로 정보)

#### 메시지 영역
- **성공 메시지**: 초록색 배경, 체크 아이콘, 자동 3초 후 숨김
- **에러 메시지**: 빨간색 배경, X 아이콘, 수동 닫기 가능

#### 탭 네비게이션
- **컴포넌트**: `SettingsTabs`
- **탭 구성**:
  1. 기본 정보 (basic)
  2. 입시 정보 (exam)
  3. 진로 정보 (career)
- **스타일**: 하단 보더, 활성 탭은 indigo 색상

#### 기본 정보 탭

**필수 항목** (빨간색 별표 표시):
- **이름** (`name`)
  - 타입: text input
  - 초기값: user_metadata.display_name 또는 빈 값
  - 유효성 검사: 필수
  
- **학년** (`grade`)
  - 타입: select
  - 옵션: 1학년, 2학년, 3학년
  - 학교 타입에 따라 자동 설정 (중학교 → 3학년, 고등학교 → 1학년)
  - 유효성 검사: 필수
  
- **생년월일** (`birth_date`)
  - 타입: date input
  - 유효성 검사: 필수

**선택 항목**:
- **학교** (`school_id`)
  - 타입: SchoolSelect 컴포넌트
  - 학교 검색 및 선택 기능
  - 학교 타입 자동 감지 (중학교/고등학교)
  
- **성별** (`gender`)
  - 타입: select
  - 옵션: 남, 여
  
- **연락처 (본인)** (`phone`)
  - 타입: tel input
  - 자동 포맷팅 (010-1234-5678)
  - 유효성 검사: 형식 검증
  
- **모 연락처** (`mother_phone`)
  - 타입: tel input
  - 자동 포맷팅
  
- **부 연락처** (`father_phone`)
  - 타입: tel input
  - 자동 포맷팅

#### 입시 정보 탭

- **입시년도** (`exam_year`)
  - 타입: number input
  - 범위: 2020-2030
  - **자동 계산 옵션**: 체크박스로 활성화/비활성화
  - 자동 계산 로직: 학년과 학교 타입 기반
  - 자동 계산 시 입력 필드 비활성화
  
- **개정교육과정** (`curriculum_revision`)
  - 타입: select
  - 옵션: 2009 개정, 2015 개정, 2022 개정
  - **자동 계산 옵션**: 체크박스로 활성화/비활성화
  - 자동 계산 로직: 학년, 생년월일, 학교 타입 기반
  - 자동 계산 시 선택 필드 비활성화

#### 진로 정보 탭

- **진학 희망 대학교** (`desired_university_ids`)
  - 타입: SchoolMultiSelect 컴포넌트
  - 최대 3개까지 선택 가능
  - 선택 순서대로 1순위, 2순위, 3순위로 표시
  - 학교 타입: "대학교" 필터링
  
- **희망 진로 계열** (`desired_career_field`)
  - 타입: select
  - 옵션: 인문계열, 사회계열, 자연계열, 공학계열, 의약계열, 예체능계열, 교육계열, 농업계열, 해양계열, 기타

#### 하단 액션 영역

- **변경사항 알림**: 변경사항이 있을 때만 표시
- **취소 버튼**: 변경사항 확인 후 초기값으로 복원
- **저장 버튼**:
  - 초기 설정 모드: "시작하기"
  - 일반 모드: "저장하기"
  - 저장 중: "저장 중..."
  - 비활성화 조건: 저장 중이거나 변경사항이 없을 때 (초기 설정 모드 제외)

### 주요 기능

1. **자동 계산**
   - 입시년도: 학년과 학교 타입 기반 자동 계산
   - 개정교육과정: 학년, 생년월일, 학교 타입 기반 자동 계산
   - 자동 계산 값은 변경사항으로 간주하지 않음

2. **변경사항 추적**
   - 초기값과 현재값 비교
   - 탭 전환 시 변경사항 확인
   - 페이지 이탈 시 브라우저 경고

3. **유효성 검사**
   - 필수 필드 검증
   - 전화번호 형식 검증
   - 실시간 에러 표시

4. **초기 설정 모드**
   - 학생 정보가 없을 때 활성화
   - 단계별 가이드 제공
   - 저장 성공 시 대시보드로 리다이렉트

### 데이터 흐름

1. **로드**: `getCurrentStudent()` → Student 데이터 → FormData 변환
2. **저장**: FormData → `updateStudentProfile()` → Supabase 업데이트
3. **학교 정보**: `getSchoolById()` → 학교 타입 조회

## 2. 알림 설정 (`/settings/notifications`)

### 페이지 정보
- **경로**: `/app/(student)/settings/notifications/page.tsx`
- **타입**: Server Component
- **제목**: "알림 설정"
- **레이아웃**: 중앙 정렬, 최대 너비 4xl

### UI 구조

#### 상단 영역
- **제목**: "알림 설정" (text-3xl, font-semibold)
- **설명**: "학습 관련 알림을 받을 항목과 시간을 설정하세요"

#### 알림 유형 설정 섹션
카드 형태로 구성, 각 항목은 토글 스위치와 설명 포함:

1. **학습 시작 알림** (`plan_start_enabled`)
   - 설명: "플랜을 시작할 때 알림을 받습니다"
   
2. **학습 완료 알림** (`plan_complete_enabled`)
   - 설명: "플랜을 완료할 때 알림을 받습니다"
   
3. **일일 목표 달성 알림** (`daily_goal_achieved_enabled`)
   - 설명: "일일 학습 목표를 달성했을 때 알림을 받습니다"
   
4. **주간 리포트 알림** (`weekly_report_enabled`)
   - 설명: "주간 학습 리포트를 받습니다"
   
5. **플랜 지연 알림** (`plan_delay_enabled`)
   - 설명: "예정된 시간보다 늦게 시작할 때 알림을 받습니다"
   - **하위 설정** (활성화 시 표시):
     - 지연 임계값 (분): number input (5-120분, 5분 단위)
     - 기본값: 30분

#### 알림 시간 설정 섹션
- **알림 시작 시간** (`notification_time_start`)
  - 타입: time input
  - 기본값: 09:00
  
- **알림 종료 시간** (`notification_time_end`)
  - 타입: time input
  - 기본값: 22:00

#### 방해 금지 시간 설정 섹션
- **활성화 토글** (`quiet_hours_enabled`)
- **설명**: "방해 금지 시간 동안에는 알림을 받지 않습니다"
- **하위 설정** (활성화 시 표시):
  - 시작 시간 (`quiet_hours_start`): time input, 기본값 22:00
  - 종료 시간 (`quiet_hours_end`): time input, 기본값 08:00

#### 하단 액션 영역
- **변경사항 알림**: 변경사항이 있을 때만 표시
- **저장 버튼**:
  - 비활성화 조건: 저장 중이거나 변경사항이 없을 때
  - 저장 중: "저장 중..."

### 주요 기능

1. **실시간 토글**: 각 알림 유형을 즉시 활성화/비활성화
2. **조건부 표시**: 플랜 지연 알림, 방해 금지 시간 설정은 활성화 시에만 표시
3. **변경사항 추적**: 초기값과 현재값 비교
4. **자동 저장**: 저장 버튼 클릭 시 `updateNotificationSettings()` 호출

### 데이터 구조

```typescript
type NotificationSettings = {
  plan_start_enabled: boolean;
  plan_complete_enabled: boolean;
  daily_goal_achieved_enabled: boolean;
  weekly_report_enabled: boolean;
  plan_delay_enabled: boolean;
  plan_delay_threshold_minutes: number;
  notification_time_start: string; // HH:mm
  notification_time_end: string; // HH:mm
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:mm
  quiet_hours_end: string; // HH:mm
};
```

## 3. 로그인 기기 관리 (`/settings/devices`)

### 페이지 정보
- **경로**: `/app/(student)/settings/devices/page.tsx`
- **타입**: Client Component
- **제목**: "로그인 기기 관리"
- **레이아웃**: 중앙 정렬, 최대 너비 4xl

### UI 구조

#### 상단 영역
- **제목**: "로그인 기기 관리" (text-3xl, font-semibold)
- **컴포넌트**: `DeviceManagement`

#### 현재 기기 섹션
- **제목**: "현재 기기"
- **상태 배지**: "활성" (초록색)
- **정보 표시**:
  - 기기 이름
  - IP 주소
  - 마지막 활동 시간 (상대 시간 표시)
  - 로그인 시간 (상대 시간 표시)

#### 다른 기기 섹션
- **제목**: "다른 기기 (N개)"
- **액션**: "모두 로그아웃" 버튼 (빨간색 텍스트)
- **기기 목록**:
  - 각 기기별 카드
  - 정보: 기기 이름, IP 주소, 마지막 활동, 로그인 시간
  - 액션: "로그아웃" 버튼 (빨간색 배경)

#### 빈 상태
- 로그인한 기기가 없을 때 표시
- 회색 배경, 중앙 정렬 메시지

### 주요 기능

1. **세션 조회**: `getUserSessions()` - 모든 활성 세션 조회
2. **개별 로그아웃**: `revokeSession(sessionId)` - 특정 기기에서 로그아웃
3. **일괄 로그아웃**: `revokeAllOtherSessions()` - 현재 기기 제외 모든 기기에서 로그아웃
4. **상대 시간 표시**: "방금 전", "N분 전", "N시간 전", "N일 전", 날짜 형식

### 데이터 구조

```typescript
type UserSession = {
  id: string;
  device_name: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  is_current_session: boolean;
};
```

## 4. 계정 관리 (`/settings/account`)

### 페이지 정보
- **경로**: `/app/(student)/settings/account/page.tsx`
- **타입**: Client Component
- **제목**: "계정 관리"
- **레이아웃**: 중앙 정렬, 최대 너비 2xl

### UI 구조

#### 상단 영역
- **제목**: "계정 관리" (text-3xl, font-semibold)

#### 비밀번호 변경 섹션
카드 형태 (흰색 배경, 그림자):

- **섹션 제목**: "비밀번호 변경" (text-xl, font-semibold)

- **현재 비밀번호** (`current_password`)
  - 타입: password input
  - 필수 항목
  - 플레이스홀더: "현재 비밀번호를 입력하세요"
  
- **새 비밀번호** (`new_password`)
  - 타입: password input
  - 필수 항목
  - 최소 길이: 6자
  - 플레이스홀더: "새 비밀번호를 입력하세요 (최소 6자)"
  - 도움말: "비밀번호는 최소 6자 이상이어야 합니다."
  
- **새 비밀번호 확인** (`confirm_password`)
  - 타입: password input
  - 필수 항목
  - 최소 길이: 6자
  - 플레이스홀더: "새 비밀번호를 다시 입력하세요"

#### 메시지 영역
- **에러 메시지**: 빨간색 배경
- **성공 메시지**: 초록색 배경, 2초 후 자동 리다이렉트

#### 하단 액션 영역
- **취소 버튼**: `router.back()` - 이전 페이지로 이동
- **비밀번호 변경 버튼**:
  - 저장 중: "변경 중..."
  - 일반: "비밀번호 변경"

### 주요 기능

1. **유효성 검사**:
   - 모든 필드 필수 입력
   - 새 비밀번호 최소 6자
   - 새 비밀번호와 확인 비밀번호 일치 확인
   
2. **비밀번호 변경**: `updatePassword(currentPassword, newPassword)`
3. **성공 처리**: 성공 시 2초 후 `/settings`로 리다이렉트

## 공통 UI 패턴

### 레이아웃
- 모든 페이지: `p-6 md:p-8` 패딩
- 중앙 정렬: `mx-auto max-w-{size}`
- 제목: `text-3xl font-semibold mb-6`

### 폼 요소
- Input: `rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200`
- Select: 동일한 스타일
- Button (Primary): `rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700`
- Button (Secondary): `rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50`

### 메시지
- 성공: `bg-green-50 border border-green-200 text-green-800`
- 에러: `bg-red-50 border border-red-200 text-red-800`

### 카드/섹션
- `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`

## 사용자 플로우

### 초기 설정 플로우
1. 학생 정보 없음 → 마이페이지 접근
2. 환영 메시지 및 단계별 가이드 표시
3. 기본 정보 입력 (이름, 학년, 생년월일 필수)
4. 입시 정보 입력 (자동 계산 또는 수동 입력)
5. 진로 정보 입력 (선택)
6. "시작하기" 클릭 → 저장 및 대시보드로 리다이렉트

### 일반 설정 플로우
1. 사이드바 "설정" → "마이페이지" 클릭
2. 현재 정보 확인/수정
3. 탭 전환 시 변경사항 확인
4. 저장 또는 취소

### 알림 설정 플로우
1. 사이드바 "설정" → "알림 설정" 클릭
2. 알림 유형 토글 설정
3. 알림 시간 설정
4. 방해 금지 시간 설정 (선택)
5. 저장 버튼 클릭

### 기기 관리 플로우
1. 사이드바 "설정" → "로그인 기기 관리" 클릭
2. 현재 기기 확인
3. 다른 기기 목록 확인
4. 의심스러운 기기 로그아웃 또는 모두 로그아웃

### 계정 관리 플로우
1. 사이드바 "설정" → "계정 관리" 클릭
2. 현재 비밀번호 입력
3. 새 비밀번호 입력 및 확인
4. 비밀번호 변경 버튼 클릭
5. 성공 시 자동으로 마이페이지로 리다이렉트

## 데이터베이스 연동

### 테이블 구조
- `students`: 기본 학생 정보
- `student_profiles`: 프로필 정보 (연락처 등)
- `student_career_goals`: 진로 목표 정보
- `student_notification_preferences`: 알림 설정
- `auth.sessions`: 로그인 세션 정보

### 주요 액션 함수
- `getCurrentStudent()`: 현재 학생 정보 조회
- `updateStudentProfile()`: 학생 프로필 업데이트
- `updateNotificationSettings()`: 알림 설정 업데이트
- `getUserSessions()`: 세션 목록 조회
- `revokeSession()`: 세션 삭제
- `updatePassword()`: 비밀번호 변경

## 개선이 필요한 부분

1. **일관성 부족**
   - 각 페이지의 레이아웃 너비가 다름 (2xl vs 4xl)
   - 메시지 표시 방식이 다름 (일부는 자동 숨김, 일부는 수동 닫기)

2. **네비게이션**
   - 각 설정 페이지 간 이동이 불편 (사이드바로만 이동)
   - 설정 페이지 간 연관성 부족

3. **사용자 경험**
   - 초기 설정 모드와 일반 모드의 UI 차이가 큼
   - 변경사항 확인 다이얼로그가 브라우저 기본 confirm 사용

4. **정보 구조**
   - "마이페이지"라는 이름이 프로필 정보만을 의미하는지 불명확
   - 계정 관리와 프로필 관리의 경계가 모호

