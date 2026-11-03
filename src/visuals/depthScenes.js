// Perspective compositions share a camera at (0, 0, -4), looking toward +Z.
export const depthScenes = `
vec3 spin3(vec3 v, vec2 angle) {
  v.xz=turn(angle.x)*v.xz;
  v.yz=turn(angle.y)*v.yz;
  return v;
}

vec4 cubeHit(vec2 p, vec3 center, vec3 size, vec2 angle, vec3 c) {
  vec3 ro=spin3(vec3(0,0,-4)-center,angle);
  vec3 rd=spin3(normalize(vec3(p,2.0)),angle);
  vec3 inv=sign(rd+vec3(.000001))/max(abs(rd),vec3(.00001));
  vec3 ta=(-size-ro)*inv, tb=(size-ro)*inv;
  vec3 nearV=min(ta,tb), farV=max(ta,tb);
  float nearT=max(max(nearV.x,nearV.y),nearV.z);
  float farT=min(min(farV.x,farV.y),farV.z);
  if(farT<max(nearT,0.0)) return vec4(0,0,0,10000);
  vec3 hit=ro+rd*max(nearT,0.0);
  vec3 distances=abs(abs(hit)-size);
  float nearest=min(distances.x,min(distances.y,distances.z));
  vec3 normal=normalize(step(distances,vec3(nearest+.001))*sign(hit)+vec3(.00001));
  float diffuse=.12+.65*max(0.0,dot(normal,normalize(vec3(.4,.8,-.6))));
  float edge=min(max(distances.x,distances.y),min(max(distances.y,distances.z),max(distances.x,distances.z)));
  vec3 col=c*diffuse+ink(edge,.012,c)*.7;
  return vec4(col,max(nearT,0.0));
}
vec2 tunnelBend(float z) {
  return vec2(sin(z*.31)*1.1+sin(z*.137+2.0)*.8,
              cos(z*.263)*.9+sin(z*.173)*.7);
}
vec2 tunnelSurface(vec3 point) {
  float travel=u_motion.z*1.9, z=point.z+travel;
  vec2 center=tunnelBend(z)-tunnelBend(travel);
  vec2 q=point.xy-center;
  float radius=length(q), angle=atan(q.y,q.x)-u_motion.x*.38-z*.16;
  float sector=TAU/10.0;
  float tangential=(mod(angle+sector*.5,sector)-sector*.5)*1.7;
  float along=mod(z+.65,1.3)-.65;
  float bass=u_live.x>.5 ? min(1.0,u_impact*.6) : u_audio.x;
  float protrusion=.32+bass*.42+min(1.5,u_impact)*.14;
  // Every block overlaps the cylinder: its root stays embedded in the same wall.
  vec3 box=abs(vec3(tangential,along,radius-(1.7+.35-protrusion)))-vec3(.25,.3,.35);
  float block=length(max(box,0.0))+min(max(box.x,max(box.y,box.z)),0.0);
  float wall=1.7-radius;
  return vec2(min(wall,block),block<wall ? 1.0 : 0.0);
}
vec3 vortexDepth(vec2 p) {
  vec3 ray=normalize(vec3(p,1.5));
  float distance=0.0; vec2 surface=vec2(1.0,0.0);
  vec3 point=vec3(0);
  for(int i=0;i<64;i++) {
    point=ray*distance;
    surface=tunnelSurface(point);
    if(surface.x<.008 || distance>22.0) break;
    distance+=max(.008,surface.x*.52);
  }
  if(distance>22.0) return u_c2*.025;
  vec3 normal=normalize(vec3(
    tunnelSurface(point+vec3(.012,0,0)).x-tunnelSurface(point-vec3(.012,0,0)).x,
    tunnelSurface(point+vec3(0,.012,0)).x-tunnelSurface(point-vec3(0,.012,0)).x,
    tunnelSurface(point+vec3(0,0,.012)).x-tunnelSurface(point-vec3(0,0,.012)).x)+vec3(.00001));
  float worldZ=point.z+u_motion.z*1.9;
  vec2 wallPoint=point.xy-tunnelBend(worldZ)+tunnelBend(u_motion.z*1.9);
  float angle=atan(wallPoint.y,wallPoint.x)-u_motion.x*.38-worldZ*.16;
  float cross=abs(sin(angle*5.0));
  float rings=abs(sin(worldZ*PI/1.3));
  vec3 color=tint(worldZ*.25)*(.09+.45*max(0.0,dot(normal,-ray)));
  color+=ink(min(cross,rings),.025,u_c2)*(.35+.35*surface.y);
  color+=tint(angle)*surface.y*(.3+.5*pow(max(0.0,dot(normal,normalize(vec3(-.3,.6,-1.0)))),5.0));
  // Detail stays on the bent cylinder and its blocks, with motion along the walls.
  float ribs=abs(sin(worldZ*PI*7.0/1.3));
  float lanes=pow(max(0.0,cos(angle*20.0)),26.0);
  float chase=pow(.5+.5*sin(worldZ*5.0-u_motion.z*4.0+angle*3.0),14.0);
  color+=u_c1*exp(-ribs*38.0)*(.09+.13*surface.y)*u_settings.y;
  color+=u_c2*lanes*(.15+chase*(.5+min(u_impact,1.5)*.4));
  float specular=pow(max(0.0,dot(reflect(normalize(vec3(.4,-.6,1.0)),normal),-ray)),24.0);
  color+=u_c3*specular*(.18+surface.y*.3);
  return color*exp(-distance*.055);
}

vec3 latticeDepth(vec2 p) {
  vec3 col=vec3(0); float nearest=10000.0;
  for(int i=0;i<25;i++) {
    float f=float(i), x=mod(f,5.0)-2.0, y=floor(f/5.0)-2.0;
    float visible=smoothstep(0.0,.6,.6+u_settings.y*2.0-max(abs(x),abs(y)));
    if(visible<.001) continue;
    float wave=sin(length(vec2(x,y))*1.5-u_motion.z*2.0);
    vec3 center=spin3(vec3(x*.62,y*.62,wave*.65-u_kick.x*.3),vec2(.5+sin(u_motion.x*.2)*.25,.38));
    vec4 hit=cubeHit(p,center,vec3(.22,.22,.16+.15*(wave*.5+.5)),vec2(.5,.38),tint(f*.3+wave));
    if(hit.w<nearest) { nearest=hit.w; col=hit.rgb*visible; }
  }
  return col;
}
`
