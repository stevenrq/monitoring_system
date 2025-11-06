import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: {
          warnOnly: false,
        },
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/controllers/**/*.ts",
    "src/services/**/*.ts",
    "src/routes/**/*.ts",
    "src/models/**/*.ts",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
  clearMocks: true,
};

export default config;
