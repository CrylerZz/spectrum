export const referenceFlowScenes = `
vec3 referenceSpectrum(vec2 p, float shift) {
  vec3 cyan=vec3(.015,.65,1), pink=vec3(.95,.025,.38), gold=vec3(1,.65,.035);
  vec3 c=mix(cyan,pink,smoothstep(-1.0,.9,p.x-p.y*.7+sin(shift)*.4));
  c=mix(c,gold,smoothstep(.2,1.8,p.x+p.y));
  return mix(c,tint(shift+p.x*.6+p.y*.4),.2);
}
vec2 referenceFlow(vec2 p, float phase, float amount) {
  vec2 q=p;
  for(int i=0;i<4;i++) {
    float f=float(i), scale=1.3+f*.65;
    vec2 warp=vec2(sin(q.y*scale+phase*.31+f*1.7),cos(q.x*scale-phase*.23+f));
    q+=warp*amount/(1.0+f*.7);
    q=turn(.23)*q;
  }
  return q;
}
vec3 moireSilk(vec2 p) {
  float phase=u_motion.y*.35, bass=stagePressure();
  vec3 col=vec3(.002,.004,.025);
  for(int i=0;i<3;i++) {
    float layer=float(i);
    vec2 q=referenceFlow(p*(1.0+layer*.15),phase+layer*.5,.32+bass*.12);
    float height=q.x+sin(q.y*2.4+phase)*.28+sin(q.x*2.0-q.y*1.6)*.18;
    float spacing=95.0+layer*13.0;
    float lines=pow(.5+.5*cos(height*spacing),16.0);
    float dots=.35+.65*pow(.5+.5*cos(q.y*180.0+layer),3.0);
    float fold=pow(.5+.5*sin(height*5.0+q.y*3.0),9.0);
    vec3 c=referenceSpectrum(p,phase+layer*.6);
    col+=c*(lines*dots*.24+fold*.085)/(1.0+layer*.45);
    col+=mix(c,vec3(1),.4)*lines*fold*.15;
  }
  return col;
}
vec3 contourCurrents(vec2 p) {
  float phase=u_motion.y*.28;
  vec2 q=referenceFlow(p,phase,.66+stagePressure()*.14);
  float potential=sin(q.x*1.7)+sin(q.y*1.9)+.45*sin(q.x*2.3+q.y*1.4+phase*.3);
  float contour=pow(.5+.5*cos(potential*68.0),22.0);
  float groups=.25+.75*pow(.5+.5*sin(potential*9.0),2.0);
  vec3 c=referenceSpectrum(p,phase*.5);
  return vec3(.002,.001,.022)+c*contour*groups*.7+c*exp(-abs(sin(potential*9.0))*18.0)*.035;
}
vec3 acidDrapes(vec2 p) {
  float phase=u_motion.y*.3;
  vec2 q=referenceFlow(p*1.15,phase,.85+stagePressure()*.2);
  q.x+=sin(q.y*2.2+phase)*.45;
  float potential=q.x+sin(q.y*1.9)*.6+sin(q.x*1.7-q.y*.6)*.4;
  float bands=.5+.5*sin(potential*22.0);
  float mask=smoothstep(.34,.4,bands)*(1.0-smoothstep(.9,.96,bands));
  vec3 c=referenceSpectrum(p,phase);
  c=mix(c,vec3(.6,.015,.9),.5+.5*sin(potential*7.0+phase));
  float sheen=.45+.55*pow(max(0.0,sin(potential*22.0+.7)),2.0);
  return c*mask*sheen*1.2;
}
vec3 neonGalaxies(vec2 p) {
  float time=u_motion.z*.75+u_motion.y*.35;
  float bass=stagePressure(), kick=clamp(u_kick.x,-.5,1.0);
  vec2 drift=vec2(sin(time*.19),cos(time*.23))*.055;
  p-=drift;
  float r=max(length(p),.025), angle=atan(p.y,p.x);
  float depth=-log(r)*1.45+u_motion.z*.4;
  float sector=angle/TAU*8.0+u_motion.x*.14+sin(depth*.7+time*.3)*.18;
  vec2 cell=vec2(sector,depth), base=floor(cell);
  vec3 col=vec3(0);
  // Overlapping neighbours let galaxies drift across cell borders without clipping.
  for(int row=-1;row<=1;row++) {
    for(int column=-1;column<=1;column++) {
      vec2 id=base+vec2(float(column),float(row));
      float seed=hash(vec2(mod(id.x,8.0),id.y));
      float phase=time*(.45+seed*.6)+seed*TAU;
      vec2 orbit=vec2(cos(phase),sin(phase*.83))*(.09+bass*.04);
      vec2 uv=cell-id-.5-orbit;
      uv=turn(phase*.5+kick*.2)*uv;
      uv/=vec2(.74+.12*sin(phase*.7),.9+.16*cos(phase*.6));
      uv/=1.0+kick*.16+.08*sin(phase*1.2);
      float radius=length(uv), a=atan(uv.y,uv.x);
      float envelope=1.0-smoothstep(.3,.58,radius);
      float twist=25.0+5.0*sin(phase*.55)+bass*5.0;
      float spin=a*3.0-radius*twist-phase*2.4;
      spin+=sin(a*5.0+radius*12.0-phase)*(.4+bass*.4);
      float arms=pow(.5+.5*sin(spin),9.0);
      float threads=pow(.5+.5*sin(spin*5.0+radius*37.0-phase),16.0);
      vec3 c=mix(vec3(.015,.65,1),vec3(1,.015,.48),.5+.5*sin(a+phase*.3+seed*6.0));
      c=mix(c,tint(seed*6.0),.18);
      float power=(arms*.5+threads*.55)*envelope;
      col+=c*power+vec3(.7,.9,1)*pow(power,3.0)*.3;
      col+=c*exp(-radius*radius*180.0)*(.25+bass*.4);
    }
  }
  return col*smoothstep(.015,.07,r);
}
vec3 spectralRosette(vec2 p) {
  p*=turn(u_motion.x*.12);
  float bass=stagePressure(), phase=u_motion.y*.5;
  vec3 col=vec3(0);
  // Three depth planes of interlocking polygonal lace, not just concentric outlines.
  for(int layer=0;layer<3;layer++) {
    float z=float(layer);
    vec2 q=turn((z-1.0)*phase*.12)*p*(1.0+z*.16);
    q.y/= .86+.1*cos(phase*.25+z);
    float r=length(q), a=atan(q.y,q.x);
    for(int i=0;i<12;i++) {
      float f=float(i), radius=.16+f*.063;
      float facets=8.0+mod(f,3.0)*4.0;
      float poly=cos(PI/facets)/cos(mod(a+PI/facets,TAU/facets)-PI/facets);
      float weave=sin(a*24.0+phase*(1.0-z*.3)+f)*(.012+bass*.018);
      float d=r-radius*poly-weave;
      vec3 c=f<2.0 ? mix(vec3(1,.04,.002),vec3(1,.65,.01),f) : mix(vec3(.015,.24,1),vec3(.9,.015,.55),.5+.5*sin(f*1.7+z));
      c=mix(c,tint(f+z),.12);
      float spoke=pow(.5+.5*cos(a*48.0+f*.8-phase*.25),20.0);
      col+=ink(d,.0013,c)*(.25/(1.0+z*.6));
      col+=c*exp(-abs(d)*42.0)*spoke*.14;
      float crossLace=abs(sin(a*32.0+f+phase)*sin((r-radius)*90.0-phase));
      col+=c*exp(-crossLace*100.0)*exp(-abs(d)*32.0)*.1;
      float gems=length(vec2(d,sin(a*24.0+f)*radius*.1));
      col+=ink(gems,.002,c)*.15;
    }
  }
  vec2 q=abs(p);
  q=referenceFlow(q,phase*.16,.22);
  float tracery=abs(sin(q.x*25.0+q.y*17.0)*sin(q.y*23.0-q.x*11.0));
  col+=referenceSpectrum(p,0.0)*exp(-tracery*150.0)*smoothstep(.65,1.1,length(p))*.23;
  return col;
}
vec3 liquidAbyss(vec2 p) {
  vec2 q=p;
  q.y+=.12;
  float r=max(length(q),.035), a=atan(q.y,q.x);
  float depth=1.0/r;
  vec2 surface=vec2(a*2.0,log(r)*2.0+u_motion.z*.3);
  vec2 flow=referenceFlow(surface,u_motion.y*.2,.5+stagePressure()*.12);
  float vein=sin(flow.x*6.0+sin(flow.y*3.0))*sin(flow.y*7.0+flow.x);
  float ribbons=pow(.5+.5*sin(flow.x*3.0-flow.y*2.0),12.0);
  float electric=exp(-abs(vein)*95.0);
  vec3 c=mix(vec3(.005,.4,1),vec3(.85,.005,.55),.5+.5*sin(a*2.0+flow.y*.4));
  c=mix(c,tint(flow.y),.17);
  float reflection=pow(.5+.5*sin(flow.x*11.0+flow.y*5.0),18.0);
  vec3 col=c*(electric*.5+ribbons*.3+reflection*ribbons*.7);
  col+=vec3(.4,.7,1)*electric*reflection*.3;
  col*=smoothstep(.12,.22,r)*(.35+.65*exp(-depth*.08));
  col+=ink(r-.16,.002,vec3(.09,.06,.7))*.4;
  // Stretch the same liquid field beneath the tunnel into a reflective floor.
  float floorMask=smoothstep(.22,.65,-p.y);
  vec2 floorUV=vec2(p.x/max(.15,-p.y+.1),1.0/max(.15,-p.y+.1)+u_motion.z*.2);
  float ripples=sin(floorUV.x*5.0+sin(floorUV.y*4.0+u_motion.y*.3));
  vec3 reflected=c*pow(.5+.5*ripples,18.0)*.3;
  col=mix(col,col*.45+reflected,floorMask);
  return col;
}
`
