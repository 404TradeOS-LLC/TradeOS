import { preventAdminResponseCaching } from "../backend/routes/adminUi.routes";

describe("legacy admin UI cache policy", () => {
  it("marks admin responses as no-store and injects bearer-token scrubbing into HTML", () => {
    const send = jest.fn().mockReturnValue(undefined);
    const res = {
      set: jest.fn().mockReturnThis(),
      getHeader: jest.fn().mockReturnValue("text/html; charset=utf-8"),
      send,
    };
    const next = jest.fn();

    preventAdminResponseCaching({} as never, res as never, next);
    res.send('<html><body><input type="hidden" name="bearerToken" value="secret" /></body></html>');

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.set).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('window.addEventListener("pagehide"'));
    expect(send).toHaveBeenCalledWith(expect.stringContaining("field.removeAttribute(\"value\")"));
    expect(send).toHaveBeenCalledWith(expect.stringContaining('field.textContent = ""'));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not inject the credential scrubber into non-HTML admin assets", () => {
    const send = jest.fn().mockReturnValue(undefined);
    const res = {
      set: jest.fn().mockReturnThis(),
      getHeader: jest.fn().mockReturnValue("text/css; charset=utf-8"),
      send,
    };

    preventAdminResponseCaching({} as never, res as never, jest.fn());
    res.send("body{color:black}");

    expect(send).toHaveBeenCalledWith("body{color:black}");
  });
});
