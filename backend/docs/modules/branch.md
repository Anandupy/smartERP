# Branch Module

The Branch module manages the individual campuses or units of an Educational Organization. Each branch can have its own settings, academic years, and structure modes.

## Institutional Support
To support diverse educational institutions, the Branch model includes specific categorization:

### Institution Types
- **SCHOOL**: K-12 education.
- **JUNIOR_COLLEGE**: Higher secondary or pre-university education.
- **DEGREE_COLLEGE**: Undergraduate and postgraduate studies.
- **UNIVERSITY**: Higher education and research institutions.
- **ENGINEERING**: Engineering colleges and technical institutes.
- **MEDICAL**: Medical, dental, and nursing colleges.
- **OTHER**: Specialized training centers or vocational schools.

### Affiliations
Branches can be affiliated with different educational boards or universities:
- `affiliationType`: BOARD, UNIVERSITY, or OTHER.
- `affiliationName`: The specific name of the body (e.g., CBSE, Mumbai University).

## Registration
Each branch can store a `registrationNumber` as a generic identifier provided by government or educational authorities. This field is unique across the system if provided.

## Structure Mode
- **DEFAULT**: Standard organizational structure provided by the ERP.
- **CUSTOM**: Allows manual definition of programs, batches, and sections (to be used by the Program module).

## Branch vs. Program
- **Branch**: Represents a physical or administrative unit (e.g., "Main Campus", "South Branch").
- **Program**: Represents a course of study offered by the branch (e.g., "Bachelor of Science", "Grade 10"). A branch can host multiple programs.

## API Endpoints
- `POST /v1/branches`: Create a new branch.
- `GET /v1/branches`: List all active branches.
- `GET /v1/branches/:id`: Get detailed information for a branch.
- `PATCH /v1/branches/:id`: Update branch details.
- `DELETE /v1/branches/:id`: Soft delete a branch.
