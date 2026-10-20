// Compatibility entry point for the current product regression suite.
process.env.SMOKE_FILTER = 'extra tapping'
await import('./product-smoke.mjs')
