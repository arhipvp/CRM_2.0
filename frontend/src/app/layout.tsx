import type { Metadata } from "next";
import "./globals.css";
import { geistMono, geistSans } from "./fonts";

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
        {children}
      </body>
    </html>
  );
}
