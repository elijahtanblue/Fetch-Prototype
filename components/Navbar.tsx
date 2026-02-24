"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/check-access", label: "Check Access" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[var(--kinetic-gold)] flex items-center justify-center">
                <span className="text-white font-bold text-xs">K</span>
              </div>
              <span className="font-bold text-lg text-[var(--kinetic-dark)]">
                Kinetic
              </span>
            </Link>

            {/* Nav Links */}
            <nav className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-[var(--kinetic-gold-light)] text-[var(--kinetic-dark)]"
                      : "text-[var(--kinetic-gray)] hover:text-[var(--kinetic-dark)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Sign Out */}
          <button
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = `${window.location.origin}/login`;
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
