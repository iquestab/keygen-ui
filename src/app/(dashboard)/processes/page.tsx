import { ProtectedRoute } from "@/components/auth/protected-route"
import { ProcessManagement } from "@/components/processes/process-management"

export default function ProcessesPage() {
  return (
    <ProtectedRoute>
      <ProcessManagement />
    </ProtectedRoute>
  )
}
