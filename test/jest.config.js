module.exports = {
  preset: 'ts-jest',
  rootDir: '../',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/src/**/rpc.test.(js|jsx|ts|tsx)',
  ],
};
