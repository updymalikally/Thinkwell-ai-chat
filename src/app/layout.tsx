import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Thinkwell — AI chat", description: "A thoughtful space for ideas, answers, and everything in between.", applicationName: "Thinkwell" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
