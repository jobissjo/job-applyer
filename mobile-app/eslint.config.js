const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/**", "dist-native/**", ".expo/**"] },
  {
    files: ["tests/*.cjs"],
    languageOptions: { globals: { __dirname: "readonly" } },
  },
]);
