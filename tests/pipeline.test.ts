import { describe, expect, it, vi } from "vitest";
import { runWithGuard } from "@/lib/pipeline";
import { AllProvidersFailedError } from "@/lib/llm/types";

const messages = [
  { role: "system" as const, content: "rules" },
  { role: "user" as const, content: "I need to add up numbers" },
];

const reply = (text: string) => ({ text, provider: "test" });
const BAD = "Here you go:\n```python\ntotal = 0\n```";
const GOOD = "What does the function receive?";

describe("runWithGuard", () => {
  it("returns a reply that passes the guard", async () => {
    const complete = vi.fn().mockResolvedValue(reply(GOOD));
    const res = await runWithGuard({ task: "breakdown", messages, temperature: 0.5, complete });
    expect(res).toEqual({ ok: true, text: GOOD });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("retries once with a reminder after a rejection", async () => {
    const complete = vi.fn().mockResolvedValueOnce(reply(BAD)).mockResolvedValueOnce(reply(GOOD));
    const res = await runWithGuard({ task: "breakdown", messages, temperature: 0.5, complete });
    expect(res).toEqual({ ok: true, text: GOOD });
    expect(complete).toHaveBeenCalledTimes(2);
    const retryMsgs = complete.mock.calls[1][0].messages;
    expect(retryMsgs.at(-1).content).toMatch(/broke a rule/);
    expect(retryMsgs.at(-1).content).toMatch(/code block/);
  });

  it("returns guard_blocked after two rejections", async () => {
    const complete = vi.fn().mockResolvedValue(reply(BAD));
    const res = await runWithGuard({ task: "breakdown", messages, temperature: 0.5, complete });
    expect(res).toEqual({ ok: false, reason: "guard_blocked" });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("returns unavailable when all providers fail", async () => {
    const complete = vi.fn().mockRejectedValue(new AllProvidersFailedError([]));
    const res = await runWithGuard({ task: "syntax", messages, temperature: 0.3, complete });
    expect(res).toEqual({ ok: false, reason: "unavailable" });
  });

  it("logs only the rule name, not the content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const complete = vi.fn().mockResolvedValue(reply(BAD));
    await runWithGuard({ task: "breakdown", messages, temperature: 0.5, complete });
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/\[guard\] mode=breakdown rule=code_block/);
    expect(logged).not.toMatch(/total|add up/);
    warn.mockRestore();
  });
});
