import { normalizeLang } from "../../app/lib/i18n";

/**
 * Fetch AI-generated MAIN + FOLLOW lines for the practice flow (merged with greeting/closing templates on the client).
 * @param {{ id?: string }} scenario
 */
export async function generateScript(scenario) {
  const raw =
    typeof window !== "undefined"
      ? localStorage.getItem("ogu_lang") || "en"
      : "en";
  const lang = normalizeLang(raw);
  const scenarioId = scenario?.id ?? "compliment";

  const res = await fetch("/api/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId, lang }),
  });

  if (!res.ok) throw new Error("API error");
  const data = await res.json();

  if (!data?.line2 || !data?.line3) {
    throw new Error("Invalid generate-script payload");
  }
  return data;
}
