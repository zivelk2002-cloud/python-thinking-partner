import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";

describe("rate limiter", () => {
  it("allows up to max requests per window, per key", () => {
    const rl = createRateLimiter(3, 1000);
    expect([rl.hit("a", 0), rl.hit("a", 1), rl.hit("a", 2)]).toEqual([true, true, true]);
    expect(rl.hit("a", 3)).toBe(false);
    expect(rl.hit("b", 3)).toBe(true);
  });

  it("frees slots as the window slides", () => {
    const rl = createRateLimiter(2, 1000);
    rl.hit("a", 0);
    rl.hit("a", 500);
    expect(rl.hit("a", 900)).toBe(false);
    expect(rl.retryAfter("a", 900)).toBe(1);
    expect(rl.hit("a", 1001)).toBe(true);
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
