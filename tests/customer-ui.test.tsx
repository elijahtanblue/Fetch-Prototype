/**
 * UI Tests for customer management components:
 * - CreateCustomerForm (create new customer)
 * - CustomerManagement (remove customer, treatment date)
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import CreateCustomerForm from "@/components/CreateCustomerForm";
import CustomerManagement from "@/components/CustomerManagement";

describe("CreateCustomerForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the create button initially", () => {
    render(<CreateCustomerForm />);
    expect(screen.getByTestId("create-patient-btn")).toHaveTextContent(
      "+ Add Customer"
    );
  });

  it("opens the form when button is clicked", () => {
    render(<CreateCustomerForm />);
    fireEvent.click(screen.getByTestId("create-patient-btn"));
    expect(screen.getByTestId("create-patient-form")).toBeInTheDocument();
    expect(screen.getByLabelText("First Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Last Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of Birth *")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone Number *")).toBeInTheDocument();
  });

  it("submits the form and refreshes on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1" }),
    });

    render(<CreateCustomerForm />);
    fireEvent.click(screen.getByTestId("create-patient-btn"));

    fireEvent.change(screen.getByLabelText("First Name *"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last Name *"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth *"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number *"), {
      target: { value: "0412345678" },
    });

    fireEvent.click(screen.getByText("Add Customer"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/customers", expect.objectContaining({
        method: "POST",
      }));
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error message on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "A customer profile with this phone number already exists." }),
    });

    render(<CreateCustomerForm />);
    fireEvent.click(screen.getByTestId("create-patient-btn"));

    fireEvent.change(screen.getByLabelText("First Name *"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last Name *"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Date of Birth *"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number *"), {
      target: { value: "0400000001" },
    });

    fireEvent.click(screen.getByText("Add Customer"));

    await waitFor(() => {
      expect(screen.getByTestId("patient-form-error")).toHaveTextContent(
        "already exists"
      );
    });
  });

  it("closes the form when Cancel is clicked", () => {
    render(<CreateCustomerForm />);
    fireEvent.click(screen.getByTestId("create-patient-btn"));
    expect(screen.getByTestId("create-patient-form")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("create-patient-form")).not.toBeInTheDocument();
  });
});

describe("CustomerManagement", () => {
  const customers = [
    {
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      phoneNumber: "0400000001",
      treatmentCompletedAt: null,
      episodeCount: 0,
      petName: null,
      petType: null,
    },
    {
      id: "p2",
      firstName: "Jane",
      lastName: "Doe",
      phoneNumber: "0400000002",
      treatmentCompletedAt: "2026-02-20T00:00:00.000Z",
      episodeCount: 3,
      petName: null,
      petType: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders customer rows with phone numbers", () => {
    render(<CustomerManagement patients={customers} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("0400000001")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("disables remove button for customers with episodes", () => {
    render(<CustomerManagement patients={customers} />);
    const removeBtn = screen.getByTestId("remove-patient-p2");
    expect(removeBtn).toBeDisabled();
  });

  it("enables remove button for customers without episodes", () => {
    render(<CustomerManagement patients={customers} />);
    const removeBtn = screen.getByTestId("remove-patient-p1");
    expect(removeBtn).not.toBeDisabled();
  });

  it("shows confirmation dialog before delete", () => {
    render(<CustomerManagement patients={customers} />);
    fireEvent.click(screen.getByTestId("remove-patient-p1"));
    expect(screen.getByText("Confirm?")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete-p1")).toBeInTheDocument();
  });

  it("deletes customer on confirm", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, id: "p1" }),
    });

    render(<CustomerManagement patients={customers} />);
    fireEvent.click(screen.getByTestId("remove-patient-p1"));
    fireEvent.click(screen.getByTestId("confirm-delete-p1"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/customers/p1", {
        method: "DELETE",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
    });
  });

  it("updates treatment completed date", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1" }),
    });

    render(<CustomerManagement patients={customers} />);
    const dateInput = screen.getByTestId("treatment-date-p1");
    fireEvent.change(dateInput, { target: { value: "2026-02-24" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/customers/p1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("shows Clear button when treatment date is set", () => {
    render(<CustomerManagement patients={customers} />);
    expect(screen.getByTestId("clear-treatment-date-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("clear-treatment-date-p1")).not.toBeInTheDocument();
  });

  it("clears treatment date when Clear is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p2" }),
    });

    render(<CustomerManagement patients={customers} />);
    fireEvent.click(screen.getByTestId("clear-treatment-date-p2"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/customers/p2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ treatmentCompletedAt: null }),
        })
      );
    });
  });
});
