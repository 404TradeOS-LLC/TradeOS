import { preventAdminResponseCaching } from "../backend/routes/adminUi.routes";

describe("legacy admin UI cache policy", () => {
  it("marks admin responses as no-store before continuing", () => {
    const res = {
      set: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    preventAdminResponseCaching({} as never, res as never, next);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
