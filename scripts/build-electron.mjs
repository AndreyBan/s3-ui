import { build, context } from 'esbuild'
import { rmSync } from 'node:fs'

const watch = process.argv.includes('--watch')
const outdir = 'dist-electron'

rmSync(outdir, { recursive: true, force: true })

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: watch,
  minify: !watch,
  // Electron предоставляется рантаймом; всё остальное (в т.ч. AWS SDK) инлайним в бандл.
  external: ['electron'],
  logLevel: 'info',
}

const entries = [
  { entryPoints: ['electron/main.ts'], outfile: `${outdir}/main.js` },
  { entryPoints: ['electron/preload.ts'], outfile: `${outdir}/preload.js` },
]

if (watch) {
  for (const e of entries) {
    const ctx = await context({ ...common, ...e })
    await ctx.watch()
  }
  console.log('[build-electron] watching…')
} else {
  await Promise.all(entries.map((e) => build({ ...common, ...e })))
  console.log('[build-electron] done')
}
