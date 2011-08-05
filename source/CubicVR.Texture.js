CubicVR.RegisterModule("Texture", function (base) {

    var GLCore = base.GLCore;
    var enums = CubicVR.enums;
    var undef = base.undef;

    // Texture Types
    enums.texture = {
        map: {
            COLOR: 0,
            ENVSPHERE: 1,
            NORMAL: 2,
            BUMP: 3,
            REFLECT: 4,
            SPECULAR: 5,
            AMBIENT: 6,
            ALPHA: 7,
            MAX: 8
        },
        filter: {
            LINEAR: 0,
            LINEAR_MIP: 1,
            NEAREST: 2,
            NEAREST_MIP: 3
        }
    };

    /* Textures */
    var DeferredLoadTexture = function (img_path, filter_type) {
            this.img_path = img_path;
            this.filter_type = filter_type;
        }; //DefferedLoadTexture
        DeferredLoadTexture.prototype = {
            getTexture: function (deferred_bin, binId) {
                return new Texture(this.img_path, this.filter_type, deferred_bin, binId);
            } //getTexture
        };

    var Texture = function (img_path, filter_type, deferred_bin, binId, ready_func) {
            var gl = GLCore.gl;

            this.tex_id = base.Textures.length;
            this.filterType = -1;
            this.onready = ready_func;
            this.loaded = false;
            base.Textures[this.tex_id] = gl.createTexture();
            base.Textures_obj[this.tex_id] = this;

            if (img_path) {
                if (typeof (img_path) === 'string') {
                    base.Images[this.tex_id] = new Image();
                } else if (typeof (img_path) === 'object' && img_path.nodeName === 'IMG') {
                    base.Images[this.tex_id] = img_path;
                } //if
                base.Textures_ref[img_path] = this.tex_id;
            }

            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.tex_id]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

            if (img_path) {
                var texId = this.tex_id;
                var filterType = (filter_type !== undef) ? filter_type : GLCore.default_filter;

                var that = this;

                base.Images[this.tex_id].onload = function (e) {
                    gl.bindTexture(gl.TEXTURE_2D, base.Textures[texId]);

                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

                    var img = base.Images[texId];

                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

                    var tw = img.width,
                        th = img.height;

                    var isPOT = true;

                    if (tw === 1 || th === 1) {
                        isPOT = false;
                    } else {
                        if (tw !== 1) {
                            while ((tw % 2) === 0) {
                                tw /= 2;
                            }
                        }
                        if (th !== 1) {
                            while ((th % 2) === 0) {
                                th /= 2;
                            }
                        }
                        if (tw > 1) {
                            isPOT = false;
                        }
                        if (th > 1) {
                            isPOT = false;
                        }
                    }

                    if (!isPOT) {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    }

                    if (base.Textures_obj[texId].filterType === -1) {
                        if (!isPOT) {
                            if (filterType === enums.texture.filter.LINEAR_MIP) {
                                filterType = enums.texture.filter.LINEAR;
                            }
                        }

                        if (base.Textures_obj[texId].filterType === -1) {
                            base.Textures_obj[texId].setFilter(filterType);
                        }
                    } else {
                        base.Textures_obj[texId].setFilter(base.Textures_obj[texId].filterType);
                    }

                    gl.bindTexture(gl.TEXTURE_2D, null);

                    if (that.onready) {
                        that.onready();
                    } //if
                    that.loaded = true;
                };

                if (!deferred_bin) {
                    if (typeof (img_path) === 'string') {
                        base.Images[this.tex_id].src = img_path;
                    } //if
                } else {
                    base.Images[this.tex_id].deferredSrc = img_path;
                    //console.log('adding image to binId=' + binId + ' img_path=' + img_path);
                    deferred_bin.addImage(binId, img_path, base.Images[this.tex_id]);
                }
            }

            this.active_unit = -1;
        };

    Texture.prototype = {
        setFilter: function (filterType) {
            var gl = CubicVR.GLCore.gl;

            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.tex_id]);

            if (filterType === enums.texture.filter.LINEAR) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            } else if (filterType === enums.texture.filter.LINEAR_MIP) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.generateMipmap(gl.TEXTURE_2D);
            } else if (filterType === enums.texture.filter.NEAREST) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            } else if (filterType === enums.texture.filter.NEAREST_MIP) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
                gl.generateMipmap(gl.TEXTURE_2D);
            }

            this.filterType = filterType;
        },

        use: function (tex_unit) {
            GLCore.gl.activeTexture(tex_unit);
            GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, base.Textures[this.tex_id]);
            this.active_unit = tex_unit;
        },

        clear: function () {
            if (this.active_unit !== -1) {
                GLCore.gl.activeTexture(this.active_unit);
                GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, null);
                this.active_unit = -1;
            }
        }
    };

    function CanvasTexture(options) {
        var gl = CubicVR.GLCore.gl;

        if (options.nodeName === 'CANVAS' || options.nodeName === 'IMG') {
            this.canvasSource = options;
        } else {
            this.canvasSource = document.createElement('CANVAS');
            if (options.width === undefined || options.height === undefined) {
                throw new Error('Width and height must be specified for generating a new CanvasTexture.');
            } //if
            this.canvasSource.width = options.width;
            this.canvasSource.height = options.height;
            this.canvasContext = this.canvasSource.getContext('2d');
        } //if
        var c = this.canvasSource,
            tw = c.width,
            th = c.height;

        var isPOT = true;

        if (tw === 1 || th === 1) {
            isPOT = false;
        } else {
            if (tw !== 1) {
                while ((tw % 2) === 0) {
                    tw /= 2;
                }
            }
            if (th !== 1) {
                while ((th % 2) === 0) {
                    th /= 2;
                }
            }
            if (tw > 1) {
                isPOT = false;
            }
            if (th > 1) {
                isPOT = false;
            }
        }

        this.updateFunction = options.update;

        this.texture = new CubicVR.Texture();

        this.setFilter = this.texture.setFilter;
        this.clear = this.texture.clear;
        this.use = this.texture.use;
        this.tex_id = this.texture.tex_id;
        this.filterType = this.texture.filterType;

        if (!isPOT) {
            this.setFilter(enums.texture.filter.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            this.setFilter(enums.texture.filter.LINEAR_MIP);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }

        if (options.nodeName === 'IMG') {
            this.update();
        } //if
    } //CanvasTexture
    
    CanvasTexture.prototype = {
        update: function () {
            if (this.updateFunction) {
                this.updateFunction(this.canvasSource, this.canvasContext);
            } //if
            var gl = CubicVR.GLCore.gl;
            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvasSource);
            if (this.filterType === enums.texture.filter.LINEAR_MIP) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        } //CanvasTexture.update
    };

    function TextTexture(text, options) {
        var color = (options && options.color) || '#fff';
        var bgcolor = (options && options.bgcolor);
        var font = (options && options.font) || '18pt Arial';
        var align = (options && options.align) || 'start';
        var y = (options && options.y) || 0;
        var width = (options && options.width) || undef;
        var height = (options && options.height) || undef;
        var i;
        var canvas = document.createElement('CANVAS');
        var ctx = canvas.getContext('2d');
        var x;
        var lines = 0;
        if (typeof (text) === 'string') {
            lines = 1;
        } else {
            lines = text.length;
        } //if
        ctx.font = font;

        // This approximation is awful. There has to be a better way to find the height of a text block
        var lineHeight = (options && options.lineHeight) || ctx.measureText('OO').width;
        var widest;
        if (lines === 1) {
            widest = ctx.measureText(text).width;
        } else {
            widest = 0;
            for (i = 0; i < lines; ++i) {
                var w = ctx.measureText(text[i]).width;
                if (w > widest) {
                    widest = w;
                } //if
            } //for
        } //if
        canvas.width = width || widest;
        canvas.height = height || lineHeight * lines;

        if (bgcolor) {
            ctx.fillStyle = bgcolor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } //if
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'top';
        if (lines === 1) {
            x = (options && options.x) || align === 'center' ? canvas.width / 2 : align === 'right' ? canvas.width : 0;
            ctx.fillText(text, x, y);
        } else {
            for (i = 0; i < lines; ++i) {
                x = (options && options.x) || align === 'center' ? canvas.width / 2 : align === 'right' ? canvas.width : 0;
                ctx.fillText(text[i], x, y + i * lineHeight);
            } //for
        } //if
        ctx.fill();

        this.use = CanvasTexture.prototype.use;
        this.clear = CanvasTexture.prototype.clear;
        this.update = CanvasTexture.prototype.update;
        CanvasTexture.apply(this, [canvas]);

        this.update();
        this.canvasSource = canvas = ctx = null;
    } //TextTexture

    function PJSTexture(pjsURL, width, height) {
        var util = CubicVR.util;
        var gl = CubicVR.GLCore.gl;
        this.texture = new CubicVR.Texture();
        this.canvas = document.createElement("CANVAS");
        this.canvas.width = width;
        this.canvas.height = height;

        // this assumes processing is already included..
        this.pjs = new Processing(this.canvas, CubicVR.util.getURL(pjsURL));
        this.pjs.noLoop();
        this.pjs.redraw();

        var tw = this.canvas.width,
            th = this.canvas.height;

        var isPOT = true;

        if (tw === 1 || th === 1) {
            isPOT = false;
        } else {
            if (tw !== 1) {
                while ((tw % 2) === 0) {
                    tw /= 2;
                }
            }
            if (th !== 1) {
                while ((th % 2) === 0) {
                    th /= 2;
                }
            }
            if (tw > 1) {
                isPOT = false;
            }
            if (th > 1) {
                isPOT = false;
            }
        }

        // bind functions to "subclass" a texture
        this.setFilter = this.texture.setFilter;
        this.clear = this.texture.clear;
        this.use = this.texture.use;
        this.tex_id = this.texture.tex_id;
        this.filterType = this.texture.filterType;


        if (!isPOT) {
            this.setFilter(enums.texture.filter.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            this.setFilter(enums.texture.filter.LINEAR_MIP);
        }
    }

    PJSTexture.prototype = {
        update: function () {
            var gl = CubicVR.GLCore.gl;

            this.pjs.redraw();

            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);

            if (this.filterType === enums.texture.filter.LINEAR_MIP) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }

            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    };


    function NormalMapGen(inTex, width, height) {
        var gl = GLCore.gl;

        this.width = width;
        this.height = height;
        this.srcTex = inTex;
        this.outTex = new CubicVR.RenderBuffer(width, height);

        var tw = width,
            th = height;

        var isPOT = true;

        if (tw === 1 || th === 1) {
            isPOT = false;
        } else {
            if (tw !== 1) {
                while ((tw % 2) === 0) {
                    tw /= 2;
                }
            }
            if (th !== 1) {
                while ((th % 2) === 0) {
                    th /= 2;
                }
            }
            if (tw > 1) {
                isPOT = false;
            }
            if (th > 1) {
                isPOT = false;
            }
        }

        var vTexel = [1.0 / width, 1.0 / height, 0];

        // buffers
        this.outputBuffer = new CubicVR.RenderBuffer(width, height, false);

        // quads
        this.fsQuad = CubicVR.fsQuad.make(width, height);

        var vs = ["attribute vec3 aVertex;", "attribute vec2 aTex;", "varying vec2 vTex;", "void main(void)", "{", "  vTex = aTex;", "  vec4 vPos = vec4(aVertex.xyz,1.0);", "  gl_Position = vPos;", "}"].join("\n");


        // simple convolution test shader
        shaderNMap = new CubicVR.Shader(vs, ["#ifdef GL_ES", "precision highp float;", "#endif", "uniform sampler2D srcTex;", "varying vec2 vTex;", "uniform vec3 texel;", "void main(void)", "{", " vec3 color;", " color.r = (texture2D(srcTex,vTex + vec2(texel.x,0)).r-texture2D(srcTex,vTex + vec2(-texel.x,0)).r)/2.0 + 0.5;", " color.g = (texture2D(srcTex,vTex + vec2(0,-texel.y)).r-texture2D(srcTex,vTex + vec2(0,texel.y)).r)/2.0 + 0.5;", " color.b = 1.0;", " gl_FragColor.rgb = color;", " gl_FragColor.a = 1.0;", "}"].join("\n"));

        shaderNMap.use();
        shaderNMap.addUVArray("aTex");
        shaderNMap.addVertexArray("aVertex");
        shaderNMap.addInt("srcTex", 0);
        shaderNMap.addVector("texel");
        shaderNMap.setVector("texel", vTexel);

        this.shaderNorm = shaderNMap;

        // bind functions to "subclass" a texture
        this.setFilter = this.outputBuffer.texture.setFilter;
        this.clear = this.outputBuffer.texture.clear;
        this.use = this.outputBuffer.texture.use;
        this.tex_id = this.outputBuffer.texture.tex_id;
        this.filterType = this.outputBuffer.texture.filterType;

        this.outTex.use(gl.TEXTURE0);
        // 
        // if (!isPOT) {
        //    this.setFilter(enums.texture.filter.LINEAR);
        //    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        //    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);    
        //  } else {
        this.setFilter(enums.texture.filter.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        //  }
    }

    NormalMapGen.prototype = {
        update: function () {
            var gl = GLCore.gl;

            var dims = gl.getParameter(gl.VIEWPORT);

            this.outputBuffer.use();

            gl.viewport(0, 0, this.width, this.height);

            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            this.srcTex.use(gl.TEXTURE0);

            CubicVR.fsQuad.render(this.shaderNorm, this.fsQuad); // copy the output buffer to the screen via fullscreen quad
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            gl.viewport(dims[0], dims[1], dims[2], dims[3]);
        }
    };

    function RenderTexture(width, height, depth) {
        var gl = GLCore.gl;

        this.width = width;
        this.height = height;
        this.outTex = new CubicVR.RenderBuffer(width, height, depth);
        this.texture = this.outTex.texture;

        var tw = width,
            th = height;

        var isPOT = true;

        if (tw === 1 || th === 1) {
            isPOT = false;
        } else {
            if (tw !== 1) {
                while ((tw % 2) === 0) {
                    tw /= 2;
                }
            }
            if (th !== 1) {
                while ((th % 2) === 0) {
                    th /= 2;
                }
            }
            if (tw > 1) {
                isPOT = false;
            }
            if (th > 1) {
                isPOT = false;
            }
        }

        // bind functions to "subclass" a texture
        this.setFilter = this.outTex.texture.setFilter;
        this.clear = this.outTex.texture.clear;
        this.use = this.outTex.texture.use;
        this.tex_id = this.outTex.texture.tex_id;
        this.filterType = this.outTex.texture.filterType;

        this.texture.use(gl.TEXTURE0);
        
        if (!isPOT) {
            this.setFilter(enums.texture.filter.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);    
        } else {
            this.setFilter(enums.texture.filter.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }
       
        this.dims = [width,height];
        this.depth = depth?true:false;
    }


    RenderTexture.prototype = {
        begin: function () {
            var gl = GLCore.gl;
            this.dims = gl.getParameter(gl.VIEWPORT);

            this.outTex.use();

            gl.viewport(0, 0, this.width, this.height);
            
            if (this.depth) {
              gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
            } else {
              gl.clear(gl.COLOR_BUFFER_BIT);
            }
        },
        end: function() {
            var gl = GLCore.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(this.dims[0], this.dims[1], this.dims[2], this.dims[3]);
        }
    };

    function SceneRenderTexture(scene,camera) {
      this.scene = scene;
      this.renderTex = new RenderTexture(camera?camera.width:scene.camera.width,camera?camera.height:scene.camera.height,true);
      
      // bind functions to "subclass" a texture
      this.setFilter = this.renderTex.texture.setFilter;
      this.clear = this.renderTex.texture.clear;
      this.use = this.renderTex.texture.use;
      this.tex_id = this.renderTex.texture.tex_id;
      this.filterType = this.renderTex.texture.filterType;      
    }
    
    SceneRenderTexture.prototype = {
      update: function() {
        this.renderTex.begin();
        this.scene.updateShadows();
        this.scene.render();
        this.renderTex.end();
      }
    };


    var extend = {
        Texture: Texture,
        DeferredLoadTexture: DeferredLoadTexture,
        CanvasTexture: CanvasTexture,
        TextTexture: TextTexture,
        PJSTexture: PJSTexture,
        NormalMapGen: NormalMapGen,
        RenderTexture: RenderTexture,
        SceneRenderTexture: SceneRenderTexture
    };

    return extend;
});
