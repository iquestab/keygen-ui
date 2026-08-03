'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Entitlement } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X, ShieldCheck } from 'lucide-react'
import { handleLoadError, handleCrudError } from '@/lib/utils/error-handling'
import { toast } from 'sonner'

interface EntitlementManagerProps {
  resourceId: string
  resourceType: 'policy' | 'license'
  emptyHint?: string
}

const RESOURCE_LABELS: Record<EntitlementManagerProps['resourceType'], string> = {
  policy: 'Policy',
  license: 'License',
}

export function EntitlementManager({ resourceId, resourceType, emptyHint }: EntitlementManagerProps) {
  const [attached, setAttached] = useState<Entitlement[]>([])
  const [allEntitlements, setAllEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [addEntitlementId, setAddEntitlementId] = useState('')
  const [mutating, setMutating] = useState(false)

  const api = getKeygenApi()
  const resource = resourceType === 'policy' ? api.policies : api.licenses
  const resourceLabel = RESOURCE_LABELS[resourceType]

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [attachedResponse, allResponse] = await Promise.all([
        resource.getEntitlements(resourceId),
        api.entitlements.list({ limit: 100 }),
      ])
      setAttached(attachedResponse.data || [])
      setAllEntitlements(allResponse.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'entitlements')
    } finally {
      setLoading(false)
    }
  }, [resource, api.entitlements, resourceId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const attachedIds = new Set(attached.map(e => e.id))
  const availableEntitlements = allEntitlements.filter(e => !attachedIds.has(e.id))

  const handleAdd = async () => {
    if (!addEntitlementId) return

    try {
      setMutating(true)
      await resource.attachEntitlements(resourceId, [addEntitlementId])
      toast.success('Entitlement added')
      setAddEntitlementId('')
      loadData()
    } catch (error: unknown) {
      handleCrudError(error, 'update', resourceLabel)
    } finally {
      setMutating(false)
    }
  }

  const handleRemove = async (entitlement: Entitlement) => {
    try {
      setMutating(true)
      await resource.detachEntitlements(resourceId, [entitlement.id])
      toast.success('Entitlement removed')
      loadData()
    } catch (error: unknown) {
      handleCrudError(error, 'update', resourceLabel)
    } finally {
      setMutating(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading entitlements...</div>
  }

  return (
    <div className="space-y-3">
      {attached.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          {emptyHint || 'No entitlements attached'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attached.map((entitlement) => (
            <Badge key={entitlement.id} variant="secondary" className="flex items-center gap-1 pr-1">
              {entitlement.attributes.name}
              <button
                type="button"
                onClick={() => handleRemove(entitlement)}
                disabled={mutating}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={addEntitlementId} onValueChange={setAddEntitlementId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Add an entitlement..." />
          </SelectTrigger>
          <SelectContent>
            {availableEntitlements.map((entitlement) => (
              <SelectItem key={entitlement.id} value={entitlement.id}>
                {entitlement.attributes.name}
              </SelectItem>
            ))}
            {availableEntitlements.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {allEntitlements.length === 0 ? 'No entitlements found' : 'All entitlements already added'}
              </div>
            )}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={!addEntitlementId || mutating}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
