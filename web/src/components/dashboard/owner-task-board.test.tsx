import { renderToStaticMarkup } from "react-dom/server";
import { OwnerTaskBoard } from "./owner-task-board";

describe("OwnerTaskBoard", () => {
  const now = new Date("2026-08-10T13:00:00.000Z");

  it("renders the empty state when there are no open tasks", () => {
    const markup = renderToStaticMarkup(<OwnerTaskBoard tasks={[]} now={now} timeZone="UTC" />);

    expect(markup).toContain("No open tasks right now.");
    expect(markup).toContain("Review projects");
  });

  it("renders the error state when the task feed fails", () => {
    const markup = renderToStaticMarkup(
      <OwnerTaskBoard tasks={[]} now={now} timeZone="UTC" errorMessage="Request failed" />
    );

    expect(markup).toContain("Task data is temporarily unavailable.");
    expect(markup).toContain("Request failed");
  });

  it("renders prioritized live task rows", () => {
    const markup = renderToStaticMarkup(
      <OwnerTaskBoard
        now={now}
        timeZone="UTC"
        tasks={[
          {
            id: "task-1",
            projectId: "project-1",
            title: "Call inspector",
            status: "blocked",
            assignedTo: "Alex",
            dueDate: "2026-08-09T12:00:00.000Z",
            priority: "high",
            notes: null,
            completedAt: null,
            createdAt: "2026-08-07T12:00:00.000Z",
            updatedAt: "2026-08-10T10:00:00.000Z",
            projectName: "Lobby refresh",
            projectStatus: "awarded",
            customerName: "Northside Dental",
            jobTitle: "Final paint and punch",
          },
        ]}
      />
    );

    expect(markup).toContain("Call inspector");
    expect(markup).toContain("Overdue");
    expect(markup).toContain("/projects/project-1?tab=tasks");
  });
});
