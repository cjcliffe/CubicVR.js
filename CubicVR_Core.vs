  attribute vec3 aVertexPosition;
  attribute vec3 aNormal;
  attribute vec2 aTextureCoord;

#if hasVertexColorMap
  attribute vec3 aColor;
  varying vec3 cmapColor;
#endif

#if hasMorph
  attribute vec3 amVertexPosition;
  attribute vec3 amNormal;  
  uniform float morphWeight;
#endif

  varying vec2 vTextureCoord;


//  #if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap
//  #endif

  uniform mat4 uMVMatrix;
  uniform mat4 uPMatrix;
  uniform mat4 uOMatrix;
  uniform mat3 uNMatrix;

  vec3 mSpec;
  float mShine;

  varying vec3 vNormal;
  varying vec4 vPosition;

#if !depthPack


#if hasShadow
  varying vec4 shadowProj[loopCount];
  uniform mat4 spMatrix[loopCount];
#endif


#if hasEnvSphereMap
#if hasNormalMap
  varying vec3 u;
#else
  varying vec2 vEnvTextureCoord;
#endif
#endif


  
#if hasBumpMap||hasNormalMap
  varying vec3 eyeVec; 
#endif

#endif // !depthPack

void main(void) 
{
  mat4 uMVOMatrix = uMVMatrix * uOMatrix;
  mat4 uMVPMatrix = uPMatrix * uMVMatrix;

#if hasMorph
  vPosition = uMVOMatrix * vec4(aVertexPosition+(amVertexPosition-aVertexPosition)*morphWeight, 1.0);
  gl_Position = uMVPMatrix * uOMatrix * vec4(aVertexPosition+(amVertexPosition-aVertexPosition)*morphWeight, 1.0);
#else
  vPosition = uMVOMatrix * vec4(aVertexPosition, 1.0);
  gl_Position = uMVPMatrix * uOMatrix * vec4(aVertexPosition, 1.0);
#endif


  vTextureCoord = aTextureCoord;

#if !depthPack

#if hasVertexColorMap
  cmapColor = aColor;
#endif

#if hasMorph
  vNormal = uNMatrix * normalize(uOMatrix*vec4(aNormal+(amNormal-aNormal)*morphWeight,0.0)).xyz;
#else
  vNormal = uNMatrix * normalize(uOMatrix*vec4(aNormal,0.0)).xyz;
#endif  


#if hasBumpMap||hasNormalMap
  vec3 tangent;
  vec3 binormal;

  vec3 c1 = cross( aNormal, vec3(0.0, 0.0, 1.0) );
  vec3 c2 = cross( aNormal, vec3(0.0, 1.0, 0.0) );

  if ( length(c1) > length(c2) )  {
    tangent = c1;
  }  else {
    tangent = c2;
  }

  tangent = normalize(tangent);

  binormal = cross(aNormal, tangent);
  binormal = normalize(binormal);

  mat3 TBNMatrix = mat3( (vec3 (uMVOMatrix * vec4 (tangent, 0.0))), 
                         (vec3 (uMVOMatrix * vec4 (binormal, 0.0))), 
                         (vec3 (uMVOMatrix * vec4 (aNormal, 0.0)))
                       );

  eyeVec = vec3(uMVOMatrix * vec4(aVertexPosition,1.0)) * TBNMatrix;
#endif

#if (lightSpot||lightArea) && hasShadow
    for (int i = 0; i < loopCount; i++)
    {
#if hasShadow
#if hasMorph
      shadowProj[i] = spMatrix[i] * (uOMatrix * vec4(aVertexPosition+(amVertexPosition-aVertexPosition)*morphWeight, 1.0));
#else
      shadowProj[i] = spMatrix[i] * (uOMatrix * vec4(aVertexPosition, 1.0));
#endif
#endif      
    }
#endif

#if hasEnvSphereMap
#if hasNormalMap
   u = normalize( vPosition.xyz );
 #else
  vec3 ws = (uMVMatrix * vec4(aVertexPosition,1.0)).xyz;
  vec3 u = normalize( vPosition.xyz );
  vec3 r = reflect(ws, vNormal );
  float m = 2.0 * sqrt( r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0) );
  vEnvTextureCoord.s = r.x/m + 0.5;
  vEnvTextureCoord.t = r.y/m + 0.5;
#endif
#endif

#endif // !depthPack
}
