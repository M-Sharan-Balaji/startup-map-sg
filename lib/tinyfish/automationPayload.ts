/**
 * Extra fields for `POST /v1/automation/run` and `.../run-sse`, aligned with the working
 * Propelix (FastAPI) integration: browser_profile, proxy_config, api_integration.
 * @see https://github.com/M-Sharan-Balaji/propelix/blob/main/main.py (run_tinyfish / tinyfish_stream_proxy)
 */
export function getTinyfishApiIntegration(): string {
  return process.env.TINYFISH_API_INTEGRATION?.trim() || "sg-startup-map";
}

export function tinyfishAutomationFields(): {
  browser_profile: "stealth";
  proxy_config: { enabled: boolean };
  api_integration: string;
} {
  return {
    browser_profile: "stealth",
    proxy_config: { enabled: false },
    api_integration: getTinyfishApiIntegration(),
  };
}
