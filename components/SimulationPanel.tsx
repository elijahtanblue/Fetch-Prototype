"use client";

import { useState } from "react";

interface Clinic {
  id: string;
  name: string;
  optedIn: boolean;
}

interface Pet {
  id: string;
  firstName: string;
  lastName: string;
}

interface SimulationEvent {
  id: string;
  type: string;
  clinicId: string;
  userId: string;
  metadata: string;
  createdAt: string;
  clinic: { name: string };
  user: { name: string };
}

interface AccessDecision {
  allowed: boolean;
  reasonCode?: string;
  explanation?: string;
}

interface ReplayResult {
  action: string;
  success: boolean;
  data: Record<string, unknown>;
  accessDecision?: AccessDecision;
  timestamp?: string;
}

interface Props {
  clinics: Clinic[];
  patients: Pet[];
}

/**
 * Formats a date string or Date to DD/MM/YYYY, HH:MM.
 */
export function formatTimestamp(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

export default function SimulationPanel({ clinics, patients }: Props) {
  const [accessClinicId, setAccessClinicId] = useState(clinics[0]?.id ?? "");
  const [accessPetId, setAccessPetId] = useState(patients[0]?.id ?? "");

  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [accessResult, setAccessResult] = useState<AccessDecision | null>(null);
  const [replayResults, setReplayResults] = useState<ReplayResult[]>([]);
  const [loading, setLoading] = useState("");

  async function fetchEvents() {
    const res = await fetch("/api/simulation/events");
    if (res.ok) {
      setEvents(await res.json());
    }
  }

  async function handleCheckAccess() {
    setLoading("access");
    const res = await fetch("/api/simulation/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId: accessClinicId,
        patientId: accessPetId,
      }),
    });
    const data = await res.json();
    setAccessResult(data);
    setLoading("");
  }

  async function handleReplay() {
    setLoading("replay");
    const res = await fetch("/api/simulation/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewerClinicId: accessClinicId,
        patientId: accessPetId,
      }),
    });
    const data = await res.json();
    setReplayResults(data);
    setLoading("");
  }

  const getClinicName = (id: string) => clinics.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Check Access Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Check Access Decision</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Viewing Clinic</label>
            <select
              value={accessClinicId}
              onChange={(e) => setAccessClinicId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              data-testid="access-clinic-selector"
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet</label>
            <select
              value={accessPetId}
              onChange={(e) => setAccessPetId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              data-testid="access-patient-selector"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCheckAccess}
            disabled={!!loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
            data-testid="check-access-btn"
          >
            {loading === "access" ? "Checking..." : "Check Access"}
          </button>
          <button
            onClick={handleReplay}
            disabled={!!loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
            data-testid="replay-btn"
          >
            {loading === "replay" ? "Replaying..." : "Replay All Events"}
          </button>
        </div>

        {/* Access result */}
        {accessResult && (
          <div
            className={`mt-4 p-4 rounded-md ${
              accessResult.allowed
                ? "bg-green-50 border border-green-200"
                : "bg-amber-50 border border-amber-200"
            }`}
            data-testid="access-result"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                accessResult.allowed
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {accessResult.allowed ? "Allowed" : "Denied"}
              </span>
              {accessResult.reasonCode && (
                <span className="text-xs font-mono text-gray-600">{accessResult.reasonCode}</span>
              )}
            </div>
            {accessResult.explanation && (
              <p className="text-sm text-gray-700">{accessResult.explanation}</p>
            )}
          </div>
        )}
      </div>

      {/* Replay Timeline */}
      {replayResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Replay Timeline</h2>
          <div className="space-y-3 max-h-[360px] overflow-y-auto" data-testid="replay-timeline">
            {replayResults.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--kinetic-gold)] text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{r.action}</span>
                    <span className="text-xs text-gray-500">
                      {getClinicName(r.data.clinicId as string)}
                    </span>
                  </div>
                  {r.timestamp && (
                    <span className="text-xs text-gray-400" data-testid={`replay-timestamp-${i}`}>
                      {formatTimestamp(r.timestamp)}
                    </span>
                  )}
                  {r.accessDecision && (
                    <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                      r.accessDecision.allowed
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {r.accessDecision.allowed
                        ? "Access: Allowed"
                        : `Access: Denied (${r.accessDecision.reasonCode})`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Event Log</h2>
          <button
            onClick={fetchEvents}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            data-testid="refresh-events-btn"
          >
            Refresh
          </button>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-[288px] overflow-y-auto" data-testid="event-log">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  event.type === "TOGGLE_OPT_IN"
                    ? "bg-purple-100 text-purple-800"
                    : event.type === "VISIT"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-green-100 text-green-800"
                }`}>
                  {event.type}
                </span>
                <span className="text-gray-700">{event.clinic.name}</span>
                <span className="text-gray-400 text-xs ml-auto" data-testid={`event-timestamp-${event.id}`}>
                  {formatTimestamp(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
