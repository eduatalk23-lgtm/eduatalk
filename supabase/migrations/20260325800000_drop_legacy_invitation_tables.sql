-- ============================================
-- 레거시 초대 테이블 DROP
-- invite_codes, team_invitations → invitations 테이블로 통합 완료
-- 기존 데이터: 20260314100000_unified_invitations.sql에서 마이그레이션됨
-- ============================================

-- 1. invite_codes 테이블 DROP
-- 모든 코드 참조가 invitations 테이블로 전환됨
-- 기존 INV-XXXX 코드는 invitations.legacy_code에 보존됨
DROP TABLE IF EXISTS public.invite_codes CASCADE;

-- 2. team_invitations 테이블 DROP
-- 모든 팀 초대가 invitations 테이블로 통합됨
-- 기존 토큰은 invitations.token에 보존됨
DROP TABLE IF EXISTS public.team_invitations CASCADE;
