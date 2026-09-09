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

  reset() {
    this.users = [];
    this.refreshSessions = [];
    this.candidateProfiles = [];
    this.skills = [];
    this.candidateSkills = [];
    this.workExperiences = [];
    this.companies = [];
    this.companyMemberships = [];
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
        if (args.where?.experienceLevel && j.experienceLevel !== args.where.experienceLevel)
          return false;
        if (args.where?.employmentType && j.employmentType !== args.where.employmentType)
          return false;
        if (args.where?.workplaceType && j.workplaceType !== args.where.workplaceType) return false;
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
        return true;
      });

      if (args.orderBy) {
        const orderKey = Object.keys(args.orderBy)[0];
        const direction = args.orderBy[orderKey];
        result.sort((a, b) => {
          if (direction === 'desc') {
            return a[orderKey] < b[orderKey] ? 1 : -1;
          }
          return a[orderKey] > b[orderKey] ? 1 : -1;
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
      return (
        this.cvs.find((c) => {
          if (args.where?.id && c.id !== args.where.id) return false;
          if (
            args.where?.candidateProfileId &&
            c.candidateProfileId !== args.where.candidateProfileId
          )
            return false;
          if (args.where?.isDefault !== undefined && c.isDefault !== args.where.isDefault)
            return false;
          if (args.where?.processingStatus) {
            if (
              typeof args.where.processingStatus === 'object' &&
              args.where.processingStatus.not
            ) {
              if (c.processingStatus === args.where.processingStatus.not) return false;
            } else if (c.processingStatus !== args.where.processingStatus) {
              return false;
            }
          }
          return true;
        }) || null
      );
    },
    findMany: async (args: any) => {
      let result = this.cvs.filter((c) => {
        if (
          args.where?.candidateProfileId &&
          c.candidateProfileId !== args.where.candidateProfileId
        )
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

      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      const cv = {
        id: args.data.id || uuidv4(),
        candidateProfileId: args.data.candidateProfileId,
        originalFileName: args.data.originalFileName,
        mimeType: args.data.mimeType || 'application/pdf',
        sizeBytes: args.data.sizeBytes,
        checksumSha256: args.data.checksumSha256,
        storageKey: args.data.storageKey,
        extractedText: args.data.extractedText ?? null,
        processingStatus: args.data.processingStatus || 'UPLOADED',
        failureCode: args.data.failureCode ?? null,
        isDefault: args.data.isDefault ?? false,
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
        const data = { ...args.data };
        if (data.version && typeof data.version === 'object' && 'increment' in data.version) {
          data.version = this.cvs[idx].version + data.version.increment;
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
