import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SSEBridge } from "@/components/providers/SSEBridge";
import { NotificationCenter } from "@/components/common/NotificationCenter";

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
          {children}
        </Providers>
      </body>
    </html>
  );
}
