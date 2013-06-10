CubicVR.RegisterModule("EventHandler",function(base) {

  var undef = base.undef,
      enums = CubicVR.enums,
      GLCore = base.GLCore,
      aabbMath = CubicVR.aabb,
      primitives = CubicVR.primitives,
      mat4 = CubicVR.mat4,
      log = base.log;

  enums.event = { 
    TICK: 0,
    MOVE: 1,
    MATRIX_UPDATE: 2,  // for matrixLock'd movement event
    OCTREE_ADJUST: 3,  // maybe lighting can listen for updates?
    COLLIDE: 4, // for physics.. will probably move these bindings there
    CONTACT: 5,
    CONTACT_ADD: 6,
    CONTACT_REMOVE: 7,
    CONTACT_GHOST: 8, // Summon evil spirits
    RIGID_REST: 9,
    RIGID_AWAKE: 10,
    ENUM_MAX: 11
  };
 
  function validateEvent(id) {
    id = CubicVR.parseEnum(enums.event,id);

    if (id===undef) {
        log("For custom events use CubicVR.registerEvent('event_name'); and use the resulting CubicVR.enums.event.EVENT_NAME for type checks and 'event_name' for construction.");
        return false;
    }

    if (!isNaN(parseInt(id,10)) && (id >= enums.event.EVENT_MAX || id < 0)) {
        log("Unknown event ID passed: "+id);
        return false;
    }

    return id;
  }


  function registerEvent(idName) {
    idName = idName.toUpperCase();
    if (enums.event[idName]!==undef) {
        log("Error, event '"+idName+"' is already registered.");
        return;
    }
    
    enums.event[idName] = enums.event.ENUM_MAX;
    enums.event.ENUM_MAX++;
  }

  function Event(obj_init) {
    obj_init = obj_init||{};
    
    this.name = obj_init.name;
    this.classType = base.enums.classType.EVENT;
    
    obj_init.id = validateEvent(obj_init.id)||enums.event.TICK;
    
    this.id = obj_init.id;
    this.interval = obj_init.interval||0;
    this.enabled = obj_init.enabled||true;
    this.action = obj_init.action||null;
    this.properties = obj_init.properties||{};
    this.event_properties = obj_init.event_properties||{};
    this.buffered = obj_init.buffered||false;
    // TODO: use weight to allow event stack sorting
    this.weight = (obj_init.weight===undef)?-1:obj_init.weight;
    
    this.subject = null;

    // internal
    this.t_sleep = 0;
    this.t_active = 0;
    this.t_updatecall = 0;
    this.t_update = 0;
    this.t_last = 0;
    this.t_rest = 0;
    this.t_resting = 0;
    this.n_updates = 0;
    this.break_chain = false;
  }
  
  Event.prototype = {
    getName: function() {
      return this.name;
    },
    setName: function(name_in) {
      this.name = name_in;
    },
    getSubject: function() {
      return this.subject;      
    },
    setSubject: function(subject) {
      this.subject = subject;
    },
    getId: function() {
      return this.id;
    },
    setId: function(id_in) {
      this.id = id_in;
    },      
    isEnabled: function() {
      return this.enabled;
    },
    disable: function() {
      this.setEnabled(false);
    },
    enable: function() {
      this.setEnabled(true);
    },
    setEnabled: function(enabled) {      
      if (enabled && !this.enabled) {
        this.t_sleep = 0;
        this.t_active = 0;
        this.t_updatecall = 0;
        this.t_update = 0;
        this.t_last = 0;
        this.t_rest = 0;
        this.t_resting = 0;
        this.n_updates = 0;
        this.break_chain = false;
      }
      this.enabled = enabled;
    },
    isBuffered: function() {
      return this.buffered;
    },
    setBuffered: function(buffered) {
      this.buffered = buffered;
    },
    setInterval: function(interval) {
      this.interval = interval;
    },
    getInterval: function() {
      return this.interval;
    },
    setAction: function(action) {
      this.action = action;
    },
    getAction: function() {
      return this.action;
    },
    getProperties: function() {
      return this.properties;
    },
    setProperties: function(properties) {
      this.properties = properties;
    },
    getProperty: function(propertyName) {
      return this.properties[propertyName];
    },
    setProperty: function(propertyName,propertyValue) {
      this.properties[propertyName] = propertyValue;
    },
    setEventProperties: function(properties) {
      this.event_properties = properties;
    },
    getEventProperties: function() {
      return this.event_properties;
    },
    getEventProperty: function(propertyName) {
      return this.event_properties[propertyName];
    },
    setEventProperty: function(propertyName,propertyValue) {
      this.properties[propertyName] = propertyValue;
    },
    getTimeSleeping: function() {
      return this.t_sleep;
    },
    getTimeActive: function() {
      return this.t_active;
    },
    getTimeUpdated: function() {
      return this.t_update;
    },
    getSeconds: function() {
      return this.getTimeUpdated();
    },
    getRestInterval: function() {
      return this.t_rest;
    },
    getLastUpdateSeconds: function() {
      return this.t_last;
    },
    setRestInterval: function(interval) {
      this.t_rest = interval;
    },
    getUpdateCount: function() {
      return this.n_updates;
    },
    breakChain: function(bChain) {
      this.break_chain = true;
    },
    isChainBroken: function() {
      return this.break_chain;
    },
    rest: function(interval) {
      this.setRestInterval(interval||0);
    },
    awake: function() {
      this.t_rest = 0;
    },
    update: function(current_time,handler) {
        if (!this.enabled) return false;

        var lastUpdate = 0;
        var timeChange = true;
    
        if (this.n_updates === 0) {
          this.t_update = current_time;
          this.t_updatecall = current_time;
          lastUpdate = 1.0/60.0; // default to 1/60 of a sec for first frame -- bad idea/good idea?
        } else {
          if (current_time !== this.t_update) {
            if (!this.t_rest) {
              this.t_last = current_time-this.t_update;
              this.t_update = current_time;
            }
            
            lastUpdate = current_time-this.t_updatecall;
            this.t_updatecall = current_time;            
          } else {
            timeChange = false;
          }
        }

        if (this.t_rest>0) {
          if (timeChange) {
            this.t_resting+=lastUpdate;
            this.t_rest-=lastUpdate;
            if (this.t_rest < 0) {
              this.t_rest = 0;
            }
          }
        } else {
          if (timeChange) {
            this.t_active += this.t_last;
            if (!this.t_rest && this.interval) {
              this.t_rest = this.interval;
            }
            this.n_updates++;
          }
          this.callEvent(handler);
          return true;
        }
        
        if (timeChange) {
          this.n_updates++;
        }
        return false;
    },
    callEvent: function(handler) {
      if (!this.action) return false;
      
      return this.action(this,handler);
    }
  };

  function EventHandler() {
    this.events = [];
    this.eventProperties = [];
    this.eventPropertyCount = [];
    this.eventHandled = [];
    this.listeners = [];
    this.listenerNames = [];
    this.eventParameters = [];
  }
  
  EventHandler.prototype = {
    addEvent: function(event) {
      if (!event.callEvent) {
        event = new Event(event);
      }
      var eventId = event.getId();
      
      if (!this.eventProperties[eventId]) {
        this.eventProperties[eventId] = {};
      }
      
      this.listeners[eventId] = this.listeners[eventId]||0;
      this.listeners[eventId]++;
      
      this.events.push(event);
      
      if (this.listenerNames.indexOf(eventId)===-1) {
        this.listenerNames.push(eventId);
      }
      
      return event;
    },
    removeEvent: function(event) { 
      if (this.lockState) {
        if (!this.lockRemovals) {
          this.lockRemovals = [];
        }
        
        if (this.lockRemovals.indexOf(event)==-1) {             
          this.lockRemovals.push(event);
        }
        return;
      }

      var idx = this.events.indexOf(event);
      if (idx===-1) return;
      
      var eventId = event.getId();
      
      this.events.splice(idx, 1);
      this.listeners[eventId]--;
      if (!this.listeners[eventId]) {
        this.eventHandled[eventId] = true;
        this.eventParameters[eventId] = {};
        this.eventProperties[eventId] = [];
        this.eventPropertyCount[eventId] = 0;
        var lidx = this.listenerNames.indexOf(eventId);
        if (lidx>=0) {
          this.listenerNames.splice(lidx,1);
        }
      }
    },
    getProperties: function(eventId) {
      this.eventParameters[eventId] = this.eventParameters[eventId] || {};
      return this.eventParameters[eventId];
    },
    setProperties: function(eventId,params) {
      this.eventParameters[eventId] = params;
    },
    getProperty: function(eventId,propertyName) {
      return this.getProperties(eventId)[propertyName];
    },
    setProperty: function(eventId,propertyName,propertyValue) {      
      this.getProperties(eventId)[propertyName] = propertyValue;
    },
    hasEvent: function(eventId) {
      return !!this.listeners[eventId];
    },      
    triggerEvent: function(eventId, properties) {
      // TODO: warn of collision or make it work?  For now we can check the return to see what's already set (persistent).
      if (!this.listeners[eventId]) return null;
      
      if (this.eventProperties[eventId] == undef) {
        this.eventProperties[eventId] = [];        
      }
      
      var ep = this.eventProperties[eventId];

      if (this.eventPropertyCount[eventId]===undef) {
        this.eventPropertyCount[eventId] = 0;
      }
      
      var ec = this.eventPropertyCount[eventId];
      
      if (ec > 20) {
        console.log("Warning, event "+eventId+" count > 20: "+ec);
      }
      
      if (properties && ep) {
        ep[ec] = properties;
        this.eventPropertyCount[eventId]++;
      } else {
        ep[ec] = ep[ec]||{};
        this.eventPropertyCount[eventId]++;
      }
      
      this.eventHandled[eventId] = false;
      return ep[ec];
    },
    update: function(currentTime) {
      var i,iMax,j,jMax,event,eventId,eh;
      
      var tickEvent;
      
      if (this.hasEvent(enums.event.TICK) && this.eventPropertyCount[enums.event.TICK] ===0 && !!( tickEvent = this.triggerEvent(enums.event.TICK) )) {
        tickEvent.time = currentTime;
        tickEvent.handler = this;  // global tick event belongs to handler
      }
     
      this.lockState = true;
     
      for (i = 0, iMax = this.events.length; i<iMax; i++) {
        event = this.events[i];
        eventId = event.getId();
        
        var epc = this.eventPropertyCount[eventId];
        var handled = false;
        var enabled = false;

        if (epc) {
          var ep = this.eventProperties[eventId];
          if (event.isEnabled()) {
            if (event.isBuffered()) { // send all the events as one property and call once
                ep.length = epc;
                event.setEventProperties(ep);
                handled = handled||event.update(currentTime,this);
                if (event.isChainBroken()) {
                  event.breakChain(false);
                  break;
                }
            } else {  // call the event for each property
              for (j = 0, jMax = epc; j<jMax; j++) {
                event.setEventProperties(ep[i]);
                handled = handled||event.update(currentTime,this);
                if (event.isChainBroken()) {
                  event.breakChain(false);
                  break;
                }
              }
            }
            enabled = true;
          }
        }
        
        if (handled || !enabled) this.eventHandled[eventId] = true;
      }
      
      for (i = 0, iMax = this.listenerNames.length; i<iMax; i++) {
        eventId = this.listenerNames[i];
        if (this.eventHandled[eventId]) {
           this.eventPropertyCount[eventId] = 0;
        }
      }
      
      this.lockState = false;
      if (this.lockRemovals && this.lockRemovals.length) {
         for (i = 0, iMax = this.lockRemovals.length; i<iMax; i++) {
           this.removeEvent(this.lockRemovals[i]);
         }
         this.lockRemovals.length = 0;
      }
      
    }
  };
  
  var extend = {
    Event: Event,
    EventHandler: EventHandler,
    registerEvent: registerEvent,
    validateEvent: validateEvent
  };
  
  return extend;
});


