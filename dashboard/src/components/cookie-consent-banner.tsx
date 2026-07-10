'use client'

import { useCookieConsent } from '@/components/providers/cookie-consent-context'
import { Cookie, ExternalLink, ShieldCheck } from 'lucide-react'

const LEGAL_URL = 'https://lacrp.ciankelly.xyz/project-overwatch-legal-documents'

export function CookieConsentBanner() {
    const { showBanner, acceptCookies, declineCookies } = useCookieConsent()

    if (!showBanner) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="cookie-banner-title"
                aria-describedby="cookie-banner-description"
            >
                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
                            <Cookie className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <h3 id="cookie-banner-title" className="text-xl font-bold text-white tracking-tight">Cookie Preferences</h3>
                    </div>

                    {/* Description */}
                    <p id="cookie-banner-description" className="text-zinc-400 text-sm leading-relaxed">
                        We use cookies to improve your experience and analyze how our dashboard is used.
                        Analytics data helps us make Project Overwatch better for everyone.
                    </p>

                    <p className="text-zinc-500 text-xs mt-4">
                        You can change your preferences at any time from the dashboard.{' '}
                        <a
                            href={LEGAL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                        >
                            Privacy Policy <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                    </p>

                    {/* GDPR Badge */}
                    <div className="mt-6 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                        <span>Your data is protected by GDPR</span>
                    </div>

                    {/* Buttons */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={declineCookies}
                            className="flex-1 px-5 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-[#333] transition-all font-semibold text-sm border border-transparent hover:border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                        >
                            Decline
                        </button>
                        <button
                            onClick={acceptCookies}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-[0.98] bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
