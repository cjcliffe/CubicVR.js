var undef;
var util;

function setup() {
  util = CubicVR.util;
  function collectTextNode(tn) {
    if (!tn) {
      return "";
    }
    var val = tn['$'];
    if (!val) {
      return "";
    }
    return val;
    /*
    else if (tn.value !== undefined){
      return tn.value;
    } //if
    return tn;
    */
  } //collecTextNode
  util.collectTextNode = collectTextNode;
} //setup

function debug(msg) {
  try {
    postMessage({message:msg});
  }
  catch(e) {
    postMessage({message:'message fail'});
    postMessage({message:JSON.stringify(msg)});
  } //try
} //debug

function parseChildren (json) {

  json.getElementsByTagName = function(name) {
    var elements = searchTree(json, name);
    if (typeof(elements) == 'string') {
      elements = [elements];
    } //if
    return elements;
  } //getElementsByTagName

  json.getAttribute = function(attribName) {
    var attrib = json['@'+attribName];
    return attrib;
  } //getAttribute

  if (json.length === undefined) {
    var childNodes = [];
    for (var i in json) {
      if ( json[i] === null || 
           i[0] == '@' ||
           i == '$' ||
           i == 'childNodes' || 
           i == 'parentNode' || 
           i == 'tagName' || 
           i == 'getAttribute' || 
           i == 'getElementsByTagName' || 
           i == 'nodeType') {
        continue;
      } //if
      if (json[i].length === undefined) {
        var child = json[i];
        child.tagName = i;
        child.parentNode = json;
        childNodes.push(child);
        parseChildren(child);
        child.nodeType = 1;
      }
      else {
        for (var j=0,maxJ=json[i].length; j<maxJ; ++j) {
          var child = json[i][j];
          child.tagName = i;
          child.parentNode = json;
          childNodes.push(child);
          parseChildren(child);
          child.nodeType = 1;
        } //for j
      } //if
    } //for i
    json.childNodes = childNodes;
  } //if

} //parseChildren

function searchTree(start, tName) {
  var ret = start[tName];

  if (ret === undefined || ret === null) {
    ret = [];
  }
  else if (ret.length === undefined) {
    ret = [ret];
  } //if

  var s = ret.length;
  if (start.childNodes) {
    for (var i=0, maxI=start.childNodes.length; i<maxI; ++i) {
      var cret = searchTree(start.childNodes[i], tName);
      for (var j=0, maxJ=cret.length; j<maxJ; ++j) {
        ret.push(cret[j]);
      } //for j
    } //for i
  } //if

  return ret;
} //searchTree

function getXML(srcUrl) {
  //try {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open('GET', srcUrl, false);
    xmlHttp.overrideMimeType("application/xml");
    xmlHttp.send(null);

    if (xmlHttp.status === 200 || xmlHttp.status === 0) {
      var xml = xmlHttp.responseText; // bug 270553
      //var xml = '{"effect":[{"name":"StopSignMaterial-fx","profile_COMMON":{"newparam":[{"sid":"stopsign_jpg-surface"}]}},{"name":"Loser-fx","profile_COMMON":{"newparam":[{"sid":"loser_jpg-surface"}]}}]}';
      //var xml = '{"not fun": {"fun": {"joy": [{"sand":"0"},{"sand":"2"},{"sand":"3"}], "sand":"1"} }}';
      //var xml = '{"@name":"Plane_001","scale":{"$":"1.70000 1.70000 1.70000","@sid":"scale","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"}},"translate":{"$":"4.91268 13.06135 -37.79423","@sid":"translate","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"}},"@id":"Plane_001","@layer":"L1","rotate":[{"$":"0 0 1 90.00003","@sid":"rotateZ","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"}},{"$":"0 1 0 -0.00001","@sid":"rotateY","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"}},{"$":"1 0 0 9.17442","@sid":"rotateX","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"}}],"@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"},"instance_geometry":{"bind_material":{"technique_common":{"@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"},"instance_material":{"@symbol":"Material_010","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"},"@target":"#Material_010","bind_vertex_input":{"@input_semantic":"TEXCOORD","@input_set":"1","@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"},"@semantic":"CHANNEL1"}}},"@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"}},"@xmlns":{"$":"http://www.collada.org/2005/11/COLLADASchema"},"@url":"#Plane_005-V000"}}';
      var parsed = JSON.parse(xml);
      parseChildren(parsed);
      parsed.tagName = 'root';
      return parsed;
    } //if
  //}
  //catch(e) {
  //  throw new Error(e);
  //} //try
  return null;
} //getXML

var materialList = [];
function cubicvr_loadCollada(meshUrl, prefix) {
  var obj = new CubicVR.Mesh();
  var scene = new CubicVR.Scene();
  var cl = getXML(meshUrl);

  /*
  debug('preparing test 1');
  var s = cl.getElementsByTagName('scale');
  debug('TEST 1: ' + s.length);
  debug(util.collectTextNode(s[0]));
  return;
  */

  var meshes = [];
  var tech;
  var sourceId;
  var materialRef, nameRef, nFace, meshName;

  var norm, vert, uv, mapLen, computedLen;

  var i, iCount, iMax, iMod, mCount, mMax, k, kMax, cCount, cMax, sCount, sMax, pCount, pMax, j, jMax;

  var cl_lib_asset = cl.getElementsByTagName("asset");

  var up_axis = 1; // Y
  if (cl_lib_asset.length) {
    var cl_up_axis = cl_lib_asset[0].getElementsByTagName("up_axis");
    if (cl_up_axis.length) {
      var axisval = util.collectTextNode(cl_up_axis[0]);

      switch (axisval) {
      case "X_UP":
        up_axis = 0;
        break;
      case "Y_UP":
        up_axis = 1;
        break;
      case "Z_UP":
        up_axis = 2;
        break;
      }
    }
  }
  // up_axis=1;
  var fixuaxis = function(v) {
    if (up_axis === 0) { // untested
      return [v[1], v[0], v[2]];
    } else if (up_axis === 1) {
      return v;
    } else if (up_axis === 2) {
      return [v[0], v[2], -v[1]];
    }
  };

  var fixscaleaxis = function(v) {
    if (up_axis === 0) { // untested
      return [v[1], v[0], v[2]];
    } else if (up_axis === 1) {
      return v;
    } else if (up_axis === 2) {
      return [v[0], v[2], v[1]];
    }
  };


  var fixraxis = function(v) {
    if (up_axis === 0) { // untested
      return [v[1], v[0], v[2]];
    } else if (up_axis === 1) {
      return v;
    } else if (up_axis === 2) {
      return [v[0], v[2], -v[1]];
    }
  };

  var fixukaxis = function(mot, chan, val) {
    // if (mot === enums.motion.POS && chan === enums.motion.Y && up_axis === enums.motion.Z) return -val;
    if (mot === CubicVR.enums.motion.POS && chan === CubicVR.enums.motion.Z && up_axis === CubicVR.enums.motion.Z) {
      return -val;
    }
    return val;
  };

  var fixuraxis = function(mot, chan, val) {
    if (mot === CubicVR.enums.motion.ROT && chan === CubicVR.enums.motion.Z && up_axis === CubicVR.enums.motion.Z) {
      return -val;
    }
    // if (mot === enums.motion.ROT && chan === enums.motion.X && up_axis === enums.motion.Z) return val;
    // if (mot === enums.motion.ROT && chan === enums.motion.Z && up_axis === enums.motion.Z) return -val;
    if (mot === CubicVR.enums.motion.ROT && chan === CubicVR.enums.motion.X && up_axis === CubicVR.enums.motion.Z) {
      return -val;
    }
    return val;
  };


  var cl_collada13_lib = cl.getElementsByTagName("library");
  var cl_collada13_libmap = [];
  
  if (cl_collada13_lib.length)
  {
    for (i = 0, iMax = cl_collada13_lib.length; i<iMax; i++)
    {
      cl_collada13_libmap[cl_collada13_lib[i].getAttribute("type")] = [cl_collada13_lib[i]];
    }
  }



  var cl_lib_images = cl.getElementsByTagName("library_images");

  if (!cl_lib_images.length && cl_collada13_lib.length)
  {
    cl_lib_images = cl_collada13_libmap["IMAGE"];
  }
  
  var imageRef = [];

  if (cl_lib_images.length) {
    var cl_images = cl.getElementsByTagName("image");

    if (cl_images.length) {
      for (var imgCount = 0, imgCountMax = cl_images.length; imgCount < imgCountMax; imgCount++) {
        var cl_img = cl_images[imgCount];
        var imageId = cl_img.getAttribute("id");
        var imageName = cl_img.getAttribute("name");
        var cl_imgsrc = cl_img.getElementsByTagName("init_from");

        if (cl_imgsrc.length) {
          /*for (var l in cl_imgsrc[0]) {
            debug(imageId + ": " + l);
          }*/
          var imageSource = util.collectTextNode(cl_imgsrc[0]);

          if (prefix !== undef && (imageSource.lastIndexOf("/")!==-1)) {
            imageSource = imageSource.substr(imageSource.lastIndexOf("/")+1);
          }
          if (prefix !== undef && (imageSource.lastIndexOf("\\")!==-1)) {
            imageSource = imageSource.substr(imageSource.lastIndexOf("\\")+1);
          }
          
          imageRef[imageId] = {
            source: imageSource,
            id: imageId,
            name: imageName
          };
        }
      }
    }
  }

  var cl_lib_effects = cl.getElementsByTagName("library_effects");

  var effectId;
  var effectsRef = [];
  var effectCount, effectMax;
  var tCount, tMax, inpCount, inpMax;
  var cl_params, cl_13inst, cl_inputs, cl_input, cl_inputmap, cl_samplers, cl_camera, cl_cameras, cl_scene;
  var ofs;

  if (cl_lib_effects.length) {
    var cl_effects = cl_lib_effects[0].getElementsByTagName("effect");

    for (effectCount = 0, effectMax = cl_effects.length; effectCount < effectMax; effectCount++) {
      var cl_effect = cl_effects[effectCount];

      effectId = cl_effect.getAttribute("id");

      var effect = {};

      effect.id = effectId;

      effect.surfaces = [];
      effect.samplers = [];

      //cl_params = cl_effect.getElementsByTagName("newparam");
      cl_params = cl_effect.getElementsByTagName("newparam");

      var params = [];

      var cl_init;

      if (cl_params.length) {
        for (pCount = 0, pMax = cl_params.length; pCount < pMax; pCount++) {
          var cl_param = cl_params[pCount];

          var paramId = cl_param.getAttribute("sid");

          var cl_surfaces = cl_param.getElementsByTagName("surface");
          cl_samplers = cl_param.getElementsByTagName("sampler2D");

          if (cl_surfaces.length) {
            effect.surfaces[paramId] = {};

            cl_init = cl_surfaces[0].getElementsByTagName("init_from");

            if (cl_init.length) {
              var initFrom = util.collectTextNode(cl_init[0]);

              if (typeof(imageRef[initFrom]) === 'object') {
                var img_path = prefix + "/" + imageRef[initFrom].source;
                effect.surfaces[paramId].texture = new CubicVR.DeferredLoadTexture(prefix + "/" + imageRef[initFrom].source);
                effect.surfaces[paramId].source = img_path;
              }
            }
          } else if (cl_samplers.length) {
            effect.samplers[paramId] = {};

            cl_init = cl_samplers[0].getElementsByTagName("source");

            if (cl_init.length) {
              effect.samplers[paramId].source = util.collectTextNode(cl_init[0]);
            }

            cl_init = cl_samplers[0].getElementsByTagName("minfilter");

            if (cl_init.length) {
              effect.samplers[paramId].minfilter = util.collectTextNode(cl_init[0]);
            }

            cl_init = cl_samplers[0].getElementsByTagName("magfilter");

            if (cl_init.length) {
              effect.samplers[paramId].magfiter = util.collectTextNode(cl_init[0]);
            }
          }

        }
      }

      var cl_technique = cl_effect.getElementsByTagName("technique");

      var getColorNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("color");
          if (!el.length) {
            return false;
          }

          var cn = util.collectTextNode(el[0]);
          var ar = CubicVR.util.floatDelimArray(cn, " ");

          return ar;
        };
      }());

      var getFloatNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("float");
          if (!el.length) {
            return false;
          }

          var cn = parseFloat(util.collectTextNode(el[0]));

          return cn;
        };
      }());

      var getTextureNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("texture");
          if (!el.length) {
            return false;
          }

          var cn = el[0].getAttribute("texture");

          return cn;
        };
      }());

      effect.material = new CubicVR.Material(effectId);
      materialList.push(effect.material);

      for (tCount = 0, tMax = cl_technique.length; tCount < tMax; tCount++) {
        //        if (cl_technique[tCount].getAttribute("sid") === 'common') {
        tech = cl_technique[tCount].getElementsByTagName("blinn");

        if (!tech.length) {
          tech = cl_technique[tCount].getElementsByTagName("phong");
        }
        if (!tech.length) {
          tech = cl_technique[tCount].getElementsByTagName("lambert");
        }

        if (tech.length) {
          for (var eCount = 0, eMax = tech[0].childNodes.length; eCount < eMax; eCount++) {
            var node = tech[0].childNodes[eCount];

            if (node.nodeType === 1) {
              var c = getColorNode(node);
              var f = getFloatNode(node);
              var t = getTextureNode(node);

              if (c !== false) {
                if (c.length > 3) {
                  c.pop();
                }
              }

              switch (node.tagName) {
              case "emission":
                if (c !== false) {
                  effect.material.ambient = c;
                }
                break;
              case "ambient":
                break;
              case "diffuse":
                if (c !== false) {
                  effect.material.color = c;
                }
                break;
              case "specular":
                if (c !== false) {
                  effect.material.specular = c;
                }
                break;
              case "shininess":
                if (f !== false) {
                  effect.material.shininess = f;
                }
                break;
              case "reflective":
                break;
              case "reflectivity":
                break;
              case "transparent":
                break;
                //                  case "transparency": if (f!==false) effect.material.opacity = 1.0-f; break;
              case "index_of_refraction":
                break;
              }

              if (t !== false) {
                var srcTex;
                srcTex = effect.surfaces[effect.samplers[t].source].texture;
                switch (node.tagName) {
                case "emission":
                  effect.material.setTexture(srcTex, CubicVR.enums.texture.map.AMBIENT);
                  break;
                case "ambient":
                  effect.material.setTexture(srcTex, CubicVR.enums.texture.map.AMBIENT);
                  break;
                case "diffuse":
                  effect.material.setTexture(srcTex, CubicVR.enums.texture.map.COLOR);
                  break;
                case "specular":
                  effect.material.setTexture(srcTex, CubicVR.enums.texture.map.SPECULAR);
                  break;
                case "shininess":
                  break;
                case "reflective":
                  effect.material.setTexture(srcTex, CubicVR.enums.texture.map.REFLECT);
                  break;
                case "reflectivity":
                  break;
                case "transparent":
                  effect.material.setTexture(srcTex, CubicVR.enums.texture.map.ALPHA);
                  break;
                case "transparency":
                  break;
                case "index_of_refraction":
                  break;
                }
              }
            }
          }
        }

        effectsRef[effectId] = effect;
      }
    }
  }

  var cl_lib_mat_inst = cl.getElementsByTagName("instance_material");

  var materialMap = [];

  if (cl_lib_mat_inst.length) {
    for (i = 0, iMax = cl_lib_mat_inst.length; i < iMax; i++) {
      var cl_mat_inst = cl_lib_mat_inst[i];

      var symbolId = cl_mat_inst.getAttribute("symbol");
      var targetId = cl_mat_inst.getAttribute("target").substr(1);

      materialMap[symbolId] = targetId;
    }
  }


  var cl_lib_materials = cl.getElementsByTagName("library_materials");

  if (!cl_lib_materials.length && cl_collada13_lib.length) {
    cl_lib_materials = cl_collada13_libmap["MATERIAL"];
  } //if


  var materialsRef = [];

  if (cl_lib_materials.length) {
    var cl_materials = cl.getElementsByTagName("material");

    for (mCount = 0, mMax = cl_materials.length; mCount < mMax; mCount++) {
      var cl_material = cl_materials[mCount];

      var materialId = cl_material.getAttribute("id");
      var materialName = cl_material.getAttribute("name");

      var cl_einst = cl_material.getElementsByTagName("instance_effect");

      if (cl_einst.length) {
        effectId = cl_einst[0].getAttribute("url").substr(1);
        materialsRef[materialId] = {
          id: materialId,
          name: materialName,
          mat: effectsRef[effectId].material
        };
      }
    }
  }

  var cl_lib_geo = cl.getElementsByTagName("library_geometries");

  if (!cl_lib_geo.length && cl_collada13_lib.length)
  {
    cl_lib_geo = cl_collada13_libmap["GEOMETRY"];
  }

  if (cl_lib_geo.length) {
    for (var geoCount = 0, geoMax = cl_lib_geo.length; geoCount < geoMax; geoCount++) {
      var cl_geo = cl_lib_geo[geoCount];

      var cl_geo_node = cl_geo.getElementsByTagName("geometry");

      if (cl_geo_node.length) {
        for (var meshCount = 0, meshMax = cl_geo_node.length; meshCount < meshMax; meshCount++) {
          var cl_geomesh = cl_geo_node[meshCount].getElementsByTagName("mesh");

          var meshId = cl_geo_node[meshCount].getAttribute("id");
          meshName = cl_geo_node[meshCount].getAttribute("name");

          var newObj = new CubicVR.Mesh(meshName);

          CubicVR.MeshPool[meshUrl + "@" + meshName] = newObj;

          if (cl_geomesh.length) {
            var cl_geosources = cl_geomesh[0].getElementsByTagName("source");

            var geoSources = [];

            for (var sourceCount = 0, sourceMax = cl_geosources.length; sourceCount < sourceMax; sourceCount++) {
              var cl_geosource = cl_geosources[sourceCount];

              sourceId = cl_geosource.getAttribute("id");
              var sourceName = cl_geosource.getAttribute("name");
              var cl_floatarray = cl_geosource.getElementsByTagName("float_array");

              if (cl_floatarray.length) {
                geoSources[sourceId] = {
                  id: sourceId,
                  name: sourceName,
                  data: util.floatDelimArray(util.collectTextNode(cl_floatarray[0]), " ")
                };
              }

              var cl_accessor = cl_geosource.getElementsByTagName("accessor");

              if (cl_accessor.length) {
                geoSources[sourceId].count = cl_accessor[0].getAttribute("count");
                geoSources[sourceId].stride = cl_accessor[0].getAttribute("stride");
                geoSources[sourceId].data = util.repackArray(geoSources[sourceId].data, geoSources[sourceId].stride, geoSources[sourceId].count);
              }
            }

            var geoVerticies = [];

            var cl_vertices = cl_geomesh[0].getElementsByTagName("vertices");

            var pointRef = null;
            var pointRefId = null;
            var triangleRef = null;
            var normalRef = null;
            var uvRef = null;

            if (cl_vertices.length) {
              pointRefId = cl_vertices[0].getAttribute("id");
              cl_inputs = cl_vertices[0].getElementsByTagName("input");

              if (cl_inputs.length) {
                for (inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                  cl_input = cl_inputs[inpCount];

                  if (cl_input.getAttribute("semantic") == "POSITION") {
                    pointRef = cl_input.getAttribute("source").substr(1);
                  }
                }
              }
            }

            var CL_VERTEX = 0,
              CL_NORMAL = 1,
              CL_TEXCOORD = 2,
              CL_OTHER = 3;


            var cl_triangles = cl_geomesh[0].getElementsByTagName("triangles");
                    
            var v_c=false, n_c=false, u_c=false;

            if (cl_triangles.length) {
              for (tCount = 0, tMax = cl_triangles.length; tCount < tMax; tCount++) {
                var cl_trianglesCount = parseInt(cl_triangles[tCount].getAttribute("count"), 10);
                cl_inputs = cl_triangles[tCount].getElementsByTagName("input");
                cl_inputmap = [];

                if (cl_inputs.length) {
                  for (inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                    cl_input = cl_inputs[inpCount];

                    ofs = parseInt(cl_input.getAttribute("offset"), 10);
                    nameRef = cl_input.getAttribute("source").substr(1);

                    if (cl_input.getAttribute("semantic") == "VERTEX") {
                      if (nameRef === pointRefId) {
                        nameRef = triangleRef = pointRef;
                      } else {
                        triangleRef = nameRef;
                      }
                      v_c=true;
                      cl_inputmap[ofs] = CL_VERTEX;
                    } else if (cl_input.getAttribute("semantic") == "NORMAL") {
                      normalRef = nameRef;
                      cl_inputmap[ofs] = CL_NORMAL;
                      n_c=true;
                    } else if (cl_input.getAttribute("semantic") == "TEXCOORD") {
                      uvRef = nameRef;
                      cl_inputmap[ofs] = CL_TEXCOORD;
                      u_c=true;
                    } else {
                      cl_inputmap[ofs] = CL_OTHER;
                    }
                  }
                }
                
                mapLen = cl_inputmap.length;
                
                materialRef = cl_triangles[tCount].getAttribute("material");
                if (materialRef === null || materialRef == "" || materialRef === undefined) {
                  newObj.setFaceMaterial(0);
                } else {
                  if (materialMap[materialRef] === undef) {
                    throw new Error("missing material ["+materialRef+"]@"+meshName+"?");
                    newObj.setFaceMaterial(0);
                  } else {
                    newObj.setFaceMaterial(materialsRef[materialMap[materialRef]].mat);
                  }
                }


                var cl_triangle_source = cl_triangles[tCount].getElementsByTagName("p");

                var triangleData = [];

                if (cl_triangle_source.length) {
                  triangleData = util.intDelimArray(util.collectTextNode(cl_triangle_source[0]), " ");
                }

                if (triangleData.length) {
                  computedLen = ((triangleData.length) / cl_inputmap.length) / 3;

                  if (computedLen !== cl_trianglesCount) {
                  } else {
                    if (newObj.points.length === 0) {
                      newObj.points = geoSources[pointRef].data;
                    }
                    
                    ofs = 0;
                    
                    for (i = 0, iMax = triangleData.length, iMod = cl_inputmap.length; i < iMax; i += iMod * 3) {
                      norm = [];
                      vert = [];
                      uv = [];

                      for (j = 0; j < iMod * 3; j++) {
                        var jMod = j % iMod;

                        if (cl_inputmap[jMod] === CL_VERTEX) {
                          vert.push(triangleData[i + j]);
                        } else if (cl_inputmap[jMod] === CL_NORMAL) {
                          norm.push(triangleData[i + j]);
                        } else if (cl_inputmap[jMod] === CL_TEXCOORD) {
                          uv.push(triangleData[i + j]);
                        }
                      }

                      if (vert.length) {
                        // if (up_axis !== 1)
                        // {
                        //   vert.reverse();
                        // }
                        nFace = newObj.addFace(vert);

                        if (norm.length === 3) {
                          newObj.faces[nFace].point_normals = [fixuaxis(geoSources[normalRef].data[norm[0]]), fixuaxis(geoSources[normalRef].data[norm[1]]), fixuaxis(geoSources[normalRef].data[norm[2]])];
                        }

                        if (uv.length === 3) {
                          newObj.faces[nFace].uvs[0] = geoSources[uvRef].data[uv[0]];
                          newObj.faces[nFace].uvs[1] = geoSources[uvRef].data[uv[1]];
                          newObj.faces[nFace].uvs[2] = geoSources[uvRef].data[uv[2]];
                        }
                      }

                      //                     if (up_axis===2) {newObj.faces[nFace].flip();}
                    }
                    

                    // newObj.compile();
                    // return newObj;
                  }
                }
              }
            }


            var cl_polylist = cl_geomesh[0].getElementsByTagName("polylist");
            if (!cl_polylist.length) {
              cl_polylist = cl_geomesh[0].getElementsByTagName("polygons"); // try polygons
            }

            if (cl_polylist.length) {
              for (tCount = 0, tMax = cl_polylist.length; tCount < tMax; tCount++) {
                var cl_polylistCount = parseInt(cl_polylist[tCount].getAttribute("count"), 10);
                cl_inputs = cl_polylist[tCount].getElementsByTagName("input");
                cl_inputmap = [];

                if (cl_inputs.length) {
                  for (inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                    cl_input = cl_inputs[inpCount];

                    var cl_ofs = cl_input.getAttribute("offset");
                    
                    if (cl_ofs === null)
                    {
                      cl_ofs = cl_input.getAttribute("idx");
                    }
                    
                    ofs = parseInt(cl_ofs, 10);
                    nameRef = cl_input.getAttribute("source").substr(1);

                    if (cl_input.getAttribute("semantic") === "VERTEX") {
                      if (nameRef === pointRefId) {
                        nameRef = triangleRef = pointRef;

                      } else {
                        triangleRef = nameRef;
                      }
                      cl_inputmap[ofs] = CL_VERTEX;
                    } else if (cl_input.getAttribute("semantic") === "NORMAL") {
                      normalRef = nameRef;
                      cl_inputmap[ofs] = CL_NORMAL;
                    } else if (cl_input.getAttribute("semantic") === "TEXCOORD") {
                      uvRef = nameRef;
                      cl_inputmap[ofs] = CL_TEXCOORD;
                    } else {
                      cl_inputmap[ofs] = CL_OTHER;
                    }
                  }
                }


                var cl_vcount = cl_polylist[tCount].getElementsByTagName("vcount");
                var vcount = [];

                if (cl_vcount.length) {
                  vcount = util.intDelimArray(util.collectTextNode(cl_vcount[0]), " ");
                }

                materialRef = cl_polylist[tCount].getAttribute("material");

                if (materialRef === undef) {
                  newObj.setFaceMaterial(0);
                } else {
                  newObj.setFaceMaterial(materialsRef[materialMap[materialRef]].mat);
                }

                var cl_poly_source = cl_polylist[tCount].getElementsByTagName("p");

                mapLen = cl_inputmap.length;

                var polyData = [];

                if ((cl_poly_source.length > 1) && !vcount.length) // blender 2.49 style
                {
                  var pText = "";
                  for (pCount = 0, pMax = cl_poly_source.length; pCount < pMax; pCount++) {
                    var tmp = util.intDelimArray(util.collectTextNode(cl_poly_source[pCount]), " ");

                    vcount[pCount] = parseInt(tmp.length / mapLen, 10);

                    polyData.splice(polyData.length, 0, tmp);
                  }
                }
                else {
                  if (cl_poly_source.length) {
                    polyData = util.intDelimArray(util.collectTextNode(cl_poly_source[0]), " ");
                  }
                }

                if (polyData.length) {
                  computedLen = vcount.length;

                  if (computedLen !== cl_polylistCount) {
                    log("poly vcount data doesn't add up, skipping object load: " + computedLen + " !== " + cl_polylistCount);
                  } else {
                    if (newObj.points.length === 0) {
                      newObj.points = geoSources[pointRef].data;
                    }

                    ofs = 0;

                    for (i = 0, iMax = vcount.length; i < iMax; i++) {
                      norm = [];
                      vert = [];
                      uv = [];

                      for (j = 0, jMax = vcount[i] * mapLen; j < jMax; j++) {
                        if (cl_inputmap[j % mapLen] === CL_VERTEX) {
                          vert.push(polyData[ofs]);
                          ofs++;
                        } else if (cl_inputmap[j % mapLen] === CL_NORMAL) {
                          norm.push(polyData[ofs]);
                          ofs++;
                        } else if (cl_inputmap[j % mapLen] === CL_TEXCOORD) {
                          uv.push(polyData[ofs]);
                          ofs++;
                        }
                      }


                      if (vert.length) {
                        // if (up_axis !== 1)
                        // {
                        //   vert.reverse();
                        // }
                        nFace = newObj.addFace(vert);

                        if (norm.length) {
                          for (k = 0, kMax = norm.length; k < kMax; k++) {
                            newObj.faces[nFace].point_normals[k] = fixuaxis(geoSources[normalRef].data[norm[k]]);
                          }
                        }

                        if (uv.length) {
                          for (k = 0, kMax = uv.length; k < kMax; k++) {
                            newObj.faces[nFace].uvs[k] = geoSources[uvRef].data[uv[k]];
                          }
                        }
                      }

                    }
                  }
                }
              }
            }

            if (up_axis !== 1) {
              for (i = 0, iMax = newObj.points.length; i < iMax; i++) {
                newObj.points[i] = fixuaxis(newObj.points[i]);
              }
            }

            newObj.id = meshId;
            meshes[meshId] = newObj;
          }
        }
      }

    }
  }


  var cl_lib_cameras = cl.getElementsByTagName("library_cameras");


  if (!cl_lib_cameras.length && cl_collada13_lib.length)
  {
    cl_lib_cameras = cl_collada13_libmap["CAMERA"];
  }


  var camerasRef = [];
  var camerasBoundRef = [];

  if (cl_lib_cameras.length) {
    cl_cameras = cl.getElementsByTagName("camera");

    for (cCount = 0, cMax = cl_cameras.length; cCount < cMax; cCount++) {
      cl_camera = cl_cameras[cCount];

      var cameraId = cl_camera.getAttribute("id");
      var cameraName = cl_camera.getAttribute("name");

//      var cl_perspective = cl_camera.getElementsByTagName("perspective");

      // if (cl_perspective.length) {
      //   var perspective = cl_perspective[0];

        var cl_yfov = cl_camera.getElementsByTagName("yfov");
        var cl_znear = cl_camera.getElementsByTagName("znear");
        var cl_zfar = cl_camera.getElementsByTagName("zfar");
        
        var yfov;
        var znear;
        var zfar;
        
        if (!cl_yfov.length && !cl_znear.length && !cl_zfar.length) {
          cl_params = cl_camera.getElementsByTagName("param");
          
          for (i = 0, iMax = cl_params.length; i < iMax; i++) {
            var txt = util.collectTextNode(cl_params[i]);
            switch (cl_params[i].getAttribute("name"))
            {
              case "YFOV": yfov = parseFloat(txt); break;
              case "ZNEAR": znear = parseFloat(txt); break;
              case "ZFAR": zfar = parseFloat(txt); break;
            }
          }
        }
        else
        {
          yfov = cl_yfov.length ? parseFloat(util.collectTextNode(cl_yfov[0])) : 60;
          znear = cl_znear.length ? parseFloat(util.collectTextNode(cl_znear[0])) : 0.1;
          zfar = cl_zfar.length ? parseFloat(util.collectTextNode(cl_zfar[0])) : 1000.0;          
        }

        var newCam = new CubicVR.Camera(512, 512, parseFloat(yfov), parseFloat(znear), parseFloat(zfar));
        newCam.targeted = false;
        newCam.setClip(znear, zfar);

        camerasRef[cameraId] = newCam;
      // }

    }
  }

  var getFirstChildByTagName = function(scene_node,tagName) {
    for (var i = 0, iMax = scene_node.childNodes.length; i < iMax; i++) {
      if (scene_node.childNodes[i].tagName === tagName) {
        return scene_node.childNodes[i];
      } //if
    } //for
    return null;
  };

  var getChildrenByTagName = function(scene_node,tagName) {
    var ret = [];
    for (var i = 0, iMax = scene_node.childNodes.length; i < iMax; i++) {
      if (scene_node.childNodes[i].tagName === tagName) {
        ret.push(scene_node.childNodes[i]);
      }
    }
    return ret;
  };


  var quaternionFilterZYYZ = function(rot,ofs) {
    var r = rot;
    var temp_q = new CubicVR.Quaternion();
    
    if (ofs !== undef) {
      r = CubicVR.vec3.add(rot, ofs);
    }
        
    temp_q.fromEuler(r[0],r[2],-r[1]);

    return temp_q.toEuler();
  };


  var cl_getInitalTransform = function(scene_node) {
    var retObj = {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    };

    var translate = getFirstChildByTagName(scene_node,"translate");
    var rotate = getChildrenByTagName(scene_node,"rotate");
    var scale = getFirstChildByTagName(scene_node,"scale");
    //debug('cl_getInitialTransform: ' + scene_node.name + ': ' + translate + ', ' + rotate + ', ' + scale);
    
    if (translate !== null) {
      retObj.position = fixuaxis(util.floatDelimArray(util.collectTextNode(translate), " "));
    }


    if (rotate.length) {
      for (var r = 0, rMax = rotate.length; r < rMax; r++) {
        var cl_rot = rotate[r];

        var rType = cl_rot.getAttribute("sid");

        var rVal = util.floatDelimArray(util.collectTextNode(cl_rot), " ");

        if (rType == "rotateX" || rType == "rotationX") {
          retObj.rotation[0] = rVal[3];
        }
        else if (rType == "rotateY" || rType == "rotationY") {
          retObj.rotation[1] = rVal[3];
        }
        else if (rType == "rotateZ" || rType == "rotationZ") {
          retObj.rotation[2] = rVal[3];
        } //if
      } //for
    } //if

    if (scale!==null) {
      retObj.scale = fixscaleaxis(util.floatDelimArray(util.collectTextNode(scale), " "));
    }

    return retObj;
  };


  var lights = [];

  var cl_lib_lights = cl.getElementsByTagName("library_lights");
  
  if (cl_lib_lights.length)
  {
    var cl_lights = cl.getElementsByTagName("light");
    
    for (var lightCount = 0, lightMax = cl_lights.length; lightCount < lightMax; lightCount++) {

      var cl_light = cl_lights[lightCount];
      
      var cl_point = cl_light.getElementsByTagName("point");
      var cl_pointLight = cl_point.length?cl_point[0]:null;

      var lightId = cl_light.getAttribute("id");
      var lightName = cl_light.getAttribute("name");

      if (cl_pointLight !== null) {

        var cl_intensity = getFirstChildByTagName(cl_pointLight,"intensity");
        var intensity = (cl_intensity!==null)?parseFloat(CubicVR.util.collectTextNode(cl_intensity)):1.0;
        var cl_distance = getFirstChildByTagName(cl_pointLight,"distance");
        var distance = (cl_distance!==null)?parseFloat(CubicVR.util.collectTextNode(cl_distance)):10.0;

        var cl_color = getFirstChildByTagName(cl_pointLight,"color");
        var color = [1,1,1];

        if (cl_color !== null) {
          var cn = util.collectTextNode(cl_color);
          color = util.floatDelimArray(cn, " ");
        }
        
        var newLight = new CubicVR.Light(CubicVR.enums.light.type.POINT,CubicVR.enums.light.method.STATIC);
        newLight.name = lightName;
        newLight.diffuse = color;
        newLight.specular = color;
        newLight.distance = distance;
        newLight.intensity = intensity; 

        lights[lightId] = newLight;
       }
    }
  }
  

/*



*/

  var cl_lib_scenes = cl.getElementsByTagName("library_visual_scenes");

  if (!cl_lib_scenes.length && cl_collada13_lib.length)
  {
    cl_lib_scenes = ["13"];
  }
  

  var scenesRef = [];
  var sceneLights = [];

  if (cl_lib_scenes.length) {
    var cl_scenes = null;
    
    if (cl_lib_scenes[0]==="13"){
      cl_scenes = cl.getElementsByTagName("scene");
    } else {
      cl_scenes = cl_lib_scenes[0].getElementsByTagName("visual_scene");
    }
    
    
    for (var sceneCount = 0, sceneMax = cl_scenes.length; sceneCount < sceneMax; sceneCount++) {
      cl_scene = cl_scenes[sceneCount];

      var sceneId = cl_scene.getAttribute("id");
      var sceneName = cl_scene.getAttribute("name");

      var newScene = new CubicVR.Scene(sceneName);

      var cl_nodes = cl_scene.getElementsByTagName("node");

      if (cl_nodes.length) {
        for (var nodeCount = 0, nodeMax = cl_nodes.length; nodeCount < nodeMax; nodeCount++) {
          var cl_node = cl_nodes[nodeCount];

          var cl_geom = getFirstChildByTagName(cl_nodes[nodeCount],"instance_geometry");
          var cl_light = getFirstChildByTagName(cl_nodes[nodeCount],"instance_light");
          cl_camera = getFirstChildByTagName(cl_nodes[nodeCount],"instance_camera");
          cl_13inst = getFirstChildByTagName(cl_nodes[nodeCount],"instance");

          if (cl_13inst !== null)
          {            
            var instance_name = cl_13inst.getAttribute("url").substr(1);
            if (meshes[instance_name] !== undef)
            {
              cl_geom = cl_13inst;
            }

            if (camerasRef[instance_name] !== undef)
            {
              cl_camera = cl_13inst;
            }
          }

          var nodeId = cl_node.getAttribute("id");
          var nodeName = cl_node.getAttribute("name");

          var it = cl_getInitalTransform(cl_node);

          if (up_axis === 2) {
            it.rotation = quaternionFilterZYYZ(it.rotation,(cl_camera!==null)?[-90,0,0]:undef);
          }

          var newSceneObject;

          if (cl_geom !== null) {
            meshName = cl_geom.getAttribute("url").substr(1);
            newSceneObject = new CubicVR.SceneObject(meshes[meshName], (nodeName !== null) ? nodeName : nodeId);

            newSceneObject.position = it.position;
            newSceneObject.rotation = it.rotation;
            newSceneObject.scale = it.scale;

            newScene.bindSceneObject(newSceneObject);
            if (cl_node.parentNode.tagName === 'node')
            {
              var parentNodeId = cl_node.parentNode.getAttribute("id");
              var parentNodeName = cl_node.parentNode.getAttribute("name");
              var parentNode = newScene.getSceneObject(parentNodeId);
              
              if (parentNode !== null)
              {         
                parentNode.bindChild(newSceneObject);
              }
            }
          } else if (cl_camera !== null) {
            var cam_instance = cl_camera;

            var camRefId = cam_instance.getAttribute("url").substr(1);

            newScene.camera = camerasRef[camRefId];
            camerasBoundRef[nodeId] = newScene.camera;

            newScene.camera.position = it.position;
            newScene.camera.rotation = it.rotation;
            
            newScene.camera.scale = it.scale;
          } else if (cl_light !== null) {            
            
            var lightRefId = cl_light.getAttribute("url").substr(1);
            var srcLight = lights[lightRefId];
            
            if (srcLight !== undef)
            {
              var nLight = new CubicVR.Light(srcLight.type,srcLight.method);
              // import
              nLight.diffuse = srcLight.diffuse;
              nLight.specular = srcLight.specular;
              nLight.distance = srcLight.distance;
              nLight.intensity = srcLight.intensity;
              nLight.name = srcLight.name;
              
              nLight.position = it.position;
              
              newScene.bindLight(nLight);
              
              sceneLights[nodeId] = nLight;
            }

          } else {
            newSceneObject = new CubicVR.SceneObject(null, (nodeName !== null) ? nodeName : nodeId);

            newSceneObject.position = it.position;
            newSceneObject.rotation = it.rotation;
            newSceneObject.scale = it.scale;

            newScene.bindSceneObject(newSceneObject);
          }

        }
      }

      scenesRef[sceneId] = newScene;
    }
  }

  var cl_lib_scene = cl.getElementsByTagName("scene");

  var sceneRef = null;

  if (cl_lib_scene.length) {
    cl_scene = cl_lib_scene[0].getElementsByTagName("instance_visual_scene");

    if (cl_scene.length) {
      var sceneUrl = cl_scene[0].getAttribute("url").substr(1);

      sceneRef = scenesRef[sceneUrl];
    } else {
      for (i in scenesRef) {
        if (scenesRef.hasOwnProperty(i)) {
          sceneRef =  scenesRef[i];
        }
      }
    }
  }

  var cl_lib_anim = cl.getElementsByTagName("library_animations");

  if (!cl_lib_anim.length && cl_collada13_lib.length)
  {
    cl_lib_anim = cl_collada13_libmap["ANIMATION"];
  }

  var animRef = [],
    animId;
  if (cl_lib_anim.length) {
    var cl_anim_sources = cl_lib_anim[0].getElementsByTagName("animation");

    if (cl_anim_sources.length) {
      for (var aCount = 0, aMax = cl_anim_sources.length; aCount < aMax; aCount++) {
        var cl_anim = cl_anim_sources[aCount];

        animId = cl_anim.getAttribute("id");
        var animName = cl_anim.getAttribute("name");

        animRef[animId] = {};
        animRef[animId].sources = [];

        var cl_sources = cl_anim.getElementsByTagName("source");

        if (cl_sources.length) {
          for (sCount = 0, sMax = cl_sources.length; sCount < sMax; sCount++) {
            var cl_source = cl_sources[sCount];

            sourceId = cl_source.getAttribute("id");

            var name_arrays = cl_source.getElementsByTagName("name_array");
            if (name_arrays.length === 0) {
              name_arrays = cl_source.getElementsByTagName("Name_array");
            }
            var float_arrays = cl_source.getElementsByTagName("float_array");
            var tech_common = cl_source.getElementsByTagName("technique_common");

            var name_array = null;
            var float_array = null;
            var data = null;

            if (name_arrays.length) {
              name_array = util.textDelimArray(util.collectTextNode(name_arrays[0]), " ");
            } else if (float_arrays.length) {
              float_array = util.floatDelimArray(util.collectTextNode(float_arrays[0]), " ");
            }

            var acCount = 0;
            var acSource = "";
            var acStride = 1;

            if (tech_common.length) {
              tech = tech_common[0];
              var acc = tech.getElementsByTagName("accessor")[0];

              acCount = parseInt(acc.getAttribute("count"), 10);
              acSource = acc.getAttribute("source").substr(1);
              var aStride = acc.getAttribute("stride");

              if (aStride) {
                acStride = parseInt(aStride, 10);
              }
            }

            animRef[animId].sources[sourceId] = {
              data: name_array ? name_array : float_array,
              count: acCount,
              source: acSource,
              stride: acStride
            };

            if (acStride !== 1) {
              animRef[animId].sources[sourceId].data = util.repackArray(animRef[animId].sources[sourceId].data, acStride, acCount);
            }
          }
        }

        cl_samplers = cl_anim.getElementsByTagName("sampler");

        if (cl_samplers.length) {
          animRef[animId].samplers = [];

          for (sCount = 0, sMax = cl_samplers.length; sCount < sMax; sCount++) {
            var cl_sampler = cl_samplers[sCount];

            var samplerId = cl_sampler.getAttribute("id");

            cl_inputs = cl_sampler.getElementsByTagName("input");

            if (cl_inputs.length) {
              var inputs = [];

              for (iCount = 0, iMax = cl_inputs.length; iCount < iMax; iCount++) {
                cl_input = cl_inputs[iCount];

                var semanticName = cl_input.getAttribute("semantic");

                inputs[semanticName] = cl_input.getAttribute("source").substr(1);
              }

              animRef[animId].samplers[samplerId] = inputs;
            }
          }
        }

        var cl_channels = cl_anim.getElementsByTagName("channel");


        if (cl_channels.length) {
          animRef[animId].channels = [];

          for (cCount = 0, cMax = cl_channels.length; cCount < cMax; cCount++) {
            var channel = cl_channels[cCount];

            var channelSource = channel.getAttribute("source").substr(1);
            var channelTarget = channel.getAttribute("target");

            var channelSplitA = channelTarget.split("/");
            var channelTargetName = channelSplitA[0];
            var channelSplitB = channelSplitA[1].split(".");
            var channelParam = channelSplitB[0];
            var channelType = channelSplitB[1];

            animRef[animId].channels.push({
              source: channelSource,
              target: channelTarget,
              targetName: channelTargetName,
              paramName: channelParam,
              typeName: channelType
            });
          }
        }
      }
    }

    for (animId in animRef) {
      if (animRef.hasOwnProperty(animId)) {
        var anim = animRef[animId];

        if (anim.channels.length) {
          for (cCount = 0, cMax = anim.channels.length; cCount < cMax; cCount++) {
            var chan = anim.channels[cCount];
            var sampler = anim.samplers[chan.source];
            var samplerInput = anim.sources[sampler["INPUT"]];
            var samplerOutput = anim.sources[sampler["OUTPUT"]];
            var samplerInterp = anim.sources[sampler["INTERPOLATION"]];
            var samplerInTangent = anim.sources[sampler["IN_TANGENT"]];
            var samplerOutTangent = anim.sources[sampler["OUT_TANGENT"]];
            var hasInTangent = (sampler["IN_TANGENT"]!==undef);
            var hasOutTangent = (sampler["OUT_TANGENT"]!==undef);
            var mtn = null;

            var targetSceneObject = sceneRef.getSceneObject(chan.targetName);
            var targetCamera = camerasBoundRef[chan.targetName];
            var targetLight = sceneLights[chan.targetName];


            if (targetSceneObject) {
              if (targetSceneObject.motion === null) {
                targetSceneObject.motion = new CubicVR.Motion();
              }
              mtn = targetSceneObject.motion;
            } else if (targetCamera) {
              if (targetCamera.motion === null) {
                targetCamera.motion = new CubicVR.Motion();
              }

              mtn = targetCamera.motion;
            } else if (targetLight)
            {
              if (targetLight.motion === null)
              {
                targetLight.motion = new CubicVR.Motion();
              }
              
              mtn = targetLight.motion;
            }

            if (mtn === null) {
              continue;
            }

            var controlTarget = CubicVR.enums.motion.POS;
            var motionTarget = CubicVR.enums.motion.X;

            if (up_axis === 2) {
              mtn.yzflip = true;
            }

            switch (chan.paramName) {
            case "rotateX":
            case "rotationX":
              controlTarget = CubicVR.enums.motion.ROT;
              motionTarget = CubicVR.enums.motion.X;
              break;
            case "rotateY":
            case "rotationY":
              controlTarget = CubicVR.enums.motion.ROT;
              motionTarget = CubicVR.enums.motion.Y;
              break;
            case "rotateZ":
            case "rotationZ":
              controlTarget = CubicVR.enums.motion.ROT;
              motionTarget = CubicVR.enums.motion.Z;
              break;
            case "location":
              controlTarget = CubicVR.enums.motion.POS;
              if (chan.typeName === "X") {
                motionTarget = CubicVR.enums.motion.X;
              }
              if (chan.typeName === "Y") {
                motionTarget = CubicVR.enums.motion.Y;
              }
              if (chan.typeName === "Z") {
                motionTarget = CubicVR.enums.motion.Z;
              }
              break;
            case "translate":
              controlTarget = CubicVR.enums.motion.POS;
              if (chan.typeName === "X") {
                motionTarget = CubicVR.enums.motion.X;
              }
              if (chan.typeName === "Y") {
                motionTarget = CubicVR.enums.motion.Y;
              }
              if (chan.typeName === "Z") {
                motionTarget = CubicVR.enums.motion.Z;
              }
              break;
            case "LENS":
              // controlTarget = enums.motion.LENS;
              // motionTarget = 4;
              controlTarget = 10;
              motionTarget = 10;
              continue; // disabled, only here for temporary collada files
            break;
            case "FOV":
              controlTarget = CubicVR.enums.motion.FOV;
              motionTarget = 3; // ensure no axis fixes are applied
            break;
            case "ZNEAR":
              controlTarget = CubicVR.enums.motion.NEARCLIP;
              motionTarget = 3; // ensure no axis fixes are applied
            break;
            case "ZFAR":
              controlTarget = CubicVR.enums.motion.FARCLIP;
              motionTarget = 3; // ensure no axis fixes are applied
            break;
            case "intensity":
              controlTarget = CubicVR.enums.motion.INTENSITY;
              motionTarget = 3; // ensure no axis fixes are applied
            break;
            
            }

            if (targetLight && controlTarget < 3) targetLight.method = CubicVR.enums.light.method.DYNAMIC;            

            // if (up_axis === 2 && motionTarget === enums.motion.Z) motionTarget = enums.motion.Y;
            // else if (up_axis === 2 && motionTarget === enums.motion.Y) motionTarget = enums.motion.Z;
            // 
            var ival;
            for (mCount = 0, mMax = samplerInput.data.length; mCount < mMax; mCount++) {  // in the process of being deprecated
              k = null;

              if (typeof(samplerOutput.data[mCount]) === 'object') {
                for (i = 0, iMax = samplerOutput.data[mCount].length; i < iMax; i++) {
                  ival = i;

                  if (up_axis === 2 && i === 2) {
                    ival = 1;
                  } else if (up_axis === 2 && i === 1) {
                    ival = 2;
                  }

                  k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], fixukaxis(controlTarget, ival, samplerOutput.data[mCount][i]));

                  if (samplerInterp) {
                    switch (samplerInterp.data[mCount][i]) {
                    case "LINEAR":
                      k.shape = CubicVR.enums.envelope.shape.LINE;
                      break;
                    case "BEZIER":
                      if (!(hasInTangent||hasOutTangent))
                      {
                        k.shape = CubicVR.enums.envelope.shape.LINEAR;
                      }
                      else
                      {
                        k.shape = CubicVR.enums.envelope.shape.BEZI;
                      }
                      break;
                    }
                  }
                }
              } else {
                ival = motionTarget;
                ofs = 0;

                if (targetCamera) {
                  if (controlTarget === CubicVR.enums.motion.ROT)            
                  {
                    if (up_axis === 2 && ival === 0) {
                      ofs = -90;
                    }
                  }
                }

                if (controlTarget === CubicVR.enums.motion.ROT) {
                  k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], samplerOutput.data[mCount] + ofs);
                } else {
                  if (up_axis === 2 && motionTarget === 2) {
                    ival = 1;
                  } else if (up_axis === 2 && motionTarget === 1) {
                    ival = 2;
                  }

                  k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], fixukaxis(controlTarget, ival, samplerOutput.data[mCount]));
                }

                if (samplerInterp) {
                  switch (samplerInterp.data[mCount]) {
                  case "LINEAR":
                    k.shape = CubicVR.enums.envelope.shape.LINE;
                    break;
                  case "BEZIER":
                    if (!(hasInTangent||hasOutTangent))
                    {
                      k.shape = CubicVR.enums.envelope.shape.LINEAR;
                      k.continutity = 1.0;          
                    }
                    else
                    {
                      k.shape = CubicVR.enums.envelope.shape.BEZ2;

                      var itx = samplerInTangent.data[mCount][0], ity;
                      var otx = samplerOutTangent.data[mCount][0], oty;
                      
                      if (controlTarget === CubicVR.enums.motion.ROT) {                        
                        ity = samplerInTangent.data[mCount][1];
                        oty = samplerOutTangent.data[mCount][1];
                   
                      //  k.value = k.value/10;
                      //  mtn.rscale = 10;

                        k.param[0] = itx-k.time;
                        k.param[1] = ity-k.value+ofs;
                        k.param[2] = otx-k.time;
                        k.param[3] = oty-k.value+ofs;
                      }
                      else {
                        ity = fixukaxis(controlTarget, ival, samplerInTangent.data[mCount][1]);
                        oty = fixukaxis(controlTarget, ival, samplerOutTangent.data[mCount][1]);

                        k.param[0] = itx-k.time;
                        k.param[1] = ity-k.value;
                        k.param[2] = otx-k.time;
                        k.param[3] = oty-k.value;
                      }
                    
                    }
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return sceneRef;
}

onmessage = function(e) {
  var message = e.data.message;
  if (message == 'start') {
    var meshUrl = e.data.params.meshUrl;
    var prefix = e.data.params.prefix;
    var rootDir = e.data.params.rootDir;
    importScripts(rootDir + 'CubicVR.js');
    setup();

    var scene = cubicvr_loadCollada(meshUrl, prefix);

    function disassembleMotion(obj) {
      if (obj.motion !== null && obj.disassembled === undefined) {
        obj.disassembled = true;
        var co = obj.motion.controllers;
        for (var j=0, maxJ=co.length; j<maxJ; ++j) {
          var con = co[j];
          if (!con) {
            co[j] = undefined;
            continue;
          } //if
          for (var k=0, maxK=con.length; k<maxK; ++k) {
            var env = con[k];
            if (!env) {
              con[k] = undefined;
              continue;
            } //if
            var keys = [];
            var key = env.keys;
            while (keys.length < env.nKeys) {
              var next_key = key.next;
              keys.push(key);
              key.next = null;
              key.prev = null;
              key = next_key;
            } //while
            env.keys = keys;
            env.firstKey = keys.indexOf(env.firstKey);
            env.lastKey = keys.indexOf(env.lastKey);
          } //for k
        } //for j
      } //if
    } //disassembleMotion

    for (var i=0, maxI=scene.sceneObjects.length; i<maxI; ++i) {
      var p = scene.sceneObjects[i].parent;
      scene.sceneObjects[i].parent = null;
      if (p) {
        scene.sceneObjects[i].parent = 'REPLACE_ME';
        //debug(i + ': ' + scene.sceneObjects[i].name);
      } //if
      disassembleMotion(scene.sceneObjects[i]);
      if (scene.sceneObjects[i].children) {
        for (var j=0, maxJ=scene.sceneObjects[i].children.length; j<maxJ; ++j) {
          scene.sceneObjects[i].children[j].parent = 'REPLACE_ME';
          disassembleMotion(scene.sceneObjects[i].children[j]);
        } //for j
      } //if
      try {
        JSON.stringify(scene.sceneObjects[i]);
      }
      catch(e) {
        //debug('fail!! ' + scene.sceneObjects[i].name + ': ' + scene.sceneObjects[i].parent + ', ' + scene.sceneObjects[i].children.length);
        //for (var h in scene.sceneObjects[i]) {
          //debug(h);
          //debug(scene.sceneObjects[i][h]);
        //}
      }
    } //for i
    
    for (var i=0, maxI=scene.lights.length; i<maxI; ++i) {
      disassembleMotion(scene.lights[i]);
    } //for i
    disassembleMotion(scene.camera);

    //postMessage({message:'done parsing'});
    postMessage({message:'materials', data:JSON.stringify(materialList)});
    postMessage({message:'scene', data:JSON.stringify(scene)});
    //postMessage({message:'done sending'});
  } //if
}; //onmessage

