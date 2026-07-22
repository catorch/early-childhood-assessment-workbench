import type { ReactNode } from "react";
import { Anybody, Inter } from "next/font/google";

import { AppHeader } from "@/components/app-header";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const anybody = Anybody({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-anybody",
  weight: ["700"]
});

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter"
});

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${anybody.variable} ${inter.variable}`} lang="en">
      <head>
        <title>HELP AI Crediting Companion</title>
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
