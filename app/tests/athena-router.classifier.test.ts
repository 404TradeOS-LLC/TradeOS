import { classifyAthenaIntent } from "../modules/athena-router/classifier";

describe("classifyAthenaIntent", () => {
  it("classifies plain questions as draft_response", () => {
    expect(classifyAthenaIntent("What is the status of this project?").intent).toBe("draft_response");
    expect(classifyAthenaIntent("Summarize this week's activity").intent).toBe("draft_response");
  });

  it("classifies mutation-shaped requests as mutate_business_record with a high risk hint", () => {
    for (const message of ["Send the invoice to the customer", "Cancel job 42", "Please approve this estimate"]) {
      const result = classifyAthenaIntent(message);
      expect(result.intent).toBe("mutate_business_record");
      expect(result.riskHint).toBe("high");
      expect(result.requestedContextIntents).toEqual([]);
    }
  });

  it("does not treat a read-only business-object noun as a mutation request", () => {
    expect(classifyAthenaIntent("Which invoices are overdue?").intent).toBe("draft_response");
    expect(classifyAthenaIntent("What's the total on this invoice?").intent).toBe("draft_response");
  });

  it("matches mutation keywords on word boundaries, not as substrings of unrelated words", () => {
    expect(classifyAthenaIntent("Can you help me design a proposal layout?").intent).toBe("draft_response"); // "sign" inside "design"
    expect(classifyAthenaIntent("What's my payment history?").intent).toBe("draft_response"); // "pay" inside "payment"
    expect(classifyAthenaIntent("Who is the assignment for?").intent).toBe("draft_response"); // "assign" inside "assignment"
  });

  it("classifies dispatch-overview phrases correctly, populating requestedContextIntents", () => {
    for (const message of ["Show me the dispatch board", "What's on the job board today?", "Give me a schedule overview", "Who's working today?", "What are today's jobs?"]) {
      const result = classifyAthenaIntent(message);
      expect(result.intent).toBe("dispatch_overview");
      expect(result.requestedContextIntents).toEqual(["dispatch_overview"]);
      expect(result.riskHint).toBe("low");
    }
  });

  it("does not let a bare mutation verb inside a dispatch-overview phrase win - dispatch/schedule as nouns beat dispatch/schedule as verbs", () => {
    // "dispatch" and "schedule" are both mutation keywords on their own, but
    // these specific phrases are read-only requests, not action requests.
    expect(classifyAthenaIntent("Can I see the dispatch board?").intent).toBe("dispatch_overview");
    expect(classifyAthenaIntent("Pull up the schedule overview for the team").intent).toBe("dispatch_overview");
  });

  it("classifies knowledge-lookup phrases correctly, populating requestedContextIntents", () => {
    for (const message of ["What's the cost of drywall?", "What's the price of a water heater?", "What's the labor rate for plumbing?", "What's the material cost for flooring?", "How much does a new roof cost?"]) {
      const result = classifyAthenaIntent(message);
      expect(result.intent).toBe("knowledge_lookup");
      expect(result.requestedContextIntents).toEqual(["knowledge_lookup"]);
      expect(result.riskHint).toBe("low");
    }
  });

  it("prefers dispatch-overview and knowledge-lookup phrases over the generic mutation match (specific beats generic)", () => {
    // Neither phrase set should ever fall through to mutate_business_record
    // just because a mutation keyword also appears in the same sentence.
    expect(classifyAthenaIntent("Book me a look at the dispatch board").intent).toBe("dispatch_overview");
  });

  it("carries a distinct reasonCode per matched branch", () => {
    expect(classifyAthenaIntent("Show me the dispatch board").reasonCode).toBe("athena_router_dispatch_overview_matched");
    expect(classifyAthenaIntent("What's the cost of drywall?").reasonCode).toBe("athena_router_knowledge_lookup_matched");
    expect(classifyAthenaIntent("Send the invoice").reasonCode).toBe("athena_router_mutation_keyword_matched");
    expect(classifyAthenaIntent("What is the status of this project?").reasonCode).toBe("athena_router_default_draft_response");
  });
});
