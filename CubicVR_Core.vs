  attribute vec3 aVertexPosition;
  attribute vec3 aNormal;
  attribute vec2 aTextureCoord;

#if hasVertexColorMap
  attribute vec3 aColor;
  varying vec3 vColorMap;
#endif

#if hasMorph
  attribute vec3 amVertexPosition;
  attribute vec3 amNormal;  
  uniform float morphWeight;
#endif

  varying vec2 vTextureCoord;
  uniform vec2 uTexOffset;

#if !perPixel
#if lightPoint||lightDirectional||lightSpot||lightArea
    uniform vec3 lDir[loopCount];
    uniform vec3 lPos[loopCount];
    uniform vec3 lSpec[loopCount];
    uniform vec3 lDiff[loopCount];
    uniform float lInt[loopCount];
    uniform float lDist[loopCount];
    #if lightSpot
        uniform float lCut[loopCount];
    #endif

    varying vec3 vColor;
    varying vec3 vSpec;
#endif

  uniform vec3 mDiff;  
  uniform vec3 mSpec;
  uniform float mShine;

#endif


//  #if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap
//  #endif

  uniform mat4 uMVMatrix;
  uniform mat4 uPMatrix;
  uniform mat4 uOMatrix;
  uniform mat3 uNMatrix;

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


mat4 uMVOMatrix;
mat4 uMVPMatrix;

void cubicvr_vertex_lighting() {
#if !perPixel
#if lightPoint

  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 accum = vec3(0.0,0.0,0.0);
  
  for (int i = 0; i < loopCount; i++) {

    vec3 lDir = lPos[i]-vPosition.xyz;

    float dist = length(lDir);
  
    vec3 halfVector = normalize(vec3(0.0,0.0,1.0)+lDir);

    float NdotL = max(dot(normalize(lDir),vNormal),0.0);

    if (NdotL > 0.0) {
      // basic diffuse
      float att = clamp(((lDist[i]-dist)/lDist[i]), 0.0, 1.0)*lInt[i];

      accum += att * NdotL * lDiff[i] * mDiff;

      float NdotHV = max(dot(vNormal, halfVector),0.0);

      vec3 spec2 = lSpec[i] * mSpec * pow(NdotHV,mShine);
  
      specTotal += spec2;
    }
    
  }
  
  vColor = accum;
  vSpec = specTotal;
#endif

#if lightDirectional
  float NdotL;
  float NdotHV = 0.0;
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);
  vec3 accum = vec3(0.0,0.0,0.0);

  vec3 halfVector;
  
  for (int i = 0; i < loopCount; i++) {

    halfVector = normalize(vec3(0.0,0.0,1.0)-lDir[i]);

    NdotL = max(dot(normalize(-lDir[i]),vNormal),0.0);

    if (NdotL > 0.0)   {
      accum += lInt[i] * mDiff * lDiff[i] * NdotL;    

      NdotHV = max(dot(vNormal, halfVector),0.0);

      spec2 = lSpec[i] * mSpec * pow(NdotHV,mShine);
      
      specTotal += spec2;
    }
  }  
  
  vColor = accum;
  vSpec = specTotal;
#endif

#if lightSpot
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);
  vec3 accum = vec3(0.0,0.0,0.0);

  vec3 halfVector;
  float spotEffect;
  float spotDot;
  float power;
 
  for (int i = 0; i < loopCount; i++) {
    vec3 l = lPos[i]-vPosition.xyz;
    
    float dist = length(l);

    float att = clamp(((lDist[i]-dist)/lDist[i]), 0.0, 1.0)*lInt[i];

    att = clamp(att,0.0,1.0);

    spotDot = dot(normalize(-l), normalize(lDir[i]));

    if ( spotDot < cos((lCut[i]/2.0)*(3.14159/180.0)) ) {
      spotEffect = 0.0;
    }
    else {
      spotEffect = pow(spotDot, 1.0);
    }

    att *= spotEffect;

    vec3 v = normalize(-vPosition.xyz);
    vec3 h = normalize(l + v);

    float NdotL = max(0.0, dot(vNormal, normalize(l)));
    float NdotH = max(0.0, dot(vNormal, h));

    if (NdotL > 0.0) {
      power = pow(NdotH, mShine);
    }
    else {
      power = 0.0;
    }


    accum += att * lDiff[i] * mDiff * NdotL;

    spec2 = lSpec[i] * mSpec * power;

    specTotal += spec2*spotEffect;

  }  
  
  vColor = accum;
  vSpec = specTotal;
#endif  
#endif // !perPixel

}


void cubicvr_normalmap() {
#if !depthPack
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
#endif
}

void cubicvr_environment() {
#if !depthPack
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
#if hasVertexColorMap
  vColorMap = aColor;
#endif
#endif
}

void cubicvr_shadow() {
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
}

vec2 cubicvr_texcoord() {
  return aTextureCoord + uTexOffset;
}


vec4 cubicvr_transform() {

  uMVOMatrix = uMVMatrix * uOMatrix;
  uMVPMatrix = uPMatrix * uMVMatrix;

  #if hasMorph
    vPosition = uMVOMatrix * vec4(aVertexPosition+(amVertexPosition-aVertexPosition)*morphWeight, 1.0);
    return uMVPMatrix * uOMatrix * vec4(aVertexPosition+(amVertexPosition-aVertexPosition)*morphWeight, 1.0);
  #else
    vPosition = uMVOMatrix * vec4(aVertexPosition, 1.0);
    return uMVPMatrix * uOMatrix * vec4(aVertexPosition, 1.0);
  #endif
}

vec3 cubicvr_normal() {
  #if hasMorph
    return uNMatrix * normalize(uOMatrix*vec4(aNormal+(amNormal-aNormal)*morphWeight,0.0)).xyz;
  #else
    return uNMatrix * normalize(uOMatrix*vec4(aNormal,0.0)).xyz;
  #endif  
}

#define customShader_splice 1

void main(void) 
{
  vTextureCoord = cubicvr_texcoord();
  gl_Position = cubicvr_transform();

#if !depthPack  // not needed if shadowing 

  vNormal = cubicvr_normal();  
  cubicvr_vertex_lighting();  
  cubicvr_normalmap();
  cubicvr_shadow();
  cubicvr_environment();

#endif // !depthPack
}
