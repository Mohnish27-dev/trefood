import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "trefood/engineering-rules",
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      /* docs/MASTER_PROMPT_PRD.md Part 2: "strict: true, no `any`, no non-null `!`
         on external data". `any` is an error, not a warning — a warning is a rule
         nobody obeys. */
      "@typescript-eslint/no-explicit-any": "error",

      /* The non-null assertion is banned outright rather than only on I/O
         boundaries, because there is no lint rule that can tell which values came
         from Mongo, Razorpay, or a request body. Narrow with a check, or use a Zod
         schema at the boundary. */
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSNonNullExpression",
          message:
            "Non-null assertion (`!`) is banned. Narrow the value with an explicit check, or parse it with a Zod schema at the boundary. See docs/PHASES.md Phase 0.",
        },
      ],

      /* Unused vars are an error so a half-finished refactor cannot ship. */
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    /* Money arithmetic is integer paise only. `toFixed` produces a string from a
       float and is the single most likely way a rounding bug enters the chain.
       docs/MONEY_AND_SETTLEMENT.md §1. `src/lib/money.ts` is exempt because it owns
       the one legitimate rupee-formatting call site. */
    name: "trefood/no-floats-in-money-paths",
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/money.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          property: "toFixed",
          message:
            "All money is integer paise. Format through src/lib/money.ts, never with toFixed. See docs/MONEY_AND_SETTLEMENT.md §1.",
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // shadcn primitives are vendored unmodified. docs/PROJECT_STRUCTURE.md §2.
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
