Before I generate the prompt, I have a few architecture questions. These will determine whether Stitch designs the correct module.

From your Postman collection I can already see you have APIs for:

* OTP
* Notification Preferences
* In-App Notifications
* Notification Inbox
* Notification History
* Notification Delivery Logs
* Read / Archive / Pin actions
* Multi-channel communication (Email, SMS, WhatsApp, Push)  

I don't want Stitch to generate the wrong screens.

---

## 1. Is this module for Super Admin only or everyone?

Should the Communication module be available to:

* Super Admin only
* Organization Admin
* Branch Admin
* Teachers
* Finance
* HR
* Students
* Parents

or

different dashboards depending on role?

---

## 2. Notification Center vs Communication Center

Should these be two different modules?

Example

### Communication

Everything related to sending

* Email Campaigns
* SMS
* WhatsApp
* Push
* Templates
* Automation
* Scheduled Messages
* Broadcast
* Audience
* Delivery Reports
* Providers
* Queues

---

### Notifications

Everything related to receiving

* Inbox
* Read
* Archive
* Pin
* Mark All Read
* Preferences
* Notification Center

Personally I would separate them because that's how enterprise systems work.

---

## 3. Email Template Builder

How advanced do you want this?

### Basic

Subject

Body

Variables

Preview

---

### Enterprise

Drag & Drop Builder

Reusable Components

Header

Footer

Brand Colors

Dynamic Variables

Conditional Blocks

Multi-language

Version History

Approval Workflow

Dark Mode Email

Mobile Preview

Desktop Preview

HTML Preview

Plain Text Preview

Spam Score

Template Testing

Send Test Email

Template Categories

---

I strongly recommend Enterprise.

---

## 4. Providers

Should provider configuration be inside this module?

For example

Email

* SMTP
* Gmail
* SendGrid
* SES
* Mailgun
* Postmark
* Resend

SMS

* Twilio
* MSG91
* TextLocal
* Fast2SMS

WhatsApp

* Meta
* Twilio
* Gupshup
* Interakt

Push

* Firebase
* OneSignal

---

## 5. Automation

Do you want visual automation?

Like

Admission Approved

↓

Generate Welcome Email

↓

Send WhatsApp

↓

Generate Fee Schedule

↓

Create Notification

↓

Assign Student

↓

Create Audit Log

Kind of like Zapier or Power Automate.

This would be amazing for ERP.

---

## 6. Campaign Module

Should there be campaigns?

Example

Exam Reminder

Fee Reminder

Holiday

Emergency Notice

Admissions

Marketing

Newsletter

Birthday Wishes

Result Published

Attendance Alert

---

## 7. Audience Builder

Should admin be able to send to

Entire Organization

Entire Branch

Specific Class

Division

Department

Teachers

Parents

Students

Staff

Individual Users

Dynamic Filters

Saved Audiences

---

## 8. Notification Templates

Separate from Email templates?

Meaning

Notification Template

SMS Template

WhatsApp Template

Email Template

Push Template

Each channel optimized separately.

---

## 9. Analytics

How deep?

Simple

* Sent
* Delivered
* Failed

or

Enterprise

* Open Rate
* Click Rate
* Delivery Time
* Bounce
* Spam
* Device
* Browser
* Heatmaps
* Engagement
* Queue Performance
* Provider Comparison
* Cost Analytics

---

## 10. Communication Hub Dashboard

Should the landing page include cards like

* Messages Sent Today
* Active Campaigns
* Failed Deliveries
* Queue Status
* Scheduled Jobs
* Templates
* Provider Health
* Notification Trends
* Channel Usage
* Email Performance
* SMS Usage
* WhatsApp Usage
* Push Usage
* Recent Activity
* Automation Runs

---

## 11. Queue Visibility

Since your ERP is event-driven with Bull queues for notifications and background jobs, should admins be able to see queue status (Queued, Processing, Failed, Completed, Retry)? This aligns with your architecture for asynchronous communication. 

---

## 12. My recommendation

If this is going to be one of the flagship CampusFlow modules, I would structure it like this:

```
Communication Hub
│
├── Dashboard
├── Inbox
├── Broadcast
├── Campaigns
├── Templates
│     ├── Email
│     ├── SMS
│     ├── WhatsApp
│     ├── Push
│     └── In-App
├── Automation
├── Scheduled Messages
├── Audiences
├── Delivery Logs
├── Notification Center
├── Preferences
├── Queue Monitor
├── Providers
├── Analytics
├── Branding
└── Settings
```

This architecture is scalable enough that five years from now you could add Microsoft Teams, Slack, Voice Calls, Webhooks, or any new communication channel without redesigning the module.

Once you answer these questions, I'll produce a **very detailed (3000–5000+ words) Stitch prompt** that:

* preserves the existing CampusFlow design system (no redesign),
* uses your current Soft Enterprise UI,
* maps directly to your backend APIs,
* includes every page, dialog, table, filter, drawer, wizard, analytics view, and email template builder,
* and is designed to scale as an enterprise communication platform.
