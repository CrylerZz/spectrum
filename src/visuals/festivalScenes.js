// Twenty original experiments. Each scene is compiled separately by the preloader.
export const festivalScenes = `

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
      if(mod(k,3.0)<.5) col+=u_settings.y*ink(segment(p,a,a+vec2(sin(k+f)*.3,-.18)),.002,u_c3)*(.1+u_audio.z);
    }
  }
  return col;
}

vec3 neonDunes(vec2 p) {
  vec2 q=p*turn(u_motion.x*.12);
  q.y+=u_motion.z*.1;
  float height=sin(q.x*2.2+sin(q.y*2.0+u_motion.y*.3))*.4;
  height+=field(q*2.0+u_motion.y*.07)*.6;
  float bands=abs(fract((q.y+height)*(5.0+u_settings.y*10.0))-.5);
  float lighting=.35+.65*max(0.0,cos(q.x*2.2+q.y));
  return ink(bands,.025,tint(height*5.0))*lighting+u_c1*lighting*.025;
}

vec3 tectonicPlates(vec2 p) {
  vec2 q=p*(1.8+u_settings.y*1.7)+vec2(u_motion.z*.07,0), cell=floor(q);
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
    float curtain=exp(-abs(y-fold)*(14.0-u_settings.z*6.0));
    float pleats=.3+.7*pow(.5+.5*sin(p.x*(14.0+u_settings.y*30.0)+field(vec2(p.x*3.0,u_motion.y*.1))*9.0+f),3.0);
    col+=tint(f*.6+p.x*.4)*curtain*pleats*detailLayer(f,6.0)*(.18+u_audio.y*.3);
  }
  return col;
}

float lavaPotential(vec2 p) {
  float sum=0.0;
  for(int i=0;i<6;i++) {
    float f=float(i);
    vec2 center=vec2(sin(f*2.1+u_motion.y*.3)*.7,cos(f*1.7+u_motion.z*.25)*.7);
    sum+=detailLayer(f,6.0)*(.06+stagePressure()*.018)/(dot(p-center,p-center)+.03);
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

vec3 cosmicNebula(vec2 p) {
  vec3 col=vec3(0);
  vec2 q=p*turn(u_motion.x*.08);
  float transmittance=1.0;
  for(int i=0;i<12;i++) {
    float f=float(i), z=f*.15+u_motion.z*.05;
    vec2 samplePoint=q*(1.0+f*.07)+vec2(sin(z+u_motion.y*.2),cos(z*.7))*.4;
    float density=smoothstep(.42,.8,field(samplePoint*2.5+f*.3));
    float alpha=density*(.16+u_settings.z*.12)*detailLayer(f,12.0);
    col+=tint(f*.45+density*3.0)*alpha*transmittance;
    transmittance*=1.0-alpha;
  }
  col+=u_c3*exp(-dot(p,p)*7.0)*(.08+u_impact*.15);
  return col;
}
`
