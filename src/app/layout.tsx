import type { Metadata } from "next";
import "./globals.css";
import VersionCheck from "@/components/VersionCheck";
import BackButtonHandler from "@/components/BackButtonHandler";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "배틀크루",
  description: "함께 달리고, 함께 성장",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-[#F0F2F5]">
        <div className="max-w-[430px] w-full mx-auto min-h-screen bg-[var(--bg)] shadow-lg">
          <VersionCheck />
          <BackButtonHandler />
          {children}
        </div>
      </body>
    </html>
  );
}
