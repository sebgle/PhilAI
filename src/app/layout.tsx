import type { Metadata } from "next";
import { Instrument_Sans, Literata } from "next/font/google";
import "./globals.css";

// Literata, a typeface made for long reading, carries every literary passage;
// Instrument Sans handles the interface.
const book = Literata({
  variable: "--font-book",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const ui = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
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
      <body className={`${book.variable} ${ui.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
