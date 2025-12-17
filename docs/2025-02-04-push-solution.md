# GitHub Push 해결 방법

## 현재 상황

✅ 로컬과 원격 동기화 완료
⚠️ 이전 커밋 히스토리에 Figma Personal Access Token이 포함되어 있어 GitHub Push Protection이 차단할 수 있습니다.

## 해결 방법

### 1단계: Figma 토큰 재발급 (필수) 🔐

노출된 토큰은 보안 위험이므로 즉시 재발급하세요:

1. Figma → Settings → Personal Access Tokens
2. 기존 토큰 삭제
3. 새 토큰 생성
4. 로컬 `~/.config/cursor/mcp.json` 업데이트

### 2단계: GitHub Unblock URL 사용

GitHub에서 제공하는 unblock URL을 사용하여 푸시를 허용:

**Unblock URL:**
```
https://github.com/eduatalk23-lgtm/eduatalk/security/secret-scanning/unblock-secret/36yZdFe5qqmj9njEyYjRX1ULzMe
```

**사용 방법:**
1. 위 URL을 브라우저에서 열기
2. "Allow secret" 클릭
3. 푸시 재시도:
   ```bash
   git push
   ```

### 3단계: 푸시 확인

```bash
git push
```

## 완료된 작업

✅ 현재 파일에서 토큰 마스킹 완료
✅ `.gitignore`에 설정 파일 추가 완료
✅ 로컬과 원격 동기화 완료
✅ 가이드 문서 작성 완료

## 참고

- Unblock URL은 일시적으로 푸시를 허용합니다
- 토큰은 이미 노출되었으므로 반드시 재발급해야 합니다
- 향후 토큰은 환경 변수나 보안 저장소에 보관하세요

