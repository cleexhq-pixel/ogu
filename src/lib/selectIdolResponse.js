import idolScripts, {
  getRandomLine,
  getIdolQuestion,
  getNervousResponse,
} from "../data/idol-scripts";

// 유저 발화를 키워드로 분류
export function classifyUserInput(text) {
  if (!text) return "nervous";
  const t = text.toLowerCase();
  if (t.includes("떨") || t.includes("긴장") || t.length < 5) return "nervous";
  if (t.includes("좋아") || t.includes("잘생") || t.includes("예뻐") || t.includes("멋")) return "compliment";
  if (t.includes("해줘") || t.includes("해주세요") || t.includes("부탁")) return "request";
  if (t.includes("게임") || t.includes("당연하지") || t.includes("맞춰")) return "game";
  if (t.includes("안녕") || t.includes("처음")) return "greeting";
  if (t.includes("이름") || t.includes("불러")) return "name";
  return "korean"; // 기본: 한국어 칭찬
}

// 분류 결과 → 아이돌 반응 선택
export function selectIdolResponse(classification, turnCount, forceQuestion = false) {
  // 역질문 강제 삽입 (턴 3 또는 5)
  if (forceQuestion) return { type: "question", line: getIdolQuestion() };

  switch (classification) {
    case "nervous":
      return { type: "nervous", line: getNervousResponse() };
    case "compliment":
      return { type: "compliment", line: getRandomLine("reaction_compliment") };
    case "request":
      return { type: "request", line: getRandomLine("reaction_request") };
    case "game":
      return { type: "game", line: getRandomLine("reaction_game") };
    case "greeting":
      return { type: "greeting", line: getRandomLine("first_question") };
    case "name":
      return { type: "name", line: getRandomLine("reaction_name") };
    case "korean":
    default:
      return { type: "korean", line: getRandomLine("reaction_to_korean") };
  }
}
