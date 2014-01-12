#ifdef GL_ES
#if LIGHT_PERPIXEL
    precision mediump float;
#else
    precision lowp float;
#endif
#endif

#if FOG_ENABLED
    uniform vec3 fogColor;
    uniform float fogDensity;

    uniform float fogNear;
    uniform float fogFar;
#endif

    uniform vec3 materialAmbient;
    uniform vec3 lightAmbient;
    uniform vec3 materialColor;

#if POINT_SIZE && !POINT_SPRITE && POINT_CIRCLE
    varying float ptSize;
    varying vec2 sPos;
#endif

#if LIGHT_PERPIXEL 

    uniform vec3 materialDiffuse;
    uniform vec3 materialSpecular;
    uniform float materialShininess;

#if LIGHT_IS_POINT||LIGHT_IS_DIRECTIONAL||LIGHT_IS_SPOT||LIGHT_IS_AREA
    uniform vec3 lightDirection[LIGHT_COUNT];
    uniform vec3 lightPosition[LIGHT_COUNT];
    uniform vec3 lightSpecular[LIGHT_COUNT];
    uniform vec3 lightDiffuse[LIGHT_COUNT];
    uniform float lightIntensity[LIGHT_COUNT];
    uniform float lightDistance[LIGHT_COUNT];
    #if LIGHT_IS_SPOT
        uniform float lightCutOffAngle[LIGHT_COUNT];
    #endif
#endif

#if LIGHT_IS_PROJECTOR
  uniform sampler2D lightProjectionMap[LIGHT_COUNT];
#endif

#if LIGHT_SHADOWED
  varying vec4 lightProjectionOut[LIGHT_COUNT];
  uniform sampler2D lightShadowMap[LIGHT_COUNT];
  uniform vec3 lightDepthClip[LIGHT_COUNT];
#endif

#else // !LIGHT_PERPIXEL
    varying vec3 lightColorOut;
    varying vec3 lightSpecularOut;

#endif  // LIGHT_PERPIXEL

  varying vec3 vertexNormalOut;
  varying vec2 vertexTexCoordOut;
  
#if VERTEX_COLOR
  varying vec3 vertexColorOut;
#endif  
  
#if FX_DEPTH_ALPHA||LIGHT_DEPTH_PASS||LIGHT_SHADOWED

  uniform vec3 postDepthInfo;
  float ConvertDepth3(float d) { return (postDepthInfo.x*postDepthInfo.y)/(postDepthInfo.y-d*(postDepthInfo.y-postDepthInfo.x));  }
  // transform range in world-z to 0-1 for near-far
  float DepthRange( float d ) { return ( d - postDepthInfo.x ) / ( postDepthInfo.y - postDepthInfo.x ); }

  float ConvertDepth3A(float d, float near, float far) { return (near*far)/(far-d*(far-near));  }
  // transform range in world-z to 0-1 for near-far
  float DepthRangeA( float d, float near, float far ) { return ( d - near ) / ( far - near ); }
#endif

#if LIGHT_DEPTH_PASS
  vec4 packFloatToVec4i(const float value)
  {
    const vec4 bitSh = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
    const vec4 bitMsk = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
    vec4 res = fract(value * bitSh);
    res -= res.xxyz * bitMsk;
    return res;
  }

#endif

#if LIGHT_SHADOWED
float unpackFloatFromVec4i(const vec4 value)
{
  const vec4 bitSh = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);
  return(dot(value, bitSh));
}

#if LIGHT_SHADOWED_SOFT
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

#if !LIGHT_DEPTH_PASS
#if TEXTURE_COLOR
  uniform sampler2D textureColor;
#endif

#if TEXTURE_BUMP||TEXTURE_NORMAL
  varying vec3 envEyeVectorOut;
#endif
#if TEXTURE_BUMP
  uniform sampler2D textureBump;
#endif


#if TEXTURE_ENVSPHERE
  uniform sampler2D textureEnvSphere;
  uniform float materialEnvironment;
  #if TEXTURE_NORMAL
     varying vec3 envTexCoordOut;
  #else
    varying vec2 envTexCoordOut;
  #endif
#endif

#if TEXTURE_REFLECT
  uniform sampler2D textureReflect;
#endif

#if TEXTURE_NORMAL
  uniform sampler2D textureNormal;
#endif

  uniform float materialAlpha;

#if TEXTURE_AMBIENT
  uniform sampler2D textureAmbient;
#endif

#if TEXTURE_SPECULAR
  uniform sampler2D textureSpecular;
#endif

#endif // !LIGHT_DEPTH_PASS

#if TEXTURE_ALPHA
  uniform sampler2D textureAlpha;
#endif

varying vec4 vertexPositionOut;

vec2 cubicvr_texCoord() {
  #if LIGHT_DEPTH_PASS
    return vertexTexCoordOut;
  #else    
    #if POINT_SPRITE
      return gl_PointCoord;
    #else
      #if TEXTURE_BUMP
        float height = texture2D(textureBump, vertexTexCoordOut.xy).r;  
        float v = (height) * 0.05 - 0.04; // * scale and - bias 
        vec3 eye = normalize(envEyeVectorOut); 
        return vertexTexCoordOut.xy + (eye.xy * v);
      #else 
        return vertexTexCoordOut;
      #endif  
    #endif
  #endif
}

#if TEXTURE_NORMAL && OES_STANDARD_DERIVATIVES

#extension GL_OES_standard_derivatives : enable

// Normal Mapping Without Precomputed Tangents: http://www.thetenthplanet.de/archives/1180

mat3 cotangent_frame( vec3 N, vec3 p, vec2 uv ) {
    // get edge vectors of the pixel triangle
    vec3 dp1 = dFdx( p );
    vec3 dp2 = dFdy( p );
    vec2 duv1 = dFdx( uv );
    vec2 duv2 = dFdy( uv );
 
    // solve the linear system
    vec3 dp2perp = cross( dp2, N );
    vec3 dp1perp = cross( N, dp1 );
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
 
    // construct a scale-invariant frame 
    float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );
    return mat3( T * invmax, B * invmax, N );
}

#define WITH_NORMALMAP_UNSIGNED 1
//#define WITH_NORMALMAP_GREEN_UP 1
//#define WITH_NORMAL_2CHANNEL 1

vec3 perturb_normal( vec3 N, vec3 V, vec2 texCoord ) {
    // assume N, the interpolated vertex normal and 
    // V, the view vector (vertex to eye)
    vec3 map = texture2D( textureNormal, texCoord ).xyz;
#ifdef WITH_NORMALMAP_UNSIGNED
    map = map * 255./127. - 128./127.;
#endif
#ifdef WITH_NORMALMAP_2CHANNEL
    map.z = sqrt( 1. - dot( map.xy, map.xy ) );
#endif
#ifdef WITH_NORMALMAP_GREEN_UP
    map.y = -map.y;
#endif
    mat3 TBN = cotangent_frame( N, -V, texCoord );
    return normalize( TBN * map );
}

#endif


vec3 cubicvr_normal(vec2 texCoord) {
#if TEXTURE_NORMAL && !LIGHT_DEPTH_PASS

    // use standard derivatives version if available
#if OES_STANDARD_DERIVATIVES 
    return perturb_normal(vertexNormalOut, vertexPositionOut.xyz, texCoord);
#else
    // fake it otherwise, doesn't play well with rotation
    vec3 bumpNorm = vec3(texture2D(textureNormal, texCoord));

    vec3 n = (vec4(normalize(vertexNormalOut),1.0)).xyz;
    bumpNorm = (bumpNorm-0.5)*2.0;
    bumpNorm.y = -bumpNorm.y;
    return normalize((n+bumpNorm)/2.0);
#endif

#else
    return normalize(vertexNormalOut);
#endif
}

#if FOG_ENABLED
vec4 apply_fog(vec4 color) {
    vec4 outColor = color;

    float depth = gl_FragCoord.z / gl_FragCoord.w;

#if USE_FOG_EXP
    const float LOG2 = 1.442695;
    float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
    fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );
    outColor = mix( color, vec4( fogColor, color.w ), fogFactor );
#endif

#if USE_FOG_LINEAR
    float fogFactor = smoothstep( fogNear, fogFar, depth );
    outColor = mix( color, vec4( fogColor, color.w ), fogFactor );
#endif

    return outColor;
}
#endif

vec4 cubicvr_color(vec2 texCoord) {
  vec4 color = vec4(0.0,0.0,0.0,0.0);

  #if POINT_SIZE && !POINT_SPRITE && POINT_CIRCLE
    if (length(sPos-(gl_FragCoord.xy)) > ptSize/2.0) {
        discard;
    }
  #endif

  #if !LIGHT_DEPTH_PASS
  #if TEXTURE_COLOR
    #if !(LIGHT_IS_POINT||LIGHT_IS_DIRECTIONAL||LIGHT_IS_SPOT||LIGHT_IS_AREA)
      color = texture2D(textureColor, texCoord).rgba;
      color.rgb *= materialColor;
      //vec4(lightAmbient,1.0)*
    #else
      color = texture2D(textureColor, texCoord).rgba;
      #if !TEXTURE_ALPHA
          if (color.a<=0.9) {
            discard;  
          } 
      #endif
      color.rgb *= materialColor;
    #endif
    #if VERTEX_COLOR
      color *= vec4(vertexColorOut,1.0);
    #endif
  #else
    #if VERTEX_COLOR
      color = vec4(vertexColorOut,1.0);
    #else
      color = vec4(materialColor,1.0);
    #endif
  #endif

  #if TEXTURE_ALPHA
    color.a = texture2D(textureAlpha, texCoord).r;
    #if FX_DEPTH_ALPHA
      if (color.a < 0.9) discard;
    #else
      #if MATERIAL_ALPHA
        color.a *= materialAlpha;
      #else
        if (color.a < 0.9) discard;
      #endif
    #endif
  #else
  #if MATERIAL_ALPHA
    color.a = materialAlpha;
  #endif
  #endif  
  #endif
  
  return color;
}

vec4 cubicvr_lighting(vec4 color_in, vec3 n, vec2 texCoord) {
  vec4 color = color_in;
#if !LIGHT_DEPTH_PASS
  vec3 accum = lightAmbient;
#if LIGHT_PERPIXEL
#if LIGHT_IS_POINT

  vec3 specTotal = vec3(0.0,0.0,0.0);

  for (int i = 0; i < LIGHT_COUNT; i++) {

    vec3 lightDirection = lightPosition[i]-vertexPositionOut.xyz;

    float dist = length(lightDirection);
  
    vec3 halfVector = normalize(vec3(0.0,0.0,1.0)+lightDirection);

    float NdotL = max(dot(normalize(lightDirection),n),0.0);

    if (NdotL > 0.0) {
      // basic diffuse
      float att = clamp(((lightDistance[i]-dist)/lightDistance[i]), 0.0, 1.0)*lightIntensity[i];

      accum += att * NdotL * lightDiffuse[i] * materialDiffuse;

      float NdotHV = max(dot(n, halfVector),0.0);

  
      #if TEXTURE_SPECULAR
        vec3 spec2 = lightSpecular[i] * texture2D(textureSpecular, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,materialShininess);
      #else
        vec3 spec2 = lightSpecular[i] * materialSpecular * pow(NdotHV,materialShininess);
      #endif
  
        specTotal += spec2;
    }
    
  }
  
  color.rgb *= accum;
  color.rgb += specTotal;
#endif




#if LIGHT_IS_DIRECTIONAL
  float NdotL;
  float NdotHV = 0.0;
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);

  vec3 halfVector;
  
  for (int i = 0; i < LIGHT_COUNT; i++) {

    halfVector = normalize(vec3(0.0,0.0,1.0)-lightDirection[i]);

    NdotL = max(dot(normalize(-lightDirection[i]),n),0.0);

    if (NdotL > 0.0)   {
      accum += lightIntensity[i] * materialDiffuse * lightDiffuse[i] * NdotL;    

       NdotHV = max(dot(n, halfVector),0.0);

      #if TEXTURE_SPECULAR
        spec2 = lightSpecular[i] * texture2D(textureSpecular, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,materialShininess);
      #else
        spec2 = lightSpecular[i] * materialSpecular * pow(NdotHV,materialShininess);
      #endif
      
      specTotal += spec2;
    }
  }  
  
  color.rgb *= accum;
  color.rgb += specTotal;
#endif


#if LIGHT_IS_AREA
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);
  float NdotL;
  float NdotHV = 0.0;

  vec3 halfVector;
  
  for (int i = 0; i < LIGHT_COUNT; i++) {
    halfVector = normalize(vec3(0.0,0.0,1.0)-lightDirection[i]);

   NdotL = max(dot(normalize(-lightDirection[i]),n),0.0);

   if (NdotL > 0.0)   {

    NdotHV = max(dot(n, halfVector),0.0);
   
#if LIGHT_SHADOWED
    vec4 shadowCoord = lightProjectionOut[i] / lightProjectionOut[i].w;
    
    shadowCoord.z = DepthRangeA(ConvertDepth3A(shadowCoord.z,lightDepthClip[i].x,lightDepthClip[i].y),lightDepthClip[i].x,lightDepthClip[i].y);

    vec4 shadowSample;

    float shadow = 1.0;
// this seems to get around a shader crash ...    
    if (shadowCoord.s > 0.000&&shadowCoord.s < 1.000 && shadowCoord.t > 0.000 && shadowCoord.t < 1.000) if (i == 0) { shadow = getShadowVal(lightShadowMap[0],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);} 
#if LIGHT_COUNT>1    
    if (i == 1) { shadow = getShadowVal(lightShadowMap[1],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z); }
#endif
#if LIGHT_COUNT>2    
    if (i == 2) { shadow = getShadowVal(lightShadowMap[2],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z); }
#endif
#if LIGHT_COUNT>3
    if (i == 3) { shadow = getShadowVal(lightShadowMap[3],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>4    
    if (i == 4) { shadow = getShadowVal(lightShadowMap[4],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>5    
    if (i == 5) { shadow = getShadowVal(lightShadowMap[5],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>6    
    if (i == 6) { shadow = getShadowVal(lightShadowMap[6],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>7
    if (i == 7) { shadow = getShadowVal(lightShadowMap[7],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z); }
#endif
       
    accum += shadow * lightIntensity[i] * materialDiffuse * lightDiffuse[i] * NdotL;
#else
    accum += lightIntensity[i] * materialDiffuse * lightDiffuse[i] * NdotL;
#endif

    #if TEXTURE_SPECULAR
      spec2 = lightSpecular[i] * texture2D(textureSpecular, vec2(texCoord.s, texCoord.t)).rgb * pow(NdotHV,materialShininess);
    #else
      spec2 = lightSpecular[i] * materialSpecular * pow(NdotHV,materialShininess);
    #endif

    #if LIGHT_SHADOWED
        spec2 *= shadow;
    #endif

    specTotal += spec2;
    
    #if LIGHT_SHADOWED
//      accum = texture2D(lightShadowMap[0], vec2(shadowCoord.s, shadowCoord.t)).rgb;
    #endif
    
    }
 }
  
  color.rgb *= accum;
  color.rgb += specTotal;

#endif


#if LIGHT_IS_SPOT
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);

  vec3 halfVector;
  float spotEffect;
  float spotDot;
  float power;
  
  for (int i = 0; i < LIGHT_COUNT; i++) {
    vec3 l = lightPosition[i]-vertexPositionOut.xyz;
    
    float dist = length(l);

    float att = clamp(((lightDistance[i]-dist)/lightDistance[i]), 0.0, 1.0)*lightIntensity[i];

    att = clamp(att,0.0,1.0);

    spotDot = dot(normalize(-l), normalize(lightDirection[i]));

    if ( spotDot < cos((lightCutOffAngle[i]/2.0)*(3.14159/180.0)) ) {
      spotEffect = 0.0;
    }
    else {
      spotEffect = pow(spotDot, 1.0);
    }

#if !LIGHT_IS_PROJECTOR
    att *= spotEffect;
#endif

    vec3 v = normalize(-vertexPositionOut.xyz);
    vec3 h = normalize(l + v);

    float NdotL = max(0.0, dot(n, normalize(l)));
    float NdotH = max(0.0, dot(n, h));

    if (NdotL > 0.0) {
      power = pow(NdotH, materialShininess);
    }
    else {
      power = 0.0;
    }

#if LIGHT_SHADOWED
    vec4 shadowCoord = lightProjectionOut[i] / lightProjectionOut[i].w;
    
    shadowCoord.z = DepthRangeA(ConvertDepth3A(shadowCoord.z,lightDepthClip[i].x,lightDepthClip[i].y),lightDepthClip[i].x,lightDepthClip[i].y);

    vec4 shadowSample;

    float shadow = 1.0;
// this seems to get around a shader crash ...    
    if (shadowCoord.s >= 0.000&&shadowCoord.s <= 1.000 && shadowCoord.t >= 0.000 && shadowCoord.t <= 1.000) if (i == 0) { shadow = getShadowVal(lightShadowMap[0],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);} 
#if LIGHT_COUNT>1    
    if (i == 1) { shadow = getShadowVal(lightShadowMap[1],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z); }
#endif
#if LIGHT_COUNT>2    
    if (i == 2) { shadow = getShadowVal(lightShadowMap[2],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z); }
#endif
#if LIGHT_COUNT>3
    if (i == 3) { shadow = getShadowVal(lightShadowMap[3],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>4    
    if (i == 4) { shadow = getShadowVal(lightShadowMap[4],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>5    
    if (i == 5) { shadow = getShadowVal(lightShadowMap[5],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>6    
    if (i == 6) { shadow = getShadowVal(lightShadowMap[6],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z);  }
#endif
#if LIGHT_COUNT>7
    if (i == 7) { shadow = getShadowVal(lightShadowMap[7],shadowCoord,lightProjectionOut[i].w,lightDepthClip[i].z); }
#endif
       
     att = att * shadow;
#endif

#if LIGHT_IS_PROJECTOR && LIGHT_SHADOWED
     if (shadowCoord.s >= 0.0&&shadowCoord.s <= 1.0 && shadowCoord.t >= 0.0 && shadowCoord.t <= 1.0 && spotDot > cos((90.0)*(3.14159/180.0))) {
        vec3 projTex = texture2D(lightProjectionMap[i],shadowCoord.st).rgb;
        accum += att * projTex * lightIntensity[i] * materialDiffuse * lightDiffuse[i] * NdotL;
     }
#else
    accum += att * lightDiffuse[i] * materialDiffuse * NdotL;    
#endif

    #if TEXTURE_SPECULAR
      spec2 = lightSpecular[i] * texture2D(textureSpecular, vec2(texCoord.s, texCoord.t)).rgb * power;
    #else
      spec2 = lightSpecular[i] * materialSpecular * power;
    #endif

#if LIGHT_SHADOWED
    spec2 *= shadow;
#endif

    specTotal += spec2*spotEffect;

  }  
  
  
  color.rgb *= accum;
  color.rgb += specTotal;

  #if LIGHT_SHADOWED
  //  color = texture2D(lightShadowMap[0], vec2(texCoord.s, texCoord.t)).rgba;

  #endif
#endif
#else
  // vertex lighting
  #if LIGHT_IS_POINT||LIGHT_IS_DIRECTIONAL||LIGHT_IS_SPOT||LIGHT_IS_AREA
     color.rgb *= lightColorOut;
     color.rgb += lightSpecularOut;
  #endif
#endif // LIGHT_PERPIXEL

#if TEXTURE_AMBIENT
#if LIGHT_IS_POINT||LIGHT_IS_DIRECTIONAL||LIGHT_IS_SPOT||LIGHT_IS_AREA
  color.rgb += texture2D(textureAmbient, texCoord).rgb*(vec3(1.0,1.0,1.0)+materialColor*materialAmbient);
#else
  color.rgb = color.rgb*texture2D(textureAmbient, texCoord).rgb;              
#endif
#else
#if TEXTURE_COLOR
  color.rgb += materialAmbient*texture2D(textureColor, texCoord).rgb;
#else
  color.rgb += materialColor*materialAmbient;
#endif
#endif
#endif

#if FOG_ENABLED
  return apply_fog(color);
#else
  return color;
#endif
}

vec4 cubicvr_environment(vec4 color_in, vec3 n, vec2 texCoord) {
  vec4 color = color_in;
#if !LIGHT_DEPTH_PASS
#if TEXTURE_REFLECT
  float environmentAmount = texture2D( textureReflect, texCoord).r;
#endif

#if TEXTURE_ENVSPHERE
    #if TEXTURE_NORMAL
      vec3 r = reflect( envTexCoordOut, n );
      float m = 2.0 * sqrt( r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0) );

      vec3 coord;
      coord.s = r.x/m + 0.5;
      coord.t = r.y/m + 0.5;
      
      #if TEXTURE_REFLECT
        color.rgb += materialColor*texture2D( textureEnvSphere, coord.st).rgb * environmentAmount;
       #else
        color.rgb += materialColor*texture2D( textureEnvSphere, coord.st).rgb * materialEnvironment;
       #endif
    #else
      #if TEXTURE_REFLECT
         color.rgb += materialColor*texture2D( textureEnvSphere, envTexCoordOut).rgb * environmentAmount;
      #else
         color.rgb += materialColor*texture2D( textureEnvSphere, envTexCoordOut).rgb * materialEnvironment;
      #endif
    #endif
#endif // TEXTURE_ENVSPHERE

#endif // ! LIGHT_DEPTH_PASS

#if FX_DEPTH_ALPHA
#if !MATERIAL_ALPHA
  float linear_depth = DepthRange( ConvertDepth3(gl_FragCoord.z) );

  color.a = linear_depth;
#endif
#endif
  return color;
}


#if LIGHT_DEPTH_PASS
vec4 cubicvr_depthPack(vec2 texCoord) {
#if TEXTURE_ALPHA
  float alphaVal = texture2D(textureAlpha, texCoord).r;
  if (alphaVal < 0.9) discard;
#endif

  return packFloatToVec4i(DepthRange( ConvertDepth3(gl_FragCoord.z)));
}
#endif

#define customShader_splice 1

void main(void) 
{  
  vec2 texCoord = cubicvr_texCoord();

#if !LIGHT_DEPTH_PASS
  vec4 color = cubicvr_color(texCoord);
  vec3 normal = cubicvr_normal(texCoord);
  
  color = cubicvr_environment(color,normal,texCoord);
  color = cubicvr_lighting(color,normal,texCoord);
  
  gl_FragColor = clamp(color,0.0,1.0);
#else // LIGHT_DEPTH_PASS for shadows, discard to cut
  gl_FragColor = cubicvr_depthPack(texCoord);
#endif
}
