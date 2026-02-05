import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalStaffLayout } from "./components/layout/ConditionalStaffLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RFP Response Tool - Multi-Company Management",
  description: "AI-powered RFP response generation for multiple contractor companies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-mono antialiased`}
      >
        <ConditionalStaffLayout>{children}</ConditionalStaffLayout>
      </body>
    </html>
  );
}
