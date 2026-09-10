/**
 * Deterministic CV & Job Feature Extractor (BE-6-006, BE-6-007)
 * Provides canonical normalization of skills, experience, and keywords.
 */
export class FeatureExtractor {
  // Comprehensive canonical list of tech skills
  private static readonly KNOWN_TECH_SKILLS: { canonical: string; aliases: string[] }[] = [
    { canonical: 'JavaScript', aliases: ['javascript', 'js', 'es6', 'ecmascript'] },
    { canonical: 'TypeScript', aliases: ['typescript', 'ts'] },
    { canonical: 'Node.js', aliases: ['node.js', 'nodejs', 'node js', 'node'] },
    { canonical: 'NestJS', aliases: ['nestjs', 'nest.js', 'nest js'] },
    { canonical: 'Express.js', aliases: ['express.js', 'expressjs', 'express'] },
    { canonical: 'React', aliases: ['react', 'react.js', 'reactjs'] },
    { canonical: 'Next.js', aliases: ['next.js', 'nextjs', 'next js'] },
    { canonical: 'Vue.js', aliases: ['vue.js', 'vuejs', 'vue'] },
    { canonical: 'Angular', aliases: ['angular', 'angularjs'] },
    { canonical: 'Python', aliases: ['python', 'py'] },
    { canonical: 'Django', aliases: ['django'] },
    { canonical: 'FastAPI', aliases: ['fastapi', 'fast-api'] },
    { canonical: 'Flask', aliases: ['flask'] },
    { canonical: 'Java', aliases: ['java'] },
    { canonical: 'Spring Boot', aliases: ['spring boot', 'springboot', 'spring'] },
    { canonical: 'C#', aliases: ['c#', 'csharp', '.net', 'dotnet', 'asp.net'] },
    { canonical: 'Go', aliases: ['golang', 'go language', 'go'] },
    { canonical: 'Rust', aliases: ['rust'] },
    { canonical: 'PHP', aliases: ['php', 'laravel', 'symfony'] },
    { canonical: 'SQL', aliases: ['sql'] },
    { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'psql'] },
    { canonical: 'MySQL', aliases: ['mysql'] },
    { canonical: 'MongoDB', aliases: ['mongodb', 'mongo'] },
    { canonical: 'Redis', aliases: ['redis'] },
    { canonical: 'Elasticsearch', aliases: ['elasticsearch', 'elastic search'] },
    { canonical: 'Docker', aliases: ['docker', 'container'] },
    { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
    { canonical: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'] },
    { canonical: 'GCP', aliases: ['gcp', 'google cloud'] },
    { canonical: 'Azure', aliases: ['azure'] },
    { canonical: 'CI/CD', aliases: ['ci/cd', 'github actions', 'gitlab ci', 'jenkins'] },
    { canonical: 'Git', aliases: ['git', 'github', 'gitlab'] },
    { canonical: 'GraphQL', aliases: ['graphql'] },
    { canonical: 'REST API', aliases: ['rest api', 'restful', 'rest apis'] },
    { canonical: 'Microservices', aliases: ['microservices', 'microservice'] },
    { canonical: 'RabbitMQ', aliases: ['rabbitmq'] },
    { canonical: 'Kafka', aliases: ['kafka', 'apache kafka'] },
    { canonical: 'Linux', aliases: ['linux', 'ubuntu', 'debian'] },
    { canonical: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss'] },
  ];

  /**
   * Extracts canonical skills found in text.
   */
  static extractSkills(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const matched = new Set<string>();

    for (const skill of this.KNOWN_TECH_SKILLS) {
      for (const alias of skill.aliases) {
        // Match word boundaries so 'go' doesn't match 'good'
        const regex = new RegExp(
          `(^|[^a-zA-Z0-9#+])${this.escapeRegex(alias)}([^a-zA-Z0-9#+]|$)`,
          'i',
        );
        if (regex.test(lower)) {
          matched.add(skill.canonical);
          break;
        }
      }
    }

    return Array.from(matched);
  }

  /**
   * Estimates years of experience from CV text.
   */
  static extractExperienceYears(text: string): number | null {
    if (!text) return null;

    // Look for explicit statements like "5 years of experience" or "5+ năm kinh nghiệm"
    const expRegex = /(\d+)\+?\s*(?:years?|năm)\s*(?:of\s*)?(?:experience|kinh\s*nghiệm)/i;
    const match = text.match(expRegex);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0 && parsed <= 50) return parsed;
    }

    // Look for year ranges like "2019 - 2024" or "2018 - Present"
    const rangeRegex = /(20\d{2})\s*[-–—]\s*(20\d{2}|Present|Hiện tại|Now)/gi;
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    let rangeMatch;

    while ((rangeMatch = rangeRegex.exec(text)) !== null) {
      const start = parseInt(rangeMatch[1], 10);
      const endStr = rangeMatch[2].toLowerCase();
      const end =
        endStr.includes('present') || endStr.includes('hiện tại') || endStr.includes('now')
          ? currentYear
          : parseInt(endStr, 10);
      if (end >= start && start >= 1990) {
        totalYears += end - start;
      }
    }

    return totalYears > 0 ? Math.min(totalYears, 40) : null;
  }

  /**
   * Extracts candidate headline or title.
   */
  static extractHeadline(text: string): string | null {
    if (!text) return null;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const candidateTitles = [
      'Full Stack Developer',
      'Backend Developer',
      'Frontend Developer',
      'Software Engineer',
      'DevOps Engineer',
      'Data Engineer',
      'Mobile Developer',
      'System Architect',
      'Technical Lead',
    ];

    for (const line of lines.slice(0, 10)) {
      for (const title of candidateTitles) {
        if (line.toLowerCase().includes(title.toLowerCase())) {
          return title;
        }
      }
    }

    return lines[0] ? lines[0].substring(0, 100) : null;
  }

  /**
   * Extracts education degrees or institutions.
   */
  static extractEducation(text: string): string[] {
    if (!text) return [];
    const degrees: string[] = [];
    const lower = text.toLowerCase();

    if (lower.includes('bachelor') || lower.includes('cử nhân') || lower.includes('kỹ sư')) {
      degrees.push('Bachelor Degree in Computer Science / IT');
    }
    if (lower.includes('master') || lower.includes('thạc sĩ')) {
      degrees.push('Master Degree');
    }
    if (lower.includes('phd') || lower.includes('tiến sĩ')) {
      degrees.push('Doctorate / PhD');
    }

    return degrees;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
