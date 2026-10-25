// Preloaded only by run-ui-audit.cjs. Audit emails and remote REST calls cannot leave localhost.
if (process.env.UI_AUDIT_ISOLATED === "1") {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return Promise.reject(new Error("External network disabled during isolated UI audit"));
    return original(input, init);
  };
}
