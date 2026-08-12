import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "@pinus/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyUsers(userIds: string[], title: string, message: string) {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        message,
        channel: NotificationChannel.IN_APP,
      })),
    });
    // Email delivery is a Phase 2 enhancement per PRD roadmap; log for now so
    // the notification is still observable end-to-end without a mock SMTP dep.
    this.logger.log(`Notified ${userIds.length} user(s): ${title}`);
  }

  async notifyRoles(roles: string[], title: string, message: string) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles as never }, isActive: true },
      select: { id: true },
    });
    await this.notifyUsers(users.map((u) => u.id), title, message);
  }

  findForUser(userId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
