// Specialise the distance field before dependency pruning: each scene keeps only its own geometry.
const models = {
  62: 'kaleidoMachineDistance',
  63: 'cyanCitadelDistance',
  64: 'industrialRotorDistance',
  65: 'neonEngineDistance',
  68: 'octagonMachineDistance',
}
export function referenceModelForScene(id) {
  return models[id] ? `vec2 referenceMachineDistance(vec3 p) { return ${models[id]}(p); }` : null
}
export const referenceMachineScenes = `
float machineBox(vec3 p, vec3 size) {
  vec3 q=abs(p)-max(vec3(.001),size-vec3(.006));
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-.006;
}
float machineRing(vec3 p, float radius, float thickness) {
  return length(vec2(length(p.xy)-radius,p.z))-thickness;
}
vec2 machineUnion(vec2 a, vec2 b) { return a.x<b.x ? a : b; }
vec2 machinePolar(vec2 p, float sectors, float phase) {
  float a=atan(p.y,p.x)+phase;
  a=mod(a+PI/sectors,TAU/sectors)-PI/sectors;
  return vec2(cos(a),sin(a))*length(p);
}
vec2 machineAssembly(vec3 p, vec3 size, float accent) {
  float shell=machineBox(p,size);
  vec3 front=p+vec3(0,0,size.z);
  float pocket=machineBox(front,vec3(size.xy*.68,.027));
  vec2 hit=vec2(max(shell,-pocket),0);
  vec3 fin=front;
  fin.x=mod(fin.x+.025,.05)-.025;
  float grille=machineBox(fin-vec3(0,0,.018),vec3(.008,size.y*.61,.012));
  grille=max(grille,abs(p.x)-size.x*.65);
  hit=machineUnion(hit,vec2(grille,0));
  vec3 edge=front; edge.y=abs(edge.y)-size.y*.84;
  hit=machineUnion(hit,vec2(machineBox(edge,vec3(size.x*.83,.008,.009)),accent));
  vec3 bolt=front; bolt.xy=abs(bolt.xy)-size.xy*.82;
  hit=machineUnion(hit,vec2(length(bolt)-.014,0));
  return hit;
}
// Small fittings are shaded once at the visible surface, not marched as geometry.
vec2 machineAssemblyLite(vec3 p, vec3 size, float accent) {
  vec2 hit=vec2(machineBox(p,size),0);
  vec3 edge=p+vec3(0,0,size.z);
  edge.y=abs(edge.y)-size.y*.84;
  return machineUnion(hit,vec2(machineBox(edge,vec3(size.x*.83,.008,.009)),accent));
}
vec2 kaleidoMachineDistance(vec3 p) {
  vec2 hit=vec2(10,0);
  for(int i=0;i<5;i++) {
    float f=float(i), z=f*.32;
    if(f>2.0+u_settings.y*2.0) break;
    vec2 q=machinePolar(p.xy,6.0,u_motion.x*.07*(1.0-f*.3));
    q.x-=.38+f*.48+stagePressure()*.07;
    vec3 block=vec3(q,p.z-z);
    block.xy=turn(.3+sin(u_motion.y*.2+f)*.18)*block.xy;
    hit=machineUnion(hit,machineAssemblyLite(block,vec3(.24+f*.06,.12+f*.025,.14),2.0));
    float trim=machineBox(block,vec3(.26+f*.08,.14+f*.025,.04));
    float cut=machineBox(block,vec3(.22+f*.08,.1+f*.025,.08));
    hit=machineUnion(hit,vec2(max(trim,-cut),2));
    vec3 bar=vec3(q-vec2(.1,.22),p.z-z+.1);
    hit=machineUnion(hit,vec2(machineBox(bar,vec3(.31,.035,.075)),3));
    bar.y=abs(bar.y)-.15;
    hit=machineUnion(hit,vec2(machineBox(bar,vec3(.18,.025,.13)),1));
  }
  vec2 folded=machinePolar(p.xy,24.0,-u_motion.x*.11);
  vec3 tooth=vec3(folded.x-.27,folded.y,p.z+.07);
  hit=machineUnion(hit,vec2(machineBox(tooth,vec3(.055,.014,.045)),2));
  return hit;
}
vec2 cyanCitadelDistance(vec3 p) {
  vec2 xy=abs(p.xy);
  if(xy.y>xy.x) xy=xy.yx;
  float expansion=stagePressure()*.06;
  vec3 q=vec3(xy,p.z);
  vec2 hit=machineAssemblyLite(q-vec3(.38+expansion,.15,.22),vec3(.21,.1,.2),1.0);
  vec3 display=q-vec3(.36+expansion,.15,-.005);
  display.x=mod(display.x+.03,.06)-.03;
  float circuit=max(machineBox(display,vec3(.008,.052,.012)),abs(q.x-.36-expansion)-.18);
  hit=machineUnion(hit,vec2(circuit,1));
  hit=machineUnion(hit,vec2(machineRing(p-vec3(0,0,.04),.16,.025),1));
  for(int i=0;i<4;i++) {
    float f=float(i), x=.72+f*.3;
    vec3 beam=q-vec3(x,.18+f*.21,.18+f*.12);
    beam.xy=turn(-.6)*beam.xy;
    hit=machineUnion(hit,machineAssemblyLite(beam,vec3(.22,.075,.18),1.0));
    hit=machineUnion(hit,vec2(machineBox(beam-vec3(0,0,-.19),vec3(.2,.018,.018)),1));
  }
  vec3 panel=vec3(mod(xy+.11,.22)-.11,p.z-.55);
  hit=machineUnion(hit,machineAssemblyLite(panel,vec3(.095,.095,.055),1.0));
  vec3 conduit=vec3(xy.x-.6,xy.y,p.z-.22);
  hit=machineUnion(hit,vec2(length(conduit.xz)-.022,1));
  vec2 folded=machinePolar(p.xy,16.0,u_motion.x*.12);
  hit=machineUnion(hit,vec2(machineBox(vec3(folded-vec2(.22,0),p.z+.03),vec3(.025,.012,.025)),1));
  return hit;
}
vec2 industrialRotorDistance(vec3 p) {
  vec3 q=p;
  q.xy=turn(.32)*q.xy;
  vec3 fan=q-vec3(-.48,.2,-.08);
  float angle=u_motion.x*.55+u_motion.z*.25;
  vec2 blade=machinePolar(fan.xy,3.0,angle);
  vec3 vane=vec3(blade-vec2(.48,0),fan.z);
  vane.xy=turn(-.25)*vane.xy;
  vec2 hit=machineAssembly(vane,vec3(.38,.085,.08),2.0);
  hit=machineUnion(hit,vec2(machineBox(vane-vec3(0,.072,-.085),vec3(.35,.012,.012)),2));
  hit=machineUnion(hit,vec2(machineRing(fan,.13,.045),2));
  hit=machineUnion(hit,vec2(length(fan)-.11,0));
  hit=machineUnion(hit,vec2(machineRing(fan-vec3(0,0,.13),.88,.055),0));
  vec2 cog=machinePolar(fan.xy,40.0,-angle*.23);
  hit=machineUnion(hit,vec2(machineBox(vec3(cog-vec2(.82,0),fan.z-.1),vec3(.055,.019,.04)),0));
  vec2 bolts=machinePolar(fan.xy,12.0,0.0);
  hit=machineUnion(hit,vec2(length(vec3(bolts-vec2(.92,0),fan.z-.08))-.025,2));
  // Vertical pipes, collars and orange vents fill the machinery behind the rotor.
  vec3 pipe=q;
  pipe.x=mod(pipe.x+.16,.32)-.16;
  pipe.z-=.48;
  float cylinder=length(pipe.xz)-.065;
  hit=machineUnion(hit,vec2(cylinder,0));
  vec3 collar=pipe; collar.y=mod(q.y+u_motion.z*.025,.24)-.12;
  hit=machineUnion(hit,vec2(length(vec2(length(collar.xz)-.085,collar.y))-.018,1));
  vec3 vent=vec3(q.x-.8,mod(q.y,.16)-.08,q.z-.24);
  hit=machineUnion(hit,vec2(machineBox(vent,vec3(.07,.035,.03)),2));
  vec3 chassis=vec3(mod(q.xy+.2,.4)-.2,q.z-.76);
  hit=machineUnion(hit,machineAssembly(chassis,vec3(.18,.18,.08),2.0));
  return hit;
}
vec2 neonEngineDistance(vec3 p) {
  vec3 q=vec3(abs(p.xy),p.z);
  q.xy-=vec2(.57,.56);
  q.xy=turn(-.65)*q.xy;
  float compression=stagePressure()*.08;
  q.y*=1.0+compression;
  float cylinder=max(length(q.xz)-.17,abs(q.y)-.31);
  vec2 hit=vec2(cylinder,0);
  hit=machineUnion(hit,vec2(length(q-vec3(0,.31,0))-.18,1));
  hit=machineUnion(hit,vec2(length(q-vec3(0,-.31,0))-.18,3));
  for(int i=0;i<9;i++) {
    float f=float(i), y=(f-4.0)*.065;
    vec3 collar=q-vec3(0,y,0);
    float ring=length(vec2(length(collar.xz)-.19,collar.y))-.025;
    hit=machineUnion(hit,vec2(ring,mod(f,2.0)<.5 ? 0.0 : 3.0));
  }
  vec3 cage=q;
  cage.xz=machinePolar(cage.xz,8.0,u_motion.y*.13);
  hit=machineUnion(hit,vec2(max(length(cage.xz-vec2(.235,0))-.018,abs(cage.y)-.34),0));
  vec3 terminal=q; terminal.y=abs(terminal.y)-.43;
  hit=machineUnion(hit,vec2(length(terminal)-.09,2));
  vec3 cross=p; cross.xy=turn(PI*.25)*cross.xy;
  float xBody=min(machineBox(cross,vec3(.49,.035,.035)),machineBox(cross,vec3(.035,.49,.035)));
  hit=machineUnion(hit,vec2(xBody,1));
  vec3 backing=vec3(abs(p.xy),p.z);
  backing.xy=turn(PI*.25)*backing.xy;
  backing.y=abs(backing.y)-.92;
  hit=machineUnion(hit,vec2(machineBox(backing-vec3(0,0,.3),vec3(1.7,.075,.08)),3));
  vec3 plate=vec3(mod(p.xy+.18,.36)-.18,p.z-.62);
  hit=machineUnion(hit,machineAssembly(plate,vec3(.16,.16,.06),3.0));
  return hit;
}
vec2 octagonMachineDistance(vec3 p) {
  vec2 hit=vec2(10,0);
  // Stacked octagonal ribs with alternating depth and emissive trims.
  for(int i=0;i<7;i++) {
    float f=float(i), radius=.25+f*.28;
    if(f>4.0+u_settings.y*2.0) break;
    vec2 folded=machinePolar(p.xy,8.0,u_motion.x*.045*(mod(f,2.0)*2.0-1.0));
    vec3 q=vec3(folded.x-radius,folded.y,p.z-f*.19);
    hit=machineUnion(hit,vec2(machineBox(q,vec3(.075,radius*.42,.12)),0));
    hit=machineUnion(hit,vec2(machineBox(q-vec3(-.065,0,-.13),vec3(.012,radius*.42,.012)),mod(f,2.0)<.5 ? 1.0 : 2.0));
    vec3 tile=q; tile.y=mod(tile.y+.055,.11)-.055;
    hit=machineUnion(hit,machineAssembly(tile-vec3(0,0,-.13),vec3(.065,.045,.045+stagePressure()*.045),mod(f,2.0)<.5 ? 1.0 : 2.0));
    vec3 strut=q-vec3(.13,0,.04);
    strut.y=mod(strut.y+.055,.11)-.055;
    strut.xy=turn(.55)*strut.xy;
    hit=machineUnion(hit,vec2(machineBox(strut,vec3(.08,.012,.025)),2));
  }
  return hit;
}
vec2 referenceMachineDistance(vec3 p) { return vec2(10,0); }
vec3 referenceMachineRender(vec2 p, float style) {
  vec2 screen=p;
  screen*=turn(sin(u_motion.y*.08)*.035);
  vec3 ro=vec3(sin(u_motion.z*.07)*.09,cos(u_motion.y*.09)*.07,-3.5-max(0.0,u_kick.x)*.09);
  vec3 rd=normalize(vec3(screen,2.15));
  vec3 point=ro; vec2 surface=vec2(1,0);
  float t=0.0;
  for(int i=0;i<72;i++) {
    point=ro+rd*t;
    surface=referenceMachineDistance(point);
    if(surface.x<.0025 || t>8.0) break;
    t+=max(.0015,surface.x*.65);
  }
  vec3 cyan=vec3(.015,.55,1), hot=style>2.5 ? vec3(1,.01,.35) : vec3(1,.23,.012);
  cyan=mix(cyan,u_c2,.18); hot=mix(hot,u_c1,.18);
  if(t>8.0 || surface.x>.015) {
    float glow=exp(-length(p)*2.5);
    return mix(cyan,hot,.5+.5*sin(p.x*3.0))*glow*.025;
  }
  vec2 e=vec2(.003,0);
  vec3 n=normalize(vec3(referenceMachineDistance(point+e.xyy).x-referenceMachineDistance(point-e.xyy).x,
    referenceMachineDistance(point+e.yxy).x-referenceMachineDistance(point-e.yxy).x,
    referenceMachineDistance(point+e.yyx).x-referenceMachineDistance(point-e.yyx).x)+vec3(.00001));
  vec3 light=normalize(vec3(-.4,.65,-1));
  float diffuse=max(0.0,dot(n,light));
  float specular=pow(max(0.0,dot(reflect(-light,n),-rd)),35.0);
  vec3 reflected=reflect(rd,n);
  float stripe=pow(.5+.5*sin(reflected.y*12.0+reflected.x*5.0),18.0);
  float fresnel=pow(1.0-max(0.0,dot(n,-rd)),3.0);
  float occlusion=clamp(referenceMachineDistance(point+n*.09).x/.09,.2,1.0);
  vec3 metal=mix(vec3(.035,.045,.09),cyan,.18)*( .2+diffuse*.9);
  metal+=(cyan*stripe*.55+hot*pow(.5+.5*sin(reflected.x*9.0-reflected.z*5.0),22.0)*.35);
  metal+=vec3(specular*.65)+cyan*fresnel*.22;
  vec3 weights=pow(abs(n),vec3(8.0)); weights/=max(.001,weights.x+weights.y+weights.z);
  vec2 uv=point.yz*weights.x+point.xz*weights.y+point.xy*weights.z;
  vec2 panelUV=fract(uv*18.0)-.5;
  float seam=exp(-min(abs(panelUV.x),abs(panelUV.y))*120.0);
  float machining=.8+.2*sin((uv.x+uv.y)*550.0);
  metal*=mix(1.0,machining*(1.0-seam*.38),u_settings.y);
  float indicator=exp(-abs(panelUV.y-.28)*100.0)*step(abs(panelUV.x),.2);
  float chase=.3+.7*pow(.5+.5*sin(floor(uv.y*18.0)+u_motion.z*1.8),5.0);
  metal+=cyan*indicator*chase*u_settings.y*.24;
  if(style<1.5 && surface.y<.5) {
    float grille=pow(.5+.5*cos(uv.x*240.0),18.0);
    float inset=(1.0-smoothstep(.27,.35,abs(panelUV.y)))*(1.0-smoothstep(.3,.38,abs(panelUV.x)));
    vec2 corner=abs(panelUV)-vec2(.38);
    float bolt=exp(-dot(corner,corner)*1100.0);
    metal*=1.0-inset*grille*.4*u_settings.y;
    metal+=vec3(.55,.65,.8)*bolt*(.12+diffuse*.25)*u_settings.y;
  }
  vec3 emission=surface.y<1.5 ? cyan : surface.y<2.5 ? hot : vec3(.65,.015,1);
  if(style<.5) emission=mix(emission,vec3(1,.5,.02),step(1.5,surface.y)*.3);
  if(surface.y>.5) metal=emission*(.65+stagePressure()*.3)+vec3(specular*.3);
  return metal*occlusion*exp(-t*.035);
}
vec3 kaleidoMachinery(vec2 p) { return referenceMachineRender(p,0.0); }
vec3 cyanCitadel(vec2 p) { return referenceMachineRender(p,1.0); }
vec3 industrialRotor(vec2 p) { return referenceMachineRender(p,2.0); }
vec3 neonEngines(vec2 p) { return referenceMachineRender(p,3.0); }
vec3 octagonMachinery(vec2 p) { return referenceMachineRender(p,4.0); }
`
