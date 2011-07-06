
CubicVR.RegisterModule("CVRXML",function(base) {
  
  var undef = base.undef;
  var nop = function(){ };
  var enums = CubicVR.enums;
  var GLCore = base.GLCore;

  var MeshPool = [];


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

  function cubicvr_loadMesh(meshUrl, prefix) {
   if (MeshPool[meshUrl] !== undef) {
     return MeshPool[meshUrl];
   }

    var util = CubicVR.util;

    var i, j, p, iMax, jMax, pMax;

    var obj = new CubicVR.Mesh();
    var mesh = util.getXML(meshUrl);
    var pts_elem = mesh.getElementsByTagName("points");

    var pts_str = util.collectTextNode(pts_elem[0]);
    var pts = pts_str.split(" ");

    var texName, tex;

    for (i = 0, iMax = pts.length; i < iMax; i++) {
      pts[i] = pts[i].split(",");
      for (j = 0, jMax = pts[i].length; j < jMax; j++) {
        pts[i][j] = parseFloat(pts[i][j]);
      }
    }

    obj.addPoint(pts);

    var material_elem = mesh.getElementsByTagName("material");
    var mappers = [];


    for (i = 0, iMax = material_elem.length; i < iMax; i++) {
      var melem = material_elem[i];

      var matName = (melem.getElementsByTagName("name").length) ? (melem.getElementsByTagName("name")[0].firstChild.nodeValue) : null;
      var mat = new CubicVR.Material(matName);

      if (melem.getElementsByTagName("alpha").length) {
        mat.opacity = parseFloat(melem.getElementsByTagName("alpha")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("shininess").length) {
        mat.shininess = (parseFloat(melem.getElementsByTagName("shininess")[0].firstChild.nodeValue) / 100.0);
      }
      if (melem.getElementsByTagName("max_smooth").length) {
        mat.max_smooth = parseFloat(melem.getElementsByTagName("max_smooth")[0].firstChild.nodeValue);
      }

      if (melem.getElementsByTagName("color").length) {
        mat.color = util.floatDelimArray(melem.getElementsByTagName("color")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("ambient").length) {
        mat.ambient = util.floatDelimArray(melem.getElementsByTagName("ambient")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("diffuse").length) {
        mat.diffuse = util.floatDelimArray(melem.getElementsByTagName("diffuse")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("specular").length) {
        mat.specular = util.floatDelimArray(melem.getElementsByTagName("specular")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("texture").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.COLOR);
      }

      if (melem.getElementsByTagName("texture_luminosity").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_luminosity")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.AMBIENT);
      }

      if (melem.getElementsByTagName("texture_normal").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_normal")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.NORMAL);
      }

      if (melem.getElementsByTagName("texture_specular").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_specular")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.SPECULAR);
      }

      if (melem.getElementsByTagName("texture_bump").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_bump")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.BUMP);
      }

      if (melem.getElementsByTagName("texture_envsphere").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_envsphere")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.ENVSPHERE);
      }

      if (melem.getElementsByTagName("texture_alpha").length) {
        texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_alpha")[0].firstChild.nodeValue;
        tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
        mat.setTexture(tex, enums.texture.map.ALPHA);
      }

      var uvSet = null;

      if (melem.getElementsByTagName("uvmapper").length) {
        var uvm = new CubicVR.UVMapper();
        var uvelem = melem.getElementsByTagName("uvmapper")[0];
        var uvmType = "";

        if (uvelem.getElementsByTagName("type").length) {
          uvmType = melem.getElementsByTagName("type")[0].firstChild.nodeValue;

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

        if (uvmType === "uv") {
          if (uvelem.getElementsByTagName("uv").length) {
            var uvText = util.collectTextNode(melem.getElementsByTagName("uv")[0]);

            uvSet = uvText.split(" ");

            for (j = 0, jMax = uvSet.length; j < jMax; j++) {
              uvSet[j] = util.floatDelimArray(uvSet[j]);
            }
          }
        }

        if (uvelem.getElementsByTagName("axis").length) {
          var uvmAxis = melem.getElementsByTagName("axis")[0].firstChild.nodeValue;

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

        if (melem.getElementsByTagName("center").length) {
          uvm.center = util.floatDelimArray(melem.getElementsByTagName("center")[0].firstChild.nodeValue);
        }
        if (melem.getElementsByTagName("rotation").length) {
          uvm.rotation = util.floatDelimArray(melem.getElementsByTagName("rotation")[0].firstChild.nodeValue);
        }
        if (melem.getElementsByTagName("scale").length) {
          uvm.scale = util.floatDelimArray(melem.getElementsByTagName("scale")[0].firstChild.nodeValue);
        }

        if (uvmType !== "" && uvmType !== "uv") {
          mappers.push([uvm, mat]);
        }
      }


      var seglist = null;
      var triangles = null;

      if (melem.getElementsByTagName("segments").length) {
        seglist = util.intDelimArray(util.collectTextNode(melem.getElementsByTagName("segments")[0]), " ");
      }
      if (melem.getElementsByTagName("triangles").length) {
        triangles = util.intDelimArray(util.collectTextNode(melem.getElementsByTagName("triangles")[0]), " ");
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

    obj.calcNormals();

    for (i = 0, iMax = mappers.length; i < iMax; i++) {
      mappers[i][0].apply(obj, mappers[i][1]);
    }

    obj.compile();

    MeshPool[meshUrl] = obj;

    return obj;
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
