# In-App Notification Center Architecture

The **In-App Notification Center** provides real-time and persistent in-app notifications for users across web and mobile ERP client interfaces.

---

## 1. Feature Specifications

- **Notification States**: `UNREAD`, `READ`, `ARCHIVED`.
- **Pinning**: `isPinned = true` keeps critical announcements pinned at the top of the user feed regardless of creation date.
- **Priority Levels**: `LOW`, `NORMAL`, `HIGH`, `URGENT`.
- **Action Links**: `actionUrl` supports deep-linking into specific UI routes (e.g. `/admissions/applicants/app-100`).
- **Metadata**: JSON payload for contextual parameters (e.g. `applicantId`, `receiptId`).

---

## 2. Notification Center API Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Client as Frontend Client
    participant Controller as InAppNotificationController
    participant Service as InAppNotificationService
    participant DB as PostgreSQL (InAppNotification)

    Client->>Controller: GET /v1/communication/notifications?status=UNREAD
    Controller->>Service: getUserNotifications(userId, query)
    Service->>DB: findMany(orderBy: [isPinned: desc, createdAt: desc])
    DB-->>Service: notifications & unreadCount
    Service-->>Controller: { data: [...], meta: { total, unreadCount } }
    Controller-->>Client: 200 OK Response

    Client->>Controller: PATCH /v1/communication/notifications/:id/read
    Controller->>Service: markAsRead(id, userId)
    Service->>DB: update(status: READ, readAt: now())
    DB-->>Service: updated notification
    Service-->>Controller: updated record
    Controller-->>Client: 200 OK Response
```
