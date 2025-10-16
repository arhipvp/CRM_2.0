import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SSEBridge } from "@/components/providers/SSEBridge";
import { NotificationCenter } from "@/components/common/NotificationCenter";
import { MainNavigation } from "@/components/common/MainNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM 2.0 Frontend",
  description: "Веб-клиент CRM с поддержкой воронки сделок, карточек и платежей.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <SSEBridge />
          <NotificationCenter />
          <div className="app-shell flex min-h-screen flex-col">
            <header className="app-header">
              <div className="app-header__inner">
                <MainNavigation />
              </div>
            </header>
            <main className="app-main">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
