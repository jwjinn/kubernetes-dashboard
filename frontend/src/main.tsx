import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import './index.css'
import App from './App.tsx'

const oidcConfig = {
  authority: "http://localhost:8080/realms/dashboard-realm",
  client_id: "dashboard-client",
  redirect_uri: window.location.origin + "/dashboard", // usually you have a specific callback page, but often returning to root works
  post_logout_redirect_uri: window.location.origin + "/login", // Returns user to our login page after Keycloak logout
  onSigninCallback: () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    )
  }
};

async function enableMocking() {
  if (!import.meta.env.DEV) {
    return
  }
  const { worker } = await import('./mocks/browser')
  return worker.start()
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider {...oidcConfig}>
        <App />
      </AuthProvider>
    </StrictMode>,
  )
})
