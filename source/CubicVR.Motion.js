CubicVR.RegisterModule("Motion", function (base) {

    var undef = base.undef;
    var enums = base.enums;

    enums.motion = {
        POS: 0,
        ROT: 1,
        SCL: 2,
        POSITION: 0,
        ROTATION: 1,
        SCALE: 2,
        FOV: 3,
        LENS: 4,
        NEARCLIP: 5,
        FARCLIP: 6,
        INTENSITY: 7,
        X: 0,
        Y: 1,
        Z: 2,
        V: 3
    };

    enums.envelope = {
        shape: {
            TCB: 0,
            HERM: 1,
            BEZI: 2,
            LINE: 3,
            STEP: 4,
            BEZ2: 5
        },
        behavior: {
            RESET: 0,
            CONSTANT: 1,
            REPEAT: 2,
            OSCILLATE: 3,
            OFFSET: 4,
            LINEAR: 5
        }
    };

    var cubicvr_env_range = function (v, lo, hi) {
            var v2, i = 0,
                r;

            r = hi - lo;

            if (r === 0.0) {
                return [lo, 0];
            }

            v2 = v - r * Math.floor((v - lo) / r);

            i = -parseInt((v2 - v) / r + (v2 > v ? 0.5 : -0.5), 10);

            return [v2, i];
        };

    var cubicvr_env_hermite = function (t) {
            var h1, h2, h3, h4;
            var t2, t3;

            t2 = t * t;
            t3 = t * t2;

            h2 = 3.0 * t2 - t3 - t3;
            h1 = 1.0 - h2;
            h4 = t3 - t2;
            h3 = h4 - t2 + t;

            return [h1, h2, h3, h4];
        };

    var cubicvr_env_bezier = function (x0, x1, x2, x3, t) {
            var a, b, c, t2, t3;

            t2 = t * t;
            t3 = t2 * t;

            c = 3.0 * (x1 - x0);
            b = 3.0 * (x2 - x1) - c;
            a = x3 - x0 - c - b;

            return a * t3 + b * t2 + c * t + x0;
        };

    var cubicvr_env_bez2_time = function (x0, x1, x2, x3, time, t0, t1) {

            var v, t;

            t = t0 + (t1 - t0) * 0.5;
            v = cubicvr_env_bezier(x0, x1, x2, x3, t);
            if (Math.abs(time - v) > 0.0001) {
                if (v > time) {
                    t1 = t;
                } else {
                    t0 = t;
                }
                return cubicvr_env_bez2_time(x0, x1, x2, x3, time, t0, t1);
            } else {
                return t;
            }
        };

    var cubicvr_env_bez2 = function (key0, key1, time) {
            var x, y, t, t0 = 0.0,
                t1 = 1.0;

            if (key0.shape === enums.envelope.shape.BEZ2) {

                x = key0.time + key0.param[2];
            } else {
                x = key0.time + (key1.time - key0.time) / 3.0;
            }

            t = cubicvr_env_bez2_time(key0.time, x, key1.time + key1.param[0], key1.time, time, t0, t1);

            if (key0.shape === enums.envelope.shape.BEZ2) {
                y = key0.value + key0.param[3];
            } else {
                y = key0.value + key0.param[1] / 3.0;
            }

            return cubicvr_env_bezier(key0.value, y, key1.param[1] + key1.value, key1.value, t);
        };

    var cubicvr_env_outgoing = function (key0, key1) {
            var a, b, d, t, out;

            if (key0.shape === enums.envelope.shape.TCB) {
                a = (1.0 - key0.tension) * (1.0 + key0.continuity) * (1.0 + key0.bias);
                b = (1.0 - key0.tension) * (1.0 - key0.continuity) * (1.0 - key0.bias);
                d = key1.value - key0.value;

                if (key0.prev) {
                    t = (key1.time - key0.time) / (key1.time - (key0.prev).time);
                    out = t * (a * (key0.value - (key0.prev).value) + b * d);
                } else {
                    out = b * d;
                }
            } else if (key0.shape === enums.envelope.shape.LINE) {
                d = key1.value - key0.value;
                if (key0.prev) {
                    t = (key1.time - key0.time) / (key1.time - (key0.prev).time);
                    out = t * (key0.value - (key0.prev).value + d);
                } else {
                    out = d;
                }
            } else if ((key0.shape === enums.envelope.shape.BEZI) || (key0.shape === enums.envelope.shape.HERM)) {
                out = key0.param[1];
                if (key0.prev) {
                    out *= (key1.time - key0.time) / (key1.time - (key0.prev).time);
                }
            } else if (key0.shape === enums.envelope.shape.BEZ2) {
                out = key0.param[3] * (key1.time - key0.time);
                if (Math.abs(key0.param[2]) > 1e-5) {
                    out /= key0.param[2];
                } else {
                    out *= 1e5;
                }
            } else if (key0.shape === enums.envelope.shape.STEP) {
                out = 0.0;
            } else {
                out = 0.0;
            }

            return out;
        };

    var cubicvr_env_incoming = function (key0, key1) {
            var a, b, d, t, inval;

            if (key1.shape === enums.envelope.shape.LINE) {
                d = key1.value - key0.value;
                if (key1.next) {
                    t = (key1.time - key0.time) / ((key1.next).time - key0.time);
                    inval = t * ((key1.next).value - key1.value + d);
                } else {
                    inval = d;
                }
            } else if (key1.shape === enums.envelope.shape.TCB) {
                a = (1.0 - key1.tension) * (1.0 - key1.continuity) * (1.0 + key1.bias);
                b = (1.0 - key1.tension) * (1.0 + key1.continuity) * (1.0 - key1.bias);
                d = key1.value - key0.value;

                if (key1.next) {
                    t = (key1.time - key0.time) / ((key1.next).time - key0.time);
                    inval = t * (b * ((key1.next).value - key1.value) + a * d);
                } else {
                    inval = a * d;
                }
            } else if ((key1.shape === enums.envelope.shape.HERM) || (key1.shape === enums.envelope.shape.BEZI)) {
                inval = key1.param[0];
                if (key1.next) {
                    inval *= (key1.time - key0.time) / ((key1.next).time - key0.time);
                }
            } else if (key1.shape === enums.envelope.shape.BEZ2) {
                inval = key1.param[1] * (key1.time - key0.time);
                if (Math.abs(key1.param[0]) > 1e-5) {
                    inval /= key1.param[0];
                } else {
                    inval *= 1e5;
                }
            } else if (key1.shape === enums.envelope.shape.STEP) {
                inval = 0.0;
            } else {
                inval = 0.0;
            }

            return inval;
        };


    function EnvelopeKey() {
        this.value = 0;
        this.time = 0;
        this.shape = enums.envelope.shape.TCB;
        this.tension = 0;
        this.continuity = 0;
        this.bias = 0;
        this.prev = null;
        this.next = null;

        this.param = [0, 0, 0, 0];
    }

    function Envelope(obj_init) {
        this.nKeys = 0;
        this.keys = null;
        this.firstKey = null;
        this.lastKey = null;

        if (obj_init) {
            this.in_behavior = base.parseEnum(enums.envelope.behavior,obj_init.in_behavior||obj_init.inBehavior||obj_init.behavior) || enums.envelope.behavior.CONSTANT;
            this.out_behavior = base.parseEnum(enums.envelope.behavior,obj_init.out_behavior||obj_init.outBehavior||obj_init.behavior) || enums.envelope.behavior.CONSTANT;
        } else {
            this.in_behavior = enums.envelope.behavior.CONSTANT;
            this.out_behavior = enums.envelope.behavior.CONSTANT;
        }
    }

    Envelope.prototype = {
        setBehavior: function (in_b, out_b) {
            this.in_behavior = base.parseEnum(enums.envelope.behavior,in_b);
            this.out_behavior = base.parseEnum(enums.envelope.behavior,out_b);
        },

        empty: function () {
            return (this.nKeys === 0);
        },

        addKey: function (time, value, key_init) {
            var tempKey;

            var obj = (typeof (time) == 'object') ? time : key_init;

            if (!value) value = 0;
            if (!time) time = 0;

            if (obj) {
                obj = time;
                time = obj.time;

                tempKey = this.insertKey(time);

                tempKey.value = obj.value ? obj.value : value;
                tempKey.time = obj.time ? obj.time : time;
                tempKey.shape = base.parseEnum(enums.envelope.shape,obj.shape) || enums.envelope.shape.TCB;
                tempKey.tension = obj.tension ? obj.tension : 0;
                tempKey.continuity = obj.continuity ? obj.continuity : 0;
                tempKey.bias = obj.bias ? obj.bias : 0;
                tempKey.param = obj.param ? obj.param : [0, 0, 0, 0];

            } else {
                tempKey = this.insertKey(time);
                tempKey.value = value;
            }


            return tempKey;
        },

        insertKey: function (time) {
            var tempKey = new EnvelopeKey();

            tempKey.time = time;
            if (!this.nKeys) {
                this.keys = tempKey;
                this.firstKey = tempKey;
                this.lastKey = tempKey;
                this.nKeys++;

                return tempKey;
            }

            var k1 = this.keys;

            while (k1) {
                // update first/last key
                if (this.firstKey.time > time) {
                    this.firstKey = tempKey;
                } else if (this.lastKey.time < time) {
                    this.lastKey = tempKey;
                }

                if (k1.time > tempKey.time) {
                    tempKey.prev = k1.prev;
                    if (tempKey.prev) {
                        tempKey.prev.next = tempKey;
                    }

                    tempKey.next = k1;
                    tempKey.next.prev = tempKey;

                    this.nKeys++;

                    return tempKey;
                } else if (!k1.next) {
                    tempKey.prev = k1;
                    k1.next = tempKey;

                    this.nKeys++;

                    return tempKey;
                }

                k1 = k1.next;
            }

            return null; // you should not be here, time and space has imploded
        },

        evaluate: function (time) {
            var key0, key1, skey, ekey;
            var t, h1, h2, h3, h4, inval, out, offset = 0.0;
            var noff;

            /* if there's no key, the value is 0 */
            if (this.nKeys === 0) {
                return 0.0;
            }

            /* if there's only one key, the value is constant */
            if (this.nKeys === 1) {
                return (this.keys).value;
            }

            /* find the first and last keys */
            skey = this.firstKey;
            ekey = this.lastKey;

            var tmp, behavior;

            /* use pre-behavior if time is before first key time */
            if (time < skey.time) {
                behavior = this.in_behavior;

                if (behavior === enums.envelope.behavior.RESET) {
                    return 0.0;
                } else if (behavior === enums.envelope.behavior.CONSTANT) {
                    return skey.value;
                } else if (behavior === enums.envelope.behavior.REPEAT) {
                    tmp = cubicvr_env_range(time, skey.time, ekey.time);
                    time = tmp[0];
                } else if (behavior === enums.envelope.behavior.OCILLATE) {
                    tmp = cubicvr_env_range(time, skey.time, ekey.time);
                    time = tmp[0];
                    noff = tmp[1];

                    if (noff % 2) {
                        time = ekey.time - skey.time - time;
                    }
                } else if (behavior === enums.envelope.behavior.OFFSET) {
                    tmp = cubicvr_env_range(time, skey.time, ekey.time);
                    time = tmp[0];
                    noff = tmp[1];
                    offset = noff * (ekey.value - skey.value);
                } else if (behavior === enums.envelope.behavior.LINEAR) {
                    out = cubicvr_env_outgoing(skey, skey.next) / (skey.next.time - skey.time);
                    return out * (time - skey.time) + skey.value;
                }

            }

            /* use post-behavior if time is after last key time */
            else if (time > ekey.time) {
                behavior = this.out_behavior;

                if (behavior === enums.envelope.behavior.RESET) {
                    return 0.0;
                } else if (behavior === enums.envelope.behavior.CONSTANT) {
                    return ekey.value;
                } else if (behavior === enums.envelope.behavior.REPEAT) {
                    tmp = cubicvr_env_range(time, skey.time, ekey.time);
                    time = tmp[0];
                } else if (behavior === enums.envelope.behavior.OCILLATE) {
                    tmp = cubicvr_env_range(time, skey.time, ekey.time);
                    time = tmp[0];
                    noff = tmp[1];

                    if (noff % 2) {
                        time = ekey.time - skey.time - time;
                    }
                } else if (behavior === enums.envelope.behavior.OFFSET) {
                    tmp = cubicvr_env_range(time, skey.time, ekey.time);
                    time = tmp[0];
                    noff = tmp[1];
                    offset = noff * (ekey.value - skey.value);
                } else if (behavior === enums.envelope.behavior.LINEAR) {
                    inval = cubicvr_env_incoming(ekey.prev, ekey) / (ekey.time - ekey.prev.time);
                    return inval * (time - ekey.time) + ekey.value;
                }
            }

            // get the endpoints of the interval being evaluated
            // if we have a last key, it's likely we haven't moved far on the list
            if (this.lastKey0) {
                if (time > this.lastKey0.time) {
                    key0 = this.lastKey0;
                } else if (time < this.lastKey0.time) {
                    key0 = this.lastKey;
                    while (time < key0.time && key0.prev) {
                        key0 = key0.prev;
                    }
                } else {
                    key0 = this.keys;
                }
            } else {
                key0 = this.keys;
            }

            while (time > key0.next.time) {
                key0 = key0.next;
            }

            key1 = key0.next;

            // cache last key
            this.lastKey0 = key0;


            // check for singularities first
            if (time === key0.time) {
                return key0.value + offset;
            } else if (time === key1.time) {
                return key1.value + offset;
            }

            // get interval length, time in [0, 1]
            t = (time - key0.time) / (key1.time - key0.time);

            // interpolate
            var keyShape = key1.shape;

            if (keyShape === enums.envelope.shape.TCB || keyShape === enums.envelope.shape.BEZI || keyShape === enums.envelope.shape.HERM) {
                out = cubicvr_env_outgoing(key0, key1);
                inval = cubicvr_env_incoming(key0, key1);
                var h = cubicvr_env_hermite(t);
                return h[0] * key0.value + h[1] * key1.value + h[2] * out + h[3] * inval + offset;
            } else if (keyShape === enums.envelope.shape.BEZ2) {
                return cubicvr_env_bez2(key0, key1, time) + offset;
            } else if (keyShape === enums.envelope.shape.LINE) {
                return key0.value + t * (key1.value - key0.value) + offset;
            } else if (keyShape === enums.envelope.shape.STEP) {
                return key0.value + offset;
            } else {
                return offset;
            }
        }
    };

    function Motion(env_init, key_init) {
        this.controllers = [];
        this.yzflip = false;
        this.classType = base.enums.classType.MOTION;

        if (typeof(env_init) === 'object') {
            var obj_init = base.get(env_init);
        
            this.env_init = base.get(obj_init.envelope);
            this.key_init = base.get(obj_init.key);
                        
            for (var i in obj_init) {
                if (!obj_init.hasOwnProperty(i)) continue;
                if (i === 'envelope' || i === "key") continue;
                
                var controller = obj_init[i];
                
                var controllerEnv = base.get(controller.envelope);
                
                for (var j in controller) {
                    if (!controller.hasOwnProperty(j)) continue;
                    if (j === 'envelope' || j === "key") continue;

                    var motion = controller[j];
                    
                    if (typeof(motion) === 'object') for (var k in motion) {
                        this.setKey(i,k,j,motion[k]);
                        
                        if (controllerEnv) {
                            this.setBehavior(i,k,controllerEnv);
                        }

                    }
                }
                
            }
        } else {
            this.env_init = env_init;
            this.key_init = key_init;            
        }
    
        //  this.rscale = 1;
    }

    Motion.prototype = {
        clone: function() {
            var dupe = new base.Motion(this.env_init,this.key_init);

            for (var i in this.controllers) {
                if (this.controllers.hasOwnProperty(i)) {
                    if (dupe.controllers[i] === undef) {
                        dupe.controllers[i] = [];
                    }
                    for (var j in this.controllers[i]) {
                        if (this.controllers[i].hasOwnProperty(j)) {
                            var e = this.controllers[i][j];
                                                        
                            var d = dupe.controllers[i][j] = new Envelope({
                                in_behavior:e.in_behavior,
                                out_behavior:e.out_behavior
                            });
                            d.nKeys = e.nKeys;
                            d.keys = e.keys;
                            d.firstKey = e.firstKey;
                            d.lastKey = e.lastKey;
                        }
                    }
                }
            }

            return dupe;
        },
        envelope: function (controllerId, motionId) {
        
            motionId = base.parseEnum(enums.motion,motionId) || 0;
            controllerId = base.parseEnum(enums.motion,controllerId) || 0;

            if (this.controllers[controllerId] === undef) {
                this.controllers[controllerId] = [];
            }
            if (this.controllers[controllerId][motionId] === undef) {
                this.controllers[controllerId][motionId] = new Envelope(this.env_init);
            }

            return this.controllers[controllerId][motionId];
        },

        evaluate: function (index) {
            var retArr = [];

            for (var i in this.controllers) {
                if (this.controllers.hasOwnProperty(i)) {
                    retArr[i] = [];

                    for (var j in this.controllers[i]) {
                        if (this.controllers[i].hasOwnProperty(j)) {
                            retArr[i][j] = this.controllers[i][j].evaluate(index);
                        }
                    }
                }
            }

            return retArr;
        },

        apply: function (index, target) {
            for (var i in this.controllers) {
                if (this.controllers.hasOwnProperty(i)) {
                    var ic = parseInt(i, 10);

                    /* Special case quaternion fix for ZY->YZ rotation envelopes */
                    if (this.yzflip && ic === enums.motion.ROT) // assume channel 0,1,2
                    {
                        if (!this.q) {
                            this.q = new base.Quaternion();
                        }
                        var q = this.q;

                        var x = this.controllers[i][0].evaluate(index);
                        var y = this.controllers[i][1].evaluate(index);
                        var z = this.controllers[i][2].evaluate(index);

                        //q.fromEuler(x*this.rscale, z*this.rscale, -y*this.rscale);
                        q.fromEuler(x, z, -y);


                        var qr = q.toEuler();

                        target.control(ic, 0, qr[0]);
                        target.control(ic, 1, qr[1]);
                        target.control(ic, 2, qr[2]);
                    } else {
                        for (var j in this.controllers[i]) {
                            if (this.controllers[i].hasOwnProperty(j)) {
                                target.control(ic, parseInt(j, 10), this.controllers[i][j].evaluate(index));
                            }
                        }
                    }
                }
            }
        },

        setKey: function (controllerId, motionId, index, value, key_init) {

           motionId = base.parseEnum(enums.motion,motionId) || 0;
           controllerId = base.parseEnum(enums.motion,controllerId) || 0;

           var ev = this.envelope(controllerId, motionId);

           return ev.addKey(index, value, key_init ? key_init : this.key_init);
        },

        setArray: function (controllerId, index, value, key_init) {
            var tmpKeys = [];

            controllerId = base.parseEnum(enums.motion,controllerId) || 0;

            for (var i in value) {
                if (value.hasOwnProperty(i)) {
                    var ev = this.envelope(controllerId, base.parseEnum(enums.motion,i));
                    tmpKeys[i] = ev.addKey(index, value[i], key_init ? key_init : this.key_init);
                }
            }

            return tmpKeys;
        },

        setBehavior: function (controllerId, motionId, behavior_in, behavior_out) {
            var ev = this.envelope(controllerId, motionId);
            
            if (typeof(behavior_in) === 'object') {
                var obj_init = behavior_in;
                
                behavior_in = obj_init.in_behavior||obj_init.inBehavior||obj_init.behavior;
                behavior_out = obj_init.out_behavior||obj_init.outBehavior||obj_init.behavior;
            }

            motionId = base.parseEnum(enums.motion,motionId) || 0;
            controllerId = base.parseEnum(enums.motion,controllerId) || 0;

            ev.setBehavior(behavior_in, behavior_out);
        },

        setBehaviorArray: function (controllerId, behavior_in, behavior_out) {
   
         controllerId = base.parseEnum(enums.motion,controllerId) || 0;
            
         var controller = this.controllers[controllerId];

         for (var motionId in controller) {
                if (controller.hasOwnProperty(motionId)) {
                    var ev = this.envelope(controllerId, base.parseEnum(enums.motion,motionId) || 0);
                    ev.setBehavior(behavior_in, behavior_out);
                }
            }
         }
    };


    var extend = {
        Motion: Motion,
        Envelope: Envelope,
        EnvelopeKey: EnvelopeKey
    };

    return extend;
});
