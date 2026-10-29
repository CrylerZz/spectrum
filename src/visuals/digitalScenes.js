// Procedural digital scenery. No fonts, videos or external textures are loaded.
export const digitalScenes = `
float codeGlyph(vec2 uv, float seed) {
  vec2 q=uv-vec2(.5);
  float strokes=0.0;
  // Six stable strokes per cell form a changing, invented machine alphabet.
  for(int i=0;i<6;i++) {
    float f=float(i), h=hash(vec2(seed,f));
    vec2 a=vec2(-.27+mod(f,2.0)*.54,-.34+floor(f/2.0)*.34);
    vec2 b=h>.5 ? a+vec2(.25,0) : a+vec2(0,.22);
    strokes=max(strokes,exp(-segment(q,a,b)*65.0)*step(.17,h));
  }
  return strokes;
}
vec3 matrixRain(vec2 p) {
  vec3 col=vec3(0);
  float detail=.65+u_settings.y*.6;
  for(int layer=0;layer<4;layer++) {
    float f=float(layer), scale=(7.0+f*4.0)*detail;
    vec2 q=p*scale;
    q.x+=sin(u_motion.x*.12+f)*(.2+f*.15);
    float column=floor(q.x), seed=hash(vec2(column,f+7.0));
    float speed=(1.2+seed*2.0)*(1.0+u_impact*.12);
    q.y+=u_motion.z*speed;
    vec2 cell=floor(q), uv=fract(q);
    float tail=mod(cell.y+seed*31.0,24.0);
    float stream=exp(-tail*.19)*step(.18,seed);
    float glyph=codeGlyph(uv,hash(cell+f*31.0)*517.0+floor(u_motion.y*.6));
    vec3 c=mix(u_c1,u_c2,seed);
    col+=c*glyph*stream*(.9-f*.15);
    col+=vec3(glyph)*exp(-tail*3.0)*(.6-f*.1);
  }
  return col;
}
vec3 dataTunnel(vec2 p) {
  float radius=max(.09,length(p)), angle=atan(p.y,p.x)+u_motion.x*.16;
  float depth=1.5/radius;
  vec2 q=vec2(angle*8.0/PI,depth*2.0-u_motion.z*2.0);
  vec2 cell=floor(q), uv=fract(q);
  float seed=hash(cell), glyph=codeGlyph(uv,seed*731.0);
  float packet=pow(max(0.0,sin(cell.y*.7+cell.x-u_motion.z*3.0)),8.0);
  vec3 col=tint(cell.x*.2)*glyph*(.25+packet)*( .5+radius*.3);
  float seams=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
  col+=ink(seams,.008,u_c2)*(.08+u_impact*.1);
  return col*smoothstep(.09,.25,radius);
}
vec3 circuitBoard(vec2 p) {
  p*=turn(u_motion.x*.12);
  vec2 q=p*(4.0+u_settings.y*3.0);
  q+=vec2(u_motion.z*.1,0);
  vec2 cell=floor(q), uv=fract(q)-.5;
  float seed=hash(cell);
  uv*=turn(floor(seed*4.0)*PI*.5);
  float route=min(segment(uv,vec2(-.5,0),vec2(0,0)),segment(uv,vec2(0,0),vec2(0,.5)));
  float pulse=pow(max(0.0,sin((uv.x+uv.y+cell.x+cell.y)*5.0-u_motion.z*3.0)),12.0);
  vec3 col=ink(route,.012,tint(seed*5.0))*(.22+pulse*(.7+u_impact*.3));
  if(seed>.68) {
    float chip=max(abs(uv.x),abs(uv.y))-.16;
    col+=ink(chip,.012,u_c3)*.55;
    col+=u_c1*step(max(abs(uv.x),abs(uv.y)),.15)*(.08+u_audio.y*.15);
  } else col+=ink(length(uv),.025,u_c2)*(.1+pulse*.5);
  return col;
}
vec3 cyberPortals(vec2 p) {
  vec3 col=vec3(0);
  float t=u_motion.z*.4;
  for(int i=0;i<7;i++) {
    float f=float(i), z=fract(f/7.0-t*.09);
    float size=mix(.12,2.4,z*z);
    vec2 q=p*turn(u_motion.x*.16+f*.21+sin(u_motion.y*.2)*.2);
    float radius=length(q), angle=atan(q.y,q.x);
    float polygon=cos(mod(angle+PI/6.0,PI/3.0)-PI/6.0)*radius;
    float d=polygon-size;
    float gate=sin(z*PI);
    col+=ink(d,.004+.008*z,tint(f*.8))*gate;
    float packets=pow(max(0.0,sin(angle*18.0-u_motion.y*2.0+f)),12.0);
    col+=ink(d-.025,.003,u_c3)*gate*packets*(.3+u_audio.z);
  }
  return col;
}
vec3 digitalInterference(vec2 p) {
  float row=floor(p.y*24.0), seed=hash(vec2(row,floor(u_motion.z*2.0)));
  float glitch=u_live.x>.5 ? min(1.0,u_live.y+u_impact*.3) : min(1.0,u_impact*.35+u_audio.z*.25);
  vec2 q=p;
  q.x+=(seed-.5)*glitch*.45*step(.65,seed);
  q*=turn(u_motion.x*.12);
  float waves=sin(q.x*9.0+sin(q.y*6.0+u_motion.y)*2.0-u_motion.z);
  float carrier=cos(q.y*13.0-q.x*5.0+u_motion.y*.6);
  float pattern=waves*carrier;
  vec3 col=ink(pattern,.025,tint(pattern*4.0+q.y))* .8;
  col+=u_c2*exp(-abs(waves-carrier)*18.0)*(.1+u_audio.y*.3);
  float scan=pow(max(0.0,cos(p.y*160.0)),8.0);
  col*=.65+.35*scan;
  col+=u_c3*step(.96,seed)*glitch*.25;
  return col;
}
vec3 cyberCity(vec2 p) {
  vec3 col=vec3(0); float nearest=10000.0;
  float travel=u_motion.z*.65;
  for(int i=0;i<20;i++) {
    float f=float(i), side=mod(f,2.0)*2.0-1.0;
    float block=floor(f/2.0);
    float z=mod(block*1.5-travel,15.0)-2.2;
    float height=.5+hash(vec2(block,side))*1.5;
    height*=1.0+(u_live.x>.5 ? u_impact*.12 : u_audio.x*.2);
    vec3 center=vec3(side*1.6,-.9+height*.5,z);
    vec4 hit=cubeHit(p,center,vec3(.4,height*.5,.48),vec2(0),tint(block*.6+side));
    if(hit.w<nearest) {
      nearest=hit.w;
      col=hit.rgb*exp(-hit.w*.06);
      vec3 rayPoint=vec3(0,0,-4)+normalize(vec3(p,2.0))*hit.w;
      vec2 window=fract(vec2((rayPoint.x+rayPoint.z)*5.0,rayPoint.y*7.0));
      col+=u_c2*step(.22,window.x)*step(window.x,.65)*step(.2,window.y)*step(window.y,.55)*.4;
    }
  }
  if(nearest<9999.0) return col;
  float horizon=max(.03,-p.y);
  vec2 road=vec2(p.x,1.0)/horizon;
  float lane=abs(abs(road.x)-.65);
  col+=ink(lane,.018,u_c1)*step(p.y,0.0)*.3;
  col+=u_c3*exp(-abs(p.y)*28.0)*.08;
  return col;
}
`
