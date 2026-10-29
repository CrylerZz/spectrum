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

vec3 reactor(vec2 p) {
  vec3 col=vec3(0); float nearest=10000.0;
  for(int i=0;i<8;i++) {
    float f=float(i), angle=f*TAU/8.0+u_motion.x*.3;
    float radius=1.1+u_kick.x*.3;
    vec3 center=vec3(cos(angle)*radius,sin(angle)*radius*.65,sin(angle)*.8);
    float bass=u_live.x>.5 ? min(1.0,u_impact*.6) : u_audio.x;
    float squeeze=1.0+bass*1.8+max(0.0,u_kick.x)*.35;
    vec3 size=vec3(.18/sqrt(squeeze),.32*squeeze,.3/sqrt(squeeze));
    vec4 hit=cubeHit(p,center,size,vec2(angle,u_motion.y*.2+bass*.35),tint(f*.7));
    if(hit.w<nearest) { nearest=hit.w; col=hit.rgb; }
  }
  for(int i=0;i<8;i++) {
    float f=float(i), angle=f*TAU/8.0+u_motion.x*.3;
    vec3 tip=vec3(cos(angle)*.95,sin(angle)*.62,sin(angle)*.8);
    vec3 bend=tip*.5+vec3(sin(u_motion.y*3.0+f)*.15,cos(u_motion.y*2.0+f)*.15,0);
    col+=stroke3(p,tip,bend,u_c2,.008)*(.25+u_impact);
    col+=stroke3(p,bend,vec3(0),u_c3,.012)*(.25+u_impact);
  }
  float r=length(p);
  col+=u_c3*exp(-r*r*90.0)*(.6+u_impact*2.0);
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
vec3 shockwave(vec2 p) {
  // Ray/rotating-plane intersection: the membrane covers the entire viewport.
  vec2 tilt=vec2(.25*sin(u_motion.x*.23),.35+.2*sin(u_motion.y*.2));
  vec3 ro=vec3(0,0,-4), rd=normalize(vec3(p,2.0));
  ro.yz=turn(-tilt.y)*ro.yz; ro.xz=turn(-tilt.x)*ro.xz;
  rd.yz=turn(-tilt.y)*rd.yz; rd.xz=turn(-tilt.x)*rd.xz;
  float distance=-ro.z/max(.08,rd.z);
  vec3 hit=ro+rd*distance;
  float wave=0.0;
  for(int i=0;i<4;i++) {
    float r=length(hit.xy), age=u_kick.z;
    wave=sin(r*7.0-age*16.0)*exp(-abs(r-age*3.5)*1.1)*exp(-age*.6)*.75;
    distance=(wave-ro.z)/max(.08,rd.z);
    hit=ro+rd*distance;
  }
  vec2 grid=abs(fract(hit.xy*2.8)-.5);
  float d=min(grid.x,grid.y);
  float crest=exp(-abs(length(hit.xy)-u_kick.z*3.5)*3.0)*exp(-u_kick.z*.6);
  vec3 col=ink(d,.016,tint(wave*2.0+length(hit.xy)*.3))*(.45+abs(wave));
  col+=u_c2*crest*.5;
  return col;
}

vec3 helixPoint(float a, float side, float morph) {
  float pulse=1.0+max(0.0,u_kick.x)*.18;
  vec3 coil=vec3(cos(a*3.0+side+u_motion.y)*.85,(a/TAU-.5)*4.6,sin(a*3.0+side+u_motion.y)*.85);
  vec3 knot=vec3((1.25+.5*cos(a*3.0+side))*cos(a*2.0),(1.25+.5*cos(a*3.0+side))*sin(a*2.0),.7*sin(a*3.0+side));
  return spin3(mix(coil,knot,morph)*pulse,vec2(u_motion.x*.35,.35+sin(u_motion.y*.25)*.3));
}
vec3 helix(vec2 p) {
  vec3 col=vec3(0);
  float morph=smoothstep(.12,.88,.5+.5*sin(u_motion.y*.6));
  // Broad, lit ribbons with inner rails, rather than a string of points.
  for(int i=0;i<64;i++) {
    float a=float(i)*TAU/64.0, b=(float(i)+1.0)*TAU/64.0;
    for(int strand=0;strand<2;strand++) {
      float side=float(strand)*PI;
      vec3 va=helixPoint(a,side,morph), vb=helixPoint(b,side,morph);
      float z=(va.z+vb.z)*.5+4.0;
      float d=segment(p,project3(va),project3(vb));
      float width=(.065+u_audio.y*.035)*2.0/max(.4,z);
      float face=exp(-d*d/(width*width));
      col+=tint(side+a*.3)*face*(.35+.55/max(1.0,z));
      col+=ink(d-width*.7,.003,u_c2)*.35;
      col+=ink(d,width*.18,u_c3)*.35;
    }
  }
  return col;
}

vec3 laserShow(vec2 p) {
  // Fixed, symmetric rig. Each group has one explicit frequency-band assignment.
  vec3 col=vec3(0);
  float low=u_live.x>.5 ? clamp(u_impact*.6+u_live.z*.3,0.0,1.0) : u_audio.x;
  float mid=u_live.x>.5 ? clamp(u_live.y+u_live.z*.5,0.0,1.0) : u_audio.y;
  float high=u_live.x>.5 ? max(u_kick.y,u_live.z*.5) : u_audio.z;
  float haze=.5+.5*field(p*3.0+vec2(u_motion.z*.05,0));
  // Shared sweeps keep each rig coherent even when mastered audio sustains a band.
  float bassSweep=sin(u_time*.8+u_motion.z*.35);
  float midSweep=sin(u_time*.65+u_motion.y*.4);
  float trebleSweep=sin(u_time*1.15+u_motion.z*.45);
  for(int sideIndex=0;sideIndex<2;sideIndex++) {
    float side=float(sideIndex)*2.0-1.0;
    vec2 base=vec2(side*.65,-.65);
    // Bass: paired heavy fans open together, with stronger thrust on actual kicks.
    for(int j=0;j<7;j++) {
      float spread=(float(j)-3.0)/3.0;
      float opening=.3+low*(.6+.25*cos(u_time*.7))+u_impact*.08;
      vec2 end=vec2(side*(.3+bassSweep*.55+spread*opening),1.7);
      float d=segment(p,base,end);
      col+=ink(d,.003+low*.002,u_c1)*low*(.45+u_impact*.35);
      col+=u_c1*exp(-d*25.0)*haze*low*.045;
    }
    // Mids: parallel sheets, mirrored rather than independent random scans.
    for(int j=0;j<4;j++) {
      float f=float(j);
      vec2 origin=vec2(side*1.4,-.3+f*.15);
      vec2 end=vec2(-side*1.1,.2+f*.15+mid*.35+midSweep*(.15+mid*.45));
      col+=ink(segment(p,origin,end),.0025,u_c2)*mid*.65;
    }
    // Treble: narrow overhead needles with a spectral gate, no clock-driven flicker.
    for(int j=0;j<5;j++) {
      float f=float(j), x=side*(.15+f*.24);
      vec2 origin=vec2(x,1.05), end=vec2(x*(1.0+high*.45)+side*trebleSweep*(.12+high*.45),-.7);
      float gate=u_live.x>.5 ? high : high*smoothstep(.12,.65,audio(.62+f*.07));
      col+=ink(segment(p,origin,end),.0015,u_c3)*gate*1.4;
    }
    col+=ink(length(p-base),.012,u_c1)*(.05+low);
  }
  return col;
}

vec3 singularity(vec2 p) {
  vec3 col=vec3(0);
  // A tilted accretion disk with front/back separation and a dark occluding core.
  float hole=.25+u_kick.x*.035;
  for(int i=0;i<72;i++) {
    float f=float(i), a=f*2.399+u_motion.z*(.5+mod(f,3.0)*.13);
    float radius=.6+hash(vec2(f,4))*.95;
    vec3 point=spin3(vec3(cos(a)*radius,sin(a)*radius,0),vec2(.1,.95+.12*sin(u_motion.y*.2)));
    vec3 tail=spin3(vec3(cos(a-.16)*radius,sin(a-.16)*radius,0),vec2(.1,.95+.12*sin(u_motion.y*.2)));
    vec3 trail=stroke3(p,point,tail,tint(radius*4.0+a*.12),.018);
    if(point.z>0.0) trail*=smoothstep(hole,hole+.02,length(p));
    col+=trail;
  }
  col+=ink(length(p)-hole,.009,u_c3)*(1.0+u_impact);
  // Polar jets make the silhouette extend beyond a flat disk.
  col+=ink(p.x+.025*sin(p.y*18.0-u_motion.z*4.0),.008,u_c2)*smoothstep(.28,.45,abs(p.y))*exp(-abs(p.y)*1.6)*(.3+u_impact);
  return col;
}







vec3 inferno(vec2 p) {
  vec3 col=vec3(0);
  for(int i=0;i<8;i++) {
    float f=float(i), x=(f-3.5)*.24;
    float height=1.1+u_impact*.5;
    float curl=sin(p.y*5.0-u_motion.z*3.0+f)*.11+sin(p.y*11.0-u_motion.y+f)*.04;
    float d=p.x-x-curl*(p.y+1.2);
    float fade=smoothstep(-1.2,-.8,p.y)*(1.0-smoothstep(.0,height,p.y));
    col+=ink(d,max(.003,.018+.012*(1.0-p.y)),tint(f*.7+p.y))*fade;
    col+=u_c3*exp(-abs(d)*12.0)*fade*.1;
  }
  return col;
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
