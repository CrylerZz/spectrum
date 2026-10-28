export const vertex = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`
export const fragment = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_audio;
uniform vec4 u_settings; // intensity, detail, glow, blackout
uniform vec4 u_layers; // ring, dna, grid, eye
uniform float u_waves;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform int u_scene;
uniform int u_previous;
uniform float u_mix;
uniform sampler2D u_spectrum;
uniform sampler2D u_orbital;
uniform float u_orbitalImpact;
uniform float u_orbitalTint;
#define PI 3.14159265359
#define TAU 6.28318530718
float line(float d, float w) { return w / (abs(d) + w); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float audio(float x) { return texture2D(u_spectrum, vec2(clamp(x,0.01,0.99),0.5)).r; }
vec3 orbital(vec2 p) {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = 1.0 / u_resolution;
  vec3 color = texture2D(u_orbital, uv).rgb;
  // Original additive displaced copies + saturation, now a few GPU texture reads.
  float hit = u_orbitalImpact * (.85 + .45*u_audio.w);
  color *= 1.0 + .2*u_orbitalImpact;
  vec2 shift = px * (1.5 + hit*2.5);
  color += hit*.27*(texture2D(u_orbital,uv+vec2(shift.x,0.0)).rgb
                   +texture2D(u_orbital,uv-vec2(shift.x,0.0)).rgb
                   +texture2D(u_orbital,uv+vec2(0.0,shift.y)).rgb);
  vec2 halo = px * (3.0+u_settings.z*4.0);
  color += u_settings.z*.12*(texture2D(u_orbital,uv+vec2(halo.x,0.0)).rgb
                            +texture2D(u_orbital,uv-vec2(halo.x,0.0)).rgb
                            +texture2D(u_orbital,uv+vec2(0.0,halo.y)).rgb
                            +texture2D(u_orbital,uv-vec2(0.0,halo.y)).rgb);
  color = mix(color,u_c1*color.r+u_c2*color.g+u_c3*color.b,u_orbitalTint);
  float luminance = dot(color,vec3(.2126,.7152,.0722));
  color = max(vec3(0.0),mix(vec3(luminance),color,1.0+hit*.35));
  return color;
}
vec3 tunnel(vec2 p) {
  float r = max(length(p),.025), a = atan(p.y,p.x)+u_time*.12;
  float depth = 1.0 / (r+.16);
  float rings = abs(fract(depth*1.5-u_time*.9)-.5);
  float ribs = abs(sin(a*8.0+depth*.8));
  vec3 col = u_c1*pow(line(rings,.025),2.0)*( .4+u_audio.x);
  col += u_c2*pow(line(ribs,.025),2.0)*.5;
  col += u_c3*exp(-r*7.0)*u_audio.w;
  return col * smoothstep(.03,.25,r) * (.5+r*.5);
}
vec3 aurora(vec2 p) {
  vec3 col = vec3(0.0);
  for(int i=0;i<6;i++) {
    float f = float(i), y = p.y + sin(p.x*2.5+u_time*.45+f*.5)*.19;
    y += sin(p.x*5.0-u_time*.3+f)*(.06+u_audio.y*.13);
    y -= (f-2.5)*.09;
    vec3 c = mix(u_c1,u_c2,f/5.0);
    col += c * pow(line(y,.012+u_audio.x*.008),1.5)*.6;
    col += c * exp(-abs(y)*12.0)*u_settings.z*.065;
  }
  return col;
}
vec3 terrain(vec2 p) {
  float horizon = p.y+.23;
  vec2 q = vec2(p.x,1.0) / max(abs(horizon),.035);
  q.y += u_time*.65;
  float height = sin(q.x*.6+u_time*.3)*.08*u_audio.x;
  vec2 grid = abs(fract(vec2(q.x*2.0,q.y*1.5+height))-.5);
  float lines = max(pow(line(grid.x,.016),2.0),pow(line(grid.y,.018),2.0));
  vec3 col = mix(u_c1,u_c2,smoothstep(-.7,.5,p.y))*lines*.7;
  col *= smoothstep(.025,.18,abs(horizon));
  float sun = length(p-vec2(0.0,.15))-.22-u_audio.x*.025;
  col += u_c3*line(sun,.004)*.65;
  col += u_c1*exp(-abs(horizon)*20.0)*(.15+u_settings.z*.3);
  return col;
}
vec3 liquid(vec2 p) {
  vec2 q = p;
  for(int i=0;i<4;i++) {
    float f=float(i)+1.0;
    q += vec2(sin(q.y*f*2.0+u_time*.3),cos(q.x*f*2.0-u_time*.25))*(.15+u_audio.x*.06)/f;
  }
  float v = sin(q.x*5.0+q.y*4.0+u_time*.35);
  float contours = abs(fract(v*3.0+length(q)*2.0)-.5);
  vec3 col = mix(u_c1,u_c2,v*.5+.5)*pow(line(contours,.025),1.6);
  col += u_c3*pow(max(0.0,v),8.0)*.15*u_settings.z;
  return col;
}
vec3 stars(vec2 p) {
  vec3 col = vec3(0.0);
  p *= turn(u_time*.025);
  for(int i=0;i<4;i++) {
    float f=float(i), z=fract(f*.25+u_time*.07);
    float scale=mix(15.0,2.0,z);
    vec2 q=p*scale, cell=floor(q), pos=fract(q)-.5;
    vec2 offset=vec2(hash(cell+f),hash(cell+f+16.0))-.5;
    float d=length(pos-offset*.65);
    float star=pow(line(d,.009+u_audio.z*.012),2.0);
    float fade=sin(z*PI);
    col+=mix(u_c1,u_c2,hash(cell+8.0))*star*fade*1.6;
  }
  col+=u_c3*exp(-length(p)*4.0)*(.04+u_audio.x*.1);
  return col;
}
vec3 scene(int id, vec2 p) {
  if(id==0) return orbital(p);
  if(id==1) return tunnel(p);
  if(id==2) return aurora(p);
  if(id==3) return terrain(p);
  if(id==4) return liquid(p);
  return stars(p);
}
vec3 finishedScene(int id, vec2 p) {
  vec3 color = scene(id,p) * u_settings.x;
  // Preserve the original neon clipping; cinematic tone mapping washed it out.
  if (id == 0) return clamp(color,0.0,1.0);
  color *= 1.0-smoothstep(.3,2.2,length(p))*.5;
  color = 1.0-exp(-color*1.5);
  return pow(max(color,vec3(0.0)),vec3(.92));
}
void main() {
  vec2 p = (gl_FragCoord.xy*2.0-u_resolution)/min(u_resolution.x,u_resolution.y);
  vec3 color = finishedScene(u_scene,p);
  if(u_mix<.999) color=mix(finishedScene(u_previous,p),color,smoothstep(0.0,1.0,u_mix));
  gl_FragColor=vec4(color*(1.0-u_settings.w),1.0);
}
`
