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
    float spacing=(40.0+u_settings.y*78.0+layer*13.0)*min(1.0,min(u_resolution.x,u_resolution.y)/650.0);
    float lines=pow(.5+.5*cos(height*spacing),16.0);
    float dots=.35+.65*pow(.5+.5*cos(q.y*(70.0+u_settings.y*155.0)+layer),3.0);
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
  float contour=pow(.5+.5*cos(potential*(25.0+u_settings.y*60.0)),22.0);
  float groups=.25+.75*pow(.5+.5*sin(potential*9.0),2.0);
  vec3 c=referenceSpectrum(p,phase*.5);
  return vec3(.002,.001,.022)+c*contour*groups*.7+c*exp(-abs(sin(potential*9.0))*18.0)*.035;
}
vec3 acidDrapes(vec2 p) {
  float phase=u_motion.y*.3;
  vec2 q=referenceFlow(p*1.15,phase,.85+stagePressure()*.2);
  q.x+=sin(q.y*2.2+phase)*.45;
  float potential=q.x+sin(q.y*1.9)*.6+sin(q.x*1.7-q.y*.6)*.4;
  float bands=.5+.5*sin(potential*(10.0+u_settings.y*17.0));
  float mask=smoothstep(.34,.4,bands)*(1.0-smoothstep(.9,.96,bands));
  vec3 c=referenceSpectrum(p,phase);
  c=mix(c,vec3(.6,.015,.9),.5+.5*sin(potential*7.0+phase));
  float sheen=.45+.55*pow(max(0.0,sin(potential*(10.0+u_settings.y*17.0)+.7)),2.0);
  return c*mask*sheen*1.2;
}

vec3 liquidAbyss(vec2 p) {
  vec2 q=p;
  q.y+=.12;
  float r=max(length(q),.035), a=atan(q.y,q.x);
  float depth=1.0/r;
  vec2 surface=vec2(a*2.0,log(r)*2.0+u_motion.z*.3);
  vec2 flow=referenceFlow(surface,u_motion.y*.2,.5+stagePressure()*.12);
  float vein=sin(flow.x*(3.0+u_settings.y*4.0)+sin(flow.y*3.0))*sin(flow.y*(3.0+u_settings.y*5.0)+flow.x);
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
