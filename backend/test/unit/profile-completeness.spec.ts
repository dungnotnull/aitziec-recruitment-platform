import { CompletenessService } from '../../src/candidates/completeness.service';

describe('CompletenessService (BE-2-014)', () => {
  let service: CompletenessService;

  beforeEach(() => {
    service = new CompletenessService();
  });

  it('calculates 0% for empty profile fields', () => {
    const completeness = service.calculate({});
    expect(completeness).toBe(0);
  });

  it('calculates partial completeness accurately according to documented formula', () => {
    // fullName (15) + headline (10) = 25
    const score1 = service.calculate({
      fullName: 'John Doe',
      headline: 'Software Engineer',
    });
    expect(score1).toBe(25);

    // fullName (15) + skillsCount > 0 (20) = 35
    const score2 = service.calculate({
      fullName: 'John Doe',
      skillsCount: 3,
    });
    expect(score2).toBe(35);
  });

  it('calculates 100% when all profile fields, skills, and experiences are populated', () => {
    const completeness = service.calculate({
      fullName: 'Nguyen Van A',
      headline: 'Lead Architect',
      phone: '+84901234567',
      location: 'Ho Chi Minh City',
      bio: 'Over 10 years of experience in distributed systems',
      skillsCount: 5,
      experiencesCount: 2,
    });

    expect(completeness).toBe(100);
  });

  it('caps the score at 100% and does not exceed boundaries', () => {
    const completeness = service.calculate({
      fullName: 'Nguyen Van A',
      headline: 'Lead Architect',
      phone: '+84901234567',
      location: 'Ho Chi Minh City',
      bio: 'Over 10 years of experience',
      skillsCount: 50,
      experiencesCount: 20,
    });

    expect(completeness).toBe(100);
  });
});
