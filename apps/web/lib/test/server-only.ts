// What `import 'server-only'` resolves to under vitest. The real package
// throws outside a React server environment, which would keep every
// server module out of the unit tests; here it is nothing, and the tests
// stay responsible for never running such a module in a browser.
export {};
