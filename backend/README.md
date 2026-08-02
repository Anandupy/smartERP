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
   Create a `.env` file in the root directory and add your configuration:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/erp_db?schema=public"
   JWT_SECRET="your-secret-key"
   PORT=3000
   ```

4. **Database & Prisma Setup**

   Always ensure your database is running before executing these commands.

   **For Development (with Migrations):**
   ```bash
   # Create and apply migrations
   npx prisma migrate dev --name init
   ```

   **For Quick Sync (Development only, skips migration history):**
   ```bash
   # Sync schema directly to database
   npx prisma db push
   ```

   **Generate Prisma Client:**
   ```bash
   # Generate/Regenerate Prisma Client
   npx prisma generate
   ```

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
  - [Branch Management](./docs/modules/branch-settings.md)
  - [Authentication & Identity](./docs/modules/auth.md)

## 🤝 Contributing

1. Create a new branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a pull request.

## 📄 License

This project is [UNLICENSED](./LICENSE).
