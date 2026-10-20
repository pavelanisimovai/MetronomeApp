// Compatibility entry point for the current product regression suite.
process.env.SMOKE_FILTER = 'first-run action'
await import('./product-smoke.mjs')
