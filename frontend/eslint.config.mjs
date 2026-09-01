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
         schema at the boundary. It is configured together with the copy rule below,
         because ESLint allows only one `no-restricted-syntax` entry to win. */

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

  {
    /**
     * The copy rule.
     *
     * D4 removed live rider tracking from the product permanently: riders carry no
     * device, so nothing can emit a position, and a screen promising to track one is
     * a screen that can never be built truthfully. The UI says "Live Order Status".
     *
     * This bans the PHRASES that make the promise, not the bare word "track" — a
     * component may legitimately be called `OrderTracker`, and `use-poll` legitimately
     * tracks state. It is the sentence shown to a student that must not lie.
     */
    name: "trefood/no-tracking-promises",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSNonNullExpression",
          message:
            "Non-null assertion (`!`) is banned. Narrow the value with an explicit check, or parse it with a Zod schema at the boundary. See docs/PHASES.md Phase 0.",
        },
        {
          selector: "JSXText[value=/[Ll]ive\\s+[Tt]rack|[Tt]rack(ing)?\\s+(your|the|my|Your|The|My)\\s+[Rr]ider|[Rr]ider\\s+(location|position|Location|Position)|[Tt]rack\\s+[Rr]ider|[Ww]here\\s+is\\s+(my|the)\\s+[Rr]ider/]",
          message:
            'Never promise tracking. Riders carry no device, so nothing can emit a position (docs/DECISIONS.md §2). Say \"Live Order Status\".',
        },
        {
          selector: "Literal[value=/[Ll]ive\\s+[Tt]rack|[Tt]rack(ing)?\\s+(your|the|my|Your|The|My)\\s+[Rr]ider|[Rr]ider\\s+(location|position|Location|Position)|[Tt]rack\\s+[Rr]ider|[Ww]here\\s+is\\s+(my|the)\\s+[Rr]ider/]",
          message:
            'Never promise tracking. Riders carry no device, so nothing can emit a position (docs/DECISIONS.md §2). Say \"Live Order Status\".',
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
