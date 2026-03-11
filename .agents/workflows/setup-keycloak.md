---
description: How to setup Keycloak for development
---

Follow these steps to initialize Keycloak with the required realm, client, and test user.

### 1. Ensure Keycloak is running
Start the Keycloak Docker container first.
```powershell
docker run --name keycloak-dev -p 8080:8080 `
  -e KEYCLOAK_ADMIN=admin `
  -e KEYCLOAK_ADMIN_PASSWORD=admin `
  -v "${PWD}\keycloak-theme\dashboard-theme:/opt/keycloak/themes/dashboard-theme" `
  quay.io/keycloak/keycloak:latest `
  start-dev
```

### 2. Run the Setup Script
Once Keycloak is up and running (check terminal logs for `Listening on: http://0.0.0.0:8080`), open a new terminal in the project root and run:

// turbo
```powershell
node setup-keycloak.js
```

### 3. Verify Setup
- **Admin Console**: [http://localhost:8080](http://localhost:8080) (admin/admin)
- **Realm**: `dashboard-realm` should be visible in the dropdown.
- **Client**: `dashboard-client` should exist under the realm.
- **User**: `testuser` (password: `password`) should be created.
