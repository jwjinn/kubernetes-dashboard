# Custom Keycloak image for the dashboard environment.
# It packages:
# 1. a dashboard-specific login theme
# 2. a pre-exported realm definition for initial import
FROM quay.io/keycloak/keycloak:26.1

# Login/theme assets shown during dashboard authentication flows.
COPY keycloak-theme/dashboard-theme /opt/keycloak/themes/dashboard-theme

# Realm bootstrap configuration.
# This is useful when standing up a fresh Keycloak instance for the dashboard.
COPY realm-export/dashboard-realm.json /opt/keycloak/data/import/dashboard-realm.json
