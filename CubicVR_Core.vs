	attribute vec3 aVertexPosition;
	attribute vec3 aNormal;

#if loopCount
struct Light {
  vec3 lDir;
  vec3 lPos;
  vec3 lSpec;
  vec3 lDiff;
  float lInt;
  float lDist;
};
 uniform Light lights[loopCount];
 #if lightDirectional
 	varying vec3 lightDir[loopCount];
 #endif
#else
  #if lightDirectional
  	uniform vec3 lDir;
  	varying vec3 lightDir;
  #endif

  #if lightPoint
  	uniform vec3 lPos;
  #endif
#endif

#if lightPoint
#if loopCount
  varying vec3 lightPos[loopCount];
#else
  varying vec3 lightPos;
#endif
#endif

  vec3 mSpec;
  float mShine;

	uniform mat4 uMVMatrix;
	uniform mat4 uPMatrix;
	uniform mat4 uOMatrix;
	
#if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap
  attribute vec2 aTextureCoord;
	varying vec2 vTextureCoord;
#endif

	varying vec3 vNormal;
	varying vec4 vPosition;

#if hasEnvSphereMap
#if hasNormalMap
	varying vec3 u;
#else
	varying vec2 vEnvTextureCoord;
#endif
#endif



varying vec3 camPos;

	
#if hasBumpMap
	varying vec3 eyeVec; 
#endif

void main(void) 
{
	mat4 uMVOMatrix = uMVMatrix * uOMatrix;
	mat4 uMVPMatrix = uPMatrix * uMVMatrix;
	
	
	vPosition = uMVOMatrix * vec4(aVertexPosition, 1.0);

	camPos.xyz = -(uMVMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
	
	gl_Position = uPMatrix * vPosition;

#if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap	
	vTextureCoord = aTextureCoord;
#endif

	//vNormal = normalize((uMVOMatrix * vec4(aNormal,0.0)).xyz); 
	vNormal = ((uMVOMatrix * vec4(aVertexPosition+aNormal, 1.0))-vec4(vPosition.xyz,0.0)).xyz;

#if lightDirectional
#if loopCount
    for (int i = 0; i < loopCount; i++)
    {
  	lightDir[i] = normalize((uMVMatrix * vec4(lights[i].lDir,0.0)).xyz);
    }
  #else    
  	lightDir = normalize((uMVMatrix * vec4(lDir,0.0)).xyz);
	#endif
#endif

#if lightPoint
#if loopCount
    for (int i = 0; i < loopCount; i++)
    {
      lightPos[i] = (uMVMatrix * vec4(lights[i].lPos,1.0)).xyz;
    }
#else
	  lightPos = (uMVMatrix * vec4(lPos,1.0)).xyz;
#endif	
#endif

#if hasEnvSphereMap
#if hasNormalMap
 	u = normalize( vPosition ).xyz;
 #else
	vec3 u = normalize( vec3(uMVMatrix * vec4(vPosition.xyz,1.0)) );
	vec3 r = reflect( vPosition.xyz - camPos, v_n );
	float m = 2.0 * sqrt( r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0) );
	vEnvTextureCoord.s = r.x/m + 0.5;
	vEnvTextureCoord.t = r.y/m + 0.5;
#endif
#endif


#if hasBumpMap
	vec3 tangent;
	vec3 binormal;

	vec3 c1 = cross( aNormal, vec3(0.0, 0.0, 1.0) );
	vec3 c2 = cross( aNormal, vec3(0.0, 1.0, 0.0) );

	if( length(c1)>length(c2) )
	{
		tangent = c1;
	}
	else
	{
		tangent = c2;
	}

	tangent = normalize(tangent);

	binormal = cross(aNormal, tangent);
	binormal = normalize(binormal);

	mat3 TBNMatrix = mat3( (vec3 (uMVOMatrix * vec4 (tangent, 0.0))), (vec3 (uMVOMatrix * vec4 (binormal, 0.0))), (vec3 (uMVOMatrix * vec4 (aNormal, 0.0))));
	eyeVec = vec3(uMVOMatrix * vec4(aVertexPosition,1.0)) * TBNMatrix;
#endif
}