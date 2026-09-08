import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InMemoryPrismaService {
  users: any[] = [];
  refreshSessions: any[] = [];
  candidateProfiles: any[] = [];
  skills: any[] = [];
  candidateSkills: any[] = [];
  workExperiences: any[] = [];
  companies: any[] = [];
  companyMemberships: any[] = [];
  auditLogs: any[] = [];
  outboxEvents: any[] = [];

  user = {
    findUnique: async (args: any) => {
      if (args.where.id) {
        return this.users.find((u) => u.id === args.where.id) || null;
      }
      if (args.where.email) {
        return this.users.find((u) => u.email === args.where.email) || null;
      }
      return null;
    },
    create: async (args: any) => {
      const user = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(user);
      return user;
    },
    update: async (args: any) => {
      const idx = this.users.findIndex((u) => u.id === args.where.id);
      if (idx !== -1) {
        this.users[idx] = {
          ...this.users[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        return this.users[idx];
      }
      return null;
    },
  };

  refreshSession = {
    findFirst: async (args: any) => {
      const session = this.refreshSessions.find((s) => s.tokenHash === args.where.tokenHash);
      if (!session) return null;
      if (args.include?.user) {
        const user = this.users.find((u) => u.id === session.userId);
        return { ...session, user };
      }
      return session;
    },
    findMany: async (args: any) => {
      return this.refreshSessions.filter((s) => {
        if (args.where?.familyId) return s.familyId === args.where.familyId;
        if (args.where?.userId) return s.userId === args.where.userId;
        return true;
      });
    },
    create: async (args: any) => {
      const session = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.refreshSessions.push(session);
      return session;
    },
    update: async (args: any) => {
      const idx = this.refreshSessions.findIndex((s) => s.id === args.where.id);
      if (idx !== -1) {
        this.refreshSessions[idx] = {
          ...this.refreshSessions[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        return this.refreshSessions[idx];
      }
      return null;
    },
    updateMany: async (args: any) => {
      let count = 0;
      for (let i = 0; i < this.refreshSessions.length; i++) {
        const s = this.refreshSessions[i];
        let matches = true;
        if (args.where.familyId && s.familyId !== args.where.familyId) matches = false;
        if (args.where.userId && s.userId !== args.where.userId) matches = false;
        if (args.where.tokenHash && s.tokenHash !== args.where.tokenHash) matches = false;

        if (matches) {
          this.refreshSessions[i] = { ...s, ...args.data, updatedAt: new Date() };
          count++;
        }
      }
      return { count };
    },
  };

  candidateProfile = {
    findUnique: async (args: any) => {
      const profile = this.candidateProfiles.find((p) => {
        if (args.where.id) return p.id === args.where.id;
        if (args.where.userId) return p.userId === args.where.userId;
        return false;
      });
      if (!profile) return null;

      const skills = this.candidateSkills
        .filter((cs) => cs.candidateProfileId === profile.id)
        .map((cs) => {
          const skill = this.skills.find((s) => s.id === cs.skillId);
          return { ...cs, skill };
        });

      const experiences = this.workExperiences.filter((we) => we.candidateProfileId === profile.id);

      return {
        ...profile,
        skills,
        experiences,
      };
    },
    create: async (args: any) => {
      const profile = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.candidateProfiles.push(profile);
      return profile;
    },
    update: async (args: any) => {
      const idx = this.candidateProfiles.findIndex((p) => p.id === args.where.id);
      if (idx !== -1) {
        this.candidateProfiles[idx] = {
          ...this.candidateProfiles[idx],
          ...args.data,
          updatedAt: new Date(),
        };

        const skills = this.candidateSkills
          .filter((cs) => cs.candidateProfileId === this.candidateProfiles[idx].id)
          .map((cs) => {
            const skill = this.skills.find((s) => s.id === cs.skillId);
            return { ...cs, skill };
          });

        const experiences = this.workExperiences.filter(
          (we) => we.candidateProfileId === this.candidateProfiles[idx].id,
        );

        return {
          ...this.candidateProfiles[idx],
          skills,
          experiences,
        };
      }
      return null;
    },
  };

  skill = {
    findUnique: async (args: any) => {
      return this.skills.find((s) => s.id === args.where.id || s.name === args.where.name) || null;
    },
    create: async (args: any) => {
      const skill = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
      };
      this.skills.push(skill);
      return skill;
    },
  };

  candidateSkill = {
    create: async (args: any) => {
      const cs = {
        id: uuidv4(),
        ...args.data,
        createdAt: new Date(),
      };
      this.candidateSkills.push(cs);
      return cs;
    },
    deleteMany: async (args: any) => {
      this.candidateSkills = this.candidateSkills.filter(
        (cs) => cs.candidateProfileId !== args.where.candidateProfileId,
      );
      return { count: 1 };
    },
  };

  workExperience = {
    create: async (args: any) => {
      const we = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.workExperiences.push(we);
      return we;
    },
    deleteMany: async (args: any) => {
      this.workExperiences = this.workExperiences.filter(
        (we) => we.candidateProfileId !== args.where.candidateProfileId,
      );
      return { count: 1 };
    },
  };

  company = {
    findFirst: async (args: any) => {
      if (args.where?.OR) {
        return (
          this.companies.find((c) =>
            args.where.OR.some((cond: any) => {
              if (cond.id && c.id === cond.id) return true;
              if (cond.slug && c.slug === cond.slug) return true;
              return false;
            }),
          ) || null
        );
      }
      return null;
    },
    findUnique: async (args: any) => {
      return (
        this.companies.find((c) => c.id === args.where.id || c.slug === args.where.slug) || null
      );
    },
    create: async (args: any) => {
      const comp = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.companies.push(comp);
      return comp;
    },
    update: async (args: any) => {
      const idx = this.companies.findIndex((c) => c.id === args.where.id);
      if (idx !== -1) {
        this.companies[idx] = {
          ...this.companies[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        return this.companies[idx];
      }
      return null;
    },
  };

  companyMembership = {
    findUnique: async (args: any) => {
      if (args.where?.id) {
        return this.companyMemberships.find((m) => m.id === args.where.id) || null;
      }
      if (args.where?.companyId_userId) {
        const { companyId, userId } = args.where.companyId_userId;
        return (
          this.companyMemberships.find((m) => m.companyId === companyId && m.userId === userId) ||
          null
        );
      }
      return null;
    },
    findMany: async (args: any) => {
      const rows = this.companyMemberships.filter((m) => m.companyId === args.where.companyId);
      return rows.map((m) => {
        const user = this.users.find((u) => u.id === m.userId);
        return { ...m, user };
      });
    },
    count: async (args: any) => {
      return this.companyMemberships.filter((m) => {
        if (args.where.companyId && m.companyId !== args.where.companyId) return false;
        if (args.where.role && m.role !== args.where.role) return false;
        return true;
      }).length;
    },
    create: async (args: any) => {
      const m = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
      };
      this.companyMemberships.push(m);
      const user = this.users.find((u) => u.id === m.userId);
      return { ...m, user };
    },
    delete: async (args: any) => {
      const idx = this.companyMemberships.findIndex((m) => m.id === args.where.id);
      if (idx !== -1) {
        const deleted = this.companyMemberships.splice(idx, 1)[0];
        return deleted;
      }
      return null;
    },
  };

  auditLog = {
    create: async (args: any) => {
      const log = {
        id: uuidv4(),
        ...args.data,
        occurredAt: new Date(),
      };
      this.auditLogs.push(log);
      return log;
    },
  };

  outboxEvent = {
    create: async (args: any) => {
      const evt = {
        id: uuidv4(),
        ...args.data,
        occurredAt: new Date(),
      };
      this.outboxEvents.push(evt);
      return evt;
    },
  };

  async $transaction(fnOrArray: any) {
    if (typeof fnOrArray === 'function') {
      return fnOrArray(this);
    }
    if (Array.isArray(fnOrArray)) {
      return Promise.all(fnOrArray);
    }
    return fnOrArray;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}
