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
    col+=ink(segment(p,point,point+vec2(side*.035,.025)),.004,tint(f)) * exp(-life*4.0);
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
  return r-(.95+flow*.13+spines*min(1.8,u_impact)*.28);
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
  return metalEnvironment(reflected)*(.45+fresnel*.8)+vec3(highlight*.7)+u_c3*fresnel*.25;
}
vec3 cathedralPoint(float a, float z, float width, float height) {
  // Pointed arches sit on vertical columns; the nave bends as one structure.
  float x=cos(a)*width;
  float y=.1+sin(a)*height+pow(max(0.0,sin(a)),8.0)*.35;
  x+=sin(z*.2+u_motion.y*.2)*.2;
  return vec3(x,y,z);
}
vec3 fractalCathedral(vec2 p) {
  vec3 col=vec3(0);
  float pressure=stagePressure(), travel=u_motion.z*.75;
  for(int arch=0;arch<7;arch++) {
    float f=float(arch), z=mod(f*1.7-travel,11.9)-2.0;
    float fade=smoothstep(-2.0,-1.5,z)*(1.0-smoothstep(9.0,9.9,z));
    float width=1.55-pressure*.3, height=1.4+pressure*.3;
    for(int j=0;j<16;j++) {
      float a=float(j)*PI/16.0, b=(float(j)+1.0)*PI/16.0;
      vec3 va=cathedralPoint(a,z,width,height), vb=cathedralPoint(b,z,width,height);
      col+=stroke3(p,va,vb,tint(f*.6),.025)*fade;
      col+=stroke3(p,va*vec3(.87,.87,1),vb*vec3(.87,.87,1),u_c2,.009)*fade;
    }
    for(int sideIndex=0;sideIndex<2;sideIndex++) {
      float side=float(sideIndex)*2.0-1.0;
      vec3 top=cathedralPoint(sideIndex==0 ? PI : 0.0,z,width,height);
      vec3 bottom=vec3(top.x,-1.5,z);
      col+=stroke3(p,top,bottom,u_c1,.035)*fade;
      col+=stroke3(p,bottom,vec3(top.x,-1.5,z+1.7),u_c2,.012)*fade;
      for(int detail=0;detail<3;detail++) {
        float h=float(detail)*.42-.95;
        vec3 c=vec3(top.x,h,z);
        col+=stroke3(p,c+vec3(-.13,0,0),c+vec3(0,.24,0),u_c3,.008)*fade;
        col+=stroke3(p,c+vec3(0,.24,0),c+vec3(.13,0,0),u_c3,.008)*fade;
      }
    }
  }
  return col;
}
vec3 magneticPoint(float t, float seed, float side) {
  float pressure=stagePressure();
  float separation=.65+pressure*.45;
  float spread=.25+seed*.8;
  float loop=sin(t*PI);
  vec3 v=vec3(mix(-separation,separation,t),side*loop*spread,
    loop*sin(seed*13.0+u_motion.y*.2)*spread);
  v.y+=loop*.12*sin(t*13.0+u_motion.y*1.4+seed*4.0)*(1.0+u_impact);
  return spin3(v,vec2(u_motion.x*.2,.3*sin(u_motion.y*.2)));
}
vec3 magneticField(vec2 p) {
  vec3 col=vec3(0);
  for(int thread=0;thread<24;thread++) {
    if(float(thread)>8.0+u_settings.y*15.0) break;
    float f=float(thread), seed=(floor(f/2.0)+1.0)/12.0, side=mod(f,2.0)*2.0-1.0;
    for(int j=0;j<12;j++) {
      float a=float(j)/12.0,b=(float(j)+1.0)/12.0;
      vec3 va=magneticPoint(a,seed,side),vb=magneticPoint(b,seed,side);
      float spark=pow(max(0.0,cos(a*TAU-u_motion.z*3.0+seed*4.0)),16.0);
      col+=stroke3(p,va,vb,tint(seed*4.0+side),.005)*(.35+spark*(.5+u_audio.z*2.0));
    }
  }
  vec3 pole=magneticPoint(0.0,.5,1.0);
  col+=ink(length(p-project3(pole)),.025,u_c1);
  col+=ink(length(p-project3(-pole)),.025,u_c2);
  return col;
}
vec3 fusionReactor(vec2 p) {
  float collapse=clamp(u_impact*.55,0.0,1.0);
  float angle=u_motion.x*.35+u_motion.z*.2;
  vec2 axis=vec2(cos(angle),sin(angle)*.65);
  float gap=mix(.65,.06,collapse);
  vec3 col=vec3(0);
  for(int i=0;i<2;i++) {
    float side=float(i)*2.0-1.0;
    vec2 q=p-axis*gap*side;
    float r=length(q), a=atan(q.y,q.x);
    float radius=.28+.06*sin(a*5.0+u_motion.y*side)+collapse*.09;
    float mask=1.0-smoothstep(radius-.04,radius+.06,r);
    vec3 fire=liquid(q*2.0+vec2(side*.4,0));
    col+=fire*mask*1.3;
    col+=ink(r-radius,.012,i==0 ? u_c1 : u_c2);
  }
  col+=vec3(1.0,.9,.8)*exp(-dot(p,p)*65.0)*collapse*1.6;
  for(int i=0;i<28;i++) {
    float f=float(i), a=f*2.399;
    float age=min(u_kick.z,3.0);
    float radius=.08+age*(.5+hash(vec2(f,4))*1.4);
    vec2 point=vec2(cos(a),sin(a))*radius;
    col+=ink(segment(p,point,point*.87),.005,tint(f))*exp(-age*3.0);
  }
  col+=ink(length(p)-u_kick.z*3.5,.018,u_c3)*exp(-u_kick.z*2.0);
  return col;
}
vec3 livingPrism(vec2 p) {
  float pressure=stagePressure();
  float opening=.15+pressure*.7+min(1.5,u_impact)*.25;
  float nearest=10000.0; vec3 col=vec3(0);
  for(int layer=0;layer<3;layer++) {
    float level=float(layer), scale=pow(.55,level);
    for(int face=0;face<6;face++) {
      float f=float(face), axis=floor(f/2.0), side=mod(f,2.0)*2.0-1.0;
      vec3 normal=axis<.5 ? vec3(0,0,side) : axis<1.5 ? vec3(side,0,0) : vec3(0,side,0);
      vec2 angle=axis<.5 ? vec2(0,0) : axis<1.5 ? vec2(PI*.5,0) : vec2(0,PI*.5);
      vec3 hinge=normal*scale+vec3(0,scale*.75,0);
      vec3 offset=vec3(0,-scale*.75,0);
      float flap=side*(opening+.12*sin(u_motion.y*.5+f+level));
      offset.yz=turn(flap)*offset.yz;
      vec3 center=hinge+offset+normal*opening*.2*scale;
      vec2 spin=vec2(u_motion.x*.22+level*.3,.25*sin(u_motion.y*.3));
      center=spin3(center,spin);
      angle+=spin+vec2(0,flap);
      vec4 hit=cubeHit(p,center,vec3(.75,.75,.035)*scale,angle,tint(f*.65+level*2.0));
      if(hit.w<nearest) { nearest=hit.w; col=hit.rgb; }
    }
  }
  col+=u_c2*exp(-dot(p,p)*60.0)*(.1+opening*.2);
  return col;
}
`
