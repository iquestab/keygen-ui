import { ProtectedRoute } from "@/components/auth/protected-route"
import { TokenManagement } from "@/components/tokens/token-management"

export default function SettingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <div className="space-y-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings, API keys, and Keygen configuration.
          </p>
        </div>
        <TokenManagement />
        <div className="rounded-lg border bg-card p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">More settings coming soon</h3>
          <p className="text-muted-foreground">
            Account preferences and default webhook configuration are on the way.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
