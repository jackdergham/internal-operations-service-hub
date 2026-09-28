import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma.service.js'
import type { NotificationItem } from './notifications.types.js'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForActor(recipientId: string): Promise<NotificationItem[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      requestId: notification.requestId,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    }))
  }

  async create(input: {
    recipientId: string
    type: string
    title: string
    message: string
    requestId?: string
  }): Promise<void> {
    await this.prisma.notification.create({
      data: { id: randomUUID(), ...input },
    })
  }

  async markRead(notificationId: string, recipientId: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId },
      data: { readAt: new Date() },
    })
    if (result.count === 0) throw new NotFoundException('Notification not found')
  }
}