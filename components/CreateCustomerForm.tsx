"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCustomerForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [insuranceCommencementDate, setInsuranceCommencementDate] = useState("");
  // Pet fields
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petType, setPetType] = useState<"CAT" | "DOG" | "">("");
  const [petDesexed, setPetDesexed] = useState<boolean | null>(null);
  const [petGender, setPetGender] = useState("");
  const [petDateOfBirth, setPetDateOfBirth] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setFirstName(""); setLastName(""); setDateOfBirth(""); setPhoneNumber("");
    setAddress(""); setInsuranceCommencementDate("");
    setPetName(""); setPetBreed(""); setPetType(""); setPetDesexed(null);
    setPetGender(""); setPetDateOfBirth("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, dateOfBirth, phoneNumber,
          address: address || undefined,
          insuranceCommencementDate: insuranceCommencementDate || undefined,
          petName: petName || undefined,
          petBreed: petBreed || undefined,
          petType: petType || undefined,
          petDesexed: petDesexed ?? undefined,
          petGender: petGender || undefined,
          petDateOfBirth: petDateOfBirth || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create customer");
        return;
      }

      resetForm();
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fetch-pink)] text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
      >
        + Add Customer
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4" data-testid="create-patient-form">
      <h3 className="text-sm font-semibold text-[var(--fetch-dark)] mb-3">New Customer &amp; Pet</h3>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Owner section */}
        <div>
          <p className="text-xs font-bold text-[var(--fetch-gray)] uppercase tracking-wide mb-2">Owner Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="customer-first-name" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">First Name *</label>
              <input id="customer-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-last-name" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Last Name *</label>
              <input id="customer-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-dob" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Date of Birth *</label>
              <input id="customer-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-phone" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Phone Number *</label>
              <input id="customer-phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0412345678" required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div className="col-span-2">
              <label htmlFor="customer-address" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Address</label>
              <input id="customer-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Sydney NSW 2000"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-insurance-date" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Insurance Start Date</label>
              <input id="customer-insurance-date" type="date" value={insuranceCommencementDate} onChange={(e) => setInsuranceCommencementDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
          </div>
        </div>

        {/* Pet section */}
        <div>
          <p className="text-xs font-bold text-[var(--fetch-gray)] uppercase tracking-wide mb-2">Pet Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pet-name" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Pet Name</label>
              <input id="pet-name" type="text" value={petName} onChange={(e) => setPetName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="pet-breed" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Breed</label>
              <input id="pet-breed" type="text" value={petBreed} onChange={(e) => setPetBreed(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="pet-type" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Type</label>
              <select id="pet-type" value={petType} onChange={(e) => setPetType(e.target.value as "CAT" | "DOG" | "")}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]">
                <option value="">Select…</option>
                <option value="CAT">🐱 Cat</option>
                <option value="DOG">🐶 Dog</option>
              </select>
            </div>
            <div>
              <label htmlFor="pet-gender" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Gender</label>
              <select id="pet-gender" value={petGender} onChange={(e) => setPetGender(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]">
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label htmlFor="pet-dob" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Pet Date of Birth</label>
              <input id="pet-dob" type="date" value={petDateOfBirth} onChange={(e) => setPetDateOfBirth(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div className="flex items-end pb-0.5">
              <fieldset>
                <legend className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Desexed?</legend>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="petDesexed" value="yes" checked={petDesexed === true} onChange={() => setPetDesexed(true)} /> Yes
                  </label>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="petDesexed" value="no" checked={petDesexed === false} onChange={() => setPetDesexed(false)} /> No
                  </label>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600" data-testid="patient-form-error">{error}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={submitting}
            className="px-3 py-1.5 bg-[var(--fetch-pink)] text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? "Creating..." : "Add Customer"}
          </button>
          <button type="button" onClick={() => { setIsOpen(false); setError(""); resetForm(); }}
            className="px-3 py-1.5 border border-gray-200 text-sm text-[var(--fetch-gray)] rounded-full hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
