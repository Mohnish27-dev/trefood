import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "trefood/engineering-rules",
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      // PRD Part 4.1 — TypeScript strict, no `any`, no non-null assertions
      // on external data. A `!` on a Mongo result is how a 3 AM crash starts.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      "no-restricted-syntax": [
        "error",
        {
          // MONEY_AND_SETTLEMENT.md section 1 — all money is integer paise.
          // If toFixed appears anywhere in a money path, that is a bug.
          // PROJECT_STRUCTURE.md section 3.
          selector: "CallExpression[callee.property.name='toFixed']",
          message:
            "No toFixed. Money is integer paise end to end — format with formatINR() from @/lib/money, and render only through <Money />.",
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='round']",
          message:
            "Math.round drifts on money. Use ceilToRupee() / paise helpers from @/lib/money so commission + vendorReceivable never diverges from commissionBase.",
        },
      ],

      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    // Scripts and tests legitimately log and do arithmetic on fixtures.
    name: "trefood/scripts-and-tests",
    files: ["scripts/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
    rules: {
      "no-console": "off",
      "no-restricted-syntax": "off",
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);

export default eslintConfig;
