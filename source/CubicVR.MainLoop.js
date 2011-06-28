/*
  Javascript port of CubicVR 3D engine for WebGL
  https://github.com/cjcliffe/CubicVR.js/
  http://www.cubicvr.org/

  May be used under the terms of the MIT license.
  http://www.opensource.org/licenses/mit-license.php
*/

CubicVR.RegisterModule("MainLoop",function(base) {

  var undef = base.undef;
  var nop = function(){ };
  var enums = CubicVR.enums;
  var GLCore = base.GLCore;

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


    Timer.prototype.start = function () {
        this.update();
        this.num_updates = 0;
        this.start_time = this.system_milliseconds;
        this.last_update = this.start_time;
        this.paused_state = false;
        this.lock_state = false;
        this.lock_rate = 0;
        this.paused_time = 0;
        this.offset = 0;
    }


    Timer.prototype.stop = function () {
        this.end_time = this.system_milliseconds;
    }


    Timer.prototype.reset = function () {
        this.start();
    }


    Timer.prototype.lockFramerate = function (f_rate) {
        this.lock_rate = 1.0 / this.f_rate;
        this.lock_state = true;
    }


    Timer.prototype.unlock = function () {
        var msec_tmp = this.system_milliseconds;
        this.lock_state = false;
        this.update();
        this.last_update = this.system_milliseconds - this.lock_rate;
        this.offset += msec_tmp - this.system_milliseconds;
        this.lock_rate = 0;
    }

    Timer.prototype.locked = function () {
        return this.lock_state;
    }

    Timer.prototype.update = function () {
        this.num_updates++;
        this.last_update = this.system_milliseconds;

        if (this.lock_state) {
            this.system_milliseconds += parseInt(lock_rate * 1000);
        } else {
            this.system_milliseconds = (new Date()).getTime();
        }


        if (this.paused_state) this.paused_time += this.system_milliseconds - this.last_update;

        this.time_elapsed = this.system_milliseconds - this.start_time - this.paused_time + this.offset;
    }


    Timer.prototype.getMilliseconds = function () {
        return this.time_elapsed;
    }



    Timer.prototype.getSeconds = function () {
        return this.getMilliseconds() / 1000.0;
    }


    Timer.prototype.setMilliseconds = function (milliseconds_in) {
        this.offset -= (this.system_milliseconds - this.start_time - this.paused_time + this.offset) - milliseconds_in;
    }



    Timer.prototype.setSeconds = function (seconds_in) {
        this.setMilliseconds(parseInt(seconds_in * 1000.0));
    }


    Timer.prototype.getLastUpdateSeconds = function () {
        return this.getLastUpdateMilliseconds() / 1000.0;
    }


    Timer.prototype.getLastUpdateMilliseconds = function () {
        return this.system_milliseconds - this.last_update;
    }

    Timer.prototype.getTotalMilliseconds = function () {
        return this.system_milliseconds - this.start_time;
    }


    Timer.prototype.getTotalSeconds = function () {
        return this.getTotalMilliseconds() / 1000.0;
    }


    Timer.prototype.getNumUpdates = function () {
        return this.num_updates;
    }


    Timer.prototype.setPaused = function (pause_in) {
        this.paused_state = pause_in;
    }

    Timer.prototype.getPaused = function () {
        return this.paused_state;
    }


    /* Run-Loop Controller */

    function MainLoopRequest()
    {

      var gl = GLCore.gl;

      if (CubicVR.GLCore.mainloop === null) return;

      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(MainLoopRequest);
      }

      CubicVR.GLCore.mainloop.interval();
    }

    function setMainLoop(ml)
    {
      CubicVR.GLCore.mainloop=ml;
    }

    function MainLoop(mlfunc,doclear)
    {
      if (window.requestAnimationFrame === undef) {      
        window.requestAnimationFrame = window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || null;
      }

      if (CubicVR.GLCore.mainloop !== null)
      {
        // kill old mainloop

        if (!(window.requestAnimationFrame) && CubicVR.GLCore.mainloop)
        {
          clearInterval(CubicVR.GLCore.mainloop.interval);
        }

        CubicVR.GLCore.mainloop = null;
      }

      if (mlfunc === null)
      {
        CubicVR.GLCore.mainloop = null;
        return;
      }

      var renderList = this.renderList = [];
      var renderStack = this.renderStack = [{
        scenes: [],
        update: function () {},
        start: function () {},
        stop: function () {},
      }];

      var timer = new Timer();
      timer.start();

      this.timer = timer;
      this.func = mlfunc;
      this.doclear = (doclear!==undef)?doclear:true;
      CubicVR.GLCore.mainloop = this;

      if (GLCore.resizeList.length && !CubicVR.GLCore.resize_active) {
        window.addEventListener('resize',  function()  { CubicVR.GLCore.onResize(); }, false);
        CubicVR.GLCore.resize_active = true;
      }

      var loopFunc = function() {
        return function() { 
          var gl = CubicVR.GLCore.gl;
          timer.update(); 
          if (CubicVR.GLCore.mainloop.doclear) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          } //if
          mlfunc(timer,CubicVR.GLCore.gl); 

          var sceneGroup = renderStack[renderStack.length-1],
              renderList = sceneGroup.scenes;
          sceneGroup.update && sceneGroup.update(timer, gl);
          if (renderList) {
            for (var i=0,l=renderList.length; i<l; ++i) {
              var scene = renderList[i];
              if (scene.paused) continue;
              if (scene.update) {
                scene.update(timer, CubicVR.GLCore.gl);
              } //if
              scene.render();
            } //for
          } //if
        };
      }(); //loopFunc

      if (window.requestAnimationFrame) {
        //loopFunc();
        this.interval = loopFunc;
        window.requestAnimationFrame(MainLoopRequest);
      } else { 
        this.interval = setInterval(loopFunc, 20);
      } //if


    } //MainLoop

    MainLoop.prototype.setPaused = function(state) {
      this.timer.setPaused(state);
    };

    MainLoop.prototype.getPaused = function() {
      return this.timer.getPaused();
    };

    MainLoop.prototype.setTimerSeconds = function(time_in) {
      this.timer.setSeconds(time_in);
    };


    MainLoop.prototype.getTimerSeconds = function() {
      return this.timer.getSeconds();
    };


    MainLoop.prototype.resetTimer = function() {
      this.timer.reset();
    };

    MainLoop.prototype.addScene = function (scene, update, paused) {
      var sceneGroup = this.renderStack[this.renderStack.length-1];
      sceneGroup.scenes.push(scene);
      return scene;
    };

    MainLoop.prototype.pushSceneGroup = function (options) {
      options.scenes = options.scenes || [];
      this.renderStack.push(options);
      for (var i=0; i<options.scenes.length; ++i) {
        options.scenes[i].enable();
      } //for
      options.start && options.start();
    };

    MainLoop.prototype.popSceneGroup = function () {
      var sceneGroup = this.renderStack[this.renderStack.length-1];
      for (var i=0; i<sceneGroup.scenes.length; ++i) {
        sceneGroup.scenes[i].disable();
      } //for
      if (this.renderStack.length > 1) {
        this.renderStack.pop();
      } //if
      sceneGroup.stop && sceneGroup.stop();
    };

    MainLoop.prototype.getScene = function (name) {
      var sceneGroup = renderStack[renderStack.length-1];
      var scene;
      for (var i=0, l=sceneGroup.scenes.length; i<l; ++i) {
        if (sceneGroup.scenes[i].scene.name === name) {
          scene = sceneGroup.scenes[i];
          break;
        } //if
      } //for
      return scene;
    };

    MainLoop.prototype.resumeScene = function (scene) {
      if (typeof(scene) === "string") {
        scene = this.getScene(scene);
      } //if
      scene.enable();
      scene.paused = false;
    };

    MainLoop.prototype.pauseScene = function (scene) {
      if (typeof(scene) === "string") {
        scene = this.getScene(scene);
      } //if
      scene.paused = true;
      scene.disable();
    };

    MainLoop.prototype.removeScene = function (scene) {
      var sceneGroup = renderStack[renderStack.length-1];
      if (typeof(scene) === "string") {
        scene = this.getScene(scene);
      } //if
      var idx = sceneGroup.scenes.indexOf(scene);
      if (idx > -1) {
        sceneGroup.scenes.splice(idx, 1);
      } //if
      return scene;
    };

    /*

      callback_obj =
      {    
          mouseMove: function(mvc,mPos,mDelta,keyState) {},
          mouseDown: function(mvc,mPos,keyState) {},
          mouseUp: function(mvc,mPos,keyState) {},
          keyDown: function(mvc,mPos,key,keyState) {},
          keyUp: function(mvc,mPos,key,keyState) {},
          wheelMove: function(mvc,mPos,wDelta,keyState) {}
      }

    */

    /* Simple View Controller */
    function MouseViewController(canvas,cam_in,callback_obj)
    {    
      this.canvas = canvas;
      this.camera = cam_in;    
      this.mpos = [0,0]
      this.mdown = false;

      var ctx = this;    

  /*                
      this.onMouseDown = function () { return function (ev)
      {
        ctx.mdown = true;
        ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
      } }();

      this.onMouseUp = function () { return function (ev)
      {
        ctx.mdown = false;
        ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
      }  }();

      this.onMouseMove = function () { return function (ev)
      {
        var mdelta = [];

        var npos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];

        mdelta[0] = ctx.mpos[0]-npos[0];
        mdelta[1] = ctx.mpos[1]-npos[1];

        ctx.mpos = npos;
  //      ctx.mpos = [ev.clientX,ev.clientY];
        if (!ctx.mdown) return;

        var dv = vec3.subtract(ctx.camera.target,ctx.camera.position);
        var dist = vec3.length(dv);

        ctx.camera.position = vec3.moveViewRelative(ctx.camera.position,ctx.camera.target,dist*mdelta[0]/300.0,0);
        ctx.camera.position[1] -= dist*mdelta[1]/300.0;

        ctx.camera.position = vec3.add(ctx.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(ctx.camera.position,ctx.camera.target)),dist));
      } }();

      this.onMouseWheel = function() { return function (ev)
      {
        var delta = ev.wheelDelta?ev.wheelDelta:(-ev.detail*10.0);

        var dv = vec3.subtract(ctx.camera.target,ctx.camera.position);
        var dist = vec3.length(dv);

        dist -= delta/1000.0;

        if (dist < 0.1) dist = 0.1;
        if (dist > 1000) dist = 1000;
        // if (camDist > 20.0) camDist = 20.0;

        ctx.camera.position = vec3.add(ctx.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(ctx.camera.position,ctx.camera.target)),dist));
      } }();

  */    

      this.mEvents = {};
      this.keyState = [];    

      this.onMouseDown = function () { return function (ev)
      {
        ctx.mdown = true;
        ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
        if (ctx.mEvents.mouseDown) ctx.mEvents.mouseDown(ctx,ctx.mpos,ctx.keyState);
      } }();

      this.onMouseUp = function () { return function (ev)
      {
        ctx.mdown = false;
        ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
        if (ctx.mEvents.mouseUp) ctx.mEvents.mouseUp(ctx,ctx.mpos,ctx.keyState);
      }  }();

      this.onMouseMove = function () { return function (ev)
      {
        var mdelta = [];

        var npos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];

        mdelta[0] = npos[0]-ctx.mpos[0];
        mdelta[1] = npos[1]-ctx.mpos[1];

        ctx.mpos = npos;

        if (ctx.mEvents.mouseMove) ctx.mEvents.mouseMove(ctx,ctx.mpos,mdelta,ctx.keyState);
      } }();

      this.onMouseWheel = function() { return function (ev)
      {
        var delta = ev.wheelDelta?ev.wheelDelta:(-ev.detail*100.0);

        if (ctx.mEvents.mouseWheel) ctx.mEvents.mouseWheel(ctx,ctx.mpos,delta,ctx.keyState);

      } }();

      this.onKeyDown = function() { return function (ev)
      {

      } }();

      this.onKeyUp = function() { return function (ev)
      {

      } }();

      this.eventDefaults = {
          mouseMove: function(ctx,mpos,mdelta,keyState) {
            if (!ctx.mdown) return;

            ctx.orbitView(mdelta);
  //          ctx.panView(mdelta);
          },
          mouseWheel: function(ctx,mpos,wdelta,keyState) {
            ctx.zoomView(wdelta);
          },
          mouseDown: null,
          mouseUp: null,
          keyDown: null,
          keyUp: null
      }

      if (callback_obj !== false) this.setEvents((callback_obj === undef)?this.eventDefaults:callback_obj);

      this.bind();
    }  

    MouseViewController.prototype.setEvents = function(callback_obj) {
       this.mEvents = {};
       for (var i in callback_obj) {
          this.bindEvent(i,callback_obj[i]);
      }
    }

    MouseViewController.prototype.orbitView = function(mdelta) {
        var vec3 = CubicVR.vec3;
        var dv = vec3.subtract(this.camera.target,this.camera.position);
        var dist = vec3.length(dv);

        this.camera.position = vec3.moveViewRelative(this.camera.position,this.camera.target,-dist*mdelta[0]/300.0,0);
        this.camera.position[1] += dist*mdelta[1]/300.0;

        this.camera.position = vec3.add(this.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(this.camera.position,this.camera.target)),dist));
    }

      MouseViewController.prototype.panView = function(mdelta,horiz) {
        var vec3 = CubicVR.vec3;
        if (!horiz) horiz = false;

        var dv = vec3.subtract(this.camera.target,this.camera.position);
        var dist = vec3.length(dv);
        var oldpos = this.camera.position;

        if (horiz) {
            this.camera.position = vec3.moveViewRelative(this.camera.position,this.camera.target,-dist*mdelta[0]/300.0,-dist*mdelta[1]/300.0);
        } 
        else { // vertical
            this.camera.position = vec3.moveViewRelative(this.camera.position,this.camera.target,-dist*mdelta[0]/300.0,0);
            this.camera.position[1] += dist*mdelta[1]/300.0;
        }

        var cam_delta = vec3.subtract(this.camera.position,oldpos);
        this.camera.target = vec3.add(this.camera.target,cam_delta);
    }


    MouseViewController.prototype.zoomView = function(delta,zmin,zmax) {
        var vec3 = CubicVR.vec3;
        var dv = vec3.subtract(this.camera.target,this.camera.position);
        var dist = vec3.length(dv);

        dist -= delta/1000.0;

        if (!zmin) zmin = 0.1;
        if (!zmax) zmax = 1000.0;

        if (dist < zmin) dist = zmin;
        if (dist > zmax) dist = zmax;

        this.camera.position = vec3.add(this.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(this.camera.position,this.camera.target)),dist));      
    }


    MouseViewController.prototype.bindEvent = function(event_id,event_func) {
      if (event_func === undef) {
          this.mEvents[event_id] = this.eventDefaults[event_id];
      } 
      else {
          this.mEvents[event_id] = event_func;
      }
    } 

    MouseViewController.prototype.unbindEvent = function(event_id) {
      this.bindEvent(event_id,null);
    }  

    MouseViewController.prototype.bind = function() {
      this.canvas.addEventListener('mousemove', this.onMouseMove, false);
      this.canvas.addEventListener('mousedown', this.onMouseDown, false);
      this.canvas.addEventListener('mouseup', this.onMouseUp, false);
      this.canvas.addEventListener('mousewheel', this.onMouseWheel, false);
      this.canvas.addEventListener('DOMMouseScroll', this.onMouseWheel, false);    
      this.canvas.addEventListener('keydown', this.onKeyDown, false);    
      this.canvas.addEventListener('keyup', this.onKeyUp, false);    
    };

    MouseViewController.prototype.unbind = function() {
      this.canvas.removeEventListener('mousemove', this.onMouseMove, false);
      this.canvas.removeEventListener('mousedown', this.onMouseDown, false);
      this.canvas.removeEventListener('mouseup', this.onMouseUp, false);
      this.canvas.removeEventListener('mousewheel', this.onMouseWheel, false);
      this.canvas.removeEventListener('DOMMouseScroll', this.onMouseWheel, false);    
      this.canvas.removeEventListener('keydown', this.onKeyDown, false);    
      this.canvas.removeEventListener('keyup', this.onKeyUp, false);    
    };

    MouseViewController.prototype.setCamera = function(cam_in) {
      this.camera = cam_in;
    }

    MouseViewController.prototype.getMousePosition = function() {
      return this.mpos;
    }
  
    var exports = {
      Timer: Timer,
      MainLoop: MainLoop,
      MouseViewController: MouseViewController,
      setMainLoop: setMainLoop
    };

    return exports;
});