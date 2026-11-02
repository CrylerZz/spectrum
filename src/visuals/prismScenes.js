// Five different compositions sharing the same progressive musical build.
export const prismScenes = `
float prismLayer(float index, float energy) {
  return smoothstep(0.0,1.0,1.6+energy*6.4-index);
}
vec3 prismLace(vec2 p) {
  float e=u_prism.x, r=length(p);
  p*=turn(u_motion.x*.1);
  float a=atan(p.y,p.x);
  float fold=abs(mod(a+PI/12.0,PI/6.0)-PI/12.0);
  vec2 q=vec2(cos(fold),sin(fold))*r;
  vec3 col=vec3(0);
  for(int i=0;i<8;i++) {
    float f=float(i), visible=prismLayer(f,e);
    q=abs(q*1.32-vec2(.38,.22));
    q*=turn(.24+sin(u_motion.y*.22+f)*(.18+u_prism.z*.22));
    float thread=min(abs(q.y-.1),abs(q.x-q.y*.72));
    col+=ink(thread,.0025+.0015*e,tint(f*.65+r))*visible/(1.0+f*.38);
  }
  float lace=abs(sin(a*12.0+sin(r*9.0-u_motion.y*.2)))*r;
  col+=ink(lace,.002,u_c3)*smoothstep(.25,.8,e)*(.1+.45*u_prism.w);
  return col*(.3+.6*e)*(.75+.25*cos(r*7.0-u_motion.z*.35));
}
vec3 prismCrowns(vec2 p) {
  float e=u_prism.x, r=length(p), a=atan(p.y,p.x);
  vec3 col=vec3(0);
  for(int i=0;i<8;i++) {
    float f=float(i), visible=prismLayer(f,e);
    float phase=a+u_motion.x*.08*(mod(f,2.0)*2.0-1.0)+f*.14;
    float sector=mod(phase+PI/8.0,PI/4.0)-PI/8.0;
    float radius=.16+f*.18;
    radius+=u_kick.x*u_prism.y*.025*(1.0+f*.2);
    float polygon=r*cos(sector)-radius;
    col+=ink(polygon,.003+.002*e,tint(f*.8))*visible/(1.0+f*.12);
    float engraving=abs(sin(phase*16.0+u_motion.y*.25))*r;
    col+=ink(engraving,.002,u_c3)*exp(-abs(polygon)*28.0)*visible*smoothstep(.2,.65,e)*(.15+u_prism.w*.6);
  }
  return col*(.4+.65*e);
}
vec3 prismShards(vec2 p) {
  float e=u_prism.x, a=atan(p.y,p.x)+u_motion.x*.12, r=length(p);
  vec3 col=vec3(0);
  for(int i=0;i<8;i++) {
    float f=float(i), visible=prismLayer(f,e);
    float angle=a+f*.17+sin(u_motion.y*.2+f)*.035;
    float fold=mod(angle+PI/7.0,TAU/7.0)-PI/7.0;
    vec2 q=vec2(cos(fold),sin(fold))*r;
    float center=.28+f*.15+u_kick.x*u_prism.y*.04;
    q.x-=center;
    float diamond=abs(q.x)*.55+abs(q.y)*1.5-(.12+.07*e);
    col+=ink(diamond,.003,tint(f*.75))*visible/(1.0+f*.2);
    col+=ink(segment(q,vec2(-.22,0),vec2(.22,0)),.002,u_c3)*visible*smoothstep(.35,.9,e)*(.15+.4*u_prism.w);
  }
  return col*(.35+.8*e);
}
vec3 prismSpiral(vec2 p) {
  float e=u_prism.x, r=length(p), a=atan(p.y,p.x)+u_motion.x*.1;
  vec3 col=vec3(0);
  for(int i=0;i<8;i++) {
    float f=float(i), visible=prismLayer(f,e);
    float curl=a+r*(2.8+u_prism.z*.7)-u_motion.y*.2+f*.44;
    float arm=abs(sin(curl*3.0))*max(r,.08);
    float shell=abs(r-(.2+f*.14)-.08*sin(a*6.0+u_motion.y*.2+f));
    float weave=min(arm,shell);
    col+=ink(weave,.0025+.001*e,tint(f*.6+r*1.5))*visible*exp(-abs(r-.3-f*.13)*2.7)/(1.0+f*.13);
  }
  float sparks=pow(max(0.0,cos(a*36.0+r*18.0-u_motion.z)),24.0);
  col+=u_c3*sparks*exp(-abs(r-.65)*6.0)*smoothstep(.5,1.0,e)*u_prism.w*.45;
  return col*(.4+.65*e);
}
vec2 prismProject(vec3 point) {
  return point.xy*2.0/max(1.0,3.3+point.z);
}
vec3 prismCrystal(vec2 p) {
  float e=u_prism.x;
  vec3 col=vec3(0);
  for(int i=0;i<8;i++) {
    float f=float(i), visible=prismLayer(f,e);
    float size=.42+f*.2;
    vec2 rotation=vec2(.5+u_motion.x*.12+f*.22,.35+sin(u_motion.y*.18+f*.4)*.2);
    vec3 top=spin3(vec3(0,1.35,0)*size,rotation);
    vec3 bottom=spin3(vec3(0,-1.1,0)*size,rotation);
    for(int j=0;j<6;j++) {
      float angle=float(j)*TAU/6.0+f*.13;
      vec3 a=spin3(vec3(cos(angle)*.75,.04,sin(angle)*.75)*size,rotation);
      vec3 b=spin3(vec3(cos(angle+TAU/6.0)*.75,.04,sin(angle+TAU/6.0)*.75)*size,rotation);
      float wire=min(segment(p,prismProject(a),prismProject(top)),segment(p,prismProject(a),prismProject(bottom)));
      wire=min(wire,segment(p,prismProject(a),prismProject(b)));
      float front=.65+.35*clamp(1.0-a.z,0.0,1.0);
      col+=ink(wire,.0025,tint(f*.75+float(j)*.12))*visible*front/(1.0+f*.22);
      float glint=length(p-prismProject(a));
      col+=ink(glint,.004,u_c3)*visible*smoothstep(.4,1.0,e)*u_prism.w*.5;
    }
  }
  return col*(.3+.55*e);
}
`
