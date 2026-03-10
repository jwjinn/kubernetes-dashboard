package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

var (
	// In production, these should come from environment variables
	keycloakURL = "http://localhost:8080/realms/dashboard-realm"
)

func authMiddleware(next http.Handler, verifier *oidc.IDTokenVerifier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Handle CORS preflight
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173") // React default port
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		rawAccessToken := r.Header.Get("Authorization")
		if rawAccessToken == "" {
			http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(rawAccessToken, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
			return
		}

		idToken, err := verifier.Verify(context.Background(), parts[1])
		if err != nil {
			http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
			return
		}

		var claims struct {
			PreferredUsername string `json:"preferred_username"`
		}
		if err := idToken.Claims(&claims); err != nil {
			log.Println("Failed to parse claims:", err)
		}

		log.Printf("Authenticated request from user: %s", claims.PreferredUsername)

		next.ServeHTTP(w, r)
	}
}

func main() {
	ctx := context.Background()

	provider, err := oidc.NewProvider(ctx, keycloakURL)
	if err != nil {
		log.Fatalf("Failed to query provider %q: %v. Is Keycloak running?", keycloakURL, err)
	}

	oidcConfig := &oidc.Config{
		SkipClientIDCheck: true, 
	}
	verifier := provider.Verifier(oidcConfig)

	mux := http.NewServeMux()

	mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		response := map[string]string{
			"message": "Hello from the Go backend! Your token is valid.",
			"status":  "success",
		}
		json.NewEncoder(w).Encode(response)
	})

	protectedHandler := authMiddleware(mux, verifier)

	port := ":8081"
	fmt.Printf("Backend server starting on http://localhost%s\n", port)
	if err := http.ListenAndServe(port, protectedHandler); err != nil {
		log.Fatal(err)
	}
}
