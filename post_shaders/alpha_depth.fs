#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D srcTex;
varying vec2 vTex;

void main(void)
{
  float v = texture2D(srcTex,vTex).a+0.2;
                
  gl_FragColor = vec4(v,v,v,1.0);
}