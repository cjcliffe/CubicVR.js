CubicVR.RegisterModule("Layout", function (base) {

    var undef = base.undef;
    var GLCore = base.GLCore;

    function View(obj_init) {

        this.texture = obj_init.texture ? obj_init.texture : null;
        this.width = obj_init.width ? obj_init.width : 128;
        this.height = obj_init.height ? obj_init.height : 128;
        this.x = obj_init.x ? obj_init.x : 0;
        this.y = obj_init.y ? obj_init.y : 0;
        this.blend = obj_init.blend ? obj_init.blend : false;
        this.opacity = (typeof (obj_init.opacity) !== 'undefined') ? obj_init.opacity : 1.0;
        this.tint = obj_init.tint ? obj_init.tint : [1.0, 1.0, 1.0];

        this.type = 'view';

        this.superView = null;
        this.childViews = [];
        this.panel = null;
    }

    View.prototype = {
        addSubview: function (view) {
            this.childViews.push(view);
            //  this.superView.makePanel(view);
            view.superView = this;
        },

        makePanel: function (view) {
            return this.superView.makePanel(view);
        }
    };

    function Layout(obj_init) {

        this.texture = obj_init.texture ? obj_init.texture : null;
        this.width = obj_init.width ? obj_init.width : 128;
        this.height = obj_init.height ? obj_init.height : 128;
        this.x = obj_init.x ? obj_init.x : 0;
        this.y = obj_init.y ? obj_init.y : 0;
        this.blend = obj_init.blend ? obj_init.blend : false;
        this.opacity = (typeof (obj_init.opacity) !== 'undefined') ? obj_init.opacity : 1.0;
        this.tint = obj_init.tint ? obj_init.tint : [1.0, 1.0, 1.0];

        this.type = 'root';

        this.superView = null;
        this.childViews = [];
        this.setupShader();

        this.panel = null;
        this.makePanel(this);
    }

    Layout.prototype = {
        resize: function(w,h) {
            this.width = w;
            this.height = h;
        },
        setupShader: function () {
            this.shader = new CubicVR.PostProcessShader({
                shader_vertex: [
                  "attribute vec3 aVertex;", 
                  "attribute vec2 aTex;", 
                  "varying vec2 vTex;", 
                  "uniform vec3 screen;", 
                  "uniform vec3 position;", 
                  "uniform vec3 size;", 
                  "void main(void) {", 
                    "vTex = aTex;", 
                    "vec4 vPos = vec4(aVertex.xyz,1.0);", 
                    "vPos.x *= size.x/screen.x;", 
                    "vPos.y *= size.y/screen.y;", 
                    "vPos.x += (size.x/screen.x);", 
                    "vPos.y -= (size.y/screen.y);", 
                    "vPos.x += (position.x/screen.x)*2.0 - 1.0;", "vPos.y -= (position.y/screen.y)*2.0 - 1.0;", 
                    "gl_Position = vPos;", 
                  "}"
                ].join("\n"),
                shader_fragment: [
                  "#ifdef GL_ES", 
                    "precision mediump float;", 
                  "#endif", 
                  "uniform sampler2D srcTex;", 
                  "uniform vec3 tint;", 
                  "varying vec2 vTex;", 
                  "void main(void) {", 
                    "vec4 color = texture2D(srcTex, vTex)*vec4(tint,1.0);",
                  // "if (color.a == 0.0) discard;",
                    "gl_FragColor = color;", 
                  "}"
                ].join("\n"),
                init: function (shader) {
                    shader.setInt("srcTex", 0);
                    shader.addVector("screen");
                    shader.addVector("position");
                    shader.addVector("tint");
                    shader.addVector("size");
                }
            });
        },

        addSubview: function (view) {
            this.childViews.push(view);
            //  this.makePanel(view);
            view.superView = this;
        },

        removeSubview: function (view) {
            var idx = this.childViews.indexOf(view);
            if (idx > -1 ) {
              this.childViews.splice(idx, 1);
            }
        },

        makePanel: function (view) {
            var gl = CubicVR.GLCore.gl;
            var pQuad = {}; // intentional empty object
            pQuad.vbo_points = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0]);
            pQuad.vbo_uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1]);

            pQuad.gl_points = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, pQuad.gl_points);
            gl.bufferData(gl.ARRAY_BUFFER, pQuad.vbo_points, gl.STATIC_DRAW);

            pQuad.gl_uvs = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, pQuad.gl_uvs);
            gl.bufferData(gl.ARRAY_BUFFER, pQuad.vbo_uvs, gl.STATIC_DRAW);

            view.panel = pQuad;
        },


        renderPanel: function (view, panel) {
            var gl = CubicVR.GLCore.gl;

            if (!view.texture) {
                return false;
            }

            view.texture.use(gl.TEXTURE0);
        },

        renderView: function (view) {
            if (!view.texture) return;

            var gl = CubicVR.GLCore.gl;

            var offsetLeft = view.offsetLeft;
            var offsetTop = view.offsetTop;

            if (!offsetLeft) offsetLeft = 0;
            if (!offsetTop) offsetTop = 0;

            var shader = this.shader.shader;

            shader.use();
            shader.setVector("screen", [this.width, this.height, 0]);
            shader.setVector("position", [view.x + offsetLeft, view.y + offsetTop, 0]);
            shader.setVector("size", [view.width, view.height, 0]);
            shader.setVector("tint", view.tint);

            if (view.blend) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }

            view.texture.use(gl.TEXTURE0);

            //  this.renderPanel(view,this.panel);        
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            if (view.blend) {
                gl.disable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ZERO);
            }
        },

        render: function () {
            var gl = CubicVR.GLCore.gl;

            gl.disable(gl.DEPTH_TEST);

            if (this.texture) this.renderView(this);

            var stack = [];
            var framestack = [];

            this.offsetLeft = 0;
            this.offsetTop = 0;
            stack.push(this);


            var shader = this.shader.shader;
            shader.use();

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.panel.gl_points);
            gl.vertexAttribPointer(shader.uniforms["aVertex"], 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shader.uniforms["aVertex"]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.panel.gl_uvs);
            gl.vertexAttribPointer(shader.uniforms["aTex"], 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shader.uniforms["aTex"]);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            while (stack.length) {
                var view = stack.pop();

                this.renderView(view);

                if (view.childViews.length) {
                    for (var i = view.childViews.length - 1, iMin = 0; i >= iMin; i--) {
                        view.childViews[i].offsetLeft = view.x + view.offsetLeft;
                        view.childViews[i].offsetTop = view.y + view.offsetTop;
                        stack.push(view.childViews[i]);
                    }
                }

            }

            gl.disableVertexAttribArray(shader.uniforms["aTex"]);

            gl.enable(gl.DEPTH_TEST);
        }
    };

    var extend = {
        Layout: Layout,
        View: View
    };

    return extend;
});
