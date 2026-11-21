import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const mediaDir = path.join(projectRoot, 'docs', 'media')
const tempVideoDir = path.join(mediaDir, '.tmp-demo-raw')

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`[cmd] ${cmd} ${args.join(' ')}`)
    const proc = spawn(cmd, args, { stdio: 'inherit' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
  })
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,size:stream=width,height,r_frame_rate,codec_name,pix_fmt',
      '-of', 'json',
      filePath,
    ])
    let stdout = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdout)
          resolve(data)
        } catch (e) {
          reject(e)
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}`))
      }
    })
  })
}

export async function assembleDemo(rawVideoPath, manifestPath) {
  const manifestFile = manifestPath || path.join(tempVideoDir, 'scene-manifest.json')
  let manifest = null
  if (existsSync(manifestFile)) {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  }

  const rawPath = rawVideoPath || manifest?.rawVideoPath
  if (!rawPath || !existsSync(rawPath)) {
    throw new Error(`Raw video not found at ${rawPath}`)
  }

  const rawProbe = await probeVideo(rawPath)
  const rawDuration = parseFloat(rawProbe.format.duration)
  const rawStream = rawProbe.streams[0]
  console.log(`Raw video duration: ${rawDuration.toFixed(2)}s (${rawStream.width}x${rawStream.height})`)

  const targetMp4Path = path.join(mediaDir, 'roadforge-product-demo.mp4')
  const targetThumbnailPath = path.join(mediaDir, 'roadforge-demo-thumbnail.png')
  const targetGifPath = path.join(mediaDir, 'roadforge-demo-preview.gif')

  // Target duration: 85s - 95s (target 90s)
  let durationArg = []
  if (rawDuration > 93.5) {
    const maxDur = 90.5
    console.log(`Raw duration ${rawDuration.toFixed(1)}s exceeds 93.5s; trimming to ${maxDur}s with clean end`)
    durationArg = ['-t', String(maxDur)]
  }

  console.log('--- Step 1: Transcoding to Master MP4 (1920x1080 30FPS H.264 Lanczos) ---')
  await runCommand('ffmpeg', [
    '-y',
    '-i', rawPath,
    ...durationArg,
    '-vf', 'scale=1920:1080:flags=lanczos',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-preset', 'slow',
    '-crf', '18',
    '-movflags', '+faststart',
    targetMp4Path,
  ])

  // Probe master MP4
  const finalProbe = await probeVideo(targetMp4Path)
  const finalDuration = parseFloat(finalProbe.format.duration)
  const videoStream = finalProbe.streams.find((s) => s.codec_name === 'h264') || finalProbe.streams[0]
  const finalSizeMb = (statSync(targetMp4Path).size / (1024 * 1024)).toFixed(2)

  console.log('\n=== MASTER MP4 VALIDATION ===')
  console.log(`  Path: ${targetMp4Path}`)
  console.log(`  Resolution: ${videoStream.width}x${videoStream.height}`)
  console.log(`  Codec: ${videoStream.codec_name} (${videoStream.pix_fmt})`)
  console.log(`  Frame rate: ${videoStream.r_frame_rate} (target 30/1)`)
  console.log(`  Duration: ${finalDuration.toFixed(2)}s (target 85s - 95s)`)
  console.log(`  File size: ${finalSizeMb} MB`)

  if (finalDuration < 85.0 || finalDuration > 95.0) {
    throw new Error(`Master MP4 duration ${finalDuration.toFixed(1)}s outside acceptable 85-95s window!`)
  }
  if (videoStream.width !== 1920 || videoStream.height !== 1080) {
    throw new Error(`Master MP4 resolution ${videoStream.width}x${videoStream.height} is not 1920x1080!`)
  }

  // --- Step 2: Extract Thumbnail (1920x1080) ---
  console.log('\n--- Step 2: Extracting Beauty Showcase Thumbnail ---')
  // Use beauty hold frame or 3.5s before end
  let thumbTime = Math.max(1, Math.floor(finalDuration - 3.5))
  if (manifest?.scenes?.beauty_hold) {
    thumbTime = Math.min(manifest.scenes.beauty_hold + 3.0, finalDuration - 1.5)
  }

  await runCommand('ffmpeg', [
    '-y',
    '-ss', String(thumbTime),
    '-i', targetMp4Path,
    '-frames:v', '1',
    '-update', '1',
    '-q:v', '2',
    targetThumbnailPath,
  ])
  const thumbProbe = await probeVideo(targetThumbnailPath)
  console.log(`  Thumbnail resolution: ${thumbProbe.streams[0].width}x${thumbProbe.streams[0].height}`)
  console.log(`  Thumbnail size: ${(statSync(targetThumbnailPath).size / 1024).toFixed(1)} KB`)
  if (thumbProbe.streams[0].width !== 1920 || thumbProbe.streams[0].height !== 1080) {
    throw new Error(`Thumbnail resolution is not 1920x1080!`)
  }

  // --- Step 3: High-Quality Looping Preview GIF (800x450, 10s) ---
  console.log('\n--- Step 3: Generating Optimized Preview GIF ---')
  // Choose the exciting unblocking highlight (dependency resolution and progress leap)
  let gifStart = Math.max(10, Math.floor(finalDuration * 0.70))
  if (manifest?.scenes?.act4_unblock_start) {
    gifStart = manifest.scenes.act4_unblock_start - 1.0
  }
  const gifDuration = 10.0

  console.log(`Extracting GIF highlight at ${gifStart.toFixed(1)}s (duration ${gifDuration}s)...`)
  await runCommand('ffmpeg', [
    '-y',
    '-ss', String(gifStart),
    '-t', String(gifDuration),
    '-i', targetMp4Path,
    '-vf', 'fps=12,scale=800:450:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
    targetGifPath,
  ])

  let gifStat = statSync(targetGifPath)
  console.log(`  Initial GIF size: ${(gifStat.size / (1024 * 1024)).toFixed(2)} MB`)

  // If over 4.5MB, optimize palette and frame rate for optimal GitHub delivery
  if (gifStat.size > 4.5 * 1024 * 1024) {
    console.log('Optimizing GIF palette and frame rate for optimal web delivery...')
    await runCommand('ffmpeg', [
      '-y',
      '-ss', String(gifStart),
      '-t', String(gifDuration),
      '-i', targetMp4Path,
      '-vf', 'fps=10,scale=800:450:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
      targetGifPath,
    ])
    gifStat = statSync(targetGifPath)
    console.log(`  Optimized GIF size: ${(gifStat.size / (1024 * 1024)).toFixed(2)} MB`)
  }

  // Clean up temp directory
  if (existsSync(tempVideoDir)) {
    rmSync(tempVideoDir, { recursive: true, force: true })
  }

  console.log('\nAll demonstration media assets successfully produced and validated!')
  return {
    mp4: { path: targetMp4Path, duration: finalDuration, sizeMb: finalSizeMb },
    thumbnail: { path: targetThumbnailPath },
    gif: { path: targetGifPath, sizeMb: (gifStat.size / (1024 * 1024)).toFixed(2) },
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assembleDemo().catch((err) => {
    console.error('Assembly failed:', err)
    process.exit(1)
  })
}
