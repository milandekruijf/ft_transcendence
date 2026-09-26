import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { resolveUserDisplayName, resolveUserLocale } from '@repo/schemas/users';
import { DATABASE } from '../database/database.constants';
import type { Database } from '../database/database.types';
import { users, events, registrations } from '@repo/schemas/database';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { NotificationService } from './notification.service';
import { isActiveRegistration } from '../registrations/registration.conditions';
import moment from 'moment-timezone';

const EVENT_TIMEZONE = 'UTC';
const REMINDER_WINDOW_MINUTES = 30;

@Injectable()
export class NotificationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationScheduler.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly notificationService: NotificationService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  onModuleInit() {
    this.logger.log('Background 24-Hour Pre-Event Friendly Reminder scheduler activated.');
    void this.runReminderCheckSweep();

    this.intervalId = setInterval(
      () => {
        void this.runReminderCheckSweep();
      },
      60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private formatEventDateTime(dateTime: Date): { dateString: string; timeString: string } {
    const eventDateTime = moment.utc(dateTime);
    return {
      dateString: eventDateTime.format('YYYY-MM-DD'),
      timeString: eventDateTime.format('HH:mm'),
    };
  }

  private async runReminderCheckSweep() {
    try {
      const now = moment.tz(EVENT_TIMEZONE);
      const targetStart = now
        .clone()
        .add(24, 'hours')
        .subtract(REMINDER_WINDOW_MINUTES, 'minutes')
        .toDate();
      const targetEnd = now
        .clone()
        .add(24, 'hours')
        .add(REMINDER_WINDOW_MINUTES, 'minutes')
        .toDate();
      const eventDateTimeUtc = sql<Date>`${events.dateTime} AT TIME ZONE 'UTC'`;

      const records = await this.db
        .select({
          eventId: registrations.eventId,
          userEmail: users.email,
          userPreferedLanguage: users.preferedLanguage,
          userName: users.name,
          userUsername: users.username,
          eventTitle: events.title,
          eventDateTime: eventDateTimeUtc,
          eventLocation: events.location,
          eventAddress: events.address,
        })
        .from(registrations)
        .innerJoin(events, eq(registrations.eventId, events.id))
        .innerJoin(users, eq(registrations.userId, users.id))
        .where(
          and(
            isActiveRegistration,
            gte(eventDateTimeUtc, targetStart),
            lte(eventDateTimeUtc, targetEnd),
          ),
        );

      if (records.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${records.length} upcoming active registrations matching reminder window bounds.`,
      );

      for (const record of records) {
        const userLang = resolveUserLocale(record.userPreferedLanguage);
        const userName = resolveUserDisplayName({
          name: record.userName,
          username: record.userUsername,
        });
        const { dateString, timeString } = this.formatEventDateTime(record.eventDateTime);

        await this.notificationService.sendFriendlyReminderEmail(
          record.userEmail,
          userName,
          record.eventTitle,
          dateString,
          timeString,
          record.eventLocation,
          record.eventAddress,
          userLang,
        );
      }
    } catch (error) {
      this.logger.error('Failed to execute background reminder check database query sweep:', error);
    }
  }
}
