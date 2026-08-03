import { ProtectedRoute } from "@/components/auth/protected-route"
import { ChannelManagement } from "@/components/channels/channel-management"

export default function ChannelsPage() {
  return (
    <ProtectedRoute>
      <ChannelManagement />
    </ProtectedRoute>
  )
}
