# CampusFlow ERP - PostgreSQL Database Backup

This directory contains the full PostgreSQL database dump (`database_backup.sql`) for the ERP system.

## Database Details
- **Database Name:** `erp`
- **Schema:** `public`
- **PostgreSQL Version:** 18 (compatible with PostgreSQL 15, 16, 17, 18)
- **Includes:**
  - Full database schema, tables, relations, triggers, and sequences.
  - Complete master reference records (Blood Groups, Castes, Categories, Religions, Languages, Programs, Academic Years, Permissions, Modules, Menus).
  - Seeded organizations, branches, users (Super Admin), and all applicant admission records.

---

## How to Restore

### Option 1: Command Line (psql)
```bash
# 1. Create a fresh database (if it doesn't already exist)
createdb -U postgres erp

# 2. Restore the SQL backup
psql -U postgres -d erp -f database_backup/database_backup.sql
```

### Option 2: pgAdmin 4
1. Open pgAdmin 4 and connect to your PostgreSQL server.
2. Right-click on **Databases** -> **Create** -> **Database...** -> Name it `erp`.
3. Right-click on the `erp` database -> select **Query Tool**.
4. Open `database_backup/database_backup.sql` and click **Execute (F5)**.

---

## Environment Setup
In `backend/.env`, configure your database URL:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/erp?schema=public"
```
