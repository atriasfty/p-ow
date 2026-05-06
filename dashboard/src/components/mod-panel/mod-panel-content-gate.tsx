"use client"

import { useServerEventsContext } from "@/components/providers/server-events-provider"
import { ModPanelSkeleton } from "./mod-panel-skeleton"

export function ModPanelContentGate({ children }: { children: React.ReactNode }) {
    const { hasInitialData } = useServerEventsContext()

    if (!hasInitialData) {
        return <ModPanelSkeleton />
    }

    return <>{children}</>
}
