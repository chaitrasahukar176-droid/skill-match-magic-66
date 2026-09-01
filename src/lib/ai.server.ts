const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const AI_MODEL = "google/gemini-3.6-flash";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function friendly(status: number, message: string): string {
  if (status === 402) return message || "AI credits are exhausted. Add credits in Lovable to continue.";
  if (status === 403) return message || "Lovable AI is disabled or blocked by workspace policy.";
  if (status === 429) return "The AI service is rate limited right now. Please try again in a moment.";
  if (status >= 500) return "The AI service is temporarily unavailable. Please retry.";
  return message || `AI request failed (${status})`;
}

/** Calls the Lovable AI Gateway and returns the raw assistant text. */
export async function callAi(system: string, user: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError(401, "LOVABLE_API_KEY is not configured on the server.");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message ?? parsed.message ?? body;
    } catch {
      /* keep raw body */
    }
    console.error(`[ai] gateway failed [${res.status}]: ${body}`);
    throw new AiError(res.status, friendly(res.status, message));
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Calls the AI and parses a strict JSON object out of the response. */
export async function callAiJson<T>(system: string, user: string): Promise<T> {
  const raw = await callAi(`${system}\n\nRespond with a single valid JSON object and nothing else.`, user);
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    console.error("[ai] unparseable JSON response:", raw.slice(0, 500));
    throw new AiError(422, "The AI response could not be parsed — needs manual review.");
  }
}
