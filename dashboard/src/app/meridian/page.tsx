import type { Metadata } from "next"
import { MeridianLanding } from "@/components/meridian/landing"

// Unlisted preview of the new landing page. When it's approved, point
// src/app/page.tsx at MeridianLanding and delete this route.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function MeridianPreview() {
    return <MeridianLanding />
}
