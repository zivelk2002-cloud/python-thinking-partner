import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // INTEGRITY: prompts, guard word lists and provider code are server-only.
    // Importing them from client code would ship them to every browser.
    files: ["components/**/*.{ts,tsx}", "lib/clientApi.ts", "lib/looksLikeCode.ts", "lib/modes.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/prompts", "@/lib/prompts/*", "@/lib/guard", "@/lib/guard-words", "@/lib/llm/*", "@/lib/pipeline", "@/lib/rateLimit"],
              message: "Server-only module: never import it from client code (it would ship prompts/guard lists to the browser). Use @/lib/modes for mode names.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
