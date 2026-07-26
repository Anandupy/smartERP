# Template Engine & Multi-Tenant Override Architecture

CampusFlow ERP incorporates a multi-channel template engine supporting dynamic variable substitution, versioning, status governance (`DRAFT`, `PUBLISHED`, `ARCHIVED`), and hierarchical multi-tenant overrides.

---

## 1. Hierarchical Template Resolution Sequence

When a message dispatch occurs, `TemplateService.resolveTemplate(code, channel, context)` resolves templates according to the following order:

```mermaid
graph TD
    Start[Request Template: code & channel] --> CheckBranch{Branch ID Provided?}
    CheckBranch -->|Yes| BranchQuery[Query DB: code + channel + orgId + branchId]
    BranchQuery -->|Found Published| FoundBranch[Use Branch Specific Template]
    BranchQuery -->|Not Found| CheckOrg
    CheckBranch -->|No| CheckOrg{Org ID Provided?}

    CheckOrg -->|Yes| OrgQuery[Query DB: code + channel + orgId + branchId IS NULL]
    OrgQuery -->|Found Published| FoundOrg[Use Organization Specific Template]
    OrgQuery -->|Not Found| GlobalQuery
    CheckOrg -->|No| GlobalQuery[Query DB: code + channel + orgId IS NULL + branchId IS NULL]

    GlobalQuery -->|Found Published| FoundGlobal[Use Global Default Template]
    GlobalQuery -->|Not Found| Fallback[Fallback to latest template version]
```

---

## 2. Dynamic Variable Syntax & Rendering Engine

Templates use mustache-style double curly brace syntax: `{{variableName}}` or nested path syntax `{{user.name}}`.

`HandlebarsTemplateRenderer`:
- Replaces variables safely without throwing runtime crashes.
- Returns missing variables in `RenderResult.missingVariables` for validation.
- Extracts declared variables automatically upon template creation/update if none are specified.

### Supported Common Standard Placeholders:
- `{{userName}}`: Target recipient full name
- `{{organizationName}}`: Institutional group name
- `{{branchName}}`: Specific campus name
- `{{otp}}`: Generated one-time password string
- `{{minutes}}`: Expiry duration in minutes
- `{{resetLink}}`: Secure password reset URL
- `{{amount}}`: Monetary amount
- `{{currency}}`: Active branch currency symbol (e.g. `INR`, `USD`)
