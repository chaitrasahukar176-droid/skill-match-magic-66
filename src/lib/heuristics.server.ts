// Deterministic, no-AI fallbacks used when the AI service is unavailable
// (e.g. LOVABLE_API_KEY not configured on a self-hosted deploy).
import type { ParsedJd, ParsedResume, SemanticMatch } from "./matching.server";

const SKILL_DICTIONARY = [
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Svelte", "Node.js", "Express",
  "NestJS", "Python", "Django", "Flask", "FastAPI", "Java", "Spring Boot", "Kotlin", "Swift", "Go",
  "Rust", "C++", "C#", ".NET", "PHP", "Laravel", "Ruby", "Rails", "GraphQL", "REST API", "SQL",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Supabase", "Firebase", "Elasticsearch", "Kafka",
  "RabbitMQ", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Terraform", "CI/CD", "Jenkins",
  "GitHub Actions", "Git", "Linux", "HTML", "CSS", "Tailwind CSS", "SASS", "Redux", "Jest",
  "Cypress", "Playwright", "Testing", "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch",
  "NLP", "Pandas", "NumPy", "Excel", "Power BI", "Tableau", "Looker", "dbt", "Airflow", "Spark",
  "Hadoop", "Snowflake", "BigQuery", "R", "Statistics", "A/B Testing", "Data Visualization",
  "Figma", "Accessibility", "Agile", "Scrum", "Leadership", "Mentoring", "Communication",
  "Project Management", "Stakeholder Management", "Problem Solving",
];

function findSkills(text: string, limit = 15): string[] {
  const haystack = text.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_DICTIONARY) {
    if (haystack.includes(skill.toLowerCase())) found.push(skill);
    if (found.length >= limit) break;
  }
  return found;
}

function firstSentences(text: string, count = 2): string {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, count).join(" ").slice(0, 400) || null as unknown as string;
}

export function parseJdHeuristic(rawText: string): ParsedJd {
  const years = rawText.match(/(\d+)\s*\+?\s*(?:years|yrs)/i);
  const education = rawText.match(/\b(bachelor[^.\n]{0,60}|master[^.\n]{0,60}|b\.?tech[^.\n]{0,40}|degree in [^.\n]{0,40})/i);
  const all = findSkills(rawText, 24);
  return {
    title: null,
    company: null,
    role_summary: firstSentences(rawText) || null,
    required_skills: all.slice(0, 12),
    preferred_skills: all.slice(12, 24),
    min_experience_years: years?.[1] ? Number(years[1]) : null,
    education_requirement: education?.[1]?.trim() ?? null,
  };
}

export function parseResumeHeuristic(rawText: string): ParsedResume {
  const email = rawText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phone = rawText.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  const years = rawText.match(/(\d+)\s*\+?\s*(?:years|yrs)/i);
  const nameLine = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 2 && l.length < 60 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(l));

  return {
    full_name: nameLine ?? null,
    email: email?.[0] ?? null,
    phone: phone?.[0]?.trim() ?? null,
    skills: findSkills(rawText, 30),
    education: [],
    experience: [],
    total_experience_years: years?.[1] ? Number(years[1]) : null,
  };
}

export function semanticMatchHeuristic(
  jd: ParsedJd,
  resume: ParsedResume,
  keyword: { score: number; matched: string[]; missing: string[] },
): SemanticMatch {
  const preferredHit = jd.preferred_skills.filter((s) =>
    resume.skills.some((r) => r.toLowerCase() === s.toLowerCase()),
  );
  const preferredBonus = jd.preferred_skills.length
    ? Math.round((preferredHit.length / jd.preferred_skills.length) * 15)
    : 0;
  const experienceOk =
    jd.min_experience_years == null ||
    (resume.total_experience_years ?? 0) >= jd.min_experience_years;

  const score = Math.max(0, Math.min(100, keyword.score + preferredBonus + (experienceOk ? 5 : -10)));

  return {
    matched_skills: [...keyword.matched, ...preferredHit],
    missing_skills: keyword.missing,
    semantic_score: score,
    rationale: `Scored without AI assistance: ${keyword.matched.length} of ${
      keyword.matched.length + keyword.missing.length
    } required skills found, ${preferredHit.length} of ${jd.preferred_skills.length} nice-to-haves, experience requirement ${
      experienceOk ? "met" : "not met"
    }.`,
    strength: keyword.matched.length ? `Covers ${keyword.matched.slice(0, 4).join(", ")}.` : "No required skills detected.",
    concern: keyword.missing.length ? `Missing ${keyword.missing.slice(0, 4).join(", ")}.` : "No gaps detected in required skills.",
  };
}
