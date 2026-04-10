import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalStaffLayout } from "./components/layout/ConditionalStaffLayout";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClicklessAI — RFP Response Tool",
  description: "AI-powered RFP response generation for government contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} font-mono antialiased`}>
        <ConditionalStaffLayout>{children}</ConditionalStaffLayout>
      </body>
    </html>
  );
}
