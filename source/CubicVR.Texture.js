CubicVR.RegisterModule("Texture", function (base) {

    var GLCore = base.GLCore;
    var enums = base.enums;
    var undef = base.undef;
    var log = base.log;

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

    /**
     * Check if a given width/height is Power Of Two (POT).
     */
    function checkIsPOT(w, h) {
        if (w === 1 || h === 1) {
          return false;
        } else {
            if (w !== 1) {
                while ((w % 2) === 0) {
                    w /= 2;
                }
            }
            if (h !== 1) {
                while ((h % 2) === 0) {
                    h /= 2;
                }
            }
            if (w > 1) {
                return false;
            }
            if (h > 1) {
                return false;
            }
        }

        return true;
    }

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

                    var isPOT = checkIsPOT(img.width, img.height);

                    if (isPOT) {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    } else {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    }

                    if (base.Textures_obj[texId].filterType === -1) {
                        if (!isPOT) {
                            if (filterType === enums.texture.filter.LINEAR_MIP) {
                                filterType = enums.texture.filter.LINEAR;
                            }
                        } else {
                            filterType = enums.texture.filter.LINEAR_MIP;
                        }

                        if (base.Textures_obj[texId].filterType === -1) {
                            base.Textures_obj[texId].setFilter(filterType);
                        }
                    } else {
                        base.Textures_obj[texId].setFilter(base.Textures_obj[texId].filterType);
                    }

                    if (that.onready) {
                        that.onready();
                    } //if

                    gl.bindTexture(gl.TEXTURE_2D, null);

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
            if (this.tex_id > -1 ) {
                var gl = base.GLCore.gl;

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
            }
        },

        use: function (tex_unit) {
            if (this.tex_id > -1) {
                GLCore.gl.activeTexture(tex_unit);
                GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, base.Textures[this.tex_id]);
                this.active_unit = tex_unit;
            }
        },

        clear: function () {
            if (this.tex_id > -1 && this.active_unit !== -1) {
                GLCore.gl.activeTexture(this.active_unit);
                GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, null);
                this.active_unit = -1;
            }
        },
        destroy: function() {
            var gl = base.GLCore.gl;
            if ( this.tex_id > -1 && base.Textures[this.tex_id] ) {
                gl.deleteTexture( base.Textures[this.tex_id] );
                delete base.Textures_obj[this.tex_id];
                this.tex_id = -1;
            }
        }
    };

    function CanvasTexture(options) {
        var gl = base.GLCore.gl;

        if (options.nodeName === 'CANVAS' || options.nodeName === 'IMG' || options.nodeName === 'VIDEO') {
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

        this.updateFunction = options.update;

        this.texture = new base.Texture();

        this.setFilter = this.texture.setFilter;
        this.clear = this.texture.clear;
        this.use = this.texture.use;
        this.tex_id = this.texture.tex_id;
        this.filterType = this.texture.filterType;

        var c = this.canvasSource;
    
        if (!c.height || !c.width) {
            log("Warning - CanvasTexture input has no initial width and height, edges clamped.");
        }

        if (!c.height || !c.width || !checkIsPOT(c.width, c.height)) {
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
            var gl = base.GLCore.gl;
            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvasSource);
            if (this.filterType === enums.texture.filter.LINEAR_MIP) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        } //CanvasTexture.update
    };

    /**
     * PdfTexture takes a pdf.js Page object, and uses it as the basis for a texture.
     * PdfTexture is meant to be used in conjunction with base.PDF, which takes care
     * of loading/rendering PDF page objects.
     **/
    function PdfTexture(page, options) {
        if (!page) {
            throw("PDF Texture Error: page is null.");
        }

        var self = this,
            gl = base.GLCore.gl,
            canvas = this.canvasSource = document.createElement('canvas'),
            ctx;

        canvas.mozOpaque = true;
        // TODO: need to deal with non-POT sizes
        canvas.width = options.width;
        canvas.height = options.height;

        ctx = this.canvasContext = canvas.getContext('2d');
        ctx.save();
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        var pdfViewport = options.viewport || page.getViewport(1);

        pdfViewport.width = canvas.width;
        pdfViewport.height = canvas.height;

        var renderContext = {
          canvasContext: ctx,
          viewport: pdfViewport,
          //textLayer: textLayer,
          continueCallback: function pdfViewcContinueCallback(cont) {
            cont();
          }
        };

        page.render(renderContext).then(function(){
            self.update();
        });

        this.texture = new base.Texture();

        this.updateFunction = options.update || function() {};
        this.setFilter = this.texture.setFilter;
        this.clear = this.texture.clear;
        this.use = this.texture.use;
        this.tex_id = this.texture.tex_id;
        this.filterType = this.texture.filterType;

        if (!checkIsPOT(canvas.width, canvas.height)) {
            this.setFilter(enums.texture.filter.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            this.setFilter(enums.texture.filter.LINEAR_MIP);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }
    }

    PdfTexture.prototype = {
        update: function () {
            this.updateFunction(this.canvasSource, this.canvasContext);

            var gl = base.GLCore.gl;
            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvasSource);
            if (this.filterType === enums.texture.filter.LINEAR_MIP) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
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
        var util = base.util;
        var gl = base.GLCore.gl;
        this.texture = new base.Texture();
        this.canvas = document.createElement("CANVAS");
        this.canvas.width = width;
        this.canvas.height = height;

        // this assumes processing is already included..
        this.pjs = new Processing(this.canvas, base.util.getURL(pjsURL));
        this.pjs.noLoop();
        this.pjs.redraw();

        // bind functions to "subclass" a texture
        this.setFilter = this.texture.setFilter;
        this.clear = this.texture.clear;
        this.use = this.texture.use;
        this.tex_id = this.texture.tex_id;
        this.filterType = this.texture.filterType;


        if (!checkIsPOT(this.canvas.width, this.canvas.height)) {
            this.setFilter(enums.texture.filter.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            this.setFilter(enums.texture.filter.LINEAR_MIP);
        }
    }

    PJSTexture.prototype = {
        update: function () {
            var gl = base.GLCore.gl;

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
        this.outTex = new base.RenderBuffer(width, height);

        var isPOT = checkIsPOT(width, height),
          vTexel = [1.0 / width, 1.0 / height, 0];

        // buffers
        this.outputBuffer = new base.RenderBuffer(width, height, false);

        // quads
        this.fsQuad = base.fsQuad.make(width, height);

        var vs = ["attribute vec3 aVertex;", "attribute vec2 aTex;", "varying vec2 vTex;", "void main(void)", "{", "  vTex = aTex;", "  vec4 vPos = vec4(aVertex.xyz,1.0);", "  gl_Position = vPos;", "}"].join("\n");

        // simple convolution test shader
        shaderNMap = new base.Shader(vs, ["#ifdef GL_ES", "precision highp float;", "#endif", "uniform sampler2D srcTex;", "varying vec2 vTex;", "uniform vec3 texel;", "void main(void)", "{", " vec3 color;", " color.r = (texture2D(srcTex,vTex + vec2(texel.x,0)).r-texture2D(srcTex,vTex + vec2(-texel.x,0)).r)/2.0 + 0.5;", " color.g = (texture2D(srcTex,vTex + vec2(0,-texel.y)).r-texture2D(srcTex,vTex + vec2(0,texel.y)).r)/2.0 + 0.5;", " color.b = 1.0;", " gl_FragColor.rgb = color;", " gl_FragColor.a = 1.0;", "}"].join("\n"));

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

            base.fsQuad.render(this.shaderNorm, this.fsQuad); // copy the output buffer to the screen via fullscreen quad
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            gl.viewport(dims[0], dims[1], dims[2], dims[3]);
        }
    };

    function RenderTexture(width, height, depth) {
        var gl = GLCore.gl;

        this.width = width;
        this.height = height;
        this.outTex = new base.RenderBuffer(width, height, depth);
        this.texture = this.outTex.texture;

        var isPOT = checkIsPOT(width, height);

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
        PdfTexture: PdfTexture,
        TextTexture: TextTexture,
        PJSTexture: PJSTexture,
        NormalMapGen: NormalMapGen,
        RenderTexture: RenderTexture,
        SceneRenderTexture: SceneRenderTexture
    };

    return extend;
});


CubicVR.RegisterModule("DrawBufferTexture", function (base) {

    var GLCore = base.GLCore;
    var enums = base.enums;
    var undef = base.undef;
    var log = base.log;

    // Drawing Enums
    enums.draw = {
        brush: {
            SINE: 0,
            SQUARE: 1
        },
        op: {
            ADD: 0,
            REPLACE: 1,
            SUBTRACT: 2,
            MULTIPLY: 3
        }
    };
    
    var DrawBufferBrush = function(opt) {
        opt = opt || {};
        
        this.operation = base.parseEnum(enums.draw.op,opt.operation||opt.op)||enums.draw.op.REPLACE;
        this.brushType = base.parseEnum(enums.draw.brush,opt.brushType)||enums.draw.brush.SINE;
        this.brushSize = opt.size||5;
        this.color = opt.color||[255,255,255,255];
    };
    
    DrawBufferBrush.prototype = {
        setOperation: function(brushOperation) {
            this.operation = base.parseEnum(enums.draw.op,brushOperation);
        },
        getOperation: function() {
            return this.operation;
        },
        setBrushType: function(brushType) {
            this.brushType = base.parseEnum(enums.draw.brush,brushType)||enums.draw.brush.SINE;
        },
        getBrushType: function() {
            return this.brushType;
        },
        setSize: function(brushSize) {
            this.brushSize = brushSize;
        },
        getSize: function() {
            return this.brushSize;
        },
        setColor: function(color) {
            this.color = color;
        },
        getColor: function() {
            return this.color.slice(0);
        }
    };
    
    var DrawBufferTexture = base.extendClassGeneral(base.Texture, function() {
        var opt = arguments[0]||{};

        // temporary
        var img_path = opt.image;
        var filter_type = opt.filter;
        var deferred_bin = opt.deferred_bin;
        var binId = opt.binId;
        var ready_func = opt.readyFunc;
        // end temp..

        base.Texture.apply(this,[img_path, filter_type, deferred_bin, binId, ready_func]);

        this.width = opt.width||0;
        this.height = opt.height||0;
        this.imageBuffer = null;
        this.imageBufferData = null;
        this.brush = opt.brush||new DrawBufferBrush();
        // this.imageBufferFloatData = null;
        this.drawBuffer = [];

        if (this.width && this.height) {
            this.setupImageBuffer(this.width,this.height);
        }
        

    },{ // DrawBufferTexture functions
        getUint8Buffer: function() {
            return this.imageBuffer;  
        },
        needsFlush: function() {
            return this.drawBuffer.length!==0;
        },
        getWidth: function() {
            return this.width;
        },
        getHeight: function() {
            return this.height;
        },
        setupImageBuffer: function () {
            this.imageBufferData = new ArrayBuffer(this.width*this.height*4);
            this.imageBuffer = new Uint8Array(this.imageBufferData);
            this.update();
            // this.imageBufferFloatData = new Float32Array(this.imageBufferData); 
        },
        setBrush: function(brush) {
            this.brush = brush;
        },
        getBrush: function() {
            return this.brush;
        },
        draw: function(x,y,brush_in) {
            var brush = brush_in||this.brush;
            var op = brush.getOperation();
            var size = brush.getSize();
            var btype = brush.getBrushType();
            var color = brush.getColor();
            
            this.drawBuffer.push([x,y,op,size,btype,color]);            
        },
        flush: function() {
          if (!this.drawBuffer.length) {
              return false;
          }
          while (this.drawBuffer.length) {
              var ev = this.drawBuffer.pop();
              
              this.drawFunc(ev[0],ev[1],ev[2],ev[3],ev[4],ev[5]);
          }
          return true;
        },
        drawFunc: function(x,y,op,size,btype,color) {
            var imageData = this.imageBuffer;
            var width = this.width;
            var height = this.height;
            
            for (var i = parseInt(Math.floor(x),10) - size; i < parseInt(Math.ceil(x),10) + size; i++) {
                var dx = i-x, dy;
                for (var j = parseInt(Math.floor(y),10) - size; j < parseInt(Math.ceil(y),10) + size; j++) {
                    if (i < 0 || i >= width || j < 0 || j >= height) continue;
                    dy = j - y;
                    
                    var val;
                    
                    if (btype === 0) { // SINE
                        val = ((1.0 - Math.sqrt(dx * dx + dy * dy) / (size)) / 2.0);
                    }

                    var idx = (j * width + i)*4;

                    // todo: implement other than just replace..
                    if (op === 0) { // ADD 
                        if (val < 0) val = 0;
                    } else if (op === 1) { // REPLACE
                        if (val < 0) val = 0;
                    } else if (op === 2) { // SUBTRACT
                        val = -val;
                        if (val > 0) val = 0;
                    } 
                    // else if (op === 3) { // MULTIPLY                        
                    // }

                    var r = Math.floor(imageData[idx]*(1.0-val)+color[0]*val);
                    var g = Math.floor(imageData[idx+1]*(1.0-val)+color[1]*val);
                    var b = Math.floor(imageData[idx+2]*(1.0-val)+color[2]*val);
                    var a = Math.floor(imageData[idx+3]*(1.0-val)+color[3]*val);

                    if (r > 255) { r = 255; } else if (r < 0) { r = 0; }
                    if (g > 255) { g = 255; } else if (g < 0) { g = 0; }
                    if (b > 255) { b = 255; } else if (b < 0) { b = 0; }
                    if (a > 255) { a = 255; } else if (a < 0) { a = 0; }

                    imageData[idx] = r;
                    imageData[idx+1] = g;
                    imageData[idx+2] = b;
                    imageData[idx+3] = a;
                }
            }
        },
        // clear: function() {
        //   
        //     function draw_rgba_clear(imageData, width, height, color, x, y, sz, h) {
        //         for (var i = x - w; i < x + w; i++) {
        //             var dx = i - x, dy;
        // 
        //             for (var j = y - h; j < y + h; j++) {
        //                 var idx = (j * width + i) * 4;
        //                 hfBuffer[idx] = 0;
        //                 hfBuffer[idx+1] = 0;
        //                 hfBuffer[idx+2] = 0;
        //                 hfBuffer[idx+3] = 0;
        //             }
        //         }
        //     }
        //   
        // },
        update: function() {
            var gl = GLCore.gl;

            this.flush();
            
            // gl.disable(gl.BLEND);
            // gl.blendFunc(gl.ONE,gl.ONE);
            gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.tex_id]);
            
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.imageBuffer);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }        
    });


    var extend = {
        DrawBufferTexture: DrawBufferTexture,
        DrawBufferBrush: DrawBufferBrush
    };

    return extend;
});
