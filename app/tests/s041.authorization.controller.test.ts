import { changeOrdersController } from "../backend/controllers/changeOrders.controller";
import { supplierDatabaseController } from "../backend/controllers/supplierDatabase.controller";
import { ChangeOrdersService } from "../modules/change-orders/service";
import { SupplierDatabaseService } from "../modules/supplier-database/service";

jest.mock("../modules/change-orders/service", () => ({
  ChangeOrdersService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));

jest.mock("../modules/supplier-database/service", () => ({
  SupplierDatabaseService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));

function requestFor(role: string) {
  return {
    auth: { userId: "user-1", orgId: "org-1", role },
    orgId: "org-1",
    body: {
      projectId: "00000000-0000-4000-8000-000000000001",
      description: "Additional work",
      name: "Supplier",
    },
  } as never;
}

describe("S041 application authorization boundaries", () => {
  it("denies technician change-order mutations before the service layer", async () => {
    await expect(
      changeOrdersController.create(requestFor("technician"), {} as never)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect((ChangeOrdersService as jest.Mock).mock.results[0].value.create).not.toHaveBeenCalled();
  });

  it("denies technician supplier mutations before the service layer", async () => {
    await expect(
      supplierDatabaseController.create(requestFor("technician"), {} as never)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect((SupplierDatabaseService as jest.Mock).mock.results[0].value.create).not.toHaveBeenCalled();
  });

  it("keeps the approved mutation permissions available to their existing roles", async () => {
    const changeOrderResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const supplierResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const changeOrderService = (ChangeOrdersService as jest.Mock).mock.results[0].value;
    const supplierService = (SupplierDatabaseService as jest.Mock).mock.results[0].value;
    changeOrderService.create.mockResolvedValue({ id: "change-order-1" });
    supplierService.create.mockResolvedValue({ id: "supplier-1" });

    await changeOrdersController.create(requestFor("dispatcher"), changeOrderResponse as never);
    await supplierDatabaseController.create(requestFor("admin"), supplierResponse as never);

    expect(changeOrderService.create).toHaveBeenCalled();
    expect(supplierService.create).toHaveBeenCalled();
  });
});
