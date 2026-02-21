"use client";

import { useState } from "react";

interface ClinicOptInToggleProps {
  clinicId: string;
  initialOptedIn: boolean;
}

export default function ClinicOptInToggle({
  clinicId,
  initialOptedIn,
}: ClinicOptInToggleProps) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinics/${clinicId}`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setOptedIn(data.optedIn);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      aria-label={`Toggle opt-in for clinic`}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)] focus:ring-offset-1 disabled:opacity-50 ${
        optedIn ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          optedIn ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
