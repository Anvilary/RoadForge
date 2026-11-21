import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordDemoRaw } from './record-demo-raw.mjs'
import { assembleDemo } from './assemble-demo.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

async function main() {
  console.log('=== RoadForge Professional 60-Second Demonstration Production ===')
  console.log('Project root:', projectRoot)
  console.log('Starting Step 1: Recording authentic browser interactions...')
  const { rawVideoPath, sceneManifest } = await recordDemoRaw()

  console.log('\nStarting Step 2: Postproduction assembly and encoding...')
  const results = await assembleDemo(rawVideoPath)

  console.log('\n=== PRODUCTION COMPLETE ===')
  console.log('Master MP4:', results.mp4.path, `(${results.mp4.duration.toFixed(1)}s, ${results.mp4.sizeMb} MB)`)
  console.log('Thumbnail:', results.thumbnail.path)
  console.log('Preview GIF:', results.gif.path, `(${results.gif.sizeMb} MB)`)
}

main().catch((err) => {
  console.error('\nProduction failed:', err)
  process.exit(1)
})
