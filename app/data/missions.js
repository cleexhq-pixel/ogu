export const MISSIONS = [
  {
    id: "cafe-order",
    title: { ko: "카페에서 주문하기", en: "Order at a café", id: "Memesan di kafe" },
    category: "daily",
    level: "beginner",
    persona: "cafe",
    steps: { ko: ["인사하기", "음료 주문하기", "계산하기"], en: ["Greeting", "Order a drink", "Pay"], id: ["Menyapa", "Pesan minuman", "Bayar"] },
    prompt:
      "You are a friendly café worker named Jieun. Guide the user through ordering a drink in Korean. Keep each response to 1-2 sentences. Encourage warmly after every attempt.",
    completion: {
      ko: "카페 주문 완료! 정말 자연스러웠어요 🐥",
      en: "Café order complete! That was so natural 🐥",
      id: "Pesanan kafe selesai! Sangat alami 🐥"
    }
  },
  {
    id: "self-intro",
    title: { ko: "자기소개하기", en: "Introduce yourself", id: "Memperkenalkan diri" },
    category: "daily",
    level: "beginner",
    persona: "free",
    steps: { ko: ["이름 말하기", "나라/직업 소개", "취미 말하기"], en: ["Say your name", "Country/job", "Hobbies"], id: ["Nama", "Negara/pekerjaan", "Hobi"] },
    prompt:
      "Help the user practice self-introduction in Korean. Be warm and ask follow-up questions naturally. Keep responses short and encouraging.",
    completion: {
      ko: "자기소개 완료! 멋진 소개였어요 🐥",
      en: "Intro complete! Great introduction 🐥",
      id: "Perkenalan selesai! Luar biasa 🐥"
    }
  },
  {
    id: "greeting-friend",
    title: { ko: "친구에게 안부 묻기", en: "Catch up with a friend", id: "Menanyakan kabar teman" },
    category: "daily",
    level: "beginner",
    persona: "free",
    steps: { ko: ["안녕 인사", "요즘 어때 묻기", "약속 잡기"], en: ["Say hi", "Ask how they are", "Make plans"], id: ["Sapa", "Tanya kabar", "Buat janji"] },
    prompt:
      "You are a Korean friend catching up. Have a warm casual conversation. Use informal speech. Keep it fun and short.",
    completion: {
      ko: "친구와 대화 완료! 진짜 친구 같았어요 🐥",
      en: "Friend chat done! You sounded like a real friend 🐥",
      id: "Obrolan selesai! Seperti teman sejati 🐥"
    }
  },
  {
    id: "office-polite",
    title: { ko: "직장에서 정중하게 말하기", en: "Speak politely at work", id: "Berbicara sopan di tempat kerja" },
    category: "work",
    level: "elementary",
    persona: "office",
    steps: { ko: ["정중한 인사", "업무 요청하기", "감사 표현"], en: ["Polite greeting", "Request a task", "Express thanks"], id: ["Salam sopan", "Minta tugas", "Ucapkan terima kasih"] },
    prompt:
      "You are a senior Korean colleague named Minjun. Guide the user in formal workplace Korean. Be patient and professional. Keep responses brief.",
    completion: {
      ko: "직장 대화 완료! 매우 프로답게 말했어요 🐥",
      en: "Work talk done! Very professional 🐥",
      id: "Percakapan kerja selesai! Sangat profesional 🐥"
    }
  },
  {
    id: "emotion-express",
    title: { ko: "감정 표현하기", en: "Express your feelings", id: "Mengungkapkan perasaan" },
    category: "daily",
    level: "beginner",
    persona: "free",
    steps: { ko: ["오늘 기분 말하기", "이유 설명하기", "위로 주고받기"], en: ["Say your mood", "Explain why", "Give comfort"], id: ["Cerita perasaan", "Jelaskan alasan", "Beri semangat"] },
    prompt:
      "Have a warm emotional conversation in Korean. Help the user express feelings naturally. Be supportive and empathetic. Keep responses short.",
    completion: {
      ko: "감정 표현 완료! 마음이 따뜻해지는 대화였어요 🐥",
      en: "Feelings shared! That was a heartwarming chat 🐥",
      id: "Perasaan terungkap! Percakapan yang menghangatkan hati 🐥"
    }
  },
  {
    id: "schedule-talk",
    title: { ko: "오늘 일정 말하기", en: "Talk about today's schedule", id: "Membicarakan jadwal hari ini" },
    category: "daily",
    level: "elementary",
    persona: "free",
    steps: { ko: ["아침 일정", "오후 계획", "저녁 약속"], en: ["Morning plan", "Afternoon plan", "Evening plans"], id: ["Rencana pagi", "Rencana siang", "Rencana malam"] },
    prompt:
      "Chat casually about daily schedules in Korean. Ask and answer questions about the user's day. Keep it light and encouraging.",
    completion: {
      ko: "일정 대화 완료! 일상 표현을 잘 썼어요 🐥",
      en: "Schedule chat done! Great use of daily expressions 🐥",
      id: "Obrolan jadwal selesai! Ekspresi sehari-hari bagus 🐥"
    }
  },
  {
    id: "drama-scene",
    title: { ko: "드라마 속 한 장면", en: "A K-drama scene", id: "Adegan K-drama" },
    category: "drama",
    level: "intermediate",
    persona: "drama",
    steps: { ko: ["극적인 만남", "감정 표현", "마무리 대사"], en: ["Dramatic meeting", "Express emotion", "Closing line"], id: ["Pertemuan dramatis", "Ungkapkan emosi", "Kalimat penutup"] },
    prompt:
      "Act out a short K-drama style scene in Korean. Be dramatic but warm. Guide the user through emotional Korean expressions. Keep it fun.",
    completion: {
      ko: "드라마 장면 완료! 완전 배우 같았어요 🐥",
      en: "Drama scene complete! You were like a real actor 🐥",
      id: "Adegan drama selesai! Seperti aktor sungguhan 🐥"
    }
  }
];

export const CHALLENGE_DAYS = [
  { day: 1, mission_id: "greeting-friend", title: { ko: "인사하기", en: "Greetings", id: "Menyapa" } },
  { day: 2, mission_id: "self-intro", title: { ko: "자기소개", en: "Self-introduction", id: "Perkenalan diri" } },
  { day: 3, mission_id: "cafe-order", title: { ko: "카페 주문", en: "Café order", id: "Pesan di kafe" } },
  { day: 4, mission_id: "emotion-express", title: { ko: "감정 표현", en: "Express feelings", id: "Ungkapkan perasaan" } },
  { day: 5, mission_id: "schedule-talk", title: { ko: "오늘 일정", en: "Today's schedule", id: "Jadwal hari ini" } },
  { day: 6, mission_id: "office-polite", title: { ko: "직장 대화", en: "Work talk", id: "Percakapan kerja" } },
  { day: 7, mission_id: "drama-scene", title: { ko: "드라마 대화", en: "Drama talk", id: "Percakapan drama" } }
];

