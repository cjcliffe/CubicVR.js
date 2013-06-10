CubicVR.RegisterModule("Camera", function (base) {
    /*jshint es5:true */
    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;


    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

    var cameraUUID = 0;

    function Camera(width, height, fov, nearclip, farclip) {
        var mat4 = base.mat4;
        this.frustum = new base.Frustum();
        this.classType = base.enums.classType.CAMERA;
        if (typeof (width) == 'object') {
            var obj_init = width;
        
            this.position = obj_init.position || [0, 0, -1];
            this.rotation = obj_init.rotation || [0, 0, 0];
            this.target = obj_init.target || [0, 0, 0];
            this.fov = obj_init.fov || 60.0;
            this.nearclip = (obj_init.nearclip || obj_init.nearClip || obj_init.near || 0.1);
            this.farclip = (obj_init.farclip || obj_init.farClip || obj_init.far || 400.0);
            this.targeted = (obj_init.targeted !== undef) ? obj_init.targeted : true;
            this.calc_nmatrix = (obj_init.calcNormalMatrix !== undef) ? obj_init.calcNormalMatrix : true;
            this.name = obj_init.name || ("camera" + cameraUUID);
            
            height = obj_init.height ? obj_init.height : undef;
            width = obj_init.width ? obj_init.width : undef;
        } else {
            this.position = [0, 0, 0];
            this.rotation = [0, 0, 0];
            this.target = [0, 0, 0];
            this.fov = (fov !== undef) ? fov : 60.0;
            this.nearclip = (nearclip !== undef) ? nearclip : 0.1;
            this.farclip = (farclip !== undef) ? farclip : 400.0;
            this.targeted = true;
            this.calc_nmatrix = true;
            this.name = "camera" + cameraUUID;
        }

        this.targetSceneObject = null;
        this.motion = null;
        this.transform = new base.Transform();

        this.manual = false;

        this.setDimensions((width !== undef) ? width : 512, (height !== undef) ? height : 512);

        this.mvMatrix = mat4.identity();
        this.pMatrix = null;
        this.calcProjection();

        this.ortho = false;
        this.ortho_view = {
            left: -1,
            right: 1,
            bottom: -1,
            top: 1
        };
        this.parent = null;
        ++cameraUUID;
    }

    Camera.prototype = {
        get x(){
            return this.position[0];
        },
        set x(value){
            this.position[0] = value;
        },
        get y(){
            return this.position[1];
        },
        set y(value){
            this.position[1] = value;
        },
        get z(){
            return this.position[2];
        },
        set z(value){
            this.position[2] = value;
        },
        get rotX(){
            return this.rotation[0];
        },
        set rotX(value){
            this.rotation[0] = value;
        },
        get rotY(){
            return this.rotation[1];
        },
        set rotY(value){
            this.rotation[1] = value;
        },
        get rotZ(){
            return this.rotation[2];
        },
        set rotZ(value){
            this.rotation[2] = value;
        },
        get targetX(){
            return this.target[0];
        },
        set targetX(value){
            this.target[0] = value;
        },
        get targetY(){
            return this.target[1];
        },
        set targetY(value){
            this.target[1] = value;
        },
        get targetZ(){
            return this.target[2];
        },
        set targetZ(value){
            this.target[2] = value;
        },
        get pos(){
            return this.position.slice(0);
        },        
        set pos(value){
            this.position = value.slice(0);
        },
        get rot(){
            return this.rotation.slice(0);
        },        
        set rot(value){
            this.rotation = value.slice(0);
        },
        
        trackTarget: function(targetPos, speed, safeDist) {
          this.position = base.vec3.trackTarget(this.position,targetPos,speed,safeDist);
        },
    
        setParent: function(camParent) {
          this.parent = camParent;
        },
        
        hasParent: function() {
          return !!this.parent;
        },
        
        getParent: function() {
          return this.parent;           
        },
        
        getParentedPosition: function() {
          if (this.parent !== null && this.mvMatrix && this.parent.tMatrix) {                
            return base.mat4.vec3_multiply(this.position,this.parent.tMatrix);
          } else {
            return this.position;            
          }
        },
    
        setOrtho: function (left, right, bottom, top) {
            this.ortho = true;
            this.ortho_view.left = left;
            this.ortho_view.right = right;
            this.ortho_view.bottom = bottom;
            this.ortho_view.top = top;
        },

        control: function (controllerId, motionId, value) {
            if (controllerId === enums.motion.ROT) {
                this.rotation[motionId] = value;
            } else if (controllerId === enums.motion.POS) {
                this.position[motionId] = value;
            } else if (controllerId === enums.motion.FOV) {
                this.setFOV(value);
            } else if (controllerId === enums.motion.LENS) {
                this.setLENS(value);
            } else if (controllerId === enums.motion.NEARCLIP) {
                this.setClip(value, this.farclip);
            } else if (controllerId === enums.motion.FARCLIP) {
                this.setClip(this.nearclip, value);
            }
        },

        makeFrustum: function (left, right, bottom, top, zNear, zFar) {
            var A = (right + left) / (right - left);
            var B = (top + bottom) / (top - bottom);
            var C = -(zFar + zNear) / (zFar - zNear);
            var D = -2.0 * zFar * zNear / (zFar - zNear);

            return [2.0 * zNear / (right - left), 0.0, 0.0, 0.0, 0.0, 2.0 * zNear / (top - bottom), 0.0, 0.0, A, B, C, -1.0, 0.0, 0.0, D, 0.0];
        },


        setTargeted: function (targeted) {
            this.targeted = targeted;
        },

        calcProjection: function () {
            var mat4 = base.mat4;
            var mat3 = base.mat3;
            var vec3 = base.vec3;
            var gl = GLCore.gl;

            if (this.ortho) {
                this.pMatrix = mat4.ortho(this.ortho_view.left, this.ortho_view.right, this.ortho_view.bottom, this.ortho_view.top, this.nearclip, this.farclip);
            } else {
                this.pMatrix = mat4.perspective(this.fov, this.aspect, this.nearclip, this.farclip);
            }

            if (!this.targeted && this.mvMatrix) {
                mat4.identity(this.mvMatrix);

                mat4.rotate(-this.rotation[0],-this.rotation[1],-this.rotation[2], this.mvMatrix);
                mat4.translate(-this.position[0], -this.position[1], -this.position[2], this.mvMatrix);

                if (this.parent) {                
                  mat4.multiply(this.mvMatrix.slice(0),mat4.inverse(this.parent.tMatrix),this.mvMatrix);
                }

                if (this.calc_nmatrix) {
                    this.nMatrix = mat4.inverse_mat3(this.mvMatrix);
                    mat3.transpose_inline(this.nMatrix);
                } else {
                    mat4.identity(this.nMatrix);
                }
            }

            this.frustum.extract(this, this.mvMatrix, this.pMatrix);
        },

        setClip: function (nearclip, farclip) {
            this.nearclip = nearclip;
            this.farclip = farclip;
            this.calcProjection();
        },

        setDimensions: function (width, height) {
            this.width = width;
            this.height = height;

            this.aspect = width / height;
            this.calcProjection();
        },

        setAspect: function (aspect) {
            this.aspect = aspect;
            this.calcProjection();
        },

        resize: function (width, height) {
            this.setDimensions(width, height);
        },

        setFOV: function (fov) {
            this.fov = fov;
            this.ortho = false;
            this.calcProjection();
        },

        setLENS: function (lens) {
            this.setFOV(2.0 * Math.atan(16.0 / lens) * (180.0 / Math.PI));
        },

        lookat: function (eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
            var mat4 = base.mat4;
            var mat3 = base.mat3;

            if (typeof (eyeX) == 'object') {
                this.lookat(this.position[0], this.position[1], this.position[2], eyeX[0], eyeX[1], eyeX[2], 0, 1, 0);
                return;
            }

            this.mvMatrix = mat4.lookat(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ);

            if (this.rotation[2]) {
                this.transform.clearStack();
                this.transform.rotate(-this.rotation[2], 0, 0, 1);
                this.transform.pushMatrix(this.mvMatrix);
                this.mvMatrix = this.transform.getResult();
            }

            if (this.parent !== null) {                
              mat4.multiply(this.mvMatrix.slice(0),mat4.inverse(this.parent.tMatrix),this.mvMatrix);
            }

            if (this.calc_nmatrix) {
                this.nMatrix = mat4.inverse_mat3(this.mvMatrix);
                mat3.transpose_inline(this.nMatrix);
            } else {
                this.nMatrix = cubicvr_identity;
            }

            this.frustum.extract(this, this.mvMatrix, this.pMatrix);
        },

        unProject: function (winx, winy, winz) {
            var mat4 = base.mat4;
            var vec3 = base.vec3;

            //    var tmpClip = this.nearclip;
            //    if (tmpClip < 1.0) { this.nearclip = 1.0; this.calcProjection(); }
            var viewport = [0, 0, this.width, this.height];

            var p = [(((winx - viewport[0]) / (viewport[2])) * 2) - 1, -((((winy - viewport[1]) / (viewport[3])) * 2) - 1), 1, 1.0];

            var invp = mat4.vec4_multiply(mat4.vec4_multiply(p, mat4.inverse(this.pMatrix)), mat4.inverse(this.mvMatrix));

            //    if (tmpClip < 1.0) { this.nearclip = tmpClip; this.calcProjection(); }
            var result = [invp[0] / invp[3], invp[1] / invp[3], invp[2] / invp[3]];
            
            if (winz !== undef) {
              var pos = this.getParentedPosition();
              return vec3.add(pos,vec3.multiply(vec3.normalize(vec3.subtract(result,pos)),winz));
            }
            
            return result;
        },

        project: function (objx, objy, objz) {
            var mat4 = base.mat4;

            var p = [objx, objy, objz, 1.0];

            var mp = mat4.vec4_multiply(mat4.vec4_multiply(p, this.mvMatrix), this.pMatrix);
            
            // depth hack, not sure why this broke..
            mp[2] = base.vec3.length(base.vec3.subtract([objx,objy,objz],this.position));

            return [((mp[0] / mp[3] + 1.0) / 2.0) * this.width, ((-mp[1] / mp[3] + 1.0) / 2.0) * this.height, mp[2]];
        }
    };


    /*** Auto-Cam Prototype ***/

    function AutoCameraNode(pos) {
        this.position = (pos !== undef) ? pos : [0, 0, 0];
    }

    AutoCameraNode.prototype = {
      control: function (controllerId, motionId, value) {
          if (controllerId === enums.motion.POS) {
              this.position[motionId] = value;
          }
      }
    };

    function AutoCamera(start_position, target, bounds) {
        this.camPath = new base.Motion();
        this.targetPath = new base.Motion();

        this.start_position = (start_position !== undef) ? start_position : [8, 8, 8];
        this.target = (target !== undef) ? target : [0, 0, 0];

        this.bounds = (bounds !== undef) ? bounds : [
            [-15, 3, -15],
            [15, 20, 15]
        ];

        this.safe_bb = [];
        this.avoid_sphere = [];

        this.segment_time = 3.0;
        this.buffer_time = 20.0;
        this.start_time = 0.0;
        this.current_time = 0.0;

        this.path_time = 0.0;
        this.path_length = 0;

        this.min_distance = 2.0;
        this.max_distance = 40.0;

        this.angle_min = 40;
        this.angle_max = 180;
    }


    AutoCamera.prototype = {

        inBounds: function (pt) {
            var vec3 = base.vec3;
            if (!(pt[0] > this.bounds[0][0] && pt[1] > this.bounds[0][1] && pt[2] > this.bounds[0][2] && pt[0] < this.bounds[1][0] && pt[1] < this.bounds[1][1] && pt[2] < this.bounds[1][2])) {
                return false;
            }

            for (var i = 0, iMax = this.avoid_sphere.length; i < iMax; i++) {
                var l = vec3.length(pt, this.avoid_sphere[i][0]);
                if (l < this.avoid_sphere[i][1]) {
                    return false;
                }
            }

            return true;
        },

        findNextNode: function (aNode, bNode) {
            var vec3 = base.vec3;
            var d = [this.bounds[1][0] - this.bounds[0][0], this.bounds[1][1] - this.bounds[0][1], this.bounds[1][2] - this.bounds[0][2]];

            var nextNodePos = [0, 0, 0];
            var randVector = [0, 0, 0];
            var l = 0.0;
            var loopkill = 0;
            var valid = false;

            do {
                randVector[0] = Math.random() - 0.5;
                randVector[1] = Math.random() - 0.5;
                randVector[2] = Math.random() - 0.5;

                randVector = vec3.normalize(randVector);

                var r = Math.random();

                l = (r * (this.max_distance - this.min_distance)) + this.min_distance;

                nextNodePos = vec3.add(bNode.position, vec3.multiply(randVector, l));

                valid = this.inBounds(nextNodePos);

                loopkill++;

                if (loopkill > 30) {
                    nextNodePos = bNode.position;
                    break;
                }
            } while (!valid);

            return nextNodePos;
        },

        run: function (timer) {
            this.current_time = timer;

            if (this.path_time === 0.0) {
                this.path_time = this.current_time;

                this.camPath.setKey(enums.motion.POS, enums.motion.X, this.path_time, this.start_position[0]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Y, this.path_time, this.start_position[1]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Z, this.path_time, this.start_position[2]);
            }

            while (this.path_time < this.current_time + this.buffer_time) {
                this.path_time += this.segment_time;

                var tmpNodeA = new AutoCameraNode();
                var tmpNodeB = new AutoCameraNode();

                if (this.path_length) {
                    this.camPath.apply(this.path_time - (this.segment_time * 2.0), tmpNodeA);
                }

                this.camPath.apply(this.path_time - this.segment_time, tmpNodeB);

                var nextPos = this.findNextNode(tmpNodeA, tmpNodeB);

                this.camPath.setKey(enums.motion.POS, enums.motion.X, this.path_time, nextPos[0]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Y, this.path_time, nextPos[1]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Z, this.path_time, nextPos[2]);

                this.path_length++;
            }

            var tmpNodeC = new AutoCameraNode();

            this.camPath.apply(timer, tmpNodeC);

            return tmpNodeC.position;
        },

        addSafeBound: function (min, max) {
            this.safe_bb.push([min, max]);
        },

        addAvoidSphere: function (center, radius) {
            this.avoid_sphere.push([center, radius]);
        }
    };

    var exports = {
        Camera: Camera,
        AutoCamera: AutoCamera
    };

    return exports;
});


CubicVR.RegisterModule("StereoCameraRig", function (base) {
    /*jshint es5:true */
    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;

    enums.stereo = {
        mode: {
            STEREO:1,
            RIFT:2,
            TWOCOLOR:3,
            INTERLACE:4
        }
    };

    var StereoCameraRig = function(opt) {
        opt = opt || {};
        camera = opt.camera||null;
        var canvas = base.getCanvas();

        this.eyeSpacing = opt.eyeSpacing||(6/10);
        this.mode = base.parseEnum(enums.stereo.mode,opt.mode||1);
        this.doubleBuffer = false;
        this.leftColor = [0,0,1];
        this.rightColor = [1,0,0];
        
        this.eyeWarpEnabled = opt.eyeWarp;
        
        if (!camera || !(camera instanceof base.Camera)) {
            throw "StereoCameraRig Error: camera not provided?";
        }
        
        this.fov = opt.fov||camera.fov;

        this.camLeft = new base.Camera({
            fov: this.fov,
            aspect: this.aspect,  // 110 horizontal, 90 vertical?
            targeted: camera.targeted
        });

        this.camRight = new base.Camera({
            fov: this.fov,
            aspect: this.aspect,  // 110 horizontal, 90 vertical?
            targeted: camera.targeted
        });

        if (camera.parent) {
            this.camLeft.setParent(camera.parent);
            this.camRight.setParent(camera.parent);
        }

        this.camera = camera;

        this.fxChain = opt.fxChain||opt.fxChainA||new base.PostProcessChain(canvas.width, canvas.height, false);
        this.fxChainB = opt.fxChainB||null;
        
        base.addResizeable(this.fxChain);
        if (this.fxChainB) {
            base.addResizeable(this.fxChainB);
        }
        
        var vertexGeneral = [
            "attribute vec3 aVertex;",
            "attribute vec2 aTex;",
            "varying vec2 vTex;",

            "void main(void)",
            "{",
                "vTex = aTex;",
                "vec4 vPos = vec4(aVertex.xyz,1.0);",
                "gl_Position = vPos;",
            "}"
        ].join("\n");
        
        /*
             Rift Shader Warning: this shader likely isn't even close to proper and certainly isn't anything 
             official it's just a rough assumption based on watching the kickstarter video segment with 
             a clear view of the display output.
             
             So please feel free to correct if you get yours before I do ;)
        */
        var fragmentEyeWarp = [
            "#ifdef GL_ES",
            "precision mediump float;",
            "#endif",

            "uniform sampler2D srcTex;",
            "varying vec2 vTex;",

            "void main()",
            "{",
                "vec2 uv = vTex;",
                "uv.x *= 2.0;",
                "if (uv.x>1.0) {",
                    "uv.x -= 1.0;",
                "}",

                "vec2 cen = vec2(0.5,0.5) - uv.xy;",
                "if (length(cen)>0.5) discard;",
                "vec2 mcen = -0.02*tan(length(cen)*3.14)*(cen);",
                "uv += mcen;",

                "if (uv.x>1.0||uv.x<0.0||uv.y>1.0||uv.y<0.0) discard;",
                "uv.x /= 2.0;",
                "if (vTex.x > 0.5) {",
                    "uv.x+=0.5;",
                "}",

                "gl_FragColor = texture2D(srcTex, uv);",
            "}"
        ].join("\n");
        
        var fragmentTwoColor = [
            "#ifdef GL_ES",
            "precision mediump float;",
            "#endif",

            "uniform sampler2D srcTex;",
            "uniform sampler2D rightTex;",
            "varying vec2 vTex;",
            "uniform vec3 leftColor;",
            "uniform vec3 rightColor;",

            "void main()",
            "{",
                "vec3 leftSample = texture2D(srcTex, vTex).rgb;",
                "vec3 rightSample = texture2D(rightTex, vTex).rgb;",
                
                "leftSample.rgb = vec3((leftSample.r+leftSample.g+leftSample.b)/3.0);",
                "rightSample.rgb = vec3((rightSample.r+rightSample.g+rightSample.b)/3.0);",
                
                "gl_FragColor = vec4(leftSample.rgb*leftColor+rightSample.rgb*rightColor,1.0);",
            "}"
        ].join("\n");

        var fragmentInterlace = [
            "#ifdef GL_ES",
            "precision mediump float;",
            "#endif",

            "uniform sampler2D srcTex;",
            "varying vec2 vTex;",
            "uniform vec3 texel;",

            "void main()",
            "{",
                "vec2 uv = vTex;",
                
                "uv.y *= 0.5;",
                
                "if (mod(floor(vTex.y/texel.y),2.0)==0.0) {",
                    "uv.y+=0.5;",
                "}",
                
                "gl_FragColor = texture2D(srcTex, uv);",
            "}"
        ].join("\n");
        
        this.shaderEyeWarp = new base.PostProcessShader({
            shader_vertex: vertexGeneral,
            shader_fragment: fragmentEyeWarp,
            outputMode: "replace",
            enabled: false
        });


        this.shaderTwoColor = new base.PostProcessShader({
            shader_vertex: vertexGeneral,
            shader_fragment: fragmentTwoColor,
            outputMode: "replace",
            enabled: false,
            init: function(shader) {
              shader.addInt("rightTex", 2);
              shader.addVector("leftColor", this.leftColor);
              shader.addVector("rightColor", this.rightColor);
            }                                            
           });
        
        this.shaderInterlace = new base.PostProcessShader({
            shader_vertex: vertexGeneral,
            shader_fragment: fragmentInterlace,
            outputMode: "replace",
            enabled: false
        });

        this.fxChain.addShader(this.shaderEyeWarp);
        this.fxChain.addShader(this.shaderTwoColor);
        this.fxChain.addShader(this.shaderInterlace);

        this.aspect = opt.aspect;
        if (!this.aspect) {
            if (this.mode == enums.stereo.mode.STEREO) {
                this.aspect = ((canvas.width/2)/canvas.height);
            } else {
                this.aspect = (canvas.width/canvas.height);
            }
        }

        this.setMode({mode:this.mode});
    };
    
    StereoCameraRig.prototype = {
        setMode: function(opt) {
            opt = opt||{mode:1};
            this.mode = base.parseEnum(enums.stereo.mode,opt.mode);
            fov = opt.fov || this.fov;
            aspect = opt.aspect || this.aspect;
            this.leftColor = opt.leftColor||this.leftColor;
            this.rightColor = opt.rightColor||this.rightColor;
            
            switch (this.mode) {
                // stereo: single buffer, split
                case enums.stereo.mode.STEREO:
                    this.setDoubleBuffer(false);
                    this.setEyeWarp(false);
                    this.setInterlace(false);
                    this.setTwoColor(false);
                break;
                // rift: single buffer, split + deform
                case enums.stereo.mode.RIFT:
                    aspect = (110/90);
                    fov = (110);

                    this.setDoubleBuffer(false);
                    this.setEyeWarp(true);
                    this.setInterlace(false);
                    this.setTwoColor(false);
                break;
                // twocolor: two buffer, full eye each + blending
                case enums.stereo.mode.TWOCOLOR:
                    this.setDoubleBuffer(true);
                    this.setEyeWarp(false);
                    this.setInterlace(false);
                    this.setTwoColor(true);
                    this.shaderTwoColor.shader.use();
                    this.shaderTwoColor.shader.setVector("leftColor", this.leftColor);
                    this.shaderTwoColor.shader.setVector("rightColor", this.rightColor);

                break;
                // interlace single buffer, top/bottom
                case enums.stereo.mode.INTERLACE:
                    this.setDoubleBuffer(false);
                    this.setEyeWarp(false);
                    this.setInterlace(true);
                    this.setTwoColor(false);
                break;
            }
            
            this.camLeft.setAspect(aspect);
            this.camLeft.setFOV(fov);
            this.camLeft.setTargeted(this.camera.targeted);

            this.camRight.setAspect(aspect);
            this.camRight.setFOV(fov);
            this.camRight.setTargeted(this.camera.targeted);

        },
        getMode: function() {
            return this.mode;  
        },
        setupCameras: function() {
            var cam = this.camera;
            var vec3 = base.vec3;
        
            this.camLeft.rot = cam.rot;
            this.camRight.rot = cam.rot;
             
            var camTarget = cam.unProject(cam.farclip);
            
            this.camLeft.pos = cam.pos;
            this.camRight.pos = cam.pos;

            if (this.camera.targeted) {
                this.camLeft.position = base.vec3.moveViewRelative(this.camera.position,this.camera.target,-this.eyeSpacing/2.0,0);
                this.camRight.position = base.vec3.moveViewRelative(this.camera.position,this.camera.target,this.eyeSpacing/2.0,0);

                this.camLeft.target = base.vec3.moveViewRelative(this.camera.position,this.camera.target,-this.eyeSpacing/2.0,0,this.camera.target);
                this.camRight.target = base.vec3.moveViewRelative(this.camera.position,this.camera.target,this.eyeSpacing/2.0,0,this.camera.target);
            } else {
                this.camLeft.position[0] -= this.eyeSpacing/2.0;
                this.camRight.position[0] += this.eyeSpacing/2.0;
            }

            if (!this.camera.parent && !this.camera.targeted) {
               var transform = base.mat4.transform(base.vec3.subtract([0,0,0],this.camera.position),this.camera.rotation);
               this.camLeft.parent = { tMatrix: transform };
               this.camRight.parent = { tMatrix: transform };
            }            
        },
    
        renderScene: function(scene) {
            this.setupCameras();
            
            var cam = this.camera;
            var canvas = base.getCanvas();
            var fxChain = this.fxChain;
            var fxChainB = this.fxChainB;
            var gl = base.GLCore.gl;

            var half_width = canvas.width/2;
            var half_height = canvas.height/2;
            var height = canvas.height;
            var width = canvas.width;
            
            this.shaderEyeWarp.enabled = this.eyeWarpEnabled;
            this.shaderTwoColor.enabled = this.twoColorEnabled;
            this.shaderInterlace.enabled = this.interlaceEnabled;
                                    
            
            if (this.twoColorEnabled && fxChainB) {

                fxChain.begin();

                // -----
                gl.viewport(0,0,width,height);
                
                gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT);

                scene.render({camera:this.swapEyes?this.camRight:this.camLeft});

                fxChain.end();
                
                fxChainB.begin();
                
                gl.viewport(0,0,width,height);

                gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT);

                scene.render({camera:this.swapEyes?this.camLeft:this.camRight});

                fxChainB.end();

                gl.viewport(0,0,width,height);
                // -----
                
                fxChainB.captureBuffer.texture.use(gl.TEXTURE2);
                
                fxChain.render();

            } else {
                fxChain.begin();
                // -----
                gl.viewport(0,0,width,height);

                gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT);

                if (this.interlaceEnabled) {
                    gl.viewport(0,0,width,half_height);
                } else {
                    gl.viewport(0,0,half_width,height);
                }
                
                scene.render({camera:this.swapEyes?this.camRight:this.camLeft});

                if (this.interlaceEnabled) {
                    gl.viewport(0,half_height,width,half_height);
                } else {
                    gl.viewport(half_width,0,half_width,height);
                }
                scene.render({camera:this.swapEyes?this.camLeft:this.camRight});

                fxChain.end();

                gl.viewport(0,0,width,height);
                // -----
                fxChain.render();
            }


        },
        
        setEyeWarp: function(bVal) {
            this.eyeWarpEnabled = bVal;
        },
        
        getEyeWarp: function() {
            return this.eyeWarpEnabled;
        },
        
        setSwapEyes: function(bVal) {
            this.swapEyes = bVal;
        },
        
        getSwapEyes: function() {
            return this.swapEyes;
        },
        
        setDoubleBuffer: function(bVal) {
            if (!this.fxChainB) {
                var canvas = base.getCanvas();
                this.fxChainB = new base.PostProcessChain(canvas.width, canvas.height, false);
                base.addResizeable(this.fxChainB);
            }
            this.doubleBuffer = bVal;
        },
        
        getDoubleBuffer: function() {
            return this.doubleBuffer;
        },
        
        setTwoColor: function(bVal) {
            this.twoColorEnabled = bVal;
        },
        
        getTwoColor: function() {
            return this.twoColorEnabled;
        },
        
        setInterlace: function(bVal) {
            this.interlaceEnabled = bVal;
        },
        
        getInterlace: function() {
            return this.interlaceEnabled;
        },
        
        addUI: function() {
        
            var ui = document.createElement("div");
            ui.style.position="absolute";
            ui.style.top = "10px"; 
            ui.style.left = "10px";
            ui.style.color = "white";
            ui.style.zIndex = 1000;

            ui.appendChild(document.createTextNode("Mode:"));

            var opts = document.createElement("select");
            opts.options[0] = new Option("Oculus Rift Untested","rift");
            opts.options[1] = new Option("Split Stereo","stereo");
            opts.options[2] = new Option("Red/Blue Stereo","redblue");
            opts.options[3] = new Option("Red/Green Stereo","redgreen");
            opts.options[4] = new Option("Interlaced","interlace");
            opts.selectedIndex = 0;
            ui.appendChild(opts);

            ui.appendChild(document.createTextNode(" Swap Eyes:"));

            var swapEyes = document.createElement("input");
            swapEyes.type = 'checkbox';
            swapEyes.value = '1';
            ui.appendChild(swapEyes);
            document.body.appendChild(ui);
        
            var cbSwapEyesElem = swapEyes;
            var selModeElem = opts;

            selModeElem.selectedIndex = 0;
            
            var context = this;
            
            cbSwapEyesElem.addEventListener("change",function() {
                context.setSwapEyes(this.checked);
            },true);

            selModeElem.addEventListener("change",function() {
                var mode = this.options[this.selectedIndex].value;
                var canvas = base.getCanvas();
                
                switch (mode) {
                    case "rift":
                        context.setMode({
                            mode: "rift"
                        });
                    break;
                    case "stereo":
                        context.setMode({
                            mode: "stereo",
                            fov: 60,
                            aspect: ((canvas.width/2)/canvas.height)
                        });
                    break;
                    case "redblue":
                        context.setMode({
                            mode: "twocolor",
                            leftColor: [0,0,1],
                            rightColor: [1,0,0],
                            fov: 60,
                            aspect: canvas.width/canvas.height
                        });
                    break;
                    case "redgreen":
                        context.setMode({
                            mode: "twocolor",
                            leftColor: [0,1,0],
                            rightColor: [1,0,0],
                            fov: 60,
                            aspect: canvas.width/canvas.height
                        });
                    break;
                    case "interlace":
                        context.setMode({
                            mode: "interlace",
                            leftColor: [0,1,0],
                            rightColor: [1,0,0],
                            fov: 60,
                            aspect: canvas.width/canvas.height
                        });
                    break;
                }
                
            },true);
        }                    
    };
    
    var exports = {
        StereoCameraRig: StereoCameraRig
    };

    return exports;
});

