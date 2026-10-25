/* eslint-disable @typescript-eslint/no-require-imports */
// Small, process-local S3 fixture. No real credentials or external storage are used.
const http = require("node:http");
exports.startStorage = async () => {
  const objects = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    const key = new URL(req.url, "http://localhost").pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (req.method === "PUT") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      objects.set(key, { body: Buffer.concat(chunks), type: req.headers["content-type"] });
      res.setHeader("ETag", '"audit-object"');
      res.writeHead(200).end();
      return;
    }
    if (req.method === "DELETE") {
      objects.delete(key);
      res.writeHead(204).end();
      return;
    }
    const object = objects.get(key);
    if (!object) {
      res.writeHead(404).end("Missing audit object");
      return;
    }
    res.setHeader("Content-Type", object.type ?? "application/octet-stream");
    res.setHeader("Content-Length", object.body.length);
    res.writeHead(200).end(req.method === "HEAD" ? undefined : object.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};
