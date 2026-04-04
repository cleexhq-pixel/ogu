/** After finishing Day 30, localStorage holds this “all journey days done” marker. */
export const JOURNEY_DONE_MARKER = 31;
export const MAX_JOURNEY_DAY = 30;

/**
 * @typedef {{ word: string, roman: string, meaning: string }} JourneyVocabEntry
 * @typedef {{ day: number, ko: string, en: string, homeTitle: string, homeKo: string, romanization?: string, vocab?: JourneyVocabEntry[] }} JourneyDayRow
 */

/** @type {JourneyDayRow[]} */
export const JOURNEY_DAYS = [
  {
    day: 1,
    ko: "제 최애는 BTS예요.",
    en: "My favorite is BTS.",
    homeTitle: "My favorite",
    homeKo: "제 최애는 ___예요.",
    romanization: "Je choe-ae-neun BTS-ye-yo.",
    vocab: [
      { word: "제", roman: "je", meaning: "my / as for me" },
      { word: "최애는", roman: "choe-ae-neun", meaning: "favorite (topic)" },
      { word: "BTS예요", roman: "BTS-ye-yo", meaning: "is BTS" }
    ]
  },
  {
    day: 2,
    ko: "저는 K-pop을 좋아해요.",
    en: "I like K-pop.",
    homeTitle: "I like this",
    homeKo: "저는 ___를 좋아해요.",
    romanization: "Jeo-neun K-pop-eul jo-a-hae-yo.",
    vocab: [
      { word: "저는", roman: "jeo-neun", meaning: "I (topic)" },
      { word: "K-pop을", roman: "K-pop-eul", meaning: "K-pop (object)" },
      { word: "좋아해요", roman: "jo-a-hae-yo", meaning: "like / love" }
    ]
  },
  {
    day: 3,
    ko: "저는 한국어를 배우고 있어요.",
    en: "I'm learning Korean.",
    homeTitle: "I'm learning",
    homeKo: "저는 한국어를 배우고 있어요.",
    romanization: "Jeo-neun han-gu-geo-reul bae-u-go it-eo-yo.",
    vocab: [
      { word: "저는", roman: "jeo-neun", meaning: "I / as for me" },
      { word: "한국어를", roman: "han-gu-geo-reul", meaning: "Korean (object)" },
      { word: "배우고", roman: "bae-u-go", meaning: "learning" },
      { word: "있어요", roman: "it-eo-yo", meaning: "am (present)" }
    ]
  },
  {
    day: 4,
    ko: "진짜 좋아해요.",
    en: "I really love it.",
    homeTitle: "Really love it",
    homeKo: "진짜 좋아해요.",
    romanization: "Jin-jja jo-a-hae-yo.",
    vocab: [
      { word: "진짜", roman: "jin-jja", meaning: "really" },
      { word: "좋아해요", roman: "jo-a-hae-yo", meaning: "love / like" }
    ]
  },
  {
    day: 5,
    ko: "너무 귀여워요.",
    en: "So cute!",
    homeTitle: "So cute",
    homeKo: "너무 귀여워요.",
    romanization: "Neo-mu gwi-yeo-wo-yo.",
    vocab: [
      { word: "너무", roman: "neo-mu", meaning: "so / too" },
      { word: "귀여워요", roman: "gwi-yeo-wo-yo", meaning: "cute" }
    ]
  },
  {
    day: 6,
    ko: "대박이에요!",
    en: "That's amazing!",
    homeTitle: "Amazing",
    homeKo: "대박이에요!",
    romanization: "Dae-ba-gi-e-yo!",
    vocab: [
      { word: "대박", roman: "dae-bak", meaning: "awesome / jackpot" },
      { word: "이에요", roman: "i-e-yo", meaning: "it is" }
    ]
  },
  {
    day: 7,
    ko: "정말 멋있어요.",
    en: "So cool!",
    homeTitle: "So cool",
    homeKo: "정말 멋있어요.",
    romanization: "Jeong-mal meo-si-sseo-yo.",
    vocab: [
      { word: "정말", roman: "jeong-mal", meaning: "really" },
      { word: "멋있어요", roman: "meo-si-sseo-yo", meaning: "cool / awesome" }
    ]
  },
  { day: 8, ko: "진짜요?", en: "Really?", homeTitle: "Really?", homeKo: "진짜요?" },
  { day: 9, ko: "너무 좋아요.", en: "I love it so much.", homeTitle: "Love it so much", homeKo: "너무 좋아요." },
  { day: 10, ko: "보고 싶어요.", en: "I miss you.", homeTitle: "I miss you", homeKo: "보고 싶어요." },
  { day: 11, ko: "최고예요!", en: "You're the best!", homeTitle: "You're the best", homeKo: "최고예요!" },
  { day: 12, ko: "감동이에요.", en: "I'm so moved.", homeTitle: "So moved", homeKo: "감동이에요." },
  { day: 13, ko: "행복해요.", en: "I'm so happy.", homeTitle: "Happy", homeKo: "행복해요." },
  { day: 14, ko: "응원해요!", en: "I'm cheering for you!", homeTitle: "Cheering for you", homeKo: "응원해요!" },
  {
    day: 15,
    ko: "안녕하세요, 저는 ___예요.",
    en: "Hello, I'm ___.",
    homeTitle: "Hello, I'm…",
    homeKo: "안녕하세요, 저는 ___예요."
  },
  {
    day: 16,
    ko: "저는 ___에 살아요.",
    en: "I live in ___.",
    homeTitle: "I live in…",
    homeKo: "저는 ___에 살아요."
  },
  { day: 17, ko: "K-pop을 좋아해요.", en: "I love K-pop.", homeTitle: "K-pop love", homeKo: "K-pop을 좋아해요." },
  {
    day: 18,
    ko: "한국어를 배우고 있어요.",
    en: "I'm learning Korean.",
    homeTitle: "Learning Korean",
    homeKo: "한국어를 배우고 있어요."
  },
  {
    day: 19,
    ko: "한국에 가고 싶어요.",
    en: "I want to go to Korea.",
    homeTitle: "Want to visit Korea",
    homeKo: "한국에 가고 싶어요."
  },
  {
    day: 20,
    ko: "만나서 반가워요.",
    en: "Nice to meet you.",
    homeTitle: "Nice to meet you",
    homeKo: "만나서 반가워요."
  },
  {
    day: 21,
    ko: "잘 부탁드려요.",
    en: "Please take care of me.",
    homeTitle: "Please take care of me",
    homeKo: "잘 부탁드려요."
  },
  { day: 22, ko: "감사합니다.", en: "Thank you.", homeTitle: "Thank you", homeKo: "감사합니다." },
  { day: 23, ko: "이거 주세요.", en: "Please give me this.", homeTitle: "Give me this", homeKo: "이거 주세요." },
  { day: 24, ko: "얼마예요?", en: "How much is it?", homeTitle: "How much?", homeKo: "얼마예요?" },
  {
    day: 25,
    ko: "사진 찍어도 돼요?",
    en: "Can I take a photo?",
    homeTitle: "Photo okay?",
    homeKo: "사진 찍어도 돼요?"
  },
  {
    day: 26,
    ko: "처음 왔어요.",
    en: "It's my first time here.",
    homeTitle: "First time here",
    homeKo: "처음 왔어요."
  },
  { day: 27, ko: "여기 어디예요?", en: "Where is this?", homeTitle: "Where is this?", homeKo: "여기 어디예요?" },
  { day: 28, ko: "맛있어요!", en: "It's delicious!", homeTitle: "Delicious", homeKo: "맛있어요!" },
  {
    day: 29,
    ko: "주문해도 될까요?",
    en: "Can I order?",
    homeTitle: "Can I order?",
    homeKo: "주문해도 될까요?"
  },
  { day: 30, ko: "또 올게요!", en: "I'll come back again!", homeTitle: "Come back again", homeKo: "또 올게요!" }
];

/**
 * Sliding window: previous 2 days + current + next (next may be 31 = placeholder).
 * @param {number} activeDay — next day to practice, 1…30, or 31 if finished all
 */
export function getJourneyWindowDays(activeDay) {
  if (activeDay >= JOURNEY_DONE_MARKER) {
    return [27, 28, 29, 30];
  }
  const start = Math.max(1, activeDay - 2);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const d = start + i;
    if (d <= JOURNEY_DONE_MARKER) out.push(d);
  }
  return out;
}

/** @param {number} day 1…30 */
export function getJourneyRow(day) {
  return JOURNEY_DAYS[day - 1] ?? null;
}
