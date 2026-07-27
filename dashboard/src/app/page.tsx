import { MeridianLanding } from "@/components/meridian/landing"
import { isFeatureEnabled } from "@/lib/feature-flags"

export default async function Home() {
  const showPricing = await isFeatureEnabled('PRICING_PAGE')
  return <MeridianLanding showPricing={showPricing} />
}
