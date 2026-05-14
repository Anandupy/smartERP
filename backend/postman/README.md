# Postman Testing Guide

This directory contains the Postman collection and environment files for testing the ERP Backend API.

## 📦 Files
- `collections/ERP Backend.postman_collection.json`: The API collection containing all requests.
- `environments/ERP_Backend_-_Local.postman_environment.json`: Local environment variables.

## 🚀 Getting Started

### 1. Import Files
1. Open Postman.
2. Click **Import** in the top-left corner.
3. Select the files from this directory.

### 2. Select Environment
1. In the top-right corner of Postman, select the **ERP Backend - Local** environment.
2. Ensure the `baseUrl` is correct (default: `http://localhost:3000/v1`).

### 3. Authentication Flow
The collection is designed with **Automatic JWT Handling**:

1. Run the **Login** request.
2. Provide valid credentials (default admin credentials included).
3. Tokens will be automatically saved to your environment variables.
4. All subsequent requests will use the `{{accessToken}}`.

### 4. Traceability
Every response includes an `x-request-id` header which is automatically verified by the collection's test scripts.
