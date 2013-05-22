
CubicVR.RegisterModule("Particles",function(base) {

  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
  

  /* Particle System */

  function Particle(pos, start_time, life_time, velocity, accel) {
    this.startpos = new Float32Array(pos);
    this.pos = new Float32Array(pos);
    this.velocity = new Float32Array((velocity !== undef) ? velocity : [0, 0, 0]);
    this.accel = new Float32Array((accel !== undef) ? accel : [0, 0, 0]);
    this.start_time = (start_time !== undef) ? start_time : 0;
    this.life_time = (life_time !== undef) ? life_time : 0;
    this.color = null;
    this.nextParticle = null;
  }


  function ParticleSystem(maxPts, hasColor, pTex, vWidth, vHeight, alpha, alphaCut) {
    var gl = GLCore.gl;

    if (!maxPts) {
      return;
    }

    this.particles = null;
    this.last_particle = null;
    this.pTex = (pTex !== undef) ? pTex : null;
    this.vWidth = vWidth;
    this.vHeight = vHeight;
    this.alpha = (alpha !== undef) ? alpha : false;
    this.alphaCut = (alphaCut !== undef) ? alphaCut : 0;

    this.pfunc = function(p, time) {
      var tdelta = time - p.start_time;

      if (tdelta < 0) {
        return 0;
      }
      if (tdelta > p.life_time && p.life_time) {
        return -1;
      }

      p.pos[0] = p.startpos[0] + (tdelta * p.velocity[0]) + (tdelta * tdelta * p.accel[0]);
      p.pos[1] = p.startpos[1] + (tdelta * p.velocity[1]) + (tdelta * tdelta * p.accel[1]);
      p.pos[2] = p.startpos[2] + (tdelta * p.velocity[2]) + (tdelta * tdelta * p.accel[2]);

      if (this.pgov !== null) {
        this.pgov(p, time);
      }

      return 1;
    };

    this.pgov = null;

    if (hasColor === undef) {
      this.hasColor = false;
    } else {
      this.hasColor = hasColor;
    }

    //    gl.enable(gl.VERTEX_PROGRAM_POINT_SIZE);
    var hasTex = (this.pTex !== null);

    this.vs = [
      "#ifdef GL_ES",
      "precision mediump float;",
      "#endif",
      "attribute vec3 aVertexPosition;",
      this.hasColor ? "attribute vec3 aColor;" : "",
      "uniform mat4 uMVMatrix;",
      "uniform mat4 uPMatrix;",
      "varying vec4 color;",
      "varying vec2 screenPos;",
      hasTex ? "varying float pSize;" : "",
      "void main(void) {",
        "vec4 position = uPMatrix * uMVMatrix * vec4(aVertexPosition,1.0);",
        hasTex ? "screenPos=vec2(position.x/position.w,position.y/position.w);" : "",
        "gl_Position = position;",
        this.hasColor ? "color = vec4(aColor.r,aColor.g,aColor.b,1.0);" : "color = vec4(1.0,1.0,1.0,1.0);",
        hasTex ? "pSize=200.0/position.z;" : "float pSize=200.0/position.z;",
        "gl_PointSize = pSize;",
      "}"].join("\n");

    this.fs = [
      "#ifdef GL_ES",
      "precision mediump float;",
      "#endif",

      hasTex ? "uniform sampler2D pMap;" : "",


      "varying vec4 color;",
      hasTex ? "varying vec2 screenPos;" : "",
      hasTex ? "uniform vec3 screenDim;" : "",
      hasTex ? "varying float pSize;" : "",

      "void main(void) {",
        "vec4 c = color;",
        hasTex ? "vec2 screen=vec2((gl_FragCoord.x/screenDim.x-0.5)*2.0,(gl_FragCoord.y/screenDim.y-0.5)*2.0);" : "",
        hasTex ? "vec2 pointCoord=vec2( ((screen.x-screenPos.x)/(pSize/screenDim.x))/2.0+0.5,((screen.y-screenPos.y)/(pSize/screenDim.y))/2.0+0.5);" : "",
        hasTex ? "vec4 tc = texture2D(pMap,pointCoord); gl_FragColor = vec4(c.rgb*tc.rgb,1.0);" : "gl_FragColor = c;",
      "}"].join("\n");

    this.maxPoints = maxPts;
    this.numParticles = 0;
    this.arPoints = new Float32Array(maxPts * 3);
    this.glPoints = null;

    if (hasColor) {
      this.arColor = new Float32Array(maxPts * 3);
      this.glColor = null;
    }

    this.shader_particle = new CubicVR.Shader(this.vs, this.fs);
    this.shader_particle.use();
    this.shader_particle.addVertexArray("aVertexPosition",0);

    if (this.hasColor) {
      this.shader_particle.addVertexArray("aColor");
    }

    this.shader_particle.addMatrix("uMVMatrix");
    this.shader_particle.addMatrix("uPMatrix");

    if (this.pTex !== null) {
      this.shader_particle.addInt("pMap", 0);
      this.shader_particle.addVector("screenDim");
      this.shader_particle.setVector("screenDim", [vWidth, vHeight, 0]);
    }

    this.genBuffer();
  }


  ParticleSystem.prototype = {
    resizeView: function(vWidth, vHeight) {
      this.vWidth = vWidth;
      this.vHeight = vHeight;

      if (this.pTex !== null) {
        this.shader_particle.addVector("screenDim");
        this.shader_particle.setVector("screenDim", [vWidth, vHeight, 0]);
      }
    },


    addParticle: function(p) {
      if (this.last_particle === null) {
        this.particles = p;
        this.last_particle = p;
      } else {
        this.last_particle.nextParticle = p;
        this.last_particle = p;
      }
    },

    genBuffer: function() {
      var gl = GLCore.gl;

      this.glPoints = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
      gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);

      if (this.hasColor) {
        this.glColor = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
        gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
      }
    },

    updatePoints: function() {
      var gl = GLCore.gl;

      // buffer update
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
      gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);
      // end buffer update
    },

    updateColors: function() {
      var gl = GLCore.gl;

      if (!this.hasColor) {
        return;
      }
      // buffer update
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
      gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
      // end buffer update
    },

    draw: function(modelViewMat, projectionMat, time) {
      var gl = GLCore.gl;

      this.shader_particle.use();

      if (this.pTex !== null) {
        this.pTex.use(gl.TEXTURE0);
      }

      this.shader_particle.setMatrix("uMVMatrix", modelViewMat);
      this.shader_particle.setMatrix("uPMatrix", projectionMat);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
      gl.vertexAttribPointer(this.shader_particle.uniforms["aVertexPosition"], 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.shader_particle.uniforms["aVertexPosition"]);

      if (this.hasColor) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
        gl.vertexAttribPointer(this.shader_particle.uniforms["aColor"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader_particle.uniforms["aColor"]);
      }

      if (time !== undef) {
        this.numParticles = 0;

        if (this.particles === null) {
          gl.disable(gl.BLEND);
          return;
        }

        var p = this.particles;
        var lp = null;

        var c = 0;

        while (p !== null) {
          var ofs = this.numParticles * 3;
          var pf = this.pfunc(p, time);

          if (pf === 1) {
            this.arPoints[ofs] = p.pos[0];
            this.arPoints[ofs + 1] = p.pos[1];
            this.arPoints[ofs + 2] = p.pos[2];

            if (p.color !== null && this.arColor !== undef) {
              this.arColor[ofs] = p.color[0];
              this.arColor[ofs + 1] = p.color[1];
              this.arColor[ofs + 2] = p.color[2];
            }

            this.numParticles++;
            c++;
            if (this.numParticles === this.maxPoints) {
              break;
            }
          } else if (pf === -1) // particle death
          {
            if (lp !== null) {
              lp.nextParticle = p.nextParticle;
            }
          }
          else if (pf === 0) {
            c++;
          }

          lp = p;
          p = p.nextParticle;
        }

        if (!c) {
          this.particles = null;
          this.last_particle = null;
        }

        this.updatePoints();
        if (this.hasColor) {
          this.updateColors();
        }
      }

      if (this.alpha) {
        gl.enable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(0);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
      }

      gl.drawArrays(gl.POINTS, 0, this.numParticles);

      if (this.alpha) {
        // gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.depthMask(1);
        gl.blendFunc(gl.ONE, gl.ONE);
      }
      
      if (this.hasColor) {
        gl.disableVertexAttribArray(this.shader_particle.uniforms["aColor"]);
      }
    }
 };
    
 var extend = {
    ParticleSystem: ParticleSystem,
    Particle: Particle
  };
  
  return extend;
  
});

// experimental, single line so far
CubicVR.RegisterModule("Lines",function(base) {

  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
  

  function Lines(opt) {
    var gl = GLCore.gl;

    opt = opt||{};

    this.color = opt.color||[1.0,1.0,1.0];
    this.maxPoints = opt.maxPoints||1024;

    this.vs = [
      "#ifdef GL_ES",
      "precision mediump float;",
      "#endif",
      "attribute vec3 aVertexPosition;",
      "uniform mat4 uMVMatrix;",
      "uniform mat4 uPMatrix;",
      "void main(void) {",
        "vec4 position = uPMatrix * uMVMatrix * vec4(aVertexPosition,1.0);",
        "gl_Position = position;",
      "}"].join("\n");

    this.fs = [
      "#ifdef GL_ES",
      "precision mediump float;",
      "#endif",
      "uniform vec3 color;",
      "void main(void) {",
        "vec4 c = vec4(color,1.0);",
        "gl_FragColor = c;",
      "}"].join("\n");

    // this.maxLines = maxPts;
    // this.numLines = 0;
    this.arLines = new Float32Array(this.maxPoints * 3 * 2);
    this.glLines = null;
    this.lineLength = 0;

    this.shader_line = new CubicVR.Shader(this.vs, this.fs);
    this.shader_line.use();
    this.shader_line.addVertexArray("aVertexPosition",0);
    this.shader_line.addVector("color",this.color);

    this.shader_line.addMatrix("uMVMatrix");
    this.shader_line.addMatrix("uPMatrix");

    this.genBuffer();
    
    this.newSegment = false;
  }


  Lines.prototype = {
    genBuffer: function() {
      var gl = GLCore.gl;

      this.glLines = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glLines);
      gl.bufferData(gl.ARRAY_BUFFER, this.arLines, gl.DYNAMIC_DRAW);
    },

    update: function() {
      var gl = GLCore.gl;

      // buffer update
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glLines);
      gl.bufferData(gl.ARRAY_BUFFER, this.arLines, gl.DYNAMIC_DRAW);
      // end buffer update
    },

    addPoint: function(p) {
        var i = this.lineLength;
        
        if (i>1) {
            this.arLines[i*3] = this.arLines[(i-1)*3];
            this.arLines[i*3+1] = this.arLines[(i-1)*3+1];
            this.arLines[i*3+2] = this.arLines[(i-1)*3+2];
            this.lineLength++;
            i++;
        }
        
        this.arLines[i*3] = p[0];
        this.arLines[i*3+1] = p[1];
        this.arLines[i*3+2] = p[2];

        this.lineLength++;
    },

    addSegment: function(p) {
        var i = this.lineLength;
        this.arLines[i*3] = p[0];
        this.arLines[i*3+1] = p[1];
        this.arLines[i*3+2] = p[2];
        this.lineLength++;
    },
    
    clear: function() {
        this.lineLength = 0;  
    },

    render: function(camera) {
      var gl = GLCore.gl;

      var modelViewMat = camera.mvMatrix, projectionMat = camera.pMatrix;
      this.shader_line.use();

      this.shader_line.setMatrix("uMVMatrix", modelViewMat);
      this.shader_line.setMatrix("uPMatrix", projectionMat);
      this.shader_line.setVector("color", this.color);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.glLines);
      gl.vertexAttribPointer(this.shader_line.uniforms["aVertexPosition"], 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.shader_line.uniforms["aVertexPosition"]);

      gl.drawArrays(gl.LINES, 0, this.lineLength);
    }
 };
    
 var extend = {
    Lines: Lines
  };
  
  return extend;
  
});
