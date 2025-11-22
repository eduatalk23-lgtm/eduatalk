-- ============================================
-- ERD Cloud Import: Communication Tables (Group 7)
-- 메시징 및 알림 테이블
-- ============================================

-- 1. messages (메시지)
CREATE TABLE messages (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid,
  message_type text DEFAULT 'direct' CHECK (message_type IN ('direct', 'group', 'broadcast')),
  subject varchar(200),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  is_important boolean DEFAULT false,
  status text DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE messages IS '메시지 테이블 (1:1, 그룹 메시징)';

-- 2. message_attachments (메시지 첨부파일)
CREATE TABLE message_attachments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name varchar(200) NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type varchar(50),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE message_attachments IS '메시지 첨부파일 테이블';

-- 3. notifications (알림)
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('plan', 'score', 'message', 'system', 'attendance', 'payment')),
  title varchar(200) NOT NULL,
  content text,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_url text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE notifications IS '알림 테이블';
COMMENT ON COLUMN notifications.notification_type IS '알림 유형: plan(플랜), score(성적), message(메시지), system(시스템), attendance(출석), payment(결제)';

-- 4. notification_preferences (알림 설정)
CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type, channel)
);

COMMENT ON TABLE notification_preferences IS '사용자별 알림 설정 테이블';

-- 5. sms_logs (SMS 전송 로그)
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  template_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE sms_logs IS 'SMS 전송 로그 테이블';

-- 6. email_logs (이메일 전송 로그)
CREATE TABLE email_logs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject varchar(200) NOT NULL,
  message_content text,
  template_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE email_logs IS '이메일 전송 로그 테이블';

