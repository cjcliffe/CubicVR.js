CubicVR.RegisterModule("Mesh", function (base) {

    var undef = base.undef;
    var GLCore = base.GLCore;
    var log = base.log;

    /* Faces */

  function parseTransform(t) {
        if (t === undef) return undef;
        if (typeof(t) === 'array') {
            return t;
        }
        if (typeof(t) === 'object') {
            if (!!t.
            getResult) {
                return t.getResult();            
            } else if (!!t.position || !!t.rotation || !!t.scale){
                return base.mat4.transform(t.position,t.rotation,t.scale);
            } else {
                return t;            
            }
        }
  }

    function Face() {
        this.points = [];
        this.point_normals = [];
        this.point_colors = [];
        this.uvs = [];
        this.normal = [0, 0, 0];
        this.material = 0;
        this.segment = 0;
    }

    Face.prototype = {
        setUV: function (uvs, point_num) {
            if (point_num !== undef) {
                this.uvs[point_num] = uvs;
            } else {
                if (uvs.length !== 2) {
                    this.uvs = uvs;
                } else {
                    this.uvs.push(uvs);
                }
            }
        },

        setPointNormal: function (normals, point_num) {
            if (point_num !== undef) {
                this.point_normals[point_num] = normals;
            } else {
                if (typeof(normals[0])==='number') {
                    this.point_normals.push(normals);
                } else {
                    this.point_normals = normals;
                }
            }
        },

        setNormal: function (normal) {
            this.normal = normal;
            if (!this.point_normals.length && this.points.length) {
                for (var i = 0, iMax=this.points.length; i < iMax; i++) {
                    this.point_normals[i] = normal;
                }
            }
        },

        setColor: function (color, point_num) {
            if (point_num !== undef) {
                this.point_colors[point_num] = color;
            } else {
                if (typeof (color[0]) !== 'number') {
                    this.point_colors = color;
                } else {
                    this.point_colors.push(color);
                }
            }
        },

        flip: function () {
            for (var i = 0, iMax = this.point_normals.length; i < iMax; i++) {
                this.point_normals[i] = [-this.point_normals[i][0], -this.point_normals[i][1], -this.point_normals[i][2]];
            }

            this.points.reverse();
            this.point_normals.reverse();
            this.uvs.reverse();
            this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
        }
    };


    function Mesh(obj_init) {

        this.compiled = null; // VBO data
        this.materials = [];
        this.bb = null;
        this.instanceMaterials = null;

        this.edges = null;
        this.faces = []; // faces with point references        
        this.points = []; // point list
        this.currentFace = -1; // start with no faces
        this.currentMaterial = 0; // null material
        this.currentSegment = 0; // default segment

        this.morphTargets = null;
        this.morphTarget = null;
        this.morphWeight = 0.0;
        this.morphSourceIndex = -1;
        this.morphTargetIndex = -1;

        this.originBuffer = null;
        this.genNormals = true;
        this.classType = base.enums.classType.MESH;

        obj_init = base.get(obj_init)||{};

        if (obj_init instanceof base.Mesh) {
            this.booleanAdd(obj_init);
            obj_init._clones = obj_init._clones || 1;
            obj_init._clones++;
            if (obj_init.name) {
                this.name = obj_init.name+"_copy"+obj_init._clones;
            } else {
                this.name = null;
            }
            return;
        }                

        this.name = obj_init.name || null;                
        this.dynamic = obj_init.dynamic||false;
             
        if (obj_init.material) {
            var material = obj_init.material;
            if (material.length) {
                this.materials = material;                
            } else if (typeof(material)==='object') {
                if (material.use) {
                    this.setFaceMaterial(material);                    
                } else {
                    this.setFaceMaterial(new base.Material(material));
                }
            }            
        }

        if (obj_init.point||obj_init.points) {
            this.build(obj_init);
        }
        
        if (obj_init.part) {
            this.build(obj_init.part);
        } else if (obj_init.parts) {
            this.build(obj_init.parts);
        }
        
        this.primitives = obj_init.primitives||obj_init.primitive||null;

        if ((this.primitives && !this.primitives.length) || typeof(this.primitives) === 'string') {
            this.primitives = [this.primitives];
        }

        if (this.primitives && this.primitives.length) {
            for (var i = 0, iMax = this.primitives.length; i<iMax; i++) {
                var prim = this.primitives[i];
                
                if (typeof(prim) === 'string') {
                    prim = base.get(prim);                    
                }
                
                var prim_func = base.primitives[prim.type];
                if (prim.type && !!prim_func) {
                    this.booleanAdd(prim_func(prim));
                } else if (prim.type) {                
                    log("Mesh error, primitive "+(prim.type)+" is unknown.");
                    var possibles = "";
                    for (var k in base.primitives) {
                        if (base.primitives.hasOwnProperty(k)) {
                            if (possibles !== "") {
                                possibles += ", ";
                            }
                            possibles += k;
                        }
                    }
                    log("Available primitive types are: "+possibles);

                } else {
                    log("Mesh error, primitive "+(i+1)+" lacks type.");
                }
            }
        }
    
        this.pointMode = obj_init.pointMode;        
        this.buildWireframe = obj_init.buildWireframe||obj_init.wireframe||(!!obj_init.wireframeMaterial)||(!!obj_init.pointModeMaterial)||obj_init.triangulateWireframe||obj_init.pointMode||false;
        this.triangulateWireframe = obj_init.triangulateWireframe||null;
        this.wireframeMaterial = base.get(obj_init.wireframeMaterial,base.Material)||null;
        this.pointModeMaterial = base.get(obj_init.pointModeMaterial,base.Material)||null;
        this.wireframe = obj_init.wireframe||false;
        
        if (obj_init.flipFaces && this.faces.length) {
            this.flipFaces();
        }
        
        if (obj_init.prepare || obj_init.compile && this.faces.length) {
            this.prepare();
        }
        
        if (obj_init.clean || obj_init.compile && this.faces.length && !this.dynamic) {
            this.clean();
        }
        
        if (this.genNormals && obj_init.calcNormals && !obj_init.compile && !obj_init.prepare) {
            this.calcNormals();
        }
    }

    Mesh.prototype = {
        setPointMode: function(pointMode_in) {
            this.pointMode = pointMode_in;            
        },
        isPointMode: function() {
            return this.pointMode;           
        },
        setWireframe: function(wireframe_in) {
            this.wireframe = wireframe_in;            
        },
        isWireframe: function() {
            return this.wireframe;           
        },
        setWireframeMaterial: function(wireframe_mat) {
            this.wireframeMaterial = wireframe_mat;
        },
        getWireframeMaterial: function() {
            return this.wireframeMaterial;
        },
        setPointModeMaterial: function(pointmode_mat) {
            this.pointModeMaterial = pointmode_mat;
        },
        getPointModeMaterial: function() {
            return this.pointModeMaterial;
        },
        build: function(parts,points) {
            var j,jMax;
            
            if (typeof(parts)==='string') {
                parts = base.get(parts);
            }
        
            if (parts && !parts.length) {
                parts = [parts];
            }
            
            var ptBaseOfs = 0, ptOfs = 0;
            var faceOfs = this.faces.length;
            
            if (points && points.length) {
                ptBaseOfs = this.points.length;
                this.points.concat(points);
            }           
            
            for (var i = 0, iMax = parts.length; i<iMax; i++) {
                var part = parts[i];
                var material = part.material;
                var part_points = part.points||part.point;
                var faces = part.faces||part.face;
                var uv = part.uv||part.uvs;
                var color = part.color||part.colors;
                var normals = part.normal||part.normals;
                var segment = part.segment||null;
                
                
                if (segment!==null) {
                    this.setSegment(parseInt(segment,10));
                }

                if (part_points && part_points.length) {
                    ptOfs = this.points.length;
                    this.points = this.points.concat(part_points);
                    
                    if (faces && faceOfs) {
                        faces = faces.slice(0);
                        for (var a = 0, aMax = faces.length; a<aMax; a++) {
                            var face = faces[a];
                            for (var b = 0, bMax = faces.length; b<bMax; b++) {
                                face[b] += faceOfs;
                            }                            
                        }
                    }
                } else {
                    ptOfs = ptBaseOfs;
                }

                if (material) {
                    if (material.length) {
                        this.materials = material;                
                    } else if (typeof(material)==='object') {
                        if (material.use) {
                            this.setFaceMaterial(material);                    
                        } else {
                            this.setFaceMaterial(new base.Material(material));
                        }
                    }
                }
                
                if (faces && faces.length) {
                    this.addFace(faces);
                }
                
                if (faces && uv && typeof(uv) === 'object') {
                    var mapper = null;
                    if (uv.length) {
                        if (uv.length === faces.length) {
                            for (j = 0, jMax = uv.length; j<jMax; j++) {
                                this.faces[j+faceOfs].setUV(uv[j]);
                            }
                        } else {
                            log("Mesh error in part, face count: "+faces.length+", uv count:"+uv.length);
                        }
                    } else {
                        mapper = uv.apply?uv:(new base.UVMapper(uv));
                    }
                    
                    if (mapper) {
                        mapper.apply(this, this.currentMaterial, this.currentSegment, faceOfs, this.faces.length-faceOfs);
                    }
                }
                
                if (faces && normals) {
                    if (normals.length && normals[0].length) {
                        if (normals.length === faces.length) {
                            this.genNormals = false;
                            var faceNorms = (typeof(normals[0][0])==='number');    // each

                            for (j = 0, jMax = normals.length; j<jMax; j++) {
                                if (faceNorms) {
                                    this.faces[j+faceOfs].setNormal(normals[j]);
                                } else {
                                    this.faces[j+faceOfs].setPointNormal(normals[j]);
                                }
                            }
                        } else {
                            log("Mesh error in part, face count: "+faces.length+", normals count:"+uv.length);
                        }
                    } else {
                        log("Mesh error in part, unknown something where normals should be? ["+(typeof(normals))+"]");
                    }
                }

                if (faces && color && typeof(color) === 'object') {
                    if (color.length && color.length === faces.length) {
                        for (j = 0, jMax = color.length; j<jMax; j++) {
                            this.faces[j+faceOfs].setColor(color[j]);
                        }   
                        this.materials[this.currentMaterial].colorMap = true;
                    } else {
                        log("Mesh error in part, face count: "+faces.length+", color count:"+color.length);
                    }
                }

            }
            
            return this;
        },
        
        showAllSegments: function () {
            for (var i in this.segment_state) {
                if (this.segment_state.hasOwnProperty(i)) {
                    this.segment_state[i] = true;
                }
            }
        },

        hideAllSegments: function () {
            for (var i in this.segment_state) {
                if (this.segment_state.hasOwnProperty(i)) {
                    this.segment_state[i] = false;
                }
            }
        },

        setSegment: function (i, val) {
            if (val !== undef) {
                this.segment_state[i] = val;
            } else {
                this.currentSegment = i;
            }
        },

        addPoint: function (p) {
            if (p.length !== 3 || typeof (p[0]) === 'object') {
                for (var i = 0, iMax = p.length; i < iMax; i++) {
                    this.points.push(p[i]);
                }
            } else {
                this.points.push(p);
            }

            return this.points.length - 1;
        },

        getMaterialIndex: function (mat) {
            return this.materials.indexOf(mat);
        },

        setFaceMaterial: function (mat, facenum) {
            var mat_id;
            if (typeof (mat) == 'number') {
                mat_id = mat;
            } else {
                mat_id = this.materials.indexOf(mat);
                if (mat_id === -1) {
                    this.materials.push(mat);
                    mat_id = this.materials.length - 1;
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
        },

        addFace: function (p_list, face_num, face_mat, face_seg) {
            if (p_list === undef) {
                this.currentFace = this.faces.length;
                this.faces.push(new Face());
                return this.currentFace;
            }
            if (typeof (p_list[0]) !== 'number') {
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

            if (typeof (p_list) === 'object') {
                this.faces[this.currentFace].points = p_list;
            }

            if (face_mat !== undef) {
                this.setFaceMaterial(face_mat, this.currentFace);
            } else {
                this.faces[this.currentFace].material = this.currentMaterial;
            }

            if (face_seg !== undef) {
                this.faces[this.currentFace].segment = face_seg;
            } else {
                this.faces[this.currentFace].segment = this.currentSegment;
            }


            return this.currentFace;
        },

        flipFaces: function () {
            for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
                this.faces[i].flip();
            }
        },
        triangulate: function () {
            var pcolors, puvs, pnorms;
            var pts, face, destFace;

            for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
                face = this.faces[i];
                pts = face.points;
                
                if (pts.length === 4) {
                    destFace = this.faces[this.addFace([pts[2], pts.pop(), pts[0]], this.faces.length, face.material, face.segment)];
                    destFace.normal = face.normal.slice(0);
                    
                    pcolors = face.point_colors;
                    if (pcolors.length === 4) {
                        destFace.point_colors = [pcolors[2].slice(0), pcolors.pop(), pcolors[0].slice(0)];
                    }
                    
                    puvs = face.uvs;
                    if (puvs.length === 4) {
                        destFace.uvs = [puvs[2].slice(0), puvs.pop(), puvs[0].slice(0)];
                    }

                    pnorms = face.point_normals;
                    if (pnorms.length === 4) {
                        destFace.point_normals = [pnorms[2].slice(0), pnorms.pop(), pnorms[0].slice(0)];
                    }
                } else if (pts.length > 4) {
                    var contour = [];
                    var point_list = [];
                    var j,jMax;
                    var ctr = [0,0,0];
                    var vec3 = base.vec3;
                    var initVec;
                    
                    for (j = 0, jMax = pts.length; j<jMax; j++) {
                        ctr = vec3.add(ctr,this.points[pts[j]]);
                        point_list[j] = this.points[pts[j]];
                    }
                    ctr[0]/=pts.length;
                    ctr[1]/=pts.length;
                    ctr[2]/=pts.length;

                    for (j = 0, jMax = pts.length; j<jMax; j++) {
                        if (!vec3.equal(ctr,this.points[pts[j]])) {
                            initVec = vec3.normalize(vec3.subtract(this.points[pts[j]],ctr));
                            break;
                        }
                    }

                    var norm = face.normal = base.polygon.normal(point_list);
                    
                    var bvx = initVec;
                    var bvy = vec3.normalize(vec3.cross(initVec,norm));
                    
                    for (j = 0, jMax = pts.length; j<jMax; j++) {
                        var v = vec3.subtract(ctr,this.points[pts[j]]);
                        contour[j] = [vec3.dot(bvx,v),vec3.dot(bvy,v)];
                    }
                
                    var indices = base.polygon.triangulate2D(contour);
                    
                    if (indices !== null) {
                        pcolors = face.point_colors;
                        puvs = face.uvs;
                        pnorms = face.point_normals;

                        for (j = 0, jMax = indices.length; j<jMax; j+=3) {
                            if (j === 0) {
                                this.faces[i] = new base.Face();
                                destFace = this.faces[i];
                            } else {
                                destFace = this.faces[this.addFace()];
                            }
                            
                            destFace.material = face.material;
                            destFace.segment = face.segment;
                            destFace.points = [pts[indices[j]], pts[indices[j+1]], pts[indices[j+2]]];
                            destFace.normal = face.normal.slice(0);
                            
                            if (pcolors.length) {
                                destFace.point_colors = [pcolors[indices[j]].slice(0), pcolors[indices[j+1]].slice(0), pcolors[indices[j+2]].slice(0)];
                            }
                            
                            if (puvs.length) {
                                destFace.uvs = [puvs[indices[j]].slice(0), puvs[indices[j+1]].slice(0), puvs[indices[j+2]].slice(0)];
                            }

                            if (pnorms.length) {
                                destFace.point_normals = [pnorms[indices[j]].slice(0), pnorms[indices[j+1]].slice(0), pnorms[indices[j+2]].slice(0)];
                            }
                        }   
                    } else {
                        base.log("Unable to triangulate face "+i+", possible degenerate poly.");
                    }
                }
            }

            return this;
        },

        booleanAdd: function (objAdd, transform) {
            var mat4 = base.mat4;
            var pofs = this.points.length;
            var fofs = this.faces.length;

            var i, j, iMax, jMax;
            
            transform = parseTransform(transform);

            if (objAdd.wireframeMaterial) {
                this.wireframeMaterial = objAdd.wireframeMaterial;
            }

            if (objAdd.pointMaterial) {
                this.pointMaterial = objAdd.pointMaterial;
            }

            if (transform !== undef) {
                var m = transform;
                for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
                    this.addPoint(mat4.vec3_multiply(objAdd.points[i], m));
                }
            } else {
                for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
                    this.addPoint([objAdd.points[i][0], objAdd.points[i][1], objAdd.points[i][2]]);
                }
            }

            var matMap = [];

            for (i = 0, iMax = objAdd.materials.length; i < iMax; i++) {
                var mindex = this.materials.indexOf(objAdd.materials[i]);

                if (mindex === -1) {
                    this.materials.push(objAdd.materials[i]);
                    matMap[i] = this.materials.length - 1;
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
                
                if (nFace.material===undef) nFace.material = 0;

                for (j = 0, jMax = objAdd.faces[i].uvs.length; j < jMax; j++) {
                    nFace.uvs[j] = [objAdd.faces[i].uvs[j][0], objAdd.faces[i].uvs[j][1]];
                }

                for (j = 0, jMax = objAdd.faces[i].point_normals.length; j < jMax; j++) {
                    nFace.point_normals[j] = [objAdd.faces[i].point_normals[j][0], objAdd.faces[i].point_normals[j][1], objAdd.faces[i].point_normals[j][2]];
                }
            }

            return this;
        },

        calcFaceNormals: function (face_start,face_end) {
            var vec3 = base.vec3;
            var triangle = base.triangle;
            var i = 0, iMax = this.faces.length;
            var face, points = this.points, fp;
            
            if (face_start) {
              i = face_start;
            }
            
            if (face_end) {
              iMax = face_end+1;
            }
            
            for (; i < iMax; i++) {
                face = this.faces[i];
                fp = face.points;
                if (fp.length < 3) {
                    face.normal = [0, 0, 0];
                    continue;
                }

                face.normal = vec3.normalize(triangle.normal(points[fp[0]], points[fp[1]], points[fp[2]]));
            }

            return this;
        },

        getMaterial: function (m_name) {

            if (!isNaN(parseInt(m_name,10))) {
                return this.materials[i];
            }

            for (var i = 0, iMax = this.materials.length; i < iMax; i++) {
                if (this.materials[i].name === m_name) {
                    return this.materials[i];
                }
            }

            return null;
        },

        getMaterials: function () {
            return this.materials;
        },
        
        bindInstanceMaterials: function (mat_inst) {
          this.instanceMaterials = mat_inst;
        },

        calcNormals: function (outNormalMapRef) {
            var vec3 = base.vec3;
            var updateMap = false;
            var normalMapRef_out;
            this.genNormals = true;
                

            if (this.dynamic) {
                normalMapRef_out = [];
                outNormalMapRef = outNormalMapRef||{};
            }

            if (outNormalMapRef !== undef) {
                normalMapRef_out = [];
                updateMap = true;
            }

            this.calcFaceNormals();

            var i, j, k, iMax, jMax, kMax;

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
                    var max_smooth = this.materials.length ? this.materials[this.faces[faceNum].material].max_smooth : 60.0;
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
            
            if (updateMap) {
                var normTotal = 0;            

                for (i = 0, iMax= normalMapRef_out.length; i<iMax; i++){
                    for (j = 0, jMax= normalMapRef_out[i].length; j<jMax; j++){
                        normTotal += normalMapRef_out[i][j].length;
                    }
                }

                var hasSegments = this.segments&&(this.segments.length>1);

                if (!outNormalMapRef.faceCount) outNormalMapRef.faceCount = new Uint8Array(this.faces.length*3);
                if (!outNormalMapRef.faceNorm) outNormalMapRef.faceNorm = (this.faces.length>65535)?(new Uint32Array(normTotal)):(new Uint16Array(normTotal));
//                if (hasSegments) {                   
                    if (!outNormalMapRef.faceNormIdx) outNormalMapRef.faceNormIdx = (this.faces.length>65535)?(new Uint32Array(this.faces.length)):(new Uint16Array(this.faces.length));
  //              }

                var c = 0;

                for (i = 0, iMax = this.faces.length; i<iMax; i++){
                    for (j = 0; j< 3; j++){
                        var nmij = normalMapRef_out[i][j];
                        outNormalMapRef.faceCount[i*3+j] = nmij?nmij.length:0;
    //                    if (hasSegments) {
                            outNormalMapRef.faceNormIdx[i] = c;
      //                  }
                        if (nmij) for (k = 0, kMax = nmij.length; k<kMax; k++){
                          outNormalMapRef.faceNorm[c++] = normalMapRef_out[i][j][k];
                        } else {
                          c++;
                        }
                    }
                }
                
                this.normalMapRef = outNormalMapRef;
//                this.normalMapRef = normalMapRef_out;
            }

            return this;
        },

        // given the parameter map output from calcNormals, recalculate all the normals again quickly
/*        recalcNormals: function (normalMapRef) {
            var faceNum,faceMax,pointNum,pMax,i,l,n,a,b,c,nc,pn,oRef,oFace,face,faceMapRef,nCount;

            normalMapRef = normalMapRef||this.normalMapRef;

            if (!normalMapRef) return;
            
            this.calcFaceNormals();

            for (faceNum = 0, faceMax = this.faces.length; faceNum < faceMax; faceNum++) {
                face = this.faces[faceNum];
                faceMapRef = normalMapRef[faceNum];
                
                for (pointNum = 0, pMax = face.points.length; pointNum < pMax; pointNum++) {
                    pn = face.point_normals[pointNum];
                    oRef = faceMapRef[pointNum];
                    nCount = oRef.length;

                    n = face.normal;
                    a = n[0];
                    b = n[1];
                    c = n[2];

                    for (var i = 0; i < nCount; i++) {
                        oFace = this.faces[oRef[i]];
                        n = oFace.normal;
                        a += n[0];
                        b += n[1];
                        c += n[2];
                    }

                    if (nCount) {
                        nc = nCount+1;
                        a /= nc;
                        b /= nc;
                        c /= nc;

                        l = Math.sqrt(a * a + b * b + c * c);

                        a /= l;
                        b /= l;
                        c /= l;
                        
                        pn[0] = a; pn[1] = b; pn[2] = c;
                    }
                }
            }

            return this;
        },
        */
        
        // New version with linear typed array run
        recalcNormals: function (normalMapRef,options) {
            if (!this.genNormals) return;
            
            var faceNum,faceMax,pointNum,pMax,i,l,n,a,b,c,nc,pn,oRef,oFace,face,faceMapRef,nCount;

            options = options || {};
            normalMapRef = normalMapRef||this.normalMapRef;

            if (!normalMapRef) return;
            
            var hasSegments = (options.segments!==undef)?true:false;
            var segments = options.segments;

            
            this.calcFaceNormals();

            var refIdx = 0;
            var faceIdx = 0;
            var rc = 0;
            var on;

            if (hasSegments) {
                var dm = this.dynamicData.VBO.dynamicMap;
                var faceNormIdx = normalMapRef.faceNormIdx;
                
                for (var seg = 0, segMax = segments.length; seg < segMax; seg++) {
                    var dmSeg = dm.segmentMap[segments[seg]];
                    for (var idx = 0, idxMax = dmSeg.length; idx < idxMax; idx++) {
                        faceNum = dmSeg[idx];
                        face = this.faces[faceNum];
                        on = face.normal;
                        refIdx = faceNormIdx[faceNum];

                        for (j = 0; j < 3; j++) {
                            pn = face.point_normals[j];
                            a = on[0];
                            b = on[1];
                            c = on[2];

                            nCount = normalMapRef.faceCount[faceNum*3+j];
                            
                            for (i = 0, iMax = nCount; i<iMax; i++) {
                                oRef = normalMapRef.faceNorm[refIdx+i];
                                oFace = this.faces[oRef];
                                n = oFace.normal;
                                a += n[0];
                                b += n[1];
                                c += n[2];          
                            }
                            
                            if (nCount) {
                                nc = nCount+1;
                                a /= nc;
                                b /= nc;
                                c /= nc;

                                l = Math.sqrt(a * a + b * b + c * c);

                                a /= l;
                                b /= l;
                                c /= l;

                                pn[0] = a; pn[1] = b; pn[2] = c;
                            } else {
                                rc++;
                            }
                        }
                    }
                }
            } else {
                for (faceNum = 0, faceMax = this.faces.length; faceNum < faceMax; faceNum++) {
                    face = this.faces[faceNum];
                    on = face.normal;

                    for (j = 0; j < 3; j++) {
                        pn = face.point_normals[j];
                        a = on[0];
                        b = on[1];
                        c = on[2];

                        nCount = normalMapRef.faceCount[faceIdx++];
                        
                        for (i = 0, iMax = nCount; i<iMax; i++) {
                            oRef = normalMapRef.faceNorm[refIdx++];
                            oFace = this.faces[oRef];
                            n = oFace.normal;
                            a += n[0];
                            b += n[1];
                            c += n[2];          
                        }
                        
                        if (nCount) {
                            nc = nCount+1;
                            a /= nc;
                            b /= nc;
                            c /= nc;

                            l = Math.sqrt(a * a + b * b + c * c);

                            a /= l;
                            b /= l;
                            c /= l;

                            pn[0] = a; pn[1] = b; pn[2] = c;
                        } else {
                            rc++;
                        }
                    }
                }
            }
            
            return this;
        },
        
        removeDoubles: function(tolerance) {
          var newPoints = [];         
          var remap = [];
          var i, iMax, j, jMax;
          
          for (i = 0, iMax = this.points.length; i < iMax; i++) {
            var foundPt = -1;
            var searchPt = this.points[i];
            for (j = 0, jMax = newPoints.length; j<jMax; j++) {
              var findPt = newPoints[j];
              if (base.vec3.equal(searchPt,findPt,tolerance)) {
                foundPt=j;
                break;
              }
            }
            if (foundPt != -1) {
              remap[i] = foundPt;
            } else {
              remap[i] = newPoints.length;
              newPoints.push(this.points[i]);
            }
          }          
          
          this.points = newPoints;
          for (i = 0, iMax = this.faces.length; i < iMax; i++) {
            var face = this.faces[i];
            for (j = 0, jMax = face.points.length; j < jMax; j++) {
              face.points[j] = remap[face.points[j]];
            }
          }
          
          return this;
        },
        
        
        buildEdges: function() {
            var i,j,iMax,jMax;
            var edges = [];
            var edge_result = [];
            
            for (i = 0, iMax = this.faces.length; i < iMax; i++) {
                var face = this.faces[i];
                for (j = 0, jMax = face.points.length; j < jMax; j++) {
                    var pta,ptb,segId;
                    
                    segId = face.segment;
                    matId = face.material;
                    
                    if (j) { 
                        ptb = face.points[j]; 
                        pta = face.points[j-1];
                            
                    } else { 
                        ptb = face.points[j]; 
                        pta = face.points[jMax-1]; 
                    }
                    
                    edges[pta] = edges[pta] || {};
                    edges[pta][matId] = edges[pta][matId] || {};
                    edges[pta][matId][segId] = edges[pta][matId][segId] || {};

                    if (!edges[pta][matId][segId][ptb] && !(edges[ptb] && edges[ptb][matId][segId][pta])) {
                        edge_result.push([matId,segId,pta,ptb]);
                    }                    
                }
            }

            this.edges = edge_result;
            
            return this;            
        },
        
        subdivide: function(level,catmull) { // catmull-clark subdivision with alternate regular subdivision if catmull===false
            var vec3 = base.vec3; 
            catmull = (catmull===undef)?true:catmull;

            if (level === undef) {
                level = 1;
            }
            if (level === 0) {
                return;
            }

            var i,j,iMax,jMax,k,kMax,face,edge;
            var edges = {};
            var point_face_list = [];
            var point_edge_list = [];
            var pointCount = this.points.length;            
            var faceCount = this.faces.length;
    
            var face_points = [];
            var face_point_uv = [];
            var face_point_color = [];
            var face_point_normal = [];
            
            for (i = 0, iMax = faceCount; i < iMax; i++) {
                face = this.faces[i];
                if (face.points && (face.points.length===3||face.points.length===4)) {

                    var face_point = [0,0,0];

                    for (j = 0, jMax = face.points.length; j < jMax; j++) {
                         var addPoint = this.points[face.points[j]];
                         face_point[0]+=addPoint[0];
                         face_point[1]+=addPoint[1];
                         face_point[2]+=addPoint[2];
                    }

                    face_point[0]/=jMax;
                    face_point[1]/=jMax;
                    face_point[2]/=jMax;
                    face_points[i] = this.addPoint(face_point);
                    
                    if (face.uvs.length === face.points.length) {
                        var face_uv = [0,0];
                    
                        for (j = 0, jMax = face.uvs.length; j < jMax; j++) {
                            var point_uv = face.uvs[j];
                            face_uv[0]+=point_uv[0];
                            face_uv[1]+=point_uv[1];
                        }
                        
                        face_uv[0]/=jMax;
                        face_uv[1]/=jMax;
                        face_point_uv[i] = face_uv;
                    }
                    
                    if (face.point_colors.length === face.points.length) {
                        var face_color = [0,0,0];
                    
                        for (j = 0, jMax = face.point_colors.length; j < jMax; j++) {
                            var point_color = face.point_colors[j];
                            face_color[0]+=point_color[0];
                            face_color[1]+=point_color[1];
                            face_color[2]+=point_color[2];
                        }
                        
                        face_color[0]/=jMax;
                        face_color[1]/=jMax;
                        face_color[2]/=jMax;
                        face_point_color[i] = face_color;
                    }
                    
                    if (face.point_normals.length === face.points.length) {
                        var face_normal = [0,0,0];
                    
                        for (j = 0, jMax = face.point_normals.length; j < jMax; j++) {
                            var point_normal = face.point_normals[j];
                            face_normal[0]+=point_normal[0];
                            face_normal[1]+=point_normal[1];
                            face_normal[2]+=point_normal[2];
                        }
                        
                        face_normal[0]/=jMax;
                        face_normal[1]/=jMax;
                        face_normal[2]/=jMax;
                        face_point_normal[i] = face_normal;
                    }
                }

            }

            for (i = 0, iMax = this.faces.length; i < iMax; i++) {
                face = this.faces[i];
                for (j = 0, jMax = face.points.length; j < jMax; j++) {
                    var pta,ptb,fpa,fpb;

                    if (j) { 
                        fpa = j;
                        fpb = j-1;
                    } else { 
                        fpa = j; 
                        fpb = jMax-1; 
                    }

                    ptb = face.points[fpa]; 
                    pta = face.points[fpb];
                    
                    edges[pta] = edges[pta] || {};
                    point_face_list[pta] = point_face_list[pta] || [];
                    point_face_list[pta].push(i);
                    
                    if (edges[pta][ptb]!==undef) {
//                        log("Mesh.subdivide warning face #"+i+", edge:["+fpa+"->"+fpb+"] already used by face#"+edges[pta][ptb].face+", edge:["+edges[pta][ptb].fpa+"->"+edges[pta][ptb].fpb+"] possible mangling.");
                    }
                    
                    edges[pta][ptb] = { face:i, a: pta, b: ptb, fpa: fpa, fpb: fpb };
                }
            }

            for (i in edges) {
                if (!edges.hasOwnProperty(i)) continue;
                for (j in edges[i]) {
                    if (!edges[i].hasOwnProperty(j)) continue;
                    var edgeA = edges[i][j];
                    var edgeB = edges[j][i];
                    if (edgeB===undef) {
                        log("Mesh.subdivide error. Hole at face #"+edgeA.face+", Edge:["+edgeA.fpa+"->"+edgeA.fpb+"], holes not yet supported; perhaps use Mesh.removeDoubles()?");
                        return;
                    }
                    if (!edgeA.edge_point) {
                        var edge_avg = vec3.multiply(vec3.add(this.points[edgeA.a],this.points[edgeA.b]),0.5);
                        if (catmull) {
                            var face_avg = vec3.multiply(vec3.add(this.points[face_points[edgeA.face]],this.points[face_points[edgeB.face]]),0.5);
                            edgeA.edge_point = vec3.multiply(vec3.add(edge_avg,face_avg),0.5);
                        } else {
                           edgeA.edge_point = edge_avg;
                        }
                        edgeB.edge_point = edgeA.edge_point;
                        edgeA.edge_avg = edge_avg;
                        edgeB.edge_avg = edge_avg;
                        edgeA.ep_idx = this.addPoint(edgeA.edge_point);
                        edgeB.ep_idx = edgeA.ep_idx;
                    }                   
                    point_edge_list[edgeA.a] = point_edge_list[edgeA.a] || [];
                    point_edge_list[edgeA.a].push(edgeA.edge_avg);
                    var edge_uvs = this.faces[edgeA.face].uvs;
                    if (edge_uvs.length) {
                        var uv_a = edge_uvs[edgeA.fpa];
                        var uv_b = edge_uvs[edgeA.fpb];

                        edgeA.uv = [(uv_a[0]+uv_b[0])/2,(uv_a[1]+uv_b[1])/2];
                    }
                    var edge_colors = this.faces[edgeA.face].point_colors;
                    if (edge_colors.length) {
                        var color_a = edge_colors[edgeA.fpa];
                        var color_b = edge_colors[edgeA.fpb];

                        edgeA.color = vec3.multiply(vec3.add(color_a,color_b),0.5);
                    }
                    var edge_normals = this.faces[edgeA.face].point_normals;
                    if (edge_normals.length) {
                        var normal_a = edge_normals[edgeA.fpa];
                        var normal_b = edge_normals[edgeA.fpb];

                        edgeA.normal = vec3.normalize(vec3.multiply(vec3.add(normal_a,normal_b),0.5));
                    }
                }
            }

            if (catmull) {
                var point_face_average = [];
                
                for (i = 0, iMax = pointCount; i<iMax; i++) {
                    var pointFaceAvg = [0,0,0];
                    if (!point_face_list[i]) continue;
                    for (j = 0, jMax = point_face_list[i].length; j < jMax; j++) {                    
                        var addFacePoint = this.points[face_points[point_face_list[i][j]]];
                        pointFaceAvg[0] += addFacePoint[0]; 
                        pointFaceAvg[1] += addFacePoint[1]; 
                        pointFaceAvg[2] += addFacePoint[2]; 
                    }
                    pointFaceAvg[0]/=jMax;
                    pointFaceAvg[1]/=jMax;
                    pointFaceAvg[2]/=jMax;

                    point_face_average[i] = pointFaceAvg;
                }
            
                var point_edge_average = [];
                
                for (i = 0, iMax = pointCount; i<iMax; i++) {
                    var pointEdgeAvg = [0,0,0];
                    if (!point_edge_list[i]) continue;
                    for (j = 0, jMax = point_edge_list[i].length; j < jMax; j++) {
                        var addEdgePoint = point_edge_list[i][j];
                        pointEdgeAvg[0] += addEdgePoint[0]; 
                        pointEdgeAvg[1] += addEdgePoint[1]; 
                        pointEdgeAvg[2] += addEdgePoint[2]; 
                    }
                    pointEdgeAvg[0]/=jMax;
                    pointEdgeAvg[1]/=jMax;
                    pointEdgeAvg[2]/=jMax;

                    point_edge_average[i] = pointEdgeAvg;
                }
            

                for (i = 0, iMax = pointCount; i<iMax; i++) {
                    if (!point_face_list[i]) continue;
                    var n = point_face_list[i].length;
                    var pt = this.points[i];
                    
                    var m1 = (n-3) / n;
                    var m2 = 1.0 / n;
                    var m3 = 2.0 / n;

                    var newPoint = vec3.multiply(pt,m1);
                    newPoint = vec3.add(newPoint,vec3.multiply(point_face_average[i],m2));
                    newPoint = vec3.add(newPoint,vec3.multiply(point_edge_average[i],m3));

                    this.points[i] = newPoint;
                }
            }                    
                    
            for (i = 0; i < faceCount; i++) {
                face = this.faces[i];
                if (face.points.length!==3 && face.points.length!==4) continue;
                
                var opt = face.points.slice(0);
                var ouv = face.uvs.slice(0);
                var oc = face.point_colors.slice(0);
                var on = face.point_normals.slice(0);
                var hasUV = ouv.length===opt.length;
                var hasColor = oc.length===opt.length;
                var hasNormal = on.length===opt.length;
                var omat = face.material;
                var faceNum,e1,e2;
 
                if (opt.length === 3) {
                    this.setFaceMaterial(omat);
                    e1 = edges[opt[0]][opt[1]]; e2 = edges[opt[2]][opt[0]];
                    this.addFace([opt[0], e1.ep_idx, face_points[i], e2.ep_idx], i);
                    if (hasUV) this.faces[i].uvs = [ouv[0],e1.uv,face_point_uv[i],e2.uv];
                    if (hasColor) this.faces[i].point_colors = [oc[0],e1.color,face_point_color[i],e2.color];
                    if (hasNormal) this.faces[i].point_normals = [on[0],e1.normal,face_point_normal[i],e2.normal];

                    e1 = edges[opt[1]][opt[2]]; e2 = edges[opt[0]][opt[1]];
                    faceNum = this.addFace([opt[1], e1.ep_idx, face_points[i], e2.ep_idx]);
                    if (hasUV) this.faces[faceNum].uvs = [ouv[1],e1.uv,face_point_uv[i],e2.uv];
                    if (hasColor) this.faces[faceNum].point_colors = [oc[1],e1.color,face_point_color[i],e2.color];
                    if (hasNormal) this.faces[faceNum].point_normals = [on[1],e1.normal,face_point_normal[i],e2.normal];

                    e1 = edges[opt[2]][opt[0]]; e2 = edges[opt[1]][opt[2]];
                    faceNum = this.addFace([opt[2], e1.ep_idx, face_points[i], e2.ep_idx]);         
                    if (hasUV) this.faces[faceNum].uvs = [ouv[2],e1.uv,face_point_uv[i],e2.uv];
                    if (hasColor) this.faces[faceNum].point_colors = [oc[2],e1.color,face_point_color[i],e2.color];
                    if (hasNormal) this.faces[faceNum].point_normals = [on[2],e1.normal,face_point_normal[i],e2.normal];
               } else {
                    this.setFaceMaterial(omat);
                    e1 = edges[opt[0]][opt[1]]; e2 = edges[opt[3]][opt[0]];
                    this.addFace([opt[0], e1.ep_idx, face_points[i], e2.ep_idx], i);
                    if (hasUV) this.faces[i].uvs = [ouv[0], e1.uv, face_point_uv[i], e2.uv];
                    if (hasColor) this.faces[i].point_colors = [oc[0], e1.color, face_point_color[i], e2.color];
                    if (hasNormal) this.faces[i].point_normals = [on[0], e1.normal, face_point_normal[i], e2.normal];

                    e1 = edges[opt[1]][opt[2]]; e2 = edges[opt[0]][opt[1]];
                    faceNum = this.addFace([opt[1], e1.ep_idx, face_points[i], e2.ep_idx]);
                    if (hasUV) this.faces[faceNum].uvs = [ouv[1], e1.uv, face_point_uv[i], e2.uv];
                    if (hasColor) this.faces[faceNum].point_colors = [oc[1], e1.color, face_point_color[i], e2.color];
                    if (hasNormal) this.faces[faceNum].point_normals = [on[1], e1.normal, face_point_normal[i], e2.normal];

                    e1 = edges[opt[2]][opt[3]]; e2 = edges[opt[1]][opt[2]];
                    faceNum = this.addFace([opt[2], e1.ep_idx, face_points[i], e2.ep_idx]);
                    if (hasUV) this.faces[faceNum].uvs = [ouv[2], e1.uv, face_point_uv[i], e2.uv];
                    if (hasColor) this.faces[faceNum].point_colors = [oc[2], e1.color, face_point_color[i], e2.color];
                    if (hasNormal) this.faces[faceNum].point_normals = [on[2], e1.normal, face_point_normal[i], e2.normal];

                    e1 = edges[opt[3]][opt[0]]; e2 = edges[opt[2]][opt[3]];
                    faceNum = this.addFace([opt[3], e1.ep_idx, face_points[i], e2.ep_idx]);
                    if (hasUV) this.faces[faceNum].uvs = [ouv[3], e1.uv, face_point_uv[i], e2.uv];
                    if (hasColor) this.faces[faceNum].point_colors = [oc[3], e1.color, face_point_color[i], e2.color];
                    if (hasNormal) this.faces[faceNum].point_normals = [on[3], e1.normal, face_point_normal[i], e2.normal];
                }
            }
            
            level--;
            if (level!==0) {
                this.subdivide(level,catmull);
                return;
            }
            return this;            
        },
        
        removeInternals: function() {
            var vec3 = base.vec3; 

            var i,j,iMax,jMax,k,kMax,face,edge;
            var edges = {};
            var pointCount = this.points.length;            
            var faceCount = this.faces.length;

            var pta,ptb,fpa,fpb;

    
            for (i = 0, iMax = this.faces.length; i < iMax; i++) {
                face = this.faces[i];
                for (j = 0, jMax = face.points.length; j < jMax; j++) {
                    if (j) { 
                        fpa = j;
                        fpb = j-1;
                    } else { 
                        fpa = j; 
                        fpb = jMax-1; 
                    }

                    pta = face.points[fpa]; 
                    ptb = face.points[fpb];
                    
                    edges[pta] = edges[pta] || {};
                    
                    if (edges[pta][ptb]===undef) {
                        edges[pta][ptb] = [i];
                    } else {
                        edges[pta][ptb].push(i);
                    }
                }
            }
            
            
            var edgeFunc = function(i) {
                return (edges[ptb][pta].indexOf(i) !== -1);
            };
            
            for (i = 0; i < faceCount; i++) {
                var edgeCount = 0;
                
                face = this.faces[i];
                var edgelist = null;
                                
                for (j = 0, jMax = face.points.length; j < jMax; j++) {
                    if (j) { 
                        fpa = j;
                        fpb = j-1;
                    } else { 
                        fpa = j; 
                        fpb = jMax-1; 
                    }

                    pta = face.points[fpa];
                    ptb = face.points[fpb];
                    
                    if (!edgelist) {
                        edgelist = edges[ptb][pta];
                    } else {
                        edgelist = edgelist.filter(edgeFunc);
                    }
                }

                if (edgelist.length) {
                    this.faces.splice(i,1);
                    faceCount--;
                    i--;
                }
            }
            
            return this;
        },

        prepare: function (doClean) {
            if (doClean === undef) {
                doClean = true;
            }
            
            if (this.buildWireframe && !this.triangulateWireframe) {
                this.buildEdges();                
            }

            this.triangulateQuads();
            if (this.genNormals) this.calcNormals();
            
            if (this.buildWireframe && this.triangulateWireframe) {
                this.buildEdges();           
            }
            
            this.compile();
            
            if (doClean && !this.dynamic) {
                this.clean();
            }

            return this;
        },

        clean: function () {
            var i, iMax;


            for (i = 0, iMax = this.points.length; i < iMax; i++) {
                delete(this.points[i]);
                this.points[i] = null;
            }
            this.points = [];

            for (i = 0, iMax = this.faces.length; i < iMax; i++) {
                delete(this.faces[i].points);
                delete(this.faces[i].point_normals);
                delete(this.faces[i].uvs);
                delete(this.faces[i].normal);
                delete(this.faces[i]);
                this.faces[i] = null;
            }
            this.faces = [];


            return this;
        },

        // generate a compile-map object for the current mesh, used to create a VBO with compileVBO(compileMap)  
        compileMap: function (tolerance) {
            var vec3 = base.vec3;
            var vec2 = base.vec2;
            if (tolerance === undef) tolerance = 0.00001;

            var compileMap = {
                segments: [],
                bounds: []
            };

            var compileRef = [];

            var i, j, k, x, y, iMax, kMax, yMax, matId, segId;

            if (!this.materials.length) this.materials.push(new base.Material());

            for (i = 0, iMax = this.materials.length; i < iMax; i++) {
                compileRef[i] = [];
            }

            for (i = 0, iMax = this.faces.length; i < iMax; i++) {
                if (this.faces[i].points.length === 3) {
                    matId = this.faces[i].material;
                    segId = this.faces[i].segment;

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

            for (i = 0, iMax = compileRef.length; i < iMax; i++) {
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

            for (i = 0, iMax = compileRef.length; i < iMax; i++) {
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
                                            this.faces[oFace].uvs[oPoint], this.faces[faceNum].uvs[x], tolerance)) ? foundPt : -1;
                                        }

                                        if (hasColor) {
                                            foundPt = (vec3.equal(
                                            this.faces[oFace].point_colors[oPoint], this.faces[faceNum].point_colors[x], tolerance)) ? foundPt : -1;
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

                                    if (compileMap.bounds.length === 0) {
                                        compileMap.bounds[0] = [this.points[ptNum][0], this.points[ptNum][1], this.points[ptNum][2]];

                                        compileMap.bounds[1] = [this.points[ptNum][0], this.points[ptNum][1], this.points[ptNum][2]];
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
                                        compileMap.normals.push([faceNum, x]);
                                    }

                                    if (hasColor) {
                                        if (compileMap.colors === undef) {
                                            compileMap.colors = [];
                                        }
                                        compileMap.colors.push([faceNum, x]);
                                    }

                                    if (hasUV) {
                                        if (compileMap.uvs === undef) {
                                            compileMap.uvs = [];
                                        }
                                        compileMap.uvs.push([faceNum, x]);
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



            if (this.edges) {
            
                compileMap.line_elements = [];

                for (i = 0, iMax = this.edges.length; i < iMax; i++) {
                    var edge = this.edges[i];
                    matId = edge[0];
                    segId = edge[1];
                    var ptA = edge[2];
                    var ptB = edge[3];

                    compileMap.line_elements[matId] = compileMap.line_elements[matId] || [];
                    compileMap.line_elements[matId][segId] = compileMap.line_elements[matId][segId] || [];
                    compileMap.line_elements[matId][segId].push(vtxRef[ptA][0][2]);
                    compileMap.line_elements[matId][segId].push(vtxRef[ptB][0][2]);
                }
            }

            compileMap.dynamic = this.dynamic;

            return compileMap;
        },

        // Take a compileMap() result and create a compiled mesh VBO object for bufferVBO(VBO)
        compileVBO: function (compileMap, doElements, doVertex, doNormal, doUV, doColor, doLines, doDynamic) {
            if (typeof (doElements) == 'object') {
                doElements = (doElements.element !== undef) ? doElements.element : true;
                doVertex = (doElements.vertex !== undef) ? doElements.vertex : true;
                doColor = (doElements.color !== undef) ? doElements.color : true;
                doNormal = (doElements.normal !== undef) ? doElements.normal : true;
                doUV = (doElements.uv !== undef) ? doElements.uv : true;
                doLines = (doElements.lines !== undef) ? doElements.lines : (!!compileMap.line_elements);
                doDynamic = (doElements.dynamic !== undef) ? doElements.dynamic : compileMap.dynamic;
            } else {
                if (doElements === undef) doElements = true;
                if (doVertex === undef) doVertex = true;
                if (doColor === undef) doColor = true;
                if (doNormal === undef) doNormal = true;
                if (doUV === undef) doUV = true;
                if (doLines === undef) doLines = (!!compileMap.line_elements);
                if (doDynamic === undef) doDynamic = compileMap.dynamic;
            }
            
            var compiled = {},
              numPoints,
              ofs,
              ptIdx,
              i, j, jctr, iMax,
              k, kMax,
              emap, dynamicMap, step, sourceIndex;

            numPoints = compileMap.points.length||compileMap.uvs.length||compileMap.normals.length||compileMap.colors.length;
            
            var needsUint = (numPoints > 65535);
            var doUnroll = needsUint && (!GLCore.extensions.element_index_uint);
            
            if (needsUint && !doUnroll) {
                compiled.element_type = GLCore.gl.UNSIGNED_INT;
            } else {
                compiled.element_type = GLCore.gl.UNSIGNED_SHORT;
            }
              
            if (doDynamic) {
                dynamicMap = {
                    points: (needsUint)?(new Uint32Array(compileMap.points.length)):(new Uint16Array(compileMap.points.length)),
                    face_points: (needsUint)?(new Uint32Array(compileMap.points.length * 2)):(new Uint16Array(compileMap.points.length * 2)),
                    segments: null
                };
                
                compiled.dynamicMap = dynamicMap;
                compiled.dynamic = true;
            }
            
            doVertex = compileMap.points && doVertex;
            if (doVertex) {
                compiled.vbo_points = new Float32Array(numPoints * 3);
                for (i = 0, iMax = numPoints; i < iMax; i++) {
                    ptIdx = compileMap.points[i];
                    compiled.vbo_points[i*3] = this.points[ptIdx][0];
                    compiled.vbo_points[i*3+1] = this.points[ptIdx][1];
                    compiled.vbo_points[i*3+2] = this.points[ptIdx][2];
                    if (doDynamic) {
                        dynamicMap.points[i] = ptIdx;
                    }
                }
            }

            if (doDynamic) {
                sourceIndex = compileMap.normals||compileMap.colors||compileMap.uvs;
                for (i = 0, iMax = sourceIndex.length; i < iMax; i++) {
                    ptIdx = sourceIndex[i];
                    dynamicMap.face_points[i*2] = ptIdx[0];
                    dynamicMap.face_points[i*2+1] = ptIdx[1];
                }
            }

            doNormal = compileMap.normals && doNormal;
            if (doNormal) {
                compiled.vbo_normals = new Float32Array(numPoints * 3);
                ofs = 0;
                for (i = 0, iMax = numPoints; i < iMax; i++) {
                    ptIdx = compileMap.normals[i];
                    compiled.vbo_normals[ofs++] = this.faces[ptIdx[0]].point_normals[ptIdx[1]][0];
                    compiled.vbo_normals[ofs++] = this.faces[ptIdx[0]].point_normals[ptIdx[1]][1];
                    compiled.vbo_normals[ofs++] = this.faces[ptIdx[0]].point_normals[ptIdx[1]][2];
                }
            }

            doColor = compileMap.colors && doColor;
            if (doColor) {
                compiled.vbo_colors = new Float32Array(numPoints * 3);
                ofs = 0;
                for (i = 0, iMax = numPoints; i < iMax; i++) {
                    ptIdx = compileMap.colors[i];
                    compiled.vbo_colors[ofs++] = this.faces[ptIdx[0]].point_colors[ptIdx[1]][0];
                    compiled.vbo_colors[ofs++] = this.faces[ptIdx[0]].point_colors[ptIdx[1]][1];
                    compiled.vbo_colors[ofs++] = this.faces[ptIdx[0]].point_colors[ptIdx[1]][2];
                }
            }

            doUV = compileMap.uvs && doUV;
            if (doUV) {
                numPoints = compileMap.uvs.length;
                compiled.vbo_uvs = new Float32Array(numPoints * 2);
                ofs = 0;
                for (i = 0, iMax = numPoints; i < iMax; i++) {
                    ptIdx = compileMap.uvs[i];
                    compiled.vbo_uvs[ofs++] = this.faces[ptIdx[0]].uvs[ptIdx[1]][0];
                    compiled.vbo_uvs[ofs++] = this.faces[ptIdx[0]].uvs[ptIdx[1]][1];
                }
            }

            var compiled_elements = [];
            var numElements = 0;
            if (doElements) {
                compiled.elements_ref = [];
                compiled.vbo_elements = [];
                
                for (i = 0, iMax = compileMap.elements.length; i < iMax; i++) {
                    compiled.elements_ref[i] = [];

                    jctr = 0;

                    for (j in compileMap.elements[i]) {
                        if (compileMap.elements[i].hasOwnProperty(j)) {
                            emap = compileMap.elements[i][j];
                            for (k = 0, kMax = emap.length; k < kMax; k++) {
                                compiled_elements.push(emap[k]);
                            }

                            compiled.elements_ref[i][jctr] = [j|0, emap.length|0];

                            jctr++;
                        }
                    }
                }

                numElements = (compiled_elements.length/3);

                if (!needsUint) {
                    compiled.vbo_elements = new Uint16Array(compiled_elements);
                } else {
                    compiled.vbo_elements = new Uint32Array(compiled_elements);
                }
            }


            compiled.segments = compileMap.segments;
            compiled.bounds = compileMap.bounds;


            if (doLines) {
                var unroll_lines = doUnroll;

                if (unroll_lines) { 
                    compiled.vbo_lines = []; 
                    if (doNormal) compiled.vbo_line_normals = [];
                    if (doUV) compiled.vbo_line_uvs = [];
                    if (doColor) compiled.vbo_line_colors = [];
                } else { 
                    compiled.vbo_line_elements = [];                        
                }
                compiled.line_elements_ref = [];
                
         //       if (unroll_lines) {
           //         console.log("Unrolling wireframe points, note: currently only Mesh wireframeMaterial option with ambient color will work properly.");
             //   }

                for (i = 0, iMax = compileMap.line_elements.length; i < iMax; i++) {
                    compiled.line_elements_ref[i] = [];

                    jctr = 0;

                    for (j in compileMap.line_elements[i]) {
                        if (compileMap.line_elements[i].hasOwnProperty(j)) {
                            emap = compileMap.line_elements[i][j];
                            for (k = 0, kMax = emap.length; k < kMax; k++) {
                                if (unroll_lines) {
                                    var idx = emap[k];
                                    
                                    compiled.vbo_lines.push(compiled.vbo_points[idx*3]);
                                    compiled.vbo_lines.push(compiled.vbo_points[idx*3+1]);
                                    compiled.vbo_lines.push(compiled.vbo_points[idx*3+2]);
                                    
                                    if (doNormal) {
                                        compiled.vbo_line_normals.push(compiled.vbo_normals[idx*3]);
                                        compiled.vbo_line_normals.push(compiled.vbo_normals[idx*3+1]);
                                        compiled.vbo_line_normals.push(compiled.vbo_normals[idx*3+2]);
                                    }

                                    if (doColor) {
                                        compiled.vbo_line_colors.push(compiled.vbo_colors[idx*3]);
                                        compiled.vbo_line_colors.push(compiled.vbo_colors[idx*3+1]);
                                        compiled.vbo_line_colors.push(compiled.vbo_colors[idx*3+2]);
                                    }

                                    if (doUV) {
                                        compiled.vbo_line_uvs.push(compiled.vbo_uvs[idx*2]);
                                        compiled.vbo_line_uvs.push(compiled.vbo_uvs[idx*2+1]);
                                    }
                                } else {
                                    compiled.vbo_line_elements.push(emap[k]);
                                }
                            }

                            compiled.line_elements_ref[i][jctr] = [j|0, emap.length|0];

                            jctr++;
                        }
                    }
                }
                
                if (!unroll_lines) {
                    if (needsUint) {
                        compiled.vbo_line_elements = new Uint32Array(compiled.vbo_line_elements);
                    } else {
                        compiled.vbo_line_elements = new Uint16Array(compiled.vbo_line_elements);
                    }
                } else {
                    compiled.vbo_lines = new Float32Array(compiled.vbo_lines);
                    if (doNormal) compiled.vbo_line_normals = new Float32Array(compiled.vbo_line_normals);
                    if (doUV) compiled.vbo_line_uvs = new Float32Array(compiled.vbo_line_uvs);
                    if (doColor) compiled.vbo_line_colors = new Float32Array(compiled.vbo_line_colors);
                }
            }

            if (doUnroll) {
                console.log("Mesh "+(this.name?this.name+" ":"")+"exceeded element index limit and OES_element_index_uint not supported -- unrolling "+numElements+" triangles..");

                // Perform an unroll of the element arrays into a linear drawarray set
                var ur_points, ur_normals, ur_uvs, ur_colors;
                
                if (doVertex) {
                    ur_points = new Float32Array(numElements*9);                    
                }
                if (doNormal) {
                    ur_normals = new Float32Array(numElements*9);
                }
                if (doUV) {
                    ur_uvs = new Float32Array(numElements*6);
                }
                if (doColor) {
                    ur_colors = new Float32Array(numElements*9);
                }
                
                var dyn_face_points_unrolled, dyn_points_unrolled; 
                
                if (doDynamic) {
                    dyn_face_points_unrolled = new Uint32Array(numElements*3*2);
                    dyn_points_unrolled = new Uint32Array(numElements*3);
                }
                                
                for (i = 0, iMax = numElements; i<iMax; i++) {
                    var pt = i*9;
                    
                    var e1 = compiled_elements[i*3]*3, e2 = compiled_elements[i*3+1]*3, e3 = compiled_elements[i*3+2]*3; 
                    
                    if (doDynamic) {
                        var dpt = i*3;
                        var dfpt = dpt*2;
                        
                        dyn_face_points_unrolled[dfpt] = dynamicMap.face_points[compiled_elements[dpt]*2];
                        dyn_face_points_unrolled[dfpt+1] = dynamicMap.face_points[compiled_elements[dpt]*2+1];

                        dyn_face_points_unrolled[dfpt+2] = dynamicMap.face_points[compiled_elements[dpt+1]*2];
                        dyn_face_points_unrolled[dfpt+3] = dynamicMap.face_points[compiled_elements[dpt+1]*2+1];

                        dyn_face_points_unrolled[dfpt+4] = dynamicMap.face_points[compiled_elements[dpt+2]*2];
                        dyn_face_points_unrolled[dfpt+5] = dynamicMap.face_points[compiled_elements[dpt+2]*2+1];

                        dyn_points_unrolled[dpt] = dynamicMap.points[compiled_elements[dpt]];
                        dyn_points_unrolled[dpt+1] = dynamicMap.points[compiled_elements[dpt+1]];
                        dyn_points_unrolled[dpt+2] = dynamicMap.points[compiled_elements[dpt+2]];
                    }

                    if (doVertex) {
                        ur_points[pt] = compiled.vbo_points[e1];
                        ur_points[pt+1] = compiled.vbo_points[e1+1];
                        ur_points[pt+2] = compiled.vbo_points[e1+2];
                                    
                        ur_points[pt+3] = compiled.vbo_points[e2];
                        ur_points[pt+4] = compiled.vbo_points[e2+1];
                        ur_points[pt+5] = compiled.vbo_points[e2+2];
                                    
                        ur_points[pt+6] = compiled.vbo_points[e3];
                        ur_points[pt+7] = compiled.vbo_points[e3+1];
                        ur_points[pt+8] = compiled.vbo_points[e3+2];
                    }
                    if (doNormal) {
                        ur_normals[pt] = compiled.vbo_normals[e1];
                        ur_normals[pt+1] = compiled.vbo_normals[e1+1];
                        ur_normals[pt+2] = compiled.vbo_normals[e1+2];
                                     
                        ur_normals[pt+3] = compiled.vbo_normals[e2];
                        ur_normals[pt+4] = compiled.vbo_normals[e2+1];
                        ur_normals[pt+5] = compiled.vbo_normals[e2+2];
                                     
                        ur_normals[pt+6] = compiled.vbo_normals[e3];
                        ur_normals[pt+7] = compiled.vbo_normals[e3+1];
                        ur_normals[pt+8] = compiled.vbo_normals[e3+2];
                    }
                    if (doUV) {
                        var u1 = compiled_elements[i*3]*2, u2 = compiled_elements[i*3+1]*2, u3 = compiled_elements[i*3+2]*2;
                        ur_uvs[i*6] = compiled.vbo_uvs[u1];
                        ur_uvs[i*6+1] = compiled.vbo_uvs[u1+1];

                        ur_uvs[i*6+2] = compiled.vbo_uvs[u2];
                        ur_uvs[i*6+3] = compiled.vbo_uvs[u2+1];

                        ur_uvs[i*6+4] = compiled.vbo_uvs[u3];
                        ur_uvs[i*6+5] = compiled.vbo_uvs[u3+1];
                    }
                    if (doColor) {
                        ur_colors[pt] = compiled.vbo_colors[e1];
                        ur_colors[pt+1] = compiled.vbo_colors[e1+1];
                        ur_colors[pt+2] = compiled.vbo_colors[e1+2];
                                    
                        ur_colors[pt+3] = compiled.vbo_colors[e2];
                        ur_colors[pt+4] = compiled.vbo_colors[e2+1];
                        ur_colors[pt+5] = compiled.vbo_colors[e2+2];
                                    
                        ur_colors[pt+6] = compiled.vbo_colors[e3];
                        ur_colors[pt+7] = compiled.vbo_colors[e3+1];
                        ur_colors[pt+8] = compiled.vbo_colors[e3+2];
                    }
                }

                if (doVertex) {
                    compiled.vbo_points = ur_points;                    
                }
                if (doNormal) {
                    compiled.vbo_normals = ur_normals;
                }
                if (doUV) {
                    compiled.vbo_uvs = ur_uvs;
                }
                if (doColor) {
                    compiled.vbo_colors = ur_colors;
                }

                if (doDynamic) {
                    delete dynamicMap.points;
                    delete dynamicMap.face_points;
                    dynamicMap.points = dyn_points_unrolled;
                    dynamicMap.face_points = dyn_face_points_unrolled;
                }
                
                compiled.unrolled = true;
                
                
                // console.log("Points :",ur_points.length);
                // console.log("Norms :",ur_normals.length);
                // console.log("Colors :",ur_colors.length);
                // console.log("UVS :",ur_uvs.length);
            } else {
                compiled.unrolled = false;                
            }

            // segmented update support
            if (doDynamic && compileMap.segments.length>1) {
                var segmentMap = [];
                var segId;

                sourceIndex = dynamicMap.points;
                for (i = 0, iMax = sourceIndex.length; i < iMax; i++) {
                    ptIdx = sourceIndex[i];
                    var f = dynamicMap.face_points[i*2];
                    segId = this.faces[f].segment||0;
                    if (segmentMap[segId] === undef) {
                        segmentMap[segId] = [];
                    }
                    segmentMap[segId].push(i);
                }

                compiled.dynamicMap.segmentMap = segmentMap;
            }

            return compiled;
        },

        updateVBO: function (VBO,options) {
            if (!VBO.dynamic) return false;
            
            var i,iMax;
            var dm = VBO.dynamicMap;

            var doPoint = options.points && !!VBO.vbo_points;
            var doNormal = options.normals && !!VBO.vbo_normals;
            var doUV = options.uvs && !!VBO.vbo_uvs;
            var doColor = options.colors && !!VBO.vbo_colors;
            var hasSegments = (options.segments!==undef)?true:false;
            var segments = options.segments;

            var pt,face,fp;

            if (hasSegments) {
                for (var seg = 0, segMax = segments.length; seg < segMax; seg++) {
                    var dmSeg = dm.segmentMap[segments[seg]];
                    for (var idx = 0, idxMax = dmSeg.length; idx<idxMax; idx++) {
                        i = dmSeg[idx];
                        face = this.faces[dm.face_points[i*2]];
                        fp = dm.face_points[i*2+1];
                        if (doPoint) {
                            pt = this.points[dm.points[i]];
                            VBO.vbo_points[i*3] = pt[0];
                            VBO.vbo_points[i*3+1] = pt[1];
                            VBO.vbo_points[i*3+2] = pt[2];
                        }
                        if (doNormal) {
                            pt = face.point_normals[fp];
                            VBO.vbo_normals[i*3] = pt[0];
                            VBO.vbo_normals[i*3+1] = pt[1];
                            VBO.vbo_normals[i*3+2] = pt[2];
                        }
                        if (doColor) {
                            pt = face.point_colors[fp];
                            VBO.vbo_colors[i*3] = pt[0];
                            VBO.vbo_colors[i*3+1] = pt[1];
                            VBO.vbo_colors[i*3+2] = pt[2];
                        }
                        if (doUV) {
                            pt = face.uvs[fp];
                            VBO.vbo_uvs[i*2] = pt[0];
                            VBO.vbo_uvs[i*2+1] = pt[1];
                        }
                    }
                }
            } else {                    
                for (i = 0, iMax = dm.points.length; i < iMax; i++) {
                    face = this.faces[dm.face_points[i*2]];
                    fp = dm.face_points[i*2+1];
                        if (!face) {
                            console.log(dm.face_points[i*2]);
                            return;
                        }
                    if (doPoint) {
                        pt = this.points[dm.points[i]];
                        VBO.vbo_points[i*3] = pt[0];
                        VBO.vbo_points[i*3+1] = pt[1];
                        VBO.vbo_points[i*3+2] = pt[2];
                    }
                    if (doNormal) {
                        pt = face.point_normals[fp];
                        VBO.vbo_normals[i*3] = pt[0];
                        VBO.vbo_normals[i*3+1] = pt[1];
                        VBO.vbo_normals[i*3+2] = pt[2];
                    }
                    if (doColor) {
                        pt = face.point_colors[fp];
                        VBO.vbo_colors[i*3] = pt[0];
                        VBO.vbo_colors[i*3+1] = pt[1];
                        VBO.vbo_colors[i*3+2] = pt[2];
                    }
                    if (doUV) {
                        pt = face.uvs[fp];
                        VBO.vbo_uvs[i*2] = pt[0];
                        VBO.vbo_uvs[i*2+1] = pt[1];
                    }
                }
            }
                        
            return this;
        },

        rebufferVBO: function(VBO, buffer, opt) {
            var gl = GLCore.gl;
            var hasSegments = (opt.segments!==undef)?true:false;
            var segments = opt.segments;            
            

            if (opt.points) {
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_points);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_points, gl.DYNAMIC_DRAW);
            }
            
            if (opt.normals && VBO.vbo_normals) {
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_normals);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_normals, gl.DYNAMIC_DRAW);
            }

            if (opt.uvs && VBO.vbo_uvs) {
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_uvs);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_uvs, gl.DYNAMIC_DRAW);
            }

            if (opt.colors && VBO.vbo_colors) {
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_colors);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_colors, gl.DYNAMIC_DRAW);
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            return this;
        },

        // take a compiled VBO from compileVBO() and create a mesh buffer object for bindBuffer(), fuse with baseBuffer overlay if provided
        bufferVBO: function (VBO, baseBuffer) {
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
            } else {
                buffer.gl_normals = baseBuffer.gl_normals ? baseBuffer.gl_normals : null;
            }

            if (VBO.vbo_uvs) {
                buffer.gl_uvs = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_uvs);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_uvs, gl.STATIC_DRAW);
            } else {
                buffer.gl_uvs = baseBuffer.gl_uvs ? baseBuffer.gl_uvs : null;
            }

            if (VBO.vbo_colors) {
                buffer.gl_colors = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_colors);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_colors, gl.STATIC_DRAW);
            } else {
                buffer.gl_colors = baseBuffer.gl_colors ? baseBuffer.gl_colors : null;
            }

            if (!VBO.vbo_elements && baseBuffer.gl_elements) {
                buffer.gl_elements = baseBuffer.gl_elements;
                buffer.elements_ref = baseBuffer.elements_ref;
            } else {
                if (VBO.vbo_elements.length) {
                    buffer.gl_elements = gl.createBuffer();
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.gl_elements);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, VBO.vbo_elements, gl.STATIC_DRAW);
                }
                buffer.elements_ref = VBO.elements_ref;
            }

            if (!VBO.vbo_line_elements && baseBuffer.gl_line_elements) {
                buffer.gl_line_elements = baseBuffer.gl_line_elements;
                buffer.line_elements_ref = baseBuffer.line_elements_ref;
            } else if (VBO.vbo_line_elements){
                buffer.gl_line_elements = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.gl_line_elements);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, VBO.vbo_line_elements, gl.STATIC_DRAW);
                buffer.line_elements_ref = VBO.line_elements_ref;
            }

            if (!VBO.vbo_lines && baseBuffer.gl_lines) {
                buffer.gl_lines = baseBuffer.gl_lines;
            } else if (VBO.vbo_lines) {
                buffer.gl_lines = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_lines);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_lines, gl.STATIC_DRAW);
                buffer.line_elements_ref = VBO.line_elements_ref;
            } else {
                buffer.gl_lines = null;
            }

            if (!VBO.vbo_line_colors && baseBuffer.gl_line_colors) {
                buffer.gl_line_colors = baseBuffer.gl_line_colors;
            } else if (VBO.vbo_line_colors) {
                buffer.gl_line_colors = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_line_colors);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_line_colors, gl.STATIC_DRAW);
            } else {
                buffer.gl_line_colors = null;
            }
            
            if (!VBO.vbo_line_uvs && baseBuffer.gl_line_uvs) {
                buffer.gl_line_uvs = baseBuffer.gl_line_uvs;
            } else if (VBO.vbo_line_uvs){
                buffer.gl_line_uvs = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_line_uvs);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_line_uvs, gl.STATIC_DRAW);
            } else {
                buffer.gl_line_uvs = null;
            }
            
            if (!VBO.vbo_line_normals && baseBuffer.gl_line_normals) {
                buffer.gl_line_normals = baseBuffer.gl_line_normals;
            } else if (VBO.vbo_line_normals) {
                buffer.gl_line_normals = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gl_line_normals);
                gl.bufferData(gl.ARRAY_BUFFER, VBO.vbo_line_normals, gl.STATIC_DRAW);
            } else {
                buffer.gl_line_normals = null;
            }
            
            buffer.segments = VBO.segments;
            buffer.bounds = VBO.bounds;
            buffer.unrolled = VBO.unrolled;
            buffer.element_type = VBO.element_type;

/*            if (baseBuffer.elements_ref && !VBO.elements_ref) {
                buffer.elements_ref = VBO.elements_ref;            
            }
            if (baseBuffer.line_elements_ref && !VBO.line_elements_ref) {
                buffer.line_elements_ref = VBO.line_elements_ref;            
            }*/

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            return buffer;
        },

        update: function(opt) {
            opt = opt||{};
            
            var doPoint = true;
            if (opt.points !== undef) {
                doPoint = opt.points;
            }
            var doUV = opt.uvs||opt.uv||opt.texture||opt.all||false;
            
            var doNormal = true;
            if (opt.normals !== undef) {
                doNormal = opt.normals;
            }
            var doColor = opt.colors||opt.color||opt.all||false;
            var segments = opt.segments||opt.segment;
            if (segments !== undef && segments.length === undef) {
                segments = [segments];
            }

            if (!this.dynamic) {
                log("Mesh not defined as dynamic, cannot update.");
                return false;
            }
            if (doNormal && this.normalMapRef) {
                this.recalcNormals(undef,{segments: segments});
            }
            
            var options = { points: doPoint, uvs: doUV, normals: doNormal, colors: doColor, segments: segments };

            this.updateVBO(this.dynamicData.VBO,options);
            this.rebufferVBO(this.dynamicData.VBO,this.dynamicData.buffer,options);
        },

        // bind a bufferVBO object result to the mesh
        bindBuffer: function (vbo_buffer) {
            if (this.originBuffer === null) {
                this.originBuffer = vbo_buffer;
            }

            this.compiled = vbo_buffer;

            this.segment_state = [];
            for (var i = 0, iMax = vbo_buffer.segments.length; i < iMax; i++) {
                this.segment_state[vbo_buffer.segments[i]] = true;
            }
            this.bb = vbo_buffer.bounds;
        },

        // Do the works
        compile: function (tolerance) {
            if (this.faces.length > 0 && this.points.length > 0 ) {
              var VBO = this.compileVBO(this.compileMap(tolerance));
              var buffer = this.bufferVBO(VBO);
              this.bindBuffer(buffer);
              if (this.dynamic) {
                  this.sourcePoints = [];
                  for (var i = 0, iMax = this.points.length; i<iMax; i++) {
                      this.sourcePoints[i] = this.points[i].slice(0);
                  }
                  this.dynamicData = {
                      VBO: VBO,
                      buffer: buffer
                  };
              }
            }
            return this;
        },

        addMorphTarget: function (targetBuffer) {
            if (this.morphTargets === null) {
                this.morphTargets = [];
            }
            this.morphTargets.push(targetBuffer);
        },

        setMorphSource: function (idx) {
            if (this.morphSourceIndex === idx) return;
            this.morphSourceIndex = idx;
            this.bindBuffer(this.morphTargets[idx]);
        },

        setMorphTarget: function (idx) {
            if (this.morphTargetIndex === idx) return;
            this.morphTargetIndex = idx;
            this.morphTarget = this.morphTargets[idx];
        },

        setMorphWeight: function (weight) {
            this.morphWeight = weight;
        },

        morphTargetCount: function () {
            return (this.morphTargets !== null) ? this.morphTargets.length : 0;
        }
    };
    
    Mesh.prototype.triangulateQuads = Mesh.prototype.triangulate;
    

    var exports = {
        Mesh: Mesh,
        Face: Face
    };

    return exports;
});
