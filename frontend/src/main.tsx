import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import './index.css'
import App from './App.tsx'
import { getEnv } from './config/env'

const oidcConfig = {
  authority: getEnv("VITE_OIDC_AUTHORITY", "http://localhost:8080/realms/dashboard-realm"),
  client_id: getEnv("VITE_OIDC_CLIENT_ID", "dashboard-client"),
  redirect_uri: window.location.origin + getEnv("VITE_OIDC_REDIRECT_PATH", "/dashboard"),
  post_logout_redirect_uri: window.location.origin + getEnv("VITE_OIDC_POST_LOGOUT_REDIRECT_PATH", "/login"),
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
