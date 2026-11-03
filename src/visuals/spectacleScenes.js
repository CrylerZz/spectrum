// Six independent compositions, using the shared palette, audio and live envelopes.
export const spectacleScenes = `
float stagePressure() {
  return u_live.x>.5 ? min(1.0,u_impact*.6+u_live.z*.3) : u_audio.x;
}
vec3 dimensionalRift(vec2 p) {
  float pressure=stagePressure(), hit=max(0.0,u_kick.x);
  float seam=.13*sin(p.y*2.7+u_motion.y*.3)+.035*sin(p.y*13.0-u_motion.y);
  float width=.035+pressure*.12+hit*.24+u_live.y*.2;
  float jagged=(noise(vec2(p.y*15.0,u_motion.y*.4))-.5)*.06;
  float edge=abs(p.x-seam)-width-jagged;
  float opening=1.0-smoothstep(-.012,.012,edge);
  vec2 inside=vec2((p.x-seam)/max(.12,width*2.0),p.y*.65);
  inside*=turn(u_motion.x*.13);
  vec3 world=liquid(inside*.7+vec2(0,u_motion.z*.08));
  world+=prism(inside*.6)*.45;
  vec3 col=world*opening*(.7+pressure*.5);
  col+=ink(edge,.008,u_c2)*1.2;
  col+=u_c1*exp(-abs(edge)*10.0)*(.12+u_settings.z*.25);
  // Fragments leave the tear on impacts, following the same moving seam.
  for(int i=0;i<20;i++) {
    float f=float(i), side=mod(f,2.0)*2.0-1.0;
    float life=min(u_kick.z,2.0), y=(hash(vec2(f,3))-.5)*2.7;
    float x=.13*sin(y*2.7+u_motion.y*.3)+side*(width+life*(.4+hash(vec2(f,8))));
    vec2 point=vec2(x,y+sin(f)*life*.2);
    col+=ink(segment(p,point,point+vec2(side*.035,.025)),.004,tint(f)) * exp(-life*4.0)*detailLayer(f,20.0);
  }
  return col;
}
float liquidMetalDistance(vec3 p) {
  p=spin3(p,vec2(u_motion.x*.2,u_motion.y*.15));
  float pressure=stagePressure();
  p.y*=1.0+pressure*.5;
  p.xz/=1.0+pressure*.18;
  float r=length(p);
  vec3 n=p/max(.01,r);
  float flow=sin(n.x*5.0+u_motion.y)*sin(n.y*5.0-u_motion.y*.7)*sin(n.z*5.0+u_motion.y*.4);
  float spines=pow(max(0.0,sin(n.x*11.0+n.y*7.0)*cos(n.z*9.0-n.y*5.0)),7.0);
  return r-(.95+flow*.13+spines*(.08*u_audio.y+.28*min(1.8,u_impact))*u_settings.y);
}
vec3 metalEnvironment(vec3 direction) {
  float strip=pow(max(0.0,cos(direction.y*10.0+direction.x*3.0)),24.0);
  float redRibbon=exp(-abs(direction.x+.25*sin(direction.y*6.0+u_motion.y*.2))*22.0);
  return vec3(.035)+u_c1*redRibbon*1.8+u_c2*strip*1.2+u_c3*pow(max(0.0,direction.y),8.0)*.5;
}
vec3 liquidMetal(vec2 p) {
  vec3 ro=vec3(0,0,-3.4), rd=normalize(vec3(p,2.1));
  float t=0.0, d=1.0;
  vec3 point=ro;
  for(int i=0;i<64;i++) {
    point=ro+rd*t; d=liquidMetalDistance(point);
    if(d<.003 || t>6.0) break;
    t+=max(.002,d*.4);
  }
  if(t>6.0 || d>.02) return u_c1*exp(-length(p)*3.0)*.012;
  vec3 e=vec3(.005,0,0);
  vec3 n=normalize(vec3(liquidMetalDistance(point+e.xyy)-liquidMetalDistance(point-e.xyy),
    liquidMetalDistance(point+e.yxy)-liquidMetalDistance(point-e.yxy),
    liquidMetalDistance(point+e.yyx)-liquidMetalDistance(point-e.yyx))+vec3(.00001));
  vec3 reflected=reflect(rd,n);
  float fresnel=pow(1.0-max(0.0,dot(n,-rd)),3.0);
  float highlight=pow(max(0.0,dot(reflect(normalize(vec3(-.5,-.8,1.0)),n),-rd)),50.0);
  return metalEnvironment(reflected)*(.45+fresnel*.8)+vec3(highlight*(.35+.35*u_settings.z+.25*u_audio.z))+u_c3*fresnel*.25;
}

`
