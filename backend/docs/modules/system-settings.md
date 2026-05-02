# System Settings Module

The System Settings module acts as a global configuration layer for the ERP. It stores general information about the application and controls global behaviors like maintenance mode.

## Features
- **One-time Initialization**: The system can only be initialized once.
- **Global Config**: Stores product name, version, and environment.
- **Maintenance Mode**: Allows putting the entire system into maintenance with a custom message.
- **Support Info**: Stores global support email and phone numbers.
- **RBAC Protected**: Only users with the `SUPER_ADMIN` role (simulated via `x-role: SUPER_ADMIN` header) can modify these settings.

## Data Structure
- `productName`: String
- `productCode`: String (Unique)
- `version`: String
- `environment`: DEV, STAGING, PROD
- `maintenanceMode`: Boolean
- `maintenanceMessage`: String (Optional)
- `supportEmail`: String
- `supportPhone`: String

## API Endpoints
- `POST /v1/system-settings/init`: Initialize settings (One-time).
- `GET /v1/system-settings`: Retrieve current settings.
- `PATCH /v1/system-settings`: Update settings.

## Role Access
- **SUPER_ADMIN**: Full access (Read/Write/Init).
- **Others**: No access.
