#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D srcTex;
varying vec2 vTex;

void main(void)
{
  vec4 c;

  c = vec4(vec3(1.0,1.0,1.0)-texture2D(srcTex,vTex).rgb,1.0);

  gl_FragColor = c;	  
}
