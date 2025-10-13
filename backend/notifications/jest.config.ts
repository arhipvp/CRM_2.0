import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  coverageDirectory: 'coverage'
};

export default config;
