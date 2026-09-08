import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = this.normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { email: normalized },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    role: UserRole;
    status?: UserStatus;
  }): Promise<User> {
    const normalizedEmail = this.normalizeEmail(data.email);
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        role: data.role,
        status: data.status ?? UserStatus.ACTIVE,
      },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }
}
