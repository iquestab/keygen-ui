'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Constraint, Entitlement } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShieldCheck, HelpCircle, Plus, X } from 'lucide-react'
import { handleLoadError, handleCrudError } from '@/lib/utils/error-handling'
import { toast } from 'sonner'

interface ReleaseConstraintsProps {
  releaseId: string
}

function entitlementIdOf(constraint: Constraint): string | undefined {
  const rel = constraint.relationships?.entitlement?.data
  return rel && !Array.isArray(rel) ? rel.id : undefined
}

export function ReleaseConstraints({ releaseId }: ReleaseConstraintsProps) {
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [addEntitlementId, setAddEntitlementId] = useState('')
  const [mutating, setMutating] = useState(false)
  const api = getKeygenApi()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [constraintsResponse, entitlementsResponse] = await Promise.all([
        api.releases.getConstraints(releaseId),
        api.entitlements.list({ limit: 100 }),
      ])
      setConstraints(constraintsResponse.data || [])
      setEntitlements(entitlementsResponse.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'entitlement constraints')
    } finally {
      setLoading(false)
    }
  }, [api.releases, api.entitlements, releaseId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const entitlementsById = new Map(entitlements.map(e => [e.id, e]))
  const attachedIds = new Set(constraints.map(entitlementIdOf).filter(Boolean) as string[])
  const availableEntitlements = entitlements.filter(e => !attachedIds.has(e.id))

  const handleAdd = async () => {
    if (!addEntitlementId) return

    try {
      setMutating(true)
      await api.releases.attachConstraints(releaseId, [addEntitlementId])
      toast.success('Entitlement constraint added')
      setAddEntitlementId('')
      loadData()
    } catch (error: unknown) {
      handleCrudError(error, 'create', 'Entitlement constraint')
    } finally {
      setMutating(false)
    }
  }

  const handleRemove = async (constraint: Constraint) => {
    try {
      setMutating(true)
      await api.releases.detachConstraints(releaseId, [constraint.id])
      toast.success('Entitlement constraint removed')
      loadData()
    } catch (error: unknown) {
      handleCrudError(error, 'delete', 'Entitlement constraint')
    } finally {
      setMutating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <h3 className="text-lg font-semibold">Entitlement Constraints</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="size-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            A license or user must possess every listed entitlement to download or upgrade to this release
          </TooltipContent>
        </Tooltip>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading constraints...</div>
      ) : (
        <>
          {constraints.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              No entitlement constraints — this release is unrestricted
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {constraints.map((constraint) => {
                const entitlementId = entitlementIdOf(constraint)
                const entitlement = entitlementId ? entitlementsById.get(entitlementId) : undefined
                return (
                  <Badge key={constraint.id} variant="secondary" className="flex items-center gap-1 pr-1">
                    {entitlement ? entitlement.attributes.name : 'Unknown entitlement'}
                    <button
                      type="button"
                      onClick={() => handleRemove(constraint)}
                      disabled={mutating}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Select value={addEntitlementId} onValueChange={setAddEntitlementId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Add an entitlement constraint..." />
              </SelectTrigger>
              <SelectContent>
                {availableEntitlements.map((entitlement) => (
                  <SelectItem key={entitlement.id} value={entitlement.id}>
                    {entitlement.attributes.name}
                  </SelectItem>
                ))}
                {availableEntitlements.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {entitlements.length === 0 ? 'No entitlements found' : 'All entitlements already added'}
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={!addEntitlementId || mutating}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
