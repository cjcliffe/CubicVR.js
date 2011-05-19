#ifdef GL_ES
	precision highp float;
	#endif
  uniform sampler2D srcTex;
  uniform sampler2D captureTex;
	varying vec2 vTex;

	  uniform float near_depth;
	  uniform float far_depth;
	  uniform vec3 texel;

	  float compareDepths( in float depth1, in float depth2, float aoMultiplier ) 
	  {
	  float aoCap = 3.0;
	  float depthTolerance=0.015;
	  float aorange = 20.0;// units in space the AO effect extends to (this gets divided by the camera far range
	  float diff = sqrt( clamp(1.0-(depth1-depth2) / (aorange/(far_depth-near_depth)),0.0,1.0) );
	  float ao = min(aoCap,max(0.0,depth1-depth2-depthTolerance) * aoMultiplier) * diff;
	  return ao;
	  }

	  void main(void)
	  {	
	  vec2 texCoord = vTex.xy;
	  float depth = texture2D( captureTex, texCoord ).w;
	  float d;

	  float pw = texel.x;
	  float ph = texel.y;

	  float aoCap = 1.0;

	  float ao = 0.0;

	  float aoMultiplier=10000.0;

	  float aoscale=1.0;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;         
                                                               
	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;         
                                                               
	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;         
                                                               
	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  pw*=2.0;
	  ph*=2.0;
	  aoMultiplier/=2.0;
	  aoscale*=2.0;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  pw*=2.0;
	  ph*=2.0;
	  aoMultiplier/=2.0;
	  aoscale*=2.0;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  pw*=2.0;
	  ph*=2.0;
	  aoMultiplier/=2.0;
	  aoscale*=2.0;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y+ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x+pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

	  d=texture2D( captureTex,  vec2(texCoord.x-pw,texCoord.y-ph)).w;
	  ao+=compareDepths(depth, d, aoMultiplier)/aoscale;

    ao/=16.0;
	  // ao/=16.0;

    ao = clamp(1.0-ao,0.0,1.0);


	  gl_FragColor = vec4(ao * texture2D(srcTex,texCoord).rgb,1.0);
}