# 캠프 목록에 장소 및 기간 정보 추가

## 작업 일시
2025-02-02

## 작업 목표
학생 페이지의 캠프 목록 카드에 캠프 장소(`camp_location`)와 캠프 기간(`camp_start_date`, `camp_end_date`) 정보를 추가하여 템플릿 기본 정보를 모두 표시합니다.

## 문제점
- 캠프 템플릿에는 장소와 기간 정보가 있지만 학생 페이지에서 표시되지 않음
- 템플릿 기본 정보(이름, 유형, 설명)만 표시되어 캠프 참여 시 필요한 정보가 부족함

## 해결 방안
1. 템플릿 정보 조회 시 장소 및 기간 필드 포함
2. 카드 컴포넌트 타입에 필드 추가
3. 카드 UI에 장소 및 기간 정보 표시

## 변경 사항

### 1. 템플릿 정보 조회에 장소 및 기간 필드 추가
**파일**: `app/(student)/actions/campActions.ts`

- `getStudentCampInvitations` 함수에서 템플릿 정보에 다음 필드 추가:
  - `camp_location`: 캠프 장소
  - `camp_start_date`: 캠프 시작일
  - `camp_end_date`: 캠프 종료일

```32:42:app/(student)/actions/campActions.ts
      const template = await getCampTemplate(invitation.camp_template_id);
      return {
        ...invitation,
        template: template
          ? {
              name: template.name,
              program_type: template.program_type,
              description: template.description,
              camp_location: template.camp_location,
              camp_start_date: template.camp_start_date,
              camp_end_date: template.camp_end_date,
            }
          : null,
      };
```

### 2. 카드 컴포넌트 타입에 필드 추가
**파일**: `app/(student)/camp/_components/CampInvitationCard.tsx`

- `CampInvitationCardProps` 타입의 `template` 객체에 필드 추가

```17:25:app/(student)/camp/_components/CampInvitationCard.tsx
    template?: {
      name?: string;
      program_type?: string;
      description?: string;
      camp_location?: string | null;
      camp_start_date?: string | null;
      camp_end_date?: string | null;
    } | null;
```

### 3. 카드 UI에 장소 및 기간 정보 표시
**파일**: `app/(student)/camp/_components/CampInvitationCard.tsx`

- 프로그램 유형을 이름 위에 뱃지 형태로 표시
- 설명 아래에 장소 정보 표시
- 장소 아래에 캠프 기간 정보 표시 (날짜 포맷팅 포함)

```56:80:app/(student)/camp/_components/CampInvitationCard.tsx
          <div className="flex items-center gap-2 mb-2">
            {invitation.template?.program_type && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800">
                {invitation.template.program_type}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {invitation.template?.name || "캠프 프로그램"}
          </h3>
          {invitation.template?.description && (
            <p className="mt-2 text-sm text-gray-500">
              {invitation.template.description}
            </p>
          )}
          {/* 캠프 장소 */}
          {invitation.template?.camp_location && (
            <p className="mt-2 text-sm text-gray-500">
              장소: {invitation.template.camp_location}
            </p>
          )}
          {/* 캠프 기간 */}
          {invitation.template?.camp_start_date && invitation.template?.camp_end_date && (
            <p className="mt-2 text-sm text-gray-500">
              기간: {new Date(invitation.template.camp_start_date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })} ~ {new Date(invitation.template.camp_end_date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
```

## 표시 정보 구조

```
- 프로그램 유형 (뱃지 형태, 이름 위) ← 수정
- 템플릿 이름
- 설명 (있는 경우)
- 장소 (있는 경우) ← 추가
- 캠프 기간 (있는 경우) ← 추가
- 플랜 상태 표시
```

### 프로그램 유형 뱃지 스타일
- 이름 위에 뱃지 형태로 표시
- `bg-indigo-100`, `text-indigo-800` 색상 사용
- `rounded-full` 형태의 작은 뱃지

## 날짜 포맷
- 한국어 형식으로 표시: "2025년 1월 15일 ~ 2025년 1월 20일"
- `toLocaleDateString("ko-KR")` 사용하여 자연스러운 형식으로 변환

## 개선 효과

1. **정보 완성도 향상**: 템플릿 기본 정보(이름, 유형, 설명, 장소, 기간)가 모두 표시됨
2. **사용자 편의성**: 캠프 참여 전 필요한 정보를 한눈에 확인 가능
3. **조건부 표시**: 정보가 있는 경우에만 표시하여 불필요한 공간 낭비 방지

## 테스트 항목

- [x] 템플릿 정보 조회 시 장소 및 기간 필드가 포함되는지 확인
- [x] 카드에 장소 정보가 표시되는지 확인
- [x] 카드에 캠프 기간 정보가 표시되는지 확인
- [x] 날짜 포맷이 올바르게 표시되는지 확인
- [x] 정보가 없는 경우 표시되지 않는지 확인

## 관련 파일

- `app/(student)/actions/campActions.ts`
- `app/(student)/camp/_components/CampInvitationCard.tsx`

