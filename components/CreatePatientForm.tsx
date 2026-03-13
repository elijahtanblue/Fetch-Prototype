"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePatientForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, dateOfBirth, phoneNumber }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create pet");
        return;
      }

      setFirstName("");
      setLastName("");
      setDateOfBirth("");
      setPhoneNumber("");
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        data-testid="create-patient-btn"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
      >
        + Create New Pet
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4" data-testid="create-patient-form">
      <h3 className="text-sm font-semibold text-[var(--kinetic-dark)] mb-3">
        New Pet
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="patient-first-name" className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1">
              First Name
            </label>
            <input
              id="patient-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
            />
          </div>
          <div>
            <label htmlFor="patient-last-name" className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1">
              Last Name
            </label>
            <input
              id="patient-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="patient-dob" className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1">
              Date of Birth
            </label>
            <input
              id="patient-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
            />
          </div>
          <div>
            <label htmlFor="patient-phone" className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1">
              Phone Number
            </label>
            <input
              id="patient-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0412345678"
              required
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
            />
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-600" data-testid="patient-form-error">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Pet"}
          </button>
          <button
            type="button"
            onClick={() => { setIsOpen(false); setError(""); }}
            className="px-3 py-1.5 border border-gray-200 text-sm text-[var(--kinetic-gray)] rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
