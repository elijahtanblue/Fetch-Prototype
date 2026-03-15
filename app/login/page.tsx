"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

function CatMascot() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="32" cy="36" r="20" fill="#FCE7F3" stroke="#EC4899" strokeWidth="2"/>
      <polygon points="16,22 22,10 26,22" fill="#EC4899"/>
      <polygon points="38,22 42,10 48,22" fill="#EC4899"/>
      <circle cx="25" cy="34" r="3" fill="#EC4899"/>
      <circle cx="39" cy="34" r="3" fill="#EC4899"/>
      <path d="M28 42 Q32 46 36 42" stroke="#EC4899" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="20" y1="38" x2="10" y2="36" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="40" x2="10" y2="40" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="44" y1="38" x2="54" y2="36" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="44" y1="40" x2="54" y2="40" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DogMascot() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="32" cy="36" r="20" fill="#F3E8FF" stroke="#A855F7" strokeWidth="2"/>
      <ellipse cx="16" cy="28" rx="6" ry="10" fill="#A855F7"/>
      <ellipse cx="48" cy="28" rx="6" ry="10" fill="#A855F7"/>
      <circle cx="25" cy="34" r="3" fill="#A855F7"/>
      <circle cx="39" cy="34" r="3" fill="#A855F7"/>
      <ellipse cx="32" cy="43" rx="5" ry="3" fill="#A855F7"/>
      <path d="M28 42 Q32 47 36 42" stroke="#7E22CE" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--fetch-bg)]">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[var(--fetch-pink)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--fetch-dark)]">Fetch</h1>
          </div>
          <p className="text-sm text-[var(--fetch-gray)]">Vet History Network</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6">
          <h2 className="text-lg font-semibold mb-4 text-[var(--fetch-dark)]">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--fetch-gray)] mb-1">Email</label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)] focus:border-transparent"
                placeholder="you@vetclinic.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--fetch-gray)] mb-1">Password</label>
              <input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)] focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm" role="alert">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2 px-4 bg-[var(--fetch-pink)] text-white font-medium rounded-full text-sm hover:bg-[var(--fetch-pink-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Mascots */}
        <div className="flex justify-center gap-6 mt-6">
          <CatMascot />
          <DogMascot />
        </div>

        <p className="text-xs text-center text-[var(--fetch-gray)] mt-4">
          Contribute vet records to unlock pet history.
        </p>
      </div>
    </div>
  );
}
