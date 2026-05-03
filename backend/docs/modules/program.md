# Program Module

## Overview
The **Program** module represents the internal academic classification within a Branch. While a Branch is a legal and geographical entity, a Program is a way to organize students and curriculum (e.g., "Primary", "Secondary", "Degree in CS").

## Concepts
- **Branch vs. Program**: A Branch is the physical/legal institution. A Program is a vertical structure *inside* that branch.
- **AcademicYear vs. Program**: Academic Years are time-bound cycles. Programs are static structures that span multiple years.
- **AcademicUnit**: Individual classes or sections (e.g., "Grade 10-A") will eventually belong to a Program.

## Examples
- **School**: Primary (Medium: English), Secondary (Medium: Hindi).
- **College**: Jr. College (Stream: Science), Jr. College (Stream: Commerce).
- **University**: B.Tech (Stream: Engineering), M.B.B.S (Stream: Medical).

## Hierarchy
Programs support an optional parent-child hierarchy. This allows grouping, such as:
- **School (Parent)**
  - Primary (Child)
  - Secondary (Child)

## API Endpoints

### Base URL: `/programs`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/programs` | ADMIN | Create a new program |
| GET | `/programs?branchId=...` | ALL | List programs for a branch |
| GET | `/programs/tree?branchId=...` | ALL | Get hierarchical tree |
| GET | `/programs/:id` | ALL | Get program details |
| PATCH | `/programs/:id` | ADMIN | Update program |
| DELETE | `/programs/:id` | ADMIN | Soft delete program |
| PATCH | `/programs/:id/status` | ADMIN | Toggle active status |

## Validation Rules
1. **Uniqueness**: The combination of `branchId`, `name`, `medium`, and `stream` must be unique per branch.
2. **Same-Branch Hierarchy**: A child program must belong to the same branch as its parent.
3. **Circular Prevention**: The system prevents creating circular parent-child loops.
4. **Active Deletion**: A program cannot be deleted if it has active child programs.
