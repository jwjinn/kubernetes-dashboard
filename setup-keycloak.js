const setup = async () => {
    try {
        console.log('1. Getting Admin Token...');
        const tokenRes = await fetch("http://localhost:8080/realms/master/protocol/openid-connect/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                username: "admin",
                password: "admin",
                grant_type: "password",
                client_id: "admin-cli"
            })
        });

        if (!tokenRes.ok) {
            throw new Error(`Token fetch failed: ${tokenRes.statusText}`);
        }
        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;
        if (!token) throw new Error("Failed to get token");

        console.log('2. Creating Realm (dashboard-realm)...');
        const realmRes = await fetch("http://localhost:8080/admin/realms", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: "dashboard-realm",
                realm: "dashboard-realm",
                enabled: true,
                registrationAllowed: true,
                loginTheme: "dashboard-theme"
            })
        });
        if (!realmRes.ok && realmRes.status !== 409) {
            console.error(`Realm creation failed: ${realmRes.status} ${await realmRes.text()}`);
        } else {
            console.log(realmRes.status === 409 ? 'Realm already exists.' : 'Realm created.');
        }

        console.log('3. Creating Client (dashboard-client)...');
        const clientRes = await fetch("http://localhost:8080/admin/realms/dashboard-realm/clients", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                clientId: "dashboard-client",
                enabled: true,
                publicClient: true,
                directAccessGrantsEnabled: true,
                redirectUris: ["http://localhost:5173/*"],
                webOrigins: ["+"]
            })
        });
        if (!clientRes.ok && clientRes.status !== 409) {
            console.error(`Client creation failed: ${clientRes.status} ${await clientRes.text()}`);
        } else {
            console.log(clientRes.status === 409 ? 'Client already exists.' : 'Client created.');
        }

        console.log('4. Creating User (testuser)...');
        const userRes = await fetch("http://localhost:8080/admin/realms/dashboard-realm/users", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: "testuser",
                enabled: true,
                credentials: [{ type: "password", value: "password", temporary: false }]
            })
        });
        if (!userRes.ok && userRes.status !== 409) {
            console.error(`User creation failed: ${userRes.status} ${await userRes.text()}`);
        } else {
            console.log(userRes.status === 409 ? 'User already exists.' : 'User created.');
        }

        console.log('\\n✅ Keycloak setup complete! You can now start the Go backend.');
    } catch (e) {
        console.error('Setup failed:', e);
    }
};

setup();
