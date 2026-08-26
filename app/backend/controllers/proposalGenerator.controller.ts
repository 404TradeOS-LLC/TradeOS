import { Request, Response } from "express";
import { z } from "zod";
import { ProposalGeneratorService } from "../../modules/proposal-generator/service";
import { requireOrgId } from "../requestContext";

const service = new ProposalGeneratorService();

export const proposalGeneratorController = {
  async generate(req: Request, res: Response) {
    const schema = z.object({
      companyName: z.string().optional(),
      showLineItemDetail: z.boolean().optional(),
      termsAndConditions: z.string().optional(),
    });
    const body = schema.parse(req.body ?? {});
    const doc = await service.generateProposal({ estimateId: req.params.id, orgId: requireOrgId(req), ...body });
    res.setHeader("Content-Type", doc.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  },
};
