"use client"

import Script from 'next/script';

export function GitBookProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Script
                src="https://atria.gitbook.io/project-overwatch/~gitbook/embed/script.js"
                strategy="lazyOnload"
                onLoad={() => {
                    // @ts-expect-error GitBook is loaded by the script above
                    if (window.GitBook) {
                        // @ts-expect-error GitBook is loaded by the script above
                        window.GitBook('init', { siteURL: 'https://atria.gitbook.io/project-overwatch' });
                        // @ts-expect-error GitBook is loaded by the script above
                        window.GitBook('configure', {
                            suggestions: [
                                'How do I create a server?',
                                'How do I join a server?',
                                'How do I make roles?',
                                'How do I link a subscription?',
                            ],
                            button: {
                                label: 'Help & Docs',
                                icon: 'help'
                            }
                        });
                        // @ts-expect-error GitBook is loaded by the script above
                        window.GitBook('show');
                    }
                }}
            />
            {children}
        </>
    );
}
