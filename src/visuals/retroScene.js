// Electric corona inspired by early music-player visualizers.
export const retroScene = `
vec3 retroResonance(vec2 p) {
  float pressure=stagePressure(), hit=min(1.5,u_impact);
  float phase=u_motion.y*.85, rotation=u_motion.x*.14;
  float recoil=clamp(u_kick.x,-.7,1.2);
  float morph=.16+pressure*.2+hit*.18;
  vec3 lime=mix(vec3(.55,.9,.12),u_c1,.28);
  vec3 gold=mix(vec3(.95,.68,.12),u_c2,.28);
  vec3 violet=mix(vec3(.25,.18,.6),u_c3,.28);
  vec2 q=turn(-.5+rotation)*p;
  float breathing=1.0+pressure*.12+max(0.0,u_kick.x)*.12;
  q/=breathing;
  // Non-rigid deformation: different regions pull in opposing directions.
  // Accumulated motion changes the shape between hits; the spring adds recoil.
  vec2 flow=vec2(sin(q.y*3.2+phase)+.4*sin(q.x*4.1-phase*.7),
                 cos(q.x*2.7-phase*.8)+.4*sin(q.y*4.7+phase*.6));
  q+=flow*morph*.45;
  q=turn(sin(length(q)*4.0-phase*.65)*(.16+hit*.22))*q;
  q*=vec2(1.0+recoil*.22,1.0-recoil*.18);
  float r=length(q), a=atan(q.y,q.x);
  vec3 col=vec3(0);
  // Tilted, rippling wire coronas. The ellipse changes its tilt in depth.
  float tilt=.68+.2*sin(phase*.45)+recoil*.08;
  vec2 ringPoint=vec2(q.x,q.y/tilt);
  float radius=length(ringPoint), angle=atan(ringPoint.y,ringPoint.x);
  for(int i=0;i<16;i++) {
    float f=float(i), offset=f*.39;
    float waviness=sin(angle*19.0+phase*2.0+offset)*(.013+hit*.009);
    waviness+=sin(angle*37.0-phase*1.3+offset*2.1)*.009;
    waviness+=sin(angle*61.0+phase+f)*(.004+u_audio.z*.004);
    float lobes=sin(angle*3.0+phase+offset*.25)*(.07+morph*.18);
    lobes+=sin(angle*5.0-phase*.7+offset*.4)*(.025+hit*.04);
    float buckle=recoil*.09*sin(angle*2.0+phase+offset*.3);
    float ring=.67+f*.013+lobes+buckle+waviness;
    float d=radius-ring;
    float wire=exp(-abs(d)*650.0);
    float glow=exp(-abs(d)*85.0)*(.08+u_settings.z*.14);
    vec3 c=mix(violet,gold,.5+.5*sin(offset));
    float depth=.45+.55*(.5+.5*sin(angle+rotation+offset*.12));
    col+=c*(wire*.28+glow)*depth;
  }
  // Fine angular filaments stretch from a white-hot, flattened plasma knot.
  vec2 corePoint=turn(sin(phase*.6)*.55)*q;
  corePoint-=vec2(sin(phase*.9),cos(phase*.7))*(.025+hit*.035);
  corePoint/=vec2(1.0+sin(phase)*.2,.57+cos(phase*.8)*.13);
  float cr=length(corePoint), ca=atan(corePoint.y,corePoint.x);
  float turbulence=sin(ca*7.0+phase)+.5*sin(ca*13.0-phase*1.7);
  float envelope=exp(-cr*(6.0-pressure));
  float rayAngle=a+sin(r*5.0-phase)*(.12+hit*.14)+recoil*r*.18;
  float rays=pow(.5+.5*sin(rayAngle*53.0+sin(a*17.0+phase)*2.0+sin(r*9.0-phase)),12.0);
  float fine=pow(.5+.5*sin(rayAngle*97.0+sin(r*15.0+phase)*1.2),22.0);
  col+=lime*(rays*.55+fine*.3)*exp(-r*2.8)*smoothstep(.015,.12,r);
  for(int j=0;j<7;j++) {
    float f=float(j);
    float strand=.14+f*.014+(.04+hit*.025)*sin(ca*5.0+phase+f*.7)+.023*turbulence;
    strand+=recoil*.035*sin(ca*3.0-phase+f*.4);
    float d=cr-strand;
    col+=ink(d,.0025,mix(lime,gold,f/7.0))*.32;
  }
  float cloud=field(q*6.0+vec2(phase*.4,-phase*.2));
  col+=lime*envelope*(.5+cloud)*(.45+pressure*.35);
  col+=vec3(1.0,.98,.72)*exp(-cr*cr*125.0)*(.6+hit*.3);
  // Soft shafts and surrounding haze, rather than a uniform glowing disc.
  float shaft=exp(-abs(q.x+.02*sin(q.y*9.0+phase))*65.0)*exp(-abs(q.y)*2.0);
  col+=vec3(.8,.9,.55)*shaft*.32;
  col+=lime*cloud*cloud*exp(-r*2.0)*.16;
  return col;
}
`
