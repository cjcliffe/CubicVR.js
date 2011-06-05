var Editor = (function () {

  var scene;
  var editorContents, editorObjectList, editorObjectProperties, editorObjectFieldsetLegend;
  var selectedObject;
  var mousePos, mouseMoveHandler, mouseMoveMode = 'x', manipulateMode;
  var cameraMoveVector = [0, 0, 0], cameraMoveFactor = 0.01;
  var posFactor = .01, rotFactor = 1, scaleFactor = 0.02, amplifier = 1;
  var gridFloor, targetObject, selectCursorObject, specialObjects = [];
  
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

  function isSpecialObject(obj) {
    return specialObjects.indexOf(obj) !== -1; 
  } //checkSpecialObjects

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

    scene = new CubicVR.Scene(canvas.width, canvas.height, 60, 0.1, 50.0);

    gridFloor = createObject({
      type: 'plane',
      name: 'gridFloor',
      size: 100.0,
      material: new CubicVR.Material({
        textures: {
          color: (function () {
            var t = new CubicVR.CanvasTexture({
              width: 512, 
              height: 512,
              update: function (canvas, ctx) {
                ctx.clearRect(0, 0, 512, 512);
                ctx.strokeStyle = 'rgba(10, 10, 10, 1.0)';
                ctx.lineWidth = 2;
                for (var i=0; i<512; i+=8) {
                  ctx.beginPath();
                  ctx.moveTo(0, i);
                  ctx.lineTo(512, i);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(i, 0);
                  ctx.lineTo(i, 512);
                  ctx.stroke();
                } //for
              },
            });
            t.update();
            return t;
          })(),
        }
      }),
      uvmapper: {
        projectionMode: CubicVR.enums.uv.projection.PLANAR,
        projectionAxis: CubicVR.enums.uv.axis.Z,
        scale: [10,10,10],
      },
      prepare: true,
      bind: true,
    });
    gridFloor.rotation[0] = 90;

    specialObjects.push(gridFloor);

    var testBox = createObject({
      type: 'box',
      material: new CubicVR.Material({
        textures: {
          color: new CubicVR.Texture("../samples/images/crate.jpg"),
          alpha: new CubicVR.Texture("../samples/images/crate-alpha.jpg"),
        },
        shininess: 0.5,
      }),
      custom: function (mesh) {
        //mesh.flipFaces();
      },
      prepare: true,
      bind: true,
    });

    targetObject = createObject({
      type: 'box',
      size: 0.2,
      material: new CubicVR.Material({
        color: [1, 1, 1],
        shininess: 0,
      }),
      prepare: true,
      bind: true,
    });

    selectCursorObject = new CubicVR.SceneObject(new CubicVR.Mesh());
    for (var i=0; i<8; ++i) {
      selectCursorObject.bindChild( new CubicVR.SceneObject(
        CubicVR.primitives.box({
          name: 'selectCursorChild1',
          size: 0.2,
          material: new CubicVR.Material({
            color: [0,1,0],
          }),
          uvmapper: {
            projectionMode: CubicVR.enums.uv.projection.CUBIC,
            scale: [1,1,1],
          },
        }).prepare()
      ));
      specialObjects.push(selectCursorObject.children[i]);
    } //for
    scene.bindSceneObject(selectCursorObject);
    specialObjects.push(selectCursorObject);
    selectCursorObject.visible = false;

    specialObjects.push(targetObject);

    scene.camera.position = [2, 2, 2];
    scene.camera.target = [0, 0, 0];
    CubicVR.addResizeable(scene);
    CubicVR.setGlobalAmbient([0.4, 0.4, 0.4]);

    scene.bindLight(new CubicVR.Light({
      type: CubicVR.enums.light.type.POINT,
      distance: 20,
      intensity: 2,
      position: [2, 2, 2],
    }));

    mvc = new CubicVR.MouseViewController(canvas, scene.camera);

    CubicVR.MainLoop(function(timer, gl) {
      var seconds = timer.getSeconds();
      //gridFloor.position = [
      //  scene.camera.position[0],
      //  0,
      //  scene.camera.position[2],
      //];
      var cam = scene.camera;
      var mv = cameraMoveVector;
      var diff = [cam.target[0] - cam.position[0], cam.target[2] - cam.position[2]];
      var atanNS = Math.atan2(diff[0],diff[1]);
      var atanEW = atanNS - Math.PI/2;

      var mx = [
        (mv[0]*Math.sin(atanNS)) * cameraMoveFactor * amplifier,
        (mv[0]*Math.cos(atanNS)) * cameraMoveFactor * amplifier,
      ];

      var mz = [
        (mv[2]*Math.sin(atanEW)) * cameraMoveFactor * amplifier,
        (mv[2]*Math.cos(atanEW)) * cameraMoveFactor * amplifier,
      ];

      scene.camera.target[0] += mx[0] + mz[0];
      scene.camera.target[2] += mx[1] + mz[1];
      scene.camera.position[0] += mx[0] + mz[0];
      scene.camera.position[2] += mx[1] + mz[1];

      targetObject.position = scene.camera.target;
      targetObject.rotation[1] = atanNS/Math.PI*180;
      scene.updateShadows();
      scene.render();
    });

    editorContents = document.getElementById('editor-contents');
    editorObjectList = document.getElementById('editor-object-list');
    editorObjectProperties = {
      parent: document.getElementById('editor-object-properties'),
      position: document.getElementById('editor-object-properties-position'),
      rotation: document.getElementById('editor-object-properties-rotation'),
      scale: document.getElementById('editor-object-properties-scale'),
    };
    editorObjectFieldsetLegend = document.getElementById('editor-object-fieldset-legend');

    updateUI();
  } //init

  function setUIObjectProperties (obj) {
    editorObjectFieldsetLegend.innerHTML = obj.name;
    editorObjectProperties.position.value = obj.position;
    editorObjectProperties.rotation.value = obj.rotation;
    editorObjectProperties.scale.value = obj.scale;
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
    if (!isSpecialObject(obj)) {
      stopMouseHandler();
      setUIObjectProperties(obj);
      selectedObject = obj;

      selectCursorObject.visible = true;
      setCursorOn(obj);
    } //if
  } //selectObject

  function setCursorOn(obj) {
    var aabb = obj.getAABB();
    var width = aabb[1][0] - aabb[0][0];
    var height = aabb[1][1] - aabb[0][1];
    var depth = aabb[1][2] - aabb[0][2];

    selectCursorObject.children[0].position = [-width/2, -height/2, -depth/2];
    selectCursorObject.children[1].position = [-width/2, -height/2, depth/2];
    selectCursorObject.children[2].position = [-width/2, height/2, -depth/2];
    selectCursorObject.children[3].position = [-width/2, height/2, depth/2];
    selectCursorObject.children[4].position = [width/2, -height/2, -depth/2];
    selectCursorObject.children[5].position = [width/2, -height/2, depth/2];
    selectCursorObject.children[6].position = [width/2, height/2, -depth/2];
    selectCursorObject.children[7].position = [width/2, height/2, depth/2];

    selectCursorObject.position = obj.position;
  } //setCursorOn

  function updateUI () {
    editorObjectList.innerHTML = '';
    for (var i=0; i<scene.sceneObjects.length; ++i) {
      if (isSpecialObject(scene.sceneObjects[i])) {
        continue;
      } //if
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

  function stopMouseHandler() {
    document.removeEventListener('mousemove', mouseMoveHandler, false);
    mouseMoveHandler = undefined;
  } //stopMouseHandler

  function startMouseHandler(fn) {
    mouseMoveHandler = fn;
    document.addEventListener('mousemove', mouseMoveHandler, false);
  } //startMouseHandler

  document.addEventListener('DOMContentLoaded', function (e) {
    Editor.init();

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

    var keyUpFuncs = {
      'P': function (e) {
        if (selectedObject !== undefined) {
          if (mouseMoveHandler) {
            stopMouseHandler();
            resetProperties(selectedObject);
          } //if
          if (mouseMoveMode === 'a') {
            mouseMoveMode = 'x';
          } //if
          manipulateMode = 'position';
          rememberProperties(selectedObject);
          var mp = mvc.getMousePosition();
          mousePos = [mp[0], mp[1]];
          startMouseHandler(function (e) {
            var mPos = mvc.getMousePosition();
            var diff = [mousePos[0] - mPos[0], mousePos[1] - mPos[1]];
            if (mouseMoveMode === 'x') {
              selectedObject.position[0] = selectedObject.origins.position[0] + diff[0] * posFactor;
              selectedObject.position[1] = selectedObject.origins.position[1];
              selectedObject.position[2] = selectedObject.origins.position[2];
            }
            else if (mouseMoveMode === 'y') {
              selectedObject.position[1] = selectedObject.origins.position[1] + diff[1] * posFactor;
              selectedObject.position[0] = selectedObject.origins.position[0];
              selectedObject.position[2] = selectedObject.origins.position[2];
            }
            else if (mouseMoveMode === 'z') {
              selectedObject.position[2] = selectedObject.origins.position[2] + diff[0] * posFactor;
              selectedObject.position[0] = selectedObject.origins.position[0];
              selectedObject.position[1] = selectedObject.origins.position[1];
            } //if
            setCursorOn(selectedObject);
          });
        } //if
      },

      'R': function (e) {
        if (selectedObject !== undefined) {
          if (mouseMoveHandler) {
            stopMouseHandler();
            resetProperties(selectedObject);
          } //if
          if (mouseMoveMode === 'a') {
            mouseMoveMode = 'x';
          } //if
          manipulateMode = 'rotation';
          rememberProperties(selectedObject);
          var mp = mvc.getMousePosition();
          mousePos = [mp[0], mp[1]];
          startMouseHandler(function (e) {
            var mPos = mvc.getMousePosition();
            var diff = [mousePos[0] - mPos[0], mousePos[1] - mPos[1]];
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
          });
        } //if
      },

      'S': function (e) {
        if (selectedObject !== undefined) {
          if (mouseMoveHandler) {
            stopMouseHandler();
            resetProperties(selectedObject);
          } //if
          manipulateMode = 'scale';
          rememberProperties(selectedObject);
          var mp = mvc.getMousePosition();
          mousePos = [mp[0], mp[1]];
          startMouseHandler(function (e) {
            var mPos = mvc.getMousePosition();
            var diff = [mousePos[0] - mPos[0], mousePos[1] - mPos[1]];
            diff[0] = -diff[0];
            diff[1] = -diff[1];
            if (mouseMoveMode === 'x') {
              selectedObject.scale[0] = selectedObject.origins.scale[0] + diff[0] * scaleFactor;
              selectedObject.scale[1] = selectedObject.origins.scale[1];
              selectedObject.scale[2] = selectedObject.origins.scale[2];
            }
            else if (mouseMoveMode === 'y') {
              selectedObject.scale[1] = selectedObject.origins.scale[1] + diff[1] * scaleFactor;
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
          });
        } //if
      },

      'T': function (e) {
        if (selectedObject) {
          focusOnObject(selectedObject);
        } //if
      },

      'A': function (e) {
        if (manipulateMode === 'scale') {
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
        stopMouseHandler();
        if (selectedObject) {
          resetProperties(selectedObject);
        } //if
      },

      13: function (e) {
        stopMouseHandler();
      },

      16: function (e) {
        amplifier = 1;
      },

      37: function (e) {
        cameraMoveVector[2] = 0;
      },
      38: function (e) {
        cameraMoveVector[0] = 0;
      },
      39: function (e) {
        cameraMoveVector[2] = 0;
      },
      40: function (e) {
        cameraMoveVector[0] = 0;
      },

    };
    document.addEventListener('keyup', function (e) {

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
        amplifier = 10;
      },

      37: function (e) {
        cameraMoveVector[2] = -1;
      },
      38: function (e) {
        cameraMoveVector[0] = 1;
      },
      39: function (e) {
        cameraMoveVector[2] = 1;
      },
      40: function (e) {
        cameraMoveVector[0] = -1;
      },
    };
    document.addEventListener('keydown', function (e) {

      var chr = String.fromCharCode(e.which);
      if (keyDownFuncs[chr]) {
        keyDownFuncs[chr](e);
      }
      else if (keyDownFuncs[e.which]) {
        keyDownFuncs[e.which](e);
      } //if
    }, false);

    CubicVR.getCanvas().addEventListener('click', function (e) {
      stopMouseHandler();
      if (true || e.ctrlKey) {
        var rayTest = scene.bbRayTest(scene.camera.position, mvc.getMousePosition(), 3);
        var obj;
        for (var i=0; i<rayTest.length; ++i) {
          if (!isSpecialObject(rayTest[i].obj)) {
            obj = rayTest[i].obj;
          } //if
        } //for
        if (obj) {
          selectObject(obj);
          editorObjectList.value = obj.name;
        } //if
      } //if
    }, false);

    CubicVR.getCanvas().addEventListener('dblclick', function (e) {
      stopMouseHandler();
      if (true || e.ctrlKey) {
        var rayTest = scene.bbRayTest(scene.camera.position, mvc.getMousePosition(), 3);
        var obj;
        for (var i=0; i<rayTest.length; ++i) {
          if (!isSpecialObject(rayTest[i].obj)) {
            obj = rayTest[i].obj;
          } //if
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

