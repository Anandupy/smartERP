# Communication Infrastructure Testing Strategy

Testing in the Communication Infrastructure adheres strictly to `testing-architecture.md` and `testing-safety.md`.

---

## 1. Core Testing Guidelines

1. **Zero Real Network / SMTP Outbound Calls**: External email SMTP servers, Twilio API endpoints, Meta WhatsApp nodes, and Firebase Cloud Messaging servers are 100% mocked using Jest mocks or stub providers during unit, integration, and e2e testing.
2. **Database Sandbox Safety**: All database integration tests use the sandbox safety guard (`safety.guard.ts`), confirming `NODE_ENV === 'test'` and validating connection strings against live keywords.
3. **High Code & Scenario Coverage**: Tests cover happy paths, validation errors, duplicate code conflicts, missing template variables, OTP attempt lockouts, expired tokens, and preference opt-out evaluations.

---

## 2. Test Suite Map

| Test Suite File | Tested Component | Key Assertions |
| :--- | :--- | :--- |
| `renderer/template-renderer.spec.ts` | `HandlebarsTemplateRenderer` | Variable substitution, mustache syntax, missing variable array extraction. |
| `templates/template.service.spec.ts` | `TemplateService` | Template CRUD, duplicate code validation, hierarchical fallback (`Branch -> Org -> Global`). |
| `otp/otp.service.spec.ts` | `OtpService` | Raw OTP generation length, SHA-256 hash storage verification, attempt counter lockout, resend cooldown. |
| `notification/in-app-notification.service.spec.ts` | `InAppNotificationService` | In-App notification creation, user filter queries, unread count calculations, mark-as-read. |
| `preferences/notification-preference.service.spec.ts` | `NotificationPreferenceService` | Category preferences, mandatory channel enforcement for `AUTHENTICATION`. |
| `delivery-log/delivery-log.service.spec.ts` | `DeliveryLogService` | Operational delivery attempt creation, status transition updates, delivery/failure/bounce percentage calculations. |

---

## 3. Running Communication Tests

```bash
# Unit tests matching communication
pnpm run test communication

# Run unit test suite with coverage
pnpm run test:cov
```
