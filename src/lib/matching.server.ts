import { callAiJson } from "./ai.server";
import { parseJdHeuristic, parseResumeHeuristic, semanticMatchHeuristic } from "./heuristics.server";

/** True when the AI gateway key is missing — we then fall back to deterministic parsing. */
const aiUnavailable = () => !process.env["LOVABLE_API_KEY"];

/** Weighting of the deterministic keyword score vs. the LLM semantic score. */
export const KEYWORD_WEIGHT = 0.4;
export const SEMANTIC_WEIGHT = 0.6;

export interface ParsedJd {
  required_skills: string[];
  preferred_skills: string[];
  min_experience_years: number | null;
  education_requirement: string | null;
  role_summary: string | null;
  title?: string | null;
  company?: string | null;
}

export interface ParsedResume {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  education: Array<{ degree?: string; institution?: string; year?: string }>;
  experience: Array<{ role?: string; company?: string; duration?: string; description?: string }>;
  total_experience_years: number | null;
}

export interface SemanticMatch {
  matched_skills: string[];
  missing_skills: string[];
  semantic_score: number;
  rationale: string;
  strength: string;
  concern: string;
}

const asArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

const asNumber = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number.parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function parseJobDescription(rawText: string): Promise<ParsedJd> {
  if (aiUnavailable()) return parseJdHeuristic(rawText);

  const parsed = await callAiJson<Record<string, unknown>>(
    `You are an expert technical recruiter. Extract structured requirements from a job description.
Schema: { "title": string|null, "company": string|null, "role_summary": string (2 sentences), "required_skills": string[], "preferred_skills": string[], "min_experience_years": number|null, "education_requirement": string|null }
Use concise canonical skill names (e.g. "React", "PostgreSQL", "Leadership"). Max 15 required and 15 preferred skills.`,
    `JOB DESCRIPTION:\n${rawText.slice(0, 16000)}`,
  );

  return {
    title: typeof parsed["title"] === "string" ? (parsed["title"] as string) : null,
    company: typeof parsed["company"] === "string" ? (parsed["company"] as string) : null,
    role_summary: typeof parsed["role_summary"] === "string" ? (parsed["role_summary"] as string) : null,
    required_skills: asArray(parsed["required_skills"]),
    preferred_skills: asArray(parsed["preferred_skills"]),
    min_experience_years: asNumber(parsed["min_experience_years"]),
    education_requirement:
      typeof parsed["education_requirement"] === "string" ? (parsed["education_requirement"] as string) : null,
  };
}

export async function parseResume(rawText: string): Promise<ParsedResume> {
  if (aiUnavailable()) return parseResumeHeuristic(rawText);

  const parsed = await callAiJson<Record<string, unknown>>(
    `You are a resume parser. Extract structured candidate data from resume text.
Schema: { "full_name": string|null, "email": string|null, "phone": string|null, "skills": string[], "education": [{"degree": string, "institution": string, "year": string}], "experience": [{"role": string, "company": string, "duration": string, "description": string}], "total_experience_years": number|null }
Infer total_experience_years from the work history when it is not stated. Never invent facts; use null when unknown.`,
    `RESUME:\n${rawText.slice(0, 20000)}`,
  );

  const education = Array.isArray(parsed["education"])
    ? (parsed["education"] as ParsedResume["education"]).filter((e) => e && typeof e === "object")
    : [];
  const experience = Array.isArray(parsed["experience"])
    ? (parsed["experience"] as ParsedResume["experience"]).filter((e) => e && typeof e === "object")
    : [];

  return {
    full_name: typeof parsed["full_name"] === "string" ? (parsed["full_name"] as string) : null,
    email: typeof parsed["email"] === "string" ? (parsed["email"] as string) : null,
    phone: typeof parsed["phone"] === "string" ? (parsed["phone"] as string) : null,
    skills: asArray(parsed["skills"]),
    education,
    experience,
    total_experience_years: asNumber(parsed["total_experience_years"]),
  };
}

const canonical = (skill: string): string =>
  skill
    .toLowerCase()
    .replace(/[.\-_/]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(js|javascript)\b/g, "javascript")
    .trim();

/** Deterministic overlap score: matched required skills / total required skills. */
export function keywordScore(
  requiredSkills: string[],
  candidateSkills: string[],
  resumeText: string,
): { score: number; matched: string[]; missing: string[] } {
  if (requiredSkills.length === 0) return { score: 0, matched: [], missing: [] };

  const haystack = canonical(`${candidateSkills.join(" ")} ${resumeText}`);
  const candidateSet = new Set(candidateSkills.map(canonical));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of requiredSkills) {
    const key = canonical(skill);
    const hit = candidateSet.has(key) || (key.length > 2 && haystack.includes(key));
    if (hit) matched.push(skill);
    else missing.push(skill);
  }

  return {
    score: Math.round((matched.length / requiredSkills.length) * 100),
    matched,
    missing,
  };
}

export async function semanticMatch(jd: ParsedJd, resume: ParsedResume, resumeText: string): Promise<SemanticMatch> {
  const parsed = await callAiJson<Record<string, unknown>>(
    `You are an impartial hiring analyst. Compare a candidate to a job's requirements.
Judge only skills, experience and education. Ignore name, gender, age, nationality, photos and schools' prestige.
Schema: { "matched_skills": string[], "missing_skills": string[], "semantic_score": number (0-100), "rationale": string (2-3 sentences), "strength": string (1 sentence), "concern": string (1 sentence) }
Count close synonyms and equivalents as matches (e.g. "React" ~ "React.js", "led a team" ~ "Leadership").`,
    `JOB REQUIREMENTS:\n${JSON.stringify({
      role_summary: jd.role_summary,
      required_skills: jd.required_skills,
      preferred_skills: jd.preferred_skills,
      min_experience_years: jd.min_experience_years,
      education_requirement: jd.education_requirement,
    })}

CANDIDATE:\n${JSON.stringify({
      skills: resume.skills,
      education: resume.education,
      experience: resume.experience,
      total_experience_years: resume.total_experience_years,
    })}

RESUME EXCERPT:\n${resumeText.slice(0, 6000)}`,
  );

  const rawScore = asNumber(parsed["semantic_score"]) ?? 0;
  return {
    matched_skills: asArray(parsed["matched_skills"]),
    missing_skills: asArray(parsed["missing_skills"]),
    semantic_score: Math.max(0, Math.min(100, Math.round(rawScore))),
    rationale: typeof parsed["rationale"] === "string" ? (parsed["rationale"] as string) : "",
    strength: typeof parsed["strength"] === "string" ? (parsed["strength"] as string) : "",
    concern: typeof parsed["concern"] === "string" ? (parsed["concern"] as string) : "",
  };
}

export function overallScore(keyword: number, semantic: number): number {
  return Math.round(KEYWORD_WEIGHT * keyword + SEMANTIC_WEIGHT * semantic);
}
