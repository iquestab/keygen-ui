import { ProtectedRoute } from "@/components/auth/protected-route"
import { ReleaseManagement } from "@/components/releases/release-management"

export default function ReleasesPage() {
  return (
    <ProtectedRoute>
      <ReleaseManagement />
    </ProtectedRoute>
  )
}
