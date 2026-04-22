export default function PrivacyPage() {
  return (
    <div style={{
      maxWidth: 390,
      margin: "0 auto",
      padding: "44px 22px 60px",
      fontFamily: "'Inter', sans-serif",
      color: "#F2F0F4",
      background: "#0E0E0F",
      minHeight: "100vh",
    }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 9, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#00E3FD", marginBottom: 10,
        }}>
          Privacy Policy
        </div>
        <h1 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 24, fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#F2F0F4", lineHeight: 1.2,
          marginBottom: 8,
        }}>
          개인정보 처리방침
        </h1>
        <p style={{ fontSize: 12, color: "#5C5A62" }}>
          최종 업데이트: 2026년 4월
        </p>
      </div>

      {/* 섹션 공통 스타일 헬퍼 */}
      {[
        {
          title: "1. 수집하는 정보",
          content: [
            "Kkobi My 90 Seconds는 서비스 개선을 위해 최소한의 익명화된 데이터만 수집합니다.",
            "• 시뮬레이션 시나리오 ID (예: compliment, birthday)",
            "• 완료한 대화 턴 수 및 라인 전달 수",
            "• 세션 시간 (초 단위)",
            "• 익명 유저 ID (기기 내 localStorage에만 저장)",
          ],
        },
        {
          title: "2. 수집하지 않는 정보",
          content: [
            "다음 정보는 절대 수집하지 않습니다.",
            "• 음성 원본 파일 (Web Speech API 텍스트 변환 후 즉시 폐기)",
            "• 실제 발화 내용 (이름, 국적, 개인 발언 등)",
            "• 이메일, 전화번호 등 연락처 정보 (결제 없이 이용 시)",
            "• 위치 정보",
            "• 기기 식별 정보",
          ],
        },
        {
          title: "3. 정보 사용 목적",
          content: [
            "수집된 익명 데이터는 다음 목적으로만 사용됩니다.",
            "• 아이돌 대사 풀(idol-scripts) 품질 개선",
            "• 시나리오별 학습 효과 분석",
            "• 서비스 버그 수정 및 UX 개선",
          ],
        },
        {
          title: "4. 정보 보관 기간",
          content: [
            "• 익명화된 시뮬레이션 로그: 수집일로부터 12개월",
            "• 익명 유저 ID: 유저가 브라우저 데이터를 삭제할 때까지",
            "• 유료 패스 정보: 구매일로부터 24개월",
          ],
        },
        {
          title: "5. 제3자 제공",
          content: [
            "수집된 정보는 어떠한 제3자에게도 판매하거나 제공하지 않습니다.",
            "서비스 운영을 위해 사용하는 외부 서비스:",
            "• Supabase (데이터 저장, 미국 소재)",
            "• Anthropic API (스크립트 생성, 미국 소재)",
            "• Google TTS (음성 합성, 미국 소재)",
            "• Vercel (서비스 호스팅, 미국 소재)",
          ],
        },
        {
          title: "6. 유저 권리",
          content: [
            "유저는 언제든지 다음을 요청할 수 있습니다.",
            "• 수집된 데이터 열람 요청",
            "• 수집된 데이터 삭제 요청",
            "• 데이터 수집 동의 철회",
            "요청은 cleex.hq@gmail.com으로 보내주세요.",
            "요청 후 30일 이내에 처리합니다.",
          ],
        },
        {
          title: "7. GDPR (유럽 유저)",
          content: [
            "프랑스 등 EU 거주 유저는 GDPR에 따라 추가 권리를 가집니다.",
            "• 데이터 이동권 (Data Portability)",
            "• 처리 제한권 (Right to Restriction)",
            "• 자동화된 의사결정 거부권",
            "GDPR 관련 문의: cleex.hq@gmail.com",
          ],
        },
        {
          title: "8. 쿠키 및 로컬스토리지",
          content: [
            "Kkobi는 광고 쿠키를 사용하지 않습니다.",
            "서비스 동작을 위해 브라우저 localStorage를 사용합니다.",
            "• ogu_user_id: 익명 유저 식별",
            "• kkobi_m90s_*: 학습 진행 상태",
            "브라우저 설정에서 언제든 삭제할 수 있습니다.",
          ],
        },
        {
          title: "9. 문의",
          content: [
            "개인정보 처리에 관한 문의사항이 있으시면 아래로 연락해주세요.",
            "이메일: cleex.hq@gmail.com",
            "서비스: talk.kkobi.app",
            "운영자: Cheong Lee",
          ],
        },
      ].map((section, i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <h2 style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 14, fontWeight: 700,
            color: "#F2F0F4", marginBottom: 10,
          }}>
            {section.title}
          </h2>
          <div style={{
            background: "#1A191B",
            borderRadius: 12, padding: "14px 16px",
          }}>
            {section.content.map((line, j) => (
              <p key={j} style={{
                fontSize: 12,
                color: line.startsWith("•") ? "#9E9BA4" : "#5C5A62",
                lineHeight: 1.7,
                marginBottom: j < section.content.length - 1 ? 4 : 0,
              }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      ))}

      {/* 하단 */}
      <div style={{
        borderTop: "1px solid #1A191B",
        paddingTop: 20, textAlign: "center",
      }}>
        <p style={{ fontSize: 11, color: "#5C5A62" }}>
          © 2026 Kkobi · talk.kkobi.app
        </p>
      </div>
    </div>
  );
}
