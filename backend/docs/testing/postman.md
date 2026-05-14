# Postman Testing Guide

This guide explains how to set up and use the Postman collection for testing the ERP Backend API.

## 📦 Files
- `ERP-Backend.postman_collection.json`: The API collection containing all requests.
- `ERP-Backend.postman_environment.json`: Local environment variables.

## 🚀 Getting Started

### 1. Import Files
1. Open Postman.
2. Click **Import** in the top-left corner.
3. Drag and drop both JSON files from the root directory of this project.

### 2. Select Environment
1. In the top-right corner of Postman, select the **ERP Backend - Local** environment from the dropdown.
2. Ensure the `baseUrl` is correct (default: `http://localhost:3000/v1`).

### 3. Authentication Flow
The collection is designed with **Automatic JWT Handling**:

1. Open the **Auth** folder and run the **Login** request.
2. Provide valid credentials in the body (default admin credentials are included).
3. Upon success, the `accessToken` and `refreshToken` will be automatically saved to your environment variables.
4. All subsequent requests in the collection will automatically use the `{{accessToken}}` for Authorization.

### 4. Session Rotation
When your access token expires, run the **Refresh Token** request. This will rotate your tokens and update the environment variables automatically.

## 📁 Module Structure

### Auth
- Handles login, logout, token refresh, and session management.
- Includes scripts to capture tokens.

### System Settings
- Global system configuration and initialization.
- **Note**: `init` can only be called once.

### Organizations
- CRUD operations for the legal entities.
- Captures `organizationId` upon creation.

### Branches
- CRUD operations for individual campuses.
- Captures `branchId` upon creation.

### Academic Years
- Management of administrative timeframes.
- Captures `academicYearId` upon creation.

## 🧪 Automatic Tests
Every request includes global tests to verify:
- **HTTP Status**: Ensures 200 OK or 201 Created.
- **Success Flag**: Validates the `success: true` property in the response body.
- **Response Structure**: Ensures the standard global response wrapper is used.

## 🔐 Security Note
Do not commit sensitive tokens or passwords to version control. The environment file provided contains placeholder values or default development credentials only.
