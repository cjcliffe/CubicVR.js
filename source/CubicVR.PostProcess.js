
CubicVR.RegisterModule("PostProcess", function(base) {
  
  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
  var makeFSQuad, destroyFSQuad, renderFSQuad;  
 
  /* Post Processing */
  enums.post = {
    output: {
      REPLACE: 0,
      BLEND: 1,
      ADD: 2,
      ALPHACUT: 3
    }
  };

  /*
      PostProcessShader:
      
      shaderInfo
      {
        enabled: enabled (default true)
        shader_vertex: id or url for vertex shader
        shader_fragment: id or url for fragment shader
        outputMode: method of output for this shader
        init: function to perform to initialize shader
        onresize: function to perform on resize; params ( shader, width, height )
        onupdate: function to perform on update; params ( shader )
        outputDivisor: use custom output buffer size, divisor of (outputDivisor) eg. 1 (default) = 1024x768, 2 = 512x384, 3 = 256x192
      }

    */

  var postProcessDivisorBuffers = [];
  var postProcessDivisorQuads = [];

  function PostProcessShader(shaderInfo) {
    if (shaderInfo.shader_vertex === undef) {
      return null;
    }
    if (shaderInfo.shader_fragment === undef) {
      return null;
    }

    this.outputMode = (shaderInfo.outputMode === undef) ? enums.post.output.REPLACE : CubicVR.parseEnum(CubicVR.enums.post.output,shaderInfo.outputMode);
    this.onresize = (shaderInfo.onresize === undef) ? null : shaderInfo.onresize;
    this.onupdate = (shaderInfo.onupdate === undef) ? null : shaderInfo.onupdate;
    this.init = (shaderInfo.init === undef) ? null : shaderInfo.init;
    this.enabled = (shaderInfo.enabled === undef) ? true : shaderInfo.enabled;
    this.outputDivisor = (shaderInfo.outputDivisor === undef) ? 1 : shaderInfo.outputDivisor;

    this.shader = new CubicVR.Shader(shaderInfo.shader_vertex, shaderInfo.shader_fragment);
    this.shader.use();

    // set defaults
    this.shader.addUVArray("aTex");
    this.shader.addVertexArray("aVertex");
    this.shader.addInt("srcTex", 0);
    this.shader.addInt("captureTex", 1);
    this.shader.addVector("texel");

    if (this.init !== null) {
      this.init(this.shader);
    }
  }

  /* New post-process shader chain -- to replace postProcessFX */

  function PostProcessChain(width, height, accum) {
    var gl = GLCore.gl;

    this.width = width;
    this.height = height;
    this.accum = (accum === undef)?false:true;
    this.vTexel = [1.0 / this.width, 1.0 / this.height, 0];

    // buffers
    this.captureBuffer = new CubicVR.RenderBuffer(width, height, true);
    this.bufferA = new CubicVR.RenderBuffer(width, height, false);
    this.bufferB = new CubicVR.RenderBuffer(width, height, false);
    this.bufferC = new CubicVR.RenderBuffer(width, height, false);

    this.accumOpacity = 1.0;
    this.accumIntensity = 0.3;
    
    if (this.accum) {
      this.accumBuffer = new CubicVR.RenderBuffer(width, height, false);
      this.accumBuffer.use();

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      this.blur_shader = new PostProcessShader({
        shader_vertex: ["attribute vec3 aVertex;",
                        "attribute vec2 aTex;",
                        "varying vec2 vTex;",
                        "void main(void)",
                        "{",
                          "vTex = aTex;",
                          "vec4 vPos = vec4(aVertex.xyz,1.0);",
                          "gl_Position = vPos;",
                          "}"].join("\n"),
        shader_fragment: ["#ifdef GL_ES",
                          "precision mediump float;",
                          "#endif",
                          "uniform sampler2D srcTex;",
                          "varying vec2 vTex;",
                          "uniform float opacity;",
                          "void main(void)",
                          "{ gl_FragColor = vec4(texture2D(srcTex, vTex).rgb, opacity);",
                          "}"].join("\n"),
        init: function(shader) {
          shader.addFloat("opacity");
          shader.setFloat("opacity",1.0);
        }});
    }

    this.bufferA.use();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.bufferB.use();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.end();

    // quad
    this.fsQuad = this.makeFSQuad(this.width, this.height);

    this.shaders = [];

    this.copy_shader = new PostProcessShader({
      shader_vertex: ["attribute vec3 aVertex;",
                  "attribute vec2 aTex;",
                  "varying vec2 vTex;",
                  "void main(void) {",
                    "vTex = aTex;",
                    "vec4 vPos = vec4(aVertex.xyz,1.0);",
                    "gl_Position = vPos;",
                  "}"].join("\n"),
      shader_fragment: [
        "#ifdef GL_ES",
        "precision mediump float;",
        "#endif",
        "uniform sampler2D srcTex;",
        "varying vec2 vTex;",
        "void main(void) {",
          "gl_FragColor = texture2D(srcTex, vTex);",
        "}"].join("\n")
    });

    this.resize(width, height);
  }

  PostProcessChain.prototype = {
    setBlurOpacity: function (opacity)
    {  
      this.accumOpacity = opacity;
    },

    setBlurIntensity: function (intensity)
    {  
      this.accumIntensity = intensity;
    },

    makeFSQuad: function(width, height) {
      var gl = GLCore.gl;
      var fsQuad = {}; // intentional empty object
      var w = width;
      var h = height;

      var uscale = (width / w);
      var vscale = (height / h);

      fsQuad.vbo_points = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0]);
      fsQuad.vbo_uvs = new Float32Array([0, 0, uscale, 0, uscale, vscale, 0, vscale, 0, 0, uscale, vscale]);

      fsQuad.gl_points = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, fsQuad.gl_points);
      gl.bufferData(gl.ARRAY_BUFFER, fsQuad.vbo_points, gl.STATIC_DRAW);

      fsQuad.gl_uvs = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, fsQuad.gl_uvs);
      gl.bufferData(gl.ARRAY_BUFFER, fsQuad.vbo_uvs, gl.STATIC_DRAW);

      return fsQuad;
    },

    destroyFSQuad: function(fsQuad) {
      var gl = GLCore.gl;

      gl.deleteBuffer(fsQuad.gl_points);
      gl.deleteBuffer(fsQuad.gl_uvs);
    },

    renderFSQuad: function(shader, fsq) {
      var gl = GLCore.gl;

      shader.use();

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      gl.bindBuffer(gl.ARRAY_BUFFER, fsq.gl_points);
      gl.vertexAttribPointer(shader.aVertex, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(shader.aVertex);
      gl.bindBuffer(gl.ARRAY_BUFFER, fsq.gl_uvs);
      gl.vertexAttribPointer(shader.aTex, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(shader.aTex);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

    },

    addShader: function(shader) {
      this.shaders[this.shaders.length] = shader;
      shader.shader.use();
      shader.shader.setVector("texel", this.vTexel);  

      if (shader.outputDivisor && shader.outputDivisor != 1)
      {
        if (postProcessDivisorBuffers[shader.outputDivisor] === undef) {
          // XXXhumph - this change needs a check, if block was missing braces, might have too much in here...
          var divw = (this.width/shader.outputDivisor) | 0;
          var divh = (this.height/shader.outputDivisor) | 0;
          postProcessDivisorBuffers[shader.outputDivisor] = new CubicVR.RenderBuffer(divw, divh, false);  
          postProcessDivisorQuads[shader.outputDivisor] = this.makeFSQuad(divw, divh);
        }
      }
    },

    resize: function(width, height) {
      var gl = GLCore.gl;

      this.width = width;
      this.height = height;

      this.vTexel = [1.0 / this.width, 1.0 / this.height, 0];

      this.captureBuffer.destroyBuffer();
      this.captureBuffer.createBuffer(this.width, this.height, true);

      this.bufferA.destroyBuffer();
      this.bufferA.createBuffer(this.width, this.height, false);

      this.bufferB.destroyBuffer();
      this.bufferB.createBuffer(this.width, this.height, false);

      this.bufferC.destroyBuffer();
      this.bufferC.createBuffer(this.width, this.height, false);

      if (this.accum) {
        this.accumBuffer.destroyBuffer();
        this.accumBuffer.createBuffer(this.width, this.height, false);
        this.accumBuffer.use();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      for (var p in postProcessDivisorBuffers)
      {
        var divw = (this.width/p) | 0;
        var divh = (this.height/p) | 0;

        postProcessDivisorBuffers[p].destroyBuffer();
        postProcessDivisorBuffers[p].createBuffer(divw, divh, false); 

        this.destroyFSQuad(postProcessDivisorQuads[p]);
        postProcessDivisorQuads[p] = this.makeFSQuad(divw, divh);            
      }

      this.inputBuffer = this.bufferA;
      this.outputBuffer = this.bufferB;

      for (var i = 0, iMax = this.shaders.length; i < iMax; i++) {
        this.shaders[i].shader.use();
        this.shaders[i].shader.setVector("texel", this.vTexel);
        if (this.shaders[i].onresize !== null) {
          this.shaders[i].onresize(this.shaders[i].shader, this.width, this.height);
        }
      }

      this.destroyFSQuad(this.fsQuad);
      this.fsQuad = this.makeFSQuad(this.width, this.height);
    },

    swap: function() {
      var t = this.inputBuffer;

      this.inputBuffer = this.outputBuffer;
      this.outputBuffer = t;
    },

    begin: function(doClear) {
      var gl = GLCore.gl;

      this.captureBuffer.use();

      if (doClear) {
          if (this.captureBuffer.depth) {
              gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT);
          } else {
              gl.clear(gl.COLOR_BUFFER_BIT);
          }
      }
    },

    end: function() {
      var gl = GLCore.gl;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    render: function() {
      var gl = GLCore.gl;

      var initBuffer = null;

      this.captureBuffer.texture.use(gl.TEXTURE1);

      this.outputBuffer.use();
      this.captureBuffer.texture.use(gl.TEXTURE0);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.renderFSQuad(this.copy_shader.shader, this.fsQuad);
      this.end();

      var c = 0;
      for (var i = 0, iMax = this.shaders.length; i < iMax; i++) {
        var s = this.shaders[i];
        if (!s.enabled) {
          continue;
        }
        this.swap();
        this.inputBuffer.texture.use(gl.TEXTURE0);

        var o_mode = s.outputMode;
        //switch (s.outputMode) {
        if (o_mode === enums.post.output.REPLACE) {
        //case enums.post.output.REPLACE:
          if (s.outputDivisor !== 1) {
            postProcessDivisorBuffers[s.outputDivisor].use();
          }
          else {
            this.outputBuffer.use();
          } //if
          gl.clearColor(0.0, 0.0, 0.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          //break;
        }
        else if (o_mode === enums.post.output.ADD || o_mode === enums.post.output.BLEND) {
        //case enums.post.output.ADD:
        //case enums.post.output.BLEND:
          if (s.outputDivisor !== 1) {
            postProcessDivisorBuffers[s.outputDivisor].use();
          }
          else {
            this.bufferC.use();        
          } //if

          gl.clearColor(0.0, 0.0, 0.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          //break;
        } //if

        if (s.onupdate !== null) {
          s.shader.use();
          s.onupdate(s.shader);
        } //if

        if (s.outputDivisor !== 1) {
          gl.viewport(0, 0, postProcessDivisorBuffers[s.outputDivisor].width, postProcessDivisorBuffers[s.outputDivisor].height);

          this.renderFSQuad(s.shader, postProcessDivisorQuads[s.outputDivisor]);

          if (s.outputMode === enums.post.output.REPLACE) {
            this.outputBuffer.use();

            postProcessDivisorBuffers[s.outputDivisor].texture.use(gl.TEXTURE0);

            gl.viewport(0, 0, this.width, this.height);

            this.renderFSQuad(this.copy_shader.shader, this.fsQuad);
          }
          else {
            gl.viewport(0, 0, this.width, this.height);        
          } //if
        }
        else {
          this.renderFSQuad(s.shader, this.fsQuad);      
        } //if

        //switch (s.outputMode) {
        
        //case enums.post.output.REPLACE:
        //  break;
        if (o_mode === enums.post.output.BLEND) {
        //case enums.post.output.BLEND:
          this.swap();
          this.outputBuffer.use();

          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

          this.inputBuffer.texture.use(gl.TEXTURE0);

          if (s.outputDivisor !== 1) {
            postProcessDivisorBuffers[s.outputDivisor].texture.use(gl.TEXTURE0);
          }
          else {
            this.bufferC.texture.use(gl.TEXTURE0);
          } //if

          this.renderFSQuad(this.copy_shader.shader, this.fsQuad);

          gl.disable(gl.BLEND);
          //break;
        }
        else if (o_mode === enums.post.output.ADD) {
        //case enums.post.output.ADD:
          this.swap();
          this.outputBuffer.use();

          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE);

          if (s.outputDivisor !== 1) {
            postProcessDivisorBuffers[s.outputDivisor].texture.use(gl.TEXTURE0);
          }
          else {
            this.bufferC.texture.use(gl.TEXTURE0);
          } //if

          this.renderFSQuad(this.copy_shader.shader, this.fsQuad);

          gl.disable(gl.BLEND);
          //break;
        } //if

        this.end();
        c++;
      } //for

      if (c === 0) {
        this.captureBuffer.texture.use(gl.TEXTURE0);
      } else {
        this.outputBuffer.texture.use(gl.TEXTURE0);
      } //if

      if (this.accum && this.accumOpacity !== 1.0)
      {
        this.blur_shader.shader.use();
        this.blur_shader.shader.setFloat("opacity",this.accumOpacity);

        this.accumBuffer.use();

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

        this.renderFSQuad(this.blur_shader.shader, this.fsQuad);

        this.end();

        gl.disable(gl.BLEND);

        this.renderFSQuad(this.copy_shader.shader, this.fsQuad);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        
        this.blur_shader.shader.use();
        this.blur_shader.shader.setFloat("opacity",this.accumIntensity);
        
        this.accumBuffer.texture.use(gl.TEXTURE0);
        
        this.renderFSQuad(this.blur_shader.shader, this.fsQuad);
        
        gl.disable(gl.BLEND);
      }
      else
      {
        this.renderFSQuad(this.copy_shader.shader, this.fsQuad);    
      }
    }
  };

  function RenderBuffer(width, height, depth_enabled) {
     this.createBuffer(width, height, depth_enabled);
   }

   RenderBuffer.prototype = {
     createBuffer: function(width, height, depth_enabled) {
       this.fbo = null;
       this.depth = null;
       this.texture = null;
       this.width = parseInt(width, 10);
       this.height = parseInt(height, 10);

       var w = this.sizeParam(width);
       var h = this.sizeParam(height);

       var gl = GLCore.gl;

       this.fbo = gl.createFramebuffer();

       if (depth_enabled) {
         this.depth = gl.createRenderbuffer();
       }

       // configure fbo
       gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

       if (depth_enabled) {
         gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);

         if (navigator.appVersion.indexOf("Windows")!==-1)
         {
           gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
           gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth); 
         }
         else
         {
           gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
           gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.depth); 
         }
       }

       // if (depth_enabled) {
       //   gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
       //   gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
       // }

       //  GL_DEPTH_COMPONENT32 0x81A7
       //  if (depth_enabled) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT, w, h); }
       // if (depth_enabled) {
       //   gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
       // }

       // init texture
       this.texture = new CubicVR.Texture();
       gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);

       // configure texture params
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

       // clear buffer
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

       gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, base.Textures[this.texture.tex_id], 0);

       gl.bindFramebuffer(gl.FRAMEBUFFER, null);
     },

     destroyBuffer: function() {
       var gl = GLCore.gl;

       gl.bindFramebuffer(gl.FRAMEBUFFER, null);
       gl.deleteRenderbuffer(this.depth);
       gl.deleteFramebuffer(this.fbo);
       gl.deleteTexture(base.Textures[this.texture.tex_id]);
       base.Textures[this.texture.tex_id] = null;
     },

     sizeParam: function(t) {
       return t;
       // var s = 32;
       //
       // while (t > s) s *= 2;
       //
       // return s;
     },

     use: function() {
       var gl = GLCore.gl;

       gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
       //  if (this.depth !== null) { gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth); }
       //  gl.viewport(0, 0, this.width, this.height);
     }
  };

  // Full-screen quad related
  var fsQuad = {
    make:PostProcessChain.prototype.makeFSQuad,
    destroy:PostProcessChain.prototype.destroyFSQuad,
    render:PostProcessChain.prototype.renderFSQuad
  };


  var exports = {
    RenderBuffer: RenderBuffer,
    PostProcessShader: PostProcessShader,
    PostProcessChain: PostProcessChain,
    fsQuad: fsQuad
  };
  
  return exports;
});
