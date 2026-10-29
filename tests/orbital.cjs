// Browser integration and repeatable rendering smoke test. Requires a running dev server.
// CHROME_PATH and SPECTRUM_URL may be overridden for other machines.
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  { spawn } = require('node:child_process')
const url = process.env.SPECTRUM_URL || 'http://127.0.0.1:5174'
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

;(async () => {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
  const { sessionId: s } = await call('Target.attachToTarget', { targetId, flatten: true })
  const ev = async (expression) => {
    const r = await call(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      s,
    )
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  await call('Runtime.enable', {}, s)
  await call('Page.enable', {}, s)
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    s,
  )
  await call('Page.navigate', { url: url + '/tests/orbital.html' }, s)
  for (let i = 0; i < 100; i++) {
    await sleep(100)
    if (await ev('!!window.orbitalTest')) break
  }
  assert.ok(await ev('!!window.orbitalTest'), 'Renderer initializes')
  const allScenes = await ev("import('/src/visuals/scenes.js').then(m => m.scenes)")
  for (let i = 0; i < 900; i++) {
    const state = await ev(
      '({ready:orbitalTest.renderer.programs.size,failed:[...orbitalTest.renderer.failureMessages.entries()]})',
    )
    assert.deepEqual(state.failed, [])
    if (state.ready === allScenes.length) break
    await sleep(200)
  }
  assert.equal(await ev('orbitalTest.renderer.programs.size'), allScenes.length)
  await ev('for(let i=0;i<240;i++)orbitalTest.frame()')
  assert.equal(await ev('orbitalTest.renderer.gl.getError()'), 0)
  let shot = await call('Page.captureScreenshot', { format: 'png' }, s)
  fs.writeFileSync('/tmp/orbital-restored.png', Buffer.from(shot.data, 'base64'))
  const state = await ev(
    '({vertices:orbitalTest.renderer.orbital.count/6,waves:orbitalTest.renderer.orbital.waves.length,shocks:orbitalTest.renderer.orbital.shocks.length})',
  )
  assert.ok(state.vertices > 10000)
  assert.ok(state.waves < 8)
  assert.ok(state.shocks < 5)
  console.log('PASS: Orbital geometry and bounded waves')
  // Validate color output, source layer switches, and frozen-state stability.
  const pixels = () =>
    ev(
      `(()=>{orbitalTest.frame();const gl=orbitalTest.renderer.gl;const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);let sum=0;for(let i=0;i<p.length;i+=4)sum+=p[i]+p[i+1]+p[i+2];return sum})()`,
    )
  for (const scene of allScenes) {
    await ev(
      `Object.assign(orbitalTest.settings,{scene:${scene.id},transition:0,frozen:false,raveFlash:0})`,
    )
    const light = await pixels()
    assert.ok(light > 0, `${scene.name} produces visible pixels`)
    assert.equal(await ev('orbitalTest.renderer.scene'), scene.id)
    assert.equal(await ev('orbitalTest.renderer.gl.getError()'), 0, scene.name)
    console.log(`PASS: rendered pixels for ${scene.name}`)
  }
  await ev('Object.assign(orbitalTest.settings,{scene:0,transition:0})')
  await pixels()
  await ev('orbitalTest.settings.frozen=true')
  const frozen = await pixels()
  assert.equal(await pixels(), frozen)
  for (const layer of ['ring', 'dna', 'grid', 'eye', 'waves']) {
    await ev(
      `Object.assign(orbitalTest.settings,{ring:false,dna:false,grid:false,eye:false,waves:false,${layer}:true})`,
    )
    assert.ok((await pixels()) > 0, `${layer} renders independently`)
  }
  await ev(
    'Object.assign(orbitalTest.settings,{ring:false,dna:false,grid:false,eye:false,waves:false})',
  )
  assert.equal(await pixels(), 0)
  await ev('Object.assign(orbitalTest.settings,{ring:true,dna:true,grid:true,eye:true,waves:true})')
  await ev('orbitalTest.settings.palette=2')
  assert.notEqual(await pixels(), frozen)
  await ev('orbitalTest.settings.blackout=true')
  assert.equal(await pixels(), 0)
  await ev(
    'orbitalTest.settings.blackout=false;orbitalTest.settings.palette=0;orbitalTest.settings.orbitalDepth=0',
  )
  assert.notEqual(await pixels(), frozen)
  await ev(
    'orbitalTest.settings.orbitalDepth=1;orbitalTest.settings.frozen=false;orbitalTest.renderer.time=120',
  )
  await pixels()
  assert.ok(
    await ev(
      'orbitalTest.renderer.orbital.waves.length<8 && orbitalTest.renderer.orbital.shocks.length<5',
    ),
  )
  await ev(
    'orbitalTest.settings.frozen=true;orbitalTest.audio.bass=0;orbitalTest.audio.mid=0;orbitalTest.audio.high=0;orbitalTest.spectrum.fill(0);orbitalTest.settings.frozen=false;for(let i=0;i<120;i++)orbitalTest.frame()',
  )
  shot = await call('Page.captureScreenshot', { format: 'png' }, s)
  fs.writeFileSync('/tmp/orbital-calm.png', Buffer.from(shot.data, 'base64'))
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
    s,
  )
  await ev(
    `orbitalTest.audio.bass=240/255;orbitalTest.spectrum.fill(240);window.samples=[];window.last=0;window.frames=[];window.tick=t=>{const dt=last?(t-last)/1000:1/60;last=t;frames.push(t);orbitalTest.frame(dt);window.loop=requestAnimationFrame(tick)};loop=requestAnimationFrame(tick)`,
  )
  await sleep(6000)
  const performanceResult = await ev(
    `cancelAnimationFrame(loop);(()=>{const d=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);return {fps:1000*(frames.length-1)/(frames.at(-1)-frames[0]),p95Interval:d[Math.floor(d.length*.95)],resolution:orbitalTest.renderer.dimensions,geometry:orbitalTest.renderer.orbital.count/6,waves:orbitalTest.renderer.orbital.waves.length}})()`,
  )
  assert.equal(await ev('orbitalTest.renderer.gl.getError()'), 0)
  assert.equal(errors.length, 0, JSON.stringify(errors))
  fs.writeFileSync('/tmp/orbital-restored-results.json', JSON.stringify(performanceResult, null, 2))
  console.log({ state, performanceResult })
  console.log('PASS: original geometry, freeze, palette, layers, bounded lifetimes, WebGL errors')
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await call('Browser.close')
    } catch {
      chrome.kill()
    }
  })
