// Each scene selects a background family at compile time. No second scene render.
const families = [
  ['filamentSpace', [2, 6, 10, 15, 17, 28, 41, 44, 48, 54, 57]],
  ['particleSpace', [5, 12, 37, 43, 49, 50, 51]],
  ['facetSpace', [3, 8, 22, 23, 30, 34, 46, 53]],
  ['structureSpace', [1, 7, 18, 27, 31, 32, 33, 36, 45, 55]],
  ['flowSpace', [4, 16, 20, 21, 25, 26, 29, 52]],
  ['waveSpace', [9, 35, 39, 40]],
  ['mistSpace', [38, 42, 47, 56]],
  ['stageSpace', [11]],
]
const alreadyDense = new Set([
  1, 4, 8, 16, 18, 20, 21, 22, 23, 26, 30, 31, 32, 33, 35, 36, 40, 45, 46, 53, 54, 56,
])
export function atmosphereForScene(id) {
  if (id === 0) return 'vec3 sceneAtmosphere(vec2 p) { return vec3(0); }'
  const family = families.find(([, ids]) => ids.includes(id))?.[0] ?? 'mistSpace'
  const strength = alreadyDense.has(id) ? '.22' : '.65'
  return `vec3 sceneAtmosphere(vec2 p) {
    vec3 backdrop=${family}(p,${id}.0);
    return backdrop*${strength}*(.35+.65*u_settings.y)*(1.0+min(u_impact,1.5)*.18);
  }`
}
export const sceneAtmospheres = `
vec3 filamentSpace(vec2 p, float seed) {
  vec3 col=vec3(0);
  for(int i=0;i<3;i++) {
    float layer=float(i), depth=1.0+layer*.65;
    vec2 q=turn(seed*.37+u_motion.x*.045/(1.0+layer))*p*depth;
    q+=vec2(seed,u_motion.z*.035/(1.0+layer));
    float fold=sin(q.x*1.7+u_motion.y*.15+layer)*.45;
    fold+=sin(q.x*4.3-u_motion.y*.09+seed)*.12;
    float strands=abs(sin((q.y+fold)*(13.0+layer*4.0)+layer));
    float thin=exp(-strands*45.0);
    float veil=exp(-strands*5.0)*.14;
    vec3 c=tint(seed+layer*1.8+q.x*.2);
    if(seed>56.5) c=mix(vec3(.38,.48,.12),vec3(.24,.17,.48),layer*.4);
    col+=c*(thin*.23+veil)/(1.0+layer*.6);
  }
  return col;
}
vec3 particleSpace(vec2 p, float seed) {
  vec3 col=vec3(0);
  for(int i=0;i<3;i++) {
    float layer=float(i), scale=5.0+layer*4.0;
    vec2 q=turn(seed*.2+u_motion.x*.025)*p*scale;
    q+=vec2(u_motion.z*.12/(layer+1.0),u_motion.y*.06)+seed;
    vec2 cell=floor(q), local=fract(q)-.5;
    vec2 offset=vec2(hash(cell+layer),hash(cell+seed+4.0))*.55-.275;
    float d=length(local-offset);
    float star=exp(-d*d*(650.0+layer*300.0));
    float halo=exp(-d*16.0)*.08;
    col+=tint(hash(cell)*6.0+layer)*(star*.65+halo)/(1.0+layer*.7);
  }
  float dust=field(p*2.0+vec2(seed,u_motion.z*.035));
  return col+tint(seed)*pow(dust,3.0)*.2;
}
vec3 facetSpace(vec2 p, float seed) {
  vec2 q=turn(seed*.23+u_motion.x*.06)*p*(3.0+.3*sin(seed));
  q+=vec2(u_motion.y*.035,u_motion.z*.05);
  vec2 cell=floor(q), uv=fract(q);
  float diagonal=abs(uv.x+uv.y-1.0);
  float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
  float facet=step(uv.x+uv.y,1.0);
  float light=.5+.5*sin(hash(cell)*6.0+seed+u_motion.y*.18);
  vec3 col=tint(hash(cell+facet)*5.0+seed)*(.025+light*.07);
  col+=tint(seed+2.0)*(exp(-diagonal*100.0)+exp(-edge*120.0))*.14;
  return col;
}
vec3 structureSpace(vec2 p, float seed) {
  vec3 col=vec3(0);
  for(int i=0;i<3;i++) {
    float layer=float(i);
    vec2 q=turn(sin(seed)*.3)*p*(3.0+layer*2.3);
    q+=vec2(seed+layer*.4,u_motion.z*.06/(layer+1.0));
    vec2 cell=floor(q), uv=fract(q)-.5;
    float frame=abs(max(abs(uv.x),abs(uv.y))-.43);
    float active=.25+.75*hash(cell+seed+layer);
    float dash=exp(-abs(uv.y+.31)*90.0)*step(abs(uv.x),.18);
    col+=tint(seed+layer+hash(cell))*(exp(-frame*150.0)*.19+dash*.08)*active/(1.0+layer);
  }
  return col;
}
vec3 flowSpace(vec2 p, float seed) {
  vec2 q=p*1.8+seed;
  q+=vec2(sin(q.y*1.6+u_motion.y*.13),cos(q.x*1.3-u_motion.z*.09))*.5;
  float n=field(q+u_motion.y*.035);
  float vein=abs(sin(n*27.0+u_motion.y*.14));
  return tint(seed+n*4.0)*(n*n*.19+exp(-vein*20.0)*.18);
}
vec3 waveSpace(vec2 p, float seed) {
  vec3 col=vec3(0);
  for(int i=0;i<3;i++) {
    float layer=float(i);
    vec2 q=turn(seed*.18+layer*.45)*p;
    float h=q.y+sin(q.x*(2.0+layer)+u_motion.y*.2+seed)*.22;
    float lineDistance=abs(sin(h*(18.0+layer*7.0)-u_motion.z*.16));
    col+=tint(seed+layer*1.3)*(exp(-lineDistance*35.0)*.19+exp(-lineDistance*4.0)*.025);
  }
  return col;
}
vec3 mistSpace(vec2 p, float seed) {
  vec2 q=p*2.2+seed;
  float n=field(q+vec2(u_motion.z*.045,u_motion.y*.035));
  float fine=noise(q*5.0+vec2(n*3.0,-u_motion.y*.07));
  float wisps=pow(max(0.0,1.0-abs(n-.5)*2.0),6.0)*fine;
  return tint(seed+n*5.0)*(n*n*.17+wisps*.24);
}
vec3 stageSpace(vec2 p, float seed) {
  // Low fog fills the venue without introducing unsynchronised laser beams.
  float haze=field(p*2.0+vec2(seed,u_motion.z*.035));
  float floorGlow=exp(-abs(p.y+.7)*1.4);
  return mix(u_c1,u_c2,haze)*haze*(.04+floorGlow*.1);
}
vec3 sceneAtmosphere(vec2 p) { return vec3(0); }
`
