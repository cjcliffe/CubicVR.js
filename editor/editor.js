var Editor = (function () {

  var scene, manipulatorScene, collisionScene, backgroundScene;
  var editorContents, editorObjectList, editorObjectProperties, editorObjectFieldsetLegend;
  var selectedObject;
  var mousePos, mouseMoveHandler, mouseMoveMode = 'x', manipulateMode;
  var screenSpacePos, screenSpaceOfs;
//  var cameraMoveVector = [0, 0, 0], cameraMoveFactor = 0.01;
  var posFactor = .01, rotFactor = 1, scaleFactor = 0.02;
  var gridFloor, targetObject, selectCursorObject;
  var manipulatorCursorObject, manipulatorCursorMats = [], manipulatorScale = 0.2, activeManipulator = -1;
  var shiftKey = false, altKey = false, ctrlKey = false;

  function focusOnObject(obj) {
    var s = [obj.scale[0] + 1, Math.abs(obj.scale[1] + 1), obj.scale[2] + 1];
    scene.camera.target = [obj.position[0], obj.position[1], obj.position[2]];
    scene.camera.position = [obj.position[0]+s[0], obj.position[1]+s[1], obj.position[2]+s[2]];
    gridFloor.position = [
      camera.position[0],
      0,
      camera.position[2],
    ];
  } //focusOnObject

  function createObject(options) {
    var mesh = options.mesh || new CubicVR.Mesh(options.name);
    if (options.type === 'plane') {
      CubicVR.primitives.plane({
        mesh: mesh,
        name: options.name,
        size: options.size || 1.0,
        material: options.material,
        uvmapper : options.uvmapper || {
          projectionMode: CubicVR.enums.uv.projection.PLANAR,
          projectionAxis: CubicVR.enums.uv.axis.Z,
          scale: [1,1,1],
        },
      });
    }
    else if (options.type === 'box') {
      CubicVR.primitives.box({
        mesh: mesh,
        name: options.name,
        size: options.size || 1.0,
        material: options.material,
        uvmapper: options.uvmapper || {
          projectionMode: CubicVR.enums.uv.projection.CUBIC,
          scale: [1,1,1],
        },
      });
    }
    if (typeof(options.custom) === 'function') {
      options.custom(mesh);
    } //if
    if (options.prepare === true) {
      mesh.prepare();
    } //if
    if (options.bind === true) {
      var name = options.objectName || options.name || ('Object' + scene.sceneObjects.length);
      var sceneObject = new CubicVR.SceneObject(mesh, name);
      scene.bindSceneObject(sceneObject, true);
      return sceneObject;
    } //if
    return mesh;
  } //createObject

  function init() {
    var gl = CubicVR.init();
    var canvas = CubicVR.getCanvas();

    if (!gl) {
      alert("Sorry, no WebGL support.");
      return;
    } //if

    scene = new CubicVR.Scene(canvas.width,canvas.height, 60, 0.1, 500.0);
    collisionScene = new CubicVR.Scene(canvas.width, canvas.height, 60, 0.1, 500.0);
    backgroundScene = new CubicVR.Scene(canvas.width, canvas.height, 60, 0.1, 500.0);
    manipulatorScene = new CubicVR.Scene(canvas.width, canvas.height, 60, 0.1, 500.0);

    var gridTex = (function () {
      var t = new CubicVR.CanvasTexture({
        width: 1024,
        height: 1024,
        update: function (canvas, ctx) {
          ctx.clearRect(0, 0, 1024, 1024);
          ctx.strokeStyle = 'rgba(255, 255, 255, 255)';
          ctx.lineWidth = 2;
          for (var i=0; i<1024; i+=16) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(1024, i);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 1024);
            ctx.stroke();
          } //for
        },
      });
      t.update();
      return t;
    })();
    
    gridTex.setFilter(CubicVR.enums.texture.filter.LINEAR,CubicVR.enums.texture.filter.LINEAR);

    gridFloor = createObject({
      type: 'plane',
      name: 'gridFloor',
      size: 20.0,
      material: new CubicVR.Material({
        textures: {
          color: gridTex,
        },
      }),
      uvmapper: {
        projectionMode: CubicVR.enums.uv.projection.PLANAR,
        projectionAxis: CubicVR.enums.uv.axis.Z,
        scale: [20,20,20],
      },
      prepare: true,
      bind: false,
    });

    gridFloor = new CubicVR.SceneObject(gridFloor, gridFloor.name);
    gridFloor.rotation[0] = 90;

    backgroundScene.bindSceneObject(gridFloor);

    targetObject = createObject({
      type: 'box',
      size: 0.2,
      material: new CubicVR.Material({
        color: [1, 1, 1],
        shininess: 0,
        colorMap: true
      }),
      prepare: false,
      bind: false,
    });
    
    var red = [1,0,0];
    var green = [0,1,0];
    var blue = [0,0,1];

    targetObject.faces[0].setColor([green,green,green,green]);
    targetObject.faces[1].setColor([green,green,green,green]);
    targetObject.faces[2].setColor([red,red,red,red]);
    targetObject.faces[3].setColor([blue,blue,blue,blue]);
    targetObject.faces[4].setColor([red,red,red,red]);
    targetObject.faces[5].setColor([blue,blue,blue,blue]);

    targetObject.triangulateQuads();
    targetObject.prepare();

    targetObject = new CubicVR.SceneObject(targetObject, targetObject.name);

    backgroundScene.bindSceneObject(targetObject);

    selectCursorObject = new CubicVR.SceneObject(new CubicVR.Mesh());
    for (var i=0; i<8; ++i) {
      selectCursorObject.bindChild( new CubicVR.SceneObject(
        CubicVR.primitives.box({
          name: 'selectCursorChild'+i,
          size: 0.2,
          material: new CubicVR.Material({
            color: [0,1,0],
          }),
        }).prepare()
      ));
    } //for
//    manipulatorScene.bindSceneObject(selectCursorObject);
    selectCursorObject.visible = false;

    manipulatorCursorObject = new CubicVR.SceneObject(null);

    for (var i=0; i<6; ++i) {
       manipulatorCursorMats[i] = new CubicVR.Material({
            color: [1,1,1],
            ambient: [0.1,0.1,0.1],
            opacity: 0.2
          });
          
       manipulatorCursorObject.bindChild(new CubicVR.SceneObject({
        scale: [manipulatorScale,manipulatorScale,manipulatorScale],
        mesh: CubicVR.primitives.sphere({
          name: 'manipulatorCursorChild'+i,
          radius: 0.5,
          lon: 8,
          lat: 16,
          material: manipulatorCursorMats[i]
        }).prepare(),
       }));
    }

    manipulatorScene.bindSceneObject(manipulatorCursorObject);
    manipulatorCursorObject.visible = false;
//scene.bindSceneObject(new CubicVR.SceneObject({mesh:manipulatorCursorObject.children[0].obj,scale:[5,5,5]}));
    scene.camera.position = [2, 2, 2];
    scene.camera.target = [0, 0, 0];
//    scene.camera.setClip(0.1,1000);
    CubicVR.addResizeable(scene);
    CubicVR.addResizeable(manipulatorScene);
    CubicVR.addResizeable(collisionScene);
    CubicVR.addResizeable(backgroundScene);
    
    manipulatorScene.camera = scene.camera;
    collisionScene.camera = scene.camera;
    backgroundScene.camera = scene.camera;
    CubicVR.setGlobalAmbient([0.4, 0.4, 0.4]);

    scene.bindLight(new CubicVR.Light({
      type: CubicVR.enums.light.type.DIRECTIONAL,
        direction: [0.5,-1,0.5]
    }));

    manipulatorScene.bindLight(new CubicVR.Light({
      type: CubicVR.enums.light.type.DIRECTIONAL,
        direction: [0.5,-1,0.5]
    }));

    mvc = new CubicVR.MouseViewController(canvas, scene.camera, eventKit.navDefaults);

    gl.clearColor(0.4,0.4,0.4,1.0);

    CubicVR.MainLoop(function(timer, gl) {
      var seconds = timer.getSeconds();
      gridFloor.position = [
        Math.floor(scene.camera.target[0]/5)*5,
        0,
        Math.floor(scene.camera.target[2]/5)*5,
      ];
      var cam = scene.camera;

      var diff = [cam.target[0] - cam.position[0], cam.target[2] - cam.position[2]];
      var atanNS = Math.atan2(diff[0],diff[1]);

      targetObject.position = scene.camera.target;
 //     targetObject.rotation[1] = atanNS/Math.PI*180;
 
      backgroundScene.render();
      scene.render();
      collisionScene.render();
      gl.clear(gl.DEPTH_BUFFER_BIT);
      manipulatorScene.render();
    });

    editorContents = document.getElementById('editor-contents');
    editorObjectList = document.getElementById('editor-object-list');
    editorObjectProperties = {
      parent: document.getElementById('editor-object-properties'),
      positionX: document.getElementById('editor-object-properties-position-x'),
      positionY: document.getElementById('editor-object-properties-position-y'),
      positionZ: document.getElementById('editor-object-properties-position-z'),
      rotationX: document.getElementById('editor-object-properties-rotation-x'),
      rotationY: document.getElementById('editor-object-properties-rotation-y'),
      rotationZ: document.getElementById('editor-object-properties-rotation-z'),
      scaleX: document.getElementById('editor-object-properties-scale-x'),
      scaleY: document.getElementById('editor-object-properties-scale-y'),
      scaleZ: document.getElementById('editor-object-properties-scale-z'),
    };
    editorObjectFieldsetLegend = document.getElementById('editor-object-fieldset-legend');

    updateUI();

    var editorContents = document.getElementById('editor-contents');
    editorContents.style.display = 'block';
    document.getElementById('editor-container-toggle').addEventListener('click', function (e) {
      if (editorContents.style.display === 'block') {
        editorContents.style.display = 'none';
      }
      else {
        editorContents.style.display = 'block';
      } //if
    }, false);

    var addTypeSelect = document.getElementById('editor-object-type');
    addTypeSelect.addEventListener('change', function (e) {
      if (addTypeSelect.value === 'custom') {
        document.getElementById('editor-object-from-file').style.display = 'block';
        document.getElementById('editor-object-details').style.display = 'none';
      }
      else {
        document.getElementById('editor-object-from-file').style.display = 'none';
        document.getElementById('editor-object-details').style.display = 'block';
      } //if
    }, false);

    $('#editor-object').dialog({
      autoOpen: false,
      modal: true,
      width: 650,
    });

    $('#editor-add-object').bind('click', function (e) {
      $( "#editor-object" ).dialog( "option", "title", 'Add Object');
      $( "#editor-object" ).dialog( "option", "buttons", {
        'Add': function() {
          var shininess = $('#editor-object-material-shininess').val(),
              meshType = $('#editor-object-type').val(),
              projMode = $('#editor-object-uvmapper-projection-mode').val(),
              projAxis = $('#editor-object-uvmapper-projection-axis').val(),
              inputTextures = $('#editor-object-textures').children('li'),
              color = $('#editor-object-material-color').val() || "0.5,0.5,0.5";

          if (meshType !== 'custom') {
            color = color.split(',');
            for (var i=0; i<color.length; ++i) {
              color[i] = parseFloat(color[i]);
            } //for

            var projModes = {
              cubic: CubicVR.enums.uv.projection.CUBIC,
              planar: CubicVR.enums.uv.projection.PLANAR,
              cylindrical: CubicVR.enums.uv.projection.CYLINDRICAL,
              spherical: CubicVR.enums.uv.projection.SPHERICAL,
            };

            var projAxes = {
              X: CubicVR.enums.uv.axis.X,
              Y: CubicVR.enums.uv.axis.Y,
              Z: CubicVR.enums.uv.axis.Z,
            };

            projMode = projModes[projMode] || CubicVR.enums.uv.projection.CUBIC;
            projAxis = projAxes[projAxis] || CubicVR.enums.uv.axis.Z;

            var textures = {};
            for (var i=0; i<inputTextures.length; ++i) {
              var inputTexture = inputTextures[i];
              console.log(inputTexture);
              var type = inputTexture.getElementsByTagName('select')[0].value;
              var file = inputTexture.getElementsByTagName('input')[1].files[0];
              var image = new Image();
              image.src = file.getAsDataURL();
              var texture = new CubicVR.Texture(image);
              textures[type] = texture;
            } //for

            shininess = shininess || 0.0;
            shininess = shininess === '' ? 0.0 : shininess;

            if (textures.color) {
              color = [1,1,1];
            } //if

            createObject({
              type: meshType,
              material: new CubicVR.Material({
                color: color,
                shininess: 0.0,
                textures: textures,
              }),
              uvmapper: {
                projectionMode: projMode,
                projectionAxis: projAxis,
                scale: [1,1,1],
              },
              custom: function (mesh) {
                //mesh.flipFaces();
              },
              prepare: true,
              bind: true,
            });

          } //if not custom

          updateUI();

          $(this).dialog("close");
        },
        'Cancel': function() {
          $(this).dialog("close");
        },
      });
      $('#editor-object').dialog('open');
    });

    $('#editor-object-texture-add').bind('click', function (e) {
      var newTexture = document.createElement('li');
      var fileInput = document.createElement('input');
      fileInput.type='file';
      var typeSelect = document.createElement('select');
      var texTypes = ['color', 'alpha', 'bump'];
      for (var i in texTypes) {
        var option = document.createElement('option');
        option.innerHTML = texTypes[i];
        option.value = texTypes[i];
        typeSelect.appendChild(option);
      }
      var deleteButton = document.createElement('input');
      deleteButton.type = 'button';
      deleteButton.value = 'Remove';
      deleteButton.style.width = '80px';
      newTexture.appendChild(deleteButton);
      newTexture.appendChild(typeSelect);
      newTexture.appendChild(fileInput);

      deleteButton.addEventListener('click', function (e) {
        $(newTexture).remove();
      }, false);

      $('#editor-object-textures').append(newTexture);
    });

    function makeTupleFieldChanger(base_name,target,elemSuffix) {
        if (!elemSuffix) elemSuffix = ['x','y','z'];

        function makeFieldClosure(base_name,target,idx) {
            return function(e) {
              var elem = $("#"+base_name);
              var elem_val = parseFloat(elem.val());

              if (selectedObject) {
                if (elem_val != elem_val) {
                    elem.val(selectedObject[target][idx]);
                  return;
                }

                selectedObject[target][idx] = elem_val;
                setCursorOn(selectedObject);
              }
            }
        }

        for (var i = 0, iMax = elemSuffix.length; i<iMax; i++) {
            $("#"+base_name+"-"+elemSuffix[i]).bind('change',makeFieldClosure(base_name+"-"+elemSuffix[i],target,i),false);
        }
    }


    makeTupleFieldChanger("editor-object-properties-position","position",['x','y','z']);
    makeTupleFieldChanger("editor-object-properties-rotation","rotation",['x','y','z']);
    makeTupleFieldChanger("editor-object-properties-scale","scale",['x','y','z']);

  } //init

  function setUIObjectProperties (obj) {
    editorObjectFieldsetLegend.innerHTML = obj.name;
    editorObjectProperties.positionX.value = obj.position[0];
    editorObjectProperties.positionY.value = obj.position[1];
    editorObjectProperties.positionZ.value = obj.position[2];
    editorObjectProperties.rotationX.value = obj.rotation[0];
    editorObjectProperties.rotationY.value = obj.rotation[1];
    editorObjectProperties.rotationZ.value = obj.rotation[2];
    editorObjectProperties.scaleX.value = obj.scale[0];
    editorObjectProperties.scaleY.value = obj.scale[1];
    editorObjectProperties.scaleZ.value = obj.scale[2];
  } //setUIObjectProperties

  function resetProperties(obj) {
    obj.position = [
      obj.origins.position[0],
      obj.origins.position[1],
      obj.origins.position[2],
    ];
    obj.rotation = [
      obj.origins.rotation[0],
      obj.origins.rotation[1],
      obj.origins.rotation[2],
    ];
    obj.scale = [
      obj.origins.scale[0],
      obj.origins.scale[1],
      obj.origins.scale[2],
    ];
  } //resetProperties

  function rememberProperties (obj) {
    obj.origins = {
      position: [obj.position[0], obj.position[1], obj.position[2]],
      rotation: [obj.rotation[0], obj.rotation[1], obj.rotation[2]],
      scale: [obj.scale[0], obj.scale[1], obj.scale[2]],
    };
  } //rememberProperties

  function selectObject(obj) {
    setUIObjectProperties(obj);
    selectedObject = obj;

    selectCursorObject.visible = true;
    manipulatorCursorObject.visible = true;
    setCursorOn(obj);
  } //selectObject

  function setCursorOn(obj) {
    var aabb = obj.getAABB();
    var width = aabb[1][0] - aabb[0][0];
    var height = aabb[1][1] - aabb[0][1];
    var depth = aabb[1][2] - aabb[0][2];

    selectCursorObject.children[0].position = [-width/2, -height/2, -depth/2];
    selectCursorObject.children[1].position = [-width/2, -height/2,  depth/2];
    selectCursorObject.children[2].position = [-width/2,  height/2, -depth/2];
    selectCursorObject.children[3].position = [-width/2,  height/2,  depth/2];
    selectCursorObject.children[4].position = [ width/2, -height/2, -depth/2];
    selectCursorObject.children[5].position = [ width/2, -height/2,  depth/2];
    selectCursorObject.children[6].position = [ width/2,  height/2, -depth/2];
    selectCursorObject.children[7].position = [ width/2,  height/2,  depth/2];
    selectCursorObject.position = obj.position.slice(0);

    manipulatorCursorObject.children[0].position = [ width/2+manipulatorScale/2, 0, 0]; // xpos
    manipulatorCursorObject.children[1].position = [-width/2-manipulatorScale/2, 0, 0]; // xneg
    manipulatorCursorObject.children[2].position = [0,  height/2+manipulatorScale/2,0]; // ypos
    manipulatorCursorObject.children[3].position = [0, -height/2-manipulatorScale/2,0]; // yneg
    manipulatorCursorObject.children[4].position = [0, 0,  depth/2+manipulatorScale/2]; // zpos
    manipulatorCursorObject.children[5].position = [0, 0, -depth/2-manipulatorScale/2]; // zneg
    manipulatorCursorObject.position = obj.position.slice(0);
  } //setCursorOn

  function updateUI () {
    editorObjectList.innerHTML = '';
    for (var i=0; i<scene.sceneObjects.length; ++i) {
      (function (obj) {
        var option = document.createElement('OPTION');
        option.innerHTML = obj.name;
        option.sceneObject = obj;
        option.addEventListener('dblclick', function (e) {
          selectObject(obj);
        }, false);
        editorObjectList.appendChild(option);
      })(scene.sceneObjects[i]);
    } //for
  } //updateUI

  var eventKit = {
        navDefaults: {
          mouseMove: function(ctx,mpos,mdelta,keyState) {
              if (ctx.mdown) {
                  if (!shiftKey) {
                    ctx.orbitView(mdelta);
                  }
                  else {
                    ctx.panView(mdelta,!ctrlKey);
                  }
              } else {
                  var rayTarget = scene.camera.unProject(mpos[0],mpos[1],scene.camera.fardepth);
                  var rayHit = false;
                  var mLen = manipulatorScale;
                  for (var i = 0; i < 6; i++) {
                    var hPos = CubicVR.mat4.vec3_multiply([0,0,0],manipulatorCursorObject.children[i].tMatrix);
                    
                    var iPos = CubicVR.vec3.getClosestTo(scene.camera.position,rayTarget,hPos);
                    var ihLen = CubicVR.vec3.length(CubicVR.vec3.subtract(hPos,iPos));
                    
                    if (ihLen <= manipulatorScale && ihLen <= mLen) {
                        if (activeManipulator != i) {
                            if (activeManipulator>=0) manipulatorCursorMats[activeManipulator].color = [1,1,1];
                            manipulatorCursorMats[i].color = [0,1,0];
                            if (activeManipulator>=0) manipulatorCursorMats[activeManipulator].opacity = 0.2;
                            manipulatorCursorMats[i].opacity = 0.99;
                            activeManipulator = i;
                            mLen = ihLen;
                        }
                        rayHit = true;
                    }
                  }
                  
                  if (!rayHit && activeManipulator>=0) {
                      manipulatorCursorMats[activeManipulator].color = [1,1,1];
                      manipulatorCursorMats[activeManipulator].opacity = 0.2;
                      activeManipulator = -1;
                  }
              }
            },
            mouseWheel: function(ctx,mpos,wdelta,keyState) {
              ctx.zoomView(wdelta);
            },
            mouseDown: function(ctx,mpos,keyState) {
              mousePos = mpos;
              if (activeManipulator>=0 && selectedObject) {
                  screenSpacePos = scene.camera.project(selectedObject.position[0],selectedObject.position[1],selectedObject.position[2]);
                  screenSpaceOfs = [screenSpacePos[0]-mpos[0],screenSpacePos[1]-mpos[1]];

                  manipulateMode = 'position';        
                  mouseMoveMode = ['x','x','y','y','z','z'][activeManipulator];
        
                  rememberProperties(selectedObject);
                  mvc.setEvents(eventKit.positionTool);
               }
            },
            mouseUp: function(ctx,mpos,keyState) {
                var selectTolerance = 3;
                if ((Math.abs(mousePos[0]-mpos[0])<=selectTolerance)&&(Math.abs(mousePos[1]-mpos[1])<=selectTolerance)) {
                    var rayTest = scene.bbRayTest(scene.camera.position, mpos, 3);
                    var obj;
                    for (var i=0; i<rayTest.length; ++i) {
                      obj = rayTest[i].obj;
                    } //for
                    if (obj) {
                      selectObject(obj);
                      editorObjectList.value = obj.name;
                    } //if
                }
            },
            keyDown: null,
            keyUp: null
        },
        positionTool: {
            mouseMove: function(ctx,mPos,mdelta,keyState) {
              if (mouseMoveMode === 'a') {
              // un-project a new centerpoint from screen to world-space using our stored offset and depth
              var worldSpaceTarget = scene.camera.unProject(mPos[0]+screenSpaceOfs[0],mPos[1]+screenSpaceOfs[1],screenSpacePos[2]);
              selectedObject.position = worldSpaceTarget;
            }
            else {
              // un-project a new centerpoint from screen to world-space using our stored offset and depth
              var worldSpaceTarget = scene.camera.unProject(mPos[0]+screenSpaceOfs[0],mPos[1]+screenSpaceOfs[1],scene.camera.farclip);

              var intersectPt;

              // experimental auto-plane
              var ray_vec = CubicVR.vec3.subtract(scene.camera.position,worldSpaceTarget,scene.camera.position);
              var min_ang = (75.0*(Math.PI/180.0));
              var max_ang = (115.0*(Math.PI/180.0));

              var a1 = Math.abs(CubicVR.vec3.angle(ray_vec,[0,1,0]));
              var a2 = Math.abs(CubicVR.vec3.angle(ray_vec,[1,0,0]));

              if ((a1 > max_ang || a1 < min_ang) && (mouseMoveMode !== 'y')) {
                intersectPt = CubicVR.vec3.linePlaneIntersect([0,1,0],selectedObject.origins.position,scene.camera.position,worldSpaceTarget);
              }
              else if ((a2 > max_ang || a2 < min_ang) && (mouseMoveMode !== 'x')) {
                intersectPt = CubicVR.vec3.linePlaneIntersect([1,0,0],selectedObject.origins.position,scene.camera.position,worldSpaceTarget);
              }
              else {
                intersectPt = CubicVR.vec3.linePlaneIntersect([0,0,1],selectedObject.origins.position,scene.camera.position,worldSpaceTarget);
              }

              if (intersectPt !== false) {
                selectedObject.position[0] = (mouseMoveMode === 'x')?intersectPt[0]:selectedObject.origins.position[0];
                selectedObject.position[1] = (mouseMoveMode === 'y')?intersectPt[1]:selectedObject.origins.position[1];
                selectedObject.position[2] = (mouseMoveMode === 'z')?intersectPt[2]:selectedObject.origins.position[2];
              }
            } // if
            setCursorOn(selectedObject);
        },
        mouseDown: function(ctx) {
            ctx.setEvents(eventKit.navDefaults);
        },
        mouseUp: function(ctx) {
            ctx.setEvents(eventKit.navDefaults);
        }
      },
      rotationTool: {
        mouseMove: function(ctx,mpos,mdelta,keyState) {
            var diff = [mpos[0]-mousePos[0],mpos[1]-mousePos[1]];
        
            if (mouseMoveMode === 'a') {
              mouseMoveMode = 'x';
            } //if
            if (mouseMoveMode === 'x') {
              selectedObject.rotation[0] = selectedObject.origins.rotation[0] + diff[0] * rotFactor;
              selectedObject.rotation[1] = selectedObject.origins.rotation[1];
              selectedObject.rotation[2] = selectedObject.origins.rotation[2];
            }
            else if (mouseMoveMode === 'y') {
              selectedObject.rotation[1] = selectedObject.origins.rotation[1] + diff[1] * rotFactor;
              selectedObject.rotation[0] = selectedObject.origins.rotation[0];
              selectedObject.rotation[2] = selectedObject.origins.rotation[2];
            }
            else if (mouseMoveMode === 'z') {
              selectedObject.rotation[2] = selectedObject.origins.rotation[2] + diff[0] * rotFactor;
              selectedObject.rotation[0] = selectedObject.origins.rotation[0];
              selectedObject.rotation[1] = selectedObject.origins.rotation[1];
            } //if
            setCursorOn(selectedObject);
          },
          mouseDown: function(ctx) {
            ctx.setEvents(eventKit.navDefaults);
        }
      },
      scaleTool: {
        mouseMove: function(ctx,mpos,mdelta,keyState) {
            var diff = [mpos[0]-mousePos[0],mpos[1]-mousePos[1]];
            if (mouseMoveMode === 'x') {
              selectedObject.scale[0] = selectedObject.origins.scale[0] + diff[0] * scaleFactor;
              selectedObject.scale[1] = selectedObject.origins.scale[1];
              selectedObject.scale[2] = selectedObject.origins.scale[2];
            }
            else if (mouseMoveMode === 'y') {
              selectedObject.scale[1] = selectedObject.origins.scale[1] - diff[1] * scaleFactor;
              selectedObject.scale[0] = selectedObject.origins.scale[0];
              selectedObject.scale[2] = selectedObject.origins.scale[2];
            }
            else if (mouseMoveMode === 'z') {
              selectedObject.scale[2] = selectedObject.origins.scale[2] + diff[0] * scaleFactor;
              selectedObject.scale[0] = selectedObject.origins.scale[0];
              selectedObject.scale[1] = selectedObject.origins.scale[1];
            }
            else if (mouseMoveMode === 'a') {
              selectedObject.scale[2] = selectedObject.origins.scale[2] + diff[0] * scaleFactor;
              selectedObject.scale[0] = selectedObject.origins.scale[0] + diff[0] * scaleFactor;
              selectedObject.scale[1] = selectedObject.origins.scale[1] + diff[0] * scaleFactor;
            } //if
            setCursorOn(selectedObject);
        },
        mouseDown: function(ctx) {
            ctx.setEvents(eventKit.navDefaults);
        }
     }
  }
    
   

  document.addEventListener('DOMContentLoaded', function (e) {
    Editor.init();

    var keyUpFuncs = {
      'P': function (e) {
        if (selectedObject !== undefined) {
          manipulateMode = 'position';
          rememberProperties(selectedObject);
          mousePos = mvc.getMousePosition();

          // get the object's actual screen-space position and depth
          screenSpacePos = scene.camera.project(selectedObject.position[0],selectedObject.position[1],selectedObject.position[2]);
          console.log(screenSpacePos[2]);
          // stores the mouse offset to prevent object from popping to cursor position
          screenSpaceOfs = [screenSpacePos[0]-mousePos[0],screenSpacePos[1]-mousePos[1]];
          
          mvc.setEvents(eventKit.positionTool);
        } //if 
      },

      'R': function (e) {
        if (selectedObject !== undefined) {
          manipulateMode = 'rotation';
          rememberProperties(selectedObject);
          mousePos = mvc.getMousePosition();

          mvc.setEvents(eventKit.rotationTool);
        }
      },

      'S': function (e) {
        if (selectedObject !== undefined) {
          if (mouseMoveHandler) {
            resetProperties(selectedObject);
          } //if
          manipulateMode = 'scale';
          rememberProperties(selectedObject);
          mousePos = mvc.getMousePosition();

          mvc.setEvents(eventKit.scaleTool);
        } //if
      },

      'T': function (e) {
        if (selectedObject) {
          focusOnObject(selectedObject);
        } //if
      },

      'A': function (e) {
        if (manipulateMode === 'scale' || manipulateMode === 'position') {
          mouseMoveMode = 'a';
        } //if
      },

      'X': function (e) {
        mouseMoveMode = 'x';
      },

      'Y': function (e) {
        mouseMoveMode = 'y';
      },

      'Z': function (e) {
        mouseMoveMode = 'z';
      },

      27: function (e) {
        if (selectedObject) {
          resetProperties(selectedObject);
          setCursorOn(selectedObject);
          mvc.setEvents(eventKit.navDefaults);
        } //if
      },

      13: function (e) {
          mvc.setEvents(eventKit.navDefaults);
      },

      16: function (e) {
        shiftKey = false;
      },
 
      17: function (e) {
        ctrlKey = false;
      },

      18: function (e) {
        altKey = false;
      },

      37: function (e) {
//        cameraMoveVector[2] = 0;
      },
      38: function (e) {
//        cameraMoveVector[0] = 0;
      },
      39: function (e) {
//        cameraMoveVector[2] = 0;
      },
      40: function (e) {
//        cameraMoveVector[0] = 0;
      },

    };

    // I prefer blender's 'G' for grab ;)
    keyUpFuncs['G'] = keyUpFuncs['P'];

    var canvas = CubicVR.getCanvas();
    
    canvas.addEventListener('keyup', function (e) {

      var chr = String.fromCharCode(e.which);
      if (keyUpFuncs[chr]) {
        keyUpFuncs[chr](e);
      }
      else if (keyUpFuncs[e.which]) {
        keyUpFuncs[e.which](e);
      }
      else {
        //console.log('no key bound for', e.which, String.fromCharCode(e.which));
      } //if
    }, false);

    var keyDownFuncs = {
      16: function (e) {
        shiftKey = true;
      },
      17: function (e) {
        ctrlKey = true;
      },
      18: function (e) {
        altKey = true;
      },
      37: function (e) {
//        cameraMoveVector[2] = -1;
      },
      38: function (e) {
//        cameraMoveVector[0] = 1;
      },
      39: function (e) {
//        cameraMoveVector[2] = 1;
      },
      40: function (e) {
//        cameraMoveVector[0] = -1;
      },
    };

      canvas.setAttribute('tabIndex', '0');

    canvas.addEventListener('keydown', function (e) {

      var chr = String.fromCharCode(e.which);
      if (keyDownFuncs[chr]) {
        keyDownFuncs[chr](e);
      }
      else if (keyDownFuncs[e.which]) {
        keyDownFuncs[e.which](e);
      } //if
    }, false);


    CubicVR.getCanvas().addEventListener('dblclick', function (e) {
      if (true || e.ctrlKey) {
        var rayTest = scene.bbRayTest(scene.camera.position, mvc.getMousePosition(), 3);
        var obj;
        for (var i=0; i<rayTest.length; ++i) {
          obj = rayTest[i].obj;
        } //for
        if (obj) {
          focusOnObject(obj);
        } //if
      } //if
    }, false);


  }, false);


  return {
    scene: scene,
    createObject: createObject,
    init: init,
    updateUI: updateUI,
    getSelectedObject: function () { return selectedObject; },
  };
})();

