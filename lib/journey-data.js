/** After finishing Day 30, localStorage holds this “all journey days done” marker. */
export const JOURNEY_DONE_MARKER = 31;
export const MAX_JOURNEY_DAY = 30;

/**
 * @typedef {{ word: string, roman: string, meaning: string }} JourneyVocabEntry
 * @typedef {{
 *   day: number,
 *   ko: string,
 *   en: string,
 *   homeTitle: string,
 *   homeKo: string,
 *   romanization?: string,
 *   vocab?: JourneyVocabEntry[],
 *   situation?: string,
 *   swapOptions?: string[],
 *   swapIndex?: number
 * }} JourneyDayRow
 */

/** @type {JourneyDayRow[]} */
export const JOURNEY_DAYS = [
  {
    day: 1,
    ko: "제 최애는 BTS예요.",
    en: "My favorite is BTS.",
    homeTitle: "My favorite",
    homeKo: "제 최애는 BTS예요.",
    romanization: "Je choe-ae-neun BTS-ye-yo.",
    vocab: [
      { word: "제", roman: "je", meaning: "my / as for me" },
      { word: "최애는", roman: "choe-ae-neun", meaning: "favorite (topic)" },
      { word: "BTS예요", roman: "BTS-ye-yo", meaning: "is BTS" }
    ],
    situation: "누가 '누구 좋아해?'라고 물었을 때 대답하는 표현이에요.",
    swapOptions: ["세븐틴", "블랙핑크", "아이유", "엑소", "NCT"],
    swapIndex: 2
  },
  {
    day: 2,
    ko: "저는 BTS를 정말 좋아해요.",
    en: "I really like BTS.",
    homeTitle: "I really like BTS",
    homeKo: "저는 BTS를 정말 좋아해요.",
    romanization: "Jeo-neun BTS-reul jeong-mal jo-a-hae-yo.",
    vocab: [
      { word: "저는", roman: "jeo-neun", meaning: "I (topic)" },
      { word: "BTS를", roman: "BTS-reul", meaning: "BTS (object)" },
      { word: "정말", roman: "jeong-mal", meaning: "really" },
      { word: "좋아해요", roman: "jo-a-hae-yo", meaning: "like / love" }
    ],
    situation: "아이돌 이야기를 할 때 자연스럽게 쓸 수 있어요.",
    swapOptions: ["세븐틴", "블랙핑크", "스트레이 키즈", "엔하이픈", "NCT"],
    swapIndex: 2
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
    ],
    situation: "마음에 든다고 말하고 싶을 때 쓰는 표현이에요.",
    swapOptions: ["정말", "진짜", "완전", "너무", "엄청"],
    swapIndex: 0
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
    ],
    situation: "귀여운 걸 볼 때 바로 쓸 수 있어요.",
    swapOptions: ["멋져요", "예뻐요", "사랑스러워요", "좋아요", "대박이에요"],
    swapIndex: 1
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
    ],
    situation: "감탄하고 싶을 때 쓰는 한마디예요.",
    swapOptions: ["대박", "최고", "짱", "굿", "완전"],
    swapIndex: 0
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
    ],
    situation: "칭찬하고 싶을 때 쓸 수 있어요.",
    swapOptions: ["멋져요", "예뻐요", "좋아요", "최고예요", "감동이에요"],
    swapIndex: 0
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

/** localStorage key for mood track: idol | drama | trip */
export const OGU_VIBE_KEY = "ogu_vibe";

/** @param {string | null | undefined} v */
export function normalizeVibe(v) {
  if (v === "drama" || v === "trip" || v === "idol") return v;
  return "idol";
}

/** Days 1–3 for drama track (shared shape with JourneyDayRow). */
const MOOD_DRAMA_DAYS_1_3 = /** @type {const} */ ([
  {
    day: 1,
    ko: "보고 싶었어요.",
    en: "I missed you.",
    homeTitle: "I missed you",
    homeKo: "보고 싶었어요.",
    romanization: "Bo-go sip-eo-sseo-yo.",
    vocab: [
      { word: "보고", roman: "bo-go", meaning: "seeing / to see" },
      { word: "싶었어요", roman: "sip-eo-sseo-yo", meaning: "missed / wanted to" }
    ],
    situation: "애틋한 대사를 연상할 때 쓰는 표현이에요.",
    swapOptions: ["만나고", "듣고", "기다리고", "응원하고", "보고"],
    swapIndex: 0
  },
  {
    day: 2,
    ko: "사랑해요.",
    en: "I love you.",
    homeTitle: "I love you",
    homeKo: "사랑해요.",
    romanization: "Sa-rang-hae-yo.",
    vocab: [{ word: "사랑해요", roman: "sa-rang-hae-yo", meaning: "I love you" }],
    situation: "감정을 표현할 때 바로 쓸 수 있어요.",
    swapOptions: ["고마워요", "미안해요", "좋아해요", "보고 싶어요", "행복해요"],
    swapIndex: 0
  },
  {
    day: 3,
    ko: "저는 한국 드라마를 좋아해요.",
    en: "I like Korean dramas.",
    homeTitle: "I like K-dramas",
    homeKo: "저는 한국 드라마를 좋아해요.",
    romanization: "Jeo-neun han-guk deu-ra-ma-reul jo-a-hae-yo.",
    vocab: [
      { word: "저는", roman: "jeo-neun", meaning: "I" },
      { word: "한국 드라마를", roman: "han-guk deu-ra-ma-reul", meaning: "Korean dramas" },
      { word: "좋아해요", roman: "jo-a-hae-yo", meaning: "like" }
    ],
    situation: "취미나 취향을 말할 때 쓸 수 있어요.",
    swapOptions: ["멜로", "로맨스", "스릴러", "코미디", "판타지"],
    swapIndex: 3
  }
]);

/** Days 1–3 for trip track. */
const MOOD_TRIP_DAYS_1_3 = /** @type {const} */ ([
  {
    day: 1,
    ko: "여기 어떻게 가요?",
    en: "How do I get there?",
    homeTitle: "How do I get there?",
    homeKo: "여기 어떻게 가요?",
    romanization: "Yeogi eo-tteoh-ke ga-yo?",
    vocab: [
      { word: "여기", roman: "yeo-gi", meaning: "here" },
      { word: "어떻게", roman: "eo-tteoh-ke", meaning: "how" },
      { word: "가요", roman: "ga-yo", meaning: "go?" }
    ],
    situation: "길을 물을 때 쓰는 표현이에요.",
    swapOptions: ["지하철역", "공항", "호텔", "카페", "화장실"],
    swapIndex: 1
  },
  {
    day: 2,
    ko: "이거 얼마예요?",
    en: "How much is this?",
    homeTitle: "How much?",
    homeKo: "이거 얼마예요?",
    romanization: "I-geo eol-ma-ye-yo?",
    vocab: [
      { word: "이거", roman: "i-geo", meaning: "this" },
      { word: "얼마예요", roman: "eol-ma-ye-yo", meaning: "how much?" }
    ],
    situation: "가격을 물을 때 쓰는 표현이에요.",
    swapOptions: ["이거", "저거", "그거", "커피", "빵"],
    swapIndex: 0
  },
  {
    day: 3,
    ko: "한국 음식이 너무 맛있어요.",
    en: "Korean food is so delicious.",
    homeTitle: "So delicious",
    homeKo: "한국 음식이 너무 맛있어요.",
    romanization: "Han-guk eum-si-gi neo-mu ma-si-sseo-yo.",
    vocab: [
      { word: "한국 음식", roman: "han-guk eum-sik", meaning: "Korean food" },
      { word: "맛있어요", roman: "ma-si-sseo-yo", meaning: "delicious" }
    ],
    situation: "음식을 칭찬할 때 쓸 수 있어요.",
    swapOptions: ["한식", "치킨", "떡볶이", "김치찌개", "삼겹살"],
    swapIndex: 2
  }
]);

/**
 * @param {number} day 1…30
 * @param {string} [vibe] idol | drama | trip — days 1–3 follow mood track; day 4+ shared.
 */
export function getJourneyRow(day, vibe = "idol") {
  const v = normalizeVibe(vibe);
  if (day >= 1 && day <= 3) {
    if (v === "drama") return /** @type {JourneyDayRow} */ (MOOD_DRAMA_DAYS_1_3[day - 1]);
    if (v === "trip") return /** @type {JourneyDayRow} */ (MOOD_TRIP_DAYS_1_3[day - 1]);
    return JOURNEY_DAYS[day - 1] ?? null;
  }
  return JOURNEY_DAYS[day - 1] ?? null;
}

/** @returns {'idol'|'drama'|'trip'} */
export function readStoredVibe() {
  if (typeof window === "undefined") return "idol";
  return normalizeVibe(window.localStorage.getItem(OGU_VIBE_KEY));
}

/**
 * @param {string} ko
 * @param {number} swapIndex word index (0-based)
 * @param {string[]} options
 * @param {number} selectedIdx
 */
export function buildSwapSentence(ko, swapIndex, options, selectedIdx) {
  const words = ko.trim().split(/\s+/);
  if (!words.length || !options?.length) return ko;
  const i = Math.min(Math.max(0, swapIndex), words.length - 1);
  const w = [...words];
  const pick = options[Math.min(Math.max(0, selectedIdx), options.length - 1)];
  if (pick) w[i] = pick;
  return w.join(" ");
}
