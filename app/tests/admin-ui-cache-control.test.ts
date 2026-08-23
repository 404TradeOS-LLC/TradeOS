import vm from "node:vm";
import express from "express";
import request from "supertest";
import { adminUiRouter } from "../backend/routes/adminUi.routes";
import { adminShellCss } from "../backend/views/adminShell.view";

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

    const scriptOpen = response.text.indexOf("<script>");
    const scriptClose = response.text.indexOf("</script>", scriptOpen + "<script>".length);
    expect(scriptOpen).toBeGreaterThanOrEqual(0);
    expect(scriptClose).toBeGreaterThan(scriptOpen);
    const script = response.text.slice(scriptOpen + "<script>".length, scriptClose);

    class FakeInputElement {
      value = "secret-input-token";
      valueAttribute: string | undefined = "secret-input-token";
      removeAttribute(name: string) {
        if (name === "value") this.valueAttribute = undefined;
      }
    }

    class FakeTextAreaElement {
      value = "secret-textarea-token";
      textContent = "secret-textarea-token";
    }

    const input = new FakeInputElement();
    const textarea = new FakeTextAreaElement();
    let pagehideHandler: (() => void) | undefined;

    vm.runInNewContext(script, {
      window: {
        addEventListener(event: string, handler: () => void) {
          if (event === "pagehide") pagehideHandler = handler;
        },
      },
      document: {
        querySelectorAll(selector: string) {
          expect(selector).toBe('[name="bearerToken"]');
          return [input, textarea];
        },
      },
      HTMLInputElement: FakeInputElement,
      HTMLTextAreaElement: FakeTextAreaElement,
    });

    expect(pagehideHandler).toBeDefined();
    pagehideHandler!();

    expect(input.value).toBe("");
    expect(input.valueAttribute).toBeUndefined();
    expect(textarea.value).toBe("");
    expect(textarea.textContent).toBe("");
  });

  it("sets no-store on the mounted CSS asset without changing its body or injecting the credential scrubber", async () => {
    const response = await request(createApp()).get("/admin/assets/admin.css");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toBe(adminShellCss);
    expect(response.text).not.toContain('window.addEventListener("pagehide"');
  });
});
