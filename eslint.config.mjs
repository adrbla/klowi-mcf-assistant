import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // localStorage hydration on mount is a legitimate, one-shot pattern.
      // The new React 19 rule is overly aggressive for client-only hydration code.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
