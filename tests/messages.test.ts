import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

type Json = string | Json[] | { [k: string]: Json };

function shape(obj: Json, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`];
  return Object.entries(obj).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
}

describe("message files", () => {
  it("he.json and en.json have the same keys (and array lengths)", () => {
    expect(shape(he as Json).sort()).toEqual(shape(en as Json).sort());
  });

  it("have no empty strings", () => {
    const values = (o: Json): string[] =>
      typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(values) : Object.values(o).flatMap(values);
    for (const file of [en, he]) expect(values(file as Json).filter((v) => !v.trim())).toEqual([]);
  });
});
