import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { DomainEvent } from '@/common/events/domain-event.base';
import { AuditRepository } from './audit.repository';
import { AuditEventMapper } from './audit-event.mapper';

@Injectable()
export class AuditListener implements OnModuleInit {
  private readonly logger = new Logger(AuditListener.name);
  private readonly registeredEventNames = new Set<string>([
    'student.created',
    'student.updated',
    'student.deleted',
    'organization.created',
    'organization.updated',
    'organization.deleted',
    'branch.created',
    'branch.updated',
    'branch.deleted',
    'academic_year.created',
    'academic_year.updated',
    'academic_year.deleted',
    'academic_unit.created',
    'academic_unit.updated',
    'academic_unit.deleted',
    'program.created',
    'program.updated',
    'program.deleted',
    'user.logged_in',
    'user.created',
    'user.updated',
    'user.deleted',
    'system_settings.updated',
    'applicant.created',
    'applicant.updated',
    'applicant.deleted',
    'guardian.created',
    'guardian.updated',
    'guardian.mapped',
    'guardian.unmapped',
    'admission.transitioned',
    'enrollment.completed',
    'numbering_config.created',
    'admissions_master.created',
    'admissions_master.updated',
    'admissions_master.deleted',
  ]);

  constructor(
    private readonly eventBus: EventBus,
    private readonly auditRepository: AuditRepository,
    private readonly auditEventMapper: AuditEventMapper,
  ) {}

  onModuleInit() {
    this.registerSubscribers();
  }

  registerSubscribers() {
    for (const eventName of this.registeredEventNames) {
      this.eventBus.subscribe(eventName, this.handleDomainEvent.bind(this));
    }
    this.logger.log(
      `AuditListener registered for ${this.registeredEventNames.size} domain event types.`,
    );
  }

  listenToEvent(eventName: string) {
    if (!this.registeredEventNames.has(eventName)) {
      this.registeredEventNames.add(eventName);
      this.eventBus.subscribe(eventName, this.handleDomainEvent.bind(this));
      this.logger.log(
        `AuditListener dynamically registered for event: ${eventName}`,
      );
    }
  }

  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const auditLogInput = this.auditEventMapper.mapToAuditLog(event);
      await this.auditRepository.createAuditLog(auditLogInput);
    } catch (error) {
      this.logger.error(
        `AuditListener error processing event "${event.eventName}":`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
