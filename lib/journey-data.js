/** After finishing Day 30, localStorage holds this “all journey days done” marker. */
export const JOURNEY_DONE_MARKER = 31;
export const MAX_JOURNEY_DAY = 30;

/**
 * @typedef {{ word: string, roman: string, meaning: string }} JourneyVocabEntry
 * @typedef {{ en: string, id: string, fr: string, pt: string }} SituationI18n
 * @typedef {{ korean: string, meaning: string }} SwapOptionEntry
 * @typedef {{
 *   day: number,
 *   ko: string,
 *   en: string,
 *   homeTitle: string,
 *   homeKo: string,
 *   romanization?: string,
 *   vocab?: JourneyVocabEntry[],
 *   situation?: string | SituationI18n,
 *   swapOptions?: (string | SwapOptionEntry)[],
 *   swapIndex?: number,
 *   swapTemplate?: string
 * }} JourneyDayRow
 */

/** @param {string} korean @param {string} meaning */
export function sw(korean, meaning) {
  return { korean, meaning };
}

/**
 * @param {unknown} situation
 * @param {import("@/app/lib/i18n").UILang} lang
 */
export function resolveSituation(situation, lang) {
  if (situation == null || situation === "") return "";
  if (typeof situation === "string") return situation;
  const o = /** @type {Record<string, string>} */ (situation);
  return o[lang] ?? o.en ?? "";
}

/** @param {unknown} opt */
export function swapOptionKorean(opt) {
  if (opt == null) return "";
  if (typeof opt === "string") return opt;
  return /** @type {{ korean?: string }} */ (opt).korean ?? "";
}

/** @param {unknown[]|undefined} opts @returns {SwapOptionEntry[]} */
export function normalizeSwapOptionsList(opts) {
  if (!Array.isArray(opts)) return [];
  return opts.map((o) =>
    typeof o === "string" ? { korean: o, meaning: "" } : { korean: o.korean ?? "", meaning: o.meaning ?? "" }
  );
}

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
    situation: {
      en: "Use when someone asks who you like.",
      id: "Gunakan saat ada yang bertanya siapa yang kamu suka.",
      fr: "À utiliser quand on te demande qui tu aimes.",
      pt: "Use quando alguém perguntar quem você gosta."
    },
    swapOptions: [
      sw("세븐틴", "Seventeen"),
      sw("블랙핑크", "Blackpink"),
      sw("아이유", "IU"),
      sw("엑소", "EXO"),
      sw("NCT", "NCT")
    ],
    swapIndex: 2,
    swapTemplate: "제 최애는 ___예요."
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
    situation: {
      en: "Use when you talk naturally about idols or favorites.",
      id: "Gunakan saat berbicara tentang idola atau favorit.",
      fr: "À utiliser quand tu parles d’idoles ou de favoris.",
      pt: "Use ao falar de ídolos ou favoritos."
    },
    swapOptions: [
      sw("세븐틴", "Seventeen"),
      sw("블랙핑크", "Blackpink"),
      sw("스트레이 키즈", "Stray Kids"),
      sw("엔하이픈", "Enhypen"),
      sw("NCT", "NCT")
    ],
    swapIndex: 2,
    swapTemplate: "저는 ___를 정말 좋아해요."
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
    ],
    situation: {
      en: "Use when someone asks what you’re studying or learning.",
      id: "Gunakan saat ditanya sedang belajar apa.",
      fr: "À utiliser quand on vous demande ce que vous apprenez.",
      pt: "Use quando perguntarem o que você está aprendendo."
    }
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
    situation: {
      en: "Use when you want to say you really like something.",
      id: "Gunakan saat ingin bilang kamu sangat menyukai sesuatu.",
      fr: "À utiliser pour dire que tu aimes vraiment quelque chose.",
      pt: "Use quando quiser dizer que gosta muito de algo."
    },
    swapOptions: [
      sw("정말", "really"),
      sw("진짜", "really"),
      sw("완전", "totally"),
      sw("너무", "so"),
      sw("엄청", "super")
    ],
    swapIndex: 0,
    swapTemplate: "___ 좋아해요."
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
    situation: {
      en: "Use when you see something cute.",
      id: "Gunakan saat melihat sesuatu yang lucu.",
      fr: "À utiliser quand tu vois quelque chose de mignon.",
      pt: "Use quando vir algo fofo."
    },
    swapOptions: [
      sw("멋져요", "cool"),
      sw("예뻐요", "pretty"),
      sw("사랑스러워요", "lovely"),
      sw("좋아요", "nice"),
      sw("대박이에요", "awesome")
    ],
    swapIndex: 1,
    swapTemplate: "너무 ___"
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
    situation: {
      en: "Use when you want to react with excitement or praise.",
      id: "Gunakan saat ingin bereaksi dengan antusias atau pujian.",
      fr: "À utiliser pour réagir avec enthousiasme ou admiration.",
      pt: "Use quando quiser reagir com entusiasmo ou elogio."
    },
    swapOptions: [
      sw("대박", "awesome"),
      sw("최고", "the best"),
      sw("짱", "best"),
      sw("굿", "good"),
      sw("완전", "totally")
    ],
    swapIndex: 0,
    swapTemplate: "___!"
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
    situation: {
      en: "Use when you want to give a compliment.",
      id: "Gunakan saat ingin memuji.",
      fr: "À utiliser pour faire un compliment.",
      pt: "Use quando quiser elogiar."
    },
    swapOptions: [
      sw("멋져요", "cool"),
      sw("예뻐요", "pretty"),
      sw("좋아요", "good"),
      sw("최고예요", "the best"),
      sw("감동이에요", "moving")
    ],
    swapIndex: 0,
    swapTemplate: "정말 ___"
  },
  {
    day: 8,
    ko: "진짜요?",
    en: "Really?",
    homeTitle: "Really?",
    homeKo: "진짜요?",
    situation: {
      en: "Use when you’re surprised or want to double-check what you heard.",
      id: "Gunakan saat terkejut atau ingin memastikan.",
      fr: "À utiliser quand vous êtes surpris ou voulez vérifier.",
      pt: "Use quando estiver surpreso ou quiser confirmar."
    }
  },
  {
    day: 9,
    ko: "너무 좋아요.",
    en: "I love it so much.",
    homeTitle: "Love it so much",
    homeKo: "너무 좋아요.",
    situation: {
      en: "Use when you really like something and want to say so.",
      id: "Gunakan saat sangat menyukai sesuatu.",
      fr: "À utiliser quand vous aimez vraiment quelque chose.",
      pt: "Use quando gostar muito de algo."
    }
  },
  {
    day: 10,
    ko: "보고 싶어요.",
    en: "I miss you.",
    homeTitle: "I miss you",
    homeKo: "보고 싶어요.",
    situation: {
      en: "Use when you miss someone and want to say it gently.",
      id: "Gunakan saat merindukan seseorang.",
      fr: "À utiliser quand vous manquez à quelqu’un.",
      pt: "Use quando sentir falta de alguém."
    }
  },
  {
    day: 11,
    ko: "최고예요!",
    en: "You're the best!",
    homeTitle: "You're the best",
    homeKo: "최고예요!",
    situation: {
      en: "Use to cheer someone on or praise them highly.",
      id: "Gunakan untuk mendukung atau memuji.",
      fr: "À utiliser pour encourager ou féliciter.",
      pt: "Use para torcer ou elogiar alguém."
    }
  },
  {
    day: 12,
    ko: "감동이에요.",
    en: "I'm so moved.",
    homeTitle: "So moved",
    homeKo: "감동이에요.",
    situation: {
      en: "Use when something touches your heart.",
      id: "Gunakan saat sesuatu sangat menyentuh hati.",
      fr: "À utiliser quand quelque chose vous émeut.",
      pt: "Use quando algo tocar o coração."
    }
  },
  {
    day: 13,
    ko: "행복해요.",
    en: "I'm so happy.",
    homeTitle: "Happy",
    homeKo: "행복해요.",
    situation: {
      en: "Use when you feel happy and want to share it.",
      id: "Gunakan saat merasa bahagia.",
      fr: "À utiliser quand vous vous sentez heureux.",
      pt: "Use quando se sentir feliz."
    }
  },
  {
    day: 14,
    ko: "응원해요!",
    en: "I'm cheering for you!",
    homeTitle: "Cheering for you",
    homeKo: "응원해요!",
    situation: {
      en: "Use to support someone before a test, show, or challenge.",
      id: "Gunakan untuk mendukung seseorang.",
      fr: "À utiliser pour soutenir quelqu’un.",
      pt: "Use para torcer por alguém."
    }
  },
  {
    day: 15,
    ko: "안녕하세요, 저는 ___예요.",
    en: "Hello, I'm ___.",
    homeTitle: "Hello, I'm…",
    homeKo: "안녕하세요, 저는 ___예요.",
    situation: {
      en: "Use when introducing yourself politely.",
      id: "Gunakan saat memperkenalkan diri dengan sopan.",
      fr: "À utiliser pour vous présenter poliment.",
      pt: "Use ao se apresentar com educação."
    }
  },
  {
    day: 16,
    ko: "저는 ___에 살아요.",
    en: "I live in ___.",
    homeTitle: "I live in…",
    homeKo: "저는 ___에 살아요.",
    situation: {
      en: "Use when saying where you live.",
      id: "Gunakan saat menyebutkan tempat tinggal.",
      fr: "À utiliser pour dire où vous vivez.",
      pt: "Use ao dizer onde mora."
    }
  },
  {
    day: 17,
    ko: "K-pop을 좋아해요.",
    en: "I love K-pop.",
    homeTitle: "K-pop love",
    homeKo: "K-pop을 좋아해요.",
    situation: {
      en: "Use when talking about your taste in music.",
      id: "Gunakan saat membicarakan selera musik.",
      fr: "À utiliser pour parler de vos goûts musicaux.",
      pt: "Use ao falar de gosto musical."
    }
  },
  {
    day: 18,
    ko: "한국어를 배우고 있어요.",
    en: "I'm learning Korean.",
    homeTitle: "Learning Korean",
    homeKo: "한국어를 배우고 있어요.",
    situation: {
      en: "Use when someone asks about your studies.",
      id: "Gunakan saat ditanya tentang belajar bahasa Korea.",
      fr: "À utiliser quand on vous parle de vos études.",
      pt: "Use quando perguntarem sobre seus estudos."
    }
  },
  {
    day: 19,
    ko: "한국에 가고 싶어요.",
    en: "I want to go to Korea.",
    homeTitle: "Want to visit Korea",
    homeKo: "한국에 가고 싶어요.",
    situation: {
      en: "Use when sharing travel dreams or plans.",
      id: "Gunakan saat berbicara tentang rencana wisata.",
      fr: "À utiliser pour parler de vos envies de voyage.",
      pt: "Use ao falar de sonhos ou planos de viagem."
    }
  },
  {
    day: 20,
    ko: "만나서 반가워요.",
    en: "Nice to meet you.",
    homeTitle: "Nice to meet you",
    homeKo: "만나서 반가워요.",
    situation: {
      en: "Use when you meet someone for the first time.",
      id: "Gunakan saat pertama kali bertemu.",
      fr: "À utiliser lors d’une première rencontre.",
      pt: "Use ao conhecer alguém pela primeira vez."
    }
  },
  {
    day: 21,
    ko: "잘 부탁드려요.",
    en: "Please take care of me.",
    homeTitle: "Please take care of me",
    homeKo: "잘 부탁드려요.",
    situation: {
      en: "Use in new teams, classes, or workplaces to sound polite.",
      id: "Gunakan di lingkungan baru dengan sopan.",
      fr: "À utiliser poliment dans un nouveau groupe.",
      pt: "Use com educação em equipes ou lugares novos."
    }
  },
  {
    day: 22,
    ko: "감사합니다.",
    en: "Thank you.",
    homeTitle: "Thank you",
    homeKo: "감사합니다.",
    situation: {
      en: "Use to thank someone in a neutral, polite way.",
      id: "Gunakan untuk berterima kasih dengan sopan.",
      fr: "À utiliser pour remercier poliment.",
      pt: "Use para agradecer com educação."
    }
  },
  {
    day: 23,
    ko: "이거 주세요.",
    en: "Please give me this.",
    homeTitle: "Give me this",
    homeKo: "이거 주세요.",
    situation: {
      en: "Use when ordering or pointing at what you want.",
      id: "Gunakan saat memesan atau menunjuk barang.",
      fr: "À utiliser pour commander ou désigner un article.",
      pt: "Use ao pedir ou apontar o que quer."
    }
  },
  {
    day: 24,
    ko: "얼마예요?",
    en: "How much is it?",
    homeTitle: "How much?",
    homeKo: "얼마예요?",
    situation: {
      en: "Use when asking the price before paying.",
      id: "Gunakan saat bertanya harga sebelum membayar.",
      fr: "À utiliser pour demander le prix avant de payer.",
      pt: "Use ao perguntar o preço antes de pagar."
    }
  },
  {
    day: 25,
    ko: "사진 찍어도 돼요?",
    en: "Can I take a photo?",
    homeTitle: "Photo okay?",
    homeKo: "사진 찍어도 돼요?",
    situation: {
      en: "Use when asking permission to take pictures.",
      id: "Gunakan saat meminta izin memotret.",
      fr: "À utiliser pour demander la permission de photographier.",
      pt: "Use ao pedir permissão para fotografar."
    }
  },
  {
    day: 26,
    ko: "처음 왔어요.",
    en: "It's my first time here.",
    homeTitle: "First time here",
    homeKo: "처음 왔어요.",
    situation: {
      en: "Use when visiting a place for the first time.",
      id: "Gunakan saat pertama kali ke suatu tempat.",
      fr: "À utiliser lors d’une première visite.",
      pt: "Use na primeira vez em um lugar."
    }
  },
  {
    day: 27,
    ko: "여기 어디예요?",
    en: "Where is this?",
    homeTitle: "Where is this?",
    homeKo: "여기 어디예요?",
    situation: {
      en: "Use when you’re lost and need to know where you are.",
      id: "Gunakan saat tersesat dan perlu tahu lokasi.",
      fr: "À utiliser quand vous êtes perdu.",
      pt: "Use quando estiver perdido e quiser saber onde está."
    }
  },
  {
    day: 28,
    ko: "맛있어요!",
    en: "It's delicious!",
    homeTitle: "Delicious",
    homeKo: "맛있어요!",
    situation: {
      en: "Use to compliment food or drinks.",
      id: "Gunakan untuk memuji makanan atau minuman.",
      fr: "À utiliser pour complimenter un plat ou une boisson.",
      pt: "Use para elogiar comida ou bebida."
    }
  },
  {
    day: 29,
    ko: "주문해도 될까요?",
    en: "Can I order?",
    homeTitle: "Can I order?",
    homeKo: "주문해도 될까요?",
    situation: {
      en: "Use politely to start ordering at a café or restaurant.",
      id: "Gunakan dengan sopan sebelum memesan.",
      fr: "À utiliser poliment pour commencer à commander.",
      pt: "Use com educação para começar a pedir."
    }
  },
  {
    day: 30,
    ko: "또 올게요!",
    en: "I'll come back again!",
    homeTitle: "Come back again",
    homeKo: "또 올게요!",
    situation: {
      en: "Use when leaving and you plan to return.",
      id: "Gunakan saat berpamitan dan akan kembali.",
      fr: "À utiliser en partant si vous comptez revenir.",
      pt: "Use ao sair quando for voltar outra vez."
    }
  }
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
    situation: {
      en: "Use this when you miss someone and want to express longing.",
      id: "Gunakan ini saat kamu merindukan seseorang.",
      fr: "Utilisez ceci quand vous manquez à quelqu'un.",
      pt: "Use isso quando sentir saudade de alguém."
    },
    swapOptions: [
      sw("만나고", "meet"),
      sw("듣고", "hear"),
      sw("기다리고", "wait"),
      sw("응원하고", "cheer"),
      sw("보고", "see")
    ],
    swapIndex: 0,
    swapTemplate: "___ 싶었어요."
  },
  {
    day: 2,
    ko: "사랑해요.",
    en: "I love you.",
    homeTitle: "I love you",
    homeKo: "사랑해요.",
    romanization: "Sa-rang-hae-yo.",
    vocab: [{ word: "사랑해요", roman: "sa-rang-hae-yo", meaning: "I love you" }],
    situation: {
      en: "Use when you want to express your feelings.",
      id: "Gunakan saat ingin mengekspresikan perasaan.",
      fr: "À utiliser pour exprimer tes sentiments.",
      pt: "Use quando quiser expressar seus sentimentos."
    },
    swapOptions: [
      sw("고마워요", "thank you"),
      sw("미안해요", "sorry"),
      sw("좋아해요", "I like you"),
      sw("보고 싶어요", "I miss you"),
      sw("행복해요", "happy")
    ],
    swapIndex: 0,
    swapTemplate: "___"
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
    situation: {
      en: "Use when you talk about hobbies or tastes.",
      id: "Gunakan saat membicarakan hobi atau selera.",
      fr: "À utiliser pour parler de loisirs ou de goûts.",
      pt: "Use quando falar de hobbies ou gostos."
    },
    swapOptions: [
      sw("멜로", "melo"),
      sw("로맨스", "romance"),
      sw("스릴러", "thriller"),
      sw("코미디", "comedy"),
      sw("판타지", "fantasy")
    ],
    swapIndex: 3,
    swapTemplate: "저는 한국 ___를 좋아해요."
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
    situation: {
      en: "Use when asking for directions.",
      id: "Gunakan saat bertanya arah.",
      fr: "À utiliser pour demander votre chemin.",
      pt: "Use ao pedir direções."
    },
    swapOptions: [
      sw("지하철역", "subway station"),
      sw("공항", "airport"),
      sw("호텔", "hotel"),
      sw("카페", "café"),
      sw("화장실", "restroom")
    ],
    swapIndex: 1,
    swapTemplate: "여기 ___ 가요?"
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
    situation: {
      en: "Use when asking how much something costs.",
      id: "Gunakan saat bertanya berapa harga sesuatu.",
      fr: "À utiliser pour demander le prix de quelque chose.",
      pt: "Use ao perguntar quanto custa algo."
    },
    swapOptions: [
      sw("얼마", "how much"),
      sw("뭐", "what"),
      sw("어디", "where"),
      sw("언제", "when")
    ],
    swapIndex: 0,
    swapTemplate: "이거 ___예요?"
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
    situation: {
      en: "Use when praising food.",
      id: "Gunakan saat memuji makanan.",
      fr: "À utiliser pour complimenter un plat.",
      pt: "Use ao elogiar comida."
    },
    swapOptions: [
      sw("한식", "Korean food"),
      sw("치킨", "chicken"),
      sw("떡볶이", "tteokbokki"),
      sw("김치찌개", "kimchi stew"),
      sw("삼겹살", "pork belly")
    ],
    swapIndex: 2,
    swapTemplate: "한국 ___이 너무 맛있어요."
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
  const raw = options[Math.min(Math.max(0, selectedIdx), options.length - 1)];
  const pick = swapOptionKorean(raw);
  if (pick) w[i] = pick;
  return w.join(" ");
}

/** @param {string} template e.g. "여기 ___ 가요?" */
export function buildSentenceFromTemplate(template, word) {
  if (!template || word == null || word === "") return "";
  return String(template).replace(/___+/g, String(word));
}
