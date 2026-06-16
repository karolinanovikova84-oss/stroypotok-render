import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import Link from "next/link";

import { ThemeToggle } from "../components/theme-toggle";
import "./globals.css";

const headingFont = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800", "900"],
  variable: "--font-heading"
});

const bodyFont = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-text"
});

export const metadata: Metadata = {
  title: "СтройПоток",
  description: "Система управления заявками, объектами, ресурсами и рабочими сменами строительной компании"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="ambient-bg" />
        <div className="ambient-blob blob-1" />
        <div className="ambient-blob blob-2" />
        <header className="topbar">
          <div className="shell topbar__inner">
            <Link href="/" className="brand">
              <span className="brand__mark" />
              <span>
                <div className="brand__title">СтройПоток</div>
                <div className="brand__text">операционная система стройки</div>
              </span>
            </Link>

            <div className="topbar__actions">
              <nav className="nav">
                <Link href="/">Главная</Link>
                <Link href="/auth">Вход</Link>
                <Link href="/cabinet">Кабинет</Link>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="page shell">{children}</main>
      </body>
    </html>
  );
}
