import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StravaHeatmap",
  description: "Track your cycling activities and analyze your performance with Strava integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex flex-col min-h-screen">
          {/* Top Navbar - Full Width */}
          <Navbar />
          
          {/* Content Area with Sidebar */}
          <div className="flex flex-1">
            {/* Sidebar */}
            <div className="hidden md:block">
              <Sidebar />
            </div>
            {/* Main Content */}
            <main className="flex-1 bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)] overflow-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
