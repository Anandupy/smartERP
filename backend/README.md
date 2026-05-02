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

4. **Prisma Setup**
   ```bash
   pnpm run prisma:generate
   pnpm run prisma:migrate
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

Detailed documentation about the project structure and architecture can be found in the [docs/](./docs) directory.

- [Project Structure](./docs/document.md)

## 🤝 Contributing

1. Create a new branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a pull request.

## 📄 License

This project is [UNLICENSED](./LICENSE).
