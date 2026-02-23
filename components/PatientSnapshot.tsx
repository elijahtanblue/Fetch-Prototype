"use client";

import { useState } from "react";

interface SnapshotEntry {
  id: string;
  clinicName?: string;
  episodeReason?: string;
  episodeStartDate?: string;
  painRegion?: string;
  diagnosis?: string;
  treatmentModalities?: string;
  redFlags?: boolean;
  notes?: string;
  updateType?: string;
  precautions?: string | null;
  responsePattern?: string | null;
  suggestedNextSteps?: string | null;
  notesSummary?: string | null;
  createdAt?: string;
  historyExists?: boolean;
  snapshotLocked?: boolean;
}

interface SnapshotResponse {
  accessDecision: "allowed" | "denied";
  tier?: string;
  accessPercent?: number;
  snapshot?: SnapshotEntry[];
  reasonCode?: string;
  explanation?: string;
  consentOptedOut?: boolean;
}

interface PatientSnapshotProps {
  patientId: string;
  patientName: string;
}

const TIER_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  full: { bg: "bg-green-100", text: "text-green-800", label: "Full Access" },
  limited: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Limited" },
  minimal: { bg: "bg-orange-100", text: "text-orange-800", label: "Minimal" },
};

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

          {!loading && data?.consentOptedOut && (
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-3"
              data-testid="consent-banner"
            >
              <p className="text-sm text-red-800">
                This patient has opted out of sharing their history with other clinics.
              </p>
            </div>
          )}

          {!loading && data?.accessDecision === "denied" && !data?.consentOptedOut && (
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
                {/* Tier badge */}
                {data.tier && TIER_BADGE[data.tier] && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIER_BADGE[data.tier].bg} ${TIER_BADGE[data.tier].text}`}>
                      {TIER_BADGE[data.tier].label}
                    </span>
                    <span className="text-xs text-gray-500">{data.accessPercent}%</span>
                  </div>
                )}

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
                      {/* Minimal tier: locked indicator */}
                      {entry.snapshotLocked && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs font-medium">
                            Snapshot Locked
                          </span>
                          {entry.historyExists && (
                            <span className="text-blue-600">History exists</span>
                          )}
                        </div>
                      )}

                      {/* Pain region (shown for minimal+ tiers) */}
                      {entry.painRegion && (
                        <p className="text-blue-800">
                          <strong>Region:</strong> {entry.painRegion}
                        </p>
                      )}

                      {/* Full header (limited+ tiers) */}
                      {entry.clinicName && (
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-blue-900">
                            {entry.clinicName}
                          </span>
                          {entry.episodeReason && (
                            <>
                              <span className="text-blue-400">|</span>
                              <span className="text-blue-700">
                                {entry.episodeReason}
                              </span>
                            </>
                          )}
                          {entry.redFlags && (
                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-medium">
                              Red Flag
                            </span>
                          )}
                        </div>
                      )}

                      {/* Diagnosis (limited+ tiers) */}
                      {entry.diagnosis && !entry.snapshotLocked && (
                        <p className="text-blue-800">
                          <strong>Region:</strong> {entry.painRegion} |{" "}
                          <strong>Dx:</strong> {entry.diagnosis}
                        </p>
                      )}

                      {/* Treatment (limited+ tiers) */}
                      {entry.treatmentModalities && (
                        <p className="text-blue-700">
                          <strong>Tx:</strong> {entry.treatmentModalities}
                        </p>
                      )}

                      {/* Structured fields (full tier) */}
                      {entry.precautions && (
                        <p className="text-blue-700 mt-0.5">
                          <strong>Precautions:</strong> {entry.precautions}
                        </p>
                      )}
                      {entry.responsePattern && (
                        <p className="text-blue-700 mt-0.5">
                          <strong>Response:</strong> {entry.responsePattern}
                        </p>
                      )}
                      {entry.suggestedNextSteps && (
                        <p className="text-blue-700 mt-0.5">
                          <strong>Next Steps:</strong> {entry.suggestedNextSteps}
                        </p>
                      )}

                      {/* Notes summary (shown instead of raw notes for cross-clinic) */}
                      {entry.notesSummary && (
                        <p className="text-blue-600 italic mt-0.5">
                          <strong>Summary:</strong> {entry.notesSummary}
                        </p>
                      )}

                      {/* Notes (full or truncated for limited, legacy updates) */}
                      {entry.notes && !entry.notesSummary && (
                        <p className="text-blue-600 italic mt-0.5">
                          {entry.notes}
                        </p>
                      )}

                      {entry.createdAt && (
                        <p className="text-blue-400 mt-1">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </p>
                      )}
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
