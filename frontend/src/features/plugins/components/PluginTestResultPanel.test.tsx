import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PluginTestResultPanel } from "@/features/plugins/components/PluginTestResultPanel";
import type { ApiPluginTestResult } from "@/features/plugins/types";

const stats = {
  ratio: 2.5,
  uploadedBytes: 1073741824,
  downloadedBytes: 0,
  seedBonus: "1,234",
  buffer: null,
  hitAndRuns: 0,
  requiredRatio: 1,
  seedingTorrents: 12,
  leechingTorrents: 0,
  activeTorrents: 12,
};

describe("PluginTestResultPanel", () => {
  it("shows a success with every step status and the extracted stats", () => {
    const result: ApiPluginTestResult = {
      outcome: "success",
      steps: [
        { name: "profile", method: "GET", path: "/api/user", statusCode: 200 },
        { name: "torrents", method: "GET", path: "/torrents", statusCode: 204 },
      ],
      stats,
      failedField: null,
      error: null,
    };

    render(<PluginTestResultPanel result={result} />);

    expect(screen.getByTestId("plugin-test-result")).toHaveAttribute("data-outcome", "success");
    expect(screen.getByTestId("plugin-test-outcome")).toHaveTextContent("Success");
    expect(screen.getByTestId("plugin-test-step-profile")).toHaveTextContent("GET /api/user");
    expect(screen.getByTestId("plugin-test-step-profile")).toHaveTextContent("HTTP 200");
    expect(screen.getByTestId("plugin-test-step-torrents")).toHaveTextContent("HTTP 204");

    const statList = screen.getByTestId("plugin-test-stats");
    expect(statList).toHaveTextContent("Ratio2.5");
    expect(statList).toHaveTextContent("Uploaded1 GB");
    expect(statList).toHaveTextContent("Downloaded0 B");
    expect(statList).toHaveTextContent("Seed bonus1,234");
    expect(statList).toHaveTextContent("Seeding12");
    expect(statList).not.toHaveTextContent("Buffer");
    expect(screen.queryByTestId("plugin-test-failed-field")).toBeNull();
    expect(screen.queryByTestId("plugin-test-error")).toBeNull();
  });

  it("shows an infinite ratio when nothing was downloaded", () => {
    const result: ApiPluginTestResult = {
      outcome: "success",
      steps: [{ name: "profile", method: "GET", path: "/api/user", statusCode: 200 }],
      stats: { ...stats, ratio: null },
      failedField: null,
      error: null,
    };

    render(<PluginTestResultPanel result={result} />);

    expect(screen.getByTestId("plugin-test-stats")).toHaveTextContent("Ratio∞");
  });

  it("shows an auth failure with the failing HTTP status and the error", () => {
    render(
      <PluginTestResultPanel
        result={{
          outcome: "authFailed",
          steps: [{ name: "profile", method: "GET", path: "/api/user", statusCode: 401 }],
          stats: null,
          failedField: null,
          error: "The tracker rejected the credentials.",
        }}
      />,
    );

    expect(screen.getByTestId("plugin-test-outcome")).toHaveTextContent("Authentication failed");
    expect(screen.getByTestId("plugin-test-step-profile")).toHaveTextContent("HTTP 401");
    expect(screen.getByTestId("plugin-test-error")).toHaveTextContent("The tracker rejected the credentials.");
    expect(screen.getByText("No stats were extracted.")).toBeInTheDocument();
  });

  it("names the failing field and its step", () => {
    render(
      <PluginTestResultPanel
        result={{
          outcome: "unknownError",
          steps: [{ name: "profile", method: "GET", path: "/user", statusCode: 200 }],
          stats: null,
          failedField: { step: "profile", field: "ratio", error: "No element matched '.ratio'." },
          error: "Extraction failed.",
        }}
      />,
    );

    expect(screen.getByTestId("plugin-test-outcome")).toHaveTextContent("Failed");
    const failed = screen.getByTestId("plugin-test-failed-field");
    expect(failed).toHaveTextContent("Failed field ratio in step profile");
    expect(failed).toHaveTextContent("No element matched '.ratio'.");
    expect(screen.getByTestId("plugin-test-error")).toHaveTextContent("Extraction failed.");
  });

  it("does not repeat an error that only restates the failing field", () => {
    render(
      <PluginTestResultPanel
        result={{
          outcome: "unknownError",
          steps: [],
          stats: null,
          failedField: { step: "user", field: "ratio", error: "Failed to extract 'ratio'." },
          error: "Failed to extract 'ratio'.",
        }}
      />,
    );

    expect(screen.getByTestId("plugin-test-failed-field")).toHaveTextContent("Failed to extract 'ratio'.");
    expect(screen.queryByTestId("plugin-test-error")).toBeNull();
  });

  it("names a failing mapping field and explains that no request was sent", () => {
    render(
      <PluginTestResultPanel
        result={{
          outcome: "unknownError",
          steps: [],
          stats: null,
          failedField: { step: null, field: "mapping.ratio", error: "Value is not a number." },
          error: null,
        }}
      />,
    );

    expect(screen.getByTestId("plugin-test-failed-field")).toHaveTextContent("Failed field mapping.ratio in the mapping");
    expect(screen.getByText("No request was sent.")).toBeInTheDocument();
  });
});
