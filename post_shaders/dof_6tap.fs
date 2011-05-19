#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D srcTex;
uniform sampler2D captureTex;
varying vec2 vTex;
uniform vec3 texel;
uniform vec3 depthInfo;

vec2 filterTaps[6];

uniform float near_depth;
uniform float far_depth;

void main(void)
{
  filterTaps[0] = vec2(-0.326212, -0.405805);
  filterTaps[1] = vec2(-0.840144, -0.073580);
  filterTaps[2] = vec2(-0.695914,  0.457137);
  filterTaps[3] = vec2(-0.203345,  0.620716);
  filterTaps[4] = vec2( 0.962340, -0.194983);
  filterTaps[5] = vec2( 0.473434, -0.480026);

  float depth_test = texture2D(captureTex, vTex.xy).a;

  vec4 color = vec4(0.0,0.0,0.0,1.0);

  float depthSample = 1.0;

  vec2 radius = vec2(texel.x*2.0,texel.y*2.0);
  float effect = 0.0;
  vec2 ofsSample;

  //	  float colorDiv = 0.0;
  
  float dNear = near_depth;
  float dFar = far_depth;

  bool dln = depth_test < dNear;
  bool dgf = depth_test > dFar;
/*  
  if (dgf) color.rgb+=vec3(1.0,0.0,0.0);
  if (dln) color.rgb+=vec3(0.0,0.0,1.0);
  if (!dgf&&!dln) color.rgb+=vec3(0.0,1.0,0.0);
	*/
/* */
  for (int i = 0; i < 6; i++)
  {
	  depthSample = texture2D( captureTex, vec2(vTex.x+filterTaps[i].x*radius.x*effect,vTex.y+filterTaps[i].y*radius.y*effect)).a; 
	  effect = 0.0;

	  bool ds_gf = depthSample > dFar;
	  bool ds_ln = depthSample < dNear;

	  if (dln || ds_gf)
	  {
			effect = (depthSample > depth_test)?((depthSample-dFar)/(1.0-dFar))*2.0:((depth_test-dFar)/(1.0-dFar));	// far		  
	  }
	  else if (dln || ds_ln)
	  {
			effect = ((depthSample < depth_test)?(1.0-1.0/(dNear/depthSample)):(1.0-1.0/(dNear/depth_test))); // near
	  }
	  else if ((dln && ds_gf)||(dln && ds_ln))
	  {
		  effect = (dln && ds_gf)?(1.0-1.0/(dNear/depth_test)): //near
		  ((depth_test-dFar)/(1.0-dFar));	// far		  
	  }
    
    if (ds_ln) effect *= 8.0;
    
    effect *= 3.0;

	  ofsSample = vec2(vTex.x+filterTaps[i].x*radius.x*effect,vTex.y+filterTaps[i].y*radius.y*effect);

	  if (abs(ofsSample.x)>1.0 || abs(ofsSample.y)>1.0 || abs(ofsSample.x)<0.0 || abs(ofsSample.y)<0.0) ofsSample = vTex.xy;

	  color += texture2D( srcTex, ofsSample);   
  }
  color /= 6.0;
  /* */

  gl_FragColor = vec4(color.rgb,1.0);
}