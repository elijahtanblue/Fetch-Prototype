import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fetch",
  description: "Fetch Pet Insurance — Shared pet health history, access earned through contributing vet updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--fetch-bg)] text-[var(--fetch-dark)] antialiased">
        {children}
      </body>
    </html>
  );
}
