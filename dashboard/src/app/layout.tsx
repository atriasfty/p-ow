import { ClerkProvider } from '@clerk/nextjs'
import { Montserrat } from "next/font/google";
import { Metadata, Viewport } from "next";
import "./globals.css";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-context";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { PWAGate } from "@/components/pwa/PWAGate";
import { PWARegister } from "@/components/pwa/PWARegister";
import { PWAProvider } from "@/components/providers/pwa-provider";
import { GitBookProvider } from "@/components/providers/gitbook-provider";
import { EnsureConnections } from "@/components/auth/ensure-connections";

const montserrat = Montserrat({ subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Project Overwatch",
  description: "ERLC Multi-Server Dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "POW",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* PWA Meta Tags */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="mobile-web-app-capable" content="yes" />

          {/* iOS PWA Meta Tags */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="POW" />
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        </head>
        <body className={montserrat.className}>
          <MaintenanceGate>
            <CookieConsentProvider>
              <PostHogProvider>
                <GitBookProvider>
                  <PWAProvider>
                    <EnsureConnections>
                      <PWAGate>
                        {children}
                      </PWAGate>
                      <CookieConsentBanner />
                    </EnsureConnections>
                  </PWAProvider>
                </GitBookProvider>
              </PostHogProvider>
            </CookieConsentProvider>
          </MaintenanceGate>
        </body>
      </html>
    </ClerkProvider>
  );
}
