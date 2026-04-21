const idolScripts = {

  greeting: [
    { id: "G01", text: "안녕하세요~" },
    { id: "G02", text: "안녕~ 잘 지냈어요?" },
    { id: "G03", text: "오랜만이에요!" },
    { id: "G04", text: "아가가 찾아왔네~" },
    { id: "G05", text: "잘 들려요? 저 잘 보여요?" },
    { id: "G06", text: "와~ 드디어 만났다!" },
    { id: "G07", text: "어머, 반가워요~" },
    { id: "G08", text: "기다렸어요~" },
    { id: "G09", text: "오~ 왔어요? 반가워요!" },
    { id: "G10", text: "안녕~ 오늘 컨디션 좋아 보이네요!" },
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
  ],

  reaction_name: [
    { id: "NAME01", text: "기억할게요." },
    { id: "NAME02", text: "기억하겠습니다. 예쁜 이름이에요." },
    { id: "NAME03", text: "[이름]~ 예쁜 이름이다!" },
    { id: "NAME04", text: "[이름]이에요? 잘 어울려요~" },
    { id: "NAME05", text: "[이름], 오늘 와줘서 고마워요." },
    { id: "NAME06", text: "이름 외웠어요~ [이름]!" },
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
    { id: "IQ01", text: "어느 나라에서 왔어요?", hintKo: "[나라] 사람이에요!", hintEn: "I'm from [country]!" },
    { id: "IQ02", text: "언제부터 팬이었어요?", hintKo: "[N]년 됐어요!", hintEn: "It's been [N] years!" },
    { id: "IQ03", text: "한국어 어디서 배웠어요?", hintKo: "혼자 공부했어요!", hintEn: "I studied on my own!" },
    { id: "IQ04", text: "좋아하는 노래 있어요?", hintKo: "[노래 제목]이요!", hintEn: "It's [song title]!" },
    { id: "IQ05", text: "콘서트 와본 적 있어요?", hintKo: "꼭 가고 싶어요!", hintEn: "I really want to go!" },
    { id: "IQ06", text: "이번 앨범 어땠어요?", hintKo: "너무 좋았어요!", hintEn: "I loved it so much!" },
    { id: "IQ07", text: "뭐 하고 싶어요? 소원 있어요?", hintKo: "같이 사진 찍고 싶어요!", hintEn: "I want to take a photo together!" },
    { id: "IQ08", text: "다음에도 또 올 거예요?", hintKo: "당연하죠! 꼭 다시 올게요!", hintEn: "Of course! I'll definitely come back!" },
  ],

  staff_closing: "이제 종료하겠습니다.",
};

// Phase별 대사 선택 헬퍼
export function getRandomLine(category) {
  const lines = idolScripts[category];
  if (!lines || lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
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

// 역질문 랜덤 선택 (Phase B 강제 삽입용)
export function getIdolQuestion() {
  return getRandomLine("idol_question_pool");
}

// 긴장 감지 시 우선순위 반응
export function getNervousResponse() {
  return idolScripts.reaction_nervous.find(l => l.id === "N01")
    || getRandomLine("reaction_nervous");
}

export default idolScripts;
