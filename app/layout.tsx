import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <title>HELP Review Pilot</title>
        <meta content="Educator review of draft HELP assessment suggestions." name="description" />
      </head>
      <body>
        <TooltipProvider>
          <AppHeader />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
