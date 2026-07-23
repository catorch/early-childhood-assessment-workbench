import type { ReactNode } from "react";
import { Anybody, Inter } from "next/font/google";

import { AppHeader } from "@/components/app-header";
import { BrandFooter } from "@/components/brand";
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
      <body className="flex min-h-screen flex-col">
        <TooltipProvider>
          <AppHeader />
          <div className="flex flex-1 flex-col [&>*]:flex-1">{children}</div>
          <BrandFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
