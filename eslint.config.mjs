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
    ".agent/**",
    // Claude Code skill reference/boilerplate assets (untracked, not part of
    // the PaySwift application) — e.g. WhatsApp/Telegram/PPTX/D3.js templates.
    ".agents/**",
    // design-sync (claude.ai/design) artifacts: the staged converter scripts,
    // the generated bundle output, and the compiled Tailwind CSS. Not part of
    // the PaySwift application — gitignored and machine-generated.
    ".ds-sync/**",
    "ds-bundle/**",
    ".design-sync/**",
  ]),
]);

export default eslintConfig;
