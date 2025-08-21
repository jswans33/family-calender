/* eslint-env jest */
// Jest setup file for server-side tests
// Add any global test setup here

// Suppress console.log during tests unless debugging
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  if (!process.env.DEBUG_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  if (!process.env.DEBUG_TESTS) {
    console.log = originalLog;
    console.error = originalError;
  }
});
