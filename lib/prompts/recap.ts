/**
 * Video recap: a concept summary used as a NotebookLM source.
 * INTEGRITY: students share these videos and sharing code is forbidden,
 * so the recap must stay concept-level. The raw Mode 2 code is never sent
 * to this prompt (see app/api/recap/route.ts), and the guard additionally
 * checks the output for lines copied from that code.
 */
export const RECAP_PROMPT = `Task: Write a concept recap document from a study session.
You receive a transcript of a student's session with a learning companion (guiding questions, plain-language descriptions of code, and syntax answers).
Write a short document in Markdown in {LANGUAGE}:
- First line: "# {TITLE}"
- A section for the Python concepts and syntax topics that came up (for example nested loops, \`range\`, dictionaries, what a \`TypeError\` means). For each concept use a "## " heading with the concept name, a plain 2-4 sentence explanation, and at most one tiny generic example in a \`\`\`python block (max 8 lines) using toy data (fruits, pets, colors, grades).
- A final "## " section about the thinking steps the student practised (understanding inputs and outputs, working an example by hand, edge cases, splitting into steps), in general terms only.
Strict rules:
- Do NOT include the student's code, any line from it, their variable or function names, their assignment, or any task-specific logic or approach.
- Do NOT describe what the student's program was supposed to do.
- No example may resemble the student's task. Use at most 6 concept sections.
- Output only the document.`;

export function recapPrompt(language: string, title: string): string {
  return RECAP_PROMPT.replaceAll("{LANGUAGE}", language).replaceAll("{TITLE}", title);
}
