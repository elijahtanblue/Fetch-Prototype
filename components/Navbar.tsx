"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const allNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/check-access", label: "Check Access", adminOnly: true },
];

interface NavbarProps {
  isAdmin?: boolean;
}

export default function Navbar({ isAdmin = false }: NavbarProps) {
  const navLinks = allNavLinks.filter((link) => !link.adminOnly || isAdmin);
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[var(--fetch-pink)] flex items-center justify-center" aria-label="Fetch">
                <span className="text-white font-bold text-xs">F</span>
              </div>
              <span className="font-bold text-lg text-[var(--fetch-dark)]">
                Fetch
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
                      ? "bg-[var(--fetch-pink-light)] text-[var(--fetch-dark)]"
                      : "text-[var(--fetch-gray)] hover:text-[var(--fetch-dark)]"
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
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--fetch-pink)] rounded-md hover:bg-[var(--fetch-pink-hover)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
