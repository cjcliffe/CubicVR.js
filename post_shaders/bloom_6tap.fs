#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D srcTex;
uniform sampler2D captureTex;
varying vec2 vTex;
uniform vec3 texel;

vec2 radius;
uniform float colorCap;
uniform float bloomRadius;

vec2 filterTaps[6];

vec3 rangeValHDR(vec3 src)
{
  return (src.r>colorCap||src.g>colorCap||src.b>colorCap)?(src):vec3(0.0,0.0,0.0);
}

vec3 hdrSample(float rad)
{
  vec3 accum = vec3(0.0,0.0,0.0);
  float c = 0.0;
  vec3 ctemp;
  
  for (int i = 0; i < 6; i++)
  {      		    
    accum += rangeValHDR(texture2D(srcTex, vec2(vTex.x+filterTaps[i].x*radius.x*rad,vTex.y+filterTaps[i].y*radius.y*rad)).rgb).rgb;      		    
  }

  accum /= 4.0;

  return accum.rgb;
}


void main(void)
{
  vec3 color;
  radius = vec2(texel.x,texel.y);

  filterTaps[0] = vec2(-0.326212, -0.405805);
  filterTaps[1] = vec2(-0.840144, -0.073580);
  filterTaps[2] = vec2(-0.695914,  0.457137);
  filterTaps[3] = vec2(-0.203345,  0.620716);
  filterTaps[4] = vec2( 0.962340, -0.194983);
  filterTaps[5] = vec2( 0.473434, -0.480026);    		  


  color = hdrSample(1.0*bloomRadius);
  color += hdrSample(1.5*bloomRadius);
  color += hdrSample(3.0*bloomRadius);
  gl_FragColor.rgb = color/4.0;
  gl_FragColor.a = 1.0;
}
