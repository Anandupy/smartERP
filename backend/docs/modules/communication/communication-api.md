# Communication Infrastructure API Reference

The Communication Infrastructure exposes RESTful endpoints for managing communication templates, system settings, user notification preferences, in-app notifications, operational delivery logs, and OTP verification.

All API endpoints follow project standards:
- OpenAPI / Swagger documentation (`@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`).
- Strict DTO validation (`class-validator`, `class-transformer`).
- JWT authentication (`JwtAuthGuard`) and Role-Based Access Control (`RolesGuard`).
- Tenant, Branch, and Academic Year context isolation via request context.

---

## Endpoint Summary Table

| Category | HTTP Method | Endpoint Path | Description | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Templates** | `POST` | `/v1/communication/templates` | Create a new communication template | `SUPER_ADMIN`, `ORG_ADMIN` |
| | `GET` | `/v1/communication/templates` | List filtered templates | `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN` |
| | `GET` | `/v1/communication/templates/:id` | Get template details | `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN` |
| | `PATCH` | `/v1/communication/templates/:id` | Update template parameters | `SUPER_ADMIN`, `ORG_ADMIN` |
| | `POST` | `/v1/communication/templates/preview` | Render template preview with variables | Admin Roles |
| **OTP** | `POST` | `/v1/communication/otp/generate` | Generate OTP for purpose | Public / Internal Service |
| | `POST` | `/v1/communication/otp/verify` | Verify provided OTP token | Public / Authenticated |
| **Notifications** | `GET` | `/v1/communication/notifications` | List user in-app notifications | Authenticated User |
| | `POST` | `/v1/communication/notifications` | Create in-app notification | Admin / System |
| | `PATCH` | `/v1/communication/notifications/:id/read` | Mark notification as read | Authenticated User |
| | `PATCH` | `/v1/communication/notifications/read-all` | Mark all notifications as read | Authenticated User |
| | `PATCH` | `/v1/communication/notifications/:id/archive` | Archive notification | Authenticated User |
| **Preferences** | `GET` | `/v1/communication/preferences` | Get user channel preferences | Authenticated User |
| | `PATCH` | `/v1/communication/preferences` | Update category channel preference | Authenticated User |
| **Delivery Logs**| `GET` | `/v1/communication/delivery-logs` | Query message delivery logs | `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN` |
| | `GET` | `/v1/communication/delivery-logs/analytics` | Operational delivery metrics | `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN` |
| **Settings** | `GET` | `/v1/communication/settings` | Get active communication settings | Admin Roles |
| | `PATCH` | `/v1/communication/settings` | Update channel/provider settings | `SUPER_ADMIN`, `ORG_ADMIN` |

---

## Detailed Payload Examples

### 1. Create Template DTO (`POST /v1/communication/templates`)
```json
{
  "code": "FEE_PAID_RECEIPT",
  "name": "Fee Payment Receipt Notification",
  "channel": "EMAIL",
  "category": "FEES",
  "subject": "Payment Confirmation - Receipt #{{receiptNo}}",
  "bodyHtml": "<h2>Dear {{studentName}},</h2><p>Thank you for your payment of {{currency}} {{amount}} towards {{feeCategory}}.</p>",
  "variables": ["studentName", "receiptNo", "currency", "amount", "feeCategory"],
  "language": "en",
  "status": "PUBLISHED"
}
```

### 2. Verify OTP DTO (`POST /v1/communication/otp/verify`)
```json
{
  "identifier": "user@example.com",
  "purpose": "PASSWORD_RESET",
  "otp": "482910"
}
```
*Response*:
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```
