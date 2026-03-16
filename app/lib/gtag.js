export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const pageview = (url) => {
  if (typeof window === "undefined") return;
  if (!GA_ID) return;
  if (!window.gtag) return;
  window.gtag("config", GA_ID, {
    page_path: url
  });
};

export const event = (action, params = {}) => {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", action, params);
};

// Convenience tracking helpers
export const trackAppOpen = () => event("app_open");
export const trackStartDailyPhrase = () => event("start_daily_phrase");
export const trackStartMission = (missionId) =>
  event("start_mission", { mission_id: missionId });
export const trackMissionComplete = (missionId) =>
  event("mission_complete", { mission_id: missionId });
export const trackStartFreeChat = () => event("start_free_chat");
export const trackSavePhrase = () => event("save_phrase");
export const trackShareCard = () => event("share_card");
export const trackReachDailyLimit = () => event("reach_daily_limit");
export const trackChallengeStart = (day) =>
  event("start_challenge_day", { day });
export const trackChallengeComplete = (day) =>
  event("complete_challenge_day", { day });
export const trackUseHint = () => event("use_hint");
export const trackSendVoice = () => event("send_voice_message");


