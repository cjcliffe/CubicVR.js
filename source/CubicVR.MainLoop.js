CubicVR.RegisterModule("MainLoop", function (base) {

    var undef = base.undef;
    var nop = function () {};
    var enums = base.enums;
    var GLCore = base.GLCore;

    enums.keyboard = {
      BACKSPACE: 8,
      TAB: 9,
      ENTER: 13,
      SHIFT: 16,
      CTRL: 17,
      ALT: 18,
      PAUSE: 19,
      CAPS_LOCK: 20,
      ESCAPE: 27,
      SPACE: 32,
      PAGE_UP: 33,
      PAGE_DOWN: 34,
      END: 35,
      HOME: 36,
      LEFT_ARROW: 37,
      UP_ARROW: 38,
      RIGHT_ARROW: 39,
      DOWN_ARROW: 40,
      INSERT: 45,
      DELETE: 46,
      KEY_0: 48,
      KEY_1: 49,
      KEY_2: 50,
      KEY_3: 51,
      KEY_4: 52,
      KEY_5: 53,
      KEY_6: 54,
      KEY_7: 55,
      KEY_8: 56,
      KEY_9: 57,
      KEY_A: 65,
      KEY_B: 66,
      KEY_C: 67,
      KEY_D: 68,
      KEY_E: 69,
      KEY_F: 70,
      KEY_G: 71,
      KEY_H: 72,
      KEY_I: 73,
      KEY_J: 74,
      KEY_K: 75,
      KEY_L: 76,
      KEY_M: 77,
      KEY_N: 78,
      KEY_O: 79,
      KEY_P: 80,
      KEY_Q: 81,
      KEY_R: 82,
      KEY_S: 83,
      KEY_T: 84,
      KEY_U: 85,
      KEY_V: 86,
      KEY_W: 87,
      KEY_X: 88,
      KEY_Y: 89,
      KEY_Z: 90,
      LEFT_META: 91,
      RIGHT_META: 92,
      SELECT: 93,
      NUMPAD_0: 96,
      NUMPAD_1: 97,
      NUMPAD_2: 98,
      NUMPAD_3: 99,
      NUMPAD_4: 100,
      NUMPAD_5: 101,
      NUMPAD_6: 102,
      NUMPAD_7: 103,
      NUMPAD_8: 104,
      NUMPAD_9: 105,
      MULTIPLY: 106,
      ADD: 107,
      SUBTRACT: 109,
      DECIMAL: 110,
      DIVIDE: 111,
      F1: 112,
      F2: 113,
      F3: 114,
      F4: 115,
      F5: 116,
      F6: 117,
      F7: 118,
      F8: 119,
      F9: 120,
      F10: 121,
      F11: 122,
      F12: 123,
      NUM_LOCK: 144,
      SCROLL_LOCK: 145,
      SEMICOLON: 186,
      EQUALS: 187,
      COMMA: 188,
      DASH: 189,
      PERIOD: 190,
      FORWARD_SLASH: 191,
      GRAVE_ACCENT: 192,
      OPEN_BRACKET: 219,
      BACK_SLASH: 220,
      CLOSE_BRACKET: 221,
      SINGLE_QUOTE: 222
    };

    /* Timer */

    function Timer() {
        this.time_elapsed = 0;
        this.system_milliseconds = 0;
        this.start_time = 0;
        this.end_time = 0;
        this.last_update = 0;
        this.paused_time = 0;
        this.offset = 0;
        this.paused_state = 0;
    }


    Timer.prototype = {
        start: function () {
            this.update();
            this.num_updates = 0;
            this.start_time = this.system_milliseconds;
            this.last_update = this.start_time;
            this.paused_state = false;
            this.lock_state = false;
            this.lock_rate = 0;
            this.paused_time = 0;
            this.offset = 0;
        },

        stop: function () {
            this.end_time = this.system_milliseconds;
        },

        reset: function () {
            this.start();
        },

        lockFramerate: function (f_rate) {
            this.lock_rate = 1.0 / f_rate;
            this.lock_state = true;
        },

        unlock: function () {
            var msec_tmp = this.system_milliseconds;
            this.lock_state = false;
            this.update();
            this.last_update = this.system_milliseconds - this.lock_rate;
            this.offset += msec_tmp - this.system_milliseconds;
            this.lock_rate = 0;
        },

        locked: function () {
            return this.lock_state;
        },

        update: function () {
            this.num_updates++;
            this.last_update = this.system_milliseconds;

            if (this.lock_state) {
                this.system_milliseconds += (this.lock_rate * 1000) | 0;
            } else {
                this.system_milliseconds = Date.now();
            }


            if (this.paused_state) this.paused_time += this.system_milliseconds - this.last_update;

            this.time_elapsed = this.system_milliseconds - this.start_time - this.paused_time + this.offset;
        },

        getMilliseconds: function () {
            return this.time_elapsed;
        },

        getSeconds: function () {
            return this.getMilliseconds() / 1000.0;
        },

        setMilliseconds: function (milliseconds_in) {
            this.offset -= (this.system_milliseconds - this.start_time - this.paused_time + this.offset) - milliseconds_in;
        },

        setSeconds: function (seconds_in) {
            this.setMilliseconds((seconds_in * 1000.0)|0);
        },

        getLastUpdateSeconds: function () {
            return this.getLastUpdateMilliseconds() / 1000.0;
        },

        getLastUpdateMilliseconds: function () {
            return this.system_milliseconds - this.last_update;
        },

        getTotalMilliseconds: function () {
            return this.system_milliseconds - this.start_time;
        },

        getTotalSeconds: function () {
            return this.getTotalMilliseconds() / 1000.0;
        },

        getNumUpdates: function () {
            return this.num_updates;
        },

        setPaused: function (pause_in) {
            this.paused_state = pause_in;
        },

        getPaused: function () {
            return this.paused_state;
        }
    };

    /* Run-Loop Controller */

    function MainLoopRequest() {
        var gl = GLCore.gl;

        if (base.GLCore.mainloop === null) return;

        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(MainLoopRequest);
        }

        base.GLCore.mainloop.interval();
    }

    function setMainLoop(ml) {
        base.GLCore.mainloop = ml;
    }

    function MainLoop(mlfunc, doclear, noloop) {
        if (window.requestAnimationFrame === undef) {
            window.requestAnimationFrame = window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || null;
        }

        if (base.GLCore.mainloop !== null) {
            // kill old mainloop
            if (!(window.requestAnimationFrame) && base.GLCore.mainloop) {
                clearInterval(base.GLCore.mainloop.interval);
            }

            base.GLCore.mainloop = null;
        }

        if (mlfunc === null) {
            base.GLCore.mainloop = null;
            return;
        }

        if (!(this instanceof MainLoop)) {
            return new MainLoop(mlfunc,doclear,noloop);
        }

        var renderList = this.renderList = [];
        var renderStack = this.renderStack = [{
            scenes: [],
            update: function () {},
            start: function () {},
            stop: function () {}
        }];

        var timer = new Timer();
        timer.start();

        this.timer = timer;
        this.func = mlfunc;
        this.doclear = (doclear !== undef) ? doclear : true;
        base.GLCore.mainloop = this;

        if (GLCore.resizeList.length && !base.GLCore.resize_active) {
            window.addEventListener('resize', function () {
                base.GLCore.onResize();
            }, false);
            base.GLCore.resize_active = true;
        }

        var loopFunc = function () {
                return function () {
                    var gl = base.GLCore.gl;
                    timer.update();
                    if (base.GLCore.mainloop.doclear) {
                        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    } //if
                    mlfunc(timer, base.GLCore.gl);

                    var sceneGroup = renderStack[renderStack.length - 1],
                        renderList = sceneGroup.scenes;
                    if (sceneGroup.update) {
                        sceneGroup.update(timer, gl);
                    }
                    if (renderList) {
                        for (var i = 0, l = renderList.length; i < l; ++i) {
                            var scene = renderList[i];
                            if (scene.paused) continue;
                            if (scene.update) {
                                scene.update(timer, base.GLCore.gl);
                            } //if
                            scene.render();
                        } //for
                    } //if
                };
            }(); //loopFunc

        if (!noloop) {
          if (window.requestAnimationFrame) {
              //loopFunc();
              this.interval = loopFunc;
              window.requestAnimationFrame(MainLoopRequest);
          } else {
              this.interval = setInterval(loopFunc, 20);
          } //if
        }
        else {
          this.loopFunc = loopFunc;
        } //if

    } //MainLoop
    MainLoop.prototype = {
        setPaused: function (state) {
            this.timer.setPaused(state);
        },

        getPaused: function () {
            return this.timer.getPaused();
        },

        setTimerSeconds: function (time_in) {
            this.timer.setSeconds(time_in);
        },

        getTimerSeconds: function () {
            return this.timer.getSeconds();
        },

        resetTimer: function () {
            this.timer.reset();
        },

        addScene: function (scene, update, paused) {
            var sceneGroup = this.renderStack[this.renderStack.length - 1];
            sceneGroup.scenes.push(scene);
            return scene;
        },

        pushSceneGroup: function (options) {
            options.scenes = options.scenes || [];
            this.renderStack.push(options);
            for (var i = 0; i < options.scenes.length; ++i) {
                options.scenes[i].enable();
            } //for
            if (options.start) {
                options.start();
            }
        },

        popSceneGroup: function () {
            var sceneGroup = this.renderStack[this.renderStack.length - 1];
            for (var i = 0; i < sceneGroup.scenes.length; ++i) {
                sceneGroup.scenes[i].disable();
            } //for
            if (this.renderStack.length > 1) {
                this.renderStack.pop();
            } //if
            if (sceneGroup.stop) {
                sceneGroup.stop();
            }
        },

        getScene: function (name) {
            var sceneGroup = renderStack[renderStack.length - 1];
            var scene;
            for (var i = 0, l = sceneGroup.scenes.length; i < l; ++i) {
                if (sceneGroup.scenes[i].scene.name === name) {
                    scene = sceneGroup.scenes[i];
                    break;
                } //if
            } //for
            return scene;
        },

        resumeScene: function (scene) {
            if (typeof (scene) === "string") {
                scene = this.getScene(scene);
            } //if
            scene.enable();
            scene.paused = false;
        },

        pauseScene: function (scene) {
            if (typeof (scene) === "string") {
                scene = this.getScene(scene);
            } //if
            scene.paused = true;
            scene.disable();
        },

        removeScene: function (scene) {
            var sceneGroup = renderStack[renderStack.length - 1];
            if (typeof (scene) === "string") {
                scene = this.getScene(scene);
            } //if
            var idx = sceneGroup.scenes.indexOf(scene);
            if (idx > -1) {
                sceneGroup.scenes.splice(idx, 1);
            } //if
            return scene;
        },

        runOnce: function () {
          this.loopFunc();
        }

    };
    

    /* Simple View Controller */

    /*
        callback_obj =
        {    
            mouseMove: function(mvc,mPos,mDelta,keyState) {},
            mouseDown: function(mvc,mPos,keyState) {},
            mouseUp: function(mvc,mPos,keyState) {},
            bool keyDown: function(mvc,mPos,key,keyState) {}, // return false to cancel keyDown event / keyState
            keyUp: function(mvc,mPos,key,keyState) {},
            bool keyPress: function(mvc,mPos,key,keyState) {},  // return false to cancel keyDown event / keyState
            wheelMove: function(mvc,mPos,wDelta,keyState) {}
        }
    */

    function MouseViewController(canvas, cam_in, callback_obj) {
        this.canvas = canvas;
        this.camera = cam_in;
        this.mpos = [0, 0];
        this.mdown = false;

        var ctx = this;

        this.mEvents = {};
        this.keyState = [];

        for (var i in enums.keyboard) {
          this.keyState[i] = false;          
        }

        this.onMouseDown = function () {
            return function (ev) {
                ctx.mdown = true;
                ctx.mpos = [ev.pageX - ev.target.offsetLeft, ev.pageY - ev.target.offsetTop];
                if (ctx.mEvents.mouseDown) ctx.mEvents.mouseDown(ctx, ctx.mpos, ctx.keyState);
            };
        }();

        this.onMouseUp = function () {
            return function (ev) {
                ctx.mdown = false;
                ctx.mpos = [ev.pageX - ev.target.offsetLeft, ev.pageY - ev.target.offsetTop];
                if (ctx.mEvents.mouseUp) ctx.mEvents.mouseUp(ctx, ctx.mpos, ctx.keyState);
            };
        }();

        this.onMouseMove = function () {
            return function (ev) {
                var mdelta = [];

                var npos = [ev.pageX - ev.target.offsetLeft, ev.pageY - ev.target.offsetTop];

                mdelta[0] = npos[0] - ctx.mpos[0];
                mdelta[1] = npos[1] - ctx.mpos[1];

                ctx.mpos = npos;

                if (ctx.mEvents.mouseMove) ctx.mEvents.mouseMove(ctx, ctx.mpos, mdelta, ctx.keyState);
            };
        }();

        this.onMouseWheel = function () {
            return function (ev) {
                var delta = ev.wheelDelta ? ev.wheelDelta : (-ev.detail * 100.0);

                if (ctx.mEvents.mouseWheel) ctx.mEvents.mouseWheel(ctx, ctx.mpos, delta, ctx.keyState);
            };
        }();

        this.onKeyDown = function () {
            return function (ev) {
              var keyCode = ev.keyCode;              
              var kpResult = null;

               if (ctx.mEvents.keyPress) {
                kpResult = ctx.mEvents.keyPress(ctx, ctx.mpos, keyCode, ctx.keyState);
                
                if (kpResult !== undef) {
                  ctx.keyState[keyCode] = !!kpResult;
                } else {
                  ctx.keyState[keyCode] = true;
                }
               } else {
                 ctx.keyState[keyCode] = true;
               }
               
               if (!ctx.keyState[keyCode]) {
                  return;
               }
               
               if (ctx.mEvents.keyDown) {
                kpResult = ctx.mEvents.keyDown(ctx, ctx.mpos, keyCode, ctx.keyState);
                
                if (kpResult !== undef) {
                  ctx.keyState[keyCode] = !!kpResult;
                } else {
                  ctx.keyState[keyCode] = true;
                }
               }
            };
        }();

        this.onKeyUp = function () {
            return function (ev) {
              var keyCode = ev.keyCode;

               if (ctx.mEvents.keyUp) {
                  ctx.mEvents.keyUp(ctx, ctx.mpos, keyCode, ctx.keyState);
               }
               
               ctx.keyState[keyCode] = false;
            };
        }();

        this.eventDefaults = {
            mouseMove: function (ctx, mpos, mdelta, keyState) {
                if (!ctx.mdown) return;

                ctx.orbitView(mdelta);
                //          ctx.panView(mdelta);
            },
            mouseWheel: function (ctx, mpos, wdelta, keyState) {
                ctx.zoomView(wdelta);
            },
            mouseDown: null,
            mouseUp: null,
            keyDown: null,
            keyUp: null,
            keyPress: null
        };

        if (callback_obj !== false) this.setEvents((callback_obj === undef) ? this.eventDefaults : callback_obj);

        this.bind();
    }

    MouseViewController.prototype = {
        isKeyPressed: function(keyCode) {
            return this.keyState[keyCode];
        },

        getKeyState: function(keyCode) {
            if (keyCode !== undef) {
                return this.keyState[keyCode];          
            } else {
                return this.keyState;
            }
        },
    
        setEvents: function (callback_obj) {
            this.mEvents = {};
            for (var i in callback_obj) {
                this.bindEvent(i, callback_obj[i]);
            }
        },

        orbitView: function (mdelta) {
            var vec3 = base.vec3;
            var dv = vec3.subtract(this.camera.target, this.camera.position);
            var dist = vec3.length(dv);

            this.camera.position = vec3.moveViewRelative(this.camera.position, this.camera.target, -dist * mdelta[0] / 300.0, 0);
            this.camera.position[1] += dist * mdelta[1] / 300.0;

            this.camera.position = vec3.add(this.camera.target, vec3.multiply(vec3.normalize(vec3.subtract(this.camera.position, this.camera.target)), dist));
        },

        panView: function (mdelta, horiz) {
            var vec3 = base.vec3;
            if (!horiz) horiz = false;

            var dv = vec3.subtract(this.camera.target, this.camera.position);
            var dist = vec3.length(dv);
            var oldpos = this.camera.position;

            if (horiz) {
                this.camera.position = vec3.moveViewRelative(this.camera.position, this.camera.target, -dist * mdelta[0] / 300.0, -dist * mdelta[1] / 300.0);
            } else { // vertical
                this.camera.position = vec3.moveViewRelative(this.camera.position, this.camera.target, -dist * mdelta[0] / 300.0, 0);
                this.camera.position[1] += dist * mdelta[1] / 300.0;
            }

            var cam_delta = vec3.subtract(this.camera.position, oldpos);
            this.camera.target = vec3.add(this.camera.target, cam_delta);
        },

        zoomView: function (delta, zmin, zmax) {
            var vec3 = base.vec3;
            var dv = vec3.subtract(this.camera.target, this.camera.position);
            var dist = vec3.length(dv);

            dist -= delta / 1000.0;

            if (!zmin) zmin = 0.1;
            if (!zmax) zmax = 1000.0;

            if (dist < zmin) dist = zmin;
            if (dist > zmax) dist = zmax;

            this.camera.position = vec3.add(this.camera.target, vec3.multiply(vec3.normalize(vec3.subtract(this.camera.position, this.camera.target)), dist));
        },

        bindEvent: function (event_id, event_func) {
            if (event_func === undef) {
                this.mEvents[event_id] = this.eventDefaults[event_id];
            } else {
                this.mEvents[event_id] = event_func;
            }
        },

        unbindEvent: function (event_id) {
            this.bindEvent(event_id, null);
        },

        bind: function () {
            this.canvas.addEventListener('mousemove', this.onMouseMove, false);
            this.canvas.addEventListener('mousedown', this.onMouseDown, false);
            this.canvas.addEventListener('mouseup', this.onMouseUp, false);
            this.canvas.addEventListener('mousewheel', this.onMouseWheel, false);
            this.canvas.addEventListener('DOMMouseScroll', this.onMouseWheel, false);
            window.addEventListener('keydown', this.onKeyDown, false);
            window.addEventListener('keyup', this.onKeyUp, false);
        },

        unbind: function () {
            this.canvas.removeEventListener('mousemove', this.onMouseMove, false);
            this.canvas.removeEventListener('mousedown', this.onMouseDown, false);
            this.canvas.removeEventListener('mouseup', this.onMouseUp, false);
            this.canvas.removeEventListener('mousewheel', this.onMouseWheel, false);
            this.canvas.removeEventListener('DOMMouseScroll', this.onMouseWheel, false);
            window.removeEventListener('keydown', this.onKeyDown, false);
            window.removeEventListener('keyup', this.onKeyUp, false);
        },

        setCamera: function (cam_in) {
            this.camera = cam_in;
        },

        getMousePosition: function () {
            return this.mpos;
        }
    };

    var exports = {
        Timer: Timer,
        MainLoop: MainLoop,
        MouseViewController: MouseViewController,
        setMainLoop: setMainLoop,
        keyboard: enums.keyboard
    };

    return exports;
});
