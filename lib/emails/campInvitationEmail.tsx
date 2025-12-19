/**
 * 캠프 초대 이메일 템플릿
 */

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Link,
} from "@react-email/components";

type CampInvitationEmailProps = {
  studentName: string;
  campName: string;
  invitationUrl: string;
  campStartDate?: string;
  campEndDate?: string;
  campLocation?: string;
};

export function CampInvitationEmail({
  studentName,
  campName,
  invitationUrl,
  campStartDate,
  campEndDate,
  campLocation,
}: CampInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={title}>캠프 초대 안내</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>{studentName}님, 안녕하세요!</Text>

            <Text style={paragraph}>
              <strong>{campName}</strong> 캠프에 초대되었습니다.
            </Text>

            {(campStartDate || campEndDate || campLocation) && (
              <Section style={infoBox}>
                {campStartDate && (
                  <Text style={infoText}>
                    <strong>시작일:</strong> {campStartDate}
                  </Text>
                )}
                {campEndDate && (
                  <Text style={infoText}>
                    <strong>종료일:</strong> {campEndDate}
                  </Text>
                )}
                {campLocation && (
                  <Text style={infoText}>
                    <strong>장소:</strong> {campLocation}
                  </Text>
                )}
              </Section>
            )}

            <Text style={paragraph}>
              아래 버튼을 클릭하여 캠프 참여 정보를 제출해주세요.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={invitationUrl}>
                캠프 참여하기
              </Button>
            </Section>

            <Text style={paragraph}>
              또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:
            </Text>
            <Link href={invitationUrl} style={link}>
              {invitationUrl}
            </Link>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              이 이메일은 자동으로 발송되었습니다. 문의사항이 있으시면
              관리자에게 연락해주세요.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// 스타일 정의
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 24px",
  backgroundColor: "#4f46e5",
};

const title = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.5",
  margin: "0",
  textAlign: "center" as const,
};

const content = {
  padding: "32px 24px",
};

const greeting = {
  fontSize: "18px",
  lineHeight: "1.5",
  color: "#1f2937",
  marginBottom: "16px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.5",
  color: "#4b5563",
  marginBottom: "16px",
};

const infoBox = {
  backgroundColor: "#f3f4f6",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "24px",
};

const infoText = {
  fontSize: "14px",
  lineHeight: "1.5",
  color: "#374151",
  marginBottom: "8px",
  marginTop: "0",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#4f46e5",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const link = {
  color: "#4f46e5",
  fontSize: "14px",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "32px 0",
};

const footer = {
  padding: "0 24px",
};

const footerText = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "0",
};

