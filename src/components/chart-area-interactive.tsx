"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { getKeygenApi } from "@/lib/api"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "New licenses and machines over time"

// How many of the most-recently-created records to pull per resource when
// building the daily counts below. There's no dedicated analytics/time-series
// endpoint, so this bucket-by-day approach is bounded to the last N records
// rather than being a fully accurate count for accounts with heavy activity
// beyond this window. Capped at 100 — the API's documented max page size.
const RECENT_RECORDS_LIMIT = 100
const DAYS_TO_SHOW = 90

interface DailyCounts {
  date: string
  licenses: number
  machines: number
}

function toDateKey(dateString: string): string {
  return dateString.slice(0, 10) // YYYY-MM-DD
}

function buildDailySeries(
  licenseDates: string[],
  machineDates: string[]
): DailyCounts[] {
  const licenseCounts = new Map<string, number>()
  for (const d of licenseDates) {
    const key = toDateKey(d)
    licenseCounts.set(key, (licenseCounts.get(key) || 0) + 1)
  }

  const machineCounts = new Map<string, number>()
  for (const d of machineDates) {
    const key = toDateKey(d)
    machineCounts.set(key, (machineCounts.get(key) || 0) + 1)
  }

  const series: DailyCounts[] = []
  const today = new Date()
  for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(day.getDate() - i)
    const key = toDateKey(day.toISOString())
    series.push({
      date: key,
      licenses: licenseCounts.get(key) || 0,
      machines: machineCounts.get(key) || 0,
    })
  }
  return series
}

const chartConfig = {
  activity: {
    label: "Activity",
  },
  licenses: {
    label: "New Licenses",
    color: "var(--primary)",
  },
  machines: {
    label: "New Machines",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [chartData, setChartData] = React.useState<DailyCounts[]>([])
  const [loading, setLoading] = React.useState(true)
  const api = getKeygenApi()

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  React.useEffect(() => {
    let cancelled = false

    async function loadActivity() {
      try {
        const [licensesResponse, machinesResponse] = await Promise.all([
          api.licenses.list({ page: { size: RECENT_RECORDS_LIMIT, number: 1 } }).catch(() => ({ data: [] })),
          api.machines.list({ page: { size: RECENT_RECORDS_LIMIT, number: 1 } }).catch(() => ({ data: [] })),
        ])

        if (cancelled) return

        const licenseDates = (licensesResponse.data || []).map(l => l.attributes.created)
        const machineDates = (machinesResponse.data || []).map(m => m.attributes.created)

        setChartData(buildDailySeries(licenseDates, machineDates))
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load dashboard activity:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadActivity()
    return () => { cancelled = true }
  }, [api.licenses, api.machines])

  const filteredData = React.useMemo(() => {
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    return chartData.slice(-daysToSubtract)
  }, [chartData, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>License & Machine Activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            New licenses and machines created, by day
          </span>
          <span className="@[540px]/card:hidden">New activity by day</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            Loading activity...
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillLicenses" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-licenses)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-licenses)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillMachines" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-machines)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-machines)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value as string | number).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="machines"
                type="natural"
                fill="url(#fillMachines)"
                stroke="var(--color-machines)"
                stackId="a"
              />
              <Area
                dataKey="licenses"
                type="natural"
                fill="url(#fillLicenses)"
                stroke="var(--color-licenses)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
