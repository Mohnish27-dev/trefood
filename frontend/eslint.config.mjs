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
       docs/MONEY_AND_SETTLEMENT.md §1. The frontend never computes money at all —
       it renders what the API returns — so there is no exemption here. */
    name: "trefood/no-floats-in-money-paths",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          property: "toFixed",
          message:
            "All money is integer paise, computed by the backend. Format through @trefood/shared, never with toFixed. See docs/MONEY_AND_SETTLEMENT.md §1.",
        },
      ],
    },
  },

  {
    /* The frontend holds no business rules and owns no database. If one of these
       ever appears here, the split has been undone by accident. */
    name: "trefood/frontend-owns-no-backend",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "mongodb",
              message:
                "The frontend never touches the database. Add a route to backend/src/routes and call it through src/api-client.",
            },
            {
              name: "razorpay",
              message:
                "Razorpay is server-side only and lives in the backend service. See docs/PHASES.md Phase 9.",
            },
          ],
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
