import express from "express";
import request from "supertest";
import { adminUiRouter } from "../backend/routes/adminUi.routes";

describe("legacy admin UI cache policy", () => {
  function createApp() {
    const app = express();
    app.use("/admin", adminUiRouter);
    return app;
  }

  it("hardens a mounted HTML admin route against HTTP and back-forward caching", async () => {
    const response = await request(createApp()).get("/admin");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toContain('window.addEventListener("pagehide"');
    expect(response.text).toContain('document.querySelectorAll(\'[name="bearerToken"]\')');
    expect(response.text).toContain('field.removeAttribute("value")');
    expect(response.text).toContain('field.textContent = ""');
  });

  it("sets no-store on the mounted CSS asset without injecting the credential scrubber", async () => {
    const response = await request(createApp()).get("/admin/assets/admin.css");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).not.toContain('window.addEventListener("pagehide"');
  });
});
