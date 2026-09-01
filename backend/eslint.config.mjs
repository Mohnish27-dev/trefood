import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: "trefood/engineering-rules",
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      /* docs/MASTER_PROMPT_PRD.md Part 2: no `any`, no non-null `!` on external data. */
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSNonNullExpression",
          message:
            "Non-null assertion (`!`) is banned. Narrow with an explicit check, or parse with a Zod schema at the boundary. See docs/PHASES.md Phase 0.",
        },
      ],
      /* All money is integer paise. `toFixed` is how a float enters the chain.
         docs/MONEY_AND_SETTLEMENT.md §1. Formatting lives in @trefood/shared. */
      "no-restricted-properties": [
        "error",
        {
          property: "toFixed",
          message:
            "All money is integer paise. Format through @trefood/shared, never with toFixed. See docs/MONEY_AND_SETTLEMENT.md §1.",
        },
      ],
    },
  },
);
