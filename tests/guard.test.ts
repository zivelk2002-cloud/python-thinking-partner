import { describe, expect, it } from "vitest";
import { checkReply, copiesStudentCode, extractCodeBlocks, hasIndentedCode, isWriteRequest } from "@/lib/guard";

const rule = (r: ReturnType<typeof checkReply>) => (r.ok ? "ok" : r.rule);

describe("helpers", () => {
  it("extracts fenced blocks, including unterminated ones", () => {
    expect(extractCodeBlocks("a\n```python\nx = 1\n```\nb")).toEqual(["x = 1"]);
    expect(extractCodeBlocks("```\nprint(1)\n```\n```py\nprint(2)\n```")).toHaveLength(2);
    expect(extractCodeBlocks("text\n```python\ndef f():\n  pass")).toHaveLength(1);
    expect(extractCodeBlocks("no code here")).toHaveLength(0);
  });

  it("detects indented code but not indented lists", () => {
    expect(hasIndentedCode("Here:\n    total = 0\n    for x in xs:\n")).toBe(true);
    expect(hasIndentedCode("- step one\n    - nested bullet\n    - another")).toBe(false);
    expect(hasIndentedCode("Only one line:\n    total = 0\nthen prose")).toBe(false);
  });

  it("detects write-function requests in EN and HE", () => {
    expect(isWriteRequest("Write me a function that returns the sum of even numbers")).toBe(true);
    expect(isWriteRequest("How do I write a program that counts vowels?")).toBe(true);
    expect(isWriteRequest("תכתוב לי פונקציה שסופרת תנועות")).toBe(true);
    expect(isWriteRequest("צור תוכנית שמחשבת ממוצע")).toBe(true);
    expect(isWriteRequest("What does split() return?")).toBe(false);
    expect(isWriteRequest("מה ההבדל בין for ל-while?")).toBe(false);
  });

  it("detects copied student code, ignoring whitespace and trivial lines", () => {
    const code = "def count_rows(grid):\n    total = 0\n    for row in grid:\n        total += len(row)\n    return total";
    expect(copiesStudentCode("Example:\nfor  row in   grid :", code)).toBe(true);
    expect(copiesStudentCode("```python\ntotal+=len(row)\n```", code)).toBe(true);
    // "return total" is under the length threshold and too generic to count.
    expect(copiesStudentCode("return total", code)).toBe(false);
    expect(copiesStudentCode("for fruit in fruits:\n    print(fruit)", code)).toBe(false);
  });
});

describe("mode 1: breakdown", () => {
  it("allows one guiding question", () => {
    expect(rule(checkReply("breakdown", "In your own words, what does the function need to do?"))).toBe("ok");
    expect(
      rule(checkReply("breakdown", "So you'd go through the list one item at a time. How would you know when to stop?", {
        studentText: "I'd go through the list one item at a time",
      })),
    ).toBe("ok");
    expect(rule(checkReply("breakdown", "מה הפונקציה מקבלת, ומאיזה טיפוס?"))).toBe("ok");
  });

  it("rejects code blocks and indented code", () => {
    expect(rule(checkReply("breakdown", "Like this:\n```python\nx = 1\n```\nWhat next?"))).toBe("code_block");
    expect(rule(checkReply("breakdown", "Think of:\n    total = 0\n    for n in nums:\nWhat next?"))).toBe("indented_code");
  });

  it("rejects inline code statements", () => {
    expect(rule(checkReply("breakdown", "Have you thought about `total = 0`?"))).toBe("inline_code_statement");
    expect(rule(checkReply("breakdown", "What would `for x in items:` do?"))).toBe("inline_code_statement");
  });

  it("rejects more than one question", () => {
    expect(rule(checkReply("breakdown", "What does it receive? And what does it return?"))).toBe("multiple_questions");
    expect(rule(checkReply("breakdown", "מה היא מקבלת? ומה היא מחזירה?"))).toBe("multiple_questions");
  });

  it("rejects approach suggestions (EN + HE)", () => {
    expect(rule(checkReply("breakdown", "You could use a loop here. What would it go over?"))).toBe("approach_suggestion");
    expect(rule(checkReply("breakdown", "אפשר להשתמש בלולאה. על מה היא תעבור?"))).toBe("approach_suggestion");
  });

  it("rejects techniques the student never mentioned", () => {
    expect(rule(checkReply("breakdown", "Would a dictionary help you keep track of counts?", { studentText: "I need to count words" }))).toBe(
      "approach_suggestion",
    );
    expect(rule(checkReply("breakdown", "האם מיון של הרשימה יעזור?", { studentText: "אני צריך למצוא את הגדול" }))).toBe(
      "approach_suggestion",
    );
    // ...but allows reflecting a technique the student did mention.
    expect(rule(checkReply("breakdown", "You mentioned a dictionary. What would its keys be?", { studentText: "maybe a dict of counts" }))).toBe(
      "ok",
    );
  });
});

describe("summary", () => {
  it("allows bullets and does not limit question marks", () => {
    expect(rule(checkReply("summary", "My plan\n- read each word\n- keep a count\n- open question: what about empty input?"))).toBe("ok");
  });
  it("rejects code", () => {
    expect(rule(checkReply("summary", "My plan\n```python\ncount = 0\n```"))).toBe("code_block");
  });
});

describe("mode 2: narrator", () => {
  const code = "result = []\nfor i in range(col):\n    result.append(i)\nprint(result)";
  const ctx = { studentCode: code };

  it("allows a neutral narration that quotes the student's code", () => {
    const reply =
      "Line 1 creates an empty list called `result`. The loop on line 2 runs once for each number from 0 up to `col`; if `col` is 4, it runs 4 times. Line 2 is `for i in range(col):`.";
    expect(rule(checkReply("narrator", reply, ctx))).toBe("ok");
  });

  it("rejects code blocks", () => {
    expect(rule(checkReply("narrator", "Line 1:\n```\nresult = []\n```", ctx))).toBe("code_block");
  });

  it("rejects inline statements that are not in the student's code", () => {
    expect(rule(checkReply("narrator", "Line 2 could read `for i in range(col + 1):`.", ctx))).toBe("inline_code_statement");
  });

  it.each([
    "You should start the loop at 1.",
    "Use a while loop instead.",
    "To fix this, change line 3.",
    "Here is the correct version.",
    "Try using append outside the loop.",
    "This is a bug on line 2.",
    "You probably meant range(col + 1).",
  ])("rejects EN fix language: %s", (reply) => {
    expect(rule(checkReply("narrator", reply, ctx))).toBe("fix_language");
  });

  it.each(["צריך לשנות את שורה 2.", "במקום זה השתמש ב-while.", "כדי לתקן את זה...", "כדאי להתחיל מ-1.", "נסה להשתמש ב-append."])(
    "rejects HE fix language: %s",
    (reply) => {
      expect(rule(checkReply("narrator", reply, ctx))).toBe("fix_language");
    },
  );

  it("does not flag student identifiers inside inline code", () => {
    expect(rule(checkReply("narrator", "Line 1 calls `fix_list` with `items`.", { studentCode: "fix_list(items)" }))).toBe("ok");
  });

  it("explains a traceback neutrally", () => {
    const reply =
      "Python stopped on line 4. A `TypeError` means an operation got a value of a type it can't work with; here `+` received an `int` and a `str`.";
    expect(rule(checkReply("narrator", reply, ctx))).toBe("ok");
  });
});

describe("mode 3: syntax", () => {
  const block = (n: number) => "```python\n" + Array.from({ length: n }, (_, i) => `print(${i})`).join("\n") + "\n```";

  it("allows up to two short examples", () => {
    expect(rule(checkReply("syntax", `A dict maps keys to values.\n${block(3)}\nAnd:\n${block(8)}`))).toBe("ok");
  });

  it("rejects more than two blocks", () => {
    expect(rule(checkReply("syntax", `${block(2)}\n${block(2)}\n${block(2)}`))).toBe("too_many_blocks");
  });

  it("rejects blocks longer than 10 lines", () => {
    expect(rule(checkReply("syntax", block(11)))).toBe("block_too_long");
  });

  it("rejects def when the user asked to write a function", () => {
    const reply = "```python\ndef count_vowels(word):\n    return sum(c in 'aeiou' for c in word)\n```";
    expect(rule(checkReply("syntax", reply, { userMessage: "Write a function that counts vowels" }))).toBe("task_function");
    expect(rule(checkReply("syntax", reply, { userMessage: "תכתוב לי פונקציה שסופרת תנועות" }))).toBe("task_function");
  });

  it("allows def for a concept question", () => {
    const reply = "```python\ndef greet(pet):\n    print('Hi', pet)\n```";
    expect(rule(checkReply("syntax", reply, { userMessage: "What is the syntax for defining a function?" }))).toBe("ok");
  });

  it("allows toy examples without def for a task-shaped question", () => {
    const reply = "Loops over strings:\n```python\nfor letter in 'apple':\n    print(letter)\n```";
    expect(rule(checkReply("syntax", reply, { userMessage: "How do I write a function that counts vowels?" }))).toBe("ok");
  });
});

describe("recap", () => {
  const studentCode = "def count_rows(grid):\n    total = 0\n    for row in grid:\n        total += len(row)\n    return total";

  it("allows a concept recap with toy examples", () => {
    const reply = "# What I learned today\n## Nested loops\nA loop inside a loop.\n```python\nfor pet in pets:\n    for toy in toys:\n        print(pet, toy)\n```";
    expect(rule(checkReply("recap", reply, { studentCode }))).toBe("ok");
  });

  it("rejects lines copied from the student's code", () => {
    const reply = "# What I learned today\n## Loops\n```python\nfor row in grid:\n    total += len(row)\n```";
    expect(rule(checkReply("recap", reply, { studentCode }))).toBe("copied_student_code");
  });

  it("rejects too many or too long blocks", () => {
    const b = "```python\nprint('apple')\n```\n";
    expect(rule(checkReply("recap", b.repeat(7)))).toBe("too_many_blocks");
    expect(rule(checkReply("recap", "```python\n" + "print(1)\n".repeat(11) + "```"))).toBe("block_too_long");
  });
});
