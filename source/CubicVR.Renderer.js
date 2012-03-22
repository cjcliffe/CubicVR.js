CubicVR.RegisterModule("Renderer",function(base){

  var undef = base.undef;
  var enums = base.enums;
  var GLCore = base.GLCore;
  
  /* Render functions */
  function cubicvr_renderObject(obj_in,camera,o_matrix,lighting,skip_trans,skip_solid,force_wire) {
    var has_transparency = false;
    skip_trans = skip_trans||false;
    skip_solid = skip_solid||false;

    if (obj_in.compiled===null) {
      return;
    }

    var ofs = 0;
    var gl = base.GLCore.gl;
    var nLights, numLights = (lighting === undef) ? 0: lighting.length;
    var mshader, last_ltype, l;
    var lcount = 0;
    var j;
    var mat = null;
  //  var nullAmbient = [0,0,0];
  //  var tmpAmbient = base.globalAmbient;

    var materials = obj_in.instanceMaterials||obj_in.materials;

    var lines = (obj_in.wireframe||force_wire) && obj_in.compiled.line_elements_ref;
 
    var elements_ref = lines?obj_in.compiled.line_elements_ref:obj_in.compiled.elements_ref;

    var bound = false,
      subcount,
      blended,
      lt;
    gl.depthFunc(gl.LEQUAL);

    if (o_matrix === undef) { o_matrix = cubicvr_identity; }

    for (var ic = 0, icLen = elements_ref.length; ic < icLen; ic++) {
      if (lines && obj_in.wireframeMaterial) {
        mat = obj_in.wireframeMaterial;
      } else {
        mat = materials[ic];
      }

      var len = 0;
      var drawn = false;

      if (mat.opacity < 1.0 && skip_trans) {
        has_transparency = true;
        continue;
      } else if (skip_solid && mat.opacity >= 1.0) {
        continue;
      }

      if (mat.opacity !== 1.0) {
        gl.enable(gl.BLEND);
        gl.depthMask(0);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.depthMask(1);
        gl.disable(gl.BLEND);
        gl.blendFunc(gl.ONE,gl.ONE);
      }

      for (var jc = 0, jcLen = elements_ref[ic].length; jc < jcLen; jc++) {
        j = elements_ref[ic][jc][0];

        drawn = false;

        var this_len = elements_ref[ic][jc][1];
        len += this_len;

        if (!mat.visible) {
          ofs += this_len*2;            
          len -= this_len;
          continue;
        }

        if (obj_in.segment_state[j]) {
          // ...
        } else if (len > this_len) {
          ofs += this_len*2;
          len -= this_len;
          
          // start lighting loop
         // start inner
        if (!numLights) {
         mat.use(0,0);

         gl.uniformMatrix4fv(mat.shader[0][0].matrixModelView,false,camera.mvMatrix);
         gl.uniformMatrix4fv(mat.shader[0][0].matrixProjection,false,camera.pMatrix);
         gl.uniformMatrix4fv(mat.shader[0][0].matrixObject,false,o_matrix);
         gl.uniformMatrix3fv(mat.shader[0][0].matrixNormal,false,camera.nMatrix);

         if (!bound) { 
            mat.bindObject(obj_in,mat.shader[0][0]); bound = (mat.shader[0][0].vertexTexCoord!=-1); 
            if (lines) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_line_elements);
            }
         }

        if (lines) {
            gl.drawElements(gl.LINES, len, gl.UNSIGNED_SHORT, ofs);
        } else {
            gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
        }

        } else { 
          subcount = 0;
          blended = false;

          for (subcount = 0; subcount < numLights; )
          {
            nLights = numLights-subcount;
            if (nLights>base.MAX_LIGHTS) { 
              nLights=base.MAX_LIGHTS;
            }

            if (subcount>0 && !blended) {
              gl.enable(gl.BLEND);
              gl.blendFunc(gl.ONE,gl.ONE);
              gl.depthFunc(gl.EQUAL);
              blended = true;
            }

            mshader = undef;
            l = lighting[subcount];
            lt = l.light_type;

            for (lcount = 0; lcount < nLights; lcount++) {
              if (lighting[lcount+subcount].light_type!=lt) {
                nLights = lcount;
               break;
              }
            }

            mat.use(l.light_type,nLights);

            mshader = mat.shader[l.light_type][nLights];

            gl.uniformMatrix4fv(mshader.matrixModelView,false,camera.mvMatrix);
            gl.uniformMatrix4fv(mshader.matrixProjection,false,camera.pMatrix);
            gl.uniformMatrix4fv(mshader.matrixObject,false,o_matrix);
            gl.uniformMatrix3fv(mshader.matrixNormal,false,camera.nMatrix);

            if (!bound) { 
                mat.bindObject(obj_in,mshader); bound = (mshader.vertexTexCoord!=-1); 
                if (lines) {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_line_elements);
                }
            }

            for (lcount = 0; lcount < nLights; lcount++) {
              lighting[lcount+subcount].setupShader(mshader,lcount);
            }

            if (lines) {
                gl.drawElements(gl.LINES, len, gl.UNSIGNED_SHORT, ofs);
            } else {
                gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
            }            
            // var err = gl.getError();
            // if (err) {
            //   var uv = mshader.uniforms["vertexTexCoord"]; 
            //   var un = mshader.uniforms["aNormal"];
            //   console.log(obj_in.compiled.gl_uvs!==null,obj_in.compiled.gl_normals!==null, un, uv, len, ofs, subcount);
            //   
            //   throw new Error('webgl error on mesh: ' + obj_in.name);
            // }

            subcount += nLights;
          }

          if (blended)
          {
            gl.disable(gl.BLEND);
            gl.depthFunc(gl.LEQUAL);
          }
        }

        /// end inner


          ofs += len*2;  // Note: unsigned short = 2 bytes
          len = 0;      
          drawn = true;
        } else {
          ofs += len*2;
          len = 0;
        }
      }

      if (!drawn && obj_in.segment_state[j] && mat.visible) {
        // this is an exact copy/paste of above
        // start lighting loop
         // start inner
        if (!numLights) {
         mat.use(0,0);

         gl.uniformMatrix4fv(mat.shader[0][0].matrixModelView,false,camera.mvMatrix);
         gl.uniformMatrix4fv(mat.shader[0][0].matrixProjection,false,camera.pMatrix);
         gl.uniformMatrix4fv(mat.shader[0][0].matrixObject,false,o_matrix);
         gl.uniformMatrix3fv(mat.shader[0][0].matrixNormal,false,camera.nMatrix);

         if (!bound) { 
            mat.bindObject(obj_in,mat.shader[0][0]); bound = (mat.shader[0][0].vertexTexCoord!=-1); 
            if (lines) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_line_elements);
            }
         }

        if (lines) {
            gl.drawElements(gl.LINES, len, gl.UNSIGNED_SHORT, ofs);
        } else {
            gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
        }

        } else { 
          subcount = 0;
          blended = false;

          for (subcount = 0; subcount < numLights; )
          {
            nLights = numLights-subcount;
            if (nLights>base.MAX_LIGHTS) { 
              nLights=base.MAX_LIGHTS;
            }

            if (subcount>0 && !blended) {
              gl.enable(gl.BLEND);
              gl.blendFunc(gl.ONE,gl.ONE);
              gl.depthFunc(gl.EQUAL);
              blended = true;
            }

            mshader = undef;
            l = lighting[subcount];
            lt = l.light_type;

            for (lcount = 0; lcount < nLights; lcount++) {
              if (lighting[lcount+subcount].light_type!=lt) {
                nLights = lcount;
               break;
              }
            }

            mat.use(l.light_type,nLights);

            mshader = mat.shader[l.light_type][nLights];

            gl.uniformMatrix4fv(mshader.matrixModelView,false,camera.mvMatrix);
            gl.uniformMatrix4fv(mshader.matrixProjection,false,camera.pMatrix);
            gl.uniformMatrix4fv(mshader.matrixObject,false,o_matrix);
            gl.uniformMatrix3fv(mshader.matrixNormal,false,camera.nMatrix);

            if (!bound) { 
                mat.bindObject(obj_in,mshader); bound = (mshader.vertexTexCoord!=-1); 
                if (lines) {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_line_elements);
                }
            }

            for (lcount = 0; lcount < nLights; lcount++) {
              lighting[lcount+subcount].setupShader(mshader,lcount);
            }

            if (lines) {
                gl.drawElements(gl.LINES, len, gl.UNSIGNED_SHORT, ofs);
            } else {
                gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
            }            
            // var err = gl.getError();
            // if (err) {
            //   var uv = mshader.uniforms["vertexTexCoord"]; 
            //   var un = mshader.uniforms["aNormal"];
            //   console.log(obj_in.compiled.gl_uvs!==null,obj_in.compiled.gl_normals!==null, un, uv, len, ofs, subcount);
            //   
            //   throw new Error('webgl error on mesh: ' + obj_in.name);
            // }

            subcount += nLights;
          }

          if (blended)
          {
            gl.disable(gl.BLEND);
            gl.depthFunc(gl.LEQUAL);
          }
        }

        /// end inner

        ofs += len*2;
      }
    }

    if (mat && mshader) {
      mat.clearObject(obj_in,mshader);
    } else {
      mat.clearObject(obj_in,null);      
    }

    gl.depthMask(1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    return has_transparency;
  }
  
  
  
  var exports = {
    renderObject: cubicvr_renderObject
  };

  return exports;
});
