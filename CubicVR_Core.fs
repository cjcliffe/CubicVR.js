#ifdef GL_ES
precision highp float;
#endif

uniform vec3 mDiff;
uniform vec3 mColor;
uniform vec3 mAmb;

varying vec3 vNormal;
#if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap
varying vec2 vTextureCoord;
#endif
varying vec3 o_norm;

#if alphaDepth

uniform vec3 depthInfo;

float ConvertDepth3(float d)
{
  return (depthInfo.x*depthInfo.y)/(depthInfo.y-d*(depthInfo.y-depthInfo.x));
}

// transform range in world-z to 0-1 for near-far
float DepthRange( float d )
{
  return ( d - depthInfo.x ) / ( depthInfo.y - depthInfo.x );
}

#endif

#if hasColorMap
	uniform sampler2D colorMap;
#endif

#if hasBumpMap
	varying vec3 eyeVec; 
	// varying vec3 u;
	uniform sampler2D bumpMap;
#endif


#if hasEnvSphereMap
	uniform sampler2D envSphereMap;
//	uniform float envAmount;
#if hasNormalMap
 	varying vec3 u;
#else
	varying vec2 vEnvTextureCoord;
#endif
#endif

#if hasNormalMap
	uniform sampler2D normalMap;
#endif

	uniform float mAlpha;

#if hasAmbientMap
	uniform sampler2D ambientMap;
#endif

#if hasSpecularMap
	uniform sampler2D specularMap;
#endif

#if hasAlphaMap
	uniform sampler2D alphaMap;
#endif

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uOMatrix;


#if lightPoint||lightDirectional||lightSpot||lightArea
	uniform vec3 lDiff;
	uniform vec3 lSpec;
	uniform float lInt;
	uniform float lDist;

	uniform vec3 mSpec;
	uniform float mShine;
#endif

uniform vec3 lAmb;

#if lightPoint||lightSpot
	varying vec3 lightPos;
#endif

#if lightDirectional||lightSpot||lightArea
	uniform vec3 lDir;
#endif

#if lightDirectional
	varying vec3 lightDir;
#endif

varying vec3 camPos;
varying vec4 vPosition;

void main(void) 
{
	vec3 n;
	vec3 view_norm;
	vec4 color;
	
#if hasBumpMap
  float height = texture2D(bumpMap, vTextureCoord.xy).r;  
  float v = (height) * 0.05 - 0.04; // * scale and - bias 
  vec3 eye = normalize(eyeVec); 
  vec2 texCoord = vTextureCoord.xy + (eye.xy * v);
#else 
#if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap
	vec2 texCoord = vTextureCoord;
#endif
#endif


#if hasNormalMap
 		vec3 bumpNorm = vec3(texture2D(normalMap, texCoord));

#if hasEnvSphereMap
		view_norm = normalize(((bumpNorm-0.5)*2.0));
#endif
		bumpNorm = (uMVMatrix * vec4(normalize(((bumpNorm-0.5))),0.0)).xyz; 
		
		n = normalize(normalize(vNormal)+normalize(bumpNorm)/1.5);
		
#else
		n = normalize(vNormal);
		view_norm = (uPMatrix * vec4(n,0)).xyz;
#endif


#if hasColorMap
#if !(lightPoint||lightDirectional||lightSpot||lightArea)
	color = texture2D(colorMap, vec2(texCoord.s, texCoord.t)).rgba;
	//vec4(lAmb,1.0)*
#else
  color = texture2D(colorMap, vec2(texCoord.s, texCoord.t)).rgba;
#endif
	if (color.a<=0.1) discard;  
#else
	color = vec4(mColor,1.0);
#endif

#if hasAlphaMap
	color.a = texture2D(alphaMap, texCoord).r;
  if (color.a==0.0) discard;
#else
#if hasAlpha
	color.a = mAlpha;
#endif
#endif


float envAmount = 0.6;

#if hasEnvSphereMap
#if hasNormalMap
	vec3 r = reflect( u, view_norm );
	float m = 2.0 * sqrt( r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0) );

	vec3 coord;
	coord.s = r.x/m + 0.5;
	coord.t = r.y/m + 0.5;
	
	// #if hasReflectionMap
	// 	color += texture2D( envSphereMap, coord.st) * texture2D( reflectionMap, texCoord);
	// #else
		color = color*(1.0-envAmount) + texture2D( envSphereMap, coord.st) * envAmount;//envAmount;
	// #endif

#else
	// #if hasReflectionMap
	// 	color += texture2D( envSphereMap, gl_TexCoord[1].st) * texture2D( reflectionMap, texCoord);
	// #else
	 	color = color*(1.0-envAmount) + texture2D( envSphereMap, vEnvTextureCoord)*envAmount;
	// #endif
#endif

#endif


#if lightPoint
	vec3 halfV,viewV,ldir;
	float NdotL,NdotHV;

	vec3 lightDir = lightPos-vPosition.xyz;
//	vec3 halfVector = normalize(lightDir-camPos);
	float dist = length(lightDir);

	// compute the dot product between normal and normalized lightdir 
	NdotL = max(dot(n,normalize(lightDir)),0.0);

	vec3 lit = vec3(0,0,0);

	if (NdotL > 0.0) 
	{
		// basic diffuse
		float distSqr = dot(lightDir, lightDir);
    float att = clamp(((lDist-dist)/lDist), 0.0, 1.0)*lInt;
//		color.rgb = att * (lDiff * NdotL);
		
		lit = att * NdotL * lDiff;

		// specular highlight
		// halfV = normalize(halfVector);
		// NdotHV = max(dot(n,halfV),0.0);
		// color += att * specVal * lSpec * pow(NdotHV,1.0);
	}
	
	color.rgb *= lit+lAmb;
#endif





#if lightDirectional

	float NdotL,NdotHV;

//	vec3 lightDir;
	vec3 halfVector;
	vec3 lit = lAmb;

//	lightDir = normalize(lDir);
	halfVector = normalize(normalize(camPos)+normalize(lightDir));

	NdotL = max(dot(n,lightDir),0.0);

	if (NdotL > 0.0) 
	{
		lit += lInt * mDiff * lDiff * NdotL;		

		NdotHV = max(dot(n, halfVector),0.0);

		#if hasSpecularMap
			vec3 spec2 = lSpec * texture2D(specularMap, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,mShine);
		#else
			vec3 spec2 = lSpec * mSpec * pow(NdotHV,mShine);
		
		#endif

		lit += spec2;

		color.rgb *= lit;

		color.rgb += (spec2 + spec2*color.rgb)/2.0;
	}
	else
	{
		color.rgb *= lit;
	}


#endif

#if hasAmbientMap
#if !(lightPoint||lightDirectional||lightSpot||lightArea)
	color.rgb = color.rgb*texture2D(ambientMap, texCoord).rgb;							
#else
  color.rgb = color.rgb+texture2D(ambientMap, texCoord).rgb;							
#endif
#else
#if !hasColorMap
	color.rgb += mAmb;
#else
  color.rgb += mAmb*texture2D(colorMap, texCoord).rgb;
#endif
#endif

#if alphaDepth
#if !hasAlpha
  float linear_depth = DepthRange( ConvertDepth3( gl_FragCoord.z ));

  color.a = linear_depth;
#endif
#endif

	gl_FragColor = color;

//gl_FragColor = vec4(1.0,0.0,1.0,0.0);

}