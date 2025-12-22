import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tony Robbins Coaching",
  description: "Video learning platform for coaching mastery",
  icons: {
    icon: "/tony-icon.png",
    apple: "/tony-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex h-dvh flex-col antialiased`}
      >
        <header className="sticky top-0 z-50 flex shrink-0 items-center bg-black py-5 pl-10 pr-6">
          <img
            src="/Lockup Type=Primary White.png"
            alt="Logo"
            className="h-14"
          />
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
