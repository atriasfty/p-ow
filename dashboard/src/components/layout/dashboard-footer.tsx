'use client'

import { useCookieConsent } from '@/components/providers/cookie-consent-context'
import { Cookie, ExternalLink, FileText } from 'lucide-react'

const LEGAL_URL = 'https://lacrp.ciankelly.xyz/project-overwatch-legal-documents'

export function DashboardFooter() {
    const { setShowBanner } = useCookieConsent()

    const handleOpenPreferences = () => {
        setShowBanner(true)
    }

    return (
        <div className="mt-12 pt-6 border-t border-zinc-800">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-zinc-500">
                {/* Legal Links */}
                <a
                    href={LEGAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-zinc-300 transition-colors"
                >
                    <FileText className="w-4 h-4" />
                    Terms of Service & Privacy Policy
                    <ExternalLink className="w-3 h-3" />
                </a>

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
