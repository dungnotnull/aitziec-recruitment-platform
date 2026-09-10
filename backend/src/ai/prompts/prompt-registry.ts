/**
 * Immutable Versioned AI Prompts (BE-6-005)
 */
export const PROMPTS = {
  CV_EXTRACTION: {
    version: 'extract_v1.0',
    template: (redactedCvText: string) =>
      `
You are an expert technical recruiter and CV parser.
Extract the structured technical profile of the candidate from the provided CV text below.
Do not invent any claims or experience not present in the text.

CV Text:
"""
${redactedCvText}
"""

Respond strictly with valid JSON conforming to this schema:
{
  "skills": string[],
  "experienceYears": number | null,
  "headline": string | null,
  "education": string[],
  "summary": string | null
}
`.trim(),
  },

  CV_JOB_MATCH: {
    version: 'cv_job_match_v1.0',
    template: (
      redactedCvText: string,
      jobTitle: string,
      jobDescription: string,
      requirements: string,
      technologies: string[],
    ) =>
      `
You are an objective AI recruitment evaluator.
Evaluate the candidate CV against the job requirements below.
Score each component from 0 to 100 and provide verifiable evidence extracted strictly from the CV.
Do not invent or assume experience.

Job Title: ${jobTitle}
Required Technologies: ${technologies.join(', ')}
Job Description:
"""
${jobDescription}
"""
Job Requirements:
"""
${requirements}
"""

Candidate CV Text (PII Redacted):
"""
${redactedCvText}
"""

Respond strictly with valid JSON conforming to this schema:
{
  "overallScore": number (0-100),
  "components": [
    {
      "name": "SKILLS" | "EXPERIENCE" | "REQUIREMENTS" | "KEYWORDS",
      "score": number (0-100),
      "weight": number (0.0-1.0),
      "evidence": string[]
    }
  ],
  "matchedSkills": string[],
  "missingSkills": string[]
}
`.trim(),
  },

  CV_GAP_ANALYSIS: {
    version: 'cv_gap_v1.0',
    template: (
      redactedCvText: string,
      jobTitle: string,
      jobDescription: string,
      requirements: string,
      technologies: string[],
    ) =>
      `
You are a senior career advisor.
Perform an objective gap analysis between the candidate's CV and the job criteria.
Identify missing technical skills, unmet requirements, and actionable suggestions.
Reject any invented candidate experience.

Job Title: ${jobTitle}
Technologies: ${technologies.join(', ')}
Job Requirements:
"""
${requirements}
"""

Candidate CV Text (PII Redacted):
"""
${redactedCvText}
"""

Respond strictly with valid JSON conforming to this schema:
{
  "missingSkills": string[],
  "unmetRequirements": string[],
  "suggestions": string[],
  "limitations": string[]
}
`.trim(),
  },

  SEARCH_QUERY_PARSE: {
    version: 'nl_search_v1.0',
    template: (query: string) =>
      `
You are a search query parser for an IT recruitment platform.
Extract structured filters from the user search query: "${query}".

Allowed Enum Values:
- workplaceType: ["ONSITE", "HYBRID", "REMOTE"]
- experienceLevel: ["INTERN", "FRESHER", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"]
- employmentType: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]

Respond strictly with valid JSON conforming to this schema:
{
  "query": string | undefined,
  "workplaceType": string[] | undefined,
  "experienceLevel": string[] | undefined,
  "employmentType": string[] | undefined,
  "location": string[] | undefined,
  "technologyNames": string[] | undefined,
  "salaryMin": number | undefined,
  "salaryMax": number | undefined
}
`.trim(),
  },
};
