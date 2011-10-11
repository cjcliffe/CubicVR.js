
CubicVR.RegisterModule("CVRXML",function(base) {
  
  var undef = base.undef;
  var nop = function(){ };
  var enums = CubicVR.enums;
  var GLCore = base.GLCore;

  var MeshPool = [];


  var meshKit = {
  
    getPoints: function(pts_elem,nodeName,force3d) {
      var util = CubicVR.util;
      var str;
      
      if (nodeName) {
        str = meshKit.getTextNode(pts_elem, nodeName);
      } else {
        str = pts_elem.$;
      }

      if (!str) return undef;
      
      var pts = str.split(" ");

      var texName, tex;

      for (i = 0, iMax = pts.length; i < iMax; i++) {
        pts[i] = pts[i].split(",");
        for (j = 0, jMax = pts[i].length; j < jMax; j++) {
          pts[i][j] = parseFloat(pts[i][j]);
        }
        if (force3d) {  // force z to 0, or add z
          pts[i][2] = 0;
        }
      }
      
      return pts;
    },
    
    getTransform: function(telem) {     
      var util = CubicVR.util;
      
      if (!telem) return null;
      
      var result = {
        position: [0,0,0],
        rotation: [0,0,0],
        scale: [1,1,1]
      };

      var position, rotation, scale, tempNode;

      postition = telem.position;
      rotation = telem.rotation;
      scale = telem.scale;

      if (position) result.position = util.floatDelimArray(position.$);
      if (rotation) result.rotation = util.floatDelimArray(rotation.$);
      if (scale) result.scale = util.floatDelimArray(scale.$);

      if (position||rotation||scale) {
        return result;
      }
      
      return null;
    },

    getTextNode: function(pelem, nodeName, default_value) {
      var util = CubicVR.util;
      var text = pelem[nodeName];
      
      if (!text) return default_value;
      if (text.length) text=text[0];
      
      if (text.$) {
         return text.$;
      }
      
      return default_value;
    },


    getFloatNode: function(pelem, nodeName, default_value) {
      var util = CubicVR.util;
      var str = meshKit.getTextNode(pelem, nodeName);
      
      if (str) {
         var val = parseFloat(str);
         if (val != val) return default_value;
         return val;
      }
      
      return default_value;
    },

    getIntNode: function(pelem, nodeName, default_value) {
      var util = CubicVR.util;
      var str = meshKit.getTextNode(pelem, nodeName);
      
      if (str) {
         var val = parseInt(str,10);
         if (val != val) return default_value;
         return val;
      }
      
      return default_value;
    },
    
    getFloatDelimNode: function(pelem, nodeName, default_value, delim) {
      var util = CubicVR.util;
      var str = meshKit.getTextNode(pelem, nodeName);

      if (str) {
         return util.floatDelimArray(str,delim);
      }
      
      return default_value;
    },

    getIntDelimNode: function(pelem, nodeName, default_value, delim) {
      var util = CubicVR.util;
      var str = meshKit.getTextNode(pelem, nodeName);
      
      if (str) {
         return util.intDelimArray(str,delim);
      }
      
      return default_value;
    }
  };

  
  function cubicvr_addTrianglePart(obj, mat, uvSet, melem) {
      var util = CubicVR.util;
      var seglist = null;
      var triangles = null;

      if (melem.triangles) {
        triangles = util.intDelimArray(meshKit.getTextNode(melem,"triangles"), " ");
      }

      if (!triangles) return;

      if (melem.segments) {
        seglist = util.intDelimArray(meshKit.getTextNode(melem,"segments")," ");
      }

      if (seglist === null) {
        seglist = [0, parseInt((triangles.length) / 3, 10)];
      }

      var ofs = 0;

      obj.setFaceMaterial(mat);

      if (triangles.length) {
        for (p = 0, pMax = seglist.length; p < pMax; p += 2) {
          var currentSegment = seglist[p];
          var totalPts = seglist[p + 1] * 3;

          obj.setSegment(currentSegment);

          for (j = ofs, jMax = ofs + totalPts; j < jMax; j += 3) {
            var newFace = obj.addFace([triangles[j], triangles[j + 1], triangles[j + 2]]);
            if (uvSet) {
              obj.faces[newFace].setUV([uvSet[j], uvSet[j + 1], uvSet[j + 2]]);
            }
          }

          ofs += totalPts;
        }
      }
  }
  
  function cubicvr_getUVMapper(uvelem,mappers) {
    var util = CubicVR.util;
    var uvm = new CubicVR.UVMapper();
    var uvmType = null;
    var uvSet = null;

    if (uvelem.type) {
      uvmType = meshKit.getTextNode(uvelem,"type");

      switch (uvmType) {
      case "uv":
        break;
      case "planar":
        uvm.projection_mode = enums.uv.projection.PLANAR;
        break;
      case "cylindrical":
        uvm.projection_mode = enums.uv.projection.CYLINDRICAL;
        break;
      case "spherical":
        uvm.projection_mode = enums.uv.projection.SPHERICAL;
        break;
      case "cubic":
        uvm.projection_mode = enums.uv.projection.CUBIC;
        break;
      }
    }

    if (!uvmType) return null;

    if (uvmType === "uv") {
      if (uvelem.uv) {
        uvSet = meshKit.getPoints(uvelem,"uv");
      }
    }

    if (uvelem.axis) {
      var uvmAxis = meshKit.getTextNode(uvelem,"axis");

      switch (uvmAxis) {
      case "x":
        uvm.projection_axis = enums.uv.axis.X;
        break;
      case "y":
        uvm.projection_axis = enums.uv.axis.Y;
        break;
      case "z":
        uvm.projection_axis = enums.uv.axis.Z;
        break;
      }

    }

    if (uvelem.center) {
      uvm.center = util.floatDelimArray(meshKit.getTextNode(uvelem,"center"));
    }
    if (uvelem.rotation) {
      uvm.rotation = util.floatDelimArray(meshKit.getTextNode(uvelem,"rotation"));
    }
    if (uvelem.scale) {
      uvm.scale = util.floatDelimArray(meshKit.getTextNode(uvelem,"scale"));
    }

    if (uvelem.wrap_w) {
      uvm.wrap_w_count = parseFloat(meshKit.getTextNode(uvelem,"wrap_w"));
    }

    if (uvelem.wrap_h) {
      uvm.wrap_h_count = parseFloat(meshKit.getTextNode(uvelem,"wrap_h"));
    }

    if (uvmType !== "" && uvmType !== "uv") {
      return uvm; // object
    } else {
      return uvSet; // array
    }
  }
  

  function cubicvr_getMaterial(melem,prefix) {
    var util = CubicVR.util;
    var matName = melem.name ? melem.name.$ : null;
    var mat = new CubicVR.Material({name:matName});


    if (melem.shininess) {
      mat.shininess = meshKit.getFloatNode(melem,"shininess",mat.shininess)/100.0;
    }

    mat.opacity = meshKit.getFloatNode(melem,"alpha",mat.opacity);
    mat.max_smooth = meshKit.getFloatNode(melem,"max_smooth",mat.max_smooth);
    mat.color = meshKit.getFloatDelimNode(melem,"color",mat.color);
    mat.ambient = meshKit.getFloatDelimNode(melem,"ambient",mat.ambient);
    mat.diffuse = meshKit.getFloatDelimNode(melem,"diffuse",mat.diffuse);
    mat.specular = meshKit.getFloatDelimNode(melem,"specular",mat.specular);

    var texName;

    if (!!(texName = meshKit.getTextNode(melem,"texture"))) {
      texName = (prefix ? prefix : "") + texName;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.COLOR);
    }

    if (!!(texName = meshKit.getTextNode(melem,"texture_luminosity"))) {
      texName = (prefix ? prefix : "") + texName; 
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.AMBIENT);
    }

    if (!!(texName = meshKit.getTextNode(melem,"texture_normal"))) {
      texName = (prefix ? prefix : "") + texName;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.NORMAL);
    }

    if (!!(texName = meshKit.getTextNode(melem,"texture_specular"))) {
      texName = (prefix ? prefix : "") + texName;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.SPECULAR);
    }

    if (!!(texName = meshKit.getTextNode(melem,"texture_bump"))) {
      texName = (prefix ? prefix : "") + texName;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.BUMP);
    }

    if (!!(texName = meshKit.getTextNode(melem,"texture_envsphere"))) {
      texName = (prefix ? prefix : "") + texName;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.ENVSPHERE);
    }

    if (!!(texName = meshKit.getTextNode(melem,"texture_alpha"))) {
      texName = (prefix ? prefix : "") + texName;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.ALPHA);
    }
    
    return mat;
  }


  function cubicvr_loadMesh(meshUrl, prefix) {
    if (MeshPool[meshUrl] !== undef) {
     return MeshPool[meshUrl];
    }

    var util = CubicVR.util;

    var i, j, p, iMax, jMax, pMax;

    var mesh = null;
    if (typeof(meshUrl) == 'object') {
      mesh = meshUrl;
    } else if (meshUrl.indexOf(".js") != -1) {
      mesh = util.getJSON(meshUrl);
    } else {
      mesh = CubicVR.util.xml2badgerfish(util.getXML(meshUrl));
    }

    if (mesh.root) mesh = mesh.root;
    if (mesh.properties) mesh = mesh.properties;

    var obj = new CubicVR.Mesh();
    
    if (mesh.points) {
      var pts = meshKit.getPoints(mesh,"points");
      if (pts) {
        obj.addPoint(pts);
      }
    }

    var material_elem = mesh.material;
    if (material_elem && !material_elem.length) material_elem = [material_elem];

    var mappers = [];

    if (material_elem) for (i = 0, iMax = material_elem.length; i < iMax; i++) {
      var melem = material_elem[i];

      var mat = cubicvr_getMaterial(melem,prefix);

      var uvelem=null,uvm=null,uvSet=null;
      
      if (melem.uvmapper) {
        uvm = cubicvr_getUVMapper(melem.uvmapper);
        if (uvm && !uvm.length) {
           mappers.push([uvm,mat]);
        } else {
           uvSet = uvm;
        }
      }
  
      var mpart = melem.part;
      if (mpart && !mpart.length) mpart = [mpart];

      
      if (mpart && mpart.length) {
        var local_uvm = null;
        var ltrans = null;

        for (j = 0, jMax = mpart.length; j<jMax; j++) {
          var part = mpart[j];
          local_uvm = null;
          uvSet = null;
          
          uvelem = part.uvmapper;
          
          if (uvelem) {
            local_uvm = cubicvr_getUVMapper(uvelem);

            if (melem.triangles) {
              var face_start = obj.faces.length, face_end = face_start;
              if (local_uvm && !local_uvm.length) {
                cubicvr_addTrianglePart(obj,mat,null,part);
                face_end = obj.faces.length-1;
                obj.calcFaceNormals(face_start,face_end);
                local_uvm.apply(obj,mat,undef,face_start,face_end);
              } else if (local_uvm && local_uvm.length) {
                cubicvr_addTrianglePart(obj,mat,local_uvm,part);
              } else if (uvm && !uvm.length) {
                cubicvr_addTrianglePart(obj,mat,null,part);
                face_end = obj.faces.length-1;
                obj.calcFaceNormals(face_start,face_end);
                uvm.apply(obj,mat,undef,face_start,face_end);
              }
            }
          }
                
          if (part.procedural) {
            uvelem = part.uvmapper;
          
            if (uvelem) {
              local_uvm = cubicvr_getUVMapper(uvelem);
            }

            if (part.transform) {
              ltrans = meshKit.getTransform(part.transform);
            } else {
              ltrans = undef;
            }
            
            var trans = undef;
          
            var proc = part.procedural;
            var ptype = meshKit.getTextNode(proc,"type");

            if (ltrans) {
              trans = new CubicVR.Transform();
              trans.translate(ltrans.position);
              trans.pushMatrix();
              trans.rotate(ltrans.rotation);
              trans.pushMatrix();
              trans.scale(ltrans.scale);
            }

            if (!uvm) uvm = undef;
            
            var prim = {
              material: mat,
              uvmapper: uvm||local_uvm
            };
              
            if (ptype === "box" || ptype === "cube") {
              prim.size = meshKit.getFloatNode(proc,"size");
              obj.booleanAdd(CubicVR.primitives.box(prim),trans);
            } else if (ptype === "sphere") {
              prim.radius = meshKit.getFloatNode(proc,"radius");
              prim.lat = meshKit.getIntNode(proc,"lat");
              prim.lon = meshKit.getIntNode(proc,"lon");
              obj.booleanAdd(CubicVR.primitives.sphere(prim),trans);
            } else if (ptype === "cone") {
              prim.base = meshKit.getFloatNode(proc,"base");
              prim.height = meshKit.getFloatNode(proc,"height");
              prim.lon = meshKit.getIntNode(proc,"lon");
              obj.booleanAdd(CubicVR.primitives.cone(prim),trans);
            } else if (ptype === "plane") {
              prim.size = meshKit.getFloatNode(proc,"size");
              obj.booleanAdd(CubicVR.primitives.plane(prim),trans);
            } else if (ptype === "cylinder") {
              prim.radius = meshKit.getFloatNode(proc,"radius");
              prim.height = meshKit.getFloatNode(proc,"height");
              prim.lon = meshKit.getIntNode(proc,"lon");
              obj.booleanAdd(CubicVR.primitives.cylinder(prim),trans);
            } else if (ptype === "torus") {
              prim.innerRadius = meshKit.getFloatNode(proc,"innerRadius");
              prim.outerRadius = meshKit.getFloatNode(proc,"outerRadius");
              prim.lat = meshKit.getIntNode(proc,"lat");
              prim.lon = meshKit.getIntNode(proc,"lon");
              obj.booleanAdd(CubicVR.primitives.torus(prim),trans);
            } else if (ptype === "lathe") {
              prim.points = meshKit.getPoints(proc,"p");
              prim.lon = meshKit.getIntNode(proc,"lon");
              obj.booleanAdd(CubicVR.primitives.lathe(prim),trans);
            } else if (ptype === "polygon") {
              var poly_pts = meshKit.getPoints(proc,"p");
              var poly = new CubicVR.Polygon(poly_pts);   
              var cuts = proc.cut;
              if (cuts && !cuts.length) cuts = [cuts];
              
              if (cuts.length) {
                for (j = 0, iMax = cuts.length; j<jMax; j++) {
                  poly.cut(new CubicVR.Polygon(meshKit.getPoints(cuts[j])));
                }                
              }
              
              prim.front = 0;
              prim.back = 0;
              prim.frontShift = 0;
              prim.backShift = 0;
              prim.frontDepth = 0;
              prim.backDepth = 0;

              
              if (proc.extrude) {
                var ext = proc.extrude;
                prim.front = meshKit.getFloatNode(ext,"front",0);
                prim.back = meshKit.getFloatNode(ext,"back",0);
                prim.frontShift = meshKit.getFloatNode(ext,"frontBevelShift",0);
                prim.backShift = meshKit.getFloatNode(ext,"backBevelShift",0);
                prim.frontDepth = meshKit.getFloatNode(ext,"frontBevelDepth",0);
                prim.backDepth = meshKit.getFloatNode(ext,"backBevelDepth",0);
                prim.depth = meshKit.getFloatNode(ext,"depth",0);
                prim.shift = meshKit.getFloatNode(ext,"shift",0);
                prim.bevel = meshKit.getFloatNode(ext,"bevel",0);
                
                if (prim.depth && !prim.backDepth && !prim.frontDepth) {
                  prim.front = -prim.depth/2;
                  prim.back = prim.depth/2;
                }
                
                if (prim.shift && !prim.backShift && !prim.frontShift) {
                  prim.frontShift = prim.shift;
                  prim.backShift = prim.shift;
                }

                if (prim.bevel && !prim.backDepth && !prim.frontDepth) {
                  prim.frontDepth = prim.bevel;
                  prim.backDepth = prim.bevel;
                }
              }              
              
              var pMesh = poly.toExtrudedBeveledMesh(new CubicVR.Mesh(),prim);
              
              pMesh.setFaceMaterial(prim.material);
              obj.booleanAdd(pMesh,trans);
            }        
          }
        }
      } else {
        cubicvr_addTrianglePart(obj,mat,uvSet,melem);        
      }
    }

    obj.triangulateQuads();
    obj.calcNormals();

    for (i = 0, iMax = mappers.length; i < iMax; i++) {
      mappers[i][0].apply(obj, mappers[i][1]);
    }

    obj.compile();

    MeshPool[meshUrl] = obj;

    return obj;
  }


  function cubicvr_isMotion(node) {
    if (node === null) {
      return false;
    }

    return (node.getElementsByTagName("x").length || node.getElementsByTagName("y").length || node.getElementsByTagName("z").length || node.getElementsByTagName("fov").length);
  }


  function cubicvr_nodeToMotion(node, controllerId, motion) {
    var util = CubicVR.util;
    var c = [];
    c[0] = node.getElementsByTagName("x");
    c[1] = node.getElementsByTagName("y");
    c[2] = node.getElementsByTagName("z");
    c[3] = node.getElementsByTagName("fov");

    var etime, evalue, ein, eout, etcb;

    for (var k in c) {
      if (c.hasOwnProperty(k)) {
        if (c[k] !== undef) {
          if (c[k].length) {
            etime = c[k][0].getElementsByTagName("time");
            evalue = c[k][0].getElementsByTagName("value");
            ein = c[k][0].getElementsByTagName("in");
            eout = c[k][0].getElementsByTagName("out");
            etcb = c[k][0].getElementsByTagName("tcb");

            var time = null,
              value = null,
              tcb = null;

            var intype = null,
              outtype = null;

            if (ein.length) {
              intype = util.collectTextNode(ein[0]);
            }

            if (eout.length) {
              outtype = util.collectTextNode(eout[0]);
            }

            if (etime.length) {
              time = util.floatDelimArray(util.collectTextNode(etime[0]), " ");
            }

            if (evalue.length) {
              value = util.floatDelimArray(util.collectTextNode(evalue[0]), " ");
            }

            if (etcb.length) {
              tcb = util.floatDelimArray(util.collectTextNode(etcb[0]), " ");
            }


            if (time !== null && value !== null) {
              for (var i = 0, iMax = time.length; i < iMax; i++) {
                var mkey = motion.setKey(controllerId, k, time[i], value[i]);

                if (tcb) {
                  mkey.tension = tcb[i * 3];
                  mkey.continuity = tcb[i * 3 + 1];
                  mkey.bias = tcb[i * 3 + 2];
                }
              }
            }

            var in_beh = enums.envelope.behavior.CONSTANT;
            var out_beh = enums.envelope.behavior.CONSTANT;

            if (intype) {
              switch (intype) {
              case "reset":
                in_beh = enums.envelope.behavior.RESET;
                break;
              case "constant":
                in_beh = enums.envelope.behavior.CONSTANT;
                break;
              case "repeat":
                in_beh = enums.envelope.behavior.REPEAT;
                break;
              case "oscillate":
                in_beh = enums.envelope.behavior.OSCILLATE;
                break;
              case "offset":
                in_beh = enums.envelope.behavior.OFFSET;
                break;
              case "linear":
                in_beh = enums.envelope.behavior.LINEAR;
                break;
              }
            }

            if (outtype) {
              switch (outtype) {
              case "reset":
                out_beh = enums.envelope.behavior.RESET;
                break;
              case "constant":
                out_beh = enums.envelope.behavior.CONSTANT;
                break;
              case "repeat":
                out_beh = enums.envelope.behavior.REPEAT;
                break;
              case "oscillate":
                out_beh = enums.envelope.behavior.OSCILLATE;
                break;
              case "offset":
                out_beh = enums.envelope.behavior.OFFSET;
                break;
              case "linear":
                out_beh = enums.envelope.behavior.LINEAR;
                break;
              }
            }

            motion.setBehavior(controllerId, k, in_beh, out_beh);
          }
        }
      }
    }
  }


  function cubicvr_loadScene(sceneUrl, model_prefix, image_prefix) {
    var util = CubicVR.util;
    if (model_prefix === undef) {
      model_prefix = "";
    }
    if (image_prefix === undef) {
      image_prefix = "";
    }

    var obj = new CubicVR.Mesh();
    var scene = util.getXML(sceneUrl);

    var sceneOut = new CubicVR.Scene();

    var parentingSet = [];

    var sceneobjs = scene.getElementsByTagName("sceneobjects");

    var tempNode;

    var position, rotation, scale;

    //  var pts_str = util.collectTextNode(pts_elem[0]);
    for (var i = 0, iMax = sceneobjs[0].childNodes.length; i < iMax; i++) {
      var sobj = sceneobjs[0].childNodes[i];

      if (sobj.tagName === "sceneobject") {

        var name = "unnamed";
        var parent = "";
        var model = "";

        tempNode = sobj.getElementsByTagName("name");
        if (tempNode.length) {
          name = util.collectTextNode(tempNode[0]);
        }

        tempNode = sobj.getElementsByTagName("parent");
        if (tempNode.length) {
          parent = util.collectTextNode(tempNode[0]);
        }

        tempNode = sobj.getElementsByTagName("model");
        if (tempNode.length) {
          model = util.collectTextNode(tempNode[0]);
        }

        position = null;
        rotation = null;
        scale = null;

        tempNode = sobj.getElementsByTagName("position");
        if (tempNode.length) {
          position = tempNode[0];
        }

        tempNode = sobj.getElementsByTagName("rotation");
        if (tempNode.length) {
          rotation = tempNode[0];
        }

        tempNode = sobj.getElementsByTagName("scale");
        if (tempNode.length) {
          scale = tempNode[0];
        }

        obj = null;

        if (model !== "") {
          obj = cubicvr_loadMesh(model_prefix + model, image_prefix);
        }

        var sceneObject = new CubicVR.SceneObject(obj, name);

        if (cubicvr_isMotion(position)) {
          if (!sceneObject.motion) {
            sceneObject.motion = new CubicVR.Motion();
          }
          cubicvr_nodeToMotion(position, enums.motion.POS, sceneObject.motion);
        } else if (position) {
          sceneObject.position = util.floatDelimArray(util.collectTextNode(position));
        }

        if (cubicvr_isMotion(rotation)) {
          if (!sceneObject.motion) {
            sceneObject.motion = new CubicVR.Motion();
          }
          cubicvr_nodeToMotion(rotation, enums.motion.ROT, sceneObject.motion);
        } else {
          sceneObject.rotation = util.floatDelimArray(util.collectTextNode(rotation));
        }

        if (cubicvr_isMotion(scale)) {
          if (!sceneObject.motion) {
            sceneObject.motion = new CubicVR.Motion();
          }
          cubicvr_nodeToMotion(scale, enums.motion.SCL, sceneObject.motion);
        } else {
          sceneObject.scale = util.floatDelimArray(util.collectTextNode(scale));

        }

        sceneOut.bindSceneObject(sceneObject);

        if (parent !== "") {
          parentingSet.push([sceneObject, parent]);
        }
      }
    }

    for (var j in parentingSet) {
      if (parentingSet.hasOwnProperty(j)) {
        sceneOut.getSceneObject(parentingSet[j][1]).bindChild(parentingSet[j][0]);
      }
    }

    var camera = scene.getElementsByTagName("camera");

    if (camera.length) {
      position = null;
      rotation = null;

      var target = "";

      tempNode = camera[0].getElementsByTagName("name");

      var cam = sceneOut.camera;

      var fov = null;

      if (tempNode.length) {
        target = tempNode[0].firstChild.nodeValue;
      }

      tempNode = camera[0].getElementsByTagName("target");
      if (tempNode.length) {
        target = tempNode[0].firstChild.nodeValue;
      }

      if (target !== "") {
        cam.targetSceneObject = sceneOut.getSceneObject(target);
      }

      tempNode = camera[0].getElementsByTagName("position");
      if (tempNode.length) {
        position = tempNode[0];
      }

      tempNode = camera[0].getElementsByTagName("rotation");
      if (tempNode.length) {
        rotation = tempNode[0];
      }

      tempNode = camera[0].getElementsByTagName("fov");
      if (tempNode.length) {
        fov = tempNode[0];
      }

      if (cubicvr_isMotion(position)) {
        if (!cam.motion) {
          cam.motion = new CubicVR.Motion();
        }
        cubicvr_nodeToMotion(position, enums.motion.POS, cam.motion);
      } else if (position) {
        cam.position = util.floatDelimArray(position.firstChild.nodeValue);
      }

      if (cubicvr_isMotion(rotation)) {
        if (!cam.motion) {
          cam.motion = new CubicVR.Motion();
        }
        cubicvr_nodeToMotion(rotation, enums.motion.ROT, cam.motion);
      } else if (rotation) {
        cam.rotation = util.floatDelimArray(rotation.firstChild.nodeValue);
      }

      if (cubicvr_isMotion(fov)) {
        if (!cam.motion) {
          cam.motion = new CubicVR.Motion();
        }
        cubicvr_nodeToMotion(fov, enums.motion.FOV, cam.motion);
      } else if (fov) {
        cam.fov = parseFloat(fov.firstChild.nodeValue);
      }

    }


    return sceneOut;
  }
  
  
  var exports = {
    loadMesh: cubicvr_loadMesh,
    loadScene: cubicvr_loadScene
  };

  return exports;
  
});
