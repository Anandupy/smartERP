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

## Module Documentation
Detailed specifications for each module can be found in the `docs/modules/` directory:
- [System Settings](./modules/system-settings.md)
- [Organization Management](./modules/organization-settings.md)
