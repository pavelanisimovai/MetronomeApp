// Compatibility entry point for the current product regression suite.
process.env.SMOKE_FILTER = 'accurate independent'
await import('./product-smoke.mjs')
