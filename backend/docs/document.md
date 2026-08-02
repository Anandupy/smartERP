# Project Structure Documentation

This document outlines the architectural structure and directory organization of the ERP Backend project.

## Directory Overview

The project follows a modular architecture designed for scalability and maintainability.

### Root Directory

- `src/`: Contains the source code of the application.
- `prisma/`: Prisma schema and migration files.
- `test/`: E2E and unit test files.
- `docs/`: Project documentation.
- `logs/`: Application log files (ignored by Git).
- `dist/`: Compiled output (ignored by Git).

### Source Directory (`src/`)

- `main.ts`: The entry point of the application.
- `app.module.ts`: The root module that imports all other modules.
- `common/`: Shared utilities, constants, and decorators.
- `config/`: Configuration files and environment variable validation.
- `modules/`: Feature-specific modules (e.g., Auth, Academic Year).
  - Each module contains its own controllers, services, and DTOs.
- `infrastructure/`: Core system components.
  - `database/`: Database connection and Prisma service.
  - `events/`: Reusable EventBus infrastructure and adapters.
  - `audit/`: Reusable Audit Infrastructure, mapper, listener, and repository.
  - `logger/`: Custom logging service implementation.
- `filters/`: Global exception filters.
- `interceptors/`: Global interceptors (e.g., logging, response formatting).
- `guards/`: Global authentication and authorization guards.
- `middleware/`: Custom middleware (e.g., request context).

## Core Technologies

- **Framework**: NestJS (v11)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Logging**: Winston
- **Security**: Helmet, Compression, Passport (JWT)

## Module Organization

Each feature in the `modules/` directory should follow this structure:

```text
modules/feature-name/
├── controllers/
├── services/
├── dto/
├── interfaces/
└── feature-name.module.ts
```

## Naming Conventions

- Files: `kebab-case.type.ts` (e.g., `user.controller.ts`)
- Classes: `PascalCase` (e.g., `UserController`)
- Variables/Functions: `camelCase`
- Folders: `kebab-case`

## TypeScript Conventions

### Definite assignment on framework-populated properties

`strictPropertyInitialization` is enabled. Properties that the constructor does
not assign — because a framework assigns them — must carry the definite
assignment assertion `!`:

```typescript
export class CreateBranchDto {
  @ApiProperty({ description: 'Organization UUID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string; // assigned by ValidationPipe / class-transformer

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string; // optional: no assertion needed
}
```

This applies to:

- **DTO properties** that are required — populated by `class-transformer` when
  `ValidationPipe` runs, never by a constructor.
- **Nest property injection** — e.g. `@Inject(EventBus) protected readonly eventBus!: EventBus;`
  in `BaseMasterService`.

`!` is erased at compile time and has no runtime effect; Swagger and
`class-validator` metadata are unaffected. Optional properties (`?:`) never take
an assertion.

### Prisma imports

Always import from `@/generated/client`, never from `@prisma/client`. This is
enforced by ESLint — see [Prisma Guide §8](./prisma-guide.md#8-client-import-rule-mandatory)
for the runtime defect that made the rule necessary.

## Configuration

Environment variables are validated at startup and documented in
[Configuration Contract](./core/configuration.md). Secrets have no fallbacks:
a missing or placeholder `JWT_SECRET` prevents the process from booting.

## Core Architecture Documentation

- [Configuration Contract](./core/configuration.md)
- [Execution Context Lifecycle](./core/execution-context.md)
- [Guard Pipeline](./core/guard-pipeline.md)
- [Workspace Bootstrap](./core/workspace-bootstrap.md)
- [Public Endpoint Protection](./core/public-endpoint-protection.md)
- [Response Contract](./core/response-contract.md)
- [Logging System](./core/logging.md)
- [Event-Driven Architecture](./core/events.md)
- [Audit Architecture](./core/audit.md)
- [Testing Architecture](./testing/testing-architecture.md)

## Module Documentation

Detailed specifications for each module can be found in the `docs/modules/` directory:

- [System Settings](./modules/system-settings.md)
- [Organization Management](./modules/organization-settings.md)
- [Branch Management](./modules/branch-settings.md)
- [Authentication & Identity](./modules/auth.md)
- [Program Structure](./modules/program.md)
- [Academic Year](./modules/academic-year.md)

## Domain Terminology

- **Branch**: Legal entity representing a campus or administrative unit.
- **Program**: Internal course structure (e.g., Grade 10, B.Tech).
- **Academic Unit**: Operational hierarchy (Planned: Departments, Wings, Sections).
