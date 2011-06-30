
CubicVR.RegisterModule("Mesh",function(base) {

  var undef = base.undef;
  var GLCore = base.GLCore;
  
  /* Faces */

  function Face() {
    this.points = [];
    this.point_normals = [];
    this.point_colors = [];
    this.uvs = [];
    this.normal = [0, 0, 0];
    this.material = 0;
    this.segment = 0;
  }

  Face.prototype.setUV = function(uvs, point_num) {
    if (point_num !== undef) {
      this.uvs[point_num] = uvs;
    } else {
      if (uvs.length !== 2) {
        this.uvs = uvs;
      } else {
        this.uvs.push(uvs);
      }
    }
  };

  Face.prototype.setColor = function(color, point_num) {
    if (point_num !== undef) {
      this.point_colors[point_num] = color;
    } else {
      if (typeof(colors[0]) !== 'number') {
        this.point_colors = color;
      } else {
        this.point_colors.push(color);
      }
    }
  };

  Face.prototype.flip = function() {
    for (var i = 0, iMax = this.point_normals.length; i < iMax; i++) {
      this.point_normals[i] = [-this.point_normals[i][0], -this.point_normals[i][1], -this.point_normals[i][2]];
    }

    this.points.reverse();
    this.point_normals.reverse();
    this.uvs.reverse();
    this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
  };

  function Mesh(objName) {
    this.points = []; // point list
    this.faces = []; // faces with point references
    this.currentFace = -1; // start with no faces
    this.currentMaterial = 0; // null material
    this.currentSegment = 0; // default segment
    this.compiled = null; // VBO data
    this.originBuffer = null;
    this.bb = null;
    this.name = objName ? objName : null;
    this.materials = [];
    this.bb = null;
    this.morphTargets = null;
    this.morphTarget = null;
    this.morphWeight = 0.0;
    this.morphSourceIndex = -1;
    this.morphTargetIndex = -1;
  }

  Mesh.prototype.showAllSegments = function() {
    for (var i in this.segment_state) {
      if (this.segment_state.hasOwnProperty(i)) {
        this.segment_state[i] = true;
      }
    }
  };

  Mesh.prototype.hideAllSegments = function() {
    for (var i in this.segment_state) {
      if (this.segment_state.hasOwnProperty(i)) {
        this.segment_state[i] = false;
      }
    }
  };

  Mesh.prototype.setSegment = function(i, val) {
    if (val !== undef) {
      this.segment_state[i] = val;
    } else {
      this.currentSegment = i;
    }
  };

  Mesh.prototype.addPoint = function(p) {
    if (p.length !== 3 || typeof(p[0]) === 'object') {
      for (var i = 0, iMax = p.length; i < iMax; i++) {
        this.points.push(p[i]);
      }
    } else {
      this.points.push(p);
    }

    return this.points.length - 1;
  };

  Mesh.prototype.getMaterialIndex = function(mat) {
    return this.materials.indexOf(mat);
  }

  Mesh.prototype.setFaceMaterial = function(mat,facenum) {
    if (typeof(mat)=='number') {
      mat_id = mat;      
    } else {    
      mat_id = this.materials.indexOf(mat);
      if (mat_id===-1) {
        this.materials.push(mat);
        mat_id = this.materials.length-1;
      }
    }
    
    if (facenum !== undef) {
      if (this.faces[facenum] !== undef) {
        this.faces[facenum].material = mat_id;
      }
    } else {
      this.currentMaterial = mat_id;
    }
    
    return this;
  };

  Mesh.prototype.addFace = function(p_list, face_num, face_mat, face_seg) {
    if (typeof(p_list[0]) !== 'number') {
      for (var i = 0, iMax = p_list.length; i < iMax; i++) {
        this.addFace(p_list[i]);
      }

      return;
    }

    if (face_num === undef) {
      this.currentFace = this.faces.length;
      this.faces.push(new Face());
    } else {
      if (this.faces[face_num] === undef) {
        this.faces[face_num] = new Face();
      }

      this.currentFace = face_num;
    }

    if (typeof(p_list) === 'object') {
      this.faces[this.currentFace].points = p_list;
    }

    if (face_mat !== undef) {
      this.setFaceMaterial(face_mat,this.currentFace);
    } else {
      this.faces[this.currentFace].material = this.currentMaterial;
    }

    if (face_seg !== undef) {
      this.faces[this.currentFace].segment = face_seg;
    } else {
      this.faces[this.currentFace].segment = this.currentSegment;
    }


    return this.currentFace;
  };

  Mesh.prototype.flipFaces = function() {
     for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
       this.faces[i].flip();
     }
  }

  Mesh.prototype.triangulateQuads = function() {
    for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
      if (this.faces[i].points.length === 4) {
        var p = this.faces.length;

        this.addFace([this.faces[i].points[2], this.faces[i].points[3], this.faces[i].points[0]], this.faces.length, this.faces[i].material, this.faces[i].segment);
        this.faces[i].points.pop();
        this.faces[p].normal = this.faces[i].normal;

        if (this.faces[i].uvs !== undef) {
          if (this.faces[i].uvs.length === 4) {
            this.faces[p].setUV(this.faces[i].uvs[2], 0);
            this.faces[p].setUV(this.faces[i].uvs[3], 1);
            this.faces[p].setUV(this.faces[i].uvs[0], 2);

            this.faces[i].uvs.pop();
          }
        }

        if (this.faces[i].point_normals.length === 4) {
          this.faces[p].point_normals[0] = this.faces[i].point_normals[2];
          this.faces[p].point_normals[1] = this.faces[i].point_normals[3];
          this.faces[p].point_normals[2] = this.faces[i].point_normals[0];

          this.faces[i].point_normals.pop();
        }

      }
    }
    
    return this;
  };


  Mesh.prototype.booleanAdd = function(objAdd, transform) {
    var mat4 = CubicVR.mat4;
    var pofs = this.points.length;
    var fofs = this.faces.length;

    var i, j, iMax, jMax;

    if (transform !== undef) {
      var m = transform.getResult();
      for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
        this.addPoint(mat4.vec3_multiply(objAdd.points[i], m));
      }
    } else {
      for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
        this.addPoint([objAdd.points[i][0], objAdd.points[i][1], objAdd.points[i][2]]);
      }
    }

    var matMap = [];
    
    for (i = 0, iMax = objAdd.materials.length; i<iMax; i++) {
      var mindex = this.materials.indexOf(objAdd.materials[i]);
      
      if (mindex === -1) {
        this.materials.push(objAdd.materials[i]);
        matMap[i] = this.materials.length-1;
      } else {
        matMap[i] = mindex;
      }
    }

    for (i = 0, iMax = objAdd.faces.length; i < iMax; i++) {
      var newFace = [];

      for (j = 0, jMax = objAdd.faces[i].points.length; j < jMax; j++) {
        newFace.push(objAdd.faces[i].points[j] + pofs);
      }

      var nFaceNum = this.addFace(newFace);
      var nFace = this.faces[nFaceNum];

     nFace.segment = objAdd.faces[i].segment;
     
     nFace.material = matMap[objAdd.faces[i].material];

      for (j = 0, jMax = objAdd.faces[i].uvs.length; j < jMax; j++) {
        nFace.uvs[j] = [objAdd.faces[i].uvs[j][0], objAdd.faces[i].uvs[j][1]];
      }

      for (j = 0, jMax = objAdd.faces[i].point_normals.length; j < jMax; j++) {
        nFace.point_normals[j] = [objAdd.faces[i].point_normals[j][0], objAdd.faces[i].point_normals[j][1], objAdd.faces[i].point_normals[j][2]];
      }
    }
    
    return this;
  };

  Mesh.prototype.calcFaceNormals = function() {
    var vec3 = CubicVR.vec3;
    var triangle = CubicVR.triangle;
    for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
      if (this.faces[i].points.length < 3) {
        this.faces[i].normal = [0, 0, 0];
        continue;
      }

      this.faces[i].normal = vec3.normalize(triangle.normal(this.points[this.faces[i].points[0]], this.points[this.faces[i].points[1]], this.points[this.faces[i].points[2]]));
    }
    
    return this;
  };


  Mesh.prototype.getMaterial = function(m_name) {
    
    for (var i = 0, iMax = this.materials.length; i < iMax; i++) {
        if (this.materials[i].name === m_name) { 
          return this.materials[i];
        }
    }

    return null;
  };


  Mesh.prototype.calcNormals = function(normalMapRef_out) {
    var vec3 = CubicVR.vec3;
    var updateMap = false;
    
    if (normalMapRef_out !== undef) {
        updateMap = true;
    }
  
    this.calcFaceNormals();

    var i, j, k, iMax;

    var point_smoothRef = new Array(this.points.length);
    for (i = 0, iMax = point_smoothRef.length; i < iMax; i++) {
      point_smoothRef[i] = [];
    }

    var numFaces = this.faces.length;

    // build a quick list of point/face sharing
    for (i = 0; i < numFaces; i++) {
      var numFacePoints = this.faces[i].points.length;

      for (j = 0; j < numFacePoints; j++) {
        var idx = this.faces[i].points[j];

        //      if (point_smoothRef[idx] === undef) point_smoothRef[idx] = [];
        point_smoothRef[idx].push([i, j]);
      }
    }

    // step through smoothing references and compute normals
    for (i = 0, iMax = this.points.length; i < iMax; i++) {
      //    if(!point_smoothRef.hasOwnProperty(i)) { continue; }
      //    if (typeof(point_smoothRef[i]) === undef) { continue; }
      var numPts = point_smoothRef[i].length;

      for (j = 0; j < numPts; j++) {
        var ptCount = 1;
        var faceNum = point_smoothRef[i][j][0];
        var pointNum = point_smoothRef[i][j][1];
        var max_smooth = this.materials.length?this.materials[this.faces[faceNum].material].max_smooth:60.0;
        var thisFace = this.faces[faceNum];

        if (updateMap) {
          if (normalMapRef_out[faceNum] === undef) {
            normalMapRef_out[faceNum] = [];
          } 
          if (normalMapRef_out[faceNum][pointNum] === undef) {
            normalMapRef_out[faceNum][pointNum] = [];
          }
        }

        // set point to it's face's normal
        var tmpNorm = new Array(3);

        tmpNorm[0] = thisFace.normal[0];
        tmpNorm[1] = thisFace.normal[1];
        tmpNorm[2] = thisFace.normal[2];

        // step through all other faces which share this point
        if (max_smooth !== 0) {
          for (k = 0; k < numPts; k++) {
            if (j === k) {
              continue;
            }
            var faceRefNum = point_smoothRef[i][k][0];
            var thisFaceRef = this.faces[faceRefNum];

            var ang = vec3.angle(thisFaceRef.normal, thisFace.normal);

            if ((ang !== ang) || ((ang * (180.0 / Math.PI)) <= max_smooth)) {

              if (updateMap) {
                    normalMapRef_out[faceNum][pointNum].push(faceRefNum);
              }
            
              tmpNorm[0] += thisFaceRef.normal[0];
              tmpNorm[1] += thisFaceRef.normal[1];
              tmpNorm[2] += thisFaceRef.normal[2];

              ptCount++;
            }
          }
        }

        tmpNorm[0] /= ptCount;
        tmpNorm[1] /= ptCount;
        tmpNorm[2] /= ptCount;

        this.faces[faceNum].point_normals[pointNum] = vec3.normalize(tmpNorm);
      }
    }
    
    return this;
  };
  

   // given the parameter map output from calcNormals, recalculate all the normals again quickly
   Mesh.prototype.recalcNormals = function(normalMapRef) {
    this.calcFaceNormals();

    for (var faceNum = 0, faceMax = this.faces.length; faceNum < faceMax; faceNum++) {     
      var pointMax = normalMapRef[faceNum].length;
      var face = this.faces[faceNum];

      for (var pointNum = 0, pMax = face.points.length; pointNum < pMax; pointNum++) {
        var oRef = normalMapRef[faceNum][pointNum];
        var baseNorm = face.point_normals[pointNum];
        
        baseNorm[0] = face.normal[0];
        baseNorm[1] = face.normal[1];
        baseNorm[2] = face.normal[2];
                
        var nCount = oRef.length;

        for (var i = 0; i<nCount; i++) {
          var oFace = this.faces[oRef[i]];
          baseNorm[0] += oFace.normal[0];
          baseNorm[1] += oFace.normal[1];
          baseNorm[2] += oFace.normal[2];
        }      
        
        if (nCount != 0) {
          baseNorm[0] /= (nCount+1);
          baseNorm[1] /= (nCount+1);        
          baseNorm[2] /= (nCount+1);

          var l = Math.sqrt(baseNorm[0]*baseNorm[0]+baseNorm[1]*baseNorm[1]+baseNorm[2]*baseNorm[2]);
          
          baseNorm[0] /= l;
          baseNorm[1] /= l;
          baseNorm[2] /= l;
        }
      }
    }
    
    return this;
  };
  
  
  Mesh.prototype.prepare = function(doClean) {
    if (doClean === undef) {
      doClean = true;
    }
    
    this.triangulateQuads().compile();
    if (doClean) {
      this.clean();
    }
    
    return this;
  }
  
  Mesh.prototype.clean = function() {
    var i,iMax;
    
    
    for (i = 0, iMax=this.points.length; i < iMax; i++)
    {
      delete(this.points[i]);
      this.points[i]=null;
    }
    this.points = [];
    
    for (i = 0, iMax=this.faces.length; i < iMax; i++)
    {
      delete(this.faces[i].points);
      delete(this.faces[i].point_normals);
      delete(this.faces[i].uvs);
      delete(this.faces[i].normal);
      delete(this.faces[i]);      
      this.faces[i]=null;
    }
    this.faces = [];

    
    return this;
  }
  

  // generate a compile-map object for the current mesh, used to create a VBO with compileVBO(compileMap)  
  Mesh.prototype.compileMap = function(tolerance) {
    var vec3 = CubicVR.vec3;
    var vec2 = CubicVR.vec2;
    if (tolerance===undef) tolerance=0.00001;

    var compileMap = {segments:[],bounds:[]};

    var compileRef = [];

    var i, j, k, x, y, iMax, kMax, yMax;

    if (!this.materials.length) this.materials.push(new CubicVR.Material());

    for (i = 0, iMax = this.materials.length; i<iMax; i++) {
      compileRef[i] = [];
    }

    for (i = 0, iMax = this.faces.length; i < iMax; i++) {
      if (this.faces[i].points.length === 3) {
        var matId = this.faces[i].material;
        var segId = this.faces[i].segment;
        
        if (compileRef[matId][segId] === undef) {
          compileRef[matId][segId] = [];
          compileMap.segments.push(segId);
        }

        compileRef[matId][segId].push(i);
      }
    }

    var vtxRef = [];

    var idxCount = 0;
    var hasUV = false;
    var hasNorm = false;
    var hasColor = false;
    var faceNum;

    for (var i=0, iMax=compileRef.length; i<iMax; i++) {
      for (j in compileRef[i]) {
        if (compileRef[i].hasOwnProperty(j)) {
          for (k = 0; k < compileRef[i][j].length; k++) {
            faceNum = compileRef[i][j][k];
            hasUV = hasUV || (this.faces[faceNum].uvs.length !== 0);
            hasNorm = hasNorm || (this.faces[faceNum].point_normals.length !== 0);
            hasColor = hasColor || (this.faces[faceNum].point_colors.length !== 0);
          }
        }
      }
    }

    if (hasUV) {
      for (i = 0; i < this.faces.length; i++) {
        if (!this.faces[i].uvs.length) {
          for (j = 0; j < this.faces[i].points.length; j++) {
            this.faces[i].uvs.push([0, 0]);
          }
        }
      }
    }

    if (hasNorm) {
      for (i = 0; i < this.faces.length; i++) {
        if (!this.faces[i].point_normals.length) {
          for (j = 0; j < this.faces[i].points.length; j++) {
            this.faces[i].point_normals.push([0, 0, 0]);
          }
        }
      }
    }

    if (hasColor) {
      for (i = 0; i < this.faces.length; i++) {
        if (!this.faces[i].point_colors.length) {
          for (j = 0; j < this.faces[i].points.length; j++) {
            this.faces[i].point_colors.push([0, 0, 0]);
          }
        }
      }
    }

    var pVisitor = [];

    for (var i = 0, iMax = compileRef.length; i<iMax; i++) {
      for (j in compileRef[i]) {
        if (compileRef[i].hasOwnProperty(j)) {
          for (k = 0, kMax = compileRef[i][j].length; k < kMax; k++) {
            faceNum = compileRef[i][j][k];
            var found = false;

            for (x = 0; x < 3; x++) {
              var ptNum = this.faces[faceNum].points[x];

              var foundPt = -1;

              if (vtxRef[ptNum] !== undef) {
                for (y = 0, yMax = vtxRef[ptNum].length; y < yMax; y++) {
                  // face / point
                  var oFace = vtxRef[ptNum][y][0]; // faceNum
                  var oPoint = vtxRef[ptNum][y][1]; // pointNum
                  var oIndex = vtxRef[ptNum][y][2]; // index
                  foundPt = oIndex;

                  if (hasNorm) {
                    foundPt = (vec3.equal(
                    this.faces[oFace].point_normals[oPoint], this.faces[faceNum].point_normals[x], tolerance)) ? foundPt : -1;
                  }

                  if (hasUV) {
                    foundPt = (vec2.equal(
                    this.faces[oFace].uvs[oPoint], this.faces[faceNum].uvs[x],tolerance)) ? foundPt : -1;
                  }

                  if (hasColor) {
                    foundPt = (vec3.equal(
                    this.faces[oFace].point_colors[oPoint], this.faces[faceNum].point_colors[x],tolerance)) ? foundPt : -1;
                  }

                }
              }

              if (foundPt !== -1) {
                if (compileMap.elements === undef) {
                  compileMap.elements = [];
                }
                if (compileMap.elements[i] === undef) {
                  compileMap.elements[i] = [];
                }
                if (compileMap.elements[i][j] === undef) {
                  compileMap.elements[i][j] = [];
                }
                compileMap.elements[i][j].push(foundPt);
              } else {
                if (compileMap.points === undef) {
                  compileMap.points = [];
                }
                
                compileMap.points.push(ptNum);

                if (compileMap.bounds.length===0) {
                  compileMap.bounds[0] = [this.points[ptNum][0],
                                                        this.points[ptNum][1],
                                                        this.points[ptNum][2]];

                  compileMap.bounds[1] = [this.points[ptNum][0],
                                                        this.points[ptNum][1],
                                                        this.points[ptNum][2]];
                } else {
                  if (this.points[ptNum][0] < compileMap.bounds[0][0]) {
                    compileMap.bounds[0][0] = this.points[ptNum][0];
                  }
                  if (this.points[ptNum][1] < compileMap.bounds[0][1]) {
                    compileMap.bounds[0][1] = this.points[ptNum][1];
                  }
                  if (this.points[ptNum][2] < compileMap.bounds[0][2]) {
                    compileMap.bounds[0][2] = this.points[ptNum][2];
                  }

                  if (this.points[ptNum][0] > compileMap.bounds[1][0]) {
                    compileMap.bounds[1][0] = this.points[ptNum][0];
                  }
                  if (this.points[ptNum][1] > compileMap.bounds[1][1]) {
                    compileMap.bounds[1][1] = this.points[ptNum][1];
                  }
                  if (this.points[ptNum][2] > compileMap.bounds[1][2]) {
                    compileMap.bounds[1][2] = this.points[ptNum][2];
                  }
                }

                if (hasNorm) {
                  if (compileMap.normals === undef) {
                    compileMap.normals = [];                    
                  }
                  compileMap.normals.push([faceNum,x]);
                }

                if (hasColor) {
                  if (compileMap.colors === undef) {
                    compileMap.colors = [];
                  }
                  compileMap.colors.push([faceNum,x]);
                }

                if (hasUV) {
                  if (compileMap.uvs === undef) {
                    compileMap.uvs = [];                    
                  }
                  compileMap.uvs.push([faceNum,x]);
                }

                if (compileMap.elements === undef) {
                  compileMap.elements = [];
                }
                if (compileMap.elements[i] === undef) {
                  compileMap.elements[i] = [];
                }
                if (compileMap.elements[i][j] === undef) {
                  compileMap.elements[i][j] = [];
                }

                compileMap.elements[i][j].push(idxCount);

                if (vtxRef[ptNum] === undef) {
                  vtxRef[ptNum] = [];
                }

                vtxRef[ptNum].push([faceNum, x, idxCount]);
                idxCount++;
              }
            }
          }
        }
      }
    }
    
    return compileMap;
  };
  
  // Take a compileMap() result and create a compiled mesh VBO object for bufferVBO(VBO)
  Mesh.prototype.compileVBO = function(compileMap, doElements, doVertex, doNormal, doUV, doColor) {
     if (typeof(doElements)=='object') {
      doElements = (doElements.element !== undef)?doElements.element:true;
      doVertex = (doElements.vertex !== undef)?doElements.vertex:true;
      doColor = (doElements.color !== undef)?doElements.color:true;
      doNormal = (doElements.normal !== undef)?doElements.normal:true;
      doUV = (doElements.uv !== undef)?doElements.uv:true;
    } else {
      if (doElements === undef) doElements = true;
      if (doVertex === undef) doVertex = true;
      if (doColor === undef) doColor = true;
      if (doNormal === undef) doNormal = true;
      if (doUV === undef) doUV = true;
    }
    var compiled = {};

    if (compileMap.points && doVertex) {
      var numPoints = compileMap.points.length;
      compiled.vbo_points = new Float32Array(numPoints*3);
      var ofs = 0;
      for (var i = 0, iMax = numPoints; i < iMax; i++) {
        var ptIdx = compileMap.points[i];
        compiled.vbo_points[ofs++] = this.points[ptIdx][0];
        compiled.vbo_points[ofs++] = this.points[ptIdx][1];
        compiled.vbo_points[ofs++] = this.points[ptIdx][2];
      }
     }

    if (compileMap.normals && doNormal) {
      var numPoints = compileMap.normals.length;
      compiled.vbo_normals = new Float32Array(numPoints*3);
      var ofs = 0;
      for (var i = 0, iMax = numPoints; i < iMax; i++) {
        var ptIdx = compileMap.normals[i];
        compiled.vbo_normals[ofs++] = this.faces[ptIdx[0]].point_normals[ptIdx[1]][0];
        compiled.vbo_normals[ofs++] = this.faces[ptIdx[0]].point_normals[ptIdx[1]][1];
        compiled.vbo_normals[ofs++] = this.faces[ptIdx[0]].point_normals[ptIdx[1]][2];
      }
     }

    if (compileMap.colors && doColor) {
      var numPoints = compileMap.colors.length;
      compiled.vbo_colors = new Float32Array(numPoints*3);
      var ofs = 0;
      for (var i = 0, iMax = numPoints; i < iMax; i++) {
        var ptIdx = compileMap.colors[i];
        compiled.vbo_colors[ofs++] = this.faces[ptIdx[0]].point_colors[ptIdx[1]][0];
        compiled.vbo_colors[ofs++] = this.faces[ptIdx[0]].point_colors[ptIdx[1]][1];
        compiled.vbo_colors[ofs++] = this.faces[ptIdx[0]].point_colors[ptIdx[1]][2];
      }
     }

    if (compileMap.uvs && doUV) {
      var numPoints = compileMap.uvs.length;
      compiled.vbo_uvs = new Float32Array(numPoints*2);
      var ofs = 0;
      for (var i = 0, iMax = numPoints; i < iMax; i++) {
        var ptIdx = compileMap.uvs[i];
        compiled.vbo_uvs[ofs++] = this.faces[ptIdx[0]].uvs[ptIdx[1]][0];
        compiled.vbo_uvs[ofs++] = this.faces[ptIdx[0]].uvs[ptIdx[1]][1];
      }
     }

    if (doElements) {    
      compiled.elements_ref = [];
      compiled.vbo_elements = [];

      for (var i = 0, iMax = compileMap.elements.length; i<iMax; i++) {
        compiled.elements_ref[i] = [];

        var jctr = 0;

        for (j in compileMap.elements[i]) {
          if (compileMap.elements[i].hasOwnProperty(j)) {
            var emap = compileMap.elements[i][j];
            for (k = 0, kMax = emap.length; k<kMax; k++) {
              compiled.vbo_elements.push(emap[k]);
            }

            compiled.elements_ref[i][jctr] = [parseInt(j), parseInt(emap.length)];

            jctr++;
          }
        }
      }
      
      compiled.vbo_elements = new Uint16Array(compiled.vbo_elements);
    }
    compiled.segments = compileMap.segments;
    compiled.bounds = compileMap.bounds;
   
    return compiled;
  }


  // take a compiled VBO from compileVBO() and create a mesh buffer object for bindBuffer(), fuse with baseBuffer overlay if provided
  Mesh.prototype.bufferVBO = function(VBO,baseBuffer) {
    var gl = GLCore.gl;
    
    var buffer = {};
    if (baseBuffer === undef) baseBuffer = {};
    
    buffer.gl_points = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_points);
    gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_points, gl.STATIC_DRAW);

    if (VBO.vbo_normals) {
      buffer.gl_normals = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_normals);
      gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_normals, gl.STATIC_DRAW);
    }
    else
    {
      buffer.gl_normals = baseBuffer.gl_normals?baseBuffer.gl_normals:null;
    }

    if (VBO.vbo_uvs) {
      buffer.gl_uvs = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_uvs);
      gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_uvs, gl.STATIC_DRAW);
    }
    else
    {
      buffer.gl_uvs = baseBuffer.gl_uvs?baseBuffer.gl_uvs:null;
    }

    if (VBO.vbo_colors) {
      buffer.gl_colors = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_colors);
      gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_colors, gl.STATIC_DRAW);
    }
    else
    {
      buffer.gl_colors = baseBuffer.gl_colors?baseBuffer.gl_colors:null;
    }

    if (!VBO.vbo_elements && baseBuffer.gl_elements) {
      buffer.gl_elements = baseBuffer.gl_elements;
      buffer.elements_ref = baseBuffer.elements_ref;
    } 
    else {
      buffer.gl_elements = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.gl_elements);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, VBO.vbo_elements, gl.STATIC_DRAW);
      buffer.elements_ref = VBO.elements_ref;
    }

    buffer.segments = VBO.segments;
    buffer.bounds = VBO.bounds;

    if (baseBuffer.elements_ref && !VBO.elements_ref)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    return buffer;
 } 
  

  // bind a bufferVBO object result to the mesh
  Mesh.prototype.bindBuffer = function(vbo_buffer) {
    if (this.originBuffer === null) {
      this.originBuffer = vbo_buffer;
    }
    
    this.compiled = vbo_buffer;
    this.segment_state = [];
    for (var i = 0, iMax = vbo_buffer.segments.length; i<iMax; i++) {
      this.segment_state[vbo_buffer.segments[i]] = true;
    }
    this.bb = vbo_buffer.bounds;
  };
  
  // Do the works
  Mesh.prototype.compile = function(tolerance) {
    this.bindBuffer(this.bufferVBO(this.compileVBO(this.compileMap(tolerance))));
    return this;
  }
  
  Mesh.prototype.addMorphTarget = function(targetBuffer) {
    if (this.morphTargets === null) {
      this.morphTargets = [];
    }
    this.morphTargets.push(targetBuffer);
  }
  
  Mesh.prototype.setMorphSource = function(idx) {
    if (this.morphSourceIndex === idx) return;
    this.morphSourceIndex = idx;
    this.bindBuffer(this.morphTargets[idx]);
  }
  
  
  Mesh.prototype.setMorphTarget = function(idx) {
    if (this.morphTargetIndex === idx) return;
    this.morphTargetIndex = idx;
    this.morphTarget = this.morphTargets[idx];
  }
  
  Mesh.prototype.setMorphWeight = function(weight) {
    this.morphWeight = weight;
  }

  Mesh.prototype.morphTargetCount = function() {
    return (this.morphTargets !== null)?this.morphTargets.length:0;
  }

  var exports = {
    Mesh: Mesh,
    Face: Face
  }; 
  
  return exports;
});
