import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinetic",
  description: "Shared Pet History — Access earned through contributing updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--kinetic-bg)] text-[var(--kinetic-dark)] antialiased">
        {children}
      </body>
    </html>
  );
}
