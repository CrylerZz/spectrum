import { depthScenes } from './depthScenes'

// Original procedural compositions. Shared helpers are declared in shaders.js.
export const extraScenes = `
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 v=b-a;
  return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.00001),0.0,1.0));
}
${depthScenes}
vec3 overdrive(vec2 p) {
  vec2 aspect=u_resolution/min(u_resolution.x,u_resolution.y);
  vec3 col=vec3(0);
  // The original image is projected onto independently tilted depth planes.
  for(int i=0;i<5;i++) {
    float f=float(i), z=mod(f*1.1-u_motion.z*.25,5.5)-.7;
    vec3 normal=normalize(vec3(.3*sin(u_motion.y*.4+f),.4*cos(u_motion.y*.3+f),1.0));
    vec3 ray=normalize(vec3(p,2.0));
    float distance=(z+4.0)*normal.z/max(.15,dot(ray,normal));
    vec3 hit=vec3(0,0,-4)+ray*distance;
    float punch=max(0.0,u_kick.x)*.6+u_impact*.35;
    vec2 q=hit.xy*turn(u_motion.x*.15+f*.15)/(1.25+punch);

    vec2 uv=.5+.5*q/aspect;
    vec2 thickness=vec2(2.0+u_impact*3.0)/u_resolution;
    vec3 sampleColor=texture2D(u_orbital,clamp(uv,0.0,1.0)).rgb;
    sampleColor=max(sampleColor,texture2D(u_orbital,clamp(uv+vec2(thickness.x,0),0.0,1.0)).rgb);
    sampleColor=max(sampleColor,texture2D(u_orbital,clamp(uv-vec2(thickness.x,0),0.0,1.0)).rgb);
    sampleColor=max(sampleColor,texture2D(u_orbital,clamp(uv+vec2(0,thickness.y),0.0,1.0)).rgb);
    sampleColor=max(sampleColor,texture2D(u_orbital,clamp(uv-vec2(0,thickness.y),0.0,1.0)).rgb);
    float mask=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
    col+=sampleColor*mask*exp(-z*.25)*(.5+.25*cos(f))*smoothstep(-.7,-.3,z)*(1.0-smoothstep(4.2,4.8,z));
  }
  return col;
}

vec3 prism(vec2 p) {
  p *= turn(u_motion.x*.18);
  float a=atan(p.y,p.x), r=length(p);
  a=abs(mod(a+PI/6.0,PI/3.0)-PI/6.0);
  vec2 q=vec2(cos(a),sin(a))*r;
  vec3 col=vec3(0);
  for(int i=0;i<5;i++) {
    float f=float(i);
    q=abs(q*1.38-vec2(.43,.27));
    q*=turn(.3+sin(u_motion.y*.3+f)*.5);
    float d=min(abs(q.x-q.y*.65),abs(q.y-.12));
    col += ink(d,.004,tint(f+r*2.0))/(1.0+f*.5);
  }
  return col*(.65+.35*cos(r*8.0-u_motion.z));
}

vec3 gyro(vec2 p) {
  p*=turn(u_motion.x*.2);
  vec3 col=vec3(0);
  for(int i=0;i<9;i++) {
    float f=float(i);
    vec2 q=p*turn(f*.35+u_motion.y*.2);
    q.y/= .18+.75*abs(sin(f*.3+u_motion.y*.25));
    col+=ink(length(q)-(.4+f*.06),.006,tint(f*.7))*.7;
  }
  return col;
}

vec3 plasmaCyclone(vec2 p) {
  float r=length(p), a=atan(p.y,p.x);
  vec2 q=vec2(cos(a+r*2.5-u_motion.z*.4),sin(a+r*2.5-u_motion.z*.4))*r;
  q+=.13*vec2(sin(q.y*5.0+u_motion.y),cos(q.x*5.0-u_motion.y));
  return liquid(q)*( .7+.35*cos(r*7.0-u_motion.z));
}
vec3 plasmaFission(vec2 p) {
  vec2 q=p;
  q.x+=sin(p.y*6.0+u_motion.y)*(.13+u_impact*.1);
  q.y+=sin(p.x*5.0-u_motion.y*.7)*.15;
  float seam=sin(q.x*9.0+field(q*3.0)*7.0-u_motion.z);
  return liquid(q*1.3)*(.3+.7*pow(abs(seam),.4))+ink(seam,.025,u_c3)*(.3+u_impact*.5);
}
vec3 prismAbyss(vec2 p) {
  // Bounded coordinates keep the folded geometry in view at every depth.
  vec3 col=vec3(0);
  for(int i=0;i<4;i++) {
    float f=float(i), z=fract(f*.25+u_motion.z*.08);
    vec2 q=p*mix(.65,1.8,z)*turn(u_motion.x*.12+f*.16);
    q+=.12*vec2(sin(u_motion.y*.3+f),cos(u_motion.y*.23+f));
    float fade=.35+.65*sin(z*PI);
    col+=prism(q)*fade/(1.5+f*.6);
  }
  return col;
}

vec3 prismFracture(vec2 p) {
  // A single kaleidoscope splits along radial fault lines and then closes again.
  float angle=atan(p.y,p.x), radius=length(p);
  float slice=TAU/7.0, sector=floor((angle+PI)/slice);
  float center=-PI+(sector+.5)*slice;
  vec2 axis=vec2(cos(center),sin(center));
  float rupture=.07+.2*(.5+.5*sin(u_motion.y*.5))+u_impact*.14;
  vec2 q=p-axis*rupture;
  q*=turn(sin(sector*2.1)*rupture*.75);
  vec3 col=prism(q);
  float seam=abs(sin((angle+PI)*3.5))*radius;
  col*=smoothstep(.006,.03+rupture*.05,seam);
  col+=ink(seam,.004,u_c3)*smoothstep(.12,.4,radius)*(.3+u_impact*.5);
  return col;
}

`
