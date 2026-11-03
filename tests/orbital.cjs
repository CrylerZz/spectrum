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
  process.argv.find((arg) => arg.startsWith('--browser='))?.slice(10) ||
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    '--mute-audio',
    '--enable-gpu',
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
  errors = [],
  targetEvents = []
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
    if (m.method?.startsWith('Target.') && /Crashed|Destroyed|detached/.test(m.method)) {
      targetEvents.push({ at: Date.now(), method: m.method, params: m.params })
      if (targetEvents.length > 100) targetEvents.shift()
      if (process.argv.includes('--soak'))
        fs.writeFileSync(
          '/tmp/spectrum-soak-events.json',
          JSON.stringify({ targetEvents, logs }, null, 2),
        )
    }
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
  await call('Target.setDiscoverTargets', { discover: true })
  await call('Page.bringToFront', {}, s)
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
  if (process.argv.includes('--transitions-only')) {
    const result = await ev(`(()=>{
      const h=orbitalTest;
      Object.assign(h.settings,{scene:0,transition:0,frozen:false});h.frame();
      Object.assign(h.settings,{scene:70,transition:1.5,transitionStyle:'breathe'});
      for(let i=0;i<30;i++)h.frame();
      const progress=h.renderer.mix,time=h.renderer.time;
      h.settings.frozen=true;
      for(let i=0;i<90;i++)h.frame();
      const held=h.renderer.mix,heldTime=h.renderer.time;
      h.settings.frozen=false;
      for(let i=0;i<120;i++)h.frame();
      return {progress,time,held,heldTime,finished:h.renderer.mix,scene:h.renderer.scene,error:h.renderer.gl.getError()};
    })()`)
    assert.ok(result.progress > 0 && result.progress < 1)
    assert.equal(result.held, result.progress)
    assert.equal(result.heldTime, result.time)
    assert.equal(result.finished, 1)
    assert.equal(result.scene, 70)
    assert.equal(result.error, 0)
    assert.equal(errors.length, 0, JSON.stringify(errors))
    console.log('PASS: progressive transition, frozen transition and clean completion')
    return
  }
  if (process.argv.includes('--art-review')) {
    await call(
      'Emulation.setDeviceMetricsOverride',
      { width: 640, height: 400, deviceScaleFactor: 1, mobile: false },
      s,
    )
    const review = [],
      failures = []
    for (const scene of allScenes) {
      const result = await ev(`(async()=>{
        const h=orbitalTest, defaults=(await import('/src/visuals/scenes.js')).defaults;
        Object.assign(h.settings,defaults,{scene:${scene.id},transition:0,quality:'high',dynamicMix:false,prismLevel:4,prismSignal:[.7,.6,.6,.6]});
        Object.assign(h.audio,{bass:.6,mid:.6,high:.6,beat:0});
        h.renderer.time=12;h.renderer.motion.phases=[.4,1.2,.6];h.frame();h.settings.frozen=true;
        const gl=h.renderer.gl;
        const pixels=()=>{h.frame();const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
        const checks={};
        for(const key of ['detail','glow',${[0, 6].includes(scene.id) ? "'orbitalDepth','orbitalPsy'" : "'raveDepth','ravePsy'"}]){
          const initial=h.settings[key];h.settings[key]=key==='detail'?.2:0;const low=pixels();
          h.settings[key]=key==='detail'||key==='glow'?1:1.5;const high=pixels();
          let diff=0,lit=0;for(let i=0;i<low.length;i+=4){for(let j=0;j<3;j++)diff+=Math.abs(low[i+j]-high[i+j]);if(high[i]+high[i+1]+high[i+2]>30)lit++;}
          checks[key]={difference:diff/(low.length*.75),lit};h.settings[key]=initial;
        }
        return {checks,error:gl.getError()};
      })()`)
      assert.equal(result.error, 0)
      for (const [key, check] of Object.entries(result.checks))
        if (check.difference <= 0.02)
          failures.push(`${scene.name}: ${key} has no visible effect (${check.difference})`)
      review.push({ scene: scene.name, ...result })
      const shot = await call('Page.captureScreenshot', { format: 'png' }, s)
      fs.writeFileSync(`/tmp/spectrum-review-${scene.id}.png`, Buffer.from(shot.data, 'base64'))
      console.log(
        `REVIEW: ${scene.name} — ${Object.values(result.checks).every((c) => c.difference > 0.02) ? '4 contrôles validés' : 'correction nécessaire'}`,
      )
    }
    fs.writeFileSync('/tmp/spectrum-art-review.json', JSON.stringify(review, null, 2))
    assert.deepEqual(failures, [], 'Every visible control affects its scene')
    assert.equal(errors.length, 0, JSON.stringify(errors))
    if (!process.argv.includes('--covers')) return
  }
  if (process.argv.includes('--soak')) {
    const gpu = await ev(
      `(()=>{const gl=orbitalTest.renderer.gl,e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)})()`,
    )
    console.log('GPU:', gpu)
    const seconds = Math.min(7200, Math.max(60, Number(process.env.SOAK_SECONDS) || 600))
    await call(
      'Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
      s,
    )
    await ev(`(async()=>{
      const {DynamicMix}=await import('/src/visuals/DynamicMix.js');
      const h=orbitalTest;
      const base={...h.settings,quality:'auto',dynamicMix:true,transition:1.5,transitionStyle:'breathe'};
      const mixer=new DynamicMix();
      const sceneIds=(await import('/src/visuals/scenes.js')).scenes.map(s=>s.id);
      window.soak={frames:0,started:performance.now(),last:0,errors:0,minFPS:Infinity};
      const tick=now=>{
        const elapsed=(now-soak.started)/1000, dt=soak.last?Math.min(.1,(now-soak.last)/1000):1/60;
        soak.last=now;
        const strong=elapsed%32>12, value=strong?.85:.08, beat=strong && elapsed%.5<.07?1:0;
        Object.assign(h.audio,{level:value,bass:value,mid:value*.85,high:value*.7,beat,beatId:Math.floor(elapsed*2)});
        h.spectrum.fill(Math.round(value*255));
        base.scene=sceneIds[Math.floor(elapsed/12)%sceneIds.length];
        Object.assign(h.settings,mixer.update(dt,h.audio,base));
        h.settings.prismSignal=[mixer.energy,value,value*.85,value*.7];
        h.frame(dt); soak.frames++;
        if(h.renderer.gl.getError())soak.errors++;
        soak.loop=requestAnimationFrame(tick);
      };soak.loop=requestAnimationFrame(tick);
    })()`)
    const samples = []
    const start = Date.now()
    while (Date.now() - start < seconds * 1000) {
      await sleep(Math.min(30000, Math.max(1, seconds * 1000 - (Date.now() - start))))
      await call('HeapProfiler.collectGarbage', {}, s)
      const heap = await call('Runtime.getHeapUsage', {}, s)
      const sample = await ev(
        `({seconds:(performance.now()-soak.started)/1000,frames:soak.frames,fps:orbitalTest.renderer.fps,scene:orbitalTest.renderer.scene,programs:orbitalTest.renderer.programs.size,waves:orbitalTest.renderer.orbital?.waves.length||0,shocks:orbitalTest.renderer.orbital?.shocks.length||0,errors:soak.errors,lost:orbitalTest.renderer.lost})`,
      )
      assert.equal(sample.errors, 0)
      assert.equal(sample.lost, false)
      assert.equal(sample.programs, allScenes.length)
      assert.ok(sample.waves < 12 && sample.shocks < 8)
      samples.push({ ...sample, heapBytes: heap.usedSize })
      fs.writeFileSync(
        '/tmp/spectrum-soak-results.json',
        JSON.stringify({ requestedSeconds: seconds, gpu, samples }, null, 2),
      )
      console.log(
        `SOAK: ${Math.round(sample.seconds)}s, ${sample.frames} frames, ${sample.fps} FPS, heap ${(heap.usedSize / 1048576).toFixed(1)} MB`,
      )
    }
    await ev('cancelAnimationFrame(soak.loop)')
    assert.ok(
      samples.at(-1).heapBytes < samples[0].heapBytes + 25 * 1048576,
      'No unbounded heap growth',
    )
    assert.equal(errors.length, 0, JSON.stringify(errors))
    console.log(`PASS: ${seconds}s real-time renderer soak; bounded resources and no WebGL errors`)
    return
  }
  if (process.argv.includes('--covers')) {
    const directory = path.resolve(__dirname, '../public/scenes')
    fs.mkdirSync(directory, { recursive: true })
    await call(
      'Emulation.setDeviceMetricsOverride',
      { width: 480, height: 300, deviceScaleFactor: 1, mobile: false },
      s,
    )
    for (const scene of allScenes) {
      await ev(`(() => {
        Object.assign(orbitalTest.settings, {scene:${scene.id}, prismLevel:4, prismSignal:[.7,.65,.6,.5], transition:0, frozen:false, dynamicMix:false});
        orbitalTest.renderer.time=12;
        orbitalTest.renderer.motion.phases=[.4,1.2,.6];
        for(let i=0;i<90;i++) orbitalTest.frame();
      })()`)
      assert.equal(await ev('orbitalTest.renderer.gl.getError()'), 0)
      const shot = await call('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, s)
      fs.writeFileSync(
        path.join(directory, `scene-${scene.id}.jpg`),
        Buffer.from(shot.data, 'base64'),
      )
      console.log(`Cover: ${scene.name}`)
    }
    assert.equal(errors.length, 0, JSON.stringify(errors))
    return
  }
  if (process.argv.includes('--prisms-only')) {
    const signatures = []
    for (const scene of allScenes.filter((scene) => scene.id >= 70)) {
      const brightness = []
      for (let level = 1; level <= 5; level++) {
        const stats = await ev(`(() => {
          Object.assign(orbitalTest.settings, {scene:${scene.id}, prismLevel:${level}, prismSignal:[0,.72,.72,.57], transition:0, frozen:true, dynamicMix:false});
          orbitalTest.renderer.motion.phases=[.4,1.2,.6];
          orbitalTest.frame();
          const gl=orbitalTest.renderer.gl, pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
          gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let sum=0, lit=0;
          for(let i=0;i<pixels.length;i+=4) {const light=pixels[i]+pixels[i+1]+pixels[i+2];sum+=light;if(light>60)lit++;}
          return {sum,lit,error:gl.getError()};
        })()`)
        assert.equal(stats.error, 0)
        assert.ok(stats.sum > 0, `${scene.name} level ${level} is visible`)
        brightness.push(stats.sum)
        if (level === 1 || level === 5) {
          const shot = await call('Page.captureScreenshot', { format: 'png' }, s)
          fs.writeFileSync(`/tmp/prism-${scene.id}-${level}.png`, Buffer.from(shot.data, 'base64'))
        }
      }
      assert.ok(
        brightness[4] > brightness[0] * 1.5,
        `${scene.name}: stronger build has visibly more light`,
      )
      assert.equal(new Set(brightness).size, 5, 'Five distinct intensities')
      signatures.push(brightness[4])
      console.log(`PASS: ${scene.name} five visible levels, brightness ${brightness.join(', ')}`)
    }
    assert.equal(new Set(signatures).size, 5, 'Five different prism compositions')
    assert.equal(errors.length, 0, JSON.stringify(errors))
    return
  }
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
    fs.writeFileSync(
      '/tmp/spectrum-render-failure.json',
      JSON.stringify({ error: String(e), details: e, targetEvents, logs, errors }, null, 2),
    )
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
