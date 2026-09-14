import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InMemoryPrismaService {
  clock?: () => Date;
  users: any[] = [];
  refreshSessions: any[] = [];
  candidateProfiles: any[] = [];
  skills: any[] = [];
  skillAliases: any[] = [];
  candidateSkills: any[] = [];
  workExperiences: any[] = [];
  companies: any[] = [];
  companyMemberships: any[] = [];
  companyInvitations: any[] = [];
  companyInvitationDeliverySecrets: any[] = [];
  jobs: any[] = [];
  savedJobs: any[] = [];
  applications: any[] = [];
  applicationStatusEvents: any[] = [];
  cvs: any[] = [];
  interviews: any[] = [];
  notifications: any[] = [];
  auditLogs: any[] = [];
  outboxEvents: any[] = [];
  operations: any[] = [];
  aiAnalyses: any[] = [];
  recommendationPreferences: any[] = [];
  idempotencyRecords: any[] = [];

  reset() {
    this.users = [];
    this.refreshSessions = [];
    this.candidateProfiles = [];
    this.skills = [];
    this.skillAliases = [];
    this.candidateSkills = [];
    this.workExperiences = [];
    this.companies = [];
    this.companyMemberships = [];
    this.companyInvitations = [];
    this.companyInvitationDeliverySecrets = [];
    this.jobs = [];
    this.savedJobs = [];
    this.applications = [];
    this.applicationStatusEvents = [];
    this.cvs = [];
    this.interviews = [];
    this.notifications = [];
    this.auditLogs = [];
    this.outboxEvents = [];
    this.operations = [];
    this.aiAnalyses = [];
    this.recommendationPreferences = [];
    this.idempotencyRecords = [];
  }

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
    findMany: async (args?: any) => {
      let result = [...this.users];
      if (args?.where) {
        if (args.where.role) {
          result = result.filter((u) => u.role === args.where.role);
        }
        if (args.where.status) {
          result = result.filter((u) => u.status === args.where.status);
        }
      }
      return result;
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
      let found: any = null;
      if (args.where.id) {
        found = this.skills.find((s) => s.id === args.where.id);
      } else if (args.where.name) {
        found = this.skills.find((s) => s.name.toLowerCase() === args.where.name.toLowerCase());
      } else if (args.where.normalizedName) {
        found = this.skills.find((s) => s.normalizedName === args.where.normalizedName);
      }
      if (!found) return null;
      const res = { ...found };
      if (args.include?.aliases) {
        res.aliases = this.skillAliases.filter((a) => a.skillId === found.id);
      }
      return res;
    },
    findFirst: async (args?: any) => {
      const items = await this.skill.findMany(args);
      return items[0] || null;
    },
    findMany: async (args?: any) => {
      let result = [...this.skills];
      if (args?.where) {
        if (args.where.active !== undefined) {
          result = result.filter((s) => s.active === args.where.active);
        }
        if (args.where.id) {
          if (args.where.id.in) {
            result = result.filter((s) => args.where.id.in.includes(s.id));
          } else {
            result = result.filter((s) => s.id === args.where.id);
          }
        }
        if (args.where.OR && Array.isArray(args.where.OR)) {
          result = result.filter((s) => {
            return args.where.OR.some((cond: any) => {
              if (cond.normalizedName?.contains) {
                const term = cond.normalizedName.contains.toLowerCase();
                return s.normalizedName.includes(term);
              }
              if (cond.name?.contains) {
                const term = cond.name.contains.toLowerCase();
                return s.name.toLowerCase().includes(term);
              }
              if (cond.aliases?.some?.normalizedName?.contains) {
                const term = cond.aliases.some.normalizedName.contains.toLowerCase();
                const aliases = this.skillAliases.filter((a) => a.skillId === s.id);
                return aliases.some(
                  (a) => a.normalizedName.includes(term) || a.alias.toLowerCase().includes(term),
                );
              }
              return false;
            });
          });
        }
      }

      result.sort((a, b) => {
        if (a.normalizedName < b.normalizedName) return -1;
        if (a.normalizedName > b.normalizedName) return 1;
        return a.id.localeCompare(b.id);
      });

      if (args?.cursor?.id) {
        const idx = result.findIndex((r) => r.id === args.cursor.id);
        if (idx !== -1) {
          result = result.slice(idx);
        }
      }
      if (args?.skip) {
        result = result.slice(args.skip);
      }
      if (args?.take) {
        result = result.slice(0, args.take);
      }

      if (args?.include?.aliases) {
        result = result.map((s) => ({
          ...s,
          aliases: this.skillAliases.filter((a) => a.skillId === s.id),
        }));
      }

      return result;
    },
    count: async (args?: any) => {
      const items = await this.skill.findMany(args);
      return items.length;
    },
    create: async (args: any) => {
      const normalized = args.data.normalizedName || args.data.name.trim().toLowerCase();
      const existing = this.skills.find(
        (s) =>
          s.name.toLowerCase() === args.data.name.toLowerCase() || s.normalizedName === normalized,
      );
      if (existing) {
        throw new Error('Skill name or normalizedName already exists');
      }
      const item = {
        id: args.data.id || uuidv4(),
        name: args.data.name,
        normalizedName: normalized,
        active: args.data.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.skills.push(item);
      return { ...item };
    },
    update: async (args: any) => {
      const item = this.skills.find((s) => s.id === args.where.id);
      if (!item) throw new Error('Skill not found');
      if (args.data.name !== undefined) item.name = args.data.name;
      if (args.data.normalizedName !== undefined) item.normalizedName = args.data.normalizedName;
      if (args.data.active !== undefined) item.active = args.data.active;
      item.updatedAt = new Date();
      return { ...item };
    },
  };

  skillAlias = {
    findMany: async (args?: any) => {
      let result = [...this.skillAliases];
      if (args?.where?.skillId) {
        result = result.filter((a) => a.skillId === args.where.skillId);
      }
      return result;
    },
    findUnique: async (args: any) => {
      if (args.where.normalizedName) {
        return (
          this.skillAliases.find((a) => a.normalizedName === args.where.normalizedName) || null
        );
      }
      return null;
    },
    create: async (args: any) => {
      const normalized = args.data.normalizedName || args.data.alias.trim().toLowerCase();
      const item = {
        id: args.data.id || uuidv4(),
        skillId: args.data.skillId,
        alias: args.data.alias,
        normalizedName: normalized,
        createdAt: new Date(),
      };
      this.skillAliases.push(item);
      return { ...item };
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
        status: args.data.status || 'ACTIVE',
        version: args.data.version || 1,
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
    findMany: async (args?: any) => {
      let rows = [...this.companies];
      if (args?.where) {
        if (args.where.status) {
          rows = rows.filter((c) => c.status === args.where.status);
        }
        if (args.where.OR) {
          rows = rows.filter((c) =>
            args.where.OR.some((cond: any) => {
              if (cond.name?.contains) {
                const query = cond.name.contains.toLowerCase();
                if (c.name.toLowerCase().includes(query)) return true;
              }
              if (cond.slug?.contains) {
                const query = cond.slug.contains.toLowerCase();
                if (c.slug.toLowerCase().includes(query)) return true;
              }
              return false;
            }),
          );
        }
      }
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (args?.cursor?.id) {
        const idx = rows.findIndex((r) => r.id === args.cursor.id);
        if (idx !== -1) {
          rows = rows.slice(idx);
        }
      }
      if (args?.skip) {
        rows = rows.slice(args.skip);
      }
      if (args?.take) {
        rows = rows.slice(0, args.take);
      }
      return rows;
    },
    count: async (args?: any) => {
      const items = await this.company.findMany(args);
      return items.length;
    },
  };

  companyMembership = {
    findFirst: async (args: any) => {
      return (
        this.companyMemberships.find((m) => {
          if (args.where?.companyId && m.companyId !== args.where.companyId) return false;
          if (args.where?.userId && m.userId !== args.where.userId) return false;
          if (args.where?.role && m.role !== args.where.role) return false;
          return true;
        }) || null
      );
    },
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
      let rows = [...this.companyMemberships];
      if (args?.where) {
        if (args.where.companyId) {
          rows = rows.filter((m) => m.companyId === args.where.companyId);
        }
        if (args.where.userId) {
          rows = rows.filter((m) => m.userId === args.where.userId);
        }
      }

      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      if (args?.cursor?.id) {
        const idx = rows.findIndex((r) => r.id === args.cursor.id);
        if (idx !== -1) {
          rows = rows.slice(idx);
        }
      }
      if (args?.skip) {
        rows = rows.slice(args.skip);
      }
      if (args?.take) {
        rows = rows.slice(0, args.take);
      }

      return rows.map((m) => {
        const user = this.users.find((u) => u.id === m.userId);
        const company = this.companies.find((c) => c.id === m.companyId);
        return { ...m, user, company };
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

  companyInvitation = {
    findUnique: async (args: any) => {
      if (args.where?.id) {
        return this.companyInvitations.find((i) => i.id === args.where.id) || null;
      }
      if (args.where?.tokenHash) {
        return this.companyInvitations.find((i) => i.tokenHash === args.where.tokenHash) || null;
      }
      return null;
    },
    findFirst: async (args: any) => {
      return (
        this.companyInvitations.find((i) => {
          if (args.where?.companyId && i.companyId !== args.where.companyId) return false;
          if (args.where?.email && i.email.toLowerCase() !== args.where.email.toLowerCase())
            return false;
          if (args.where?.status && i.status !== args.where.status) return false;
          return true;
        }) || null
      );
    },
    findMany: async (args?: any) => {
      let rows = [...this.companyInvitations];
      if (args?.where) {
        if (args.where.companyId) {
          rows = rows.filter((i) => i.companyId === args.where.companyId);
        }
        if (args.where.email) {
          rows = rows.filter((i) => i.email.toLowerCase() === args.where.email.toLowerCase());
        }
        if (args.where.status) {
          rows = rows.filter((i) => i.status === args.where.status);
        }
      }
      return rows;
    },
    create: async (args: any) => {
      const inv = {
        id: args.data.id || uuidv4(),
        companyId: args.data.companyId,
        email: args.data.email,
        role: args.data.role || 'RECRUITER',
        invitedById: args.data.invitedById || null,
        tokenHash: args.data.tokenHash,
        status: args.data.status || 'PENDING',
        expiresAt: args.data.expiresAt,
        acceptedAt: args.data.acceptedAt || null,
        revokedAt: args.data.revokedAt || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.companyInvitations.push(inv);
      return { ...inv };
    },
    update: async (args: any) => {
      const idx = this.companyInvitations.findIndex((i) => i.id === args.where.id);
      if (idx !== -1) {
        this.companyInvitations[idx] = {
          ...this.companyInvitations[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        return { ...this.companyInvitations[idx] };
      }
      return null;
    },
    delete: async (args: any) => {
      const idx = this.companyInvitations.findIndex((i) => i.id === args.where.id);
      if (idx !== -1) {
        const deleted = this.companyInvitations.splice(idx, 1)[0];
        return deleted;
      }
      return null;
    },
  };

  companyInvitationDeliverySecret = {
    findUnique: async (args: any) => {
      if (args.where.invitationId) {
        return (
          this.companyInvitationDeliverySecrets.find(
            (s) => s.invitationId === args.where.invitationId,
          ) || null
        );
      }
      if (args.where.id) {
        return this.companyInvitationDeliverySecrets.find((s) => s.id === args.where.id) || null;
      }
      return null;
    },
    create: async (args: any) => {
      const secret = {
        id: args.data.id || `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        invitationId: args.data.invitationId,
        encryptedToken: args.data.encryptedToken,
        iv: args.data.iv,
        authTag: args.data.authTag,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.companyInvitationDeliverySecrets.push(secret);
      return { ...secret };
    },
    delete: async (args: any) => {
      const idx = this.companyInvitationDeliverySecrets.findIndex(
        (s) =>
          (args.where.invitationId && s.invitationId === args.where.invitationId) ||
          (args.where.id && s.id === args.where.id),
      );
      if (idx !== -1) {
        const deleted = this.companyInvitationDeliverySecrets.splice(idx, 1)[0];
        return deleted;
      }
      return null;
    },
    deleteMany: async (args: any) => {
      let count = 0;
      if (args?.where?.invitation?.expiresAt?.lt) {
        const threshold = args.where.invitation.expiresAt.lt;
        const remaining: any[] = [];
        for (const sec of this.companyInvitationDeliverySecrets) {
          const inv = this.companyInvitations.find((i) => i.id === sec.invitationId);
          if (inv && inv.expiresAt < threshold) {
            count++;
          } else {
            remaining.push(sec);
          }
        }
        this.companyInvitationDeliverySecrets = remaining;
      }
      return { count };
    },
  };

  job = {
    findUnique: async (args: any) => {
      let found: any = null;
      if (args.where.id) {
        found = this.jobs.find((j) => j.id === args.where.id);
      } else if (args.where.slug) {
        found = this.jobs.find((j) => j.slug === args.where.slug);
      }
      if (!found) return null;
      if (args.include?.company) {
        const company = this.companies.find((c) => c.id === found.companyId);
        return { ...found, company };
      }
      return found;
    },
    findFirst: async (args: any) => {
      const filtered = this.jobs.filter((j) => {
        if (args.where?.id && j.id !== args.where.id) return false;
        if (args.where?.slug && j.slug !== args.where.slug) return false;
        if (args.where?.companyId && j.companyId !== args.where.companyId) return false;
        if (args.where?.status && j.status !== args.where.status) return false;
        return true;
      });
      const found = filtered[0] || null;
      if (found && args.include?.company) {
        const company = this.companies.find((c) => c.id === found.companyId);
        return { ...found, company };
      }
      return found;
    },
    findMany: async (args: any) => {
      let result = this.jobs.filter((j) => {
        if (args.where?.companyId && j.companyId !== args.where.companyId) return false;
        if (args.where?.status) {
          if (typeof args.where.status === 'string' && j.status !== args.where.status) return false;
          if (args.where.status.in && !args.where.status.in.includes(j.status)) return false;
        }
        if (
          args.where?.location &&
          !j.location.toLowerCase().includes(args.where.location.toLowerCase())
        )
          return false;
        if (args.where?.experienceLevel) {
          if (
            typeof args.where.experienceLevel === 'string' &&
            j.experienceLevel !== args.where.experienceLevel
          )
            return false;
          if (
            args.where.experienceLevel.in &&
            !args.where.experienceLevel.in.includes(j.experienceLevel)
          )
            return false;
        }
        if (args.where?.employmentType) {
          if (
            typeof args.where.employmentType === 'string' &&
            j.employmentType !== args.where.employmentType
          )
            return false;
          if (
            args.where.employmentType.in &&
            !args.where.employmentType.in.includes(j.employmentType)
          )
            return false;
        }
        if (args.where?.workplaceType) {
          if (
            typeof args.where.workplaceType === 'string' &&
            j.workplaceType !== args.where.workplaceType
          )
            return false;
          if (args.where.workplaceType.in && !args.where.workplaceType.in.includes(j.workplaceType))
            return false;
        }
        if (args.where?.salaryMin && j.salaryMax && j.salaryMax < args.where.salaryMin)
          return false;
        if (args.where?.salaryMax && j.salaryMin && j.salaryMin > args.where.salaryMax)
          return false;
        if (
          args.where?.publishedAt?.gte &&
          new Date(j.publishedAt) < new Date(args.where.publishedAt.gte)
        )
          return false;
        if (
          args.where?.applicationDeadline?.gt &&
          new Date(j.applicationDeadline) <= new Date(args.where.applicationDeadline.gt)
        )
          return false;
        if (args.where?.company?.status) {
          const comp = this.companies.find((c) => c.id === j.companyId);
          if (!comp || comp.status !== args.where.company.status) return false;
        }
        if (args.where?.OR && Array.isArray(args.where.OR)) {
          const matchOr = args.where.OR.some((cond: any) => {
            if (
              cond.title?.contains &&
              j.title.toLowerCase().includes(cond.title.contains.toLowerCase())
            )
              return true;
            if (
              cond.description?.contains &&
              j.description.toLowerCase().includes(cond.description.contains.toLowerCase())
            )
              return true;
            if (
              cond.requirements?.contains &&
              j.requirements.toLowerCase().includes(cond.requirements.contains.toLowerCase())
            )
              return true;
            if (
              cond.slug?.contains &&
              j.slug.toLowerCase().includes(cond.slug.contains.toLowerCase())
            )
              return true;
            if (
              cond.company?.name?.contains &&
              this.companies
                .find((c) => c.id === j.companyId)
                ?.name.toLowerCase()
                .includes(cond.company.name.contains.toLowerCase())
            )
              return true;
            return false;
          });
          if (!matchOr) return false;
        }
        return true;
      });

      if (args.orderBy) {
        const orderList = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        result.sort((a, b) => {
          for (const order of orderList) {
            const orderKey = Object.keys(order)[0];
            const direction = order[orderKey];
            const valA = a[orderKey] instanceof Date ? a[orderKey].getTime() : a[orderKey];
            const valB = b[orderKey] instanceof Date ? b[orderKey].getTime() : b[orderKey];
            if (valA !== valB) {
              if (direction === 'desc') {
                return valA < valB ? 1 : -1;
              }
              return valA > valB ? 1 : -1;
            }
          }
          return 0;
        });
      }

      if (args.cursor?.id) {
        const cursorIdx = result.findIndex((j) => j.id === args.cursor.id);
        if (cursorIdx !== -1) {
          result = result.slice(cursorIdx + (args.skip || 0));
        }
      } else if (args.skip) {
        result = result.slice(args.skip);
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      if (args.include?.company) {
        result = result.map((j) => {
          const company = this.companies.find((c) => c.id === j.companyId);
          return { ...j, company };
        });
      }

      return result;
    },
    count: async (args: any) => {
      const items = await this.job.findMany({ where: args.where });
      return items.length;
    },
    create: async (args: any) => {
      const now = new Date();
      const job = {
        id: args.data.id || uuidv4(),
        ...args.data,
        status: args.data.status || 'DRAFT',
        version: args.data.version || 1,
        publishedAt: args.data.publishedAt || null,
        closedAt: args.data.closedAt || null,
        createdAt: now,
        updatedAt: now,
      };
      this.jobs.push(job);
      if (args.include?.company) {
        const company = this.companies.find((c) => c.id === job.companyId);
        return { ...job, company };
      }
      return job;
    },
    update: async (args: any) => {
      const idx = this.jobs.findIndex((j) => j.id === args.where.id);
      if (idx !== -1) {
        this.jobs[idx] = {
          ...this.jobs[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        if (args.include?.company) {
          const company = this.companies.find((c) => c.id === this.jobs[idx].companyId);
          return { ...this.jobs[idx], company };
        }
        return this.jobs[idx];
      }
      return null;
    },
  };

  savedJob = {
    findUnique: async (args: any) => {
      if (args.where.candidateProfileId_jobId) {
        const { candidateProfileId, jobId } = args.where.candidateProfileId_jobId;
        return (
          this.savedJobs.find(
            (s) => s.candidateProfileId === candidateProfileId && s.jobId === jobId,
          ) || null
        );
      }
      if (args.where.id) {
        return this.savedJobs.find((s) => s.id === args.where.id) || null;
      }
      return null;
    },
    findFirst: async (args: any) => {
      return (
        this.savedJobs.find((s) => {
          if (
            args.where?.candidateProfileId &&
            s.candidateProfileId !== args.where.candidateProfileId
          )
            return false;
          if (args.where?.jobId && s.jobId !== args.where.jobId) return false;
          return true;
        }) || null
      );
    },
    findMany: async (args: any) => {
      let result = this.savedJobs.filter((s) => {
        if (
          args.where?.candidateProfileId &&
          s.candidateProfileId !== args.where.candidateProfileId
        )
          return false;
        return true;
      });

      if (args.include?.job) {
        result = result.map((s) => {
          const rawJob = this.jobs.find((j) => j.id === s.jobId);
          let jobWithCompany = rawJob;
          if (rawJob && args.include.job.include?.company) {
            const company = this.companies.find((c) => c.id === rawJob.companyId);
            jobWithCompany = { ...rawJob, company };
          }
          return { ...s, job: jobWithCompany };
        });
      }

      if (args.orderBy?.createdAt === 'desc') {
        result.sort((a, b) => (new Date(a.createdAt) < new Date(b.createdAt) ? 1 : -1));
      }

      if (args.cursor?.id) {
        const cursorIdx = result.findIndex((s) => s.id === args.cursor.id);
        if (cursorIdx !== -1) {
          result = result.slice(cursorIdx + (args.skip || 0));
        }
      } else if (args.skip) {
        result = result.slice(args.skip);
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      return result;
    },
    create: async (args: any) => {
      const saved = {
        id: args.data.id || uuidv4(),
        ...args.data,
        createdAt: new Date(),
      };
      this.savedJobs.push(saved);
      return saved;
    },
    delete: async (args: any) => {
      let idx = -1;
      if (args.where.id) {
        idx = this.savedJobs.findIndex((s) => s.id === args.where.id);
      } else if (args.where.candidateProfileId_jobId) {
        const { candidateProfileId, jobId } = args.where.candidateProfileId_jobId;
        idx = this.savedJobs.findIndex(
          (s) => s.candidateProfileId === candidateProfileId && s.jobId === jobId,
        );
      }
      if (idx !== -1) {
        return this.savedJobs.splice(idx, 1)[0];
      }
      return null;
    },
    deleteMany: async (args: any) => {
      const initialLen = this.savedJobs.length;
      this.savedJobs = this.savedJobs.filter((s) => {
        if (
          args.where?.candidateProfileId &&
          s.candidateProfileId === args.where.candidateProfileId
        ) {
          if (args.where?.jobId && s.jobId === args.where.jobId) return false;
          if (!args.where?.jobId) return false;
        }
        return true;
      });
      return { count: initialLen - this.savedJobs.length };
    },
  };

  application = {
    findUnique: async (args: any) => {
      let app: any = null;
      if (args.where.id) {
        app = this.applications.find((a) => a.id === args.where.id);
      } else if (args.where.candidateId_jobId) {
        const { candidateId, jobId } = args.where.candidateId_jobId;
        app = this.applications.find((a) => a.candidateId === candidateId && a.jobId === jobId);
      }
      if (!app) return null;
      return this.populateApplication(app, args.include);
    },
    findFirst: async (args: any) => {
      const app = this.applications.find((a) => {
        if (args.where?.id && a.id !== args.where.id) return false;
        if (args.where?.candidateId && a.candidateId !== args.where.candidateId) return false;
        if (args.where?.jobId && a.jobId !== args.where.jobId) return false;
        if (args.where?.status && a.status !== args.where.status) return false;
        return true;
      });
      if (!app) return null;
      return this.populateApplication(app, args.include);
    },
    findMany: async (args: any) => {
      let result = this.applications.filter((a) => {
        if (args.where?.candidateId && a.candidateId !== args.where.candidateId) return false;
        if (args.where?.jobId && a.jobId !== args.where.jobId) return false;
        if (args.where?.status && a.status !== args.where.status) return false;
        if (args.where?.job?.companyId) {
          const job = this.jobs.find((j) => j.id === a.jobId);
          if (!job || job.companyId !== args.where.job.companyId) return false;
        }
        if (args.where?.submittedAt) {
          const subTime = new Date(a.submittedAt).getTime();
          if (
            args.where.submittedAt.gte &&
            subTime < new Date(args.where.submittedAt.gte).getTime()
          ) {
            return false;
          }
          if (
            args.where.submittedAt.lte &&
            subTime > new Date(args.where.submittedAt.lte).getTime()
          ) {
            return false;
          }
        }
        if (args.where?.OR && Array.isArray(args.where.OR)) {
          const cand = this.candidateProfiles.find((c) => c.id === a.candidateId);
          const job = this.jobs.find((j) => j.id === a.jobId);
          const company = job ? this.companies.find((c) => c.id === job.companyId) : null;
          const match = args.where.OR.some((cond: any) => {
            if (
              cond.candidate?.fullName?.contains &&
              cand?.fullName.toLowerCase().includes(cond.candidate.fullName.contains.toLowerCase())
            ) {
              return true;
            }
            if (
              cond.job?.title?.contains &&
              job?.title.toLowerCase().includes(cond.job.title.contains.toLowerCase())
            ) {
              return true;
            }
            if (
              cond.job?.slug?.contains &&
              job?.slug.toLowerCase().includes(cond.job.slug.contains.toLowerCase())
            ) {
              return true;
            }
            if (
              cond.job?.company?.name?.contains &&
              company?.name.toLowerCase().includes(cond.job.company.name.contains.toLowerCase())
            ) {
              return true;
            }
            if (
              cond.job?.company?.slug?.contains &&
              company?.slug.toLowerCase().includes(cond.job.company.slug.contains.toLowerCase())
            ) {
              return true;
            }
            return false;
          });
          if (!match) return false;
        }
        return true;
      });

      result.sort((a, b) => {
        const diff = new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      });

      if (args.cursor?.id) {
        const cursorIdx = result.findIndex((a) => a.id === args.cursor.id);
        if (cursorIdx !== -1) {
          result = result.slice(cursorIdx + (args.skip || 0));
        }
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      return result.map((app) => this.populateApplication(app, args.include));
    },
    create: async (args: any) => {
      const existing = this.applications.find(
        (a) => a.candidateId === args.data.candidateId && a.jobId === args.data.jobId,
      );
      if (existing) {
        const err: any = new Error('Unique constraint failed on the fields: (candidateId, jobId)');
        err.code = 'P2002';
        throw err;
      }

      const app = {
        id: args.data.id || uuidv4(),
        candidateId: args.data.candidateId,
        jobId: args.data.jobId,
        submittedCvId: args.data.submittedCvId,
        status: args.data.status || 'APPLIED',
        candidateNote: args.data.candidateNote ?? null,
        version: args.data.version || 1,
        submittedAt: new Date(),
        updatedAt: new Date(),
      };
      this.applications.push(app);
      return this.populateApplication(app, args.include);
    },
    update: async (args: any) => {
      const idx = this.applications.findIndex((a) => a.id === args.where.id);
      if (idx !== -1) {
        if (
          args.where.version !== undefined &&
          this.applications[idx].version !== args.where.version
        ) {
          const err: any = new Error('Record to update not found or version conflict');
          err.code = 'P2025';
          throw err;
        }

        const data = { ...args.data };
        if (data.version && typeof data.version === 'object' && 'increment' in data.version) {
          data.version = this.applications[idx].version + data.version.increment;
        }

        this.applications[idx] = {
          ...this.applications[idx],
          ...data,
          updatedAt: new Date(),
        };
        return this.populateApplication(this.applications[idx], args.include);
      }
      return null;
    },
    count: async (args: any) => {
      const count = this.applications.filter((a) => {
        if (args.where?.candidateId && a.candidateId !== args.where.candidateId) return false;
        if (args.where?.jobId && a.jobId !== args.where.jobId) return false;
        if (args.where?.status && a.status !== args.where.status) return false;
        return true;
      }).length;
      return count;
    },
  };

  applicationStatusEvent = {
    findMany: async (args: any) => {
      const events = this.applicationStatusEvents.filter((e) => {
        if (args.where?.applicationId && e.applicationId !== args.where.applicationId) return false;
        return true;
      });
      events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
      return events;
    },
    create: async (args: any) => {
      const evt = {
        id: args.data.id || uuidv4(),
        ...args.data,
        occurredAt: new Date(),
      };
      this.applicationStatusEvents.push(evt);
      return evt;
    },
  };

  private populateApplication(app: any, include?: any): any {
    if (!include) return { ...app };
    const populated = { ...app };
    if (include.job) {
      const job = this.jobs.find((j) => j.id === app.jobId);
      if (job) {
        let jobObj = { ...job };
        if (include.job.include?.company) {
          const company = this.companies.find((c) => c.id === job.companyId);
          jobObj = { ...jobObj, company };
        }
        populated.job = jobObj;
      }
    }
    if (include.candidate) {
      const cand = this.candidateProfiles.find((c) => c.id === app.candidateId);
      if (cand) {
        const candObj = { ...cand };
        if (include.candidate.include?.skills) {
          const candSkills = this.candidateSkills.filter((cs) => cs.candidateProfileId === cand.id);
          candObj.skills = candSkills.map((cs) => {
            const skill = this.skills.find((s) => s.id === cs.skillId);
            return { ...cs, skill };
          });
        }
        populated.candidate = candObj;
      }
    }
    if (include.history) {
      populated.history = this.applicationStatusEvents
        .filter((e) => e.applicationId === app.id)
        .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    }
    return populated;
  }

  cv = {
    findUnique: async (args: any) => {
      const cv = this.cvs.find((c) => c.id === args.where.id) || null;
      if (!cv) return null;
      if (args.include?.candidateProfile) {
        const candidateProfile = this.candidateProfiles.find(
          (cp) => cp.id === cv.candidateProfileId,
        );
        return { ...cv, candidateProfile };
      }
      return cv;
    },
    findFirst: async (args: any) => {
      const result = this.cvs.filter((c) => {
        if (args.where?.id) {
          if (typeof args.where.id === 'object' && args.where.id.not) {
            if (c.id === args.where.id.not) return false;
          } else if (c.id !== args.where.id) {
            return false;
          }
        }
        if (
          args.where?.candidateProfileId &&
          c.candidateProfileId !== args.where.candidateProfileId
        )
          return false;
        if (args.where?.isDefault !== undefined && c.isDefault !== args.where.isDefault)
          return false;
        if (args.where?.processingStatus) {
          if (typeof args.where.processingStatus === 'object' && args.where.processingStatus.not) {
            if (c.processingStatus === args.where.processingStatus.not) return false;
          } else if (c.processingStatus !== args.where.processingStatus) {
            return false;
          }
        }
        return true;
      });

      if (args.orderBy) {
        const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        result.sort((a, b) => {
          for (const ord of orders) {
            for (const [key, dir] of Object.entries(ord)) {
              let valA = a[key];
              let valB = b[key];
              if (key === 'createdAt') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
              }
              if (valA < valB) return dir === 'asc' ? -1 : 1;
              if (valA > valB) return dir === 'asc' ? 1 : -1;
            }
          }
          return 0;
        });
      }

      return result[0] || null;
    },
    findMany: async (args: any) => {
      let result = this.cvs.filter((c) => {
        if (args.where?.id) {
          if (typeof args.where.id === 'object' && args.where.id.not) {
            if (c.id === args.where.id.not) return false;
          } else if (c.id !== args.where.id) {
            return false;
          }
        }
        if (
          args.where?.candidateProfileId &&
          c.candidateProfileId !== args.where.candidateProfileId
        )
          return false;
        if (args.where?.isDefault !== undefined && c.isDefault !== args.where.isDefault)
          return false;
        if (args.where?.processingStatus) {
          if (typeof args.where.processingStatus === 'object' && args.where.processingStatus.not) {
            if (c.processingStatus === args.where.processingStatus.not) return false;
          } else if (c.processingStatus !== args.where.processingStatus) {
            return false;
          }
        }
        return true;
      });

      if (args.orderBy) {
        const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        result.sort((a, b) => {
          for (const ord of orders) {
            for (const [key, dir] of Object.entries(ord)) {
              let valA = a[key];
              let valB = b[key];
              if (key === 'createdAt') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
              }
              if (valA < valB) return dir === 'asc' ? -1 : 1;
              if (valA > valB) return dir === 'asc' ? 1 : -1;
            }
          }
          return 0;
        });
      } else {
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      if (args.cursor?.id) {
        const idx = result.findIndex((c) => c.id === args.cursor.id);
        if (idx !== -1) {
          result = result.slice(idx + (args.skip || 0));
        }
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      return result;
    },
    create: async (args: any) => {
      const isDefault = args.data.isDefault ?? false;
      const processingStatus = args.data.processingStatus || 'UPLOADED';

      if (isDefault && processingStatus !== 'DELETED') {
        const conflict = this.cvs.find(
          (c) =>
            c.candidateProfileId === args.data.candidateProfileId &&
            c.isDefault === true &&
            c.processingStatus !== 'DELETED',
        );
        if (conflict) {
          const err: any = new Error(
            'Unique constraint failed on the fields: (`candidateProfileId`) WHERE isDefault = true AND processingStatus != DELETED',
          );
          err.code = 'P2002';
          throw err;
        }
      }

      const cv = {
        id: args.data.id || uuidv4(),
        candidateProfileId: args.data.candidateProfileId,
        originalFileName: args.data.originalFileName,
        mimeType: args.data.mimeType || 'application/pdf',
        sizeBytes: args.data.sizeBytes,
        checksumSha256: args.data.checksumSha256,
        storageKey: args.data.storageKey,
        extractedText: args.data.extractedText ?? null,
        processingStatus,
        failureCode: args.data.failureCode ?? null,
        latestOperationId: args.data.latestOperationId ?? null,
        extractionAttempts: args.data.extractionAttempts ?? 0,
        isDefault,
        version: args.data.version || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.cvs.push(cv);
      return cv;
    },
    update: async (args: any) => {
      const idx = this.cvs.findIndex((c) => c.id === args.where.id);
      if (idx !== -1) {
        const current = this.cvs[idx];
        const data = { ...args.data };
        if (data.version && typeof data.version === 'object' && 'increment' in data.version) {
          data.version = current.version + data.version.increment;
        }

        const nextIsDefault = data.isDefault !== undefined ? data.isDefault : current.isDefault;
        const nextStatus =
          data.processingStatus !== undefined ? data.processingStatus : current.processingStatus;

        if (nextIsDefault && nextStatus !== 'DELETED') {
          const conflict = this.cvs.find(
            (c) =>
              c.id !== current.id &&
              c.candidateProfileId === current.candidateProfileId &&
              c.isDefault === true &&
              c.processingStatus !== 'DELETED',
          );
          if (conflict) {
            const err: any = new Error(
              'Unique constraint failed on the fields: (`candidateProfileId`) WHERE isDefault = true AND processingStatus != DELETED',
            );
            err.code = 'P2002';
            throw err;
          }
        }

        this.cvs[idx] = {
          ...this.cvs[idx],
          ...data,
          updatedAt: new Date(),
        };
        return this.cvs[idx];
      }
      return null;
    },
    updateMany: async (args: any) => {
      let count = 0;
      for (let i = 0; i < this.cvs.length; i++) {
        const c = this.cvs[i];
        let matches = true;
        if (
          args.where?.candidateProfileId &&
          c.candidateProfileId !== args.where.candidateProfileId
        )
          matches = false;
        if (
          args.where?.id &&
          typeof args.where.id === 'object' &&
          args.where.id.not &&
          c.id === args.where.id.not
        )
          matches = false;
        if (matches) {
          this.cvs[i] = { ...this.cvs[i], ...args.data, updatedAt: new Date() };
          count++;
        }
      }
      return { count };
    },
    delete: async (args: any) => {
      const idx = this.cvs.findIndex((c) => c.id === args.where.id);
      if (idx !== -1) {
        return this.cvs.splice(idx, 1)[0];
      }
      return null;
    },
  };

  interview = {
    findUnique: async (args: any) => {
      const interview = this.interviews.find((i) => i.id === args.where.id);
      if (!interview) return null;
      return this.populateInterview(interview, args.include);
    },
    findMany: async (args: any) => {
      let result = this.interviews.filter((i) => {
        if (args.where?.applicationId && i.applicationId !== args.where.applicationId) return false;
        if (args.where?.status && i.status !== args.where.status) return false;
        return true;
      });
      result.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

      if (args.cursor?.id) {
        const idx = result.findIndex((i) => i.id === args.cursor.id);
        if (idx !== -1) {
          result = result.slice(idx + (args.skip || 0));
        }
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      return result.map((i) => this.populateInterview(i, args.include));
    },
    create: async (args: any) => {
      const interview = {
        id: args.data.id || uuidv4(),
        applicationId: args.data.applicationId,
        status: args.data.status || 'SCHEDULED',
        startsAt: new Date(args.data.startsAt),
        endsAt: new Date(args.data.endsAt),
        locationOrMeetingUrl: args.data.locationOrMeetingUrl,
        candidateInstructions: args.data.candidateInstructions ?? null,
        recruiterPrivateNotes: args.data.recruiterPrivateNotes ?? null,
        recruiterFeedback: args.data.recruiterFeedback ?? null,
        cancelReason: args.data.cancelReason ?? null,
        version: args.data.version || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.interviews.push(interview);
      return this.populateInterview(interview, args.include);
    },
    update: async (args: any) => {
      const idx = this.interviews.findIndex((i) => i.id === args.where.id);
      if (idx !== -1) {
        const data = { ...args.data };
        if (data.startsAt) data.startsAt = new Date(data.startsAt);
        if (data.endsAt) data.endsAt = new Date(data.endsAt);
        if (data.version && typeof data.version === 'object' && 'increment' in data.version) {
          data.version = this.interviews[idx].version + data.version.increment;
        }
        this.interviews[idx] = {
          ...this.interviews[idx],
          ...data,
          updatedAt: new Date(),
        };
        return this.populateInterview(this.interviews[idx], args.include);
      }
      return null;
    },
  };

  private populateInterview(interview: any, include?: any): any {
    if (!include) return { ...interview };
    const populated = { ...interview };
    if (include.application) {
      const app = this.applications.find((a) => a.id === interview.applicationId);
      if (app) {
        populated.application = this.populateApplication(app, include.application.include);
      }
    }
    return populated;
  }

  notification = {
    findUnique: async (args: any) => {
      return this.notifications.find((n) => n.id === args.where.id) || null;
    },
    findFirst: async (args: any) => {
      return (
        this.notifications.find((n) => {
          if (args.where?.userId && n.userId !== args.where.userId) return false;
          if (args.where?.type && n.type !== args.where.type) return false;
          if (args.where?.resourceType !== undefined && n.resourceType !== args.where.resourceType)
            return false;
          if (args.where?.resourceId !== undefined && n.resourceId !== args.where.resourceId)
            return false;
          return true;
        }) || null
      );
    },
    findMany: async (args: any) => {
      let result = this.notifications.filter((n) => {
        if (args.where?.userId && n.userId !== args.where.userId) return false;
        if (args.where?.readAt === null && n.readAt !== null) return false;
        if (
          args.where?.readAt &&
          typeof args.where.readAt === 'object' &&
          args.where.readAt.not === null &&
          n.readAt === null
        )
          return false;
        return true;
      });

      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (args.cursor?.id) {
        const idx = result.findIndex((n) => n.id === args.cursor.id);
        if (idx !== -1) {
          result = result.slice(idx + (args.skip || 0));
        }
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      return result;
    },
    create: async (args: any) => {
      const notif = {
        id: args.data.id || uuidv4(),
        userId: args.data.userId,
        type: args.data.type,
        title: args.data.title,
        body: args.data.body,
        resourceType: args.data.resourceType ?? null,
        resourceId: args.data.resourceId ?? null,
        readAt: args.data.readAt ?? null,
        createdAt: new Date(),
      };
      this.notifications.push(notif);
      return notif;
    },
    update: async (args: any) => {
      const idx = this.notifications.findIndex((n) => n.id === args.where.id);
      if (idx !== -1) {
        this.notifications[idx] = {
          ...this.notifications[idx],
          ...args.data,
        };
        return this.notifications[idx];
      }
      return null;
    },
    updateMany: async (args: any) => {
      let count = 0;
      for (let i = 0; i < this.notifications.length; i++) {
        if (args.where?.userId && this.notifications[i].userId === args.where.userId) {
          this.notifications[i] = { ...this.notifications[i], ...args.data };
          count++;
        }
      }
      return { count };
    },
    count: async (args: any) => {
      return this.notifications.filter((n) => {
        if (args.where?.userId && n.userId !== args.where.userId) return false;
        if (args.where?.readAt === null && n.readAt !== null) return false;
        return true;
      }).length;
    },
  };

  auditLog = {
    findMany: async (args: any) => {
      return this.auditLogs.filter((l) => {
        if (args.where?.actorId && l.actorId !== args.where.actorId) return false;
        if (args.where?.action && l.action !== args.where.action) return false;
        if (args.where?.targetType && l.targetType !== args.where.targetType) return false;
        if (args.where?.targetId && l.targetId !== args.where.targetId) return false;
        return true;
      });
    },
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

  operation = {
    findUnique: async (args: any) => {
      return this.operations.find((o) => o.id === args.where.id) || null;
    },
    findFirst: async (args: any) => {
      return (
        this.operations.find((o) => {
          if (args.where?.id && o.id !== args.where.id) return false;
          if (args.where?.userId && o.userId !== args.where.userId) return false;
          if (args.where?.idempotencyKey && o.idempotencyKey !== args.where.idempotencyKey)
            return false;
          return true;
        }) || null
      );
    },
    findMany: async (args: any) => {
      return this.operations.filter((o) => {
        if (args.where?.userId && o.userId !== args.where.userId) return false;
        if (args.where?.status && o.status !== args.where.status) return false;
        if (args.where?.type && typeof args.where.type === 'object' && args.where.type.in) {
          if (!args.where.type.in.includes(o.type)) return false;
        } else if (args.where?.type && o.type !== args.where.type) {
          return false;
        }
        if (
          args.where?.createdAt?.lt &&
          new Date(o.createdAt).getTime() >= new Date(args.where.createdAt.lt).getTime()
        ) {
          return false;
        }
        return true;
      });
    },
    create: async (args: any) => {
      const op = {
        id: args.data.id || uuidv4(),
        userId: args.data.userId ?? null,
        type: args.data.type,
        status: args.data.status || 'QUEUED',
        progressPercent: args.data.progressPercent ?? null,
        resultResourceType: args.data.resultResourceType ?? null,
        resultResourceId: args.data.resultResourceId ?? null,
        failureCode: args.data.failureCode ?? null,
        failureMessage: args.data.failureMessage ?? null,
        idempotencyKey: args.data.idempotencyKey ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: args.data.completedAt ? new Date(args.data.completedAt) : null,
      };
      this.operations.push(op);
      return op;
    },
    update: async (args: any) => {
      const idx = this.operations.findIndex((o) => o.id === args.where.id);
      if (idx !== -1) {
        this.operations[idx] = {
          ...this.operations[idx],
          ...args.data,
          updatedAt: new Date(),
          completedAt: args.data.completedAt
            ? new Date(args.data.completedAt)
            : this.operations[idx].completedAt,
        };
        return this.operations[idx];
      }
      return null;
    },
  };

  aiAnalysis = {
    findUnique: async (args: any) => {
      const analysis = this.aiAnalyses.find((a) => a.id === args.where.id) || null;
      if (!analysis) return null;
      const res = { ...analysis };
      if (args.include?.candidate) {
        res.candidate = this.candidateProfiles.find((cp) => cp.id === analysis.candidateId);
      }
      if (args.include?.cv) {
        res.cv = this.cvs.find((c) => c.id === analysis.cvId);
      }
      if (args.include?.job && analysis.jobId) {
        res.job = this.jobs.find((j) => j.id === analysis.jobId);
      }
      return res;
    },
    findFirst: async (args: any) => {
      return (
        this.aiAnalyses.find((a) => {
          if (args.where?.id && a.id !== args.where.id) return false;
          if (args.where?.candidateId && a.candidateId !== args.where.candidateId) return false;
          if (args.where?.cvId && a.cvId !== args.where.cvId) return false;
          if (args.where?.jobId && a.jobId !== args.where.jobId) return false;
          return true;
        }) || null
      );
    },
    findMany: async (args: any) => {
      return this.aiAnalyses.filter((a) => {
        if (args.where?.candidateId && a.candidateId !== args.where.candidateId) return false;
        if (args.where?.cvId && a.cvId !== args.where.cvId) return false;
        if (args.where?.jobId && a.jobId !== args.where.jobId) return false;
        return true;
      });
    },
    create: async (args: any) => {
      const item = {
        id: args.data.id || uuidv4(),
        type: args.data.type,
        candidateId: args.data.candidateId,
        cvId: args.data.cvId,
        jobId: args.data.jobId ?? null,
        status: args.data.status || 'SUCCEEDED',
        overallScore: args.data.overallScore ?? null,
        components: args.data.components ?? [],
        matchedSkills: args.data.matchedSkills ?? [],
        missingSkills: args.data.missingSkills ?? [],
        unmetRequirements: args.data.unmetRequirements ?? [],
        suggestions: args.data.suggestions ?? [],
        limitations: args.data.limitations ?? [],
        model: args.data.model || 'gemini-1.5-flash',
        promptVersion: args.data.promptVersion || 'v1.0',
        schemaVersion: args.data.schemaVersion || 'v1.0',
        createdAt: new Date(),
      };
      this.aiAnalyses.push(item);
      return item;
    },
  };

  recommendationPreference = {
    findUnique: async (args: any) => {
      if (args.where.id) {
        return this.recommendationPreferences.find((p) => p.id === args.where.id) || null;
      }
      if (args.where.userId) {
        return this.recommendationPreferences.find((p) => p.userId === args.where.userId) || null;
      }
      return null;
    },
    findFirst: async (args: any) => {
      if (!args?.where) return this.recommendationPreferences[0] || null;
      return (
        this.recommendationPreferences.find((p) => {
          if (args.where.userId && p.userId !== args.where.userId) return false;
          return true;
        }) || null
      );
    },
    create: async (args: any) => {
      const pref = {
        id: args.data.id || uuidv4(),
        userId: args.data.userId,
        enabled: args.data.enabled !== undefined ? args.data.enabled : true,
        consentPolicyVersion: args.data.consentPolicyVersion || 'v1.0',
        consentedAt: args.data.consentedAt || new Date(),
        version: args.data.version || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.recommendationPreferences.push(pref);
      return pref;
    },
    update: async (args: any) => {
      const idx = this.recommendationPreferences.findIndex(
        (p) =>
          (args.where.id && p.id === args.where.id) ||
          (args.where.userId && p.userId === args.where.userId),
      );
      if (idx === -1) throw new Error('RecommendationPreference not found');
      const cur = this.recommendationPreferences[idx];
      const updated = {
        ...cur,
        ...args.data,
        version:
          typeof args.data.version === 'object' && args.data.version.increment
            ? cur.version + args.data.version.increment
            : args.data.version !== undefined
              ? args.data.version
              : cur.version + 1,
        updatedAt: new Date(),
      };
      this.recommendationPreferences[idx] = updated;
      return updated;
    },
    upsert: async (args: any) => {
      const existing = await this.recommendationPreference.findUnique(args);
      if (existing) {
        return this.recommendationPreference.update({
          where: args.where,
          data: args.update,
        });
      }
      return this.recommendationPreference.create({
        data: {
          ...args.create,
          ...args.where,
        },
      });
    },
  };

  idempotencyRecord = {
    findUnique: async (args: any) => {
      if (args.where.id) {
        return this.idempotencyRecords.find((r) => r.id === args.where.id) || null;
      }
      if (args.where.actorId_method_route_key) {
        const { actorId, method, route, key } = args.where.actorId_method_route_key;
        return (
          this.idempotencyRecords.find(
            (r) =>
              r.actorId === actorId && r.method === method && r.route === route && r.key === key,
          ) || null
        );
      }
      return null;
    },
    findFirst: async (args?: any) => {
      return (
        this.idempotencyRecords.find((r) => {
          if (args?.where?.id && r.id !== args.where.id) return false;
          if (args?.where?.actorId && r.actorId !== args.where.actorId) return false;
          if (args?.where?.method && r.method !== args.where.method) return false;
          if (args?.where?.route && r.route !== args.where.route) return false;
          if (args?.where?.key && r.key !== args.where.key) return false;
          if (args?.where?.status && r.status !== args.where.status) return false;
          return true;
        }) || null
      );
    },
    create: async (args: any) => {
      const { actorId, method, route, key } = args.data;
      const conflict = this.idempotencyRecords.find(
        (r) => r.actorId === actorId && r.method === method && r.route === route && r.key === key,
      );
      if (conflict) {
        const err: any = new Error('Unique constraint failed on (actorId, method, route, key)');
        err.code = 'P2002';
        throw err;
      }

      const now = this.clock ? this.clock() : new Date();
      const record = {
        id: args.data.id || uuidv4(),
        ...args.data,
        status: args.data.status || 'IN_PROGRESS',
        responseStatus: args.data.responseStatus ?? null,
        responseBody: args.data.responseBody ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.idempotencyRecords.push(record);
      return record;
    },
    update: async (args: any) => {
      const now = this.clock ? this.clock() : new Date();
      const idx = this.idempotencyRecords.findIndex((r) => r.id === args.where.id);
      if (idx !== -1) {
        this.idempotencyRecords[idx] = {
          ...this.idempotencyRecords[idx],
          ...args.data,
          updatedAt: now,
        };
        return this.idempotencyRecords[idx];
      }
      return null;
    },
    delete: async (args: any) => {
      const idx = this.idempotencyRecords.findIndex((r) => r.id === args.where.id);
      if (idx !== -1) {
        return this.idempotencyRecords.splice(idx, 1)[0];
      }
      return null;
    },
    deleteMany: async (args: any) => {
      const initialLen = this.idempotencyRecords.length;
      this.idempotencyRecords = this.idempotencyRecords.filter((r) => {
        if (args?.where?.expiresAt?.lt) {
          if (new Date(r.expiresAt).getTime() < new Date(args.where.expiresAt.lt).getTime()) {
            return false;
          }
        }
        return true;
      });
      return { count: initialLen - this.idempotencyRecords.length };
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
