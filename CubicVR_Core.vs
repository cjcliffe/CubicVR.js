 attribute vec3 vertexPosition;
 attribute vec3 vertexNormal;
 attribute vec2 vertexTexCoord;

#if VERTEX_COLOR
 attribute vec3 vertexColor;
 varying vec3 vertexColorOut;
#endif

#if VERTEX_MORPH
 attribute vec3 vertexMorphPosition;
 attribute vec3 vertexMorphNormal;  
 uniform float materialMorphWeight;
#endif

#if POINT_SIZE||POINT_SPRITE
    uniform float pointSize;
#endif

#if POINT_SIZE && !POINT_SPRITE && POINT_CIRCLE
    varying float ptSize;
    #if POINT_CIRCLE
        varying vec2 sPos;
        uniform vec3 viewPort;
    #endif
#endif

  varying vec2 vertexTexCoordOut;
  uniform vec2 materialTexOffset;

#if !LIGHT_PERPIXEL
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

  varying vec3 lightColorOut;
  varying vec3 lightSpecularOut;
#endif

  uniform vec3 materialDiffuse;  
  uniform vec3 materialSpecular;
  uniform float materialShininess;

#endif


//  #if TEXTURE_COLOR||TEXTURE_BUMP||TEXTURE_NORMAL||TEXTURE_AMBIENT||hasSpecularMap||hasAlphaMap
//  #endif

  uniform mat4 matrixModelView;
  uniform mat4 matrixProjection;
  uniform mat4 matrixObject;
  uniform mat3 matrixNormal;

  varying vec3 vertexNormalOut;
  varying vec4 vertexPositionOut;

#if !LIGHT_DEPTH_PASS


#if LIGHT_SHADOWED
  varying vec4 lightProjectionOut[LIGHT_COUNT];
  uniform mat4 lightShadowMatrix[LIGHT_COUNT];
#endif


#if TEXTURE_ENVSPHERE
#if TEXTURE_NORMAL
  varying vec3 envTexCoordOut;
#else
  varying vec2 envTexCoordOut;
#endif
#endif


  
#if TEXTURE_BUMP||TEXTURE_NORMAL
  varying vec3 envEyeVectorOut; 
#endif

#endif // !LIGHT_DEPTH_PASS



void cubicvr_normalMap() {
#if !LIGHT_DEPTH_PASS
#if TEXTURE_BUMP||TEXTURE_NORMAL
  vec3 tangent;
  vec3 binormal;

  vec3 c1 = cross( vertexNormal, vec3(0.0, 0.0, 1.0) );
  vec3 c2 = cross( vertexNormal, vec3(0.0, 1.0, 0.0) );

  if ( length(c1) > length(c2) )  {
    tangent = c1;
  }  else {
    tangent = c2;
  }

  tangent = normalize(tangent);

  binormal = cross(vertexNormal, tangent);
  binormal = normalize(binormal);

  mat4 uMVOMatrix = matrixModelView * matrixObject;

  mat3 TBNMatrix = mat3( (vec3 (uMVOMatrix * vec4 (tangent, 0.0))), 
                         (vec3 (uMVOMatrix * vec4 (binormal, 0.0))), 
                         (vec3 (uMVOMatrix * vec4 (vertexNormal, 0.0)))
                       );

  envEyeVectorOut = vec3(uMVOMatrix * vec4(vertexPosition,1.0)) * TBNMatrix;  
#endif
#endif
}

void cubicvr_environmentMap() {
#if !LIGHT_DEPTH_PASS
#if TEXTURE_ENVSPHERE
  #if TEXTURE_NORMAL
     envTexCoordOut = normalize( vertexPositionOut.xyz );
   #else
    vec3 ws = (matrixModelView * vec4(vertexPosition,1.0)).xyz;
    vec3 r = reflect(ws, vertexNormalOut );
    float m = 2.0 * sqrt( r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0) );
    envTexCoordOut.s = r.x/m + 0.5;
    envTexCoordOut.t = r.y/m + 0.5;
  #endif  
#endif
#if VERTEX_COLOR
  vertexColorOut = vertexColor;
#endif
#endif
}

void cubicvr_shadowMap() {
  #if (LIGHT_IS_SPOT||LIGHT_IS_AREA) && LIGHT_SHADOWED
      for (int i = 0; i < LIGHT_COUNT; i++)
      {
  #if LIGHT_SHADOWED
  #if VERTEX_MORPH
        lightProjectionOut[i] = lightShadowMatrix[i] * (matrixObject * vec4(vertexPosition+(vertexMorphPosition-vertexPosition)*materialMorphWeight, 1.0));
  #else
        lightProjectionOut[i] = lightShadowMatrix[i] * (matrixObject * vec4(vertexPosition, 1.0));
  #endif
  #endif      
      }
  #endif
}

void cubicvr_lighting() {
#if !LIGHT_PERPIXEL
#if LIGHT_IS_POINT

  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 accum = vec3(0.0,0.0,0.0);
  
  for (int i = 0; i < LIGHT_COUNT; i++) {

    vec3 lightDirection = lightPosition[i]-vertexPositionOut.xyz;

    float dist = length(lightDirection);
  
    vec3 halfVector = normalize(vec3(0.0,0.0,1.0)+lightDirection);

    float NdotL = max(dot(normalize(lightDirection),vertexNormalOut),0.0);

    if (NdotL > 0.0) {
      // basic diffuse
      float att = clamp(((lightDistance[i]-dist)/lightDistance[i]), 0.0, 1.0)*lightIntensity[i];

      accum += att * NdotL * lightDiffuse[i] * materialDiffuse;

      float NdotHV = max(dot(vertexNormalOut, halfVector),0.0);

      vec3 spec2 = lightSpecular[i] * materialSpecular * pow(NdotHV,materialShininess);
  
      specTotal += spec2;
    }
    
  }
  
  lightColorOut = accum;
  lightSpecularOut = specTotal;
#endif

#if LIGHT_IS_DIRECTIONAL
  float NdotL;
  float NdotHV = 0.0;
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);
  vec3 accum = vec3(0.0,0.0,0.0);

  vec3 halfVector;
  
  for (int i = 0; i < LIGHT_COUNT; i++) {

    halfVector = normalize(vec3(0.0,0.0,1.0)-lightDirection[i]);

    NdotL = max(dot(normalize(-lightDirection[i]),vertexNormalOut),0.0);

    if (NdotL > 0.0)   {
      accum += lightIntensity[i] * materialDiffuse * lightDiffuse[i] * NdotL;    

      NdotHV = max(dot(vertexNormalOut, halfVector),0.0);

      spec2 = lightSpecular[i] * materialSpecular * pow(NdotHV,materialShininess);
      
      specTotal += spec2;
    }
  }  
  
  lightColorOut = accum;
  lightSpecularOut = specTotal;
#endif

#if LIGHT_IS_SPOT
  vec3 specTotal = vec3(0.0,0.0,0.0);
  vec3 spec2 = vec3(0.0,0.0,0.0);
  vec3 accum = vec3(0.0,0.0,0.0);

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

    att *= spotEffect;

    vec3 v = normalize(-vertexPositionOut.xyz);
    vec3 h = normalize(l + v);

    float NdotL = max(0.0, dot(vertexNormalOut, normalize(l)));
    float NdotH = max(0.0, dot(vertexNormalOut, h));

    if (NdotL > 0.0) {
      power = pow(NdotH, materialShininess);
    }
    else {
      power = 0.0;
    }


    accum += att * lightDiffuse[i] * materialDiffuse * NdotL;

    spec2 = lightSpecular[i] * materialSpecular * power;

    specTotal += spec2*spotEffect;

  }  
  
  lightColorOut = accum;
  lightSpecularOut = specTotal;
#endif  
#endif // !LIGHT_PERPIXEL
  cubicvr_normalMap();
  cubicvr_shadowMap();
  cubicvr_environmentMap();
}



vec2 cubicvr_texCoord() {
  return vertexTexCoord + materialTexOffset;
}


vec4 cubicvr_transform() {
    #if LIGHT_DEPTH_PASS
        vertexNormalOut = vec3(0.0,0.0,0.0);
    #endif

    #if VERTEX_MORPH
        vec4 vPos = matrixObject * vec4(vertexPosition+(vertexMorphPosition-vertexPosition)*materialMorphWeight, 1.0);
    #else
        vec4 vPos = matrixObject * vec4(vertexPosition, 1.0);
    #endif

    vertexPositionOut = matrixModelView * vPos;

    #if POINT_SIZE||POINT_SPRITE
        float d = length(vertexPositionOut);
        gl_PointSize = pointSize * sqrt( 1.0/(1.0 + d*d) );
            
        #if !POINT_SPRITE && POINT_CIRCLE
            ptSize = gl_PointSize;
            vec4 screenPos = vec4(matrixProjection * vertexPositionOut);            
            sPos = (screenPos.xy/screenPos.w)*vec2(viewPort.x/2.0,viewPort.y/2.0)+vec2(viewPort.x/2.0+0.5,viewPort.y/2.0+0.5);
        #endif
    #endif
  
  return vPos;
}

vec3 cubicvr_normal() {
    #if VERTEX_MORPH
        return normalize(matrixObject*vec4(vertexNormal+(vertexMorphNormal-vertexNormal)*materialMorphWeight,0.0)).xyz;
    #else
        return normalize(matrixObject*vec4(vertexNormal,0.0)).xyz;
    #endif  
}

#define customShader_splice 1

void main(void) 
{
    vertexTexCoordOut = cubicvr_texCoord();
    gl_Position =  matrixProjection * matrixModelView * cubicvr_transform();

    #if !LIGHT_DEPTH_PASS  // not needed if shadowing 

        vertexNormalOut = matrixNormal * cubicvr_normal();

        cubicvr_lighting();

    #endif // !LIGHT_DEPTH_PASS
}
