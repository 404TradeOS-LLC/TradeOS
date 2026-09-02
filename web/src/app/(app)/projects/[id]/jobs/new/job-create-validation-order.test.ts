import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formUrl = new URL("./job-create-form.tsx", import.meta.url);

async function readFormSource() {
  return readFile(formUrl, "utf8");
}

test("job identity fields are trimmed and validated before a service address can be created", async () => {
  const source = await readFormSource();
  const submitStart = source.indexOf("async function onSubmit");
  const formDataIndex = source.indexOf("const formData = new FormData(event.currentTarget);", submitStart);
  const titleIndex = source.indexOf('const title = String(formData.get("title")', submitStart);
  const jobTypeIndex = source.indexOf('const jobType = String(formData.get("jobType")', submitStart);
  const validationIndex = source.indexOf('if (!title || !jobType) throw new Error("Job title and job type are required.");', submitStart);
  const addressWriteIndex = source.indexOf("serviceAddressId = await createServiceAddress(formData);", submitStart);
  const jobWriteIndex = source.indexOf('clientFetch<CreatedJob>("/jobs"', submitStart);

  for (const [label, index] of [
    ["submit handler", submitStart],
    ["form data", formDataIndex],
    ["title normalization", titleIndex],
    ["job type normalization", jobTypeIndex],
    ["job field validation", validationIndex],
    ["service-address write", addressWriteIndex],
    ["job write", jobWriteIndex],
  ] as const) {
    assert.notEqual(index, -1, `expected ${label}`);
  }

  assert.ok(formDataIndex < titleIndex);
  assert.ok(titleIndex < validationIndex);
  assert.ok(jobTypeIndex < validationIndex);
  assert.ok(validationIndex < addressWriteIndex, "job validation must happen before the CRM address mutation");
  assert.ok(addressWriteIndex < jobWriteIndex, "address creation still precedes job creation when a new address is required");
});
