'use client'

import { useState, useEffect } from "react"
import { Key, Users, Monitor, Package, AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getKeygenApi } from "@/lib/api"
import { getUserFriendlyErrorMessage } from "@/lib/utils/error-handling"

interface StatResult {
  count: number
  error: string | null
}

const emptyStat: StatResult = { count: 0, error: null }

export function SectionCards() {
  const [loading, setLoading] = useState(true)
  const [licenses, setLicenses] = useState<StatResult>(emptyStat)
  const [users, setUsers] = useState<StatResult>(emptyStat)
  const [machines, setMachines] = useState<StatResult>(emptyStat)
  const [products, setProducts] = useState<StatResult>(emptyStat)

  const api = getKeygenApi()

  useEffect(() => {
    let cancelled = false

    async function loadDashboardStats() {
      // Keygen's API doesn't reliably return meta.count on this instance, so we can't
      // fetch just 1 record and trust a count alongside it — request a full page and
      // count the returned records, using the same page[size]/page[number] param shape
      // as the individual list pages (license-management.tsx, user-management.tsx, etc.)
      // rather than the bare `limit` param, since this API may handle that inconsistently
      // per-endpoint. Each resource is settled independently so one failing (e.g. a
      // permissions error on /users) doesn't collapse into a misleading "0" for every
      // card — a failed fetch shows an explicit error state instead of a fake zero count.
      const page = { size: 100, number: 1 }
      const [licensesResult, usersResult, machinesResult, productsResult] = await Promise.allSettled([
        api.licenses.list({ page }),
        api.users.list({ page }),
        api.machines.list({ page }),
        api.products.list({ page }),
      ])

      if (cancelled) return

      const toStat = (result: PromiseSettledResult<{ data?: unknown[]; meta?: { count?: number } }>, label: string): StatResult => {
        if (result.status === 'rejected') {
          console.error(`Failed to load ${label} count for dashboard:`, result.reason)
          return { count: 0, error: getUserFriendlyErrorMessage(result.reason, `Failed to load ${label}`) }
        }
        const { data, meta } = result.value
        return { count: meta?.count ?? (Array.isArray(data) ? data.length : 0), error: null }
      }

      setLicenses(toStat(licensesResult, 'licenses'))
      setUsers(toStat(usersResult, 'users'))
      setMachines(toStat(machinesResult, 'machines'))
      setProducts(toStat(productsResult, 'products'))
      setLoading(false)
    }

    loadDashboardStats()

    return () => { cancelled = true }
  }, [api.licenses, api.users, api.machines, api.products])

  const renderCount = (stat: StatResult) => {
    if (loading) return '...'
    if (stat.error) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="size-5" />
              <span className="text-base font-normal">Failed to load</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{stat.error}</TooltipContent>
        </Tooltip>
      )
    }
    return stat.count.toLocaleString()
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Licenses</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {renderCount(licenses)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <Key className="size-4" />
              Licenses
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total license count <Key className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Manage licenses from the licenses page
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Registered Users</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {renderCount(users)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <Users className="size-4" />
              Users
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total user accounts <Users className="size-4" />
          </div>
          <div className="text-muted-foreground">
            User management and permissions
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Machines</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {renderCount(machines)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <Monitor className="size-4" />
              Machines
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Licensed machines <Monitor className="size-4" />
          </div>
          <div className="text-muted-foreground">Monitor device activations</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Products</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {renderCount(products)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <Package className="size-4" />
              Products
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Managed products <Package className="size-4" />
          </div>
          <div className="text-muted-foreground">Software product catalog</div>
        </CardFooter>
      </Card>
    </div>
  )
}
