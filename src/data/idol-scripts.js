const idolScripts = {

  // G02, G03, G08: 재회를 전제하는 문구라 첫 통화에서 나오면 어색함.
  // 재방문(재회) 기능 도입 시 status를 되돌려 부활시킬 것.
  greeting: [
    { id: "G01", text: "안녕하세요~" },
    { id: "G02", text: "안녕~ 잘 지냈어요?", status: "retired" },
    { id: "G03", text: "오랜만이에요!", status: "retired" },
    { id: "G04", text: "아가가 찾아왔네~" },
    { id: "G05", text: "잘 들려요? 저 잘 보여요?" },
    { id: "G06", text: "와~ 드디어 만났다!" },
    { id: "G07", text: "어머, 반가워요~" },
    { id: "G08", text: "기다렸어요~", status: "retired" },
    { id: "G09", text: "오~ 왔어요? 반가워요!" },
    { id: "G10", text: "안녕~ 오늘 컨디션 좋아 보이네요!" },
    { id: "G11", text: "혹시 오늘이 처음이에요?", persona: "Universal" },
    { id: "G12", text: "기다려줘서 고마워요~", persona: "Calm" },
    { id: "G13", text: "우리 잘 부탁해요~", persona: "Universal" },
  ],

  first_question: [
    { id: "Q01", text: "어디에서 왔어요?" },
    { id: "Q02", text: "이름이 뭐예요?" },
    { id: "Q03", text: "몇 살이에요?" },
    { id: "Q04", text: "잘 지냈어요?" },
    { id: "Q05", text: "오늘 처음 왔어요?" },
    { id: "Q06", text: "팬 된 지 얼마나 됐어요?" },
    { id: "Q07", text: "저 보고 싶었어요?" },
    { id: "Q08", text: "오늘 뭐 하다 왔어요?" },
    { id: "Q09", text: "집에서 멀어요?" },
    { id: "Q10", text: "준비한 거 있어요? 말해봐요~" },
    { id: "Q11", text: "오늘 많이 기다렸어요?", persona: "Cheerful" },
    { id: "Q12", text: "지금 몇 시예요? 거기는?", persona: "Universal" },
  ],

  reaction_to_korean: [
    { id: "K01", text: "한국말 너무 잘 하십니다!" },
    { id: "K02", text: "한국말 진짜 잘하네~ 어디서 배웠어요?" },
    { id: "K03", text: "지금도 충분히 잘하고 있어요." },
    { id: "K04", text: "우와~ 한국어 잘한다!" },
    { id: "K05", text: "어머, 한국어 할 줄 알아요? 대박이다!" },
    { id: "K06", text: "발음도 좋아요! 어디서 배웠어요?" },
    { id: "K07", text: "한국어 공부했어요? 나 감동이에요~" },
    { id: "K08", text: "완전 잘하는데? 진짜로!" },
    { id: "K09", text: "이 정도면 잘하는 거예요, 걱정 마요!" },
    { id: "K10", text: "한국어로 말해줘서 너무 좋아요~" },
    { id: "K11", text: "요즘 한국어 공부했어요?", persona: "Playful" },
    { id: "K12", text: "오~ 한번 해봐요 해봐요!", persona: "Playful" },
    { id: "K13", text: "노래 많이 들으면 늘어요!", persona: "Cheerful" },
    { id: "K14", text: "우리 같이 공부해요~", persona: "Cheerful" },
  ],

  reaction_compliment: [
    { id: "C01", text: "아이고 아주 좋아죽네 좋아죽어~" },
    { id: "C02", text: "적극적으로 나오시는 구만!" },
    { id: "C03", text: "최고의 응원이에요. 진짜 최고의 응원이에요." },
    { id: "C04", text: "감사합니다~ 저도 너무 기쁘네요!" },
    { id: "C05", text: "어머~ 고마워요! 부끄럽게~" },
    { id: "C06", text: "진짜요? 나도 좋아요~" },
    { id: "C07", text: "그런 말 들으면 너무 행복해요." },
    { id: "C08", text: "오늘 하루 기분 좋겠는데?" },
    { id: "C09", text: "에이~ 부끄럽잖아요~", persona: "Shy" },
    { id: "C10", text: "언젠가 꼭 해볼게요~", persona: "Shy" },
    { id: "C11", text: "우와, 이런 걸 준비했어요?", persona: "Cheerful" },
    { id: "C12", text: "이거 진짜 최고의 선물이에요.", persona: "Cheerful" },
    { id: "C13", text: "괜찮아요, 저 체력 좋아요!", persona: "Playful" },
    { id: "C14", text: "그렇게 봐줘서 고마워요~", persona: "Calm" },
  ],

  reaction_request: [
    { id: "R01", text: "좋아! 오케이!" },
    { id: "R02", text: "해드리겠습니다!" },
    { id: "R03", text: "그건 빼고 해줄 수 있어요~" },
    { id: "R04", text: "무슨 노래 부를까요? 빨리 골라줘요!" },
    { id: "R05", text: "어머~ 그걸 원했어요? 귀엽다~" },
    { id: "R06", text: "알겠어요~ 해줄게요!" },
    { id: "R07", text: "잠깐만요, 이렇게요?" },
    { id: "R08", text: "특이한 걸 원하는구나~ 좋아요 해줄게!" },
  ],

  reaction_nervous: [
    { id: "N01", text: "이제 괜찮아! 준비해온 거 있으면 차근차근 말해봐." },
    { id: "N02", text: "나랑 끊고 싶어?" },
    { id: "N03", text: "떨리지 않게 연습해요. 지금처럼!" },
    { id: "N04", text: "괜찮아요~ 천천히 해요." },
    { id: "N05", text: "나도 사실 조금 떨려요, 같이 떨어요~" },
    { id: "N06", text: "숨 한번 깊게 쉬어봐요, 후~" },
    { id: "N07", text: "괜찮아요, 틀려도 돼요. 그냥 말해봐요." },
    { id: "N08", text: "어머, 귀여워~ 왜 이렇게 떨어요?" },
    { id: "N09", text: "오늘 처음이라 그런가 봐요~", persona: "Calm" },
    { id: "N10", text: "안 어색해요. 저도 그래요~", persona: "Calm" },
  ],

  reaction_game: [
    { id: "M01", text: "당연하지!" },
    { id: "M02", text: "내가 졌어~" },
    { id: "M03", text: "영국? 중국...사람?" },
    { id: "M04", text: "오, 재밌겠다! 해봐요~" },
    { id: "M05", text: "어렵다~ 모르겠어요. 힌트 줘요!" },
    { id: "M06", text: "내가 이겼다! 어때요?" },
    { id: "M07", text: "이 게임 처음 해봐요~ 신기하다!" },
    { id: "M08", text: "다음에 또 이 게임 하고 싶어요~" },
    { id: "M09", text: "음... 모르겠다! 답이 뭐예요?", persona: "Playful" },
    { id: "M10", text: "아~ 그거였구나! 재밌다~", persona: "Playful" },
    { id: "M11", text: "어려운 질문이네요~ 잠깐만요.", persona: "Universal" },
  ],

  small_talk: [
    { id: "S01", text: "저 요즘 고양이 키우고 싶어요.", persona: "Calm" },
    { id: "S02", text: "키운다는 건 아니고~ 그냥요.", persona: "Shy" },
    { id: "S03", text: "그 부분, 제가 직접 짰어요.", persona: "Calm" },
    { id: "S04", text: "무대 직전에 또 바꿨어요~", persona: "Cheerful" },
    { id: "S05", text: "크지 않아도 돼요. 작게요.", persona: "Calm" },
    { id: "S06", text: "우와, 그거 뭐예요? 보여줘요!", persona: "Cheerful" },
    { id: "S07", text: "어? 잠깐만요, 다시 보여줘요~", persona: "Playful" },
    { id: "S08", text: "저도 갖고 싶어요, 그거~", persona: "Playful" },
  ],

  heart_talk: [
    { id: "H01", text: "음... 저도 잘 모르겠어요.", persona: "Calm" },
    { id: "H02", text: "그냥 내 일 잘하면 되더라고요.", persona: "Calm" },
    { id: "H03", text: "저도 요즘 그런 거 느꼈어요.", persona: "Calm" },
    { id: "H04", text: "왜요? 무슨 일 있었어요?", persona: "Calm" },
    { id: "H05", text: "그랬구나... 많이 힘들었겠다.", persona: "Calm" },
    { id: "H06", text: "못 와도 괜찮아요. 잘할게요!", persona: "Cheerful" },
    { id: "H07", text: "응원해준다는 말 들을 때요.", persona: "Calm" },
    { id: "H08", text: "저는 세계 평화요!", persona: "Playful" },
    { id: "H09", text: "그렇게 말해줘서 고마워요.", persona: "Calm" },
  ],

  reaction_name: [
    { id: "NAME01", text: "기억할게요." },
    { id: "NAME02", text: "기억하겠습니다. 예쁜 이름이에요." },
    { id: "NAME03", text: "예쁜 이름이다!" },
    { id: "NAME04", text: "잘 어울리는 이름이에요~" },
    { id: "NAME05", text: "오늘 와줘서 고마워요." },
    { id: "NAME06", text: "이름 외웠어요!" },
  ],

  time_pressure: [
    { id: "T01", text: "빨리 하나 골라줘요 제발~" },
    { id: "T02", text: "시간이 얼마 없어요~ 빨리빨리!" },
    { id: "T03", text: "아 벌써 다 됐어요? 너무 아쉽다~" },
    { id: "T04", text: "마지막으로 하고 싶은 말 있어요?" },
    { id: "T05", text: "다음에 또 봐요! 빨리!" },
  ],

  closing: [
    { id: "CL01", text: "다음에 또 봐요~" },
    { id: "CL02", text: "안녕~ 사랑해~ 빠이빠이!" },
    { id: "CL03", text: "기억할게요. 건강하게 지내요." },
    { id: "CL04", text: "안녕~" },
    { id: "CL05", text: "고마워요~ 다음에 또 오세요!" },
    { id: "CL06", text: "오늘 와줘서 진짜 고마워요." },
    { id: "CL07", text: "행복하게 지내요~ 건강해요!" },
    { id: "CL08", text: "보고 싶을 거예요~ 또 봐요!" },
    { id: "CL09", text: "사랑해요~ 안녕!" },
  ],

  emergency_card: [
    { id: "E01", text: "아 잠깐만요~ 다시 말할게요." },
    { id: "E02", text: "아 그거 말고, 다른 얘기 할게요!" },
    { id: "E03", text: "그냥 너무 좋아서 말이 안 나와요~" },
    { id: "E04", text: "한국어가 아직 서툴러요. 천천히 말해줄 수 있어요?" },
    { id: "E05", text: "잠깐만요, 메모 볼게요!" },
  ],

  idol_question_pool: [
    { id: "IQ01", text: "어느 나라에서 왔어요?", hintKo: "[나라] 사람이에요!", hintEn: "I'm from [country]!", topics: ["country"] },
    { id: "IQ02", text: "언제부터 팬이었어요?", hintKo: "[N]년 됐어요!", hintEn: "It's been [N] years!", topics: ["fan_since"] },
    { id: "IQ03", text: "한국어 어디서 배웠어요?", hintKo: "혼자 공부했어요!", hintEn: "I studied on my own!", topics: ["korean_learning"] },
    { id: "IQ04", text: "좋아하는 노래 있어요?", hintKo: "[노래 제목]이요!", hintEn: "It's [song title]!", topics: ["song"] },
    { id: "IQ05", text: "콘서트 와본 적 있어요?", hintKo: "꼭 가고 싶어요!", hintEn: "I really want to go!", topics: ["concert"] },
    { id: "IQ06", text: "이번 앨범 어땠어요?", hintKo: "너무 좋았어요!", hintEn: "I loved it so much!", topics: ["album"] },
    { id: "IQ07", text: "뭐 하고 싶어요? 소원 있어요?", hintKo: "같이 사진 찍고 싶어요!", hintEn: "I want to take a photo together!", topics: ["wish"] },
    { id: "IQ08", text: "다음에도 또 올 거예요?", hintKo: "당연하죠! 꼭 다시 올게요!", hintEn: "Of course! I'll definitely come back!", topics: ["comeback"] },
  ],

  staff_closing: "이제 종료하겠습니다.",
};

// Phase별 대사 선택 헬퍼
export function getRandomLine(category) {
  const lines = (idolScripts[category] || []).filter(
    (l) => l.status !== "retired",
  );
  if (lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

// 통화(세션) 내 중복 회피 — 클라이언트(call/page.js)에서만 사용할 것.
// 서버 API route는 여러 유저 요청이 같은 프로세스 메모리를 공유하므로
// 이 상태를 쓰면 다른 유저의 사용 이력이 섞여 들어간다. 서버 쪽에서는
// 기존 getRandomLine(무상태)만 사용한다.
const usedIdsThisSession = new Set();

export function getRandomLineNoRepeat(category) {
  const lines = (idolScripts[category] || []).filter(
    (l) => l.status !== "retired",
  );
  if (lines.length === 0) return null;
  let candidates = lines.filter((l) => !usedIdsThisSession.has(l.id));
  if (candidates.length === 0) {
    usedIdsThisSession.clear();
    candidates = lines;
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  usedIdsThisSession.add(picked.id);
  return picked;
}

export function resetUsedLines() {
  usedIdsThisSession.clear();
}

// 시나리오별 우선 카테고리에서 선택
export function getLineByScenario(scenario, phase) {
  if (phase === "A") {
    return getRandomLine("greeting");
  }
  if (phase === "B") {
    const cats = scenario.primaryCats;
    const cat = cats[Math.floor(Math.random() * cats.length)];
    return getRandomLine(cat);
  }
  if (phase === "closing") {
    return getRandomLine("closing");
  }
  return null;
}

// 역질문 선택 (Phase B 강제 삽입용) — excludeTopics에 해당하는 주제는 제외
export function getIdolQuestion(excludeTopics = []) {
  const exclude = new Set(
    Array.isArray(excludeTopics) ? excludeTopics : [],
  );
  const pool = idolScripts.idol_question_pool || [];
  let eligible = pool.filter(
    (q) => !q.topics?.some((t) => exclude.has(t)),
  );
  if (eligible.length === 0) eligible = pool;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// 긴장 감지 시 우선순위 반응
export function getNervousResponse() {
  return idolScripts.reaction_nervous.find(l => l.id === "N01")
    || getRandomLine("reaction_nervous");
}

export default idolScripts;
