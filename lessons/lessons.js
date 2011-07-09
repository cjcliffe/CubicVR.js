(function (window, document, $, CubicVR) {

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
    raw = raw.replace(/\/\*\w@*\*\//g, "");

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
    this.onPause = options.onStart || function () {};
    this.onSeek = options.onSeek || function () {};
  };

  Lesson.prototype = {
    start: function () {
      var that = this;
      var popcorn = this.popcorn = Popcorn("#tutorial-media");
      popcorn.listen("play", this.onResume);
      popcorn.listen("pause", this.onPause);
      popcorn.listen("seeked", this.onSeek);
      this.code = new Code(this.getCode());
      $("#play").click(function (e) {
        that.onStart();
        popcorn.play();
        $(this).css({display:"none"});
        $("#pause").css({display:"block"});
      });
      $("#pause").click(function (e) {
        popcorn.pause();
        $(this).css({display:"none"});
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
    }
  };

  window.Lesson = Lesson;

  document.addEventListener( "DOMContentLoaded", function (e) {

    $("#title").children().each( function (i, e) {
      $(this).css({
        opacity: 0
      });
      $(this).delay(1000+500*i).animate({
        opacity: 1
      }, 2000);
      $(this).delay(5000+500*i).animate({
        opacity: 0 
      }, 2000);
    });

    $("#title").css({
      display: "block"
    });

  }, false );
})(window, document, $, CubicVR);
