#ifdef GL_ES
#if perPixel
  precision highp float;
#else
  precision lowp float;
#endif
#endif

  uniform vec3 mAmb;
  uniform vec3 lAmb;
  uniform vec3 mColor;

#if perPixel 

  uniform vec3 mDiff;
  uniform vec3 mSpec;
  uniform float mShine;

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
#endif

#if hasProjector
  uniform sampler2D lProjTex[loopCount];
#endif

#if hasShadow
  varying vec4 shadowProj[loopCount];
  uniform sampler2D lDepthTex[loopCount];
  uniform vec3 lDepth[loopCount];
#endif

#else // !perPixel
    varying vec3 vColor;
    varying vec3 vSpec;

#endif  // perPixel

  varying vec3 vNormal;
  varying vec2 vTextureCoord;
  
#if hasVertexColorMap
  varying vec3 vColorMap;
#endif  
  


#if alphaDepth||depthPack||hasShadow

  uniform vec3 depthInfo;
  float ConvertDepth3(float d) { return (depthInfo.x*depthInfo.y)/(depthInfo.y-d*(depthInfo.y-depthInfo.x));  }
  // transform range in world-z to 0-1 for near-far
  float DepthRange( float d ) { return ( d - depthInfo.x ) / ( depthInfo.y - depthInfo.x ); }

  float ConvertDepth3A(float d, float near, float far) { return (near*far)/(far-d*(far-near));  }
  // transform range in world-z to 0-1 for near-far
  float DepthRangeA( float d, float near, float far ) { return ( d - near ) / ( far - near ); }
#endif

#if depthPack
  vec4 packFloatToVec4i(const float value)
  {
    const vec4 bitSh = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
    const vec4 bitMsk = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
    vec4 res = fract(value * bitSh);
    res -= res.xxyz * bitMsk;
    return res;
  }

#endif

#if hasShadow
float unpackFloatFromVec4i(const vec4 value)
{
  const vec4 bitSh = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);
  return(dot(value, bitSh));
}

#if softShadow
float getShadowVal(sampler2D shadowTex,vec4 shadowCoord, float proj, float texel_size) {
  vec2 filterTaps[6]; 
  filterTaps[0] = vec2(-0.326212,-0.40581);
  filterTaps[1] = vec2(-0.840144,-0.07358);
  filterTaps[2] = vec2(-0.695914,0.457137);
  filterTaps[3] = vec2(-0.203345,0.620716);
  filterTaps[4] = vec2(0.96234,-0.194983);
  filterTaps[5] = vec2(0.473434,-0.480026); 
  
/*  filterTaps[6] = vec2(0.519456,0.767022);
  filterTaps[7] = vec2(0.185461,-0.893124); 
  filterTaps[8] = vec2(0.507431,0.064425);
  filterTaps[9] = vec2(0.89642,0.412458) ;
  filterTaps[10] =vec2(-0.32194,-0.932615);
  filterTaps[11] =vec2(-0.791559,-0.59771); */

   float shadow = 0.0;   
   vec4  shadowSample;
   float distanceFromLight;
  
   for (int i = 0; i < 6; i++) {
    shadowSample = texture2D(shadowTex,shadowCoord.st+filterTaps[i]*(2.0*texel_size));

   distanceFromLight = unpackFloatFromVec4i(shadowSample);
  
   shadow += distanceFromLight <= shadowCoord.z ? 0.0 : 1.0 ;
  }

  shadow /= 6.0;
  
  return shadow;
}
#else
float getShadowVal(sampler2D shadowTex,vec4 shadowCoord, float proj, float texel_size) {
  vec4 shadowSample = texture2D(shadowTex,shadowCoord.st);

  float distanceFromLight = unpackFloatFromVec4i(shadowSample);
  float shadow = 1.0;
   
  shadow = distanceFromLight <= (shadowCoord.z) ? 0.0 : 1.0 ;
  
  return shadow;
}
#endif
#endif

#if !depthPack
#if hasColorMap
  uniform sampler2D colorMap;
#endif

#if hasBumpMap||hasNormalMap
  varying vec3 eyeVec;
#endif
#if hasBumpMap
  uniform sampler2D bumpMap;
#endif


#if hasEnvSphereMap
  uniform sampler2D envSphereMap;
  uniform float envAmount;
  #if hasNormalMap
     varying vec3 u;
  #else
    varying vec2 vEnvTextureCoord;
  #endif
#endif

#if hasReflectMap
  uniform sampler2D reflectMap;
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

#endif // !depthPack

#if hasAlphaMap
  uniform sampler2D alphaMap;
#endif

varying vec4 vPosition;

vec2 cubicvr_texcoord() {
  #if depthPack
    return vTextureCoord;
  #else    
    #if hasBumpMap
      float height = texture2D(bumpMap, vTextureCoord.xy).r;  
      float v = (height) * 0.05 - 0.04; // * scale and - bias 
      vec3 eye = normalize(eyeVec); 
      return vTextureCoord.xy + (eye.xy * v);
    #else 
    //#if hasColorMap||hasBumpMap||hasNormalMap||hasAmbientMap||hasSpecularMap||hasAlphaMap
      return vTextureCoord;
    //#endif
    #endif  
  #endif
}

vec3 cubicvr_normal(vec2 texCoord) {
#if hasNormalMap && !depthPack
    vec3 bumpNorm = vec3(texture2D(normalMap, texCoord));

    vec3 n = (vec4(normalize(vNormal),1.0)).xyz;
    bumpNorm = (bumpNorm-0.5)*2.0;
    bumpNorm.y = -bumpNorm.y;
    return normalize((n+bumpNorm)/2.0);
#else
    return normalize(vNormal);
#endif
}

vec4 cubicvr_color(vec2 texCoord) {
  vec4 color = vec4(0.0,0.0,0.0,0.0);
  #if !depthPack
  #if hasColorMap
    #if !(lightPoint||lightDirectional||lightSpot||lightArea)
      color = texture2D(colorMap, vec2(texCoord.s, texCoord.t)).rgba;
      color.rgb *= mColor;
      //vec4(lAmb,1.0)*
    #else
      color = texture2D(colorMap, vec2(texCoord.s, texCoord.t)).rgba;
      color.rgb *= mColor;
    #endif
    if (color.a<=0.9) discard;  
  #else
    #if hasVertexColorMap
      color = vec4(vColorMap,1.0);
    #else
      color = vec4(mColor,1.0);
    #endif
  #endif

  #if hasAlphaMap
    color.a = texture2D(alphaMap, texCoord).r;
    #if alphaDepth
      if (color.a < 0.9) discard;
    #else
      #if !hasAlpha
        if (color.a<0.9) discard;
      #else
        if (color.a==0.0) discard;
      #endif
    #endif
  #else
  #if hasAlpha
    color.a = mAlpha;
  #endif
  #endif  
  #endif
  
  return color;
}

vec4 cubicvr_fragment_lighting(vec4 color_in, vec3 n, vec2 texCoord) {
vec3 accum = lAmb;
vec4 color = color_in;

#if perPixel
#if lightPoint

  vec3 specTotal = vec3(0.0,0.0,0.0);

  for (int i = 0; i < loopCount; i++) {

    vec3 lDir = lPos[i]-vPosition.xyz;

    float dist = length(lDir);
  
    vec3 halfVector = normalize(vec3(0.0,0.0,1.0)+lDir);

    float NdotL = max(dot(normalize(lDir),n),0.0);

    if (NdotL > 0.0) {
      // basic diffuse
      float att = clamp(((lDist[i]-dist)/lDist[i]), 0.0, 1.0)*lInt[i];

      accum += att * NdotL * lDiff[i] * mDiff;

      float NdotHV = max(dot(n, halfVector),0.0);

  
      #if hasSpecularMap
        vec3 spec2 = lSpec[i] * texture2D(specularMap, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,mShine);
      #else
        vec3 spec2 = lSpec[i] * mSpec * pow(NdotHV,mShine);
      #endif
  
        specTotal += spec2;
    }
    
  }
  
  color.rgb *= accum;
  color.rgb += specTotal;
#endif




#if lightDirectional
  float NdotL;
  float NdotHV = 0.0;
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);

  vec3 halfVector;
  
  for (int i = 0; i < loopCount; i++) {

    halfVector = normalize(vec3(0.0,0.0,1.0)-lDir[i]);

    NdotL = max(dot(normalize(-lDir[i]),n),0.0);

    if (NdotL > 0.0)   {
      accum += lInt[i] * mDiff * lDiff[i] * NdotL;    

       NdotHV = max(dot(n, halfVector),0.0);

      #if hasSpecularMap
        spec2 = lSpec[i] * texture2D(specularMap, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,mShine);
      #else
        spec2 = lSpec[i] * mSpec * pow(NdotHV,mShine);
      #endif
      
      specTotal += spec2;
    }
  }  
  
  color.rgb *= accum;
  color.rgb += specTotal;
#endif


#if lightArea
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);
  float NdotL;
  float NdotHV = 0.0;

  vec3 halfVector;
  
  for (int i = 0; i < loopCount; i++) {
    halfVector = normalize(vec3(0.0,0.0,1.0)-lDir[i]);

   NdotL = max(dot(normalize(-lDir[i]),n),0.0);

   if (NdotL > 0.0)   {

    NdotHV = max(dot(n, halfVector),0.0);
   
#if hasShadow
    vec4 shadowCoord = shadowProj[i] / shadowProj[i].w;
    
    shadowCoord.z = DepthRangeA(ConvertDepth3A(shadowCoord.z,lDepth[i].x,lDepth[i].y),lDepth[i].x,lDepth[i].y);

    vec4 shadowSample;

    float shadow = 1.0;
// this seems to get around a shader crash ...    
    if (shadowCoord.s > 0.000&&shadowCoord.s < 1.000 && shadowCoord.t > 0.000 && shadowCoord.t < 1.000) if (i == 0) { shadow = getShadowVal(lDepthTex[0],shadowCoord,shadowProj[i].w,lDepth[i].z);} 
#if loopCount>1    
    else if (i == 1) { shadow = getShadowVal(lDepthTex[1],shadowCoord,shadowProj[i].w,lDepth[i].z); }
#endif
#if loopCount>2    
    else if (i == 2) { shadow = getShadowVal(lDepthTex[2],shadowCoord,shadowProj[i].w,lDepth[i].z); }
#endif
#if loopCount>3
    else if (i == 3) { shadow = getShadowVal(lDepthTex[3],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>4    
    else if (i == 4) { shadow = getShadowVal(lDepthTex[4],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>5    
    else if (i == 5) { shadow = getShadowVal(lDepthTex[5],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>6    
    else if (i == 6) { shadow = getShadowVal(lDepthTex[6],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>7
    else if (i == 7) { shadow = getShadowVal(lDepthTex[7],shadowCoord,shadowProj[i].w,lDepth[i].z); }
#endif
       
    accum += shadow * lInt[i] * mDiff * lDiff[i] * NdotL;
#else
    accum += lInt[i] * mDiff * lDiff[i] * NdotL;
#endif

    #if hasSpecularMap
      spec2 = lSpec[i] * texture2D(specularMap, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,mShine);
    #else
      spec2 = lSpec[i] * mSpec * pow(NdotHV,mShine);
    #endif

    #if hasShadow
        spec2 *= shadow;
    #endif

    specTotal += spec2;
    
    #if hasShadow
//      accum = texture2D(lDepthTex[0], vec2(shadowCoord.s, shadowCoord.t)).rgb;
    #endif
    
    }
 }
  
  color.rgb *= accum;
  color.rgb += specTotal;

#endif


#if lightSpot
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);

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

#if !hasProjector
    att *= spotEffect;
#endif

    vec3 v = normalize(-vPosition.xyz);
    vec3 h = normalize(l + v);

    float NdotL = max(0.0, dot(n, normalize(l)));
    float NdotH = max(0.0, dot(n, h));

    if (NdotL > 0.0) {
      power = pow(NdotH, mShine);
    }
    else {
      power = 0.0;
    }

#if hasShadow
    vec4 shadowCoord = shadowProj[i] / shadowProj[i].w;
    
    shadowCoord.z = DepthRangeA(ConvertDepth3A(shadowCoord.z,lDepth[i].x,lDepth[i].y),lDepth[i].x,lDepth[i].y);

    vec4 shadowSample;

    float shadow = 1.0;
// this seems to get around a shader crash ...    
    if (shadowCoord.s >= 0.000&&shadowCoord.s <= 1.000 && shadowCoord.t >= 0.000 && shadowCoord.t <= 1.000) if (i == 0) { shadow = getShadowVal(lDepthTex[0],shadowCoord,shadowProj[i].w,lDepth[i].z);} 
#if loopCount>1    
    else if (i == 1) { shadow = getShadowVal(lDepthTex[1],shadowCoord,shadowProj[i].w,lDepth[i].z); }
#endif
#if loopCount>2    
    else if (i == 2) { shadow = getShadowVal(lDepthTex[2],shadowCoord,shadowProj[i].w,lDepth[i].z); }
#endif
#if loopCount>3
    else if (i == 3) { shadow = getShadowVal(lDepthTex[3],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>4    
    else if (i == 4) { shadow = getShadowVal(lDepthTex[4],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>5    
    else if (i == 5) { shadow = getShadowVal(lDepthTex[5],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>6    
    else if (i == 6) { shadow = getShadowVal(lDepthTex[6],shadowCoord,shadowProj[i].w,lDepth[i].z);  }
#endif
#if loopCount>7
    else if (i == 7) { shadow = getShadowVal(lDepthTex[7],shadowCoord,shadowProj[i].w,lDepth[i].z); }
#endif
       
     att = att * shadow;
#endif

#if hasProjector && hasShadow
     if (shadowCoord.s >= 0.0&&shadowCoord.s <= 1.0 && shadowCoord.t >= 0.0 && shadowCoord.t <= 1.0 && spotDot > cos((90.0)*(3.14159/180.0))) {
        vec3 projTex = texture2D(lProjTex[i],shadowCoord.st).rgb;
        accum += att * projTex * lInt[i] * mDiff * lDiff[i] * NdotL;
     }
#else
    accum += att * lDiff[i] * mDiff * NdotL;    
#endif

    #if hasSpecularMap
      spec2 = lSpec[i] * texture2D(specularMap, vec2(texCoord.s, texCoord.t)).rgb * power;
    #else
      spec2 = lSpec[i] * mSpec * power;
    #endif

#if hasShadow
    spec2 *= shadow;
#endif

    specTotal += spec2*spotEffect;

  }  
  
  
  color.rgb *= accum;
  color.rgb += specTotal;

  #if hasShadow
  //  color = texture2D(lDepthTex[0], vec2(texCoord.s, texCoord.t)).rgba;

  #endif
#endif
#else
  // vertex lighting
  #if lightPoint||lightDirectional||lightSpot||lightArea
     color.rgb *= vColor;
     color.rgb += vSpec;
  #endif
#endif // perPixel

  return color;
}

vec4 cubicvr_environment(vec4 color_in, vec3 n, vec2 texCoord) {
  vec4 color = color_in;
#if !depthPack
#if hasReflectMap
  float environmentAmount = texture2D( reflectMap, texCoord).r;
#endif

#if hasEnvSphereMap
#if hasNormalMap
  vec3 r = reflect( u, n );
  float m = 2.0 * sqrt( r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0) );

  vec3 coord;
  coord.s = r.x/m + 0.5;
  coord.t = r.y/m + 0.5;
  
  #if hasReflectMap
    color.rgb += mColor*texture2D( envSphereMap, coord.st).rgb * environmentAmount;
   #else
    color.rgb += mColor*texture2D( envSphereMap, coord.st).rgb * envAmount;
   #endif

#else
  #if hasReflectMap
     color.rgb += mColor*texture2D( envSphereMap, vEnvTextureCoord).rgb * environmentAmount;
  #else
     color.rgb += mColor*texture2D( envSphereMap, vEnvTextureCoord).rgb*envAmount;
  #endif
#endif

#endif



#if hasAmbientMap
#if lightPoint||lightDirectional||lightSpot||lightArea
  color.rgb += texture2D(ambientMap, texCoord).rgb*(vec3(1.0,1.0,1.0)+mColor*mAmb);
#else
  color.rgb = color.rgb*texture2D(ambientMap, texCoord).rgb;              
#endif
#else
#if !hasColorMap
  color.rgb += mColor*mAmb;
#else
  color.rgb += mAmb*texture2D(colorMap, texCoord).rgb;
#endif
#endif
#endif

#if alphaDepth
#if !hasAlpha
  float linear_depth = DepthRange( ConvertDepth3(gl_FragCoord.z) );

  color.a = linear_depth;
#endif
#endif
  return color;
}

#if depthPack
vec4 cubicvr_depthpack(vec2 texCoord) {
#if hasAlphaMap
  float alphaVal = texture2D(alphaMap, texCoord).r;
  if (alphaVal < 0.9) discard;
#endif

  return packFloatToVec4i(DepthRange( ConvertDepth3(gl_FragCoord.z)));
}
#endif

#define customShader_splice 1

void main(void) 
{  
  vec2 texCoord = cubicvr_texcoord();

#if !depthPack
  vec4 color = cubicvr_color(texCoord);
  vec3 normal = cubicvr_normal(texCoord);
  color = cubicvr_environment(color,normal,texCoord);
  color = cubicvr_fragment_lighting(color,normal,texCoord);
  
  gl_FragColor = clamp(color,0.0,1.0);
#else // depthPack for shadows, discard to cut
  gl_FragColor = cubicvr_depthpack(texCoord);
#endif
}
