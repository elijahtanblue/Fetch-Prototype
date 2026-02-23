"use client";

import { useState } from "react";

interface Clinic {
  id: string;
  name: string;
  optedIn: boolean;
}

interface Patient {
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
}

interface Props {
  clinics: Clinic[];
  patients: Patient[];
}

export default function SimulationPanel({ clinics, patients }: Props) {
  const [selectedClinicId, setSelectedClinicId] = useState(clinics[0]?.id ?? "");
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? "");
  const [accessClinicId, setAccessClinicId] = useState(clinics[0]?.id ?? "");
  const [accessPatientId, setAccessPatientId] = useState(patients[0]?.id ?? "");

  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [accessResult, setAccessResult] = useState<AccessDecision | null>(null);
  const [replayResults, setReplayResults] = useState<ReplayResult[]>([]);
  const [loading, setLoading] = useState("");
  const [lastResult, setLastResult] = useState<string>("");

  // Update form fields
  const [painRegion, setPainRegion] = useState("Lower back, L4-L5");
  const [diagnosis, setDiagnosis] = useState("Lumbar disc herniation");
  const [treatmentModalities, setTreatmentModalities] = useState("Manual therapy, exercise prescription");
  const [redFlags, setRedFlags] = useState(false);
  const [notes, setNotes] = useState("");
  const [visitReason, setVisitReason] = useState("Patient assessment");
  const [lastEpisodeId, setLastEpisodeId] = useState<string>("");

  async function fetchEvents() {
    const res = await fetch("/api/simulation/events");
    if (res.ok) {
      setEvents(await res.json());
    }
  }

  async function handleToggle() {
    setLoading("toggle");
    const res = await fetch("/api/simulation/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId: selectedClinicId }),
    });
    const data = await res.json();
    setLastResult(`Toggle: ${data.data?.name} → ${data.data?.optedIn ? "Opted In" : "Not Opted In"}`);
    await fetchEvents();
    setLoading("");
  }

  async function handleVisit() {
    setLoading("visit");
    const res = await fetch("/api/simulation/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId: selectedClinicId,
        patientId: selectedPatientId,
        reason: visitReason,
      }),
    });
    const data = await res.json();
    if (data.data?.episodeId) {
      setLastEpisodeId(data.data.episodeId);
    }
    setLastResult(`Visit created: Episode ${data.data?.episodeId?.slice(0, 8)}...`);
    await fetchEvents();
    setLoading("");
  }

  async function handleUpdate() {
    if (!lastEpisodeId) {
      setLastResult("Error: Create a visit first to get an episode ID");
      return;
    }
    setLoading("update");
    const res = await fetch("/api/simulation/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId: selectedClinicId,
        episodeId: lastEpisodeId,
        painRegion,
        diagnosis,
        treatmentModalities,
        redFlags,
        notes,
      }),
    });
    const data = await res.json();
    setLastResult(`Clinical update added: ${data.data?.painRegion}`);
    await fetchEvents();
    setLoading("");
  }

  async function handleCheckAccess() {
    setLoading("access");
    const res = await fetch("/api/simulation/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId: accessClinicId,
        patientId: accessPatientId,
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
        patientId: accessPatientId,
      }),
    });
    const data = await res.json();
    setReplayResults(data);
    setLoading("");
  }

  const getClinicName = (id: string) => clinics.find((c) => c.id === id)?.name ?? id;
  const getPatientName = (id: string) => {
    const p = patients.find((p) => p.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };

  return (
    <div className="space-y-6">
      {/* Action Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Simulate Actions</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acting Clinic</label>
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              data-testid="clinic-selector"
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              data-testid="patient-selector"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visit reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Visit Reason</label>
          <input
            type="text"
            value={visitReason}
            onChange={(e) => setVisitReason(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleToggle}
            disabled={!!loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
            data-testid="toggle-btn"
          >
            {loading === "toggle" ? "Toggling..." : "Toggle Opt-In"}
          </button>
          <button
            onClick={handleVisit}
            disabled={!!loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            data-testid="visit-btn"
          >
            {loading === "visit" ? "Creating..." : "Simulate Visit"}
          </button>
        </div>

        {/* Clinical update fields */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Clinical Update Fields</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Pain Region</label>
              <input type="text" value={painRegion} onChange={(e) => setPainRegion(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Diagnosis</label>
              <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Treatment Modalities</label>
              <input type="text" value={treatmentModalities} onChange={(e) => setTreatmentModalities(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={redFlags} onChange={(e) => setRedFlags(e.target.checked)}
                  className="rounded border-gray-300" />
                Red Flags
              </label>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" rows={2} />
          </div>
          <button
            onClick={handleUpdate}
            disabled={!!loading || !lastEpisodeId}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            data-testid="update-btn"
          >
            {loading === "update" ? "Adding..." : "Add Clinical Update"}
          </button>
          {!lastEpisodeId && (
            <p className="text-xs text-gray-500 mt-1">Create a visit first to enable clinical updates</p>
          )}
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm text-gray-700" data-testid="last-result">
            {lastResult}
          </div>
        )}
      </div>

      {/* Access Check Section */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <select
              value={accessPatientId}
              onChange={(e) => setAccessPatientId(e.target.value)}
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

      {/* Replay Results */}
      {replayResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Replay Timeline</h2>
          <div className="space-y-3" data-testid="replay-timeline">
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
          <p className="text-sm text-gray-500">No simulation events yet. Use the actions above to generate events.</p>
        ) : (
          <div className="space-y-2" data-testid="event-log">
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
                <span className="text-gray-400 text-xs ml-auto">
                  {new Date(event.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
