"use client";

import { useState } from "react";

interface Props {
  patientId: string;
  patientName: string;
  initialConsent: string;
}

export default function ConsentToggle({ patientId, patientName, initialConsent }: Props) {
  const [consent, setConsent] = useState(initialConsent);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const newStatus = consent === "SHARE" ? "OPT_OUT" : "SHARE";
    try {
      const res = await fetch(`/api/patients/${patientId}/consent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentStatus: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setConsent(data.consentStatus);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid={`consent-toggle-${patientId}`}>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        consent === "SHARE"
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}>
        {consent === "SHARE" ? "Sharing" : "Opted Out"}
      </span>
      <button
        onClick={handleToggle}
        disabled={loading}
        className="text-xs text-[var(--kinetic-gold)] hover:underline disabled:opacity-50"
        data-testid={`consent-btn-${patientId}`}
      >
        {loading ? "..." : consent === "SHARE" ? "Opt Out" : "Re-enable"}
      </button>
    </div>
  );
}
