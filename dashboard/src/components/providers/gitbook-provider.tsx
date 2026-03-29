"use client"

import { GitBookProvider as Provider } from '@gitbook/embed/react';

export function GitBookProvider({ children }: { children: React.ReactNode }) {
    return (
        <Provider siteURL="https://atria.gitbook.io/project-overwatch">
            {children}
        </Provider>
    );
}
