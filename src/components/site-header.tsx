"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/licenses": "License Management",
  "/machines": "Machine Management",
  "/products": "Product Management",
  "/policies": "Policy Management",
  "/groups": "Group Management",
  "/entitlements": "Entitlement Management",
  "/webhooks": "Webhook Management",
  "/users": "User Management",
  "/settings": "Settings",
}

function getPageTitle(pathname: string): string {
  const match = Object.keys(PAGE_TITLES).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
  return match ? PAGE_TITLES[match] : "Keygen"
}

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{getPageTitle(pathname)}</h1>
      </div>
    </header>
  )
}
