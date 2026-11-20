import js from "@eslint/js";
import globals from "globals";

export default [
  // ESLint's recommended rules: undefined names, unused variables, unreachable code
  js.configs.recommended,
  {
    files: ["static/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      // Plain <script> files, not modules: top-level names are shared globals.
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules: {
      // Top-level functions are used by other files, which ESLint can't see,
      // so only report unused variables inside functions.
      "no-unused-vars": ["error", { vars: "local" }],
    },
  },
  {
    // Names defined in api.js (or loaded from a CDN) that other files use.
    // api.js itself is left out, since it defines them.
    files: ["static/**/*.js"],
    ignores: ["static/api.js"],
    languageOptions: {
      globals: {
        api: "readonly",
        getToken: "readonly",
        saveToken: "readonly",
        clearToken: "readonly",
        localToday: "readonly",
        Chart: "readonly",
      },
    },
  },
];
