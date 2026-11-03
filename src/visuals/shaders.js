import { directionForScene } from './sceneDirection.js'
import { prismScenes } from './prismScenes'
import { extraScenes } from './extraScenes'
import { spectacleScenes } from './spectacleScenes'
import { digitalScenes } from './digitalScenes'
import { festivalScenes } from './festivalScenes'
import { retroScene } from './retroScene'
import { referenceFlowScenes } from './referenceFlowScenes'
import { sceneAtmospheres, atmosphereForScene } from './sceneAtmospheres'

export const vertex = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`
export const fragment = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_reveal;
uniform float u_time;
uniform vec3 u_motion; // accumulated rotation, deformation, travel
uniform float u_impact;
uniform vec4 u_prism; // progression, bass body, mid facets, treble detail
uniform vec2 u_dynamic; // automatic movement strength, automatic colour grade
uniform vec4 u_rave; // energy, depth, psychedelia, flashes
uniform vec4 u_live; // manual mode, explosion envelope, held boost, impact
uniform vec4 u_kick; // membrane displacement, flash, seconds since hit, velocity
uniform vec4 u_audio;
uniform vec4 u_settings; // intensity, detail, glow, blackout
uniform vec4 u_layers; // ring, dna, grid, eye
uniform float u_waves;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform int u_scene;
uniform int u_previous;
uniform float u_mix;
uniform sampler2D u_spectrum;
uniform sampler2D u_orbital;
uniform float u_orbitalImpact;
uniform float u_orbitalTint;
#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

vec3 orbital(vec2 p) {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_live.x > .5 || u_dynamic.x > .001) {
    vec2 q=uv-.5;
    float kick=u_kick.x*u_rave.y;
    q/=max(.35,1.0+kick*.4+u_live.y*.45);
    q*=turn(u_live.y*.2*sin(length(q)*16.0)+u_dynamic.x*u_rave.z*.12*sin(length(q)*14.0-u_motion.y));
    uv=q+.5;
  }
  vec2 px = 1.0 / u_resolution;
  vec3 color = texture2D(u_orbital, uv).rgb;
  // Original additive displaced copies + saturation, now a few GPU texture reads.
  float hit = u_orbitalImpact * (.85 + .45*u_audio.w);
  color *= 1.0 + .2*u_orbitalImpact;
  vec2 shift = px * (1.5 + hit*2.5);
  color += hit*.27*(texture2D(u_orbital,uv+vec2(shift.x,0.0)).rgb
                   +texture2D(u_orbital,uv-vec2(shift.x,0.0)).rgb
                   +texture2D(u_orbital,uv+vec2(0.0,shift.y)).rgb);
  vec2 halo = px * (3.0+u_settings.z*4.0);
  color += u_settings.z*.12*(texture2D(u_orbital,uv+vec2(halo.x,0.0)).rgb
                            +texture2D(u_orbital,uv-vec2(halo.x,0.0)).rgb
                            +texture2D(u_orbital,uv+vec2(0.0,halo.y)).rgb
                            +texture2D(u_orbital,uv-vec2(0.0,halo.y)).rgb);
  color = mix(color,u_c1*color.r+u_c2*color.g+u_c3*color.b,u_orbitalTint);
  float luminance = dot(color,vec3(.2126,.7152,.0722));
  color = max(vec3(0.0),mix(vec3(luminance),color,1.0+hit*.35));
  return color;
}
// Shared luminous strokes: a narrow core, a coloured shoulder and a soft halo.
vec3 ink(float d, float width, vec3 tint) {
  d = abs(d);
  width=max(width,.65/min(u_resolution.x,u_resolution.y));
  float core = exp(-d*d / max(width*width, 0.000001));
  float halo = exp(-d / (width*5.0 + .008));
  return tint*(core + halo*(.18 + u_settings.z*.75)) + vec3(core*core*.3);
}
// Continuous layer opacity prevents detail changes from popping whole shapes.
float detailLayer(float index, float count) {
  return smoothstep(0.0,1.0,1.5+u_settings.y*(count-1.5)-index);
}
vec3 tint(float x) {
  return mix(mix(u_c1,u_c2,.5+.5*sin(x)),u_c3,.25+.2*cos(x*1.7));
}
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float field(vec2 p) {
  float v=0.0, amp=.5;
  for(int i=0;i<4;i++) {
    v += noise(p)*amp;
    p = turn(.57)*p*2.03+vec2(5.2,1.3); amp *= .5;
  }
  return v;
}

vec3 liquid(vec2 p) {
  p*=.8+u_settings.y*.3;
  p+=u_audio.y*.025*vec2(sin(p.y*4.0+u_motion.y),cos(p.x*4.0-u_motion.y));
  // Procedural turbulent plasma, with folded currents rather than a fluid solver.
  p *= turn(u_motion.x*.18);
  float m=u_motion.y, t=u_motion.z;
  vec2 q=p*1.7;
  float r=length(p), a=atan(p.y,p.x);
  q += .28*vec2(sin(a*3.0+m*.6),cos(a*4.0-m*.5))*exp(-r*.4);
  for(int i=0;i<5;i++) {
    float f=float(i)+1.0;
    q += vec2(sin(q.y*f+m*.65+f),cos(q.x*f-m*.57))* (.52+u_audio.x*.38+u_impact*u_rave.x*.22)/f;
    q=turn(.16)*q;
  }
  float n=field(q*2.0+vec2(t*.3,-t*.23));
  float current=sin(q.x*5.0+q.y*3.0+n*8.0-t*1.4);
  float veins=abs(current);
  vec3 col=ink(veins,.035+.025*u_settings.y,tint(n*7.0+r*2.0));
  col += ink(abs(sin(q.y*8.0-q.x*4.0+n*5.0+m)),.025,u_c2)*.35;
  col += tint(n*5.0)*pow(n,3.0)*(.25+u_settings.z*.5);
  // Radial jets and expanding fronts become violent on detected hits.
  float jet=pow(max(0.0,sin(a*9.0+q.x*2.0+m)),14.0);
  col += tint(a*2.0)*jet*exp(-abs(r-.5-u_impact*.35)*3.0)*u_impact*.8;
  float shock=fract(t*.45);
  col += ink(r-shock*2.3+.06*sin(a*12.0+n*4.0),.012,u_c3)*u_impact*(1.0-shock);
  col += vec3(.6,.8,1.0)*pow(max(0.0,1.0-veins),35.0)*u_impact*.35;
  return col;
}
${extraScenes}
${prismScenes}
${spectacleScenes}
${digitalScenes}
${festivalScenes}
${retroScene}
${referenceFlowScenes}
${sceneAtmospheres}
vec3 scene(int id, vec2 p) {
  if(id==0) return orbital(p);
  if(id==1) return vortexDepth(p);
  if(id==4) return liquid(p);
  if(id==6) return overdrive(p);
  if(id==8) return prism(p);
  if(id==17) return gyro(p);
  if(id==18) return latticeDepth(p);
  if(id==20) return plasmaCyclone(p);
  if(id==21) return plasmaFission(p);
  if(id==22) return prismAbyss(p);
  if(id==23) return prismFracture(p);
  if(id==25) return dimensionalRift(p);
  if(id==26) return liquidMetal(p);
  if(id==31) return matrixRain(p);
  if(id==32) return dataTunnel(p);
  if(id==33) return circuitBoard(p);
  if(id==35) return digitalInterference(p);
  if(id==38) return thunderstorm(p);
  if(id==40) return neonDunes(p);
  if(id==46) return tectonicPlates(p);
  if(id==47) return borealis(p);
  if(id==52) return lavaLamp(p);
  if(id==56) return cosmicNebula(p);
  if(id==57) return retroResonance(p);
  if(id==59) return moireSilk(p);
  if(id==60) return contourCurrents(p);
  if(id==61) return acidDrapes(p);
  if(id==69) return liquidAbyss(p);
  if(id==70) return prismLace(p);
  if(id==71) return prismCrowns(p);
  if(id==72) return prismShards(p);
  if(id==73) return prismSpiral(p);
  if(id==74) return prismCrystal(p);
  return gyro(p);
}
vec3 finishedScene(int id, vec2 p) {
  // Orbital retains its own original geometry, audio response and post-processing.
  if (id == 0) {
    vec3 original=orbital(p)*u_settings.x;
    if (u_live.x > .5) {
      original*=1.0+u_live.z*.8;
    }
    original=mix(original,vec3(1.0),u_kick.y*u_rave.w*.85);
    return clamp(original,0.0,1.0);
  }
  if(id>=59) {
    // Reference compositions own their depth, deformation and full-frame material.
    vec2 framed=p/max(.5,1.0+u_rave.y*.08+u_kick.x*u_rave.y*(.06+u_dynamic.x*.18));
    framed*=turn(u_rave.z*.13*sin(length(p)*6.0-u_motion.y));
    vec3 composed=scene(id,framed)*u_settings.x*(.85+u_rave.x*.25+u_live.z*.5);
    composed+=composed*composed*u_settings.z*.12;
    composed=mix(composed,composed.gbr,clamp(u_rave.z*.12,0.0,.3));
    composed=1.0-exp(-max(composed,vec3(0))*1.5);
    float flash=min(.8,u_kick.y*u_rave.w*.7);
    return mix(composed,vec3(1.0,.97,1.0),flash);
  }
  float energy=u_rave.x+u_live.z, psy=u_rave.z+u_live.y*.8;
  float r=length(p), a=atan(p.y,p.x);
  float punch=u_kick.x*u_rave.y*1.0;
  // Perspective displacement: centre thrusts forward, edges lag behind, then recoil.
  vec2 q=p/max(.35,1.0+u_rave.y*.08+punch*(.38+.3*exp(-r*r*2.0)));
  q += p*sin(r*8.0-u_kick.z*24.0)*exp(-u_kick.z*7.0)*.055*u_rave.y;
  // Radial folding and torsion breathe with the hit; accumulated rotation is separate.
  float bend=psy*(.035*sin(r*9.0-u_motion.y)+u_impact*.07*sin(r*6.0));
  q *= turn(bend);
  q += psy*.035*u_impact*vec2(sin(q.y*9.0+u_motion.y),cos(q.x*8.0-u_motion.y));
  // A separate live burst scatters the geometry and opens radial tears.
  q/=1.0+u_live.y*.7;
  q+=u_live.y*.12*vec2(sin(a*13.0+r*8.0),cos(a*11.0-r*9.0));
  vec3 subject=scene(id,q);
  // Scene-specific depth layers remain visible in the gaps and at wide-screen edges.
  // Bright foreground details occlude them, retaining their silhouette and contrast.
  float coverage=max(subject.r,max(subject.g,subject.b));
  vec3 depthLayer=sceneAtmosphere(q)/(1.0+coverage*4.0);
  vec3 color=(subject+depthLayer)*u_settings.x*(1.1+energy*.45+u_impact*.35);
  // Saturated colour separation without rendering the entire scene multiple times.
  vec3 spectral=.55+.45*cos(vec3(0.0,2.1,4.2)+r*5.0+u_motion.y*.7);
  color=mix(color,color* spectral*2.0,clamp(psy*.3,0.0,.7));
  color += color.gbr*psy*u_kick.y*.38;
  color+=tint(a*4.0)*pow(max(0.0,cos(a*32.0+r*9.0)),24.0)*u_live.y*.9;
  color *= 1.0-smoothstep(.9,3.0,r)*.08;
  color=1.0-exp(-max(color,vec3(0.0))*1.65);
  float flash=u_kick.y*u_rave.w;
  // Brief full-frame flash and a colour-negative edge on the attack.
  vec3 negative=1.0-color.brg;
  color=mix(color,negative,min(.45,flash*psy*.32));
  color=mix(color,vec3(1.0,.96,1.0),min(.88,flash*.85));
  return clamp(color,0.0,1.0);
}
vec3 dynamicGrade(vec3 color) {
  float brightness=max(color.r,max(color.g,color.b));
  vec3 mapped=mix(u_c1,u_c2,clamp(dot(color,vec3(.2126,.7152,.0722)),0.0,1.0))*brightness;
  mapped+=vec3(pow(brightness,8.0))*.12;
  return mix(color,mapped,u_dynamic.y*.85);
}
void main() {
  vec2 p = (gl_FragCoord.xy*2.0-u_resolution)/min(u_resolution.x,u_resolution.y);
  vec3 color = finishedScene(u_scene,p);
  if(u_mix<.999) color=mix(finishedScene(u_previous,p),color,smoothstep(0.0,1.0,u_mix));
  gl_FragColor=vec4(dynamicGrade(color)*(1.0-u_settings.w),1.0);
}
`

// Compile only the selected scene and the helpers it actually calls. In particular,
// no driver should have to inline all ray marches and nested loops at startup.
const shaderSource = fragment.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
const functionPattern = /\b(?:float|vec[234]|mat[234]|void)\s+(\w+)\s*\([^;{}]*\)\s*\{/g
const shaderFunctions = new Map()
let headerEnd = shaderSource.length
for (let match; (match = functionPattern.exec(shaderSource));) {
  headerEnd = Math.min(headerEnd, match.index)
  let end = functionPattern.lastIndex,
    depth = 1
  while (depth && end < shaderSource.length) {
    const character = shaderSource[end++]
    if (character === '{') depth++
    if (character === '}') depth--
  }
  shaderFunctions.set(match[1], shaderSource.slice(match.index, end))
  functionPattern.lastIndex = end
}
const sceneFunctions = new Map(
  [...shaderFunctions.get('scene').matchAll(/if\(id==(\d+)\) return (\w+)\(p\);/g)].map((match) => [
    Number(match[1]),
    match[2],
  ]),
)
function takeBranch(source, condition) {
  const start = source.indexOf(condition)
  const open = source.indexOf('{', start)
  let end = open + 1,
    depth = 1
  while (depth && end < source.length) {
    const character = source[end++]
    if (character === '{') depth++
    if (character === '}') depth--
  }
  return { start, end, body: source.slice(open + 1, end - 1) }
}
export function fragmentForScene(id) {
  const selected = sceneFunctions.get(id)
  if (!selected) throw new Error(`Scène inconnue : ${id}`)
  const direction = directionForScene(id)
  const functions = new Map(shaderFunctions)
  functions.set(
    'scene',
    `vec3 scene(int id, vec2 p) { return ${selected}(p)*${direction.exposure.toFixed(3)}; }`,
  )
  functions.set('sceneAtmosphere', atmosphereForScene(id))
  let finish = functions.get('finishedScene')
  for (const [sceneId, condition] of [
    [0, 'if (id == 0)'],
    [59, 'if(id>=59)'],
  ]) {
    const branch = takeBranch(finish, condition)
    if (id === sceneId || (sceneId === 59 && id >= 59)) {
      finish = `vec3 finishedScene(int id, vec2 p) { ${branch.body} }`
      break
    }
    finish = finish.slice(0, branch.start) + finish.slice(branch.end)
  }
  finish = finish.replace(
    'vec3 depthLayer=sceneAtmosphere(q)',
    `vec3 depthLayer=sceneAtmosphere(q)*${direction.atmosphere.toFixed(3)}`,
  )
  functions.set('finishedScene', finish)
  functions.set(
    'main',
    `void main() {
    vec2 p = (gl_FragCoord.xy*2.0-u_resolution)/min(u_resolution.x,u_resolution.y);
    float reveal=smoothstep(0.0,1.0,u_reveal);
    vec3 color = finishedScene(${id},p*(1.0+.055*(1.0-reveal)));
    float radius=length(p)/max(1.0,length(u_resolution/min(u_resolution.x,u_resolution.y)));
    float opening=smoothstep(0.0,.25,reveal*1.25-radius*.25);
    gl_FragColor=vec4(dynamicGrade(color)*(1.0-u_settings.w),u_opacity*opening);
  }`,
  )
  const used = new Set(),
    ordered = []
  function visit(name) {
    if (used.has(name)) return
    used.add(name)
    const body = functions.get(name)
    for (const match of body.matchAll(/\b(\w+)\s*\(/g)) {
      if (match[1] !== name && functions.has(match[1])) visit(match[1])
    }
    ordered.push(body)
  }
  visit('main')
  return `${shaderSource.slice(0, headerEnd)}\nuniform float u_opacity;\n${ordered.join('\n')}`
}
