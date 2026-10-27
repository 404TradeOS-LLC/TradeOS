import { spawnSync } from "node:child_process";

// A parser crash must not take down Jest or its other suites. Exercise the
// real production Express/body-parser graph in a disposable child process.
it("survives a compressed JSON frame with trailing bytes and serves the next request", () => {
  const script = `
    const express = require('express');
    const http = require('node:http');
    const zlib = require('node:zlib');
    const app = express();
    app.use(express.json());
    app.post('/', (_req, res) => res.json({ ok: true }));
    app.use((error, _req, res, _next) => res.status(error.status || 400).json({ rejected: true }));
    const server = app.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      function send(body, compressed) {
        return new Promise((resolve, reject) => {
          const headers = { 'Content-Type': 'application/json', 'Content-Length': body.length };
          if (compressed) headers['Content-Encoding'] = 'gzip';
          const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'POST', headers }, res => {
            res.resume(); res.on('end', () => resolve(res.statusCode));
          });
          req.on('error', reject); req.setTimeout(2000, () => req.destroy(new Error('request timeout'))); req.end(body);
        });
      }
      try {
        const compressed = Buffer.concat([zlib.gzipSync(Buffer.from('{"ok":true}')), Buffer.from([0xff, 0xff, 0xff])]);
        const first = await send(compressed, true);
        const second = await send(Buffer.from('{"ok":true}'), false);
        if (![200, 400].includes(first) || second !== 200) throw new Error('unexpected parser response');
        console.log(JSON.stringify({ first, second }));
        server.close(() => { process.exitCode = 0; });
      } catch (error) { console.error(error.message); server.close(() => { process.exitCode = 1; }); }
    });
  `;
  const child = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 10_000 });
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status).toBe(0);
  expect(JSON.parse(child.stdout.trim()).second).toBe(200);
});
