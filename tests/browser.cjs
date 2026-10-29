// Browser integration and repeatable rendering smoke test. Requires a running dev server.
// CHROME_PATH and SPECTRUM_URL may be overridden for other machines.
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  { spawn } = require('node:child_process')
const url = process.env.SPECTRUM_URL || 'http://127.0.0.1:5173'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spectrum-test-'))
const chrome = spawn(
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--remote-debugging-pipe',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] },
)
let seq = 0,
  buf = '',
  pending = new Map(),
  logs = [],
  errors = []
chrome.on('error', (e) => {
  console.error(e)
  process.exitCode = 1
})
chrome.stderr.on('data', (chunk) => {
  logs.push(String(chunk))
  if (logs.length > 30) logs.shift()
})
chrome.stdio[4].on('data', (chunk) => {
  buf += chunk
  let i
  while ((i = buf.indexOf('\0')) >= 0) {
    const s = buf.slice(0, i)
    buf = buf.slice(i + 1)
    if (!s) continue
    const m = JSON.parse(s)
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails)
    if (pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  }
})
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout: ${method}`))
    }, 20000)
    pending.set(id, (m) => {
      clearTimeout(timer)
      m.error ? reject(m.error) : resolve(m.result)
    })
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0')
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
let debugEval
;(async () => {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
  const { sessionId: s } = await call('Target.attachToTarget', { targetId, flatten: true })
  const ev = async (expression) => {
    const r = await call(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true, userGesture: true },
      s,
    )
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  debugEval = ev
  await call('Runtime.enable', {}, s)
  await call('Page.enable', {}, s)
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false },
    s,
  )
  await call('Page.navigate', { url }, s)
  for (let i = 0; i < 100; i++) {
    await sleep(100)
    if (await ev("!!document.querySelector('.demo-button')")) break
  }
  assert.ok(await ev("!!document.querySelector('.demo-button')"), 'App mounted')
  for (let i = 0; i < 900; i++) {
    const state = await ev('window.__spectrumMetrics()')
    assert.deepEqual(state.failedScenes, [], 'Every scene compiles')
    if (!state.loading.active) break
    await sleep(200)
  }
  const loaded = await ev('window.__spectrumMetrics()')
  assert.equal(loaded.readyScenes, await ev("document.querySelectorAll('.scene-card').length"))
  console.log(`PASS: ${loaded.readyScenes} scene programs preloaded`)
  assert.equal(
    await ev("document.querySelector('.graphics-error')?.textContent || ''"),
    '',
    'Shaders compile',
  )
  await ev("document.querySelector('.demo-button').click()")
  await sleep(2200)
  let metrics = await ev('window.__spectrumMetrics()')
  assert.equal(metrics.source, 'demo')
  assert.ok(metrics.level > 0.02, JSON.stringify(metrics))
  assert.equal(await ev("document.querySelector('canvas').getContext('webgl').getError()"), 0)
  let shot = await call('Page.captureScreenshot', { format: 'png' }, s)
  fs.writeFileSync('/tmp/spectrum-desktop.png', Buffer.from(shot.data, 'base64'))
  results.push({ check: 'demo + real Web Audio analysis', metrics })
  console.log('PASS: shaders compiled and demo audio analysed')
  // Shortcuts must still work after a scene button receives keyboard focus.
  await ev("document.querySelectorAll('.scene-card')[0].focus()")
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: '2', code: 'Digit2' }, s)
  await sleep(100)
  assert.ok(
    await ev("document.querySelectorAll('.scene-card')[1].getAttribute('aria-pressed')==='true'"),
  )
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', code: 'Digit1' }, s)
  await ev("document.querySelector('.help-button').click()")
  await sleep(100)
  assert.ok(await ev("document.activeElement.classList.contains('close-dialog')"))
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }, s)
  await sleep(100)
  assert.equal(await ev("!!document.querySelector('.help-dialog')"), false)
  await ev("document.querySelector('.preview-meta .icon-button').click()")
  await sleep(200)
  assert.ok(await ev('!!document.fullscreenElement'))
  await ev('document.exitFullscreen()')
  console.log('PASS: focused-button shortcuts, help focus and native fullscreen')
  if (process.argv.includes('--ui-only')) return
  if (process.argv.includes('--live-only')) {
    await checkLive()
    assert.equal(errors.length, 0, JSON.stringify(errors))
    return
  }
  async function checkLive() {
    // Live pads must bypass audio onsets and release a held boost on focus loss.
    await ev("document.querySelector('.live-switch input').click()")
    await sleep(400)
    assert.equal((await ev('window.__spectrumMetrics()')).live.impact, 0)
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ' }, s)
    assert.ok((await ev('window.__spectrumMetrics()')).live.impact > 0)
    assert.equal((await ev('window.__spectrumMetrics()')).live.flash, 0)
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ' }, s)
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK' }, s)
    assert.ok((await ev('window.__spectrumMetrics()')).live.flash > 0)
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', code: 'KeyK' }, s)
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'l', code: 'KeyL' }, s)
    assert.ok((await ev('window.__spectrumMetrics()')).live.explosion > 0)
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'l', code: 'KeyL' }, s)
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'u', code: 'KeyU' }, s)
    await sleep(250)
    assert.ok((await ev('window.__spectrumMetrics()')).live.boost > 0.5)
    await ev("window.dispatchEvent(new Event('blur'))")
    assert.equal((await ev('window.__spectrumMetrics()')).live.held, false)
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'u', code: 'KeyU' }, s)
    await ev("document.querySelector('.live-switch input').click()")
    await sleep(100)
    assert.equal((await ev('window.__spectrumMetrics()')).live.mode, false)
    console.log('PASS: live strike, flash, explosion, boost and focus-loss release')
  }
  await ev("document.querySelector('.transport-play').click()")
  await sleep(700)
  assert.equal(
    await ev("document.querySelector('.transport-play').getAttribute('aria-label')"),
    'Lire',
  )
  assert.ok((await ev('window.__spectrumMetrics()')).level < 0.01)
  await ev("document.querySelector('.transport-play').click()")
  await sleep(300)
  const sceneCount = await ev("document.querySelectorAll('.scene-card').length")
  for (let scene = 0; scene < sceneCount; scene++) {
    await ev(`document.querySelectorAll('.scene-card')[${scene}].click()`)
    await sleep(1800)
    assert.equal(
      await ev("document.querySelector('canvas').getContext('webgl').getError()"),
      0,
      `Scene ${scene}`,
    )
    assert.equal(
      await ev("document.querySelector('.graphics-error')?.textContent || ''"),
      '',
      `Scene ${scene} graphics`,
    )
    console.log(`PASS: scene ${scene + 1}/${sceneCount}`)
    results.push({ scene, metrics: await ev('window.__spectrumMetrics()') })
  }
  await ev("document.querySelectorAll('.scene-card')[0].click()")
  await sleep(1800)
  await ev("document.querySelectorAll('.performance-buttons button')[0].click()")
  await sleep(100)
  const frozenTime = (await ev('window.__spectrumMetrics()')).time
  await sleep(250)
  assert.equal((await ev('window.__spectrumMetrics()')).time, frozenTime)
  await ev("document.querySelectorAll('.performance-buttons button')[0].click()")
  // Blackout is immediate, independent of scene transition.
  await ev("document.querySelectorAll('.performance-buttons button')[1].click()")
  await sleep(150)
  assert.deepEqual(
    await ev(
      "(()=>{const gl=document.querySelector('canvas').getContext('webgl');const p=new Uint8Array(4);gl.readPixels(100,100,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p]})()",
    ),
    [0, 0, 0, 255],
  )
  await ev("document.querySelectorAll('.performance-buttons button')[1].click()")
  await checkLive()
  // Preset round trip survives reload, transient blackout does not.
  await ev(
    "(()=>{const i=document.querySelector('.preset-row input');i.value='Browser test';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form.preset-row').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})()",
  )
  await sleep(150)
  assert.ok(await ev("localStorage.getItem('spectrum.presets.v1').includes('Browser test')"))
  // Verify a real locally decoded WAV, seek, pause, resume, and stop.
  const rate = 22050,
    length = rate * 5,
    wav = Buffer.alloc(44 + length * 2)
  wav.write('RIFF')
  wav.writeUInt32LE(36 + length * 2, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(length * 2, 40)
  for (let i = 0; i < length; i++)
    wav.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 110) * 10000), 44 + i * 2)
  const wavePath = '/tmp/spectrum-test.wav'
  fs.writeFileSync(wavePath, wav)
  const doc = await call('DOM.getDocument', {}, s)
  const { nodeId } = await call(
    'DOM.querySelector',
    { nodeId: doc.root.nodeId, selector: 'input[type=file][accept^="audio"]' },
    s,
  )
  await call('DOM.setFileInputFiles', { nodeId, files: [wavePath] }, s)
  await sleep(1100)
  assert.equal((await ev('window.__spectrumMetrics()')).source, 'file')
  assert.ok(await ev("document.querySelector('.seek-row').textContent.includes('0:05')"))
  await ev("document.querySelector('.transport-play').click()")
  await sleep(150)
  assert.equal(
    await ev("document.querySelector('.transport-play').getAttribute('aria-label')"),
    'Lire',
  )
  await ev("document.querySelector('.transport-play').click()")
  await sleep(150)
  assert.equal(
    await ev("document.querySelector('.transport-play').getAttribute('aria-label')"),
    'Pause',
  )
  results.push({ check: 'file playback, pause, resume' })
  // Capture mocks use a fake browser mic; no real microphone permission or recording.
  await ev(
    "window.testStreams=[];const oldGet=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await oldGet(c);testStreams.push(s);return s};document.querySelectorAll('.source-tabs button')[2].click()",
  )
  await sleep(100)
  await ev("document.querySelector('.source-instructions .button').click()")
  for (let i = 0; i < 50; i++) {
    await sleep(100)
    if ((await ev('window.__spectrumMetrics()')).source === 'mic') break
  }
  assert.equal(
    (await ev('window.__spectrumMetrics()')).source,
    'mic',
    await ev(
      "document.querySelector('.error-box')?.textContent || document.querySelector('.track-info').textContent",
    ),
  )
  await ev("document.querySelector('.stop-button').click()")
  await sleep(100)
  assert.ok(await ev("testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))"))
  // Missing tab audio fails clearly and releases its video track.
  await ev(
    "navigator.mediaDevices.getDisplayMedia=async()=>{const stream=document.createElement('canvas').captureStream();window.noAudioStream=stream;return stream};document.querySelectorAll('.source-tabs button')[1].click()",
  )
  await sleep(80)
  await ev("document.querySelector('.source-instructions .button').click()")
  await sleep(300)
  assert.ok(
    await ev("document.querySelector('.error-box').textContent.includes('Aucun son partagé')"),
  )
  assert.ok(await ev("noAudioStream.getTracks().every(t=>t.readyState==='ended')"))
  results.push({ check: 'microphone lifecycle + missing capture audio cleanup' })
  // A permission request can complete after the user has already stopped it.
  await ev(
    "navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.resolveCapture=resolve);document.querySelectorAll('.source-tabs button')[2].click()",
  )
  await sleep(80)
  await ev("document.querySelector('.source-instructions .button').click()")
  await sleep(80)
  await ev(
    "document.querySelector('.stop-button').click();window.lateStream=document.createElement('canvas').captureStream();resolveCapture(lateStream)",
  )
  await sleep(150)
  assert.equal((await ev('window.__spectrumMetrics()')).source, 'idle')
  assert.ok(await ev("lateStream.getTracks().every(t=>t.readyState==='ended')"))
  await ev("document.querySelector('.demo-button').click()")
  await sleep(400)
  await ev("document.querySelector('.output-button').click()")
  await sleep(1000)
  const targets = await call('Target.getTargets')
  const output = targets.targetInfos.find((t) => t.url.includes('?output='))
  assert.ok(output, 'Projection window opened')
  const { sessionId: o } = await call('Target.attachToTarget', {
    targetId: output.targetId,
    flatten: true,
  })
  const remote = await call(
    'Runtime.evaluate',
    {
      expression:
        "({canvas:!!document.querySelector('canvas'),waiting:!!document.querySelector('.projection-wait'),error:document.querySelector('.graphics-error')?.textContent})",
      returnByValue: true,
    },
    o,
  )
  assert.ok(remote.result.value.canvas)
  assert.equal(remote.result.value.waiting, false)
  assert.equal(remote.result.value.error, undefined)
  await call('Target.closeTarget', { targetId: output.targetId })
  results.push({ check: 'separate projection receives live analysis' })
  await ev(
    "window.loss=document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context');loss.loseContext()",
  )
  await sleep(200)
  assert.equal((await ev('window.__spectrumMetrics()')).contextLost, true)
  await ev('loss.restoreContext()')
  await sleep(1000)
  assert.equal((await ev('window.__spectrumMetrics()')).contextLost, false)
  assert.equal(await ev("document.querySelector('.graphics-error')?.textContent || ''"), '')
  results.push({ check: 'freeze, late capture cancellation and WebGL context restoration' })
  console.log('PASS: sources, presets, projection and cleanup')
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
    s,
  )
  await sleep(500)
  assert.ok(
    await ev('document.documentElement.scrollWidth<=window.innerWidth'),
    'Mobile has no horizontal overflow',
  )
  shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, s)
  fs.writeFileSync('/tmp/spectrum-mobile.png', Buffer.from(shot.data, 'base64'))
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
    s,
  )
  // Full-window canvas performance, same synthetic high spectrum as the original baseline.
  await ev(
    "AnalyserNode.prototype.getByteFrequencyData=function(a){a.fill(240)};document.querySelector('.visual-stage').style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:200;aspect-ratio:auto';window.samples=[];window.sampleTimer=setInterval(()=>samples.push(window.__spectrumMetrics()),1000)",
  )
  await sleep(10000)
  results.push({ check: '1080p full-window high spectrum', samples: await ev('samples') })
  await ev('clearInterval(sampleTimer)')
  await ev(
    "(()=>{const s=document.querySelectorAll('.compact-controls select')[1];s.value='high';s.dispatchEvent(new Event('change',{bubbles:true}));samples=[];sampleTimer=setInterval(()=>samples.push(window.__spectrumMetrics()),1000)})()",
  )
  await sleep(8000)
  results.push({ check: '1080p native high quality', samples: await ev('samples') })
  await ev(
    "clearInterval(sampleTimer);const q=document.querySelectorAll('.compact-controls select')[1];q.value='auto';q.dispatchEvent(new Event('change',{bubbles:true}))",
  )
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 3840, height: 2160, deviceScaleFactor: 1, mobile: false },
    s,
  )
  await ev('samples=[];sampleTimer=setInterval(()=>samples.push(window.__spectrumMetrics()),1000)')
  await sleep(8000)
  results.push({ check: '4K display, adaptive render resolution', samples: await ev('samples') })
  await ev('clearInterval(sampleTimer)')
  assert.equal(errors.length, 0, JSON.stringify(errors))
  fs.writeFileSync('/tmp/spectrum-browser-results.json', JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  console.log('PASS: screenshots /tmp/spectrum-desktop.png and /tmp/spectrum-mobile.png')
})()
  .catch(async (e) => {
    console.error(e)
    if (debugEval)
      console.error(
        await debugEval(
          "({error:document.querySelector('.error-box')?.textContent,track:document.querySelector('.track-info')?.textContent})",
        ).catch(() => ''),
      )
    console.error(logs.slice(-4).join(''))
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await call('Browser.close')
    } catch {
      chrome.kill()
    }
  })
