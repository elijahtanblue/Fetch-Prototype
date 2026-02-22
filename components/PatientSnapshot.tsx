"use client";

import { useState } from "react";

interface SnapshotEntry {
  id: string;
  clinicName: string;
  episodeReason: string;
  episodeStartDate: string;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags: boolean;
  notes: string;
  createdAt: string;
}

interface SnapshotResponse {
  accessDecision: "allowed" | "denied";
  snapshot?: SnapshotEntry[];
  reasonCode?: string;
  explanation?: string;
}

interface PatientSnapshotProps {
  patientId: string;
  patientName: string;
}

export default function PatientSnapshot({
  patientId,
  patientName,
}: PatientSnapshotProps) {
  const [data, setData] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function fetchSnapshot() {
    setLoading(true);
    try {
      const res = await fetch(`/api/snapshots/${patientId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (!open) {
      fetchSnapshot();
    }
    setOpen(!open);
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleToggle}
        className="text-xs text-[var(--kinetic-gold)] hover:underline font-medium"
      >
        {open ? "Hide Shared History" : "View Shared History"}
      </button>

      {open && (
        <div className="mt-2">
          {loading && (
            <p className="text-xs text-[var(--kinetic-gray)]">
              Loading shared history...
            </p>
          )}

          {!loading && data?.accessDecision === "denied" && (
            <div
              className="bg-amber-50 border border-amber-200 rounded-lg p-3"
              data-testid="denial-panel"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Access Denied
                </span>
                {data.reasonCode && (
                  <span className="text-xs text-[var(--kinetic-gray)]">
                    ({data.reasonCode})
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--kinetic-dark)]">
                {data.explanation}
              </p>
            </div>
          )}

          {!loading &&
            data?.accessDecision === "allowed" &&
            data.snapshot && (
              <div
                className="space-y-2"
                data-testid="snapshot-panel"
              >
                <p className="text-xs font-medium text-[var(--kinetic-gray)]">
                  Shared history for {patientName} from other clinics:
                </p>
                {data.snapshot.length === 0 ? (
                  <p className="text-xs text-[var(--kinetic-gray)]">
                    No shared records available.
                  </p>
                ) : (
                  data.snapshot.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-blue-50 rounded p-2 text-xs border border-blue-100"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-blue-900">
                          {entry.clinicName}
                        </span>
                        <span className="text-blue-400">|</span>
                        <span className="text-blue-700">
                          {entry.episodeReason}
                        </span>
                        {entry.redFlags && (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-medium">
                            Red Flag
                          </span>
                        )}
                      </div>
                      <p className="text-blue-800">
                        <strong>Region:</strong> {entry.painRegion} |{" "}
                        <strong>Dx:</strong> {entry.diagnosis}
                      </p>
                      <p className="text-blue-700">
                        <strong>Tx:</strong> {entry.treatmentModalities}
                      </p>
                      {entry.notes && (
                        <p className="text-blue-600 italic mt-0.5">
                          {entry.notes}
                        </p>
                      )}
                      <p className="text-blue-400 mt-1">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
