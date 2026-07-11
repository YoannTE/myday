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
    // Bundles generes par `npm run db:bundle-migrate` (pas du code source)
    "dist/**",
    // Ressources dev-time Claude Code (prompts, skills, exemples) - hors
    // perimetre applicatif, cf. .claude/CLAUDE.md
    ".claude/**",
  ]),
]);

export default eslintConfig;
