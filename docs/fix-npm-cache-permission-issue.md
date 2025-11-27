# npm 캐시 권한 문제 해결 (MCP Supabase 연결 실패)

## 작업 일시
2025-11-27

## 문제 상황
MCP Supabase 서버를 실행할 때 npm 캐시 폴더 접근 권한 오류 발생:

```
npm error code EACCES
npm error syscall mkdir
npm error path /Users/johyeon-u/.npm/_cacache/index-v5/df/76
npm error errno EACCES
npm error Your cache folder contains root-owned files, due to a bug in
npm error previous versions of npm which has since been addressed.
```

이로 인해 `@supabase/mcp-server-supabase` 패키지를 실행할 수 없어 MCP 서버가 정상적으로 시작되지 않습니다.

## 원인 분석
1. `.npm` 캐시 폴더(`/Users/johyeon-u/.npm`)가 root 사용자 소유로 되어 있음
2. 이전 npm 버전의 버그로 인해 root 권한으로 생성된 파일이 남아있음
3. 현재 사용자(501:20)가 캐시 폴더에 접근할 수 없음

## 해결 방법

### 방법 1: npm 캐시 폴더 소유권 변경 (권장)

터미널에서 다음 명령어를 실행하여 npm 캐시 폴더의 소유권을 현재 사용자로 변경:

```bash
sudo chown -R 501:20 "/Users/johyeon-u/.npm"
```

**주의사항**: 
- `sudo` 명령어는 관리자 권한이 필요하므로 비밀번호를 입력해야 합니다
- `501:20`은 현재 사용자의 UID와 GID입니다 (macOS에서 일반적인 값)
- 실제 사용자 확인: `id -u` (UID), `id -g` (GID)

### 방법 2: npm 캐시 폴더 삭제 후 재생성

만약 방법 1이 작동하지 않는다면, 캐시 폴더를 삭제하고 다시 생성:

```bash
# 기존 캐시 폴더 삭제
rm -rf ~/.npm

# npm 캐시 재생성 (다음 npm 명령어 실행 시 자동 생성됨)
npm cache verify
```

### 방법 3: npm 캐시 경로 변경

임시로 npm 캐시 경로를 변경:

```bash
# npm 캐시 경로 확인
npm config get cache

# npm 캐시 경로 변경 (예: 프로젝트 내부로)
npm config set cache ~/.npm-cache

# 또는 환경 변수로 설정
export npm_config_cache=~/.npm-cache
```

## 검증

문제가 해결되었는지 확인:

```bash
# npm 캐시 상태 확인
npm cache verify

# MCP Supabase 서버 테스트
npx -y @supabase/mcp-server-supabase@latest --project-ref=your-project-ref
```

## 예상 결과

성공적으로 해결되면:
- npm 캐시 폴더에 정상적으로 접근 가능
- MCP Supabase 서버가 정상적으로 시작됨
- Cursor에서 MCP Supabase 리소스를 정상적으로 사용할 수 있음

## 참고 사항

### 사용자 UID/GID 확인

```bash
# 현재 사용자 정보 확인
id

# 출력 예시:
# uid=501(johyeon-u) gid=20(staff) groups=20(staff),12(everyone),...
```

### npm 캐시 위치

- macOS: `~/.npm`
- Linux: `~/.npm`
- Windows: `%AppData%\npm-cache`

## 관련 이슈

이 문제는 다음 상황에서 자주 발생합니다:
- `sudo npm install -g` 같은 root 권한으로 npm 명령어를 실행한 경우
- 이전 npm 버전의 버그로 인해 root 소유 파일이 생성된 경우
- 시스템 업그레이드나 사용자 계정 변경 후

## 추가 조치

### npm 권한 모범 사례

앞으로 npm을 사용할 때 다음 사항을 준수하세요:

1. **전역 패키지 설치 시 nvm 사용** (권장)
   ```bash
   # nvm으로 Node.js 버전 관리
   nvm install --lts
   nvm use --lts
   ```

2. **sudo와 npm 함께 사용 금지**
   ```bash
   # ❌ 나쁜 예
   sudo npm install -g package-name
   
   # ✅ 좋은 예
   npm install -g package-name
   ```

3. **npm prefix 확인**
   ```bash
   # npm 전역 설치 경로 확인
   npm config get prefix
   
   # 현재 사용자가 쓰기 가능한 경로로 설정
   mkdir -p ~/.npm-global
   npm config set prefix '~/.npm-global'
   ```

## 다음 단계

1. 위 해결 방법 중 하나를 실행
2. Cursor 재시작
3. MCP Supabase 연결 상태 확인
4. 정상 작동 여부 테스트

