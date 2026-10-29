// Twenty original experiments. Each scene is compiled separately by the preloader.
export const festivalScenes = `
vec3 supernova(vec2 p) {
  float age=min(u_kick.z,3.0), r=length(p), a=atan(p.y,p.x);
  float front=.18+age*2.5;
  vec3 col=ink(r-front,.014,u_c2)*exp(-age*1.5);
  for(int i=0;i<48;i++) {
    float f=float(i), theta=f*2.399+u_motion.x*.2;
    float seed=hash(vec2(f,3));
    vec2 dir=vec2(cos(theta),sin(theta));
    float distance=.15+age*(.3+seed*2.0);
    col+=ink(segment(p,dir*distance,dir*(distance-.08-age*.1)),.003+seed*.004,tint(f*.4))*exp(-age*2.0);
  }
  col+=tint(a*2.0)*pow(max(0.0,sin(a*24.0+u_motion.y)),14.0)*exp(-r*4.0)*(.15+u_impact);
  return col;
}
vec3 thunderstorm(vec2 p) {
  vec3 col=vec3(0);
  for(int bolt=0;bolt<4;bolt++) {
    float f=float(bolt), x=(f-1.5)*.65;
    for(int j=0;j<14;j++) {
      float k=float(j), y=1.4-k*.2;
      float shake=.12+.12*stagePressure();
      vec2 a=vec2(x+sin(k*4.2+u_motion.y*2.0+f)*shake,y);
      vec2 b=vec2(x+sin((k+1.0)*4.2+u_motion.y*2.0+f)*shake,y-.2);
      col+=ink(segment(p,a,b),.003,tint(f))*(.12+u_impact*.7);
      if(mod(k,3.0)<.5) col+=ink(segment(p,a,a+vec2(sin(k+f)*.3,-.18)),.002,u_c3)*(.1+u_audio.z);
    }
  }
  return col;
}
vec3 electricOcean(vec2 p) {
  vec3 col=vec3(0);
  for(int i=0;i<20;i++) {
    float f=float(i), z=mod(f*.6-u_motion.z*.35,12.0)-1.5;
    for(int j=0;j<12;j++) {
      float x=(float(j)-6.0)*.4, next=x+.4;
      float y=sin(x*2.0+z-u_motion.y)*(.15+stagePressure()*.4);
      float y2=sin(next*2.0+z-u_motion.y)*(.15+stagePressure()*.4);
      vec3 a=vec3(x,y-.45,z),b=vec3(next,y2-.45,z);
      col+=stroke3(p,a,b,tint(f*.3),.014)*smoothstep(-1.5,-1.0,z);
    }
  }
  col+=u_c3*exp(-abs(p.y-.12)*30.0)*.12;
  return col;
}
vec3 neonDunes(vec2 p) {
  vec2 q=p*turn(u_motion.x*.12);
  q.y+=u_motion.z*.1;
  float height=sin(q.x*2.2+sin(q.y*2.0+u_motion.y*.3))*.4;
  height+=field(q*2.0+u_motion.y*.07)*.6;
  float bands=abs(fract((q.y+height)*12.0)-.5);
  float lighting=.35+.65*max(0.0,cos(q.x*2.2+q.y));
  return ink(bands,.025,tint(height*5.0))*lighting+u_c1*lighting*.025;
}
vec3 kineticRibbons(vec2 p) {
  vec3 col=vec3(0);
  for(int ribbon=0;ribbon<5;ribbon++) {
    float f=float(ribbon);
    for(int j=0;j<24;j++) {
      float a=float(j)*.17-2.0,b=a+.17;
      vec3 va=vec3(a,sin(a*2.0+f+u_motion.y)*(.4+stagePressure()*.3),cos(a+f+u_motion.y*.3));
      vec3 vb=vec3(b,sin(b*2.0+f+u_motion.y)*(.4+stagePressure()*.3),cos(b+f+u_motion.y*.3));
      va=spin3(va,vec2(u_motion.x*.2,f*.13)); vb=spin3(vb,vec2(u_motion.x*.2,f*.13));
      col+=stroke3(p,va,vb,tint(f*1.1+a*.3),.035);
    }
  }
  return col;
}
vec3 jellyfish(vec2 p) {
  p*=turn(sin(u_motion.x*.12)*.18);
  float breath=1.0+stagePressure()*.25;
  vec2 cap=(p-vec2(0,.35))/vec2(.6*breath,.4);
  float shell=length(cap)-1.0;
  vec3 col=ink(shell,.018,u_c1)*smoothstep(-.2,.0,p.y);
  col+=u_c2*exp(-dot(cap,cap)*2.0)*.14;
  for(int i=0;i<13;i++) {
    float f=float(i), root=(f-6.0)*.075;
    for(int j=0;j<10;j++) {
      float t=float(j)*.13, t2=t+.13;
      vec2 a=vec2(root+sin(t*5.0+f*.6+u_motion.y)*t*.12,.08-t);
      vec2 b=vec2(root+sin(t2*5.0+f*.6+u_motion.y)*t2*.12,.08-t2);
      col+=ink(segment(p,a,b),.003,tint(f*.35))*(1.0-t*.45);
    }
  }
  return col;
}
vec3 mechanicalSwarm(vec2 p) {
  vec3 col=vec3(0); float nearest=10000.0;
  for(int i=0;i<18;i++) {
    float f=float(i), a=f*2.399+u_motion.x*.3;
    float radius=.75+hash(vec2(f,9))*.9+stagePressure()*.3;
    vec3 center=spin3(vec3(cos(a)*radius,sin(a)*radius,sin(a*1.3)*1.2),vec2(u_motion.y*.18,.25));
    vec4 hit=cubeHit(p,center,vec3(.12+.05*sin(f+u_motion.y)),vec2(u_motion.y*.4+f,a),tint(f*.5));
    if(hit.w<nearest) { nearest=hit.w; col=hit.rgb; }
  }
  return col;
}
vec3 mobiusPoint(float a, float width) {
  return vec3((1.1+width*cos(a*.5))*cos(a),(1.1+width*cos(a*.5))*sin(a),width*sin(a*.5));
}
vec3 mobiusStrip(vec2 p) {
  vec3 col=vec3(0);
  for(int rail=0;rail<7;rail++) {
    float f=float(rail), w=(f-3.0)*.12*(1.0+stagePressure()*.6);
    for(int j=0;j<32;j++) {
      float a=float(j)*TAU/32.0,b=(float(j)+1.0)*TAU/32.0;
      vec3 va=spin3(mobiusPoint(a,w),vec2(u_motion.x*.25,u_motion.y*.2));
      vec3 vb=spin3(mobiusPoint(b,w),vec2(u_motion.x*.25,u_motion.y*.2));
      col+=stroke3(p,va,vb,tint(f*.7+a*.15),.012);
    }
  }
  return col;
}
vec3 speakerWall(vec2 p) {
  vec2 q=p*2.4, id=floor(q), uv=fract(q)-.5;
  float r=length(uv), bass=stagePressure();
  float cone=.3+bass*.055+u_kick.x*.025;
  float bevel=exp(-abs(r-cone)*60.0);
  float diaphragm=max(0.0,1.0-r/cone);
  vec3 c=tint(hash(id)*3.0);
  vec3 col=c*(bevel*.7+pow(diaphragm,2.0)*(.08+bass*.25));
  col+=ink(r-.095-bass*.025,.006,u_c2);
  float frame=max(abs(uv.x),abs(uv.y))-.46;
  col+=ink(frame,.005,u_c3)*.2;
  return col;
}
vec3 tectonicPlates(vec2 p) {
  vec2 q=p*3.0+vec2(u_motion.z*.07,0), cell=floor(q);
  float first=100.0, second=100.0, label=0.0;
  for(int x=-1;x<=1;x++) {
    for(int y=-1;y<=1;y++) {
      vec2 id=cell+vec2(float(x),float(y));
      vec2 center=id+.5+.3*vec2(sin(hash(id)*TAU+u_motion.y*.2),cos(hash(id+3.0)*TAU+u_motion.y*.2));
      float d=length(q-center);
      if(d<first) { second=first; first=d; label=hash(id); } else second=min(second,d);
    }
  }
  float fault=second-first;
  vec3 col=tint(label*5.0)*(.04+first*.035);
  col+=ink(fault,.012+u_impact*.025,u_c1)*(.4+u_impact);
  return col;
}
vec3 borealis(vec2 p) {
  vec3 col=vec3(0);
  for(int i=0;i<6;i++) {
    float f=float(i), y=p.y+.2+f*.1;
    float fold=sin(p.x*2.0+u_motion.y*.3+f)*.3+sin(p.x*5.0-u_motion.z*.2)*.08;
    float curtain=exp(-abs(y-fold)*10.0);
    float pleats=.3+.7*pow(.5+.5*sin(p.x*35.0+field(vec2(p.x*3.0,u_motion.y*.1))*9.0+f),3.0);
    col+=tint(f*.6+p.x*.4)*curtain*pleats*(.18+u_audio.y*.3);
  }
  return col;
}
vec3 spirograph3D(vec2 p) {
  vec3 col=vec3(0);
  for(int i=0;i<112;i++) {
    float a=float(i)*TAU/112.0,b=(float(i)+1.0)*TAU/112.0;
    float morph=.2+stagePressure()*.3;
    vec3 va=vec3(cos(a)+morph*cos(a*7.0+u_motion.y),sin(a)+morph*sin(a*7.0+u_motion.y),.5*sin(a*4.0));
    vec3 vb=vec3(cos(b)+morph*cos(b*7.0+u_motion.y),sin(b)+morph*sin(b*7.0+u_motion.y),.5*sin(b*4.0));
    col+=stroke3(p,spin3(va,vec2(u_motion.x*.2,.5)),spin3(vb,vec2(u_motion.x*.2,.5)),tint(a),.012);
  }
  return col;
}
vec3 asteroidField(vec2 p) {
  vec3 ro=vec3(0,0,-4), rd=normalize(vec3(p,2.0)), col=vec3(0);
  float nearest=10000.0;
  for(int i=0;i<22;i++) {
    float f=float(i), z=mod(f*.7-u_motion.z*.8,15.4)-2.6;
    vec3 center=vec3((hash(vec2(f,1))-.5)*5.0,(hash(vec2(f,2))-.5)*3.0,z);
    float radius=.1+hash(vec2(f,3))*.25;
    vec3 delta=ro-center;
    float b=dot(delta,rd), d=b*b-dot(delta,delta)+radius*radius;
    if(d>0.0) {
      float t=-b-sqrt(d);
      if(t>0.0 && t<nearest) {
        nearest=t; vec3 n=normalize(ro+rd*t-center);
        float rough=.65+.35*sin(n.x*18.0+f)*sin(n.y*16.0);
        col=tint(f*.4)*rough*(.1+.8*max(0.0,dot(n,normalize(vec3(-.4,.7,-1.0)))))*exp(-t*.07);
      }
    }
  }
  return col;
}
vec3 fireworks(vec2 p) {
  vec3 col=vec3(0);
  float age=min(u_kick.z,4.0);
  for(int burst=0;burst<3;burst++) {
    float f=float(burst);
    vec2 origin=vec2((f-1.0)*.65,.15+.2*sin(f+floor(u_motion.y)));
    for(int i=0;i<24;i++) {
      float k=float(i), a=k*TAU/24.0, speed=.4+hash(vec2(k,f))*.6;
      vec2 velocity=vec2(cos(a),sin(a))*speed;
      vec2 point=origin+velocity*age-vec2(0,age*age*.22);
      vec2 tail=point-velocity*.06+vec2(0,age*.025);
      col+=ink(segment(p,point,tail),.004,tint(f*2.0+k*.05))*exp(-age*1.3);
    }
    col+=u_c3*exp(-dot(p-origin,p-origin)*55.0)*exp(-age*12.0);
  }
  return col;
}
vec3 lightfall(vec2 p) {
  vec3 col=vec3(0);
  for(int i=0;i<55;i++) {
    float f=float(i), seed=hash(vec2(f,7));
    float y=1.5-mod(u_motion.z*(.4+seed)+f*.31,3.0);
    vec3 point=vec3((hash(vec2(f,2))-.5)*4.0,y,(seed-.5)*3.0);
    point.x+=sin(u_motion.y*.3+point.z)*.25;
    col+=stroke3(p,point,point+vec3(0,.08+u_impact*.12,0),tint(seed*6.0),.012);
  }
  return col;
}
float lavaPotential(vec2 p) {
  float sum=0.0;
  for(int i=0;i<6;i++) {
    float f=float(i);
    vec2 center=vec2(sin(f*2.1+u_motion.y*.3)*.7,cos(f*1.7+u_motion.z*.25)*.7);
    sum+=(.06+stagePressure()*.018)/(dot(p-center,p-center)+.03);
  }
  return sum;
}
vec3 lavaLamp(vec2 p) {
  float v=lavaPotential(p), mask=smoothstep(.8,1.0,v);
  vec2 gradient=vec2(lavaPotential(p+vec2(.01,0))-v,lavaPotential(p+vec2(0,.01))-v);
  vec3 n=normalize(vec3(-gradient*20.0,1));
  float light=max(0.0,dot(n,normalize(vec3(-.5,.7,1))));
  vec3 col=tint(v*.6)*mask*(.12+light*.6);
  col+=ink(v-1.0,.04,u_c2)*.5;
  return col;
}
vec3 opticalVortex(vec2 p) {
  p*=turn(u_motion.x*.2);
  float r=length(p), a=atan(p.y,p.x);
  float twist=a*9.0+r*(12.0+stagePressure()*4.0)-u_motion.z*2.0;
  float stripe=.5+.5*sin(twist+sin(r*6.0-u_motion.y));
  vec3 col=mix(u_c1*.08,u_c2,smoothstep(.4,.6,stripe));
  col*=.35+.65*exp(-r*.7);
  col+=ink(stripe-.5,.02,u_c3)*.2;
  return col;
}
vec3 luminousWeave(vec2 p) {
  vec2 q=p*turn(u_motion.x*.1)*6.0;
  q+=vec2(sin(q.y*.5+u_motion.y)*.2,cos(q.x*.5-u_motion.y)*.2);
  vec2 cell=floor(q), uv=fract(q)-.5;
  float parity=mod(cell.x+cell.y,2.0);
  float horizontal=exp(-uv.y*uv.y*150.0),vertical=exp(-uv.x*uv.x*150.0);
  vec3 over=parity<.5 ? u_c1*horizontal : u_c2*vertical;
  vec3 under=parity<.5 ? u_c2*vertical*(1.0-horizontal*.9) : u_c1*horizontal*(1.0-vertical*.9);
  float pulse=.6+.4*sin(q.x*.7+q.y*.6-u_motion.z*2.0);
  return (over+under)*pulse+u_c3*horizontal*vertical*u_impact*.15;
}
vec3 compressionChamber(vec2 p) {
  vec3 col=vec3(0); float nearest=10000.0;
  float pressure=stagePressure(), gap=1.2-pressure*.45;
  for(int i=0;i<12;i++) {
    float f=float(i), side=mod(f,4.0), z=floor(f/4.0)*1.2-.5;
    vec3 center=side<.5 ? vec3(-gap,0,z) : side<1.5 ? vec3(gap,0,z) : side<2.5 ? vec3(0,-gap,z) : vec3(0,gap,z);
    vec3 size=side<1.5 ? vec3(.18,.7,.35) : vec3(.7,.18,.35);
    vec4 hit=cubeHit(p,center,size,vec2(0),tint(f*.6));
    if(hit.w<nearest) { nearest=hit.w; col=hit.rgb; }
  }
  col+=u_c3*exp(-dot(p,p)*15.0)*pressure*.4;
  return col;
}
vec3 cosmicNebula(vec2 p) {
  vec3 col=vec3(0);
  vec2 q=p*turn(u_motion.x*.08);
  float transmittance=1.0;
  for(int i=0;i<12;i++) {
    float f=float(i), z=f*.15+u_motion.z*.05;
    vec2 samplePoint=q*(1.0+f*.07)+vec2(sin(z+u_motion.y*.2),cos(z*.7))*.4;
    float density=smoothstep(.42,.8,field(samplePoint*2.5+f*.3));
    float alpha=density*.22;
    col+=tint(f*.45+density*3.0)*alpha*transmittance;
    transmittance*=1.0-alpha;
  }
  col+=u_c3*exp(-dot(p,p)*7.0)*(.08+u_impact*.15);
  return col;
}
`
