/**
 * OGU K-pop 인터뷰 미션: 모범 답변 요청 시 API에 보내는 고정 토큰 (UI에 숨김)
 */
export const OGU_MODEL_ANSWER_TOKEN = "__OGU_SHOW_MODEL__";

const ROMAJA = {
  이름: "i-reum",
  이름이: "i-reum-i",
  노래: "no-rae",
  좋아요: "jo-a-yo",
  안녕하세요: "an-nyeong-ha-se-yo",
  기자: "gi-ja",
  기자님: "gi-ja-nim",
  오늘: "o-neul",
  데뷔: "de-byu",
  무대: "mu-dae",
  팬: "paen",
  감사: "gam-sa",
  감사합니다: "gam-sa-ham-ni-da",
  무엇: "mu-eot",
  무엇이: "mu-eo-si",
  어떻게: "eo-tteo-ke",
  왜: "wae",
  뭐: "mwo",
  뭔가요: "mwon-ga-yo",
  해요: "hae-yo",
  예요: "ye-yo",
  첫: "cheot",
  번째: "beon-jjae",
  질문: "jil-mun",
  인터뷰: "in-teo-byu",
  케이팝: "ke-i-pap",
  아티스트: "a-ti-seu-teu",
  연습: "yeon-seup",
  하세요: "ha-se-yo",
  되세요: "doe-se-yo",
  있어요: "iss-eo-yo",
  좋아하세요: "jo-a-ha-se-yo"
};

/** 기자가 물어볼 수 있는 질문 주제 키워드 + 로마자 (5초 힌트 카드) */
const QUESTION_TOPIC_HINTS = [
  { word: "이름", romaja: "i-reum" },
  { word: "노래", romaja: "no-rae" },
  { word: "취미", romaja: "chwi-mi" },
  { word: "데뷔", romaja: "de-byu" },
  { word: "무대", romaja: "mu-dae" },
  { word: "팬", romaja: "paen" },
  { word: "고향", romaja: "go-hyang" },
  { word: "일정", romaja: "il-jeong" }
];

/**
 * 질문 아이디어 힌트 3개 (턴에 따라 키워드 세트가 살짝 바뀜)
 * @param {number} assistantTurnIndex - 현재까지 assistant 메시지 개수 (1부터)
 */
export function getInterviewQuestionTopicHints(assistantTurnIndex = 1) {
  const n = QUESTION_TOPIC_HINTS.length;
  const start = Math.max(0, assistantTurnIndex - 1) % n;
  const out = [];
  for (let i = 0; i < 3; i++) {
    out.push(QUESTION_TOPIC_HINTS[(start + i) % n]);
  }
  return out;
}

/**
 * 마지막 OGU 발화에서 힌트용 단어(한글) + 로마자 최대 3개 추출 (레거시·다른 용도)
 */
export function extractInterviewHints(koreanText) {
  if (!koreanText || typeof koreanText !== "string") return [];
  const noParen = koreanText.replace(/\([^)]*\)/g, " ");
  const noEmoji = noParen.replace(/\p{Extended_Pictographic}/gu, " ");
  const tokens = noEmoji.split(/[\s\n,.!?…]+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const raw of tokens) {
    const w = raw.replace(/^[^가-힣]+|[^가-힣]+$/g, "");
    if (w.length < 2) continue;
    let romaja = ROMAJA[w];
    if (!romaja) {
      for (let len = Math.min(w.length, 8); len >= 2; len--) {
        const sub = w.slice(0, len);
        if (ROMAJA[sub]) {
          romaja = ROMAJA[sub];
          break;
        }
      }
    }
    if (romaja && !seen.has(w)) {
      seen.add(w);
      out.push({ word: w, romaja });
      if (out.length >= 3) break;
    }
  }
  return out;
}
