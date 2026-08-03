import { ProtectedRoute } from "@/components/auth/protected-route"
import { PackageManagement } from "@/components/packages/package-management"

export default function PackagesPage() {
  return (
    <ProtectedRoute>
      <PackageManagement />
    </ProtectedRoute>
  )
}
