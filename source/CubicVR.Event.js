CubicVR.RegisterModule("EventHandler",function(base) {

  var undef = base.undef,
      enums = CubicVR.enums,
      GLCore = base.GLCore,
      aabbMath = CubicVR.aabb,
      primitives = CubicVR.primitives,
      mat4 = CubicVR.mat4;

  enums.event = { 
    TICK: "tick",
    MOVE: "move",
    MATRIX_UPDATE: "matrixUpdate",  // for matrixLock'd movement event
    OCTREE_ADJUST: "octreeAdjust",  // maybe lighting can listen for updates?
    CONTACT: "collision", // for physics.. will probably move these bindings there and possibly Event to it's own module
    CONTACT_ADD: "contactAdd",
    CONTACT_REMOVE: "contactRemove",
    RIGID_REST: "rigidRest",
    RIGID_AWAKE: "rigidAwake"
  };

  function Event(obj_init) {
    obj_init = obj_init||{};
    
    this.name = obj_init.name;
    this.id = obj_init.id;
    this.interval = obj_init.interval||0;
    this.enabled = obj_init.enabled||true;
    this.action = obj_init.action||null;
    this.properties = obj_init.properties||{};
    this.event_properties = obj_init.event_properties||{};
    // TODO: use weight to allow event stack sorting
    this.weight = (obj_init.weight===undef)?-1:obj_init.weight;

    // internal
    this.t_sleep = 0;
    this.t_active = 0;
    this.t_updatecall = 0;
    this.t_update = 0;
    this.t_last = 0;
    this.t_rest = 0;
    this.t_resting = 0;
    this.n_updates = 0;
  }
  
  Event.prototype = {
    getName: function() {
      return this.name;
    },
    setName: function(name_in) {
      this.name = name_in;
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
    setEnabled: function(enabled) {
      this.enabled = enabled;
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
    rest: function(interval) {
      this.setRestInterval(interval||0);
    },
    awake: function() {
      this.t_rest = 0;
    },
    update: function(current_time) {
        var lastUpdate = 0;
    
        if (this.n_updates === 0) {
          this.t_update = current_time;
          this.t_updatecall = current_time;
          lastUpdate = 1.0/60.0; // default to 1/60 of a sec for first frame -- bad idea/good idea?
        } else {
          if (current_time === this.t_update) {
            return false;
          }
          if (!this.t_rest) {
            this.t_last = current_time-this.t_update;
            this.t_update = current_time;
          }
          
          lastUpdate = current_time-this.t_updatecall;
          this.t_updatecall = current_time;
        }

        if (this.t_rest>0) {
          this.t_resting+=lastUpdate;
          this.t_rest-=lastUpdate;
          if (this.t_rest < 0) {
            this.t_rest = 0;
          }
        } else {
          this.t_active += this.t_last;
          if (!this.t_rest && this.interval) {
            this.t_rest = this.interval;
          }
          this.n_updates++;
          return this.callEvent();
        }
        
        this.n_updates++;
        return false;
    },
    callEvent: function(currentTime,lastUpdateSeconds) {
      if (!this.action) return false;
      
      return this.action(this);
    }
  };

  function EventHandler() {
    this.events = [];
    this.eventProperties = [];
    this.eventHandled = [];
    this.listeners = [];
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
      
      return event;
    },
    hasEvent: function(eventId) {
      return !!this.listeners[eventId];
    },      
    triggerEvent: function(eventId, properties) {
      // TODO: warn of collision or make it work?  For now we can check the return to see what's already set (persistent).
      if (properties) {
        this.eventProperties[eventId] = properties;
      } else {
        this.eventProperties[eventId] = this.eventProperties[eventId]||{};
      }
      
      this.eventHandled[eventId] = false;
      return this.eventProperties[eventId];
    },
    update: function(currentTime) {
      var i,iMax,event,eventId,eh;
      
      var tickEvent = this.triggerEvent(enums.event.TICK);
      tickEvent.time = currentTime;
      tickEvent.handler = this;  // global tick event belongs to handler
      
      for (i = 0, iMax = this.events.length; i<iMax; i++) {
        event = this.events[i];
        eventId = event.getId();
        eh = this.eventHandled[eventId];
        
        if (eh !== undef && !eh) {
          if (this.eventProperties[eventId]) {
            event.setEventProperties(this.eventProperties[eventId]);
            if (event.update(currentTime)) {
              this.eventHandled[eventId] = true;
            }
          }
        }
      }
      
      this.eventHandled = [];
    }
  };
  
  var extend = {
    Event: Event,
    EventHandler: EventHandler
  };
  
  return extend;
});


