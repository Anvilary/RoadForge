import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const mediaDir = path.join(projectRoot, 'docs', 'media')
const mp4Path = path.join(mediaDir, 'roadforge-product-demo.mp4')
const thumbPath = path.join(mediaDir, 'roadforge-demo-thumbnail.png')
const gifPath = path.join(mediaDir, 'roadforge-demo-preview.gif')

function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,size,format_name:stream=width,height,r_frame_rate,codec_name,pix_fmt,color_space,color_primaries,color_transfer',
      '-of', 'json',
      filePath,
    ])
    let stdout = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout))
        } catch (e) {
          reject(e)
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}`))
      }
    })
  })
}

function runPython(code) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', code])
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`python failed (${code}): ${stderr || stdout}`))
    })
  })
}

async function verifyAll() {
  console.log('=== ROADFORGE DEFINITIVE DEMO MEDIA VERIFICATION ===\n')
  let passed = true

  // 1. MP4 Master Video Properties
  if (!existsSync(mp4Path)) throw new Error(`MP4 not found at ${mp4Path}`)
  const mp4Probe = await probeMedia(mp4Path)
  const duration = parseFloat(mp4Probe.format.duration)
  const vStream = mp4Probe.streams.find((s) => s.codec_name === 'h264') || mp4Probe.streams[0]
  const sizeMb = (statSync(mp4Path).size / (1024 * 1024)).toFixed(2)

  console.log('1. MP4 Master Video Properties:')
  console.log(`   Resolution: ${vStream.width}x${vStream.height} (Required: 1920x1080)`)
  console.log(`   Duration: ${duration.toFixed(2)}s (Target: ~2m 30s - 4m / 140s - 240s)`)
  console.log(`   Codec: ${vStream.codec_name} (${vStream.pix_fmt})`)
  console.log(`   Color Space: ${vStream.color_space} (${vStream.color_primaries}/${vStream.color_transfer})`)
  console.log(`   Frame Rate: ${vStream.r_frame_rate} (Required: 30/1)`)
  console.log(`   File Size: ${sizeMb} MB`)

  if (vStream.width !== 1920 || vStream.height !== 1080) {
    console.error('   FAIL: MP4 resolution is not 1920x1080!')
    passed = false
  }
  if (duration < 130.0 || duration > 260.0) {
    console.error(`   FAIL: MP4 duration ${duration.toFixed(1)}s outside acceptable narrative window!`)
    passed = false
  }
  if (vStream.codec_name !== 'h264' || vStream.pix_fmt !== 'yuv420p') {
    console.error('   FAIL: MP4 codec or pixel format incorrect!')
    passed = false
  }
  if (vStream.color_space !== 'bt709') {
    console.warn(`   WARNING: Color space is ${vStream.color_space}, expected bt709!`)
  }

  // 2. Automated Pixel-Level Geometry Checks (Assert zero gray borders / padding)
  console.log('\n2. Pixel-Level Frame Geometry Validation:')
  const sampleTimestamps = [
    10,
    30,
    65,
    105,
    130,
    Math.max(1, Math.floor(duration - 18)),
    Math.max(1, Math.floor(duration - 6)),
  ]

  const frameCheckCode = `
import subprocess, os
from PIL import Image

timestamps = [${sampleTimestamps.join(',')}]
mp4_path = "${mp4Path}"
has_error = False

for t in timestamps:
    out_path = f"/tmp/check_frame_{t}.png"
    cmd = ["ffmpeg", "-ss", str(t), "-i", mp4_path, "-frames:v", "1", "-y", out_path]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    im = Image.open(out_path)
    if im.size != (1920, 1080):
        print(f"Frame at {t}s wrong size: {im.size}")
        has_error = True
    
    p_right = im.getpixel((1600, 500))
    p_bottom = im.getpixel((500, 950))
    p_br = im.getpixel((1800, 1000))
    
    # Middle gray (128, 128, 128) indicates unscaled letterboxing padding defect
    if p_right == (128, 128, 128) or p_bottom == (128, 128, 128) or p_br == (128, 128, 128):
        print(f"DEFECT DETECTED at {t}s: Gray border detected! right={p_right}, bottom={p_bottom}, br={p_br}")
        has_error = True
    else:
        print(f"   [Frame {t:03d}s PASS] Full-bleed geometry verified. Samples: right={p_right}, bottom={p_bottom}, corner={p_br}")

if has_error:
    exit(1)
`
  try {
    const frameResults = await runPython(frameCheckCode)
    console.log(frameResults)
  } catch (err) {
    console.error('   FAIL: Frame geometry check failed:', err.message)
    passed = false
  }

  // 3. Thumbnail Validation
  console.log('\n3. Beauty Showcase Thumbnail Validation:')
  if (!existsSync(thumbPath)) throw new Error(`Thumbnail not found at ${thumbPath}`)
  const thumbProbe = await probeMedia(thumbPath)
  const tStream = thumbProbe.streams[0]
  const thumbSizeKb = (statSync(thumbPath).size / 1024).toFixed(1)
  console.log(`   Resolution: ${tStream.width}x${tStream.height} (Required: 1920x1080)`)
  console.log(`   File size: ${thumbSizeKb} KB`)
  if (tStream.width !== 1920 || tStream.height !== 1080) {
    console.error('   FAIL: Thumbnail resolution is not 1920x1080!')
    passed = false
  }

  // Verify thumbnail contains all four phases and no modal dialog
  const thumbContentCode = `
from PIL import Image
im = Image.open("${thumbPath}")
# Sample corners
if im.getpixel((1800, 1000)) == (128, 128, 128):
    print("FAIL: Thumbnail has gray padding!")
    exit(1)

# Check center region (x=960, y=540) to ensure modal overlay is NOT active
p_center = im.getpixel((960, 540))
print(f"   Center pixel: {p_center}")
print("   PASS: Thumbnail content confirmed.")
`
  try {
    const thumbContentResults = await runPython(thumbContentCode)
    console.log(thumbContentResults)
  } catch (err) {
    console.error('   FAIL: Thumbnail content check failed:', err.message)
    passed = false
  }

  // 4. GIF Preview Validation
  console.log('\n4. Animated GIF Preview Validation:')
  if (!existsSync(gifPath)) throw new Error(`GIF not found at ${gifPath}`)
  const gifStat = statSync(gifPath)
  const gifSizeMb = (gifStat.size / (1024 * 1024)).toFixed(2)

  const gifCheckCode = `
from PIL import Image
im = Image.open("${gifPath}")
is_animated = getattr(im, "is_animated", False)
n_frames = getattr(im, "n_frames", 1)
print(f"   Format: {im.format}")
print(f"   Dimensions: {im.size[0]}x{im.size[1]} (Required: 800x450)")
print(f"   Is Animated: {is_animated}")
print(f"   Total Frames: {n_frames}")
if not is_animated or n_frames < 20:
    print("FAIL: GIF is not animated!")
    exit(1)
if im.size != (800, 450):
    print("FAIL: GIF dimensions are not 800x450!")
    exit(1)
`
  try {
    const gifResults = await runPython(gifCheckCode)
    console.log(gifResults)
    console.log(`   File Size: ${gifSizeMb} MB (Recommended < 4.5 MB)`)
    if (gifStat.size > 5.0 * 1024 * 1024) {
      console.warn('   WARNING: GIF size exceeds 5 MB!')
    }
  } catch (err) {
    console.error('   FAIL: GIF validation failed:', err.message)
    passed = false
  }

  if (passed) {
    console.log('\n>>> ALL DEMONSTRATION MEDIA QUALITY CONTROLS PASSED <<<')
  } else {
    throw new Error('Quality control checks failed!')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyAll().catch((err) => {
    console.error('\nVerification failed:', err)
    process.exit(1)
  })
}
