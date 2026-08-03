import { Badge } from '@/components/ui/badge'
import { Release } from '@/lib/types/keygen'

const STATUS_STYLES: Record<Release['attributes']['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
  PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
  YANKED: 'bg-red-100 text-red-800 border-red-200',
}

export function ReleaseStatusBadge({ status }: { status: Release['attributes']['status'] }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {status.toLowerCase()}
    </Badge>
  )
}
