import type { AthenaWarning } from "./types";

// Typed constructor for the existing AthenaWarning shape (C003). No fields
// beyond `code`/`message` exist on AthenaWarning, so there is nothing this
// helper could add - it exists purely so a tool author gets
// autocomplete/typo-catching on `code`/`message` instead of hand-writing an
// object literal.
export interface AthenaWarningInput {
  code: string;
  message: string;
}

export function warning(input: AthenaWarningInput): AthenaWarning {
  return { code: input.code, message: input.message };
}
