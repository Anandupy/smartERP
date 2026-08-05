# ERP System Backend

A robust, scalable, and production-ready ERP (Enterprise Resource Planning) backend built with NestJS, Prisma, and PostgreSQL.

## 🚀 Overview

This backend system is designed to handle complex business logic for SMEs, featuring a modular architecture, advanced logging, and secure authentication.

## ✨ Key Features

- **Modular Architecture**: Easy to extend and maintain.
- **Authentication & Authorization**: Secure JWT-based auth with Role-Based Access Control (RBAC).
- **Prisma ORM**: Type-safe database interactions with PostgreSQL.
- **Global Error Handling**: Centralized exception filters for consistent API responses.
- **Comprehensive Logging**: Custom Winston-based logging with daily rotation.
- **Enterprise Execution Context Platform**: Stateless, request-scoped resolution of Organization, Branch, and Academic Year context with header validation and auto-discovery.
- **Request Context**: Context-aware logging and tracing for every request.
- **Husky & Lint-staged**: Pre-commit hooks to ensure code quality and prevent debug logs (console.log) from being committed.
- **Swagger Documentation**: Interactive API documentation available at `/docs`.

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Logging**: [Winston](https://github.com/winstonjs/winston)
- **Security**: [Helmet](https://helmetjs.github.io/), [Passport](https://www.passportjs.org/)

## 📋 Prerequisites

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- PostgreSQL database

## ⚙️ Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Environment Variables**

   Copy the template and fill it in. Every variable is validated at startup, so
   a missing or placeholder secret stops the process rather than booting into an
   insecure state.

   ```bash
   cp .env.example .env
   ```

   Generate the two required secrets:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   See [Configuration Contract](docs/core/configuration.md) for the full
   reference.

4. **Database setup**

   Start PostgreSQL, then apply the migrations:

   ```bash
   pnpm prisma:migrate:deploy   # creates the full schema
   pnpm migrate:verify          # confirms no drift
   pnpm seed                    # permissions, modules, menus
   ```

   > [!WARNING]
   > Do not use `prisma db push`. Pushing the schema is what let the migration
   > history fall 34 tables behind the schema, so `migrate deploy` produced a
   > broken database. CI now fails on any drift. See
   > [Migration Strategy](docs/core/migrations.md).

   To change the schema, edit `prisma/modules/**` and generate a migration:

   ```bash
   pnpm prisma:migrate:dev -- --name describe_the_change
   ```

## 🚀 First Run

A fresh installation has no Organization, Branch or Academic Year. Log in as the
seeded Super Admin and call `GET /v1/auth/me`; it reports `setup.setupRequired`
and the resources still missing. Work through the setup flow — see
[Workspace Bootstrap](docs/core/workspace-bootstrap.md) — before the rest of the
API becomes available.

## 🏃 Running the App

```bash
# development
$ pnpm run start

# watch mode (recommended for dev)
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## 🧪 Testing

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## 📚 Documentation

Detailed documentation about the project structure and modules can be found below:

- [Project Architecture](./docs/document.md)
- **Module Specifications:**
  - [System Settings](./docs/modules/system-settings.md)
  - [Organization Management](./docs/modules/organization-settings.md)
  - [Branch Management](./docs/modules/branch.md)
  - [Authentication & Identity](./docs/modules/auth.md)

## 🤝 Contributing

1. Create a new branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a pull request.

## 📄 License

This project is [UNLICENSED](./LICENSE).
