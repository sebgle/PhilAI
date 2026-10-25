import type { Metadata } from "next";
import { Literata } from "next/font/google";
import "./globals.css";

// Literata, a typeface made for long reading, carries every literary passage;
// the interface uses the system UI stack (globals.css), Notion-style.
const book = Literata({
  variable: "--font-book",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "PhilAI",
  description: "Write it down. Literature answers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${book.variable} antialiased`}>{children}</body>
    </html>
  );
}
