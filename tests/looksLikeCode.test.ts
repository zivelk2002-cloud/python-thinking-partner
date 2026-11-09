import { describe, expect, it } from "vitest";
import { looksLikeCode } from "@/lib/looksLikeCode";

describe("looksLikeCode", () => {
  it("flags a pasted function", () => {
    const code = "what's wrong here?\ndef f(nums):\n    total = 0\n    for n in nums:\n        total += n\n    return total";
    expect(looksLikeCode(code)).toBe(true);
  });

  it("flags fenced code of several lines", () => {
    expect(looksLikeCode("fix this\n```\na=1\nb=2\nprint(a+b)\n```")).toBe(true);
  });

  it("does not flag ordinary questions", () => {
    expect(looksLikeCode("What does split() return?")).toBe(false);
    expect(looksLikeCode("מה ההבדל בין for ל-while?")).toBe(false);
    expect(looksLikeCode("What's the syntax of a list comprehension, like [x for x in y]?")).toBe(false);
  });

  it("does not flag a traceback on its own", () => {
    const tb = [
      "What does this mean?",
      "Traceback (most recent call last):",
      '  File "main.py", line 3, in <module>',
      "    total = total + name",
      "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
    ].join("\n");
    expect(looksLikeCode(tb)).toBe(false);
  });

  it("does not flag one or two lines of code", () => {
    expect(looksLikeCode("is `x = 5` the same as\nx=5\n?")).toBe(false);
  });
});
