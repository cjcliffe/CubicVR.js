(function (window, document, $, CubicVR, Popcorn) {

  Popcorn.plugin( "lessoninfo", function (options) {
    var $barLink = $('<a href="'+options.url+'" class="fake-link info-bar-link">'+options.title+'</a>');

    return {
      _setup: function () {
      },
      start: function (event, options) {
        $("#info").append($barLink);
      },
      end: function (event, options) {
      },
      _teardown: function () {
      }
    };
  });

  var currentLesson;

  Popcorn.plugin("lessoncode", function (options) {
    var callback = options.callback;
    var label = options.label;
    return {
      _setup: function () {
      },
      start: function ( event, options ) {
        currentLesson.writeCode( label, callback );
      },
      end: function ( event, options ) {
      },
      _teardown: function () {
      }
    };
  });

  var Code = function ( code ) {
    this.code = code;
    this.snippets = {};
    var labelTags = code.match(/\/\*@\w*\*\//g, "");
    for (var i=0; i<labelTags.length; ++i) {
      var label = labelTags[i],
          name = label.match(/@(\w*)/)[1],
          idx1 = code.indexOf(label) + label.length,
          idx2 = code.indexOf("/*"+name+"@*/");
      this.snippets[name] = new Snippet(code.substring(idx1, idx2));
    } //for

    var raw = code.replace(/\/\*@\w*\*\//g, "");
    raw = raw.replace(/\/\*\w*@\*\//g, "");

    this.getCode = function () {
      return raw;
    };

    this.getSnippet = function ( label ) {
      return this.snippets[label];
    };

    this.currentCode = "";

    this.type = function ( label, element, callback ) {
      var text = element.value,
          snippet = this.snippets[label];
      if ( snippet ) {
        var interval;
        function typeLetter() {
          var next = snippet.next();
          if ( next ) {
            text += next;
            element.value = text;
            this.currentCode = text;
          }
          else {
            clearInterval(interval);
            callback && callback(snippet.code);
          } //if
        } //typeLetter
        interval = setInterval( typeLetter, 20 );
      } //if
    };
  };

  var Snippet = function ( code ) {
    this.code = code;
    this.length = code.length;
    this.pos = 0;
    var that = this;
    this.reset = function () { that.pos = 0; }
    this.ready = function () { return that.pos < that.length; }
    this.next = function () { if ( that.ready ) { return that.code[that.pos++]; } }
  };

  var Lesson = function ( options ) {
    options = options || {};
    this.onStart = options.onStart || function () {};
    this.onResume = options.onResume || function () {};
    this.onPause = options.onPause || function () {};
    this.onSeek = options.onSeek || function () {};
  };

  Lesson.prototype = {
    start: function () {
      currentLesson = this;
      var that = this;
      var popcorn = this.popcorn = Popcorn("#tutorial-media");
      popcorn.listen("play", this.onResume);
      popcorn.listen("pause", this.onPause);
      popcorn.listen("seeked", this.onSeek);
      this.code = new Code(this.getCode());
      $("#play").click(function (e) {
        if (popcorn.currentTime() === 0) {
          that.onStart();
        }
        popcorn.play();
        $("#play").css({display:"none"});
        $("#pause").css({display:"block"});
      });
      $("#pause").click(function (e) {
        popcorn.pause();
        $("#pause").css({display:"none"});
        $("#play").css({display:"block"});
      });
    },
    getCode: function () {
      return $("#lesson-code").contents().text();
    },
    getCurrentCode: function () {
      return code.currentCode;
    },
    executeCode: function ( code ) {
      code = code || this.code.getCode();
      var fn = Function ( code );
      fn();
    },
    showCode: function ( code ) {
      code = code || this.code.getCode();
      $("#code textarea").val(code);
    },
    grabCode: function ( label ) {
      return this.code.getSnippet(label);
    },
    writeCode: function ( label, callback ) {
      this.code.type(label, $("#code textarea")[0], callback);
    },
    writeCodeLine: function ( num ) {
    },
    clearCode: function () {
      $("#code textarea").val("");
    },

    addInfo: function ( element ) {
      $("#info").append(element);
    },
  };

  window.Lesson = Lesson;

  document.addEventListener( "DOMContentLoaded", function (e) {

    $("#title").children().each( function (i, e) {
      $(this).css({opacity: 0});
      $(this).delay(1000+500*i).fadeTo(2000, 1);
      $(this).delay(5000+500*i).fadeTo(2000, 0);
    });

    $("#title").css({
      display: "block"
    });

    $("#info-container").css({
      display: "block"
    });

    $("#info").hide();

    $(document).resize( function (e) {
      if (infoHidden) {
        $("#info-title").css({
          left: (window.innerWidth - $("#info-title").width()) + 'px'
        });
      }
    });
    var infoHidden = true;
    $("#info-title").click( function (e) {
      if (infoHidden) {
        $("#info-title").animate({
          left: '0px'
        }, 1000, function () {
          infoHidden = false;
          $("#info").fadeTo(500, 1);
        });
      }
      else {
        $("#info").fadeTo(500, 0);
        $("#info-title").delay(500).animate({
          left: (window.innerWidth - $("#info-title").width()) + 'px'
        }, 1000, function () {
          infoHidden = true;
        });
      } //if
    });

  }, false );
})(window, document, $, CubicVR, Popcorn);
