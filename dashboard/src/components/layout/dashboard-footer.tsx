'use client'

import { useCookieConsent } from '@/components/providers/cookie-consent-context'
import { Cookie, ExternalLink, FileText, Shield } from 'lucide-react'

const TOS_URL = 'https://atria.gitbook.io/project-overwatch/legal/terms-of-service'
const PRIVACY_URL = 'https://atria.gitbook.io/project-overwatch/legal/privacy-policy'

export function DashboardFooter() {
    const { setShowBanner } = useCookieConsent()

    const handleOpenPreferences = () => {
        setShowBanner(true)
    }

    return (
        <div className="mt-12 pt-6 border-t border-zinc-800">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-zinc-500">
                {/* Legal Links */}
                <div className="flex items-center gap-4">
                    <a
                        href={TOS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:text-zinc-300 transition-colors"
                    >
                        <FileText className="w-4 h-4" />
                        Terms of Service
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-zinc-700">•</span>
                    <a
                        href={PRIVACY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:text-zinc-300 transition-colors"
                    >
                        <Shield className="w-4 h-4" />
                        Privacy Policy
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                <span className="hidden sm:block text-zinc-700">•</span>

                {/* Cookie Preferences */}
                <button
                    onClick={handleOpenPreferences}
                    className="flex items-center gap-2 hover:text-zinc-300 transition-colors"
                >
                    <Cookie className="w-4 h-4" />
                    Cookie Preferences
                </button>
            </div>

            <p className="text-center text-xs text-zinc-600 mt-4">
                © {new Date().getFullYear()} Project Overwatch. All rights reserved.
            </p>
        </div>
    )
}
