/**
 * 전화번호 마스킹 처리
 * 앞 3자리와 뒤 4자리만 표시, 중간은 마스킹
 * 
 * @param phone - 마스킹할 전화번호
 * @returns 마스킹된 전화번호 (예: "010-****-1234")
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) {
    return phone;
  }

  // 하이픈 제거
  const cleaned = phone.replace(/-/g, "");
  
  if (cleaned.length <= 4) {
    return "****";
  }

  // 앞 3자리와 뒤 4자리만 표시, 중간은 마스킹
  const start = cleaned.slice(0, 3);
  const end = cleaned.slice(-4);
  const masked = cleaned.slice(3, -4).replace(/\d/g, "*");

  return `${start}-${masked}-${end}`;
}

