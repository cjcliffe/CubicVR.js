/**
 * Static build of pdf.js + support scripts from:
 *
 * commit 575e0b9f8940b4ca7923659e738e208f46c71006
 * Merge: 6ba8dc7 118503b
 * Author: Chris Jones <jones.chris.g@gmail.com>
 * Date:   Tue Sep 27 14:21:43 2011 -0700
 *
 *   Merge pull request #546 from kkujala/master
 *
 *   Add examples and extensions to lint.
 **/

/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var ERRORS = 0, WARNINGS = 1, TODOS = 5;
var verbosity = WARNINGS;

function log(msg) {
  if (console && console.log)
    console.log(msg);
  else if (print)
    print(msg);
}

function warn(msg) {
  if (verbosity >= WARNINGS)
    log('Warning: ' + msg);
}

function backtrace() {
  var stackStr;
  try {
    throw new Error();
  } catch (e) {
    stackStr = e.stack;
  }
  return stackStr.split('\n').slice(1).join('\n');
}

function error(msg) {
  log(backtrace());
  throw new Error(msg);
}

function TODO(what) {
  if (verbosity >= TODOS)
    log('TODO: ' + what);
}

function malformed(msg) {
  error('Malformed PDF: ' + msg);
}

function assert(cond, msg) {
  if (!cond)
    error(msg);
}

// In a well-formed PDF, |cond| holds.  If it doesn't, subsequent
// behavior is undefined.
function assertWellFormed(cond, msg) {
  if (!cond)
    malformed(msg);
}

function shadow(obj, prop, value) {
  try {
    Object.defineProperty(obj, prop, { value: value,
                                       enumerable: true,
                                       configurable: true,
                                       writable: false });
  } catch (e) {
    obj.__defineGetter__(prop, function shadowDefineGetter() {
      return value;
    });
  }
  return value;
}

function bytesToString(bytes) {
  var str = '';
  var length = bytes.length;
  for (var n = 0; n < length; ++n)
    str += String.fromCharCode(bytes[n]);
  return str;
}

function stringToBytes(str) {
  var length = str.length;
  var bytes = new Uint8Array(length);
  for (var n = 0; n < length; ++n)
    bytes[n] = str.charCodeAt(n) & 0xFF;
  return bytes;
}

var PDFStringTranslateTable = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0x2D8, 0x2C7, 0x2C6, 0x2D9, 0x2DD, 0x2DB, 0x2DA, 0x2DC, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2022, 0x2020, 0x2021, 0x2026, 0x2014,
  0x2013, 0x192, 0x2044, 0x2039, 0x203A, 0x2212, 0x2030, 0x201E, 0x201C,
  0x201D, 0x2018, 0x2019, 0x201A, 0x2122, 0xFB01, 0xFB02, 0x141, 0x152, 0x160,
  0x178, 0x17D, 0x131, 0x142, 0x153, 0x161, 0x17E, 0, 0x20AC
];

function stringToPDFString(str) {
  var i, n = str.length, str2 = '';
  if (str[0] === '\xFE' && str[1] === '\xFF') {
    // UTF16BE BOM
    for (i = 2; i < n; i += 2)
      str2 += String.fromCharCode(
        (str.charCodeAt(i) << 8) | str.charCodeAt(i + 1));
  } else {
    for (i = 0; i < n; ++i) {
      var code = PDFStringTranslateTable[str.charCodeAt(i)];
      str2 += code ? String.fromCharCode(code) : str.charAt(i);
    }
  }
  return str2;
}

//
// getPdf()
// Convenience function to perform binary Ajax GET
// Usage: getPdf('http://...', callback)
//        getPdf({url:String [,progress:Function]}, callback)
//
function getPdf(arg, callback) {
  var params = arg;
  if (typeof arg === 'string') {
    params = {url: arg};
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', params.url);
  xhr.mozResponseType = xhr.responseType = 'arraybuffer';
  xhr.expected = (document.URL.indexOf('file:') === 0) ? 0 : 200;
  xhr.onprogress = params.progress || undefined;

  xhr.onreadystatechange = function getPdfOnreadystatechange() {
    var data;
    if (xhr.readyState === 4 && xhr.status === xhr.expected) {
      data = (xhr.mozResponseArrayBuffer || xhr.mozResponse ||
              xhr.responseArrayBuffer || xhr.response);
      callback(data);
    }
  };
  xhr.send(null);
}

var Stream = (function streamStream() {
  function constructor(arrayBuffer, start, length, dict) {
    this.bytes = new Uint8Array(arrayBuffer);
    this.start = start || 0;
    this.pos = this.start;
    this.end = (start + length) || this.bytes.length;
    this.dict = dict;
  }

  // required methods for a stream. if a particular stream does not
  // implement these, an error should be thrown
  constructor.prototype = {
    get length() {
      return this.end - this.start;
    },
    getByte: function stream_getByte() {
      if (this.pos >= this.end)
        return null;
      return this.bytes[this.pos++];
    },
    // returns subarray of original buffer
    // should only be read
    getBytes: function stream_getBytes(length) {
      var bytes = this.bytes;
      var pos = this.pos;
      var strEnd = this.end;

      if (!length)
        return bytes.subarray(pos, strEnd);

      var end = pos + length;
      if (end > strEnd)
        end = strEnd;

      this.pos = end;
      return bytes.subarray(pos, end);
    },
    lookChar: function stream_lookChar() {
      if (this.pos >= this.end)
        return null;
      return String.fromCharCode(this.bytes[this.pos]);
    },
    getChar: function stream_getChar() {
      if (this.pos >= this.end)
        return null;
      return String.fromCharCode(this.bytes[this.pos++]);
    },
    skip: function stream_skip(n) {
      if (!n)
        n = 1;
      this.pos += n;
    },
    reset: function stream_reset() {
      this.pos = this.start;
    },
    moveStart: function stream_moveStart() {
      this.start = this.pos;
    },
    makeSubStream: function stream_makeSubstream(start, length, dict) {
      return new Stream(this.bytes.buffer, start, length, dict);
    },
    isStream: true
  };

  return constructor;
})();

var StringStream = (function stringStream() {
  function constructor(str) {
    var length = str.length;
    var bytes = new Uint8Array(length);
    for (var n = 0; n < length; ++n)
      bytes[n] = str.charCodeAt(n);
    Stream.call(this, bytes);
  }

  constructor.prototype = Stream.prototype;

  return constructor;
})();

// super class for the decoding streams
var DecodeStream = (function decodeStream() {
  function constructor() {
    this.pos = 0;
    this.bufferLength = 0;
    this.eof = false;
    this.buffer = null;
  }

  constructor.prototype = {
    ensureBuffer: function decodestream_ensureBuffer(requested) {
      var buffer = this.buffer;
      var current = buffer ? buffer.byteLength : 0;
      if (requested < current)
        return buffer;
      var size = 512;
      while (size < requested)
        size <<= 1;
      var buffer2 = new Uint8Array(size);
      for (var i = 0; i < current; ++i)
        buffer2[i] = buffer[i];
      return (this.buffer = buffer2);
    },
    getByte: function decodestream_getByte() {
      var pos = this.pos;
      while (this.bufferLength <= pos) {
        if (this.eof)
          return null;
        this.readBlock();
      }
      return this.buffer[this.pos++];
    },
    getBytes: function decodestream_getBytes(length) {
      var end, pos = this.pos;

      if (length) {
        this.ensureBuffer(pos + length);
        end = pos + length;

        while (!this.eof && this.bufferLength < end)
          this.readBlock();

        var bufEnd = this.bufferLength;
        if (end > bufEnd)
          end = bufEnd;
      } else {
        while (!this.eof)
          this.readBlock();

        end = this.bufferLength;

        // checking if bufferLength is still 0 then
        // the buffer has to be initialized
        if (!end)
          this.buffer = new Uint8Array(0);
      }

      this.pos = end;
      return this.buffer.subarray(pos, end);
    },
    lookChar: function decodestream_lookChar() {
      var pos = this.pos;
      while (this.bufferLength <= pos) {
        if (this.eof)
          return null;
        this.readBlock();
      }
      return String.fromCharCode(this.buffer[this.pos]);
    },
    getChar: function decodestream_getChar() {
      var pos = this.pos;
      while (this.bufferLength <= pos) {
        if (this.eof)
          return null;
        this.readBlock();
      }
      return String.fromCharCode(this.buffer[this.pos++]);
    },
    makeSubStream: function decodestream_makeSubstream(start, length, dict) {
      var end = start + length;
      while (this.bufferLength <= end && !this.eof)
        this.readBlock();
      return new Stream(this.buffer, start, length, dict);
    },
    skip: function decodestream_skip(n) {
      if (!n)
        n = 1;
      this.pos += n;
    },
    reset: function decodestream_reset() {
      this.pos = 0;
    }
  };

  return constructor;
})();

var FakeStream = (function fakeStream() {
  function constructor(stream) {
    this.dict = stream.dict;
    DecodeStream.call(this);
  }

  constructor.prototype = Object.create(DecodeStream.prototype);
  constructor.prototype.readBlock = function fakeStreamReadBlock() {
    var bufferLength = this.bufferLength;
    bufferLength += 1024;
    var buffer = this.ensureBuffer(bufferLength);
    this.bufferLength = bufferLength;
  };

  constructor.prototype.getBytes = function fakeStreamGetBytes(length) {
    var end, pos = this.pos;

    if (length) {
      this.ensureBuffer(pos + length);
      end = pos + length;

      while (!this.eof && this.bufferLength < end)
        this.readBlock();

      var bufEnd = this.bufferLength;
      if (end > bufEnd)
        end = bufEnd;
    } else {
      this.eof = true;
      end = this.bufferLength;
    }

    this.pos = end;
    return this.buffer.subarray(pos, end);
  };

  return constructor;
})();

var StreamsSequenceStream = (function streamSequenceStream() {
  function constructor(streams) {
    this.streams = streams;
    DecodeStream.call(this);
  }

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBlock = function streamSequenceStreamReadBlock() {
    var streams = this.streams;
    if (streams.length == 0) {
      this.eof = true;
      return;
    }
    var stream = streams.shift();
    var chunk = stream.getBytes();
    var bufferLength = this.bufferLength;
    var newLength = bufferLength + chunk.length;
    var buffer = this.ensureBuffer(newLength);
    buffer.set(chunk, bufferLength);
    this.bufferLength = newLength;
  };

  return constructor;
})();

var FlateStream = (function flateStream() {
  var codeLenCodeMap = new Uint32Array([
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
  ]);

  var lengthDecode = new Uint32Array([
    0x00003, 0x00004, 0x00005, 0x00006, 0x00007, 0x00008, 0x00009, 0x0000a,
    0x1000b, 0x1000d, 0x1000f, 0x10011, 0x20013, 0x20017, 0x2001b, 0x2001f,
    0x30023, 0x3002b, 0x30033, 0x3003b, 0x40043, 0x40053, 0x40063, 0x40073,
    0x50083, 0x500a3, 0x500c3, 0x500e3, 0x00102, 0x00102, 0x00102
  ]);

  var distDecode = new Uint32Array([
    0x00001, 0x00002, 0x00003, 0x00004, 0x10005, 0x10007, 0x20009, 0x2000d,
    0x30011, 0x30019, 0x40021, 0x40031, 0x50041, 0x50061, 0x60081, 0x600c1,
    0x70101, 0x70181, 0x80201, 0x80301, 0x90401, 0x90601, 0xa0801, 0xa0c01,
    0xb1001, 0xb1801, 0xc2001, 0xc3001, 0xd4001, 0xd6001
  ]);

  var fixedLitCodeTab = [new Uint32Array([
    0x70100, 0x80050, 0x80010, 0x80118, 0x70110, 0x80070, 0x80030, 0x900c0,
    0x70108, 0x80060, 0x80020, 0x900a0, 0x80000, 0x80080, 0x80040, 0x900e0,
    0x70104, 0x80058, 0x80018, 0x90090, 0x70114, 0x80078, 0x80038, 0x900d0,
    0x7010c, 0x80068, 0x80028, 0x900b0, 0x80008, 0x80088, 0x80048, 0x900f0,
    0x70102, 0x80054, 0x80014, 0x8011c, 0x70112, 0x80074, 0x80034, 0x900c8,
    0x7010a, 0x80064, 0x80024, 0x900a8, 0x80004, 0x80084, 0x80044, 0x900e8,
    0x70106, 0x8005c, 0x8001c, 0x90098, 0x70116, 0x8007c, 0x8003c, 0x900d8,
    0x7010e, 0x8006c, 0x8002c, 0x900b8, 0x8000c, 0x8008c, 0x8004c, 0x900f8,
    0x70101, 0x80052, 0x80012, 0x8011a, 0x70111, 0x80072, 0x80032, 0x900c4,
    0x70109, 0x80062, 0x80022, 0x900a4, 0x80002, 0x80082, 0x80042, 0x900e4,
    0x70105, 0x8005a, 0x8001a, 0x90094, 0x70115, 0x8007a, 0x8003a, 0x900d4,
    0x7010d, 0x8006a, 0x8002a, 0x900b4, 0x8000a, 0x8008a, 0x8004a, 0x900f4,
    0x70103, 0x80056, 0x80016, 0x8011e, 0x70113, 0x80076, 0x80036, 0x900cc,
    0x7010b, 0x80066, 0x80026, 0x900ac, 0x80006, 0x80086, 0x80046, 0x900ec,
    0x70107, 0x8005e, 0x8001e, 0x9009c, 0x70117, 0x8007e, 0x8003e, 0x900dc,
    0x7010f, 0x8006e, 0x8002e, 0x900bc, 0x8000e, 0x8008e, 0x8004e, 0x900fc,
    0x70100, 0x80051, 0x80011, 0x80119, 0x70110, 0x80071, 0x80031, 0x900c2,
    0x70108, 0x80061, 0x80021, 0x900a2, 0x80001, 0x80081, 0x80041, 0x900e2,
    0x70104, 0x80059, 0x80019, 0x90092, 0x70114, 0x80079, 0x80039, 0x900d2,
    0x7010c, 0x80069, 0x80029, 0x900b2, 0x80009, 0x80089, 0x80049, 0x900f2,
    0x70102, 0x80055, 0x80015, 0x8011d, 0x70112, 0x80075, 0x80035, 0x900ca,
    0x7010a, 0x80065, 0x80025, 0x900aa, 0x80005, 0x80085, 0x80045, 0x900ea,
    0x70106, 0x8005d, 0x8001d, 0x9009a, 0x70116, 0x8007d, 0x8003d, 0x900da,
    0x7010e, 0x8006d, 0x8002d, 0x900ba, 0x8000d, 0x8008d, 0x8004d, 0x900fa,
    0x70101, 0x80053, 0x80013, 0x8011b, 0x70111, 0x80073, 0x80033, 0x900c6,
    0x70109, 0x80063, 0x80023, 0x900a6, 0x80003, 0x80083, 0x80043, 0x900e6,
    0x70105, 0x8005b, 0x8001b, 0x90096, 0x70115, 0x8007b, 0x8003b, 0x900d6,
    0x7010d, 0x8006b, 0x8002b, 0x900b6, 0x8000b, 0x8008b, 0x8004b, 0x900f6,
    0x70103, 0x80057, 0x80017, 0x8011f, 0x70113, 0x80077, 0x80037, 0x900ce,
    0x7010b, 0x80067, 0x80027, 0x900ae, 0x80007, 0x80087, 0x80047, 0x900ee,
    0x70107, 0x8005f, 0x8001f, 0x9009e, 0x70117, 0x8007f, 0x8003f, 0x900de,
    0x7010f, 0x8006f, 0x8002f, 0x900be, 0x8000f, 0x8008f, 0x8004f, 0x900fe,
    0x70100, 0x80050, 0x80010, 0x80118, 0x70110, 0x80070, 0x80030, 0x900c1,
    0x70108, 0x80060, 0x80020, 0x900a1, 0x80000, 0x80080, 0x80040, 0x900e1,
    0x70104, 0x80058, 0x80018, 0x90091, 0x70114, 0x80078, 0x80038, 0x900d1,
    0x7010c, 0x80068, 0x80028, 0x900b1, 0x80008, 0x80088, 0x80048, 0x900f1,
    0x70102, 0x80054, 0x80014, 0x8011c, 0x70112, 0x80074, 0x80034, 0x900c9,
    0x7010a, 0x80064, 0x80024, 0x900a9, 0x80004, 0x80084, 0x80044, 0x900e9,
    0x70106, 0x8005c, 0x8001c, 0x90099, 0x70116, 0x8007c, 0x8003c, 0x900d9,
    0x7010e, 0x8006c, 0x8002c, 0x900b9, 0x8000c, 0x8008c, 0x8004c, 0x900f9,
    0x70101, 0x80052, 0x80012, 0x8011a, 0x70111, 0x80072, 0x80032, 0x900c5,
    0x70109, 0x80062, 0x80022, 0x900a5, 0x80002, 0x80082, 0x80042, 0x900e5,
    0x70105, 0x8005a, 0x8001a, 0x90095, 0x70115, 0x8007a, 0x8003a, 0x900d5,
    0x7010d, 0x8006a, 0x8002a, 0x900b5, 0x8000a, 0x8008a, 0x8004a, 0x900f5,
    0x70103, 0x80056, 0x80016, 0x8011e, 0x70113, 0x80076, 0x80036, 0x900cd,
    0x7010b, 0x80066, 0x80026, 0x900ad, 0x80006, 0x80086, 0x80046, 0x900ed,
    0x70107, 0x8005e, 0x8001e, 0x9009d, 0x70117, 0x8007e, 0x8003e, 0x900dd,
    0x7010f, 0x8006e, 0x8002e, 0x900bd, 0x8000e, 0x8008e, 0x8004e, 0x900fd,
    0x70100, 0x80051, 0x80011, 0x80119, 0x70110, 0x80071, 0x80031, 0x900c3,
    0x70108, 0x80061, 0x80021, 0x900a3, 0x80001, 0x80081, 0x80041, 0x900e3,
    0x70104, 0x80059, 0x80019, 0x90093, 0x70114, 0x80079, 0x80039, 0x900d3,
    0x7010c, 0x80069, 0x80029, 0x900b3, 0x80009, 0x80089, 0x80049, 0x900f3,
    0x70102, 0x80055, 0x80015, 0x8011d, 0x70112, 0x80075, 0x80035, 0x900cb,
    0x7010a, 0x80065, 0x80025, 0x900ab, 0x80005, 0x80085, 0x80045, 0x900eb,
    0x70106, 0x8005d, 0x8001d, 0x9009b, 0x70116, 0x8007d, 0x8003d, 0x900db,
    0x7010e, 0x8006d, 0x8002d, 0x900bb, 0x8000d, 0x8008d, 0x8004d, 0x900fb,
    0x70101, 0x80053, 0x80013, 0x8011b, 0x70111, 0x80073, 0x80033, 0x900c7,
    0x70109, 0x80063, 0x80023, 0x900a7, 0x80003, 0x80083, 0x80043, 0x900e7,
    0x70105, 0x8005b, 0x8001b, 0x90097, 0x70115, 0x8007b, 0x8003b, 0x900d7,
    0x7010d, 0x8006b, 0x8002b, 0x900b7, 0x8000b, 0x8008b, 0x8004b, 0x900f7,
    0x70103, 0x80057, 0x80017, 0x8011f, 0x70113, 0x80077, 0x80037, 0x900cf,
    0x7010b, 0x80067, 0x80027, 0x900af, 0x80007, 0x80087, 0x80047, 0x900ef,
    0x70107, 0x8005f, 0x8001f, 0x9009f, 0x70117, 0x8007f, 0x8003f, 0x900df,
    0x7010f, 0x8006f, 0x8002f, 0x900bf, 0x8000f, 0x8008f, 0x8004f, 0x900ff
  ]), 9];

  var fixedDistCodeTab = [new Uint32Array([
    0x50000, 0x50010, 0x50008, 0x50018, 0x50004, 0x50014, 0x5000c, 0x5001c,
    0x50002, 0x50012, 0x5000a, 0x5001a, 0x50006, 0x50016, 0x5000e, 0x00000,
    0x50001, 0x50011, 0x50009, 0x50019, 0x50005, 0x50015, 0x5000d, 0x5001d,
    0x50003, 0x50013, 0x5000b, 0x5001b, 0x50007, 0x50017, 0x5000f, 0x00000
  ]), 5];

  function constructor(stream) {
    var bytes = stream.getBytes();
    var bytesPos = 0;

    this.dict = stream.dict;
    var cmf = bytes[bytesPos++];
    var flg = bytes[bytesPos++];
    if (cmf == -1 || flg == -1)
      error('Invalid header in flate stream: ' + cmf + ', ' + flg);
    if ((cmf & 0x0f) != 0x08)
      error('Unknown compression method in flate stream: ' + cmf + ', ' + flg);
    if ((((cmf << 8) + flg) % 31) != 0)
      error('Bad FCHECK in flate stream: ' + cmf + ', ' + flg);
    if (flg & 0x20)
      error('FDICT bit set in flate stream: ' + cmf + ', ' + flg);

    this.bytes = bytes;
    this.bytesPos = bytesPos;

    this.codeSize = 0;
    this.codeBuf = 0;

    DecodeStream.call(this);
  }

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.getBits = function flateStreamGetBits(bits) {
    var codeSize = this.codeSize;
    var codeBuf = this.codeBuf;
    var bytes = this.bytes;
    var bytesPos = this.bytesPos;

    var b;
    while (codeSize < bits) {
      if (typeof (b = bytes[bytesPos++]) == 'undefined')
        error('Bad encoding in flate stream');
      codeBuf |= b << codeSize;
      codeSize += 8;
    }
    b = codeBuf & ((1 << bits) - 1);
    this.codeBuf = codeBuf >> bits;
    this.codeSize = codeSize -= bits;
    this.bytesPos = bytesPos;
    return b;
  };

  constructor.prototype.getCode = function flateStreamGetCode(table) {
    var codes = table[0];
    var maxLen = table[1];
    var codeSize = this.codeSize;
    var codeBuf = this.codeBuf;
    var bytes = this.bytes;
    var bytesPos = this.bytesPos;

    while (codeSize < maxLen) {
      var b;
      if (typeof (b = bytes[bytesPos++]) == 'undefined')
        error('Bad encoding in flate stream');
      codeBuf |= (b << codeSize);
      codeSize += 8;
    }
    var code = codes[codeBuf & ((1 << maxLen) - 1)];
    var codeLen = code >> 16;
    var codeVal = code & 0xffff;
    if (codeSize == 0 || codeSize < codeLen || codeLen == 0)
      error('Bad encoding in flate stream');
    this.codeBuf = (codeBuf >> codeLen);
    this.codeSize = (codeSize - codeLen);
    this.bytesPos = bytesPos;
    return codeVal;
  };

  constructor.prototype.generateHuffmanTable =
    function flateStreamGenerateHuffmanTable(lengths) {
    var n = lengths.length;

    // find max code length
    var maxLen = 0;
    for (var i = 0; i < n; ++i) {
      if (lengths[i] > maxLen)
        maxLen = lengths[i];
    }

    // build the table
    var size = 1 << maxLen;
    var codes = new Uint32Array(size);
    for (var len = 1, code = 0, skip = 2;
         len <= maxLen;
         ++len, code <<= 1, skip <<= 1) {
      for (var val = 0; val < n; ++val) {
        if (lengths[val] == len) {
          // bit-reverse the code
          var code2 = 0;
          var t = code;
          for (var i = 0; i < len; ++i) {
            code2 = (code2 << 1) | (t & 1);
            t >>= 1;
          }

          // fill the table entries
          for (var i = code2; i < size; i += skip)
            codes[i] = (len << 16) | val;

          ++code;
        }
      }
    }

    return [codes, maxLen];
  };

  constructor.prototype.readBlock = function flateStreamReadBlock() {
    // read block header
    var hdr = this.getBits(3);
    if (hdr & 1)
      this.eof = true;
    hdr >>= 1;

    if (hdr == 0) { // uncompressed block
      var bytes = this.bytes;
      var bytesPos = this.bytesPos;
      var b;

      if (typeof (b = bytes[bytesPos++]) == 'undefined')
        error('Bad block header in flate stream');
      var blockLen = b;
      if (typeof (b = bytes[bytesPos++]) == 'undefined')
        error('Bad block header in flate stream');
      blockLen |= (b << 8);
      if (typeof (b = bytes[bytesPos++]) == 'undefined')
        error('Bad block header in flate stream');
      var check = b;
      if (typeof (b = bytes[bytesPos++]) == 'undefined')
        error('Bad block header in flate stream');
      check |= (b << 8);
      if (check != (~blockLen & 0xffff))
        error('Bad uncompressed block length in flate stream');

      this.codeBuf = 0;
      this.codeSize = 0;

      var bufferLength = this.bufferLength;
      var buffer = this.ensureBuffer(bufferLength + blockLen);
      var end = bufferLength + blockLen;
      this.bufferLength = end;
      for (var n = bufferLength; n < end; ++n) {
        if (typeof (b = bytes[bytesPos++]) == 'undefined') {
          this.eof = true;
          break;
        }
        buffer[n] = b;
      }
      this.bytesPos = bytesPos;
      return;
    }

    var litCodeTable;
    var distCodeTable;
    if (hdr == 1) { // compressed block, fixed codes
      litCodeTable = fixedLitCodeTab;
      distCodeTable = fixedDistCodeTab;
    } else if (hdr == 2) { // compressed block, dynamic codes
      var numLitCodes = this.getBits(5) + 257;
      var numDistCodes = this.getBits(5) + 1;
      var numCodeLenCodes = this.getBits(4) + 4;

      // build the code lengths code table
      var codeLenCodeLengths = new Uint8Array(codeLenCodeMap.length);

      for (var i = 0; i < numCodeLenCodes; ++i)
        codeLenCodeLengths[codeLenCodeMap[i]] = this.getBits(3);
      var codeLenCodeTab = this.generateHuffmanTable(codeLenCodeLengths);

      // build the literal and distance code tables
      var len = 0;
      var i = 0;
      var codes = numLitCodes + numDistCodes;
      var codeLengths = new Uint8Array(codes);
      while (i < codes) {
        var code = this.getCode(codeLenCodeTab);
        if (code == 16) {
          var bitsLength = 2, bitsOffset = 3, what = len;
        } else if (code == 17) {
          var bitsLength = 3, bitsOffset = 3, what = (len = 0);
        } else if (code == 18) {
          var bitsLength = 7, bitsOffset = 11, what = (len = 0);
        } else {
          codeLengths[i++] = len = code;
          continue;
        }

        var repeatLength = this.getBits(bitsLength) + bitsOffset;
        while (repeatLength-- > 0)
          codeLengths[i++] = what;
      }

      litCodeTable =
        this.generateHuffmanTable(codeLengths.subarray(0, numLitCodes));
      distCodeTable =
        this.generateHuffmanTable(codeLengths.subarray(numLitCodes, codes));
    } else {
      error('Unknown block type in flate stream');
    }

    var buffer = this.buffer;
    var limit = buffer ? buffer.length : 0;
    var pos = this.bufferLength;
    while (true) {
      var code1 = this.getCode(litCodeTable);
      if (code1 < 256) {
        if (pos + 1 >= limit) {
          buffer = this.ensureBuffer(pos + 1);
          limit = buffer.length;
        }
        buffer[pos++] = code1;
        continue;
      }
      if (code1 == 256) {
        this.bufferLength = pos;
        return;
      }
      code1 -= 257;
      code1 = lengthDecode[code1];
      var code2 = code1 >> 16;
      if (code2 > 0)
        code2 = this.getBits(code2);
      var len = (code1 & 0xffff) + code2;
      code1 = this.getCode(distCodeTable);
      code1 = distDecode[code1];
      code2 = code1 >> 16;
      if (code2 > 0)
        code2 = this.getBits(code2);
      var dist = (code1 & 0xffff) + code2;
      if (pos + len >= limit) {
        buffer = this.ensureBuffer(pos + len);
        limit = buffer.length;
      }
      for (var k = 0; k < len; ++k, ++pos)
        buffer[pos] = buffer[pos - dist];
    }
  };

  return constructor;
})();

var PredictorStream = (function predictorStream() {
  function constructor(stream, params) {
    var predictor = this.predictor = params.get('Predictor') || 1;

    if (predictor <= 1)
      return stream; // no prediction
    if (predictor !== 2 && (predictor < 10 || predictor > 15))
      error('Unsupported predictor: ' + predictor);

    if (predictor === 2)
      this.readBlock = this.readBlockTiff;
    else
      this.readBlock = this.readBlockPng;

    this.stream = stream;
    this.dict = stream.dict;

    var colors = this.colors = params.get('Colors') || 1;
    var bits = this.bits = params.get('BitsPerComponent') || 8;
    var columns = this.columns = params.get('Columns') || 1;

    this.pixBytes = (colors * bits + 7) >> 3;
    this.rowBytes = (columns * colors * bits + 7) >> 3;

    DecodeStream.call(this);
    return this;
  }

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBlockTiff =
    function predictorStreamReadBlockTiff() {
    var rowBytes = this.rowBytes;

    var bufferLength = this.bufferLength;
    var buffer = this.ensureBuffer(bufferLength + rowBytes);
    var currentRow = buffer.subarray(bufferLength, bufferLength + rowBytes);

    var bits = this.bits;
    var colors = this.colors;

    var rawBytes = this.stream.getBytes(rowBytes);

    var inbuf = 0, outbuf = 0;
    var inbits = 0, outbits = 0;

    if (bits === 1) {
      for (var i = 0; i < rowBytes; ++i) {
        var c = rawBytes[i];
        inbuf = (inbuf << 8) | c;
        // bitwise addition is exclusive or
        // first shift inbuf and then add
        currentRow[i] = (c ^ (inbuf >> colors)) & 0xFF;
        // truncate inbuf (assumes colors < 16)
        inbuf &= 0xFFFF;
      }
    } else if (bits === 8) {
      for (var i = 0; i < colors; ++i)
        currentRow[i] = rawBytes[i];
      for (; i < rowBytes; ++i)
        currentRow[i] = currentRow[i - colors] + rawBytes[i];
    } else {
      var compArray = new Uint8Array(colors + 1);
      var bitMask = (1 << bits) - 1;
      var j = 0, k = 0;
      var columns = this.columns;
      for (var i = 0; i < columns; ++i) {
        for (var kk = 0; kk < colors; ++kk) {
          if (inbits < bits) {
            inbuf = (inbuf << 8) | (rawBytes[j++] & 0xFF);
            inbits += 8;
          }
          compArray[kk] = (compArray[kk] +
                           (inbuf >> (inbits - bits))) & bitMask;
          inbits -= bits;
          outbuf = (outbuf << bits) | compArray[kk];
          outbits += bits;
          if (outbits >= 8) {
            currentRow[k++] = (outbuf >> (outbits - 8)) & 0xFF;
            outbits -= 8;
          }
        }
      }
      if (outbits > 0) {
        currentRow[k++] = (outbuf << (8 - outbits)) +
        (inbuf & ((1 << (8 - outbits)) - 1));
      }
    }
    this.bufferLength += rowBytes;
  };

  constructor.prototype.readBlockPng = function predictorStreamReadBlockPng() {
    var rowBytes = this.rowBytes;
    var pixBytes = this.pixBytes;

    var predictor = this.stream.getByte();
    var rawBytes = this.stream.getBytes(rowBytes);

    var bufferLength = this.bufferLength;
    var buffer = this.ensureBuffer(bufferLength + rowBytes);

    var currentRow = buffer.subarray(bufferLength, bufferLength + rowBytes);
    var prevRow = buffer.subarray(bufferLength - rowBytes, bufferLength);
    if (prevRow.length == 0)
      prevRow = new Uint8Array(rowBytes);

    switch (predictor) {
      case 0:
        for (var i = 0; i < rowBytes; ++i)
          currentRow[i] = rawBytes[i];
        break;
      case 1:
        for (var i = 0; i < pixBytes; ++i)
          currentRow[i] = rawBytes[i];
        for (; i < rowBytes; ++i)
          currentRow[i] = (currentRow[i - pixBytes] + rawBytes[i]) & 0xFF;
        break;
      case 2:
        for (var i = 0; i < rowBytes; ++i)
          currentRow[i] = (prevRow[i] + rawBytes[i]) & 0xFF;
        break;
      case 3:
        for (var i = 0; i < pixBytes; ++i)
          currentRow[i] = (prevRow[i] >> 1) + rawBytes[i];
        for (; i < rowBytes; ++i) {
          currentRow[i] = (((prevRow[i] + currentRow[i - pixBytes]) >> 1) +
                           rawBytes[i]) & 0xFF;
        }
        break;
      case 4:
        // we need to save the up left pixels values. the simplest way
        // is to create a new buffer
        for (var i = 0; i < pixBytes; ++i) {
          var up = prevRow[i];
          var c = rawBytes[i];
          currentRow[i] = up + c;
        }
        for (; i < rowBytes; ++i) {
          var up = prevRow[i];
          var upLeft = prevRow[i - pixBytes];
          var left = currentRow[i - pixBytes];
          var p = left + up - upLeft;

          var pa = p - left;
          if (pa < 0)
            pa = -pa;
          var pb = p - up;
          if (pb < 0)
            pb = -pb;
          var pc = p - upLeft;
          if (pc < 0)
            pc = -pc;

          var c = rawBytes[i];
          if (pa <= pb && pa <= pc)
            currentRow[i] = left + c;
          else if (pb <= pc)
            currentRow[i] = up + c;
          else
            currentRow[i] = upLeft + c;
        }
        break;
      default:
        error('Unsupported predictor: ' + predictor);
    }
    this.bufferLength += rowBytes;
  };

  return constructor;
})();

// A JpegStream can't be read directly. We use the platform to render
// the underlying JPEG data for us.
var JpegStream = (function jpegStream() {
  function isYcckImage(bytes) {
    var maxBytesScanned = Math.max(bytes.length - 16, 1024);
    // Looking for APP14, 'Adobe' and transform = 2
    for (var i = 0; i < maxBytesScanned; ++i) {
      if (bytes[i] == 0xFF && bytes[i + 1] == 0xEE &&
          bytes[i + 2] == 0x00 && bytes[i + 3] == 0x0E &&
          bytes[i + 4] == 0x41 && bytes[i + 5] == 0x64 &&
          bytes[i + 6] == 0x6F && bytes[i + 7] == 0x62 &&
          bytes[i + 8] == 0x65 && bytes[i + 9] == 0x00)
          return bytes[i + 15] == 0x02;
      // scanning until frame tag
      if (bytes[i] == 0xFF && bytes[i + 1] == 0xC0)
        break;
    }
    return false;
  }

  function fixYcckImage(bytes) {
    // Inserting 'EMBED' marker after JPEG signature
    var embedMarker = new Uint8Array([0xFF, 0xEC, 0, 8, 0x45, 0x4D, 0x42, 0x45,
                                      0x44, 0]);
    var newBytes = new Uint8Array(bytes.length + embedMarker.length);
    newBytes.set(bytes, embedMarker.length);
    // copy JPEG header
    newBytes[0] = bytes[0];
    newBytes[1] = bytes[1];
    newBytes.set(embedMarker, 2);
    return newBytes;
  }

  function constructor(bytes, dict) {
    // TODO: per poppler, some images may have "junk" before that
    // need to be removed
    this.dict = dict;

    if (isYcckImage(bytes))
      bytes = fixYcckImage(bytes);

    // create DOM image
    var img = new Image();
    img.onload = (function jpegStreamOnload() {
      this.loaded = true;
      if (this.onLoad)
        this.onLoad();
    }).bind(this);
    img.src = 'data:image/jpeg;base64,' + window.btoa(bytesToString(bytes));
    this.domImage = img;
  }

  constructor.prototype = {
    getImage: function jpegStreamGetImage() {
      return this.domImage;
    },
    getChar: function jpegStreamGetChar() {
      error('internal error: getChar is not valid on JpegStream');
    }
  };

  return constructor;
})();

// Simple object to track the loading images
// Initialy for every that is in loading call imageLoading()
// and, when images onload is fired, call imageLoaded()
// When all images are loaded, the onLoad event is fired.
var ImagesLoader = (function imagesLoader() {
  function constructor() {
    this.loading = 0;
  }

  constructor.prototype = {
    imageLoading: function imagesLoaderImageLoading() {
      ++this.loading;
    },

    imageLoaded: function imagesLoaderImageLoaded() {
      if (--this.loading == 0 && this.onLoad) {
        this.onLoad();
        delete this.onLoad;
      }
    },

    bind: function imagesLoaderBind(jpegStream) {
      if (jpegStream.loaded)
        return;
      this.imageLoading();
      jpegStream.onLoad = this.imageLoaded.bind(this);
    },

    notifyOnLoad: function imagesLoaderNotifyOnLoad(callback) {
      if (this.loading == 0)
        callback();
      this.onLoad = callback;
    }
  };

  return constructor;
})();

var DecryptStream = (function decryptStream() {
  function constructor(str, decrypt) {
    this.str = str;
    this.dict = str.dict;
    this.decrypt = decrypt;

    DecodeStream.call(this);
  }

  var chunkSize = 512;

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBlock = function decryptStreamReadBlock() {
    var chunk = this.str.getBytes(chunkSize);
    if (!chunk || chunk.length == 0) {
      this.eof = true;
      return;
    }
    var decrypt = this.decrypt;
    chunk = decrypt(chunk);

    var bufferLength = this.bufferLength;
    var i, n = chunk.length;
    var buffer = this.ensureBuffer(bufferLength + n);
    for (i = 0; i < n; i++)
      buffer[bufferLength++] = chunk[i];
    this.bufferLength = bufferLength;
  };

  return constructor;
})();

var Ascii85Stream = (function ascii85Stream() {
  function constructor(str) {
    this.str = str;
    this.dict = str.dict;
    this.input = new Uint8Array(5);

    DecodeStream.call(this);
  }

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBlock = function ascii85StreamReadBlock() {
    var tildaCode = '~'.charCodeAt(0);
    var zCode = 'z'.charCodeAt(0);
    var str = this.str;

    var c = str.getByte();
    while (Lexer.isSpace(String.fromCharCode(c)))
      c = str.getByte();

    if (!c || c === tildaCode) {
      this.eof = true;
      return;
    }

    var bufferLength = this.bufferLength, buffer;

    // special code for z
    if (c == zCode) {
      buffer = this.ensureBuffer(bufferLength + 4);
      for (var i = 0; i < 4; ++i)
        buffer[bufferLength + i] = 0;
      this.bufferLength += 4;
    } else {
      var input = this.input;
      input[0] = c;
      for (var i = 1; i < 5; ++i) {
        c = str.getByte();
        while (Lexer.isSpace(String.fromCharCode(c)))
          c = str.getByte();

        input[i] = c;

        if (!c || c == tildaCode)
          break;
      }
      buffer = this.ensureBuffer(bufferLength + i - 1);
      this.bufferLength += i - 1;

      // partial ending;
      if (i < 5) {
        for (; i < 5; ++i)
          input[i] = 0x21 + 84;
        this.eof = true;
      }
      var t = 0;
      for (var i = 0; i < 5; ++i)
        t = t * 85 + (input[i] - 0x21);

      for (var i = 3; i >= 0; --i) {
        buffer[bufferLength + i] = t & 0xFF;
        t >>= 8;
      }
    }
  };

  return constructor;
})();

var AsciiHexStream = (function asciiHexStream() {
  function constructor(str) {
    this.str = str;
    this.dict = str.dict;

    DecodeStream.call(this);
  }

  var hexvalueMap = {
      9: -1, // \t
      32: -1, // space
      48: 0,
      49: 1,
      50: 2,
      51: 3,
      52: 4,
      53: 5,
      54: 6,
      55: 7,
      56: 8,
      57: 9,
      65: 10,
      66: 11,
      67: 12,
      68: 13,
      69: 14,
      70: 15,
      97: 10,
      98: 11,
      99: 12,
      100: 13,
      101: 14,
      102: 15
  };

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBlock = function asciiHexStreamReadBlock() {
    var gtCode = '>'.charCodeAt(0), bytes = this.str.getBytes(), c, n,
        decodeLength, buffer, bufferLength, i, length;

    decodeLength = (bytes.length + 1) >> 1;
    buffer = this.ensureBuffer(this.bufferLength + decodeLength);
    bufferLength = this.bufferLength;

    for (i = 0, length = bytes.length; i < length; i++) {
      c = hexvalueMap[bytes[i]];
      while (c == -1 && (i + 1) < length) {
        c = hexvalueMap[bytes[++i]];
      }

      if ((i + 1) < length && (bytes[i + 1] !== gtCode)) {
        n = hexvalueMap[bytes[++i]];
        buffer[bufferLength++] = c * 16 + n;
      } else {
        // EOD marker at an odd number, behave as if a 0 followed the last
        // digit.
        if (bytes[i] !== gtCode) {
          buffer[bufferLength++] = c * 16;
        }
      }
    }

    this.bufferLength = bufferLength;
    this.eof = true;
  };

  return constructor;
})();

var CCITTFaxStream = (function ccittFaxStream() {

  var ccittEOL = -2;
  var twoDimPass = 0;
  var twoDimHoriz = 1;
  var twoDimVert0 = 2;
  var twoDimVertR1 = 3;
  var twoDimVertL1 = 4;
  var twoDimVertR2 = 5;
  var twoDimVertL2 = 6;
  var twoDimVertR3 = 7;
  var twoDimVertL3 = 8;

  var twoDimTable = [
    [-1, -1], [-1, -1],               // 000000x
    [7, twoDimVertL3],                // 0000010
    [7, twoDimVertR3],                // 0000011
    [6, twoDimVertL2], [6, twoDimVertL2], // 000010x
    [6, twoDimVertR2], [6, twoDimVertR2], // 000011x
    [4, twoDimPass], [4, twoDimPass],     // 0001xxx
    [4, twoDimPass], [4, twoDimPass],
    [4, twoDimPass], [4, twoDimPass],
    [4, twoDimPass], [4, twoDimPass],
    [3, twoDimHoriz], [3, twoDimHoriz],   // 001xxxx
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimHoriz], [3, twoDimHoriz],
    [3, twoDimVertL1], [3, twoDimVertL1], // 010xxxx
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertL1], [3, twoDimVertL1],
    [3, twoDimVertR1], [3, twoDimVertR1], // 011xxxx
    [3, twoDimVertR1], [3, twoDimVertR1],
    [3, twoDimVertR1], [3, twoDimVertR1],
    [3, twoDimVertR1], [3, twoDimVertR1],
    [3, twoDimVertR1], [3, twoDimVertR1],
    [3, twoDimVertR1], [3, twoDimVertR1],
    [3, twoDimVertR1], [3, twoDimVertR1],
    [3, twoDimVertR1], [3, twoDimVertR1],
    [1, twoDimVert0], [1, twoDimVert0],   // 1xxxxxx
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0],
    [1, twoDimVert0], [1, twoDimVert0]
  ];

  var whiteTable1 = [
    [-1, -1],                 // 00000
    [12, ccittEOL],               // 00001
    [-1, -1], [-1, -1],               // 0001x
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],   // 001xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],   // 010xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],   // 011xx
    [11, 1792], [11, 1792],           // 1000x
    [12, 1984],                   // 10010
    [12, 2048],                   // 10011
    [12, 2112],                   // 10100
    [12, 2176],                   // 10101
    [12, 2240],                   // 10110
    [12, 2304],                   // 10111
    [11, 1856], [11, 1856],           // 1100x
    [11, 1920], [11, 1920],           // 1101x
    [12, 2368],                   // 11100
    [12, 2432],                   // 11101
    [12, 2496],                   // 11110
    [12, 2560]                    // 11111
  ];

  var whiteTable2 = [
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],   // 0000000xx
    [8, 29], [8, 29],             // 00000010x
    [8, 30], [8, 30],             // 00000011x
    [8, 45], [8, 45],             // 00000100x
    [8, 46], [8, 46],             // 00000101x
    [7, 22], [7, 22], [7, 22], [7, 22],       // 0000011xx
    [7, 23], [7, 23], [7, 23], [7, 23],       // 0000100xx
    [8, 47], [8, 47],             // 00001010x
    [8, 48], [8, 48],             // 00001011x
    [6, 13], [6, 13], [6, 13], [6, 13],       // 000011xxx
    [6, 13], [6, 13], [6, 13], [6, 13],
    [7, 20], [7, 20], [7, 20], [7, 20],       // 0001000xx
    [8, 33], [8, 33],             // 00010010x
    [8, 34], [8, 34],             // 00010011x
    [8, 35], [8, 35],             // 00010100x
    [8, 36], [8, 36],             // 00010101x
    [8, 37], [8, 37],             // 00010110x
    [8, 38], [8, 38],             // 00010111x
    [7, 19], [7, 19], [7, 19], [7, 19],       // 0001100xx
    [8, 31], [8, 31],             // 00011010x
    [8, 32], [8, 32],             // 00011011x
    [6, 1], [6, 1], [6, 1], [6, 1],       // 000111xxx
    [6, 1], [6, 1], [6, 1], [6, 1],
    [6, 12], [6, 12], [6, 12], [6, 12],       // 001000xxx
    [6, 12], [6, 12], [6, 12], [6, 12],
    [8, 53], [8, 53],             // 00100100x
    [8, 54], [8, 54],             // 00100101x
    [7, 26], [7, 26], [7, 26], [7, 26],       // 0010011xx
    [8, 39], [8, 39],             // 00101000x
    [8, 40], [8, 40],             // 00101001x
    [8, 41], [8, 41],             // 00101010x
    [8, 42], [8, 42],             // 00101011x
    [8, 43], [8, 43],             // 00101100x
    [8, 44], [8, 44],             // 00101101x
    [7, 21], [7, 21], [7, 21], [7, 21],       // 0010111xx
    [7, 28], [7, 28], [7, 28], [7, 28],       // 0011000xx
    [8, 61], [8, 61],             // 00110010x
    [8, 62], [8, 62],             // 00110011x
    [8, 63], [8, 63],             // 00110100x
    [8, 0], [8, 0],               // 00110101x
    [8, 320], [8, 320],               // 00110110x
    [8, 384], [8, 384],               // 00110111x
    [5, 10], [5, 10], [5, 10], [5, 10],       // 00111xxxx
    [5, 10], [5, 10], [5, 10], [5, 10],
    [5, 10], [5, 10], [5, 10], [5, 10],
    [5, 10], [5, 10], [5, 10], [5, 10],
    [5, 11], [5, 11], [5, 11], [5, 11],       // 01000xxxx
    [5, 11], [5, 11], [5, 11], [5, 11],
    [5, 11], [5, 11], [5, 11], [5, 11],
    [5, 11], [5, 11], [5, 11], [5, 11],
    [7, 27], [7, 27], [7, 27], [7, 27],       // 0100100xx
    [8, 59], [8, 59],             // 01001010x
    [8, 60], [8, 60],             // 01001011x
    [9, 1472],                    // 010011000
    [9, 1536],                    // 010011001
    [9, 1600],                    // 010011010
    [9, 1728],                    // 010011011
    [7, 18], [7, 18], [7, 18], [7, 18],       // 0100111xx
    [7, 24], [7, 24], [7, 24], [7, 24],       // 0101000xx
    [8, 49], [8, 49],             // 01010010x
    [8, 50], [8, 50],             // 01010011x
    [8, 51], [8, 51],             // 01010100x
    [8, 52], [8, 52],             // 01010101x
    [7, 25], [7, 25], [7, 25], [7, 25],       // 0101011xx
    [8, 55], [8, 55],             // 01011000x
    [8, 56], [8, 56],             // 01011001x
    [8, 57], [8, 57],             // 01011010x
    [8, 58], [8, 58],             // 01011011x
    [6, 192], [6, 192], [6, 192], [6, 192],   // 010111xxx
    [6, 192], [6, 192], [6, 192], [6, 192],
    [6, 1664], [6, 1664], [6, 1664], [6, 1664],   // 011000xxx
    [6, 1664], [6, 1664], [6, 1664], [6, 1664],
    [8, 448], [8, 448],               // 01100100x
    [8, 512], [8, 512],               // 01100101x
    [9, 704],                 // 011001100
    [9, 768],                 // 011001101
    [8, 640], [8, 640],               // 01100111x
    [8, 576], [8, 576],               // 01101000x
    [9, 832],                 // 011010010
    [9, 896],                 // 011010011
    [9, 960],                 // 011010100
    [9, 1024],                    // 011010101
    [9, 1088],                    // 011010110
    [9, 1152],                    // 011010111
    [9, 1216],                    // 011011000
    [9, 1280],                    // 011011001
    [9, 1344],                    // 011011010
    [9, 1408],                    // 011011011
    [7, 256], [7, 256], [7, 256], [7, 256],   // 0110111xx
    [4, 2], [4, 2], [4, 2], [4, 2],       // 0111xxxxx
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 2], [4, 2], [4, 2], [4, 2],
    [4, 3], [4, 3], [4, 3], [4, 3],       // 1000xxxxx
    [4, 3], [4, 3], [4, 3], [4, 3],
    [4, 3], [4, 3], [4, 3], [4, 3],
    [4, 3], [4, 3], [4, 3], [4, 3],
    [4, 3], [4, 3], [4, 3], [4, 3],
    [4, 3], [4, 3], [4, 3], [4, 3],
    [4, 3], [4, 3], [4, 3], [4, 3],
    [4, 3], [4, 3], [4, 3], [4, 3],
    [5, 128], [5, 128], [5, 128], [5, 128],   // 10010xxxx
    [5, 128], [5, 128], [5, 128], [5, 128],
    [5, 128], [5, 128], [5, 128], [5, 128],
    [5, 128], [5, 128], [5, 128], [5, 128],
    [5, 8], [5, 8], [5, 8], [5, 8],       // 10011xxxx
    [5, 8], [5, 8], [5, 8], [5, 8],
    [5, 8], [5, 8], [5, 8], [5, 8],
    [5, 8], [5, 8], [5, 8], [5, 8],
    [5, 9], [5, 9], [5, 9], [5, 9],       // 10100xxxx
    [5, 9], [5, 9], [5, 9], [5, 9],
    [5, 9], [5, 9], [5, 9], [5, 9],
    [5, 9], [5, 9], [5, 9], [5, 9],
    [6, 16], [6, 16], [6, 16], [6, 16],       // 101010xxx
    [6, 16], [6, 16], [6, 16], [6, 16],
    [6, 17], [6, 17], [6, 17], [6, 17],       // 101011xxx
    [6, 17], [6, 17], [6, 17], [6, 17],
    [4, 4], [4, 4], [4, 4], [4, 4],       // 1011xxxxx
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 5], [4, 5], [4, 5], [4, 5],       // 1100xxxxx
    [4, 5], [4, 5], [4, 5], [4, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
    [4, 5], [4, 5], [4, 5], [4, 5],
    [6, 14], [6, 14], [6, 14], [6, 14],       // 110100xxx
    [6, 14], [6, 14], [6, 14], [6, 14],
    [6, 15], [6, 15], [6, 15], [6, 15],       // 110101xxx
    [6, 15], [6, 15], [6, 15], [6, 15],
    [5, 64], [5, 64], [5, 64], [5, 64],       // 11011xxxx
    [5, 64], [5, 64], [5, 64], [5, 64],
    [5, 64], [5, 64], [5, 64], [5, 64],
    [5, 64], [5, 64], [5, 64], [5, 64],
    [4, 6], [4, 6], [4, 6], [4, 6],       // 1110xxxxx
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 6], [4, 6], [4, 6], [4, 6],
    [4, 7], [4, 7], [4, 7], [4, 7],       // 1111xxxxx
    [4, 7], [4, 7], [4, 7], [4, 7],
    [4, 7], [4, 7], [4, 7], [4, 7],
    [4, 7], [4, 7], [4, 7], [4, 7],
    [4, 7], [4, 7], [4, 7], [4, 7],
    [4, 7], [4, 7], [4, 7], [4, 7],
    [4, 7], [4, 7], [4, 7], [4, 7],
    [4, 7], [4, 7], [4, 7], [4, 7]
  ];

  var blackTable1 = [
    [-1, -1], [-1, -1],                   // 000000000000x
    [12, ccittEOL], [12, ccittEOL],           // 000000000001x
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000001xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000010xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000011xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000100xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000101xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000110xx
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 00000000111xx
    [11, 1792], [11, 1792], [11, 1792], [11, 1792],   // 00000001000xx
    [12, 1984], [12, 1984],               // 000000010010x
    [12, 2048], [12, 2048],               // 000000010011x
    [12, 2112], [12, 2112],               // 000000010100x
    [12, 2176], [12, 2176],               // 000000010101x
    [12, 2240], [12, 2240],               // 000000010110x
    [12, 2304], [12, 2304],               // 000000010111x
    [11, 1856], [11, 1856], [11, 1856], [11, 1856],   // 00000001100xx
    [11, 1920], [11, 1920], [11, 1920], [11, 1920],   // 00000001101xx
    [12, 2368], [12, 2368],               // 000000011100x
    [12, 2432], [12, 2432],               // 000000011101x
    [12, 2496], [12, 2496],               // 000000011110x
    [12, 2560], [12, 2560],               // 000000011111x
    [10, 18], [10, 18], [10, 18], [10, 18],       // 0000001000xxx
    [10, 18], [10, 18], [10, 18], [10, 18],
    [12, 52], [12, 52],                   // 000000100100x
    [13, 640],                        // 0000001001010
    [13, 704],                        // 0000001001011
    [13, 768],                        // 0000001001100
    [13, 832],                        // 0000001001101
    [12, 55], [12, 55],                   // 000000100111x
    [12, 56], [12, 56],                   // 000000101000x
    [13, 1280],                       // 0000001010010
    [13, 1344],                       // 0000001010011
    [13, 1408],                       // 0000001010100
    [13, 1472],                       // 0000001010101
    [12, 59], [12, 59],                   // 000000101011x
    [12, 60], [12, 60],                   // 000000101100x
    [13, 1536],                       // 0000001011010
    [13, 1600],                       // 0000001011011
    [11, 24], [11, 24], [11, 24], [11, 24],       // 00000010111xx
    [11, 25], [11, 25], [11, 25], [11, 25],       // 00000011000xx
    [13, 1664],                       // 0000001100100
    [13, 1728],                       // 0000001100101
    [12, 320], [12, 320],                 // 000000110011x
    [12, 384], [12, 384],                 // 000000110100x
    [12, 448], [12, 448],                 // 000000110101x
    [13, 512],                        // 0000001101100
    [13, 576],                        // 0000001101101
    [12, 53], [12, 53],                   // 000000110111x
    [12, 54], [12, 54],                   // 000000111000x
    [13, 896],                        // 0000001110010
    [13, 960],                        // 0000001110011
    [13, 1024],                       // 0000001110100
    [13, 1088],                       // 0000001110101
    [13, 1152],                       // 0000001110110
    [13, 1216],                       // 0000001110111
    [10, 64], [10, 64], [10, 64], [10, 64],       // 0000001111xxx
    [10, 64], [10, 64], [10, 64], [10, 64]
  ];

  var blackTable2 = [
    [8, 13], [8, 13], [8, 13], [8, 13],           // 00000100xxxx
    [8, 13], [8, 13], [8, 13], [8, 13],
    [8, 13], [8, 13], [8, 13], [8, 13],
    [8, 13], [8, 13], [8, 13], [8, 13],
    [11, 23], [11, 23],                   // 00000101000x
    [12, 50],                     // 000001010010
    [12, 51],                     // 000001010011
    [12, 44],                     // 000001010100
    [12, 45],                     // 000001010101
    [12, 46],                     // 000001010110
    [12, 47],                     // 000001010111
    [12, 57],                     // 000001011000
    [12, 58],                     // 000001011001
    [12, 61],                     // 000001011010
    [12, 256],                        // 000001011011
    [10, 16], [10, 16], [10, 16], [10, 16],       // 0000010111xx
    [10, 17], [10, 17], [10, 17], [10, 17],       // 0000011000xx
    [12, 48],                     // 000001100100
    [12, 49],                     // 000001100101
    [12, 62],                     // 000001100110
    [12, 63],                     // 000001100111
    [12, 30],                     // 000001101000
    [12, 31],                     // 000001101001
    [12, 32],                     // 000001101010
    [12, 33],                     // 000001101011
    [12, 40],                     // 000001101100
    [12, 41],                     // 000001101101
    [11, 22], [11, 22],                   // 00000110111x
    [8, 14], [8, 14], [8, 14], [8, 14],           // 00000111xxxx
    [8, 14], [8, 14], [8, 14], [8, 14],
    [8, 14], [8, 14], [8, 14], [8, 14],
    [8, 14], [8, 14], [8, 14], [8, 14],
    [7, 10], [7, 10], [7, 10], [7, 10],           // 0000100xxxxx
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 10], [7, 10], [7, 10], [7, 10],
    [7, 11], [7, 11], [7, 11], [7, 11],           // 0000101xxxxx
    [7, 11], [7, 11], [7, 11], [7, 11],
    [7, 11], [7, 11], [7, 11], [7, 11],
    [7, 11], [7, 11], [7, 11], [7, 11],
    [7, 11], [7, 11], [7, 11], [7, 11],
    [7, 11], [7, 11], [7, 11], [7, 11],
    [7, 11], [7, 11], [7, 11], [7, 11],
    [7, 11], [7, 11], [7, 11], [7, 11],
    [9, 15], [9, 15], [9, 15], [9, 15],           // 000011000xxx
    [9, 15], [9, 15], [9, 15], [9, 15],
    [12, 128],                        // 000011001000
    [12, 192],                        // 000011001001
    [12, 26],                     // 000011001010
    [12, 27],                     // 000011001011
    [12, 28],                     // 000011001100
    [12, 29],                     // 000011001101
    [11, 19], [11, 19],                   // 00001100111x
    [11, 20], [11, 20],                   // 00001101000x
    [12, 34],                     // 000011010010
    [12, 35],                     // 000011010011
    [12, 36],                     // 000011010100
    [12, 37],                     // 000011010101
    [12, 38],                     // 000011010110
    [12, 39],                     // 000011010111
    [11, 21], [11, 21],                   // 00001101100x
    [12, 42],                     // 000011011010
    [12, 43],                     // 000011011011
    [10, 0], [10, 0], [10, 0], [10, 0],           // 0000110111xx
    [7, 12], [7, 12], [7, 12], [7, 12],           // 0000111xxxxx
    [7, 12], [7, 12], [7, 12], [7, 12],
    [7, 12], [7, 12], [7, 12], [7, 12],
    [7, 12], [7, 12], [7, 12], [7, 12],
    [7, 12], [7, 12], [7, 12], [7, 12],
    [7, 12], [7, 12], [7, 12], [7, 12],
    [7, 12], [7, 12], [7, 12], [7, 12],
    [7, 12], [7, 12], [7, 12], [7, 12]
  ];

  var blackTable3 = [
    [-1, -1], [-1, -1], [-1, -1], [-1, -1],       // 0000xx
    [6, 9],                       // 000100
    [6, 8],                       // 000101
    [5, 7], [5, 7],                   // 00011x
    [4, 6], [4, 6], [4, 6], [4, 6],           // 0010xx
    [4, 5], [4, 5], [4, 5], [4, 5],           // 0011xx
    [3, 1], [3, 1], [3, 1], [3, 1],           // 010xxx
    [3, 1], [3, 1], [3, 1], [3, 1],
    [3, 4], [3, 4], [3, 4], [3, 4],           // 011xxx
    [3, 4], [3, 4], [3, 4], [3, 4],
    [2, 3], [2, 3], [2, 3], [2, 3],           // 10xxxx
    [2, 3], [2, 3], [2, 3], [2, 3],
    [2, 3], [2, 3], [2, 3], [2, 3],
    [2, 3], [2, 3], [2, 3], [2, 3],
    [2, 2], [2, 2], [2, 2], [2, 2],           // 11xxxx
    [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2]
  ];

  function constructor(str, params) {
    this.str = str;
    this.dict = str.dict;

    params = params || new Dict();

    this.encoding = params.get('K') || 0;
    this.eoline = params.get('EndOfLine') || false;
    this.byteAlign = params.get('EncodedByteAlign') || false;
    this.columns = params.get('Columns') || 1728;
    this.rows = params.get('Rows') || 0;
    var eoblock = params.get('EndOfBlock');
    if (eoblock == null)
      eoblock = true;
    this.eoblock = eoblock;
    this.black = params.get('BlackIs1') || false;

    this.codingLine = new Uint32Array(this.columns + 1);
    this.refLine = new Uint32Array(this.columns + 2);

    this.codingLine[0] = this.columns;
    this.codingPos = 0;

    this.row = 0;
    this.nextLine2D = this.encoding < 0;
    this.inputBits = 0;
    this.inputBuf = 0;
    this.outputBits = 0;
    this.buf = EOF;

    var code1;
    while ((code1 = this.lookBits(12)) == 0) {
      this.eatBits(1);
    }
    if (code1 == 1) {
      this.eatBits(12);
    }
    if (this.encoding > 0) {
      this.nextLine2D = !this.lookBits(1);
      this.eatBits(1);
    }

    DecodeStream.call(this);
  }

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBlock = function ccittFaxStreamReadBlock() {
    while (!this.eof) {
      var c = this.lookChar();
      this.buf = EOF;
      this.ensureBuffer(this.bufferLength + 1);
      this.buffer[this.bufferLength++] = c;
    }
  };

  constructor.prototype.addPixels =
    function ccittFaxStreamAddPixels(a1, blackPixels) {
    var codingLine = this.codingLine;
    var codingPos = this.codingPos;

    if (a1 > codingLine[codingPos]) {
      if (a1 > this.columns) {
        warn('row is wrong length');
        this.err = true;
        a1 = this.columns;
      }
      if ((codingPos & 1) ^ blackPixels) {
        ++codingPos;
      }

      codingLine[codingPos] = a1;
    }
    this.codingPos = codingPos;
  };

  constructor.prototype.addPixelsNeg =
    function ccittFaxStreamAddPixelsNeg(a1, blackPixels) {
    var codingLine = this.codingLine;
    var codingPos = this.codingPos;

    if (a1 > codingLine[codingPos]) {
      if (a1 > this.columns) {
        warn('row is wrong length');
        this.err = true;
        a1 = this.columns;
      }
      if ((codingPos & 1) ^ blackPixels)
        ++codingPos;

      codingLine[codingPos] = a1;
    } else if (a1 < codingLine[codingPos]) {
      if (a1 < 0) {
        warn('invalid code');
        this.err = true;
        a1 = 0;
      }
      while (codingPos > 0 && a1 < codingLine[codingPos - 1])
        --codingPos;
      codingLine[codingPos] = a1;
    }

    this.codingPos = codingPos;
  };

  constructor.prototype.lookChar = function ccittFaxStreamLookChar() {
    if (this.buf != EOF)
      return this.buf;

    var refLine = this.refLine;
    var codingLine = this.codingLine;
    var columns = this.columns;

    var refPos, blackPixels, bits;

    if (this.outputBits == 0) {
      if (this.eof)
        return null;

      this.err = false;

      var code1, code2, code3;
      if (this.nextLine2D) {
        for (var i = 0; codingLine[i] < columns; ++i)
          refLine[i] = codingLine[i];

        refLine[i++] = columns;
        refLine[i] = columns;
        codingLine[0] = 0;
        this.codingPos = 0;
        refPos = 0;
        blackPixels = 0;

        while (codingLine[this.codingPos] < columns) {
          code1 = this.getTwoDimCode();
          switch (code1) {
            case twoDimPass:
              this.addPixels(refLine[refPos + 1], blackPixels);
              if (refLine[refPos + 1] < columns)
                refPos += 2;
              break;
            case twoDimHoriz:
              code1 = code2 = 0;
              if (blackPixels) {
                do {
                  code1 += (code3 = this.getBlackCode());
                } while (code3 >= 64);
                do {
                  code2 += (code3 = this.getWhiteCode());
                } while (code3 >= 64);
              } else {
                do {
                  code1 += (code3 = this.getWhiteCode());
                } while (code3 >= 64);
                do {
                  code2 += (code3 = this.getBlackCode());
                } while (code3 >= 64);
              }
              this.addPixels(codingLine[this.codingPos] +
                             code1, blackPixels);
              if (codingLine[this.codingPos] < columns) {
                this.addPixels(codingLine[this.codingPos] + code2,
                               blackPixels ^ 1);
              }
              while (refLine[refPos] <= codingLine[this.codingPos] &&
                     refLine[refPos] < columns) {
                refPos += 2;
              }
              break;
            case twoDimVertR3:
              this.addPixels(refLine[refPos] + 3, blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                ++refPos;
                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns)
                  refPos += 2;
              }
              break;
            case twoDimVertR2:
              this.addPixels(refLine[refPos] + 2, blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                ++refPos;
                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns) {
                  refPos += 2;
                }
              }
              break;
            case twoDimVertR1:
              this.addPixels(refLine[refPos] + 1, blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                ++refPos;
                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns)
                  refPos += 2;
              }
              break;
            case twoDimVert0:
              this.addPixels(refLine[refPos], blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                ++refPos;
                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns)
                  refPos += 2;
              }
              break;
            case twoDimVertL3:
              this.addPixelsNeg(refLine[refPos] - 3, blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                if (refPos > 0)
                  --refPos;
                else
                  ++refPos;
                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns)
                  refPos += 2;
              }
              break;
            case twoDimVertL2:
              this.addPixelsNeg(refLine[refPos] - 2, blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                if (refPos > 0)
                  --refPos;
                else
                  ++refPos;
                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns)
                  refPos += 2;
              }
              break;
            case twoDimVertL1:
              this.addPixelsNeg(refLine[refPos] - 1, blackPixels);
              blackPixels ^= 1;
              if (codingLine[this.codingPos] < columns) {
                if (refPos > 0)
                  --refPos;
                else
                  ++refPos;

                while (refLine[refPos] <= codingLine[this.codingPos] &&
                       refLine[refPos] < columns)
                  refPos += 2;
              }
              break;
            case EOF:
              this.addPixels(columns, 0);
              this.eof = true;
              break;
            default:
              warn('bad 2d code');
              this.addPixels(columns, 0);
              this.err = true;
          }
        }
      } else {
        codingLine[0] = 0;
        this.codingPos = 0;
        blackPixels = 0;
        while (codingLine[this.codingPos] < columns) {
          code1 = 0;
          if (blackPixels) {
            do {
              code1 += (code3 = this.getBlackCode());
            } while (code3 >= 64);
          } else {
            do {
              code1 += (code3 = this.getWhiteCode());
            } while (code3 >= 64);
          }
          this.addPixels(codingLine[this.codingPos] + code1, blackPixels);
          blackPixels ^= 1;
        }
      }

      if (this.byteAlign)
        this.inputBits &= ~7;

      var gotEOL = false;

      if (!this.eoblock && this.row == this.rows - 1) {
        this.eof = true;
      } else {
        code1 = this.lookBits(12);
        while (code1 == 0) {
          this.eatBits(1);
          code1 = this.lookBits(12);
        }
        if (code1 == 1) {
          this.eatBits(12);
          gotEOL = true;
        } else if (code1 == EOF) {
          this.eof = true;
        }
      }

      if (!this.eof && this.encoding > 0) {
        this.nextLine2D = !this.lookBits(1);
        this.eatBits(1);
      }

      if (this.eoblock && gotEOL) {
        code1 = this.lookBits(12);
        if (code1 == 1) {
          this.eatBits(12);
          if (this.encoding > 0) {
            this.lookBits(1);
            this.eatBits(1);
          }
          if (this.encoding >= 0) {
            for (var i = 0; i < 4; ++i) {
              code1 = this.lookBits(12);
              if (code1 != 1)
                warn('bad rtc code: ' + code1);
              this.eatBits(12);
              if (this.encoding > 0) {
                this.lookBits(1);
                this.eatBits(1);
              }
            }
          }
          this.eof = true;
        }
      } else if (this.err && this.eoline) {
        while (true) {
          code1 = this.lookBits(13);
          if (code1 == EOF) {
            this.eof = true;
            return null;
          }
          if ((code1 >> 1) == 1) {
            break;
          }
          this.eatBits(1);
        }
        this.eatBits(12);
        if (this.encoding > 0) {
          this.eatBits(1);
          this.nextLine2D = !(code1 & 1);
        }
      }

      if (codingLine[0] > 0)
        this.outputBits = codingLine[this.codingPos = 0];
      else
        this.outputBits = codingLine[this.codingPos = 1];
      this.row++;
    }

    if (this.outputBits >= 8) {
      this.buf = (this.codingPos & 1) ? 0 : 0xFF;
      this.outputBits -= 8;
      if (this.outputBits == 0 && codingLine[this.codingPos] < columns) {
        this.codingPos++;
        this.outputBits = (codingLine[this.codingPos] -
                           codingLine[this.codingPos - 1]);
      }
    } else {
      var bits = 8;
      this.buf = 0;
      do {
        if (this.outputBits > bits) {
          this.buf <<= bits;
          if (!(this.codingPos & 1)) {
            this.buf |= 0xFF >> (8 - bits);
          }
          this.outputBits -= bits;
          bits = 0;
        } else {
          this.buf <<= this.outputBits;
          if (!(this.codingPos & 1)) {
            this.buf |= 0xFF >> (8 - this.outputBits);
          }
          bits -= this.outputBits;
          this.outputBits = 0;
          if (codingLine[this.codingPos] < columns) {
            this.codingPos++;
            this.outputBits = (codingLine[this.codingPos] -
                               codingLine[this.codingPos - 1]);
          } else if (bits > 0) {
            this.buf <<= bits;
            bits = 0;
          }
        }
      } while (bits);
    }
    if (this.black) {
      this.buf ^= 0xFF;
    }
    return this.buf;
  };

  constructor.prototype.getTwoDimCode = function ccittFaxStreamGetTwoDimCode() {
    var code = 0;
    var p;
    if (this.eoblock) {
      code = this.lookBits(7);
      p = twoDimTable[code];
      if (p[0] > 0) {
        this.eatBits(p[0]);
        return p[1];
      }
    } else {
      for (var n = 1; n <= 7; ++n) {
        code = this.lookBits(n);
        if (n < 7) {
          code <<= 7 - n;
        }
        p = twoDimTable[code];
        if (p[0] == n) {
          this.eatBits(n);
          return p[1];
        }
      }
    }
    warn('Bad two dim code');
    return EOF;
  };

  constructor.prototype.getWhiteCode = function ccittFaxStreamGetWhiteCode() {
    var code = 0;
    var p;
    var n;
    if (this.eoblock) {
      code = this.lookBits(12);
      if (code == EOF)
        return 1;

      if ((code >> 5) == 0)
        p = whiteTable1[code];
      else
        p = whiteTable2[code >> 3];

      if (p[0] > 0) {
        this.eatBits(p[0]);
        return p[1];
      }
    } else {
      for (var n = 1; n <= 9; ++n) {
        code = this.lookBits(n);
        if (code == EOF)
          return 1;

        if (n < 9)
          code <<= 9 - n;
        p = whiteTable2[code];
        if (p[0] == n) {
          this.eatBits(n);
          return p[0];
        }
      }
      for (var n = 11; n <= 12; ++n) {
        code = this.lookBits(n);
        if (code == EOF)
          return 1;
        if (n < 12)
          code <<= 12 - n;
        p = whiteTable1[code];
        if (p[0] == n) {
          this.eatBits(n);
          return p[1];
        }
      }
    }
    warn('bad white code');
    this.eatBits(1);
    return 1;
  };

  constructor.prototype.getBlackCode = function ccittFaxStreamGetBlackCode() {
    var code, p;
    if (this.eoblock) {
      code = this.lookBits(13);
      if (code == EOF)
        return 1;
      if ((code >> 7) == 0)
        p = blackTable1[code];
      else if ((code >> 9) == 0 && (code >> 7) != 0)
        p = blackTable2[(code >> 1) - 64];
      else
        p = blackTable3[code >> 7];

      if (p[0] > 0) {
        this.eatBits(p[0]);
        return p[1];
      }
    } else {
      var n;
      for (n = 2; n <= 6; ++n) {
        code = this.lookBits(n);
        if (code == EOF)
          return 1;
        if (n < 6)
          code <<= 6 - n;
        p = blackTable3[code];
        if (p[0] == n) {
          this.eatBits(n);
          return p[1];
        }
      }
      for (n = 7; n <= 12; ++n) {
        code = this.lookBits(n);
        if (code == EOF)
          return 1;
        if (n < 12)
          code <<= 12 - n;
        if (code >= 64) {
          p = blackTable2[code - 64];
          if (p[0] == n) {
            this.eatBits(n);
            return p[1];
          }
        }
      }
      for (n = 10; n <= 13; ++n) {
        code = this.lookBits(n);
        if (code == EOF)
          return 1;
        if (n < 13)
          code <<= 13 - n;
        p = blackTable1[code];
        if (p[0] == n) {
          this.eatBits(n);
          return p[1];
        }
      }
    }
    warn('bad black code');
    this.eatBits(1);
    return 1;
  };

  constructor.prototype.lookBits = function ccittFaxStreamLookBits(n) {
    var c;
    while (this.inputBits < n) {
      if ((c = this.str.getByte()) == null) {
        if (this.inputBits == 0)
          return EOF;
        return ((this.inputBuf << (n - this.inputBits)) &
                (0xFFFF >> (16 - n)));
      }
      this.inputBuf = (this.inputBuf << 8) + c;
      this.inputBits += 8;
    }
    return (this.inputBuf >> (this.inputBits - n)) & (0xFFFF >> (16 - n));
  };

  constructor.prototype.eatBits = function ccittFaxStreamEatBits(n) {
    if ((this.inputBits -= n) < 0)
      this.inputBits = 0;
  };

  return constructor;
})();

var LZWStream = (function lzwStream() {
  function constructor(str, earlyChange) {
    this.str = str;
    this.dict = str.dict;
    this.cachedData = 0;
    this.bitsCached = 0;

    var maxLzwDictionarySize = 4096;
    var lzwState = {
      earlyChange: earlyChange,
      codeLength: 9,
      nextCode: 258,
      dictionaryValues: new Uint8Array(maxLzwDictionarySize),
      dictionaryLengths: new Uint16Array(maxLzwDictionarySize),
      dictionaryPrevCodes: new Uint16Array(maxLzwDictionarySize),
      currentSequence: new Uint8Array(maxLzwDictionarySize),
      currentSequenceLength: 0
    };
    for (var i = 0; i < 256; ++i) {
      lzwState.dictionaryValues[i] = i;
      lzwState.dictionaryLengths[i] = 1;
    }
    this.lzwState = lzwState;

    DecodeStream.call(this);
  }

  constructor.prototype = Object.create(DecodeStream.prototype);

  constructor.prototype.readBits = function lzwStreamReadBits(n) {
    var bitsCached = this.bitsCached;
    var cachedData = this.cachedData;
    while (bitsCached < n) {
      var c = this.str.getByte();
      if (c == null) {
        this.eof = true;
        return null;
      }
      cachedData = (cachedData << 8) | c;
      bitsCached += 8;
    }
    this.bitsCached = (bitsCached -= n);
    this.cachedData = cachedData;
    this.lastCode = null;
    return (cachedData >>> bitsCached) & ((1 << n) - 1);
  };

  constructor.prototype.readBlock = function lzwStreamReadBlock() {
    var blockSize = 512;
    var estimatedDecodedSize = blockSize * 2, decodedSizeDelta = blockSize;
    var i, j, q;

    var lzwState = this.lzwState;
    if (!lzwState)
      return; // eof was found

    var earlyChange = lzwState.earlyChange;
    var nextCode = lzwState.nextCode;
    var dictionaryValues = lzwState.dictionaryValues;
    var dictionaryLengths = lzwState.dictionaryLengths;
    var dictionaryPrevCodes = lzwState.dictionaryPrevCodes;
    var codeLength = lzwState.codeLength;
    var prevCode = lzwState.prevCode;
    var currentSequence = lzwState.currentSequence;
    var currentSequenceLength = lzwState.currentSequenceLength;

    var decodedLength = 0;
    var currentBufferLength = this.bufferLength;
    var buffer = this.ensureBuffer(this.bufferLength + estimatedDecodedSize);

    for (i = 0; i < blockSize; i++) {
      var code = this.readBits(codeLength);
      var hasPrev = currentSequenceLength > 0;
      if (code < 256) {
        currentSequence[0] = code;
        currentSequenceLength = 1;
      } else if (code >= 258) {
        if (code < nextCode) {
          currentSequenceLength = dictionaryLengths[code];
          for (j = currentSequenceLength - 1, q = code; j >= 0; j--) {
            currentSequence[j] = dictionaryValues[q];
            q = dictionaryPrevCodes[q];
          }
        } else {
          currentSequence[currentSequenceLength++] = currentSequence[0];
        }
      } else if (code == 256) {
        codeLength = 9;
        nextCode = 258;
        currentSequenceLength = 0;
        continue;
      } else {
        this.eof = true;
        delete this.lzwState;
        break;
      }

      if (hasPrev) {
        dictionaryPrevCodes[nextCode] = prevCode;
        dictionaryLengths[nextCode] = dictionaryLengths[prevCode] + 1;
        dictionaryValues[nextCode] = currentSequence[0];
        nextCode++;
        codeLength = (nextCode + earlyChange) & (nextCode + earlyChange - 1) ?
          codeLength : Math.min(Math.log(nextCode + earlyChange) /
          0.6931471805599453 + 1, 12) | 0;
      }
      prevCode = code;

      decodedLength += currentSequenceLength;
      if (estimatedDecodedSize < decodedLength) {
        do {
          estimatedDecodedSize += decodedSizeDelta;
        } while (estimatedDecodedSize < decodedLength);
        buffer = this.ensureBuffer(this.bufferLength + estimatedDecodedSize);
      }
      for (j = 0; j < currentSequenceLength; j++)
        buffer[currentBufferLength++] = currentSequence[j];
    }
    lzwState.nextCode = nextCode;
    lzwState.codeLength = codeLength;
    lzwState.prevCode = prevCode;
    lzwState.currentSequenceLength = currentSequenceLength;

    this.bufferLength = currentBufferLength;
  };

  return constructor;
})();


var Name = (function nameName() {
  function constructor(name) {
    this.name = name;
  }

  constructor.prototype = {
  };

  return constructor;
})();

var Cmd = (function cmdCmd() {
  function constructor(cmd) {
    this.cmd = cmd;
  }

  constructor.prototype = {
  };

  return constructor;
})();

var Dict = (function dictDict() {
  function constructor() {
    this.map = Object.create(null);
  }

  constructor.prototype = {
    get: function dictGet(key1, key2, key3) {
      var value;
      if (typeof (value = this.map[key1]) != 'undefined' || key1 in this.map ||
          typeof key2 == 'undefined') {
        return value;
      }
      if (typeof (value = this.map[key2]) != 'undefined' || key2 in this.map ||
          typeof key3 == 'undefined') {
        return value;
      }

      return this.map[key3] || null;
    },

    set: function dictSet(key, value) {
      this.map[key] = value;
    },

    has: function dictHas(key) {
      return key in this.map;
    },

    forEach: function dictForEach(callback) {
      for (var key in this.map) {
        callback(key, this.map[key]);
      }
    }
  };

  return constructor;
})();

var Ref = (function refRef() {
  function constructor(num, gen) {
    this.num = num;
    this.gen = gen;
  }

  constructor.prototype = {
  };

  return constructor;
})();

// The reference is identified by number and generation,
// this structure stores only one instance of the reference.
var RefSet = (function refSet() {
  function constructor() {
    this.dict = {};
  }

  constructor.prototype = {
    has: function refSetHas(ref) {
      return !!this.dict['R' + ref.num + '.' + ref.gen];
    },

    put: function refSetPut(ref) {
      this.dict['R' + ref.num + '.' + ref.gen] = ref;
    }
  };

  return constructor;
})();

function IsBool(v) {
  return typeof v == 'boolean';
}

function IsInt(v) {
  return typeof v == 'number' && ((v | 0) == v);
}

function IsNum(v) {
  return typeof v == 'number';
}

function IsString(v) {
  return typeof v == 'string';
}

function IsNull(v) {
  return v === null;
}

function IsName(v) {
  return v instanceof Name;
}

function IsCmd(v, cmd) {
  return v instanceof Cmd && (!cmd || v.cmd == cmd);
}

function IsDict(v, type) {
  return v instanceof Dict && (!type || v.get('Type').name == type);
}

function IsArray(v) {
  return v instanceof Array;
}

function IsStream(v) {
  return typeof v == 'object' && v != null && ('getChar' in v);
}

function IsRef(v) {
  return v instanceof Ref;
}

function IsPDFFunction(v) {
  var fnDict;
  if (typeof v != 'object')
    return false;
  else if (IsDict(v))
    fnDict = v;
  else if (IsStream(v))
    fnDict = v.dict;
  else
    return false;
  return fnDict.has('FunctionType');
}

var EOF = {};

function IsEOF(v) {
  return v == EOF;
}

var None = {};

function IsNone(v) {
  return v == None;
}

var Lexer = (function lexer() {
  function constructor(stream) {
    this.stream = stream;
  }

  constructor.isSpace = function lexerIsSpace(ch) {
    return ch == ' ' || ch == '\t' || ch == '\x0d' || ch == '\x0a';
  };

  // A '1' in this array means the character is white space.  A '1' or
  // '2' means the character ends a name or command.
  var specialChars = [
    1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0,   // 0x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 1x
    1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2,   // 2x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0,   // 3x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 4x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0,   // 5x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 6x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0,   // 7x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 8x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 9x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // ax
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // bx
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // cx
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // dx
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // ex
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0    // fx
  ];

  function ToHexDigit(ch) {
    if (ch >= '0' && ch <= '9')
      return ch.charCodeAt(0) - 48;
    ch = ch.toUpperCase();
    if (ch >= 'A' && ch <= 'F')
      return ch.charCodeAt(0) - 55;
    return -1;
  }

  constructor.prototype = {
    getNumber: function lexerGetNumber(ch) {
      var floating = false;
      var str = ch;
      var stream = this.stream;
      for (;;) {
        ch = stream.lookChar();
        if (ch == '.' && !floating) {
          str += ch;
          floating = true;
        } else if (ch == '-') {
          // ignore minus signs in the middle of numbers to match
          // Adobe's behavior
          warn('Badly formated number');
        } else if (ch >= '0' && ch <= '9') {
          str += ch;
        } else if (ch == 'e' || ch == 'E') {
          floating = true;
        } else {
          // the last character doesn't belong to us
          break;
        }
        stream.skip();
      }
      var value = parseFloat(str);
      if (isNaN(value))
        error('Invalid floating point number: ' + value);
      return value;
    },
    getString: function lexerGetString() {
      var numParen = 1;
      var done = false;
      var str = '';
      var stream = this.stream;
      var ch;
      do {
        ch = stream.getChar();
        switch (ch) {
          case undefined:
            warn('Unterminated string');
            done = true;
            break;
          case '(':
            ++numParen;
            str += ch;
            break;
          case ')':
            if (--numParen == 0) {
              done = true;
            } else {
              str += ch;
            }
            break;
          case '\\':
            ch = stream.getChar();
            switch (ch) {
              case undefined:
                warn('Unterminated string');
                done = true;
                break;
              case 'n':
                str += '\n';
                break;
              case 'r':
                str += '\r';
                break;
              case 't':
                str += '\t';
                break;
              case 'b':
                str += '\b';
                break;
              case 'f':
                str += '\f';
                break;
              case '\\':
              case '(':
              case ')':
                str += ch;
                break;
              case '0': case '1': case '2': case '3':
              case '4': case '5': case '6': case '7':
                var x = ch - '0';
                ch = stream.lookChar();
                if (ch >= '0' && ch <= '7') {
                  stream.skip();
                  x = (x << 3) + (ch - '0');
                  ch = stream.lookChar();
                  if (ch >= '0' && ch <= '7') {
                    stream.skip();
                    x = (x << 3) + (ch - '0');
                  }
                }

                str += String.fromCharCode(x);
                break;
              case '\r':
                ch = stream.lookChar();
                if (ch == '\n')
                  stream.skip();
                break;
              case '\n':
                break;
              default:
                str += ch;
            }
            break;
          default:
            str += ch;
        }
      } while (!done);
      return str;
    },
    getName: function lexerGetName(ch) {
      var str = '';
      var stream = this.stream;
      while (!!(ch = stream.lookChar()) && !specialChars[ch.charCodeAt(0)]) {
        stream.skip();
        if (ch == '#') {
          ch = stream.lookChar();
          var x = ToHexDigit(ch);
          if (x != -1) {
            stream.skip();
            var x2 = ToHexDigit(stream.getChar());
            if (x2 == -1)
              error('Illegal digit in hex char in name: ' + x2);
            str += String.fromCharCode((x << 4) | x2);
          } else {
            str += '#';
            str += ch;
          }
        } else {
          str += ch;
        }
      }
      if (str.length > 128)
        error('Warning: name token is longer than allowed by the spec: ' +
              str.length);
      return new Name(str);
    },
    getHexString: function lexerGetHexString(ch) {
      var str = '';
      var stream = this.stream;
      for (;;) {
        ch = stream.getChar();
        if (ch == '>') {
          break;
        }
        if (!ch) {
          warn('Unterminated hex string');
          break;
        }
        if (specialChars[ch.charCodeAt(0)] != 1) {
          var x, x2;
          if ((x = ToHexDigit(ch)) == -1)
            error('Illegal character in hex string: ' + ch);

          ch = stream.getChar();
          while (specialChars[ch.charCodeAt(0)] == 1)
            ch = stream.getChar();

          if ((x2 = ToHexDigit(ch)) == -1)
            error('Illegal character in hex string: ' + ch);

          str += String.fromCharCode((x << 4) | x2);
        }
      }
      return str;
    },
    getObj: function lexerGetObj() {
      // skip whitespace and comments
      var comment = false;
      var stream = this.stream;
      var ch;
      while (true) {
        if (!(ch = stream.getChar()))
          return EOF;
        if (comment) {
          if (ch == '\r' || ch == '\n')
            comment = false;
        } else if (ch == '%') {
          comment = true;
        } else if (specialChars[ch.charCodeAt(0)] != 1) {
          break;
        }
      }

      // start reading token
      switch (ch) {
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8': case '9':
        case '+': case '-': case '.':
          return this.getNumber(ch);
        case '(':
          return this.getString();
        case '/':
          return this.getName(ch);
        // array punctuation
        case '[':
        case ']':
          return new Cmd(ch);
        // hex string or dict punctuation
        case '<':
          ch = stream.lookChar();
          if (ch == '<') {
            // dict punctuation
            stream.skip();
            return new Cmd('<<');
          }
          return this.getHexString(ch);
        // dict punctuation
        case '>':
          ch = stream.lookChar();
          if (ch == '>') {
            stream.skip();
            return new Cmd('>>');
          }
        case '{':
        case '}':
          return new Cmd(ch);
        // fall through
        case ')':
          error('Illegal character: ' + ch);
          return Error;
      }

      // command
      var str = ch;
      while (!!(ch = stream.lookChar()) && !specialChars[ch.charCodeAt(0)]) {
        stream.skip();
        if (str.length == 128) {
          error('Command token too long: ' + str.length);
          break;
        }
        str += ch;
      }
      if (str == 'true')
        return true;
      if (str == 'false')
        return false;
      if (str == 'null')
        return null;
      return new Cmd(str);
    },
    skipToNextLine: function lexerSkipToNextLine() {
      var stream = this.stream;
      while (true) {
        var ch = stream.getChar();
        if (!ch || ch == '\n')
          return;
        if (ch == '\r') {
          if ((ch = stream.lookChar()) == '\n')
            stream.skip();
          return;
        }
      }
    },
    skip: function lexerSkip() {
      this.stream.skip();
    }
  };

  return constructor;
})();

var Parser = (function parserParser() {
  function constructor(lexer, allowStreams, xref) {
    this.lexer = lexer;
    this.allowStreams = allowStreams;
    this.xref = xref;
    this.inlineImg = 0;
    this.refill();
  }

  constructor.prototype = {
    refill: function parserRefill() {
      this.buf1 = this.lexer.getObj();
      this.buf2 = this.lexer.getObj();
    },
    shift: function parserShift() {
      if (IsCmd(this.buf2, 'ID')) {
        this.buf1 = this.buf2;
        this.buf2 = null;
        // skip byte after ID
        this.lexer.skip();
      } else {
        this.buf1 = this.buf2;
        this.buf2 = this.lexer.getObj();
      }
    },
    getObj: function parserGetObj(cipherTransform) {
      if (IsCmd(this.buf1, 'BI')) { // inline image
        this.shift();
        return this.makeInlineImage(cipherTransform);
      }
      if (IsCmd(this.buf1, '[')) { // array
        this.shift();
        var array = [];
        while (!IsCmd(this.buf1, ']') && !IsEOF(this.buf1))
          array.push(this.getObj());
        if (IsEOF(this.buf1))
          error('End of file inside array');
        this.shift();
        return array;
      }
      if (IsCmd(this.buf1, '<<')) { // dictionary or stream
        this.shift();
        var dict = new Dict();
        while (!IsCmd(this.buf1, '>>') && !IsEOF(this.buf1)) {
          if (!IsName(this.buf1)) {
            error('Dictionary key must be a name object');
          } else {
            var key = this.buf1.name;
            this.shift();
            if (IsEOF(this.buf1))
              break;
            dict.set(key, this.getObj(cipherTransform));
          }
        }
        if (IsEOF(this.buf1))
          error('End of file inside dictionary');

        // stream objects are not allowed inside content streams or
        // object streams
        if (IsCmd(this.buf2, 'stream')) {
          return this.allowStreams ?
            this.makeStream(dict, cipherTransform) : dict;
        }
        this.shift();
        return dict;
      }
      if (IsInt(this.buf1)) { // indirect reference or integer
        var num = this.buf1;
        this.shift();
        if (IsInt(this.buf1) && IsCmd(this.buf2, 'R')) {
          var ref = new Ref(num, this.buf1);
          this.shift();
          this.shift();
          return ref;
        }
        return num;
      }
      if (IsString(this.buf1)) { // string
        var str = this.buf1;
        this.shift();
        if (cipherTransform)
          str = cipherTransform.decryptString(str);
        return str;
      }

      // simple object
      var obj = this.buf1;
      this.shift();
      return obj;
    },
    makeInlineImage: function parserMakeInlineImage(cipherTransform) {
      var lexer = this.lexer;
      var stream = lexer.stream;

      // parse dictionary
      var dict = new Dict();
      while (!IsCmd(this.buf1, 'ID') && !IsEOF(this.buf1)) {
        if (!IsName(this.buf1)) {
          error('Dictionary key must be a name object');
        } else {
          var key = this.buf1.name;
          this.shift();
          if (IsEOF(this.buf1))
            break;
          dict.set(key, this.getObj(cipherTransform));
        }
      }

      // parse image stream
      var startPos = stream.pos;

      var c1 = stream.getChar();
      var c2 = stream.getChar();
      while (!(c1 == 'E' && c2 == 'I') && c2 != null) {
        c1 = c2;
        c2 = stream.getChar();
      }

      var length = (stream.pos - 2) - startPos;
      var imageStream = stream.makeSubStream(startPos, length, dict);
      if (cipherTransform)
        imageStream = cipherTransform.createStream(imageStream);
      imageStream = this.filter(imageStream, dict, length);
      imageStream.parameters = dict;

      this.buf2 = new Cmd('EI');
      this.shift();

      return imageStream;
    },
    makeStream: function parserMakeStream(dict, cipherTransform) {
      var lexer = this.lexer;
      var stream = lexer.stream;

      // get stream start position
      lexer.skipToNextLine();
      var pos = stream.pos;

      // get length
      var length = dict.get('Length');
      var xref = this.xref;
      if (xref)
        length = xref.fetchIfRef(length);
      if (!IsInt(length)) {
        error('Bad ' + length + ' attribute in stream');
        length = 0;
      }

      // skip over the stream data
      stream.pos = pos + length;
      this.shift(); // '>>'
      this.shift(); // 'stream'
      if (!IsCmd(this.buf1, 'endstream'))
        error('Missing endstream');
      this.shift();

      stream = stream.makeSubStream(pos, length, dict);
      if (cipherTransform)
        stream = cipherTransform.createStream(stream);
      stream = this.filter(stream, dict, length);
      stream.parameters = dict;
      return stream;
    },
    filter: function parserFilter(stream, dict, length) {
      var filter = dict.get('Filter', 'F');
      var params = dict.get('DecodeParms', 'DP');
      if (IsName(filter))
        return this.makeFilter(stream, filter.name, length, params);
      if (IsArray(filter)) {
        var filterArray = filter;
        var paramsArray = params;
        for (var i = 0, ii = filterArray.length; i < ii; ++i) {
          filter = filterArray[i];
          if (!IsName(filter))
            error('Bad filter name: ' + filter);
          else {
            params = null;
            if (IsArray(paramsArray) && (i in paramsArray))
              params = paramsArray[i];
            stream = this.makeFilter(stream, filter.name, length, params);
            // after the first stream the length variable is invalid
            length = null;
          }
        }
      }
      return stream;
    },
    makeFilter: function parserMakeFilter(stream, name, length, params) {
      if (name == 'FlateDecode' || name == 'Fl') {
        if (params) {
          return new PredictorStream(new FlateStream(stream), params);
        }
        return new FlateStream(stream);
      } else if (name == 'LZWDecode' || name == 'LZW') {
        var earlyChange = 1;
        if (params) {
          if (params.has('EarlyChange'))
            earlyChange = params.get('EarlyChange');
          return new PredictorStream(
            new LZWStream(stream, earlyChange), params);
        }
        return new LZWStream(stream, earlyChange);
      } else if (name == 'DCTDecode' || name == 'DCT') {
        var bytes = stream.getBytes(length);
        return new JpegStream(bytes, stream.dict);
      } else if (name == 'ASCII85Decode' || name == 'A85') {
        return new Ascii85Stream(stream);
      } else if (name == 'ASCIIHexDecode' || name == 'AHx') {
        return new AsciiHexStream(stream);
      } else if (name == 'CCITTFaxDecode' || name == 'CCF') {
        return new CCITTFaxStream(stream, params);
      } else {
        error('filter "' + name + '" not supported yet');
      }
      return stream;
    }
  };

  return constructor;
})();

var Linearization = (function linearizationLinearization() {
  function constructor(stream) {
    this.parser = new Parser(new Lexer(stream), false);
    var obj1 = this.parser.getObj();
    var obj2 = this.parser.getObj();
    var obj3 = this.parser.getObj();
    this.linDict = this.parser.getObj();
    if (IsInt(obj1) && IsInt(obj2) && IsCmd(obj3, 'obj') &&
        IsDict(this.linDict)) {
      var obj = this.linDict.get('Linearized');
      if (!(IsNum(obj) && obj > 0))
        this.linDict = null;
    }
  }

  constructor.prototype = {
    getInt: function linearizationGetInt(name) {
      var linDict = this.linDict;
      var obj;
      if (IsDict(linDict) &&
          IsInt(obj = linDict.get(name)) &&
          obj > 0) {
        return obj;
      }
      error('"' + name + '" field in linearization table is invalid');
      return 0;
    },
    getHint: function linearizationGetHint(index) {
      var linDict = this.linDict;
      var obj1, obj2;
      if (IsDict(linDict) &&
          IsArray(obj1 = linDict.get('H')) &&
          obj1.length >= 2 &&
          IsInt(obj2 = obj1[index]) &&
          obj2 > 0) {
        return obj2;
      }
      error('Hints table in linearization table is invalid: ' + index);
      return 0;
    },
    get length() {
      if (!IsDict(this.linDict))
        return 0;
      return this.getInt('L');
    },
    get hintsOffset() {
      return this.getHint(0);
    },
    get hintsLength() {
      return this.getHint(1);
    },
    get hintsOffset2() {
      return this.getHint(2);
    },
    get hintsLenth2() {
      return this.getHint(3);
    },
    get objectNumberFirst() {
      return this.getInt('O');
    },
    get endFirst() {
      return this.getInt('E');
    },
    get numPages() {
      return this.getInt('N');
    },
    get mainXRefEntriesOffset() {
      return this.getInt('T');
    },
    get pageFirst() {
      return this.getInt('P');
    }
  };

  return constructor;
})();

var XRef = (function xRefXRef() {
  function constructor(stream, startXRef, mainXRefEntriesOffset) {
    this.stream = stream;
    this.entries = [];
    this.xrefstms = {};
    var trailerDict = this.readXRef(startXRef);

    // prepare the XRef cache
    this.cache = [];

    var encrypt = trailerDict.get('Encrypt');
    if (encrypt) {
      var fileId = trailerDict.get('ID');
      this.encrypt = new CipherTransformFactory(this.fetch(encrypt),
                                                fileId[0] /*, password */);
    }

    // get the root dictionary (catalog) object
    if (!IsRef(this.root = trailerDict.get('Root')))
      error('Invalid root reference');
  }

  constructor.prototype = {
    readXRefTable: function readXRefTable(parser) {
      var obj;
      while (true) {
        if (IsCmd(obj = parser.getObj(), 'trailer'))
          break;
        if (!IsInt(obj))
          error('Invalid XRef table');
        var first = obj;
        if (!IsInt(obj = parser.getObj()))
          error('Invalid XRef table');
        var n = obj;
        if (first < 0 || n < 0 || (first + n) != ((first + n) | 0))
          error('Invalid XRef table: ' + first + ', ' + n);
        for (var i = first; i < first + n; ++i) {
          var entry = {};
          if (!IsInt(obj = parser.getObj()))
            error('Invalid XRef table: ' + first + ', ' + n);
          entry.offset = obj;
          if (!IsInt(obj = parser.getObj()))
            error('Invalid XRef table: ' + first + ', ' + n);
          entry.gen = obj;
          obj = parser.getObj();
          if (IsCmd(obj, 'n')) {
            entry.uncompressed = true;
          } else if (IsCmd(obj, 'f')) {
            entry.free = true;
          } else {
            error('Invalid XRef table: ' + first + ', ' + n);
          }
          if (!this.entries[i]) {
            // In some buggy PDF files the xref table claims to start at 1
            // instead of 0.
            if (i == 1 && first == 1 &&
                entry.offset == 0 && entry.gen == 65535 && entry.free) {
              i = first = 0;
            }
            this.entries[i] = entry;
          }
        }
      }

      // read the trailer dictionary
      var dict;
      if (!IsDict(dict = parser.getObj()))
        error('Invalid XRef table');

      // get the 'Prev' pointer
      var prev;
      obj = dict.get('Prev');
      if (IsInt(obj)) {
        prev = obj;
      } else if (IsRef(obj)) {
        // certain buggy PDF generators generate "/Prev NNN 0 R" instead
        // of "/Prev NNN"
        prev = obj.num;
      }
      if (prev) {
        this.readXRef(prev);
      }

      // check for 'XRefStm' key
      if (IsInt(obj = dict.get('XRefStm'))) {
        var pos = obj;
        // ignore previously loaded xref streams (possible infinite recursion)
        if (!(pos in this.xrefstms)) {
          this.xrefstms[pos] = 1;
          this.readXRef(pos);
        }
      }

      return dict;
    },
    readXRefStream: function readXRefStream(stream) {
      var streamParameters = stream.parameters;
      var byteWidths = streamParameters.get('W');
      var range = streamParameters.get('Index');
      if (!range)
        range = [0, streamParameters.get('Size')];
      var i, j;
      while (range.length > 0) {
        var first = range[0], n = range[1];
        if (!IsInt(first) || !IsInt(n))
          error('Invalid XRef range fields: ' + first + ', ' + n);
        var typeFieldWidth = byteWidths[0];
        var offsetFieldWidth = byteWidths[1];
        var generationFieldWidth = byteWidths[2];
        if (!IsInt(typeFieldWidth) || !IsInt(offsetFieldWidth) ||
            !IsInt(generationFieldWidth)) {
          error('Invalid XRef entry fields length: ' + first + ', ' + n);
        }
        for (i = 0; i < n; ++i) {
          var type = 0, offset = 0, generation = 0;
          for (j = 0; j < typeFieldWidth; ++j)
            type = (type << 8) | stream.getByte();
          // if type field is absent, its default value = 1
          if (typeFieldWidth == 0)
            type = 1;
          for (j = 0; j < offsetFieldWidth; ++j)
            offset = (offset << 8) | stream.getByte();
          for (j = 0; j < generationFieldWidth; ++j)
            generation = (generation << 8) | stream.getByte();
          var entry = {};
          entry.offset = offset;
          entry.gen = generation;
          switch (type) {
            case 0:
              entry.free = true;
              break;
            case 1:
              entry.uncompressed = true;
              break;
            case 2:
              break;
            default:
              error('Invalid XRef entry type: ' + type);
          }
          if (!this.entries[first + i])
            this.entries[first + i] = entry;
        }
        range.splice(0, 2);
      }
      var prev = streamParameters.get('Prev');
      if (IsInt(prev))
        this.readXRef(prev);
      return streamParameters;
    },
    indexObjects: function indexObjects() {
      // Simple scan through the PDF content to find objects,
      // trailers and XRef streams.
      function readToken(data, offset) {
        var token = '', ch = data[offset];
        while (ch !== 13 && ch !== 10) {
          if (++offset >= data.length)
            break;
          token += String.fromCharCode(ch);
          ch = data[offset];
        }
        return token;
      }
      function skipUntil(data, offset, what) {
        var length = what.length, dataLength = data.length;
        var skipped = 0;
        // finding byte sequence
        while (offset < dataLength) {
          var i = 0;
          while (i < length && data[offset + i] == what[i])
            ++i;
          if (i >= length)
            break; // sequence found

          offset++;
          skipped++;
        }
        return skipped;
      }
      var trailerBytes = new Uint8Array([116, 114, 97, 105, 108, 101, 114]);
      var startxrefBytes = new Uint8Array([115, 116, 97, 114, 116, 120, 114,
                                          101, 102]);
      var endobjBytes = new Uint8Array([101, 110, 100, 111, 98, 106]);
      var xrefBytes = new Uint8Array([47, 88, 82, 101, 102]);

      var stream = this.stream;
      stream.pos = 0;
      var buffer = stream.getBytes();
      var position = 0, length = buffer.length;
      var trailers = [], xrefStms = [];
      var state = 0;
      var currentToken;
      while (position < length) {
        var ch = buffer[position];
        if (ch === 32 || ch === 9 || ch === 13 || ch === 10) {
          ++position;
          continue;
        }
        if (ch === 37) { // %-comment
          do {
            ++position;
            ch = buffer[position];
          } while (ch !== 13 && ch !== 10);
          continue;
        }
        var token = readToken(buffer, position);
        var m;
        if (token === 'xref') {
          position += skipUntil(buffer, position, trailerBytes);
          trailers.push(position);
          position += skipUntil(buffer, position, startxrefBytes);
        } else if ((m = /^(\d+)\s+(\d+)\s+obj\b/.exec(token))) {
          this.entries[m[1]] = {
            offset: position,
            gen: m[2] | 0,
            uncompressed: true
          };

          var contentLength = skipUntil(buffer, position, endobjBytes) + 7;
          var content = buffer.subarray(position, position + contentLength);

          // checking XRef stream suspect
          // (it shall have '/XRef' and next char is not a letter)
          var xrefTagOffset = skipUntil(content, 0, xrefBytes);
          if (xrefTagOffset < contentLength &&
              content[xrefTagOffset + 5] < 64) {
            xrefStms.push(position);
            this.xrefstms[position] = 1; // don't read it recursively
          }

          position += contentLength;
        } else
          position += token.length + 1;
      }
      // reading XRef streams
      for (var i = 0; i < xrefStms.length; ++i) {
          this.readXRef(xrefStms[i]);
      }
      // finding main trailer
      for (var i = 0; i < trailers.length; ++i) {
        stream.pos = trailers[i];
        var parser = new Parser(new Lexer(stream), true);
        var obj = parser.getObj();
        if (!IsCmd(obj, 'trailer'))
          continue;
        // read the trailer dictionary
        var dict;
        if (!IsDict(dict = parser.getObj()))
          continue;
        // taking the first one with 'ID'
        if (dict.has('ID'))
          return dict;
      }
      // nothing helps
      error('Invalid PDF structure');
      return null;
    },
    readXRef: function readXref(startXRef) {
      var stream = this.stream;
      stream.pos = startXRef;
      var parser = new Parser(new Lexer(stream), true);
      var obj = parser.getObj();
      // parse an old-style xref table
      if (IsCmd(obj, 'xref'))
        return this.readXRefTable(parser);
      // parse an xref stream
      if (IsInt(obj)) {
        if (!IsInt(parser.getObj()) ||
            !IsCmd(parser.getObj(), 'obj') ||
            !IsStream(obj = parser.getObj())) {
          error('Invalid XRef stream');
        }
        return this.readXRefStream(obj);
      }
      return this.indexObjects();
    },
    getEntry: function xRefGetEntry(i) {
      var e = this.entries[i];
      if (e.free)
        error('reading an XRef stream not implemented yet');
      return e;
    },
    fetchIfRef: function xRefFetchIfRef(obj) {
      if (!IsRef(obj))
        return obj;
      return this.fetch(obj);
    },
    fetch: function xRefFetch(ref, suppressEncryption) {
      var num = ref.num;
      var e = this.cache[num];
      if (e)
        return e;

      e = this.getEntry(num);
      var gen = ref.gen;
      var stream, parser;
      if (e.uncompressed) {
        if (e.gen != gen)
          throw ('inconsistent generation in XRef');
        stream = this.stream.makeSubStream(e.offset);
        parser = new Parser(new Lexer(stream), true, this);
        var obj1 = parser.getObj();
        var obj2 = parser.getObj();
        var obj3 = parser.getObj();
        if (!IsInt(obj1) || obj1 != num ||
            !IsInt(obj2) || obj2 != gen ||
            !IsCmd(obj3)) {
          error('bad XRef entry');
        }
        if (!IsCmd(obj3, 'obj')) {
          // some bad pdfs use "obj1234" and really mean 1234
          if (obj3.cmd.indexOf('obj') == 0) {
            num = parseInt(obj3.cmd.substring(3), 10);
            if (!isNaN(num))
              return num;
          }
          error('bad XRef entry');
        }
        if (this.encrypt && !suppressEncryption) {
          try {
            e = parser.getObj(this.encrypt.createCipherTransform(num, gen));
          } catch (ex) {
            // almost all streams must be encrypted, but sometimes
            // they are not probably due to some broken generators
            // re-trying without encryption
            return this.fetch(ref, true);
          }
        } else {
          e = parser.getObj();
        }
        // Don't cache streams since they are mutable.
        if (!IsStream(e))
          this.cache[num] = e;
        return e;
      }

      // compressed entry
      stream = this.fetch(new Ref(e.offset, 0));
      if (!IsStream(stream))
        error('bad ObjStm stream');
      var first = stream.parameters.get('First');
      var n = stream.parameters.get('N');
      if (!IsInt(first) || !IsInt(n)) {
        error('invalid first and n parameters for ObjStm stream');
      }
      parser = new Parser(new Lexer(stream), false);
      var i, entries = [], nums = [];
      // read the object numbers to populate cache
      for (i = 0; i < n; ++i) {
        num = parser.getObj();
        if (!IsInt(num)) {
          error('invalid object number in the ObjStm stream: ' + num);
        }
        nums.push(num);
        var offset = parser.getObj();
        if (!IsInt(offset)) {
          error('invalid object offset in the ObjStm stream: ' + offset);
        }
      }
      // read stream objects for cache
      for (i = 0; i < n; ++i) {
        entries.push(parser.getObj());
        this.cache[nums[i]] = entries[i];
      }
      e = entries[e.gen];
      if (!e) {
        error('bad XRef entry for compressed object');
      }
      return e;
    },
    getCatalogObj: function xRefGetCatalogObj() {
      return this.fetch(this.root);
    }
  };

  return constructor;
})();

var Page = (function pagePage() {
  function constructor(xref, pageNumber, pageDict, ref) {
    this.pageNumber = pageNumber;
    this.pageDict = pageDict;
    this.stats = {
      create: Date.now(),
      compile: 0.0,
      fonts: 0.0,
      images: 0.0,
      render: 0.0
    };
    this.xref = xref;
    this.ref = ref;
  }

  constructor.prototype = {
    getPageProp: function pageGetPageProp(key) {
      return this.xref.fetchIfRef(this.pageDict.get(key));
    },
    inheritPageProp: function pageInheritPageProp(key) {
      var dict = this.pageDict;
      var obj = dict.get(key);
      while (obj === undefined) {
        dict = this.xref.fetchIfRef(dict.get('Parent'));
        if (!dict)
          break;
        obj = dict.get(key);
      }
      return obj;
    },
    get content() {
      return shadow(this, 'content', this.getPageProp('Contents'));
    },
    get resources() {
      return shadow(this, 'resources', this.inheritPageProp('Resources'));
    },
    get mediaBox() {
      var obj = this.inheritPageProp('MediaBox');
      // Reset invalid media box to letter size.
      if (!IsArray(obj) || obj.length !== 4)
        obj = [0, 0, 612, 792];
      return shadow(this, 'mediaBox', obj);
    },
    get view() {
      var obj = this.inheritPageProp('CropBox');
      var view = {
        x: 0,
        y: 0,
        width: this.width,
        height: this.height
      };
      if (IsArray(obj) && obj.length == 4) {
        var rotate = this.rotate;
        if (rotate == 0 || rotate == 180) {
          view.x = obj[0];
          view.y = obj[1];
          view.width = obj[2] - view.x;
          view.height = obj[3] - view.y;
        } else {
          view.x = obj[1];
          view.y = obj[0];
          view.width = obj[3] - view.x;
          view.height = obj[2] - view.y;
        }
      }

      return shadow(this, 'cropBox', view);
    },
    get annotations() {
      return shadow(this, 'annotations', this.inheritPageProp('Annots'));
    },
    get width() {
      var mediaBox = this.mediaBox;
      var rotate = this.rotate;
      var width;
      if (rotate == 0 || rotate == 180) {
        width = (mediaBox[2] - mediaBox[0]);
      } else {
        width = (mediaBox[3] - mediaBox[1]);
      }
      return shadow(this, 'width', width);
    },
    get height() {
      var mediaBox = this.mediaBox;
      var rotate = this.rotate;
      var height;
      if (rotate == 0 || rotate == 180) {
        height = (mediaBox[3] - mediaBox[1]);
      } else {
        height = (mediaBox[2] - mediaBox[0]);
      }
      return shadow(this, 'height', height);
    },
    get rotate() {
      var rotate = this.inheritPageProp('Rotate') || 0;
      // Normalize rotation so it's a multiple of 90 and between 0 and 270
      if (rotate % 90 != 0) {
        rotate = 0;
      } else if (rotate >= 360) {
        rotate = rotate % 360;
      } else if (rotate < 0) {
        // The spec doesn't cover negatives, assume its counterclockwise
        // rotation. The following is the other implementation of modulo.
        rotate = ((rotate % 360) + 360) % 360;
      }
      return shadow(this, 'rotate', rotate);
    },
    startRendering: function pageStartRendering(canvasCtx, continuation) {
      var self = this;
      var stats = self.stats;
      stats.compile = stats.fonts = stats.render = 0;

      var gfx = new CanvasGraphics(canvasCtx);
      var fonts = [];
      var images = new ImagesLoader();

      this.compile(gfx, fonts, images);
      stats.compile = Date.now();

      var displayContinuation = function pageDisplayContinuation() {
        // Always defer call to display() to work around bug in
        // Firefox error reporting from XHR callbacks.
        setTimeout(function pageSetTimeout() {
          var exc = null;
          try {
            self.display(gfx);
            stats.render = Date.now();
          } catch (e) {
            exc = e.toString();
          }
          if (continuation) continuation(exc);
        });
      };

      var fontObjs = FontLoader.bind(
        fonts,
        function pageFontObjs() {
          stats.fonts = Date.now();
          images.notifyOnLoad(function pageNotifyOnLoad() {
            stats.images = Date.now();
            displayContinuation();
          });
        });

      for (var i = 0, ii = fonts.length; i < ii; ++i)
        fonts[i].dict.fontObj = fontObjs[i];
    },


    compile: function pageCompile(gfx, fonts, images) {
      if (this.code) {
        // content was compiled
        return;
      }

      var xref = this.xref;
      var content = xref.fetchIfRef(this.content);
      var resources = xref.fetchIfRef(this.resources);
      if (IsArray(content)) {
        // fetching items
        var i, n = content.length;
        for (i = 0; i < n; ++i)
          content[i] = xref.fetchIfRef(content[i]);
        content = new StreamsSequenceStream(content);
      }
      this.code = gfx.compile(content, xref, resources, fonts, images);
    },
    display: function pageDisplay(gfx) {
      assert(this.code instanceof Function,
             'page content must be compiled first');
      var xref = this.xref;
      var resources = xref.fetchIfRef(this.resources);
      var mediaBox = xref.fetchIfRef(this.mediaBox);
      assertWellFormed(IsDict(resources), 'invalid page resources');
      gfx.beginDrawing({ x: mediaBox[0], y: mediaBox[1],
            width: this.width,
            height: this.height,
            rotate: this.rotate });
      gfx.execute(this.code, xref, resources);
      gfx.endDrawing();
    },
    rotatePoint: function pageRotatePoint(x, y) {
      var rotate = this.rotate;
      switch (rotate) {
        case 180:
          return {x: this.width - x, y: y};
        case 90:
          return {x: this.width - y, y: this.height - x};
        case 270:
          return {x: y, y: x};
        case 0:
        default:
          return {x: x, y: this.height - y};
      }
    },
    getLinks: function pageGetLinks() {
      var xref = this.xref;
      var annotations = xref.fetchIfRef(this.annotations) || [];
      var i, n = annotations.length;
      var links = [];
      for (i = 0; i < n; ++i) {
        var annotation = xref.fetch(annotations[i]);
        if (!IsDict(annotation))
          continue;
        var subtype = annotation.get('Subtype');
        if (!IsName(subtype) || subtype.name != 'Link')
          continue;
        var rect = annotation.get('Rect');
        var topLeftCorner = this.rotatePoint(rect[0], rect[1]);
        var bottomRightCorner = this.rotatePoint(rect[2], rect[3]);

        var link = {};
        link.x = Math.min(topLeftCorner.x, bottomRightCorner.x);
        link.y = Math.min(topLeftCorner.y, bottomRightCorner.y);
        link.width = Math.abs(topLeftCorner.x - bottomRightCorner.x);
        link.height = Math.abs(topLeftCorner.y - bottomRightCorner.y);
        var a = this.xref.fetchIfRef(annotation.get('A'));
        if (a) {
          switch (a.get('S').name) {
            case 'URI':
              link.url = a.get('URI');
              break;
            case 'GoTo':
              link.dest = a.get('D');
              break;
            default:
              TODO('other link types');
          }
        } else if (annotation.has('Dest')) {
          // simple destination link
          var dest = annotation.get('Dest');
          link.dest = IsName(dest) ? dest.name : dest;
        }
        links.push(link);
      }
      return links;
    }
  };

  return constructor;
})();

var Catalog = (function catalogCatalog() {
  function constructor(xref) {
    this.xref = xref;
    var obj = xref.getCatalogObj();
    assertWellFormed(IsDict(obj), 'catalog object is not a dictionary');
    this.catDict = obj;
  }

  constructor.prototype = {
    get toplevelPagesDict() {
      var pagesObj = this.catDict.get('Pages');
      assertWellFormed(IsRef(pagesObj), 'invalid top-level pages reference');
      var xrefObj = this.xref.fetch(pagesObj);
      assertWellFormed(IsDict(xrefObj), 'invalid top-level pages dictionary');
      // shadow the prototype getter
      return shadow(this, 'toplevelPagesDict', xrefObj);
    },
    get documentOutline() {
      var obj = this.catDict.get('Outlines');
      var xref = this.xref;
      var root = { items: [] };
      if (IsRef(obj)) {
        obj = xref.fetch(obj).get('First');
        var processed = new RefSet();
        if (IsRef(obj)) {
          var queue = [{obj: obj, parent: root}];
          // to avoid recursion keeping track of the items
          // in the processed dictionary
          processed.put(obj);
          while (queue.length > 0) {
            var i = queue.shift();
            var outlineDict = xref.fetch(i.obj);
            if (!outlineDict.has('Title'))
              error('Invalid outline item');
            var dest = outlineDict.get('A');
            if (dest)
              dest = xref.fetchIfRef(dest).get('D');
            else if (outlineDict.has('Dest')) {
              dest = outlineDict.get('Dest');
              if (IsName(dest))
                dest = dest.name;
            }
            var title = xref.fetchIfRef(outlineDict.get('Title'));
            var outlineItem = {
              dest: dest,
              title: stringToPDFString(title),
              color: outlineDict.get('C') || [0, 0, 0],
              count: outlineDict.get('Count'),
              bold: !!(outlineDict.get('F') & 2),
              italic: !!(outlineDict.get('F') & 1),
              items: []
            };
            i.parent.items.push(outlineItem);
            obj = outlineDict.get('First');
            if (IsRef(obj) && !processed.has(obj)) {
              queue.push({obj: obj, parent: outlineItem});
              processed.put(obj);
            }
            obj = outlineDict.get('Next');
            if (IsRef(obj) && !processed.has(obj)) {
              queue.push({obj: obj, parent: i.parent});
              processed.put(obj);
            }
          }
        }
      }
      obj = root.items.length > 0 ? root.items : null;
      return shadow(this, 'documentOutline', obj);
    },
    get numPages() {
      var obj = this.toplevelPagesDict.get('Count');
      assertWellFormed(
        IsInt(obj),
        'page count in top level pages object is not an integer'
      );
      // shadow the prototype getter
      return shadow(this, 'num', obj);
    },
    traverseKids: function catalogTraverseKids(pagesDict) {
      var pageCache = this.pageCache;
      var kids = pagesDict.get('Kids');
      assertWellFormed(IsArray(kids),
                       'page dictionary kids object is not an array');
      for (var i = 0; i < kids.length; ++i) {
        var kid = kids[i];
        assertWellFormed(IsRef(kid),
                         'page dictionary kid is not a reference');
        var obj = this.xref.fetch(kid);
        if (IsDict(obj, 'Page') || (IsDict(obj) && !obj.has('Kids'))) {
          pageCache.push(new Page(this.xref, pageCache.length, obj, kid));
        } else { // must be a child page dictionary
          assertWellFormed(
            IsDict(obj),
            'page dictionary kid reference points to wrong type of object'
          );
          this.traverseKids(obj);
        }
      }
    },
    get destinations() {
      function fetchDestination(xref, ref) {
        var dest = xref.fetchIfRef(ref);
        return IsDict(dest) ? dest.get('D') : dest;
      }

      var xref = this.xref;
      var dests = {}, nameTreeRef, nameDictionaryRef;
      var obj = this.catDict.get('Names');
      if (obj)
        nameTreeRef = xref.fetchIfRef(obj).get('Dests');
      else if (this.catDict.has('Dests'))
        nameDictionaryRef = this.catDict.get('Dests');

      if (nameDictionaryRef) {
        // reading simple destination dictionary
        obj = xref.fetchIfRef(nameDictionaryRef);
        obj.forEach(function catalogForEach(key, value) {
          if (!value) return;
          dests[key] = fetchDestination(xref, value);
        });
      }
      if (nameTreeRef) {
        // reading name tree
        var processed = new RefSet();
        processed.put(nameTreeRef);
        var queue = [nameTreeRef];
        while (queue.length > 0) {
          var i, n;
          obj = xref.fetch(queue.shift());
          if (obj.has('Kids')) {
            var kids = obj.get('Kids');
            for (i = 0, n = kids.length; i < n; i++) {
              var kid = kids[i];
              if (processed.has(kid))
                error('invalid destinations');
              queue.push(kid);
              processed.put(kid);
            }
            continue;
          }
          var names = obj.get('Names');
          for (i = 0, n = names.length; i < n; i += 2) {
            dests[names[i]] = fetchDestination(xref, names[i + 1]);
          }
        }
      }
      return shadow(this, 'destinations', dests);
    },
    getPage: function catalogGetPage(n) {
      var pageCache = this.pageCache;
      if (!pageCache) {
        pageCache = this.pageCache = [];
        this.traverseKids(this.toplevelPagesDict);
      }
      return this.pageCache[n - 1];
    }
  };

  return constructor;
})();

var PDFDoc = (function pdfDoc() {
  function constructor(arg, callback) {
    // Stream argument
    if (typeof arg.isStream !== 'undefined') {
      init.call(this, arg);
    }
    // ArrayBuffer argument
    else if (typeof arg.byteLength !== 'undefined') {
      init.call(this, new Stream(arg));
    }
    else {
      error('Unknown argument type');
    }
  }

  function init(stream) {
    assertWellFormed(stream.length > 0, 'stream must have data');
    this.stream = stream;
    this.setup();
  }

  function find(stream, needle, limit, backwards) {
    var pos = stream.pos;
    var end = stream.end;
    var str = '';
    if (pos + limit > end)
      limit = end - pos;
    for (var n = 0; n < limit; ++n)
      str += stream.getChar();
    stream.pos = pos;
    var index = backwards ? str.lastIndexOf(needle) : str.indexOf(needle);
    if (index == -1)
      return false; /* not found */
    stream.pos += index;
    return true; /* found */
  }

  constructor.prototype = {
    get linearization() {
      var length = this.stream.length;
      var linearization = false;
      if (length) {
        linearization = new Linearization(this.stream);
        if (linearization.length != length)
          linearization = false;
      }
      // shadow the prototype getter with a data property
      return shadow(this, 'linearization', linearization);
    },
    get startXRef() {
      var stream = this.stream;
      var startXRef = 0;
      var linearization = this.linearization;
      if (linearization) {
        // Find end of first obj.
        stream.reset();
        if (find(stream, 'endobj', 1024))
          startXRef = stream.pos + 6;
      } else {
        // Find startxref at the end of the file.
        var start = stream.end - 1024;
        if (start < 0)
          start = 0;
        stream.pos = start;
        if (find(stream, 'startxref', 1024, true)) {
          stream.skip(9);
          var ch;
          do {
            ch = stream.getChar();
          } while (Lexer.isSpace(ch));
          var str = '';
          while ((ch - '0') <= 9) {
            str += ch;
            ch = stream.getChar();
          }
          startXRef = parseInt(str, 10);
          if (isNaN(startXRef))
            startXRef = 0;
        }
      }
      // shadow the prototype getter with a data property
      return shadow(this, 'startXRef', startXRef);
    },
    get mainXRefEntriesOffset() {
      var mainXRefEntriesOffset = 0;
      var linearization = this.linearization;
      if (linearization)
        mainXRefEntriesOffset = linearization.mainXRefEntriesOffset;
      // shadow the prototype getter with a data property
      return shadow(this, 'mainXRefEntriesOffset', mainXRefEntriesOffset);
    },
    // Find the header, remove leading garbage and setup the stream
    // starting from the header.
    checkHeader: function pdfDocCheckHeader() {
      var stream = this.stream;
      stream.reset();
      if (find(stream, '%PDF-', 1024)) {
        // Found the header, trim off any garbage before it.
        stream.moveStart();
        return;
      }
      // May not be a PDF file, continue anyway.
    },
    setup: function pdfDocSetup(ownerPassword, userPassword) {
      this.checkHeader();
      this.xref = new XRef(this.stream,
                           this.startXRef,
                           this.mainXRefEntriesOffset);
      this.catalog = new Catalog(this.xref);
    },
    get numPages() {
      var linearization = this.linearization;
      var num = linearization ? linearization.numPages : this.catalog.numPages;
      // shadow the prototype getter
      return shadow(this, 'numPages', num);
    },
    getPage: function pdfDocGetPage(n) {
      return this.catalog.getPage(n);
    }
  };

  return constructor;
})();

var Encodings = {
  get ExpertEncoding() {
    return shadow(this, 'ExpertEncoding', ['', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', 'space', 'exclamsmall', 'Hungarumlautsmall', '',
      'dollaroldstyle', 'dollarsuperior', 'ampersandsmall', 'Acutesmall',
      'parenleftsuperior', 'parenrightsuperior', 'twodotenleader',
      'onedotenleader', 'comma', 'hyphen', 'period', 'fraction',
      'zerooldstyle', 'oneoldstyle', 'twooldstyle', 'threeoldstyle',
      'fouroldstyle', 'fiveoldstyle', 'sixoldstyle', 'sevenoldstyle',
      'eightoldstyle', 'nineoldstyle', 'colon', 'semicolon', 'commasuperior',
      'threequartersemdash', 'periodsuperior', 'questionsmall', '',
      'asuperior', 'bsuperior', 'centsuperior', 'dsuperior', 'esuperior', '',
      '', 'isuperior', '', '', 'lsuperior', 'msuperior', 'nsuperior',
      'osuperior', '', '', 'rsuperior', 'ssuperior', 'tsuperior', '', 'ff',
      'fi', 'fl', 'ffi', 'ffl', 'parenleftinferior', '', 'parenrightinferior',
      'Circumflexsmall', 'hyphensuperior', 'Gravesmall', 'Asmall', 'Bsmall',
      'Csmall', 'Dsmall', 'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall',
      'Jsmall', 'Ksmall', 'Lsmall', 'Msmall', 'Nsmall', 'Osmall', 'Psmall',
      'Qsmall', 'Rsmall', 'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall',
      'Xsmall', 'Ysmall', 'Zsmall', 'colonmonetary', 'onefitted', 'rupiah',
      'Tildesmall', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', 'exclamdownsmall', 'centoldstyle', 'Lslashsmall', '', '',
      'Scaronsmall', 'Zcaronsmall', 'Dieresissmall', 'Brevesmall',
      'Caronsmall', '', 'Dotaccentsmall', '', '', 'Macronsmall', '', '',
      'figuredash', 'hypheninferior', '', '', 'Ogoneksmall', 'Ringsmall',
      'Cedillasmall', '', '', '', 'onequarter', 'onehalf', 'threequarters',
      'questiondownsmall', 'oneeighth', 'threeeighths', 'fiveeighths',
      'seveneighths', 'onethird', 'twothirds', '', '', 'zerosuperior',
      'onesuperior', 'twosuperior', 'threesuperior', 'foursuperior',
      'fivesuperior', 'sixsuperior', 'sevensuperior', 'eightsuperior',
      'ninesuperior', 'zeroinferior', 'oneinferior', 'twoinferior',
      'threeinferior', 'fourinferior', 'fiveinferior', 'sixinferior',
      'seveninferior', 'eightinferior', 'nineinferior', 'centinferior',
      'dollarinferior', 'periodinferior', 'commainferior', 'Agravesmall',
      'Aacutesmall', 'Acircumflexsmall', 'Atildesmall', 'Adieresissmall',
      'Aringsmall', 'AEsmall', 'Ccedillasmall', 'Egravesmall', 'Eacutesmall',
      'Ecircumflexsmall', 'Edieresissmall', 'Igravesmall', 'Iacutesmall',
      'Icircumflexsmall', 'Idieresissmall', 'Ethsmall', 'Ntildesmall',
      'Ogravesmall', 'Oacutesmall', 'Ocircumflexsmall', 'Otildesmall',
      'Odieresissmall', 'OEsmall', 'Oslashsmall', 'Ugravesmall', 'Uacutesmall',
      'Ucircumflexsmall', 'Udieresissmall', 'Yacutesmall', 'Thornsmall',
      'Ydieresissmall'
    ]);
  },
  get MacExpertEncoding() {
    return shadow(this, 'MacExpertEncoding', ['', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', 'space', 'exclamsmall', 'Hungarumlautsmall',
      'centoldstyle', 'dollaroldstyle', 'dollarsuperior', 'ampersandsmall',
      'Acutesmall', 'parenleftsuperior', 'parenrightsuperior',
      'twodotenleader', 'onedotenleader', 'comma', 'hyphen', 'period',
      'fraction', 'zerooldstyle', 'oneoldstyle', 'twooldstyle',
      'threeoldstyle', 'fouroldstyle', 'fiveoldstyle', 'sixoldstyle',
      'sevenoldstyle', 'eightoldstyle', 'nineoldstyle', 'colon', 'semicolon',
      '', 'threequartersemdash', '', 'questionsmall', '', '', '', '',
      'Ethsmall', '', '', 'onequarter', 'onehalf', 'threequarters',
      'oneeighth', 'threeeighths', 'fiveeighths', 'seveneighths', 'onethird',
      'twothirds', '', '', '', '', '', '', 'ff', 'fi', 'fl', 'ffi', 'ffl',
      'parenleftinferior', '', 'parenrightinferior', 'Circumflexsmall',
      'hypheninferior', 'Gravesmall', 'Asmall', 'Bsmall', 'Csmall', 'Dsmall',
      'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall', 'Jsmall', 'Ksmall',
      'Lsmall', 'Msmall', 'Nsmall', 'Osmall', 'Psmall', 'Qsmall', 'Rsmall',
      'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall', 'Xsmall', 'Ysmall',
      'Zsmall', 'colonmonetary', 'onefitted', 'rupiah', 'Tildesmall', '', '',
      'asuperior', 'centsuperior', '', '', '', '', 'Aacutesmall',
      'Agravesmall', 'Acircumflexsmall', 'Adieresissmall', 'Atildesmall',
      'Aringsmall', 'Ccedillasmall', 'Eacutesmall', 'Egravesmall',
      'Ecircumflexsmall', 'Edieresissmall', 'Iacutesmall', 'Igravesmall',
      'Icircumflexsmall', 'Idieresissmall', 'Ntildesmall', 'Oacutesmall',
      'Ogravesmall', 'Ocircumflexsmall', 'Odieresissmall', 'Otildesmall',
      'Uacutesmall', 'Ugravesmall', 'Ucircumflexsmall', 'Udieresissmall', '',
      'eightsuperior', 'fourinferior', 'threeinferior', 'sixinferior',
      'eightinferior', 'seveninferior', 'Scaronsmall', '', 'centinferior',
      'twoinferior', '', 'Dieresissmall', '', 'Caronsmall', 'osuperior',
      'fiveinferior', '', 'commainferior', 'periodinferior', 'Yacutesmall', '',
      'dollarinferior', '', 'Thornsmall', '', 'nineinferior', 'zeroinferior',
      'Zcaronsmall', 'AEsmall', 'Oslashsmall', 'questiondownsmall',
      'oneinferior', 'Lslashsmall', '', '', '', '', '', '', 'Cedillasmall', '',
      '', '', '', '', 'OEsmall', 'figuredash', 'hyphensuperior', '', '', '',
      '', 'exclamdownsmall', '', 'Ydieresissmall', '', 'onesuperior',
      'twosuperior', 'threesuperior', 'foursuperior', 'fivesuperior',
      'sixsuperior', 'sevensuperior', 'ninesuperior', 'zerosuperior', '',
      'esuperior', 'rsuperior', 'tsuperior', '', '', 'isuperior', 'ssuperior',
      'dsuperior', '', '', '', '', '', 'lsuperior', 'Ogoneksmall',
      'Brevesmall', 'Macronsmall', 'bsuperior', 'nsuperior', 'msuperior',
      'commasuperior', 'periodsuperior', 'Dotaccentsmall', 'Ringsmall'
    ]);
  },
  get MacRomanEncoding() {
    return shadow(this, 'MacRomanEncoding', ['', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', 'space', 'exclam', 'quotedbl', 'numbersign',
      'dollar', 'percent', 'ampersand', 'quotesingle', 'parenleft',
      'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash',
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'colon', 'semicolon', 'less', 'equal', 'greater', 'question',
      'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
      'grave', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'braceleft', 'bar', 'braceright', 'asciitilde', '', 'Adieresis', 'Aring',
      'Ccedilla', 'Eacute', 'Ntilde', 'Odieresis', 'Udieresis', 'aacute',
      'agrave', 'acircumflex', 'adieresis', 'atilde', 'aring', 'ccedilla',
      'eacute', 'egrave', 'ecircumflex', 'edieresis', 'iacute', 'igrave',
      'icircumflex', 'idieresis', 'ntilde', 'oacute', 'ograve', 'ocircumflex',
      'odieresis', 'otilde', 'uacute', 'ugrave', 'ucircumflex', 'udieresis',
      'dagger', 'degree', 'cent', 'sterling', 'section', 'bullet', 'paragraph',
      'germandbls', 'registered', 'copyright', 'trademark', 'acute',
      'dieresis', 'notequal', 'AE', 'Oslash', 'infinity', 'plusminus',
      'lessequal', 'greaterequal', 'yen', 'mu', 'partialdiff', 'summation',
      'product', 'pi', 'integral', 'ordfeminine', 'ordmasculine', 'Omega',
      'ae', 'oslash', 'questiondown', 'exclamdown', 'logicalnot', 'radical',
      'florin', 'approxequal', 'Delta', 'guillemotleft', 'guillemotright',
      'ellipsis', 'space', 'Agrave', 'Atilde', 'Otilde', 'OE', 'oe', 'endash',
      'emdash', 'quotedblleft', 'quotedblright', 'quoteleft', 'quoteright',
      'divide', 'lozenge', 'ydieresis', 'Ydieresis', 'fraction', 'currency',
      'guilsinglleft', 'guilsinglright', 'fi', 'fl', 'daggerdbl',
      'periodcentered', 'quotesinglbase', 'quotedblbase', 'perthousand',
      'Acircumflex', 'Ecircumflex', 'Aacute', 'Edieresis', 'Egrave', 'Iacute',
      'Icircumflex', 'Idieresis', 'Igrave', 'Oacute', 'Ocircumflex', 'apple',
      'Ograve', 'Uacute', 'Ucircumflex', 'Ugrave', 'dotlessi', 'circumflex',
      'tilde', 'macron', 'breve', 'dotaccent', 'ring', 'cedilla',
      'hungarumlaut', 'ogonek', 'caron'
    ]);
  },
  get StandardEncoding() {
    return shadow(this, 'StandardEncoding', ['', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', 'space', 'exclam', 'quotedbl', 'numbersign',
      'dollar', 'percent', 'ampersand', 'quoteright', 'parenleft',
      'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash',
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'colon', 'semicolon', 'less', 'equal', 'greater', 'question',
      'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
      'quoteleft', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
      'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'braceleft', 'bar', 'braceright', 'asciitilde', '', '', 'exclamdown',
      'cent', 'sterling', 'fraction', 'yen', 'florin', 'section', 'currency',
      'quotesingle', 'quotedblleft', 'guillemotleft', 'guilsinglleft',
      'guilsinglright', 'fi', 'fl', '', 'endash', 'dagger', 'daggerdbl',
      'periodcentered', '', 'paragraph', 'bullet', 'quotesinglbase',
      'quotedblbase', 'quotedblright', 'guillemotright', 'ellipsis',
      'perthousand', '', 'questiondown', '', 'grave', 'acute', 'circumflex',
      'tilde', 'macron', 'breve', 'dotaccent', 'dieresis', '', 'ring',
      'cedilla', '', 'hungarumlaut', 'ogonek', 'caron', 'emdash', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', 'AE', '',
      'ordfeminine', '', '', '', '', 'Lslash', 'Oslash', 'OE', 'ordmasculine',
      '', '', '', '', '', 'ae', '', '', '', 'dotlessi', '', '', 'lslash',
      'oslash', 'oe', 'germandbls'
    ]);
  },
  get WinAnsiEncoding() {
    return shadow(this, 'WinAnsiEncoding', ['', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', 'space', 'exclam', 'quotedbl', 'numbersign',
      'dollar', 'percent', 'ampersand', 'quotesingle', 'parenleft',
      'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash',
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'colon', 'semicolon', 'less', 'equal', 'greater', 'question',
      'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
      'grave', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'braceleft', 'bar', 'braceright', 'asciitilde', 'bullet', 'Euro',
      'bullet', 'quotesinglbase', 'florin', 'quotedblbase', 'ellipsis',
      'dagger', 'daggerdbl', 'circumflex', 'perthousand', 'Scaron',
      'guilsinglleft', 'OE', 'bullet', 'Zcaron', 'bullet', 'bullet',
      'quoteleft', 'quoteright', 'quotedblleft', 'quotedblright', 'bullet',
      'endash', 'emdash', 'tilde', 'trademark', 'scaron', 'guilsinglright',
      'oe', 'bullet', 'zcaron', 'Ydieresis', 'space', 'exclamdown', 'cent',
      'sterling', 'currency', 'yen', 'brokenbar', 'section', 'dieresis',
      'copyright', 'ordfeminine', 'guillemotleft', 'logicalnot', 'hyphen',
      'registered', 'macron', 'degree', 'plusminus', 'twosuperior',
      'threesuperior', 'acute', 'mu', 'paragraph', 'periodcentered',
      'cedilla', 'onesuperior', 'ordmasculine', 'guillemotright', 'onequarter',
      'onehalf', 'threequarters', 'questiondown', 'Agrave', 'Aacute',
      'Acircumflex', 'Atilde', 'Adieresis', 'Aring', 'AE', 'Ccedilla',
      'Egrave', 'Eacute', 'Ecircumflex', 'Edieresis', 'Igrave', 'Iacute',
      'Icircumflex', 'Idieresis', 'Eth', 'Ntilde', 'Ograve', 'Oacute',
      'Ocircumflex', 'Otilde', 'Odieresis', 'multiply', 'Oslash', 'Ugrave',
      'Uacute', 'Ucircumflex', 'Udieresis', 'Yacute', 'Thorn', 'germandbls',
      'agrave', 'aacute', 'acircumflex', 'atilde', 'adieresis', 'aring', 'ae',
      'ccedilla', 'egrave', 'eacute', 'ecircumflex', 'edieresis', 'igrave',
      'iacute', 'icircumflex', 'idieresis', 'eth', 'ntilde', 'ograve',
      'oacute', 'ocircumflex', 'otilde', 'odieresis', 'divide', 'oslash',
      'ugrave', 'uacute', 'ucircumflex', 'udieresis', 'yacute', 'thorn',
      'ydieresis'
    ]);
  },
  get symbolsEncoding() {
    return shadow(this, 'symbolsEncoding', ['', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', 'space', 'exclam', 'universal', 'numbersign',
      'existential', 'percent', 'ampersand', 'suchthat', 'parenleft',
      'parenright', 'asteriskmath', 'plus', 'comma', 'minus', 'period',
      'slash', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
      'eight', 'nine', 'colon', 'semicolon', 'less', 'equal', 'greater',
      'question', 'congruent', 'Alpha', 'Beta', 'Chi', 'Delta', 'Epsilon',
      'Phi', 'Gamma', 'Eta', 'Iota', 'theta1', 'Kappa', 'Lambda', 'Mu', 'Nu',
      'Omicron', 'Pi', 'Theta', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'sigma1',
      'Omega', 'Xi', 'Psi', 'Zeta', 'bracketleft', 'therefore', 'bracketright',
      'perpendicular', 'underscore', 'radicalex', 'alpha', 'beta', 'chi',
      'delta', 'epsilon', 'phi', 'gamma', 'eta', 'iota', 'phi1', 'kappa',
      'lambda', 'mu', 'nu', 'omicron', 'pi', 'theta', 'rho', 'sigma', 'tau',
      'upsilon', 'omega1', 'omega', 'xi', 'psi', 'zeta', 'braceleft', 'bar',
      'braceright', 'similar', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', 'Euro', 'Upsilon1', 'minute', 'lessequal', 'fraction',
      'infinity', 'florin', 'club', 'diamond', 'heart', 'spade', 'arrowboth',
      'arrowleft', 'arrowup', 'arrowright', 'arrowdown', 'degree', 'plusminus',
      'second', 'greaterequal', 'multiply', 'proportional', 'partialdiff',
      'bullet', 'divide', 'notequal', 'equivalence', 'approxequal', 'ellipsis',
      'arrowvertex', 'arrowhorizex', 'carriagereturn', 'aleph', 'Ifraktur',
      'Rfraktur', 'weierstrass', 'circlemultiply', 'circleplus', 'emptyset',
      'intersection', 'union', 'propersuperset', 'reflexsuperset', 'notsubset',
      'propersubset', 'reflexsubset', 'element', 'notelement', 'angle',
      'gradient', 'registerserif', 'copyrightserif', 'trademarkserif',
      'product', 'radical', 'dotmath', 'logicalnot', 'logicaland', 'logicalor',
      'arrowdblboth', 'arrowdblleft', 'arrowdblup', 'arrowdblright',
      'arrowdbldown', 'lozenge', 'angleleft', 'registersans', 'copyrightsans',
      'trademarksans', 'summation', 'parenlefttp', 'parenleftex',
      'parenleftbt', 'bracketlefttp', 'bracketleftex', 'bracketleftbt',
      'bracelefttp', 'braceleftmid', 'braceleftbt', 'braceex', '',
      'angleright', 'integral', 'integraltp', 'integralex', 'integralbt',
      'parenrighttp', 'parenrightex', 'parenrightbt', 'bracketrighttp',
      'bracketrightex', 'bracketrightbt', 'bracerighttp', 'bracerightmid',
      'bracerightbt'
    ]);
  },
  get zapfDingbatsEncoding() {
    return shadow(this, 'zapfDingbatsEncoding', ['', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', 'space', 'a1', 'a2', 'a202', 'a3', 'a4',
      'a5', 'a119', 'a118', 'a117', 'a11', 'a12', 'a13', 'a14', 'a15', 'a16',
      'a105', 'a17', 'a18', 'a19', 'a20', 'a21', 'a22', 'a23', 'a24', 'a25',
      'a26', 'a27', 'a28', 'a6', 'a7', 'a8', 'a9', 'a10', 'a29', 'a30', 'a31',
      'a32', 'a33', 'a34', 'a35', 'a36', 'a37', 'a38', 'a39', 'a40', 'a41',
      'a42', 'a43', 'a44', 'a45', 'a46', 'a47', 'a48', 'a49', 'a50', 'a51',
      'a52', 'a53', 'a54', 'a55', 'a56', 'a57', 'a58', 'a59', 'a60', 'a61',
      'a62', 'a63', 'a64', 'a65', 'a66', 'a67', 'a68', 'a69', 'a70', 'a71',
      'a72', 'a73', 'a74', 'a203', 'a75', 'a204', 'a76', 'a77', 'a78', 'a79',
      'a81', 'a82', 'a83', 'a84', 'a97', 'a98', 'a99', 'a100', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', 'a101', 'a102', 'a103',
      'a104', 'a106', 'a107', 'a108', 'a112', 'a111', 'a110', 'a109', 'a120',
      'a121', 'a122', 'a123', 'a124', 'a125', 'a126', 'a127', 'a128', 'a129',
      'a130', 'a131', 'a132', 'a133', 'a134', 'a135', 'a136', 'a137', 'a138',
      'a139', 'a140', 'a141', 'a142', 'a143', 'a144', 'a145', 'a146', 'a147',
      'a148', 'a149', 'a150', 'a151', 'a152', 'a153', 'a154', 'a155', 'a156',
      'a157', 'a158', 'a159', 'a160', 'a161', 'a163', 'a164', 'a196', 'a165',
      'a192', 'a166', 'a167', 'a168', 'a169', 'a170', 'a171', 'a172', 'a173',
      'a162', 'a174', 'a175', 'a176', 'a177', 'a178', 'a179', 'a193', 'a180',
      'a199', 'a181', 'a200', 'a182', '', 'a201', 'a183', 'a184', 'a197',
      'a185', 'a194', 'a198', 'a186', 'a195', 'a187', 'a188', 'a189', 'a190',
      'a191'
    ]);
  }
};

var IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

var EvalState = (function evalState() {
  function constructor() {
    // Are soft masks and alpha values shapes or opacities?
    this.alphaIsShape = false;
    this.fontSize = 0;
    this.textMatrix = IDENTITY_MATRIX;
    this.leading = 0;
    // Start of text line (in text coordinates)
    this.lineX = 0;
    this.lineY = 0;
    // Character and word spacing
    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.textHScale = 1;
    // Color spaces
    this.fillColorSpace = null;
    this.strokeColorSpace = null;
  }
  constructor.prototype = {
  };
  return constructor;
})();

var PartialEvaluator = (function partialEvaluator() {
  function constructor() {
    this.state = new EvalState();
    this.stateStack = [];
  }

  var OP_MAP = {
    // Graphics state
    w: 'setLineWidth',
    J: 'setLineCap',
    j: 'setLineJoin',
    M: 'setMiterLimit',
    d: 'setDash',
    ri: 'setRenderingIntent',
    i: 'setFlatness',
    gs: 'setGState',
    q: 'save',
    Q: 'restore',
    cm: 'transform',

    // Path
    m: 'moveTo',
    l: 'lineTo',
    c: 'curveTo',
    v: 'curveTo2',
    y: 'curveTo3',
    h: 'closePath',
    re: 'rectangle',
    S: 'stroke',
    s: 'closeStroke',
    f: 'fill',
    F: 'fill',
    'f*': 'eoFill',
    B: 'fillStroke',
    'B*': 'eoFillStroke',
    b: 'closeFillStroke',
    'b*': 'closeEOFillStroke',
    n: 'endPath',

    // Clipping
    W: 'clip',
    'W*': 'eoClip',

    // Text
    BT: 'beginText',
    ET: 'endText',
    Tc: 'setCharSpacing',
    Tw: 'setWordSpacing',
    Tz: 'setHScale',
    TL: 'setLeading',
    Tf: 'setFont',
    Tr: 'setTextRenderingMode',
    Ts: 'setTextRise',
    Td: 'moveText',
    TD: 'setLeadingMoveText',
    Tm: 'setTextMatrix',
    'T*': 'nextLine',
    Tj: 'showText',
    TJ: 'showSpacedText',
    "'": 'nextLineShowText',
    '"': 'nextLineSetSpacingShowText',

    // Type3 fonts
    d0: 'setCharWidth',
    d1: 'setCharWidthAndBounds',

    // Color
    CS: 'setStrokeColorSpace',
    cs: 'setFillColorSpace',
    SC: 'setStrokeColor',
    SCN: 'setStrokeColorN',
    sc: 'setFillColor',
    scn: 'setFillColorN',
    G: 'setStrokeGray',
    g: 'setFillGray',
    RG: 'setStrokeRGBColor',
    rg: 'setFillRGBColor',
    K: 'setStrokeCMYKColor',
    k: 'setFillCMYKColor',

    // Shading
    sh: 'shadingFill',

    // Images
    BI: 'beginInlineImage',
    ID: 'beginImageData',
    EI: 'endInlineImage',

    // XObjects
    Do: 'paintXObject',

    // Marked content
    MP: 'markPoint',
    DP: 'markPointProps',
    BMC: 'beginMarkedContent',
    BDC: 'beginMarkedContentProps',
    EMC: 'endMarkedContent',

    // Compatibility
    BX: 'beginCompat',
    EX: 'endCompat'
  };

  constructor.prototype = {
    evaluate: function partialEvaluatorEvaluate(stream, xref, resources, fonts,
                                                images) {
      resources = xref.fetchIfRef(resources) || new Dict();
      var xobjs = xref.fetchIfRef(resources.get('XObject')) || new Dict();
      var patterns = xref.fetchIfRef(resources.get('Pattern')) || new Dict();
      var parser = new Parser(new Lexer(stream), false);
      var args = [], argsArray = [], fnArray = [], obj;

      while (!IsEOF(obj = parser.getObj())) {
        if (IsCmd(obj)) {
          var cmd = obj.cmd;
          var fn = OP_MAP[cmd];
          assertWellFormed(fn, "Unknown command '" + cmd + "'");
          // TODO figure out how to type-check vararg functions

          if ((cmd == 'SCN' || cmd == 'scn') && !args[args.length - 1].code) {
            // compile tiling patterns
            var patternName = args[args.length - 1];
            // SCN/scn applies patterns along with normal colors
            if (IsName(patternName)) {
              var pattern = xref.fetchIfRef(patterns.get(patternName.name));
              if (pattern) {
                var dict = IsStream(pattern) ? pattern.dict : pattern;
                var typeNum = dict.get('PatternType');
                if (typeNum == 1) {
                  patternName.code = this.evaluate(pattern, xref,
                                                   dict.get('Resources'),
                                                   fonts, images);
                }
              }
            }
          } else if (cmd == 'Do' && !args[0].code) {
            // eagerly compile XForm objects
            var name = args[0].name;
            var xobj = xobjs.get(name);
            if (xobj) {
              xobj = xref.fetchIfRef(xobj);
              assertWellFormed(IsStream(xobj), 'XObject should be a stream');

              var type = xobj.dict.get('Subtype');
              assertWellFormed(
                IsName(type),
                'XObject should have a Name subtype'
              );

              if ('Form' == type.name) {
                args[0].code = this.evaluate(xobj, xref,
                                             xobj.dict.get('Resources'), fonts,
                                             images);
              }
              if (xobj instanceof JpegStream)
                images.bind(xobj); // monitoring image load
            }
          } else if (cmd == 'Tf') { // eagerly collect all fonts
            var fontRes = resources.get('Font');
            if (fontRes) {
              fontRes = xref.fetchIfRef(fontRes);
              var font = xref.fetchIfRef(fontRes.get(args[0].name));
              assertWellFormed(IsDict(font));
              if (!font.translated) {
                font.translated = this.translateFont(font, xref, resources);
                if (fonts && font.translated) {
                  // keep track of each font we translated so the caller can
                  // load them asynchronously before calling display on a page
                  fonts.push(font.translated);
                }
              }
            }
          }

          fnArray.push(fn);
          argsArray.push(args);
          args = [];
        } else {
          assertWellFormed(args.length <= 33, 'Too many arguments');
          args.push(obj);
        }
      }

      return function partialEvaluatorReturn(gfx) {
        for (var i = 0, length = argsArray.length; i < length; i++)
          gfx[fnArray[i]].apply(gfx, argsArray[i]);
      };
    },

    extractEncoding: function partialEvaluatorExtractEncoding(dict,
                                                              xref,
                                                              properties) {
      var type = properties.type, encoding;
      if (properties.composite) {
        if (type == 'CIDFontType2') {
          var defaultWidth = xref.fetchIfRef(dict.get('DW')) || 1000;
          properties.defaultWidth = defaultWidth;

          var glyphsWidths = {};
          var widths = xref.fetchIfRef(dict.get('W'));
          if (widths) {
            var start = 0, end = 0;
            for (var i = 0; i < widths.length; i++) {
              var code = widths[i];
              if (IsArray(code)) {
                for (var j = 0; j < code.length; j++)
                  glyphsWidths[start++] = code[j];
                start = 0;
              } else if (start) {
                var width = widths[++i];
                for (var j = start; j <= code; j++)
                  glyphsWidths[j] = width;
                start = 0;
              } else {
                start = code;
              }
            }
          }
          properties.widths = glyphsWidths;

          var cidToGidMap = dict.get('CIDToGIDMap');
          if (!cidToGidMap || !IsRef(cidToGidMap)) {
            return Object.create(GlyphsUnicode);
          }

          // Extract the encoding from the CIDToGIDMap
          var glyphsStream = xref.fetchIfRef(cidToGidMap);
          var glyphsData = glyphsStream.getBytes(0);

          // Glyph ids are big-endian 2-byte values
          encoding = properties.encoding;

          // Set encoding 0 to later verify the font has an encoding
          encoding[0] = { unicode: 0, width: 0 };
          for (var j = 0; j < glyphsData.length; j++) {
            var glyphID = (glyphsData[j++] << 8) | glyphsData[j];
            if (glyphID == 0)
              continue;

            var code = j >> 1;
            var width = glyphsWidths[code];
            encoding[code] = {
              unicode: glyphID,
              width: IsNum(width) ? width : defaultWidth
            };
          }
        } else if (type == 'CIDFontType0') {
          if (IsName(encoding)) {
            // Encoding is a predefined CMap
            if (encoding.name == 'Identity-H') {
              TODO('Need to create an identity cmap');
            } else {
              TODO('Need to support predefined CMaps see PDF 32000-1:2008 ' +
                   '9.7.5.2 Predefined CMaps');
            }
          } else {
            TODO('Need to support encoding streams see PDF 32000-1:2008 ' +
                 '9.7.5.3');
          }
        }
        return Object.create(GlyphsUnicode);
      }

      var differences = properties.differences;
      var map = properties.encoding;
      var baseEncoding = null;
      if (dict.has('Encoding')) {
        encoding = xref.fetchIfRef(dict.get('Encoding'));
        if (IsDict(encoding)) {
          var baseName = encoding.get('BaseEncoding');
          if (baseName)
            baseEncoding = Encodings[baseName.name].slice();

          // Load the differences between the base and original
          if (encoding.has('Differences')) {
            var diffEncoding = encoding.get('Differences');
            var index = 0;
            for (var j = 0; j < diffEncoding.length; j++) {
              var data = diffEncoding[j];
              if (IsNum(data))
                index = data;
              else
                differences[index++] = data.name;
            }
          }
        } else if (IsName(encoding)) {
          baseEncoding = Encodings[encoding.name].slice();
        } else {
          error('Encoding is not a Name nor a Dict');
        }
      }

      if (!baseEncoding) {
        switch (type) {
          case 'TrueType':
            baseEncoding = Encodings.WinAnsiEncoding.slice();
            break;
          case 'Type1':
            baseEncoding = Encodings.StandardEncoding.slice();
            break;
          default:
            warn('Unknown type of font: ' + type);
        }
      }

      // merge in the differences
      var firstChar = properties.firstChar;
      var lastChar = properties.lastChar;
      var widths = properties.widths || [];
      var glyphs = {};
      for (var i = firstChar; i <= lastChar; i++) {
        var glyph = differences[i];
        if (!glyph) {
          glyph = baseEncoding[i];
          // skipping already specified by difference glyphs
          if (differences.indexOf(glyph) >= 0)
            continue;
        }
        var index = GlyphsUnicode[glyph] || i;
        var width = widths[i] || widths[glyph];
        map[i] = {
          unicode: index,
          width: IsNum(width) ? width : properties.defaultWidth
        };

        if (glyph)
          glyphs[glyph] = map[i];

        // If there is no file, the character mapping can't be modified
        // but this is unlikely that there is any standard encoding with
        // chars below 0x1f, so that's fine.
        if (!properties.file)
          continue;

        if (index <= 0x1f || (index >= 127 && index <= 255))
          map[i].unicode += kCmapGlyphOffset;
      }

      if (type == 'TrueType' && dict.has('ToUnicode') && differences) {
        var cmapObj = dict.get('ToUnicode');
        if (IsRef(cmapObj)) {
          cmapObj = xref.fetch(cmapObj);
        }
        if (IsName(cmapObj)) {
          error('ToUnicode file cmap translation not implemented');
        } else if (IsStream(cmapObj)) {
          var tokens = [];
          var token = '';
          var beginArrayToken = {};

          var cmap = cmapObj.getBytes(cmapObj.length);
          for (var i = 0; i < cmap.length; i++) {
            var byte = cmap[i];
            if (byte == 0x20 || byte == 0x0D || byte == 0x0A ||
                byte == 0x3C || byte == 0x5B || byte == 0x5D) {
              switch (token) {
                case 'usecmap':
                  error('usecmap is not implemented');
                  break;

                case 'beginbfchar':
                case 'beginbfrange':
                case 'begincidchar':
                case 'begincidrange':
                  token = '';
                  tokens = [];
                  break;

                case 'endcidrange':
                case 'endbfrange':
                  for (var j = 0; j < tokens.length; j += 3) {
                    var startRange = tokens[j];
                    var endRange = tokens[j + 1];
                    var code = tokens[j + 2];
                    while (startRange < endRange) {
                      var mapping = map[startRange] || {};
                      mapping.unicode = code++;
                      map[startRange] = mapping;
                      ++startRange;
                    }
                  }
                  break;

                case 'endcidchar':
                case 'endbfchar':
                  for (var j = 0; j < tokens.length; j += 2) {
                    var index = tokens[j];
                    var code = tokens[j + 1];
                    var mapping = map[index] || {};
                    mapping.unicode = code;
                    map[index] = mapping;
                  }
                  break;

                case '':
                  break;

                default:
                  if (token[0] >= '0' && token[0] <= '9')
                    token = parseInt(token, 10); // a number
                  tokens.push(token);
                  token = '';
              }
              switch (byte) {
                case 0x5B:
                  // begin list parsing
                  tokens.push(beginArrayToken);
                  break;
                case 0x5D:
                  // collect array items
                  var items = [], item;
                  while (tokens.length &&
                         (item = tokens.pop()) != beginArrayToken)
                    items.unshift(item);
                  tokens.push(items);
                  break;
              }
            } else if (byte == 0x3E) {
              if (token.length) {
                // parsing hex number
                tokens.push(parseInt(token, 16));
                token = '';
              }
            } else {
              token += String.fromCharCode(byte);
            }
          }
        }
      }
      return glyphs;
    },

    getBaseFontMetricsAndMap: function getBaseFontMetricsAndMap(name) {
      var map = {};
      if (/^Symbol(-?(Bold|Italic))*$/.test(name)) {
        // special case for symbols
        var encoding = Encodings.symbolsEncoding.slice();
        for (var i = 0, n = encoding.length, j; i < n; i++) {
          if (!(j = encoding[i]))
            continue;
          map[i] = GlyphsUnicode[j] || 0;
        }
      }

      var defaultWidth = 0;
      var widths = Metrics[stdFontMap[name] || name];
      if (IsNum(widths)) {
        defaultWidth = widths;
        widths = null;
      }

      return {
        defaultWidth: defaultWidth,
        widths: widths || [],
        map: map
      };
    },

    translateFont: function partialEvaluatorTranslateFont(dict, xref,
                                                          resources) {
      var baseDict = dict;
      var type = dict.get('Subtype');
      assertWellFormed(IsName(type), 'invalid font Subtype');

      var composite = false;
      if (type.name == 'Type0') {
        // If font is a composite
        //  - get the descendant font
        //  - set the type according to the descendant font
        //  - get the FontDescriptor from the descendant font
        var df = dict.get('DescendantFonts');
        if (!df)
          return null;

        if (IsRef(df))
          df = xref.fetch(df);

        dict = xref.fetch(IsRef(df) ? df : df[0]);

        type = dict.get('Subtype');
        assertWellFormed(IsName(type), 'invalid font Subtype');
        composite = true;
      }

      // Before PDF 1.5 if the font was one of the base 14 fonts, having a
      // FontDescriptor was not required.
      // This case is here for compatibility.
      var descriptor = xref.fetchIfRef(dict.get('FontDescriptor'));
      if (!descriptor) {
        var baseFontName = dict.get('BaseFont');
        if (!IsName(baseFontName))
          return null;

        // Using base font name as a font name.
        baseFontName = baseFontName.name.replace(/,/g, '_');
        var metricsAndMap = this.getBaseFontMetricsAndMap(baseFontName);

        var properties = {
          type: type.name,
          encoding: metricsAndMap.map,
          differences: [],
          widths: metricsAndMap.widths,
          defaultWidth: metricsAndMap.defaultWidth,
          firstChar: 0,
          lastChar: 256
        };
        this.extractEncoding(dict, xref, properties);

        return {
          name: baseFontName,
          dict: baseDict,
          properties: properties
        };
      }

      // According to the spec if 'FontDescriptor' is declared, 'FirstChar',
      // 'LastChar' and 'Widths' should exists too, but some PDF encoders seems
      // to ignore this rule when a variant of a standart font is used.
      // TODO Fill the width array depending on which of the base font this is
      // a variant.
      var firstChar = xref.fetchIfRef(dict.get('FirstChar')) || 0;
      var lastChar = xref.fetchIfRef(dict.get('LastChar')) || 256;
      var defaultWidth = 0;
      var glyphWidths = {};
      var encoding = {};
      var widths = xref.fetchIfRef(dict.get('Widths'));
      if (widths) {
        for (var i = 0, j = firstChar; i < widths.length; i++, j++)
          glyphWidths[j] = widths[i];
        defaultWidth = parseFloat(descriptor.get('MissingWidth')) || 0;
      } else {
        // Trying get the BaseFont metrics (see comment above).
        var baseFontName = dict.get('BaseFont');
        if (IsName(baseFontName)) {
          var metricsAndMap = this.getBaseFontMetricsAndMap(baseFontName.name);

          glyphWidths = metricsAndMap.widths;
          defaultWidth = metricsAndMap.defaultWidth;
          encoding = metricsAndMap.map;
        }
      }

      var fontName = xref.fetchIfRef(descriptor.get('FontName'));
      assertWellFormed(IsName(fontName), 'invalid font name');

      var fontFile = descriptor.get('FontFile', 'FontFile2', 'FontFile3');
      if (fontFile) {
        fontFile = xref.fetchIfRef(fontFile);
        if (fontFile.dict) {
          var subtype = fontFile.dict.get('Subtype');
          if (subtype)
            subtype = subtype.name;

          var length1 = fontFile.dict.get('Length1');
          if (!IsInt(length1))
            length1 = xref.fetchIfRef(length1);

          var length2 = fontFile.dict.get('Length2');
          if (!IsInt(length2))
            length2 = xref.fetchIfRef(length2);
        }
      }

      var properties = {
        type: type.name,
        subtype: subtype,
        file: fontFile,
        length1: length1,
        length2: length2,
        composite: composite,
        fixedPitch: false,
        textMatrix: IDENTITY_MATRIX,
        firstChar: firstChar || 0,
        lastChar: lastChar || 256,
        bbox: descriptor.get('FontBBox'),
        ascent: descriptor.get('Ascent'),
        descent: descriptor.get('Descent'),
        xHeight: descriptor.get('XHeight'),
        capHeight: descriptor.get('CapHeight'),
        defaultWidth: defaultWidth,
        flags: descriptor.get('Flags'),
        italicAngle: descriptor.get('ItalicAngle'),
        differences: [],
        widths: glyphWidths,
        encoding: encoding
      };
      properties.glyphs = this.extractEncoding(dict, xref, properties);

      return {
        name: fontName.name,
        dict: baseDict,
        file: fontFile,
        properties: properties
      };
    }
  };

  return constructor;
})();

// <canvas> contexts store most of the state we need natively.
// However, PDF needs a bit more state, which we store here.
var CanvasExtraState = (function canvasExtraState() {
  function constructor(old) {
    // Are soft masks and alpha values shapes or opacities?
    this.alphaIsShape = false;
    this.fontSize = 0;
    this.textMatrix = IDENTITY_MATRIX;
    this.leading = 0;
    // Current point (in user coordinates)
    this.x = 0;
    this.y = 0;
    // Start of text line (in text coordinates)
    this.lineX = 0;
    this.lineY = 0;
    // Character and word spacing
    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.textHScale = 1;
    // Color spaces
    this.fillColorSpaceObj = null;
    this.strokeColorSpaceObj = null;
    this.fillColorObj = null;
    this.strokeColorObj = null;

    this.old = old;
  }

  constructor.prototype = {
    clone: function canvasextra_clone() {
      return Object.create(this);
    },
    setCurrentPoint: function canvasextra_setCurrentPoint(x, y) {
      this.x = x;
      this.y = y;
    }
  };
  return constructor;
})();

function ScratchCanvas(width, height) {
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

var CanvasGraphics = (function canvasGraphics() {
  function constructor(canvasCtx, imageCanvas) {
    this.ctx = canvasCtx;
    this.current = new CanvasExtraState();
    this.stateStack = [];
    this.pendingClip = null;
    this.res = null;
    this.xobjs = null;
    this.ScratchCanvas = imageCanvas || ScratchCanvas;
  }

  var LINE_CAP_STYLES = ['butt', 'round', 'square'];
  var LINE_JOIN_STYLES = ['miter', 'round', 'bevel'];
  var NORMAL_CLIP = {};
  var EO_CLIP = {};

  constructor.prototype = {
    beginDrawing: function canvasGraphicsBeginDrawing(mediaBox) {
      var cw = this.ctx.canvas.width, ch = this.ctx.canvas.height;
      this.ctx.save();
      switch (mediaBox.rotate) {
        case 0:
          this.ctx.transform(1, 0, 0, -1, 0, ch);
          break;
        case 90:
          this.ctx.transform(0, 1, 1, 0, 0, 0);
          break;
        case 180:
          this.ctx.transform(-1, 0, 0, 1, cw, 0);
          break;
        case 270:
          this.ctx.transform(0, -1, -1, 0, cw, ch);
          break;
      }
      this.ctx.scale(cw / mediaBox.width, ch / mediaBox.height);
    },

    compile: function canvasGraphicsCompile(stream, xref, resources, fonts,
                                            images) {
      var pe = new PartialEvaluator();
      return pe.evaluate(stream, xref, resources, fonts, images);
    },

    execute: function canvasGraphicsExecute(code, xref, resources) {
      resources = xref.fetchIfRef(resources) || new Dict();
      var savedXref = this.xref, savedRes = this.res, savedXobjs = this.xobjs;
      this.xref = xref;
      this.res = resources || new Dict();
      this.xobjs = xref.fetchIfRef(this.res.get('XObject')) || new Dict();

      code(this);

      this.xobjs = savedXobjs;
      this.res = savedRes;
      this.xref = savedXref;
    },

    endDrawing: function canvasGraphicsEndDrawing() {
      this.ctx.restore();
    },

    // Graphics state
    setLineWidth: function canvasGraphicsSetLineWidth(width) {
      this.ctx.lineWidth = width;
    },
    setLineCap: function canvasGraphicsSetLineCap(style) {
      this.ctx.lineCap = LINE_CAP_STYLES[style];
    },
    setLineJoin: function canvasGraphicsSetLineJoin(style) {
      this.ctx.lineJoin = LINE_JOIN_STYLES[style];
    },
    setMiterLimit: function canvasGraphicsSetMiterLimit(limit) {
      this.ctx.miterLimit = limit;
    },
    setDash: function canvasGraphicsSetDash(dashArray, dashPhase) {
      this.ctx.mozDash = dashArray;
      this.ctx.mozDashOffset = dashPhase;
    },
    setRenderingIntent: function canvasGraphicsSetRenderingIntent(intent) {
      TODO('set rendering intent: ' + intent);
    },
    setFlatness: function canvasGraphicsSetFlatness(flatness) {
      TODO('set flatness: ' + flatness);
    },
    setGState: function canvasGraphicsSetGState(dictName) {
      var extGState = this.xref.fetchIfRef(this.res.get('ExtGState'));
      if (IsDict(extGState) && extGState.has(dictName.name)) {
        var gsState = this.xref.fetchIfRef(extGState.get(dictName.name));
        var self = this;
        gsState.forEach(function canvasGraphicsSetGStateForEach(key, value) {
          switch (key) {
            case 'Type':
              break;
            case 'LW':
              self.setLineWidth(value);
              break;
            case 'LC':
              self.setLineCap(value);
              break;
            case 'LJ':
              self.setLineJoin(value);
              break;
            case 'ML':
              self.setMiterLimit(value);
              break;
            case 'D':
              self.setDash(value[0], value[1]);
              break;
            case 'RI':
              self.setRenderingIntent(value);
              break;
            case 'FL':
              self.setFlatness(value);
              break;
            case 'Font':
              self.setFont(value[0], value[1]);
              break;
            case 'OP':
            case 'op':
            case 'OPM':
            case 'BG':
            case 'BG2':
            case 'UCR':
            case 'UCR2':
            case 'TR':
            case 'TR2':
            case 'HT':
            case 'SM':
            case 'SA':
            case 'BM':
            case 'SMask':
            case 'CA':
            case 'ca':
            case 'AIS':
            case 'TK':
              TODO('graphic state operator ' + key);
              break;
            default:
              warn('Unknown graphic state operator ' + key);
              break;
          }
        });
      }

    },
    save: function canvasGraphicsSave() {
      this.ctx.save();
      if (this.ctx.$saveCurrentX) {
        this.ctx.$saveCurrentX();
      }
      var old = this.current;
      this.stateStack.push(old);
      this.current = old.clone();
    },
    restore: function canvasGraphicsRestore() {
      var prev = this.stateStack.pop();
      if (prev) {
        if (this.ctx.$restoreCurrentX) {
          this.ctx.$restoreCurrentX();
        }
        this.current = prev;
        this.ctx.restore();
      }
    },
    transform: function canvasGraphicsTransform(a, b, c, d, e, f) {
      this.ctx.transform(a, b, c, d, e, f);
    },

    // Path
    moveTo: function canvasGraphicsMoveTo(x, y) {
      this.ctx.moveTo(x, y);
      this.current.setCurrentPoint(x, y);
    },
    lineTo: function canvasGraphicsLineTo(x, y) {
      this.ctx.lineTo(x, y);
      this.current.setCurrentPoint(x, y);
    },
    curveTo: function canvasGraphicsCurveTo(x1, y1, x2, y2, x3, y3) {
      this.ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      this.current.setCurrentPoint(x3, y3);
    },
    curveTo2: function canvasGraphicsCurveTo2(x2, y2, x3, y3) {
      var current = this.current;
      this.ctx.bezierCurveTo(current.x, current.y, x2, y2, x3, y3);
      current.setCurrentPoint(x3, y3);
    },
    curveTo3: function canvasGraphicsCurveTo3(x1, y1, x3, y3) {
      this.curveTo(x1, y1, x3, y3, x3, y3);
      this.current.setCurrentPoint(x3, y3);
    },
    closePath: function canvasGraphicsClosePath() {
      this.ctx.closePath();
    },
    rectangle: function canvasGraphicsRectangle(x, y, width, height) {
      this.ctx.rect(x, y, width, height);
    },
    stroke: function canvasGraphicsStroke() {
      var ctx = this.ctx;
      var strokeColor = this.current.strokeColor;
      if (strokeColor && strokeColor.type === 'Pattern') {
        // for patterns, we transform to pattern space, calculate
        // the pattern, call stroke, and restore to user space
        ctx.save();
        ctx.strokeStyle = strokeColor.getPattern(ctx);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }

      this.consumePath();
    },
    closeStroke: function canvasGraphicsCloseStroke() {
      this.closePath();
      this.stroke();
    },
    fill: function canvasGraphicsFill() {
      var ctx = this.ctx;
      var fillColor = this.current.fillColor;

      if (fillColor && fillColor.type === 'Pattern') {
        ctx.save();
        ctx.fillStyle = fillColor.getPattern(ctx);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fill();
      }

      this.consumePath();
    },
    eoFill: function canvasGraphicsEoFill() {
      var savedFillRule = this.setEOFillRule();
      this.fill();
      this.restoreFillRule(savedFillRule);
    },
    fillStroke: function canvasGraphicsFillStroke() {
      var ctx = this.ctx;

      var fillColor = this.current.fillColor;
      if (fillColor && fillColor.type === 'Pattern') {
        ctx.save();
        ctx.fillStyle = fillColor.getPattern(ctx);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fill();
      }

      var strokeColor = this.current.strokeColor;
      if (strokeColor && strokeColor.type === 'Pattern') {
        ctx.save();
        ctx.strokeStyle = strokeColor.getPattern(ctx);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }

      this.consumePath();
    },
    eoFillStroke: function canvasGraphicsEoFillStroke() {
      var savedFillRule = this.setEOFillRule();
      this.fillStroke();
      this.restoreFillRule(savedFillRule);
    },
    closeFillStroke: function canvasGraphicsCloseFillStroke() {
      return this.fillStroke();
    },
    closeEOFillStroke: function canvasGraphicsCloseEOFillStroke() {
      var savedFillRule = this.setEOFillRule();
      this.fillStroke();
      this.restoreFillRule(savedFillRule);
    },
    endPath: function canvasGraphicsEndPath() {
      this.consumePath();
    },

    // Clipping
    clip: function canvasGraphicsClip() {
      this.pendingClip = NORMAL_CLIP;
    },
    eoClip: function canvasGraphicsEoClip() {
      this.pendingClip = EO_CLIP;
    },

    // Text
    beginText: function canvasGraphicsBeginText() {
      this.current.textMatrix = IDENTITY_MATRIX;
      if (this.ctx.$setCurrentX) {
        this.ctx.$setCurrentX(0);
      }
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    },
    endText: function canvasGraphicsEndText() {
    },
    setCharSpacing: function canvasGraphicsSetCharSpacing(spacing) {
      this.current.charSpacing = spacing;
    },
    setWordSpacing: function canvasGraphicsSetWordSpacing(spacing) {
      this.current.wordSpacing = spacing;
    },
    setHScale: function canvasGraphicsSetHScale(scale) {
      this.current.textHScale = scale / 100;
    },
    setLeading: function canvasGraphicsSetLeading(leading) {
      this.current.leading = -leading;
    },
    setFont: function canvasGraphicsSetFont(fontRef, size) {
      var font;
      // the tf command uses a name, but graphics state uses a reference
      if (IsName(fontRef)) {
        font = this.xref.fetchIfRef(this.res.get('Font'));
        if (!IsDict(font))
         return;

        font = font.get(fontRef.name);
      } else if (IsRef(fontRef)) {
        font = fontRef;
      }
      font = this.xref.fetchIfRef(font);
      if (!font)
        error('Referenced font is not found');

      var fontObj = font.fontObj;
      this.current.font = fontObj;
      this.current.fontSize = size;

      var name = fontObj.loadedName || 'sans-serif';
      if (this.ctx.$setFont) {
        this.ctx.$setFont(name, size);
      } else {
        var bold = fontObj.black ? (fontObj.bold ? 'bolder' : 'bold') :
                                   (fontObj.bold ? 'bold' : 'normal');

        var italic = fontObj.italic ? 'italic' : 'normal';
        var serif = fontObj.serif ? 'serif' : 'sans-serif';
        var typeface = '"' + name + '", ' + serif;
        var rule = italic + ' ' + bold + ' ' + size + 'px ' + typeface;
        this.ctx.font = rule;
      }
    },
    setTextRenderingMode: function canvasGraphicsSetTextRenderingMode(mode) {
      TODO('text rendering mode: ' + mode);
    },
    setTextRise: function canvasGraphicsSetTextRise(rise) {
      TODO('text rise: ' + rise);
    },
    moveText: function canvasGraphicsMoveText(x, y) {
      this.current.x = this.current.lineX += x;
      this.current.y = this.current.lineY += y;
      if (this.ctx.$setCurrentX) {
        this.ctx.$setCurrentX(this.current.x);
      }
    },
    setLeadingMoveText: function canvasGraphicsSetLeadingMoveText(x, y) {
      this.setLeading(-y);
      this.moveText(x, y);
    },
    setTextMatrix: function canvasGraphicsSetTextMatrix(a, b, c, d, e, f) {
      this.current.textMatrix = [a, b, c, d, e, f];

      if (this.ctx.$setCurrentX) {
        this.ctx.$setCurrentX(0);
      }
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    },
    nextLine: function canvasGraphicsNextLine() {
      this.moveText(0, this.current.leading);
    },
    showText: function canvasGraphicsShowText(text) {
      var ctx = this.ctx;
      var current = this.current;
      var font = current.font;

      ctx.save();
      ctx.transform.apply(ctx, current.textMatrix);
      ctx.scale(1, -1);
      ctx.translate(current.x, -1 * current.y);
      ctx.transform.apply(ctx, font.textMatrix || IDENTITY_MATRIX);

      var glyphs = font.charsToGlyphs(text);
      var fontSize = current.fontSize;
      var charSpacing = current.charSpacing;
      var wordSpacing = current.wordSpacing;
      var textHScale = current.textHScale;
      ctx.scale(1 / textHScale, 1);

      var width = 0;
      var glyphsLength = glyphs.length;
      for (var i = 0; i < glyphsLength; ++i) {
        var glyph = glyphs[i];
        if (glyph === null) {
          // word break
          width += wordSpacing;
          continue;
        }

        var unicode = glyph.unicode;
        var char = (unicode >= 0x10000) ?
          String.fromCharCode(0xD800 | ((unicode - 0x10000) >> 10),
          0xDC00 | (unicode & 0x3FF)) : String.fromCharCode(unicode);

        ctx.fillText(char, width, 0);
        width += glyph.width * fontSize * 0.001 + charSpacing;
      }
      current.x += width;

      this.ctx.restore();
    },
    showSpacedText: function canvasGraphicsShowSpacedText(arr) {
      var ctx = this.ctx;
      var current = this.current;
      var fontSize = current.fontSize;
      var textHScale = current.textHScale;
      var arrLength = arr.length;
      for (var i = 0; i < arrLength; ++i) {
        var e = arr[i];
        if (IsNum(e)) {
          if (ctx.$addCurrentX) {
            ctx.$addCurrentX(-e * 0.001 * fontSize);
          } else {
            current.x -= e * 0.001 * fontSize * textHScale;
          }
        } else if (IsString(e)) {
          this.showText(e);
        } else {
          malformed('TJ array element ' + e + ' is not string or num');
        }
      }
    },
    nextLineShowText: function canvasGraphicsNextLineShowText(text) {
      this.nextLine();
      this.showText(text);
    },
    nextLineSetSpacingShowText:
      function canvasGraphicsNextLineSetSpacingShowText(wordSpacing,
                                                        charSpacing,
                                                        text) {
      this.setWordSpacing(wordSpacing);
      this.setCharSpacing(charSpacing);
      this.nextLineShowText(text);
    },

    // Type3 fonts
    setCharWidth: function canvasGraphicsSetCharWidth(xWidth, yWidth) {
      TODO('type 3 fonts ("d0" operator) xWidth: ' + xWidth + ' yWidth: ' +
           yWidth);
    },
    setCharWidthAndBounds: function canvasGraphicsSetCharWidthAndBounds(xWidth,
                                                                        yWidth,
                                                                        llx,
                                                                        lly,
                                                                        urx,
                                                                        ury) {
      TODO('type 3 fonts ("d1" operator) xWidth: ' + xWidth + ' yWidth: ' +
           yWidth + ' llx: ' + llx + ' lly: ' + lly + ' urx: ' + urx +
           ' ury ' + ury);
    },

    // Color
    setStrokeColorSpace: function canvasGraphicsSetStrokeColorSpace(space) {
      this.current.strokeColorSpace =
          ColorSpace.parse(space, this.xref, this.res);
    },
    setFillColorSpace: function canvasGraphicsSetFillColorSpace(space) {
      this.current.fillColorSpace =
          ColorSpace.parse(space, this.xref, this.res);
    },
    setStrokeColor: function canvasGraphicsSetStrokeColor(/*...*/) {
      var cs = this.current.strokeColorSpace;
      var color = cs.getRgb(arguments);
      this.setStrokeRGBColor.apply(this, color);
    },
    setStrokeColorN: function canvasGraphicsSetStrokeColorN(/*...*/) {
      var cs = this.current.strokeColorSpace;

      if (cs.name == 'Pattern') {
        // wait until fill to actually get the pattern, since Canvas
        // calcualtes the pattern according to the current coordinate space,
        // not the space when the pattern is set.
        var pattern = Pattern.parse(arguments, cs, this.xref, this.res,
                                    this.ctx);
        this.current.strokeColor = pattern;
      } else {
        this.setStrokeColor.apply(this, arguments);
      }
    },
    setFillColor: function canvasGraphicsSetFillColor(/*...*/) {
      var cs = this.current.fillColorSpace;
      var color = cs.getRgb(arguments);
      this.setFillRGBColor.apply(this, color);
    },
    setFillColorN: function canvasGraphicsSetFillColorN(/*...*/) {
      var cs = this.current.fillColorSpace;

      if (cs.name == 'Pattern') {
        // wait until fill to actually get the pattern
        var pattern = Pattern.parse(arguments, cs, this.xref, this.res,
                                    this.ctx);
        this.current.fillColor = pattern;
      } else {
        this.setFillColor.apply(this, arguments);
      }
    },
    setStrokeGray: function canvasGraphicsSetStrokeGray(gray) {
      this.setStrokeRGBColor(gray, gray, gray);
    },
    setFillGray: function canvasGraphicsSetFillGray(gray) {
      this.setFillRGBColor(gray, gray, gray);
    },
    setStrokeRGBColor: function canvasGraphicsSetStrokeRGBColor(r, g, b) {
      var color = Util.makeCssRgb(r, g, b);
      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    },
    setFillRGBColor: function canvasGraphicsSetFillRGBColor(r, g, b) {
      var color = Util.makeCssRgb(r, g, b);
      this.ctx.fillStyle = color;
      this.current.fillColor = color;
    },
    setStrokeCMYKColor: function canvasGraphicsSetStrokeCMYKColor(c, m, y, k) {
      var color = Util.makeCssCmyk(c, m, y, k);
      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    },
    setFillCMYKColor: function canvasGraphicsSetFillCMYKColor(c, m, y, k) {
      var color = Util.makeCssCmyk(c, m, y, k);
      this.ctx.fillStyle = color;
      this.current.fillColor = color;
    },

    // Shading
    shadingFill: function canvasGraphicsShadingFill(shadingName) {
      var xref = this.xref;
      var res = this.res;
      var ctx = this.ctx;

      var shadingRes = xref.fetchIfRef(res.get('Shading'));
      if (!shadingRes)
        error('No shading resource found');

      var shading = xref.fetchIfRef(shadingRes.get(shadingName.name));
      if (!shading)
        error('No shading object found');

      var shadingFill = Pattern.parseShading(shading, null, xref, res, ctx);

      this.save();
      ctx.fillStyle = shadingFill.getPattern();

      var inv = ctx.mozCurrentTransformInverse;
      if (inv) {
        var canvas = ctx.canvas;
        var width = canvas.width;
        var height = canvas.height;

        var bl = Util.applyTransform([0, 0], inv);
        var br = Util.applyTransform([0, width], inv);
        var ul = Util.applyTransform([height, 0], inv);
        var ur = Util.applyTransform([height, width], inv);

        var x0 = Math.min(bl[0], br[0], ul[0], ur[0]);
        var y0 = Math.min(bl[1], br[1], ul[1], ur[1]);
        var x1 = Math.max(bl[0], br[0], ul[0], ur[0]);
        var y1 = Math.max(bl[1], br[1], ul[1], ur[1]);

        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else {
        // HACK to draw the gradient onto an infinite rectangle.
        // PDF gradients are drawn across the entire image while
        // Canvas only allows gradients to be drawn in a rectangle
        // The following bug should allow us to remove this.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=664884

        this.ctx.fillRect(-1e10, -1e10, 2e10, 2e10);
      }

      this.restore();
    },

    // Images
    beginInlineImage: function canvasGraphicsBeginInlineImage() {
      error('Should not call beginInlineImage');
    },
    beginImageData: function canvasGraphicsBeginImageData() {
      error('Should not call beginImageData');
    },
    endInlineImage: function canvasGraphicsEndInlineImage(image) {
      this.paintImageXObject(null, image, true);
    },

    // XObjects
    paintXObject: function canvasGraphicsPaintXObject(obj) {
      var xobj = this.xobjs.get(obj.name);
      if (!xobj)
        return;
      xobj = this.xref.fetchIfRef(xobj);
      assertWellFormed(IsStream(xobj), 'XObject should be a stream');

      var oc = xobj.dict.get('OC');
      if (oc) {
        TODO('oc for xobject');
      }

      var opi = xobj.dict.get('OPI');
      if (opi) {
        TODO('opi for xobject');
      }

      var type = xobj.dict.get('Subtype');
      assertWellFormed(IsName(type), 'XObject should have a Name subtype');
      if ('Image' == type.name) {
        this.paintImageXObject(obj, xobj, false);
      } else if ('Form' == type.name) {
        this.paintFormXObject(obj, xobj);
      } else if ('PS' == type.name) {
        warn('(deprecated) PostScript XObjects are not supported');
      } else {
        malformed('Unknown XObject subtype ' + type.name);
      }
    },

    paintFormXObject: function canvasGraphicsPaintFormXObject(ref, stream) {
      this.save();

      var matrix = stream.dict.get('Matrix');
      if (matrix && IsArray(matrix) && 6 == matrix.length)
        this.transform.apply(this, matrix);

      var bbox = stream.dict.get('BBox');
      if (bbox && IsArray(bbox) && 4 == bbox.length) {
        this.rectangle.apply(this, bbox);
        this.clip();
        this.endPath();
      }

      this.execute(ref.code, this.xref, stream.dict.get('Resources'));

      this.restore();
    },

    paintImageXObject: function canvasGraphicsPaintImageXObject(ref, image,
                                                                inline) {
      this.save();

      var ctx = this.ctx;
      var dict = image.dict;
      var w = dict.get('Width', 'W');
      var h = dict.get('Height', 'H');
      // scale the image to the unit square
      ctx.scale(1 / w, -1 / h);

      // If the platform can render the image format directly, the
      // stream has a getImage property which directly returns a
      // suitable DOM Image object.
      if (image.getImage) {
        var domImage = image.getImage();
        ctx.drawImage(domImage, 0, 0, domImage.width, domImage.height,
                      0, -h, w, h);
        this.restore();
        return;
      }

      var imageObj = new PDFImage(this.xref, this.res, image, inline);

      var tmpCanvas = new this.ScratchCanvas(w, h);
      var tmpCtx = tmpCanvas.getContext('2d');
      if (imageObj.imageMask) {
        var fillColor = this.current.fillColor;
        tmpCtx.fillStyle = (fillColor && fillColor.type === 'Pattern') ?
          fillColor.getPattern(tmpCtx) : fillColor;
        tmpCtx.fillRect(0, 0, w, h);
      }
      var imgData = tmpCtx.getImageData(0, 0, w, h);
      var pixels = imgData.data;

      if (imageObj.imageMask) {
        var inverseDecode = !!imageObj.decode && imageObj.decode[0] > 0;
        imageObj.applyStencilMask(pixels, inverseDecode);
      } else
        imageObj.fillRgbaBuffer(pixels, imageObj.decode);

      tmpCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(tmpCanvas, 0, -h);
      this.restore();
    },

    // Marked content

    markPoint: function canvasGraphicsMarkPoint(tag) {
      TODO('Marked content');
    },
    markPointProps: function canvasGraphicsMarkPointProps(tag, properties) {
      TODO('Marked content');
    },
    beginMarkedContent: function canvasGraphicsBeginMarkedContent(tag) {
      TODO('Marked content');
    },
    beginMarkedContentProps:
      function canvasGraphicsBeginMarkedContentProps(tag, properties) {
      TODO('Marked content');
    },
    endMarkedContent: function canvasGraphicsEndMarkedContent() {
      TODO('Marked content');
    },

    // Compatibility

    beginCompat: function canvasGraphicsBeginCompat() {
      TODO('ignore undefined operators (should we do that anyway?)');
    },
    endCompat: function canvasGraphicsEndCompat() {
      TODO('stop ignoring undefined operators');
    },

    // Helper functions

    consumePath: function canvasGraphicsConsumePath() {
      if (this.pendingClip) {
        var savedFillRule = null;
        if (this.pendingClip == EO_CLIP)
          savedFillRule = this.setEOFillRule();

        this.ctx.clip();

        this.pendingClip = null;
        if (savedFillRule !== null)
          this.restoreFillRule(savedFillRule);
      }
      this.ctx.beginPath();
    },
    // We generally keep the canvas context set for
    // nonzero-winding, and just set evenodd for the operations
    // that need them.
    setEOFillRule: function canvasGraphicsSetEOFillRule() {
      var savedFillRule = this.ctx.mozFillRule;
      this.ctx.mozFillRule = 'evenodd';
      return savedFillRule;
    },
    restoreFillRule: function canvasGraphicsRestoreFillRule(rule) {
      this.ctx.mozFillRule = rule;
    }
  };

  return constructor;
})();

var Util = (function utilUtil() {
  function constructor() {}
  constructor.makeCssRgb = function makergb(r, g, b) {
    var ri = (255 * r) | 0, gi = (255 * g) | 0, bi = (255 * b) | 0;
    return 'rgb(' + ri + ',' + gi + ',' + bi + ')';
  };
  constructor.makeCssCmyk = function makecmyk(c, m, y, k) {
    c = (new DeviceCmykCS()).getRgb([c, m, y, k]);
    var ri = (255 * c[0]) | 0, gi = (255 * c[1]) | 0, bi = (255 * c[2]) | 0;
    return 'rgb(' + ri + ',' + gi + ',' + bi + ')';
  };
  constructor.applyTransform = function apply(p, m) {
    var xt = p[0] * m[0] + p[1] * m[2] + m[4];
    var yt = p[0] * m[1] + p[1] * m[3] + m[5];
    return [xt, yt];
  };

  return constructor;
})();

var ColorSpace = (function colorSpaceColorSpace() {
  // Constructor should define this.numComps, this.defaultColor, this.name
  function constructor() {
    error('should not call ColorSpace constructor');
  }

  constructor.prototype = {
    // Input: array of size numComps representing color component values
    // Output: array of rgb values, each value ranging from [0.1]
    getRgb: function cs_getRgb(color) {
      error('Should not call ColorSpace.getRgb: ' + color);
    },
    // Input: Uint8Array of component values, each value scaled to [0,255]
    // Output: Uint8Array of rgb values, each value scaled to [0,255]
    getRgbBuffer: function cs_getRgbBuffer(input) {
      error('Should not call ColorSpace.getRgbBuffer: ' + input);
    }
  };

  constructor.parse = function colorspace_parse(cs, xref, res) {
    if (IsName(cs)) {
      var colorSpaces = xref.fetchIfRef(res.get('ColorSpace'));
      if (IsDict(colorSpaces)) {
        var refcs = colorSpaces.get(cs.name);
        if (refcs)
          cs = refcs;
      }
    }

    cs = xref.fetchIfRef(cs);

    if (IsName(cs)) {
      var mode = cs.name;
      this.mode = mode;

      switch (mode) {
        case 'DeviceGray':
        case 'G':
          return new DeviceGrayCS();
        case 'DeviceRGB':
        case 'RGB':
          return new DeviceRgbCS();
        case 'DeviceCMYK':
        case 'CMYK':
          return new DeviceCmykCS();
        case 'Pattern':
          return new PatternCS(null);
        default:
          error('unrecognized colorspace ' + mode);
      }
    } else if (IsArray(cs)) {
      var mode = cs[0].name;
      this.mode = mode;

      switch (mode) {
        case 'DeviceGray':
        case 'G':
          return new DeviceGrayCS();
        case 'DeviceRGB':
        case 'RGB':
          return new DeviceRgbCS();
        case 'DeviceCMYK':
        case 'CMYK':
          return new DeviceCmykCS();
        case 'CalGray':
          return new DeviceGrayCS();
        case 'CalRGB':
          return new DeviceRgbCS();
        case 'ICCBased':
          var stream = xref.fetchIfRef(cs[1]);
          var dict = stream.dict;
          var numComps = dict.get('N');
          if (numComps == 1)
            return new DeviceGrayCS();
          if (numComps == 3)
            return new DeviceRgbCS();
          if (numComps == 4)
            return new DeviceCmykCS();
          break;
        case 'Pattern':
          var baseCS = cs[1];
          if (baseCS)
            baseCS = ColorSpace.parse(baseCS, xref, res);
          return new PatternCS(baseCS);
        case 'Indexed':
          var base = ColorSpace.parse(cs[1], xref, res);
          var hiVal = cs[2] + 1;
          var lookup = xref.fetchIfRef(cs[3]);
          return new IndexedCS(base, hiVal, lookup);
        case 'Separation':
          var alt = ColorSpace.parse(cs[2], xref, res);
          var tintFn = new PDFFunction(xref, xref.fetchIfRef(cs[3]));
          return new SeparationCS(alt, tintFn);
        case 'Lab':
        case 'DeviceN':
        default:
          error('unimplemented color space object "' + mode + '"');
      }
    } else {
      error('unrecognized color space object: "' + cs + '"');
    }
    return null;
  };

  return constructor;
})();

var SeparationCS = (function separationCS() {
  function constructor(base, tintFn) {
    this.name = 'Separation';
    this.numComps = 1;
    this.defaultColor = [1];

    this.base = base;
    this.tintFn = tintFn;
  }

  constructor.prototype = {
    getRgb: function sepcs_getRgb(color) {
      var tinted = this.tintFn.func(color);
      return this.base.getRgb(tinted);
    },
    getRgbBuffer: function sepcs_getRgbBuffer(input, bits) {
      var tintFn = this.tintFn;
      var base = this.base;
      var scale = 1 / ((1 << bits) - 1);

      var length = input.length;
      var pos = 0;

      var numComps = base.numComps;
      var baseBuf = new Uint8Array(numComps * length);
      for (var i = 0; i < length; ++i) {
        var scaled = input[i] * scale;
        var tinted = tintFn.func([scaled]);
        for (var j = 0; j < numComps; ++j)
          baseBuf[pos++] = 255 * tinted[j];
      }
      return base.getRgbBuffer(baseBuf, 8);

    }
  };

  return constructor;
})();

var PatternCS = (function patternCS() {
  function constructor(baseCS) {
    this.name = 'Pattern';
    this.base = baseCS;
  }
  constructor.prototype = {};

  return constructor;
})();

var IndexedCS = (function indexedCS() {
  function constructor(base, highVal, lookup) {
    this.name = 'Indexed';
    this.numComps = 1;
    this.defaultColor = [0];

    this.base = base;
    var baseNumComps = base.numComps;
    this.highVal = highVal;

    var length = baseNumComps * highVal;
    var lookupArray = new Uint8Array(length);
    if (IsStream(lookup)) {
      var bytes = lookup.getBytes(length);
      lookupArray.set(bytes);
    } else if (IsString(lookup)) {
      for (var i = 0; i < length; ++i)
        lookupArray[i] = lookup.charCodeAt(i);
    } else {
      error('Unrecognized lookup table: ' + lookup);
    }
    this.lookup = lookupArray;
  }

  constructor.prototype = {
    getRgb: function indexcs_getRgb(color) {
      var numComps = this.base.numComps;

      var start = color[0] * numComps;
      var c = [];

      for (var i = start, ii = start + numComps; i < ii; ++i)
        c.push(this.lookup[i]);

      return this.base.getRgb(c);
    },
    getRgbBuffer: function indexcs_getRgbBuffer(input) {
      var base = this.base;
      var numComps = base.numComps;
      var lookup = this.lookup;
      var length = input.length;

      var baseBuf = new Uint8Array(length * numComps);
      var baseBufPos = 0;
      for (var i = 0; i < length; ++i) {
        var lookupPos = input[i] * numComps;
        for (var j = 0; j < numComps; ++j) {
          baseBuf[baseBufPos++] = lookup[lookupPos + j];
        }
      }

      return base.getRgbBuffer(baseBuf, 8);
    }
  };
  return constructor;
})();

var DeviceGrayCS = (function deviceGrayCS() {
  function constructor() {
    this.name = 'DeviceGray';
    this.numComps = 1;
    this.defaultColor = [0];
  }

  constructor.prototype = {
    getRgb: function graycs_getRgb(color) {
      var c = color[0];
      return [c, c, c];
    },
    getRgbBuffer: function graycs_getRgbBuffer(input, bits) {
      var scale = 255 / ((1 << bits) - 1);
      var length = input.length;
      var rgbBuf = new Uint8Array(length * 3);
      for (var i = 0, j = 0; i < length; ++i) {
        var c = (scale * input[i]) | 0;
        rgbBuf[j++] = c;
        rgbBuf[j++] = c;
        rgbBuf[j++] = c;
      }
      return rgbBuf;
    }
  };
  return constructor;
})();

var DeviceRgbCS = (function deviceRgbCS() {
  function constructor(bits) {
    this.name = 'DeviceRGB';
    this.numComps = 3;
    this.defaultColor = [0, 0, 0];
  }
  constructor.prototype = {
    getRgb: function rgbcs_getRgb(color) {
      return color;
    },
    getRgbBuffer: function rgbcs_getRgbBuffer(input, bits) {
      if (bits == 8)
        return input;
      var scale = 255 / ((1 << bits) - 1);
      var i, length = input.length;
      var rgbBuf = new Uint8Array(length);
      for (i = 0; i < length; ++i)
        rgbBuf[i] = (scale * input[i]) | 0;
      return rgbBuf;
    }
  };
  return constructor;
})();

var DeviceCmykCS = (function deviceCmykCS() {
  function constructor() {
    this.name = 'DeviceCMYK';
    this.numComps = 4;
    this.defaultColor = [0, 0, 0, 1];
  }
  constructor.prototype = {
    getRgb: function cmykcs_getRgb(color) {
      var c = color[0], m = color[1], y = color[2], k = color[3];
      var c1 = 1 - c, m1 = 1 - m, y1 = 1 - y, k1 = 1 - k;

      var x, r, g, b;
      // this is a matrix multiplication, unrolled for performance
      // code is taken from the poppler implementation
      x = c1 * m1 * y1 * k1; // 0 0 0 0
      r = g = b = x;
      x = c1 * m1 * y1 * k;  // 0 0 0 1
      r += 0.1373 * x;
      g += 0.1216 * x;
      b += 0.1255 * x;
      x = c1 * m1 * y * k1; // 0 0 1 0
      r += x;
      g += 0.9490 * x;
      x = c1 * m1 * y * k;  // 0 0 1 1
      r += 0.1098 * x;
      g += 0.1020 * x;
      x = c1 * m * y1 * k1; // 0 1 0 0
      r += 0.9255 * x;
      b += 0.5490 * x;
      x = c1 * m * y1 * k;  // 0 1 0 1
      r += 0.1412 * x;
      x = c1 * m * y * k1; // 0 1 1 0
      r += 0.9294 * x;
      g += 0.1098 * x;
      b += 0.1412 * x;
      x = c1 * m * y * k;  // 0 1 1 1
      r += 0.1333 * x;
      x = c * m1 * y1 * k1; // 1 0 0 0
      g += 0.6784 * x;
      b += 0.9373 * x;
      x = c * m1 * y1 * k;  // 1 0 0 1
      g += 0.0588 * x;
      b += 0.1412 * x;
      x = c * m1 * y * k1; // 1 0 1 0
      g += 0.6510 * x;
      b += 0.3137 * x;
      x = c * m1 * y * k;  // 1 0 1 1
      g += 0.0745 * x;
      x = c * m * y1 * k1; // 1 1 0 0
      r += 0.1804 * x;
      g += 0.1922 * x;
      b += 0.5725 * x;
      x = c * m * y1 * k;  // 1 1 0 1
      b += 0.0078 * x;
      x = c * m * y * k1; // 1 1 1 0
      r += 0.2118 * x;
      g += 0.2119 * x;
      b += 0.2235 * x;

      return [r, g, b];
    },
    getRgbBuffer: function cmykcs_getRgbBuffer(colorBuf, bits) {
      var scale = 1 / ((1 << bits) - 1);
      var length = colorBuf.length / 4;
      var rgbBuf = new Uint8Array(length * 3);
      var rgbBufPos = 0;
      var colorBufPos = 0;

      for (var i = 0; i < length; i++) {
        var cmyk = [];
        for (var j = 0; j < 4; ++j)
          cmyk.push(scale * colorBuf[colorBufPos++]);

        var rgb = this.getRgb(cmyk);
        for (var j = 0; j < 3; ++j)
          rgbBuf[rgbBufPos++] = Math.round(rgb[j] * 255);
      }

      return rgbBuf;
    }
  };
  return constructor;
})();

var Pattern = (function patternPattern() {
  // Constructor should define this.getPattern
  function constructor() {
    error('should not call Pattern constructor');
  }

  constructor.prototype = {
    // Input: current Canvas context
    // Output: the appropriate fillStyle or strokeStyle
    getPattern: function pattern_getStyle(ctx) {
      error('Should not call Pattern.getStyle: ' + ctx);
    }
  };

  constructor.parse = function pattern_parse(args, cs, xref, res, ctx) {
    var length = args.length;

    var patternName = args[length - 1];
    if (!IsName(patternName))
      error('Bad args to getPattern: ' + patternName);

    var patternRes = xref.fetchIfRef(res.get('Pattern'));
    if (!patternRes)
      error('Unable to find pattern resource');

    var pattern = xref.fetchIfRef(patternRes.get(patternName.name));
    var dict = IsStream(pattern) ? pattern.dict : pattern;
    var typeNum = dict.get('PatternType');

    switch (typeNum) {
      case 1:
        var base = cs.base;
        var color;
        if (base) {
          var baseComps = base.numComps;

          color = [];
          for (var i = 0; i < baseComps; ++i)
            color.push(args[i]);

          color = base.getRgb(color);
        }
        var code = patternName.code;
        return new TilingPattern(pattern, code, dict, color, xref, ctx);
      case 2:
        var shading = xref.fetchIfRef(dict.get('Shading'));
        var matrix = dict.get('Matrix');
        return Pattern.parseShading(shading, matrix, xref, res, ctx);
      default:
        error('Unknown type of pattern: ' + typeNum);
    }
    return null;
  };

  constructor.parseShading = function pattern_shading(shading, matrix,
      xref, res, ctx) {

    var dict = IsStream(shading) ? shading.dict : shading;
    var type = dict.get('ShadingType');

    switch (type) {
      case 2:
      case 3:
        // both radial and axial shadings are handled by RadialAxial shading
        return new RadialAxialShading(dict, matrix, xref, res, ctx);
      default:
        return new DummyShading();
    }
  };
  return constructor;
})();

var DummyShading = (function dummyShading() {
  function constructor() {
    this.type = 'Pattern';
  }
  constructor.prototype = {
    getPattern: function dummy_getpattern() {
      return 'hotpink';
    }
  };
  return constructor;
})();

// Radial and axial shading have very similar implementations
// If needed, the implementations can be broken into two classes
var RadialAxialShading = (function radialAxialShading() {
  function constructor(dict, matrix, xref, res, ctx) {
    this.matrix = matrix;
    this.coordsArr = dict.get('Coords');
    this.shadingType = dict.get('ShadingType');
    this.type = 'Pattern';

    this.ctx = ctx;
    this.curMatrix = ctx.mozCurrentTransform;

    var cs = dict.get('ColorSpace', 'CS');
    cs = ColorSpace.parse(cs, xref, res);
    this.cs = cs;

    var t0 = 0.0, t1 = 1.0;
    if (dict.has('Domain')) {
      var domainArr = dict.get('Domain');
      t0 = domainArr[0];
      t1 = domainArr[1];
    }

    var extendStart = false, extendEnd = false;
    if (dict.has('Extend')) {
      var extendArr = dict.get('Extend');
      extendStart = extendArr[0];
      extendEnd = extendArr[1];
      TODO('Support extend');
    }

    this.extendStart = extendStart;
    this.extendEnd = extendEnd;

    var fnObj = dict.get('Function');
    fnObj = xref.fetchIfRef(fnObj);
    if (IsArray(fnObj))
      error('No support for array of functions');
    else if (!IsPDFFunction(fnObj))
      error('Invalid function');
    var fn = new PDFFunction(xref, fnObj);

    // 10 samples seems good enough for now, but probably won't work
    // if there are sharp color changes. Ideally, we would implement
    // the spec faithfully and add lossless optimizations.
    var step = (t1 - t0) / 10;
    var diff = t1 - t0;

    var colorStops = [];
    for (var i = t0; i <= t1; i += step) {
      var color = fn.func([i]);
      var rgbColor = Util.makeCssRgb.apply(this, cs.getRgb(color));
      colorStops.push([(i - t0) / diff, rgbColor]);
    }

    this.colorStops = colorStops;
  }

  constructor.prototype = {
    getPattern: function radialAxialShadingGetPattern() {
      var coordsArr = this.coordsArr;
      var type = this.shadingType;
      var p0, p1, r0, r1;
      if (type == 2) {
        p0 = [coordsArr[0], coordsArr[1]];
        p1 = [coordsArr[2], coordsArr[3]];
      } else if (type == 3) {
        p0 = [coordsArr[0], coordsArr[1]];
        p1 = [coordsArr[3], coordsArr[4]];
        r0 = coordsArr[2];
        r1 = coordsArr[5];
      } else {
        error('getPattern type unknown: ' + type);
      }

      var matrix = this.matrix;
      if (matrix) {
        p0 = Util.applyTransform(p0, matrix);
        p1 = Util.applyTransform(p1, matrix);
      }

      // if the browser supports getting the tranform matrix, convert
      // gradient coordinates from pattern space to current user space
      var curMatrix = this.curMatrix;
      var ctx = this.ctx;
      if (curMatrix) {
        var userMatrix = ctx.mozCurrentTransformInverse;

        p0 = Util.applyTransform(p0, curMatrix);
        p0 = Util.applyTransform(p0, userMatrix);

        p1 = Util.applyTransform(p1, curMatrix);
        p1 = Util.applyTransform(p1, userMatrix);
      }

      var colorStops = this.colorStops, grad;
      if (type == 2)
        grad = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
      else if (type == 3)
        grad = ctx.createRadialGradient(p0[0], p0[1], r0, p1[0], p1[1], r1);

      for (var i = 0, ii = colorStops.length; i < ii; ++i) {
        var c = colorStops[i];
        grad.addColorStop(c[0], c[1]);
      }
      return grad;
    }
  };
  return constructor;
})();

var TilingPattern = (function tilingPattern() {
  var PAINT_TYPE_COLORED = 1, PAINT_TYPE_UNCOLORED = 2;

  function constructor(pattern, code, dict, color, xref, ctx) {
      function multiply(m, tm) {
        var a = m[0] * tm[0] + m[1] * tm[2];
        var b = m[0] * tm[1] + m[1] * tm[3];
        var c = m[2] * tm[0] + m[3] * tm[2];
        var d = m[2] * tm[1] + m[3] * tm[3];
        var e = m[4] * tm[0] + m[5] * tm[2] + tm[4];
        var f = m[4] * tm[1] + m[5] * tm[3] + tm[5];
        return [a, b, c, d, e, f];
      }

      TODO('TilingType');

      this.matrix = dict.get('Matrix');
      this.curMatrix = ctx.mozCurrentTransform;
      this.invMatrix = ctx.mozCurrentTransformInverse;
      this.ctx = ctx;
      this.type = 'Pattern';

      var bbox = dict.get('BBox');
      var x0 = bbox[0], y0 = bbox[1], x1 = bbox[2], y1 = bbox[3];

      var xstep = dict.get('XStep');
      var ystep = dict.get('YStep');

      var topLeft = [x0, y0];
      // we want the canvas to be as large as the step size
      var botRight = [x0 + xstep, y0 + ystep];

      var width = botRight[0] - topLeft[0];
      var height = botRight[1] - topLeft[1];

      // TODO: hack to avoid OOM, we would idealy compute the tiling
      // pattern to be only as large as the acual size in device space
      // This could be computed with .mozCurrentTransform, but still
      // needs to be implemented
      while (Math.abs(width) > 512 || Math.abs(height) > 512) {
        width = 512;
        height = 512;
      }

      var tmpCanvas = new ScratchCanvas(width, height);

      // set the new canvas element context as the graphics context
      var tmpCtx = tmpCanvas.getContext('2d');
      var graphics = new CanvasGraphics(tmpCtx);

      var paintType = dict.get('PaintType');
      switch (paintType) {
        case PAINT_TYPE_COLORED:
          tmpCtx.fillStyle = ctx.fillStyle;
          tmpCtx.strokeStyle = ctx.strokeStyle;
          break;
        case PAINT_TYPE_UNCOLORED:
          color = Util.makeCssRgb.apply(this, color);
          tmpCtx.fillStyle = color;
          tmpCtx.strokeStyle = color;
          break;
        default:
          error('Unsupported paint type: ' + paintType);
      }

      var scale = [width / xstep, height / ystep];
      this.scale = scale;

      // transform coordinates to pattern space
      var tmpTranslate = [1, 0, 0, 1, -topLeft[0], -topLeft[1]];
      var tmpScale = [scale[0], 0, 0, scale[1], 0, 0];
      graphics.transform.apply(graphics, tmpScale);
      graphics.transform.apply(graphics, tmpTranslate);

      if (bbox && IsArray(bbox) && 4 == bbox.length) {
        graphics.rectangle.apply(graphics, bbox);
        graphics.clip();
        graphics.endPath();
      }

      var res = xref.fetchIfRef(dict.get('Resources'));
      graphics.execute(code, xref, res);

      this.canvas = tmpCanvas;
  }

  constructor.prototype = {
    getPattern: function tiling_getPattern() {
      var matrix = this.matrix;
      var curMatrix = this.curMatrix;
      var ctx = this.ctx;

      if (curMatrix)
        ctx.setTransform.apply(ctx, curMatrix);

      if (matrix)
        ctx.transform.apply(ctx, matrix);

      var scale = this.scale;
      ctx.scale(1 / scale[0], 1 / scale[1]);

      return ctx.createPattern(this.canvas, 'repeat');
    }
  };
  return constructor;
})();


var PDFImage = (function pdfImage() {
  function constructor(xref, res, image, inline) {
    this.image = image;
    if (image.getParams) {
      // JPX/JPEG2000 streams directly contain bits per component
      // and color space mode information.
      TODO('get params from actual stream');
      // var bits = ...
      // var colorspace = ...
    }
    // TODO cache rendered images?

    var dict = image.dict;
    this.width = dict.get('Width', 'W');
    this.height = dict.get('Height', 'H');

    if (this.width < 1 || this.height < 1)
      error('Invalid image width: ' + this.width + ' or height: ' +
            this.height);

    this.interpolate = dict.get('Interpolate', 'I') || false;
    this.imageMask = dict.get('ImageMask', 'IM') || false;

    var bitsPerComponent = image.bitsPerComponent;
    if (!bitsPerComponent) {
      bitsPerComponent = dict.get('BitsPerComponent', 'BPC');
      if (!bitsPerComponent) {
        if (this.imageMask)
          bitsPerComponent = 1;
        else
          error('Bits per component missing in image: ' + this.imageMask);
      }
    }
    this.bpc = bitsPerComponent;

    if (!this.imageMask) {
      var colorSpace = dict.get('ColorSpace', 'CS');
      if (!colorSpace) {
        TODO('JPX images (which don"t require color spaces');
        colorSpace = new Name('DeviceRGB');
      }
      this.colorSpace = ColorSpace.parse(colorSpace, xref, res);
      this.numComps = this.colorSpace.numComps;
    }

    this.decode = dict.get('Decode', 'D');

    var mask = xref.fetchIfRef(dict.get('Mask'));
    var smask = xref.fetchIfRef(dict.get('SMask'));

    if (mask) {
      TODO('masked images');
    } else if (smask) {
      this.smask = new PDFImage(xref, res, smask);
    }
  }

  constructor.prototype = {
    getComponents: function getComponents(buffer, decodeMap) {
      var bpc = this.bpc;
      if (bpc == 8)
        return buffer;

      var width = this.width;
      var height = this.height;
      var numComps = this.numComps;

      var length = width * height;
      var bufferPos = 0;
      var output = bpc <= 8 ? new Uint8Array(length) :
        bpc <= 16 ? new Uint16Array(length) : new Uint32Array(length);
      var rowComps = width * numComps;

      if (bpc == 1) {
        var valueZero = 0, valueOne = 1;
        if (decodeMap) {
          valueZero = decodeMap[0] ? 1 : 0;
          valueOne = decodeMap[1] ? 1 : 0;
        }
        var mask = 0;
        var buf = 0;

        for (var i = 0, ii = length; i < ii; ++i) {
          if (i % rowComps == 0) {
            mask = 0;
            buf = 0;
          } else {
            mask >>= 1;
          }

          if (mask <= 0) {
            buf = buffer[bufferPos++];
            mask = 128;
          }

          output[i] = !(buf & mask) ? valueZero : valueOne;
        }
      } else {
        if (decodeMap != null)
          TODO('interpolate component values');
        var bits = 0, buf = 0;
        for (var i = 0, ii = length; i < ii; ++i) {
          if (i % rowComps == 0) {
            buf = 0;
            bits = 0;
          }

          while (bits < bpc) {
            buf = (buf << 8) | buffer[bufferPos++];
            bits += 8;
          }

          var remainingBits = bits - bpc;
          output[i] = buf >> remainingBits;
          buf = buf & ((1 << remainingBits) - 1);
          bits = remainingBits;
        }
      }
      return output;
    },
    getOpacity: function getOpacity() {
      var smask = this.smask;
      var width = this.width;
      var height = this.height;
      var buf = new Uint8Array(width * height);

      if (smask) {
        var sw = smask.width;
        var sh = smask.height;
        if (sw != this.width || sh != this.height)
          error('smask dimensions do not match image dimensions: ' + sw +
                ' != ' + this.width + ', ' + sh + ' != ' + this.height);

        smask.fillGrayBuffer(buf);
        return buf;
      } else {
        for (var i = 0, ii = width * height; i < ii; ++i)
          buf[i] = 255;
      }
      return buf;
    },
    applyStencilMask: function applyStencilMask(buffer, inverseDecode) {
      var width = this.width, height = this.height;
      var bitStrideLength = (width + 7) >> 3;
      var imgArray = this.image.getBytes(bitStrideLength * height);
      var imgArrayPos = 0;
      var i, j, mask, buf;
      // removing making non-masked pixels transparent
      var bufferPos = 3; // alpha component offset
      for (i = 0; i < height; i++) {
        mask = 0;
        for (j = 0; j < width; j++) {
          if (!mask) {
            buf = imgArray[imgArrayPos++];
            mask = 128;
          }
          if (!(buf & mask) == inverseDecode) {
            buffer[bufferPos] = 0;
          }
          bufferPos += 4;
          mask >>= 1;
        }
      }
    },
    fillRgbaBuffer: function fillRgbaBuffer(buffer, decodeMap) {
      var numComps = this.numComps;
      var width = this.width;
      var height = this.height;
      var bpc = this.bpc;

      // rows start at byte boundary;
      var rowBytes = (width * numComps * bpc + 7) >> 3;
      var imgArray = this.image.getBytes(height * rowBytes);

      var comps = this.colorSpace.getRgbBuffer(
        this.getComponents(imgArray, decodeMap), bpc);
      var compsPos = 0;
      var opacity = this.getOpacity();
      var opacityPos = 0;
      var length = width * height * 4;

      for (var i = 0; i < length; i += 4) {
        buffer[i] = comps[compsPos++];
        buffer[i + 1] = comps[compsPos++];
        buffer[i + 2] = comps[compsPos++];
        buffer[i + 3] = opacity[opacityPos++];
      }
    },
    fillGrayBuffer: function fillGrayBuffer(buffer) {
      var numComps = this.numComps;
      if (numComps != 1)
        error('Reading gray scale from a color image: ' + numComps);

      var width = this.width;
      var height = this.height;
      var bpc = this.bpc;

      // rows start at byte boundary;
      var rowBytes = (width * numComps * bpc + 7) >> 3;
      var imgArray = this.image.getBytes(height * rowBytes);

      var comps = this.getComponents(imgArray);
      var length = width * height;

      for (var i = 0; i < length; ++i)
        buffer[i] = comps[i];
    }
  };
  return constructor;
})();

var PDFFunction = (function pdfFunction() {
  function constructor(xref, fn) {
    var dict = fn.dict;
    if (!dict)
      dict = fn;

    var types = [this.constructSampled,
                 null,
                 this.constructInterpolated,
                 this.constructStiched,
                 this.constructPostScript];

    var typeNum = dict.get('FunctionType');
    var typeFn = types[typeNum];
    if (!typeFn)
      error('Unknown type of function');

    typeFn.call(this, fn, dict, xref);
  }

  constructor.prototype = {
    constructSampled: function pdfFunctionConstructSampled(str, dict) {
      var domain = dict.get('Domain');
      var range = dict.get('Range');

      if (!domain || !range)
        error('No domain or range');

      var inputSize = domain.length / 2;
      var outputSize = range.length / 2;

      if (inputSize != 1)
        error('No support for multi-variable inputs to functions: ' +
              inputSize);

      var size = dict.get('Size');
      var bps = dict.get('BitsPerSample');
      var order = dict.get('Order');
      if (!order)
        order = 1;
      if (order !== 1)
        error('No support for cubic spline interpolation: ' + order);

      var encode = dict.get('Encode');
      if (!encode) {
        encode = [];
        for (var i = 0; i < inputSize; ++i) {
          encode.push(0);
          encode.push(size[i] - 1);
        }
      }
      var decode = dict.get('Decode');
      if (!decode)
        decode = range;

      var samples = this.getSampleArray(size, outputSize, bps, str);

      this.func = function pdfFunctionFunc(args) {
        var clip = function pdfFunctionClip(v, min, max) {
          if (v > max)
            v = max;
          else if (v < min)
            v = min;
          return v;
        };

        if (inputSize != args.length)
          error('Incorrect number of arguments: ' + inputSize + ' != ' +
                args.length);

        for (var i = 0; i < inputSize; i++) {
          var i2 = i * 2;

          // clip to the domain
          var v = clip(args[i], domain[i2], domain[i2 + 1]);

          // encode
          v = encode[i2] + ((v - domain[i2]) *
                            (encode[i2 + 1] - encode[i2]) /
                            (domain[i2 + 1] - domain[i2]));

          // clip to the size
          args[i] = clip(v, 0, size[i] - 1);
        }

        // interpolate to table
        TODO('Multi-dimensional interpolation');
        var floor = Math.floor(args[0]);
        var ceil = Math.ceil(args[0]);
        var scale = args[0] - floor;

        floor *= outputSize;
        ceil *= outputSize;

        var output = [], v = 0;
        for (var i = 0; i < outputSize; ++i) {
          if (ceil == floor) {
            v = samples[ceil + i];
          } else {
            var low = samples[floor + i];
            var high = samples[ceil + i];
            v = low * scale + high * (1 - scale);
          }

          var i2 = i * 2;
          // decode
          v = decode[i2] + (v * (decode[i2 + 1] - decode[i2]) /
                            ((1 << bps) - 1));

          // clip to the domain
          output.push(clip(v, range[i2], range[i2 + 1]));
        }

        return output;
      };
    },
    getSampleArray: function pdfFunctionGetSampleArray(size, outputSize, bps,
                                                       str) {
      var length = 1;
      for (var i = 0; i < size.length; i++)
        length *= size[i];
      length *= outputSize;

      var array = [];
      var codeSize = 0;
      var codeBuf = 0;

      var strBytes = str.getBytes((length * bps + 7) / 8);
      var strIdx = 0;
      for (var i = 0; i < length; i++) {
        var b;
        while (codeSize < bps) {
          codeBuf <<= 8;
          codeBuf |= strBytes[strIdx++];
          codeSize += 8;
        }
        codeSize -= bps;
        array.push(codeBuf >> codeSize);
        codeBuf &= (1 << codeSize) - 1;
      }
      return array;
    },
    constructInterpolated: function pdfFunctionConstructInterpolated(str,
                                                                     dict) {
      var c0 = dict.get('C0') || [0];
      var c1 = dict.get('C1') || [1];
      var n = dict.get('N');

      if (!IsArray(c0) || !IsArray(c1))
        error('Illegal dictionary for interpolated function');

      var length = c0.length;
      var diff = [];
      for (var i = 0; i < length; ++i)
        diff.push(c1[i] - c0[i]);

      this.func = function pdfFunctionConstructInterpolatedFunc(args) {
        var x = args[0];

        var out = [];
        for (var j = 0; j < length; ++j)
          out.push(c0[j] + (x^n * diff[i]));

        return out;
      };
    },
    constructStiched: function pdfFunctionConstructStiched(fn, dict, xref) {
      var domain = dict.get('Domain');
      var range = dict.get('Range');

      if (!domain)
        error('No domain');

      var inputSize = domain.length / 2;
      if (inputSize != 1)
        error('Bad domain for stiched function');

      var fnRefs = dict.get('Functions');
      var fns = [];
      for (var i = 0, ii = fnRefs.length; i < ii; ++i)
        fns.push(new PDFFunction(xref, xref.fetchIfRef(fnRefs[i])));

      var bounds = dict.get('Bounds');
      var encode = dict.get('Encode');

      this.func = function pdfFunctionConstructStichedFunc(args) {
        var clip = function pdfFunctionConstructStichedFuncClip(v, min, max) {
          if (v > max)
            v = max;
          else if (v < min)
            v = min;
          return v;
        };

        // clip to domain
        var v = clip(args[0], domain[0], domain[1]);
        // calulate which bound the value is in
        for (var i = 0, ii = bounds.length; i < ii; ++i) {
          if (v < bounds[i])
            break;
        }

        // encode value into domain of function
        var dmin = domain[0];
        if (i > 0)
          dmin = bounds[i - 1];
        var dmax = domain[1];
        if (i < bounds.length)
          dmax = bounds[i];

        var rmin = encode[2 * i];
        var rmax = encode[2 * i + 1];

        var v2 = rmin + (v - dmin) * (rmax - rmin) / (dmax - dmin);

        // call the appropropriate function
        return fns[i].func([v2]);
      };
    },
    constructPostScript: function pdfFunctionConstructPostScript() {
      TODO('unhandled type of function');
      this.func = function pdfFunctionConstructPostScriptFunc() {
        return [255, 105, 180];
      };
    }
  };

  return constructor;
})();
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

var Metrics = {
  'Courier': 600,
  'Courier-Bold': 600,
  'Courier-BoldOblique': 600,
  'Courier-Oblique': 600,
  'Helvetica' : {
    'space': 278,
    'exclam': 278,
    'quotedbl': 355,
    'numbersign': 556,
    'dollar': 556,
    'percent': 889,
    'ampersand': 667,
    'quoteright': 222,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 389,
    'plus': 584,
    'comma': 278,
    'hyphen': 333,
    'period': 278,
    'slash': 278,
    'zero': 556,
    'one': 556,
    'two': 556,
    'three': 556,
    'four': 556,
    'five': 556,
    'six': 556,
    'seven': 556,
    'eight': 556,
    'nine': 556,
    'colon': 278,
    'semicolon': 278,
    'less': 584,
    'equal': 584,
    'greater': 584,
    'question': 556,
    'at': 1015,
    'A': 667,
    'B': 667,
    'C': 722,
    'D': 722,
    'E': 667,
    'F': 611,
    'G': 778,
    'H': 722,
    'I': 278,
    'J': 500,
    'K': 667,
    'L': 556,
    'M': 833,
    'N': 722,
    'O': 778,
    'P': 667,
    'Q': 778,
    'R': 722,
    'S': 667,
    'T': 611,
    'U': 722,
    'V': 667,
    'W': 944,
    'X': 667,
    'Y': 667,
    'Z': 611,
    'bracketleft': 278,
    'backslash': 278,
    'bracketright': 278,
    'asciicircum': 469,
    'underscore': 556,
    'quoteleft': 222,
    'a': 556,
    'b': 556,
    'c': 500,
    'd': 556,
    'e': 556,
    'f': 278,
    'g': 556,
    'h': 556,
    'i': 222,
    'j': 222,
    'k': 500,
    'l': 222,
    'm': 833,
    'n': 556,
    'o': 556,
    'p': 556,
    'q': 556,
    'r': 333,
    's': 500,
    't': 278,
    'u': 556,
    'v': 500,
    'w': 722,
    'x': 500,
    'y': 500,
    'z': 500,
    'braceleft': 334,
    'bar': 260,
    'braceright': 334,
    'asciitilde': 584,
    'exclamdown': 333,
    'cent': 556,
    'sterling': 556,
    'fraction': 167,
    'yen': 556,
    'florin': 556,
    'section': 556,
    'currency': 556,
    'quotesingle': 191,
    'quotedblleft': 333,
    'guillemotleft': 556,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 500,
    'fl': 500,
    'endash': 556,
    'dagger': 556,
    'daggerdbl': 556,
    'periodcentered': 278,
    'paragraph': 537,
    'bullet': 350,
    'quotesinglbase': 222,
    'quotedblbase': 333,
    'quotedblright': 333,
    'guillemotright': 556,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 611,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 1000,
    'ordfeminine': 370,
    'Lslash': 556,
    'Oslash': 778,
    'OE': 1000,
    'ordmasculine': 365,
    'ae': 889,
    'dotlessi': 278,
    'lslash': 222,
    'oslash': 611,
    'oe': 944,
    'germandbls': 611,
    'Idieresis': 278,
    'eacute': 556,
    'abreve': 556,
    'uhungarumlaut': 556,
    'ecaron': 556,
    'Ydieresis': 667,
    'divide': 584,
    'Yacute': 667,
    'Acircumflex': 667,
    'aacute': 556,
    'Ucircumflex': 722,
    'yacute': 500,
    'scommaaccent': 500,
    'ecircumflex': 556,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 556,
    'Uacute': 722,
    'uogonek': 556,
    'Edieresis': 667,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 737,
    'Emacron': 667,
    'ccaron': 500,
    'aring': 556,
    'Ncommaaccent': 722,
    'lacute': 222,
    'agrave': 556,
    'Tcommaaccent': 611,
    'Cacute': 722,
    'atilde': 556,
    'Edotaccent': 667,
    'scaron': 500,
    'scedilla': 500,
    'iacute': 278,
    'lozenge': 471,
    'Rcaron': 722,
    'Gcommaaccent': 778,
    'ucircumflex': 556,
    'acircumflex': 556,
    'Amacron': 667,
    'rcaron': 333,
    'ccedilla': 500,
    'Zdotaccent': 611,
    'Thorn': 667,
    'Omacron': 778,
    'Racute': 722,
    'Sacute': 667,
    'dcaron': 643,
    'Umacron': 722,
    'uring': 556,
    'threesuperior': 333,
    'Ograve': 778,
    'Agrave': 667,
    'Abreve': 667,
    'multiply': 584,
    'uacute': 556,
    'Tcaron': 611,
    'partialdiff': 476,
    'ydieresis': 500,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 667,
    'adieresis': 556,
    'edieresis': 556,
    'cacute': 500,
    'nacute': 556,
    'umacron': 556,
    'Ncaron': 722,
    'Iacute': 278,
    'plusminus': 584,
    'brokenbar': 260,
    'registered': 737,
    'Gbreve': 778,
    'Idotaccent': 278,
    'summation': 600,
    'Egrave': 667,
    'racute': 333,
    'omacron': 556,
    'Zacute': 611,
    'Zcaron': 611,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 722,
    'lcommaaccent': 222,
    'tcaron': 317,
    'eogonek': 556,
    'Uogonek': 722,
    'Aacute': 667,
    'Adieresis': 667,
    'egrave': 556,
    'zacute': 500,
    'iogonek': 222,
    'Oacute': 778,
    'oacute': 556,
    'amacron': 556,
    'sacute': 500,
    'idieresis': 278,
    'Ocircumflex': 778,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 556,
    'twosuperior': 333,
    'Odieresis': 778,
    'mu': 556,
    'igrave': 278,
    'ohungarumlaut': 556,
    'Eogonek': 667,
    'dcroat': 556,
    'threequarters': 834,
    'Scedilla': 667,
    'lcaron': 299,
    'Kcommaaccent': 667,
    'Lacute': 556,
    'trademark': 1000,
    'edotaccent': 556,
    'Igrave': 278,
    'Imacron': 278,
    'Lcaron': 556,
    'onehalf': 834,
    'lessequal': 549,
    'ocircumflex': 556,
    'ntilde': 556,
    'Uhungarumlaut': 722,
    'Eacute': 667,
    'emacron': 556,
    'gbreve': 556,
    'onequarter': 834,
    'Scaron': 667,
    'Scommaaccent': 667,
    'Ohungarumlaut': 778,
    'degree': 400,
    'ograve': 556,
    'Ccaron': 722,
    'ugrave': 556,
    'radical': 453,
    'Dcaron': 722,
    'rcommaaccent': 333,
    'Ntilde': 722,
    'otilde': 556,
    'Rcommaaccent': 722,
    'Lcommaaccent': 556,
    'Atilde': 667,
    'Aogonek': 667,
    'Aring': 667,
    'Otilde': 778,
    'zdotaccent': 500,
    'Ecaron': 667,
    'Iogonek': 278,
    'kcommaaccent': 500,
    'minus': 584,
    'Icircumflex': 278,
    'ncaron': 556,
    'tcommaaccent': 278,
    'logicalnot': 584,
    'odieresis': 556,
    'udieresis': 556,
    'notequal': 549,
    'gcommaaccent': 556,
    'eth': 556,
    'zcaron': 500,
    'ncommaaccent': 556,
    'onesuperior': 333,
    'imacron': 278,
    'Euro': 556
  },
  'Helvetica-Bold': {
    'space': 278,
    'exclam': 333,
    'quotedbl': 474,
    'numbersign': 556,
    'dollar': 556,
    'percent': 889,
    'ampersand': 722,
    'quoteright': 278,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 389,
    'plus': 584,
    'comma': 278,
    'hyphen': 333,
    'period': 278,
    'slash': 278,
    'zero': 556,
    'one': 556,
    'two': 556,
    'three': 556,
    'four': 556,
    'five': 556,
    'six': 556,
    'seven': 556,
    'eight': 556,
    'nine': 556,
    'colon': 333,
    'semicolon': 333,
    'less': 584,
    'equal': 584,
    'greater': 584,
    'question': 611,
    'at': 975,
    'A': 722,
    'B': 722,
    'C': 722,
    'D': 722,
    'E': 667,
    'F': 611,
    'G': 778,
    'H': 722,
    'I': 278,
    'J': 556,
    'K': 722,
    'L': 611,
    'M': 833,
    'N': 722,
    'O': 778,
    'P': 667,
    'Q': 778,
    'R': 722,
    'S': 667,
    'T': 611,
    'U': 722,
    'V': 667,
    'W': 944,
    'X': 667,
    'Y': 667,
    'Z': 611,
    'bracketleft': 333,
    'backslash': 278,
    'bracketright': 333,
    'asciicircum': 584,
    'underscore': 556,
    'quoteleft': 278,
    'a': 556,
    'b': 611,
    'c': 556,
    'd': 611,
    'e': 556,
    'f': 333,
    'g': 611,
    'h': 611,
    'i': 278,
    'j': 278,
    'k': 556,
    'l': 278,
    'm': 889,
    'n': 611,
    'o': 611,
    'p': 611,
    'q': 611,
    'r': 389,
    's': 556,
    't': 333,
    'u': 611,
    'v': 556,
    'w': 778,
    'x': 556,
    'y': 556,
    'z': 500,
    'braceleft': 389,
    'bar': 280,
    'braceright': 389,
    'asciitilde': 584,
    'exclamdown': 333,
    'cent': 556,
    'sterling': 556,
    'fraction': 167,
    'yen': 556,
    'florin': 556,
    'section': 556,
    'currency': 556,
    'quotesingle': 238,
    'quotedblleft': 500,
    'guillemotleft': 556,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 611,
    'fl': 611,
    'endash': 556,
    'dagger': 556,
    'daggerdbl': 556,
    'periodcentered': 278,
    'paragraph': 556,
    'bullet': 350,
    'quotesinglbase': 278,
    'quotedblbase': 500,
    'quotedblright': 500,
    'guillemotright': 556,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 611,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 1000,
    'ordfeminine': 370,
    'Lslash': 611,
    'Oslash': 778,
    'OE': 1000,
    'ordmasculine': 365,
    'ae': 889,
    'dotlessi': 278,
    'lslash': 278,
    'oslash': 611,
    'oe': 944,
    'germandbls': 611,
    'Idieresis': 278,
    'eacute': 556,
    'abreve': 556,
    'uhungarumlaut': 611,
    'ecaron': 556,
    'Ydieresis': 667,
    'divide': 584,
    'Yacute': 667,
    'Acircumflex': 722,
    'aacute': 556,
    'Ucircumflex': 722,
    'yacute': 556,
    'scommaaccent': 556,
    'ecircumflex': 556,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 556,
    'Uacute': 722,
    'uogonek': 611,
    'Edieresis': 667,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 737,
    'Emacron': 667,
    'ccaron': 556,
    'aring': 556,
    'Ncommaaccent': 722,
    'lacute': 278,
    'agrave': 556,
    'Tcommaaccent': 611,
    'Cacute': 722,
    'atilde': 556,
    'Edotaccent': 667,
    'scaron': 556,
    'scedilla': 556,
    'iacute': 278,
    'lozenge': 494,
    'Rcaron': 722,
    'Gcommaaccent': 778,
    'ucircumflex': 611,
    'acircumflex': 556,
    'Amacron': 722,
    'rcaron': 389,
    'ccedilla': 556,
    'Zdotaccent': 611,
    'Thorn': 667,
    'Omacron': 778,
    'Racute': 722,
    'Sacute': 667,
    'dcaron': 743,
    'Umacron': 722,
    'uring': 611,
    'threesuperior': 333,
    'Ograve': 778,
    'Agrave': 722,
    'Abreve': 722,
    'multiply': 584,
    'uacute': 611,
    'Tcaron': 611,
    'partialdiff': 494,
    'ydieresis': 556,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 667,
    'adieresis': 556,
    'edieresis': 556,
    'cacute': 556,
    'nacute': 611,
    'umacron': 611,
    'Ncaron': 722,
    'Iacute': 278,
    'plusminus': 584,
    'brokenbar': 280,
    'registered': 737,
    'Gbreve': 778,
    'Idotaccent': 278,
    'summation': 600,
    'Egrave': 667,
    'racute': 389,
    'omacron': 611,
    'Zacute': 611,
    'Zcaron': 611,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 722,
    'lcommaaccent': 278,
    'tcaron': 389,
    'eogonek': 556,
    'Uogonek': 722,
    'Aacute': 722,
    'Adieresis': 722,
    'egrave': 556,
    'zacute': 500,
    'iogonek': 278,
    'Oacute': 778,
    'oacute': 611,
    'amacron': 556,
    'sacute': 556,
    'idieresis': 278,
    'Ocircumflex': 778,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 611,
    'twosuperior': 333,
    'Odieresis': 778,
    'mu': 611,
    'igrave': 278,
    'ohungarumlaut': 611,
    'Eogonek': 667,
    'dcroat': 611,
    'threequarters': 834,
    'Scedilla': 667,
    'lcaron': 400,
    'Kcommaaccent': 722,
    'Lacute': 611,
    'trademark': 1000,
    'edotaccent': 556,
    'Igrave': 278,
    'Imacron': 278,
    'Lcaron': 611,
    'onehalf': 834,
    'lessequal': 549,
    'ocircumflex': 611,
    'ntilde': 611,
    'Uhungarumlaut': 722,
    'Eacute': 667,
    'emacron': 556,
    'gbreve': 611,
    'onequarter': 834,
    'Scaron': 667,
    'Scommaaccent': 667,
    'Ohungarumlaut': 778,
    'degree': 400,
    'ograve': 611,
    'Ccaron': 722,
    'ugrave': 611,
    'radical': 549,
    'Dcaron': 722,
    'rcommaaccent': 389,
    'Ntilde': 722,
    'otilde': 611,
    'Rcommaaccent': 722,
    'Lcommaaccent': 611,
    'Atilde': 722,
    'Aogonek': 722,
    'Aring': 722,
    'Otilde': 778,
    'zdotaccent': 500,
    'Ecaron': 667,
    'Iogonek': 278,
    'kcommaaccent': 556,
    'minus': 584,
    'Icircumflex': 278,
    'ncaron': 611,
    'tcommaaccent': 333,
    'logicalnot': 584,
    'odieresis': 611,
    'udieresis': 611,
    'notequal': 549,
    'gcommaaccent': 611,
    'eth': 611,
    'zcaron': 500,
    'ncommaaccent': 611,
    'onesuperior': 333,
    'imacron': 278,
    'Euro': 556
  },
  'Helvetica-BoldOblique': {
    'space': 278,
    'exclam': 333,
    'quotedbl': 474,
    'numbersign': 556,
    'dollar': 556,
    'percent': 889,
    'ampersand': 722,
    'quoteright': 278,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 389,
    'plus': 584,
    'comma': 278,
    'hyphen': 333,
    'period': 278,
    'slash': 278,
    'zero': 556,
    'one': 556,
    'two': 556,
    'three': 556,
    'four': 556,
    'five': 556,
    'six': 556,
    'seven': 556,
    'eight': 556,
    'nine': 556,
    'colon': 333,
    'semicolon': 333,
    'less': 584,
    'equal': 584,
    'greater': 584,
    'question': 611,
    'at': 975,
    'A': 722,
    'B': 722,
    'C': 722,
    'D': 722,
    'E': 667,
    'F': 611,
    'G': 778,
    'H': 722,
    'I': 278,
    'J': 556,
    'K': 722,
    'L': 611,
    'M': 833,
    'N': 722,
    'O': 778,
    'P': 667,
    'Q': 778,
    'R': 722,
    'S': 667,
    'T': 611,
    'U': 722,
    'V': 667,
    'W': 944,
    'X': 667,
    'Y': 667,
    'Z': 611,
    'bracketleft': 333,
    'backslash': 278,
    'bracketright': 333,
    'asciicircum': 584,
    'underscore': 556,
    'quoteleft': 278,
    'a': 556,
    'b': 611,
    'c': 556,
    'd': 611,
    'e': 556,
    'f': 333,
    'g': 611,
    'h': 611,
    'i': 278,
    'j': 278,
    'k': 556,
    'l': 278,
    'm': 889,
    'n': 611,
    'o': 611,
    'p': 611,
    'q': 611,
    'r': 389,
    's': 556,
    't': 333,
    'u': 611,
    'v': 556,
    'w': 778,
    'x': 556,
    'y': 556,
    'z': 500,
    'braceleft': 389,
    'bar': 280,
    'braceright': 389,
    'asciitilde': 584,
    'exclamdown': 333,
    'cent': 556,
    'sterling': 556,
    'fraction': 167,
    'yen': 556,
    'florin': 556,
    'section': 556,
    'currency': 556,
    'quotesingle': 238,
    'quotedblleft': 500,
    'guillemotleft': 556,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 611,
    'fl': 611,
    'endash': 556,
    'dagger': 556,
    'daggerdbl': 556,
    'periodcentered': 278,
    'paragraph': 556,
    'bullet': 350,
    'quotesinglbase': 278,
    'quotedblbase': 500,
    'quotedblright': 500,
    'guillemotright': 556,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 611,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 1000,
    'ordfeminine': 370,
    'Lslash': 611,
    'Oslash': 778,
    'OE': 1000,
    'ordmasculine': 365,
    'ae': 889,
    'dotlessi': 278,
    'lslash': 278,
    'oslash': 611,
    'oe': 944,
    'germandbls': 611,
    'Idieresis': 278,
    'eacute': 556,
    'abreve': 556,
    'uhungarumlaut': 611,
    'ecaron': 556,
    'Ydieresis': 667,
    'divide': 584,
    'Yacute': 667,
    'Acircumflex': 722,
    'aacute': 556,
    'Ucircumflex': 722,
    'yacute': 556,
    'scommaaccent': 556,
    'ecircumflex': 556,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 556,
    'Uacute': 722,
    'uogonek': 611,
    'Edieresis': 667,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 737,
    'Emacron': 667,
    'ccaron': 556,
    'aring': 556,
    'Ncommaaccent': 722,
    'lacute': 278,
    'agrave': 556,
    'Tcommaaccent': 611,
    'Cacute': 722,
    'atilde': 556,
    'Edotaccent': 667,
    'scaron': 556,
    'scedilla': 556,
    'iacute': 278,
    'lozenge': 494,
    'Rcaron': 722,
    'Gcommaaccent': 778,
    'ucircumflex': 611,
    'acircumflex': 556,
    'Amacron': 722,
    'rcaron': 389,
    'ccedilla': 556,
    'Zdotaccent': 611,
    'Thorn': 667,
    'Omacron': 778,
    'Racute': 722,
    'Sacute': 667,
    'dcaron': 743,
    'Umacron': 722,
    'uring': 611,
    'threesuperior': 333,
    'Ograve': 778,
    'Agrave': 722,
    'Abreve': 722,
    'multiply': 584,
    'uacute': 611,
    'Tcaron': 611,
    'partialdiff': 494,
    'ydieresis': 556,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 667,
    'adieresis': 556,
    'edieresis': 556,
    'cacute': 556,
    'nacute': 611,
    'umacron': 611,
    'Ncaron': 722,
    'Iacute': 278,
    'plusminus': 584,
    'brokenbar': 280,
    'registered': 737,
    'Gbreve': 778,
    'Idotaccent': 278,
    'summation': 600,
    'Egrave': 667,
    'racute': 389,
    'omacron': 611,
    'Zacute': 611,
    'Zcaron': 611,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 722,
    'lcommaaccent': 278,
    'tcaron': 389,
    'eogonek': 556,
    'Uogonek': 722,
    'Aacute': 722,
    'Adieresis': 722,
    'egrave': 556,
    'zacute': 500,
    'iogonek': 278,
    'Oacute': 778,
    'oacute': 611,
    'amacron': 556,
    'sacute': 556,
    'idieresis': 278,
    'Ocircumflex': 778,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 611,
    'twosuperior': 333,
    'Odieresis': 778,
    'mu': 611,
    'igrave': 278,
    'ohungarumlaut': 611,
    'Eogonek': 667,
    'dcroat': 611,
    'threequarters': 834,
    'Scedilla': 667,
    'lcaron': 400,
    'Kcommaaccent': 722,
    'Lacute': 611,
    'trademark': 1000,
    'edotaccent': 556,
    'Igrave': 278,
    'Imacron': 278,
    'Lcaron': 611,
    'onehalf': 834,
    'lessequal': 549,
    'ocircumflex': 611,
    'ntilde': 611,
    'Uhungarumlaut': 722,
    'Eacute': 667,
    'emacron': 556,
    'gbreve': 611,
    'onequarter': 834,
    'Scaron': 667,
    'Scommaaccent': 667,
    'Ohungarumlaut': 778,
    'degree': 400,
    'ograve': 611,
    'Ccaron': 722,
    'ugrave': 611,
    'radical': 549,
    'Dcaron': 722,
    'rcommaaccent': 389,
    'Ntilde': 722,
    'otilde': 611,
    'Rcommaaccent': 722,
    'Lcommaaccent': 611,
    'Atilde': 722,
    'Aogonek': 722,
    'Aring': 722,
    'Otilde': 778,
    'zdotaccent': 500,
    'Ecaron': 667,
    'Iogonek': 278,
    'kcommaaccent': 556,
    'minus': 584,
    'Icircumflex': 278,
    'ncaron': 611,
    'tcommaaccent': 333,
    'logicalnot': 584,
    'odieresis': 611,
    'udieresis': 611,
    'notequal': 549,
    'gcommaaccent': 611,
    'eth': 611,
    'zcaron': 500,
    'ncommaaccent': 611,
    'onesuperior': 333,
    'imacron': 278,
    'Euro': 556
  },
  'Helvetica-Oblique' : {
    'space': 278,
    'exclam': 278,
    'quotedbl': 355,
    'numbersign': 556,
    'dollar': 556,
    'percent': 889,
    'ampersand': 667,
    'quoteright': 222,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 389,
    'plus': 584,
    'comma': 278,
    'hyphen': 333,
    'period': 278,
    'slash': 278,
    'zero': 556,
    'one': 556,
    'two': 556,
    'three': 556,
    'four': 556,
    'five': 556,
    'six': 556,
    'seven': 556,
    'eight': 556,
    'nine': 556,
    'colon': 278,
    'semicolon': 278,
    'less': 584,
    'equal': 584,
    'greater': 584,
    'question': 556,
    'at': 1015,
    'A': 667,
    'B': 667,
    'C': 722,
    'D': 722,
    'E': 667,
    'F': 611,
    'G': 778,
    'H': 722,
    'I': 278,
    'J': 500,
    'K': 667,
    'L': 556,
    'M': 833,
    'N': 722,
    'O': 778,
    'P': 667,
    'Q': 778,
    'R': 722,
    'S': 667,
    'T': 611,
    'U': 722,
    'V': 667,
    'W': 944,
    'X': 667,
    'Y': 667,
    'Z': 611,
    'bracketleft': 278,
    'backslash': 278,
    'bracketright': 278,
    'asciicircum': 469,
    'underscore': 556,
    'quoteleft': 222,
    'a': 556,
    'b': 556,
    'c': 500,
    'd': 556,
    'e': 556,
    'f': 278,
    'g': 556,
    'h': 556,
    'i': 222,
    'j': 222,
    'k': 500,
    'l': 222,
    'm': 833,
    'n': 556,
    'o': 556,
    'p': 556,
    'q': 556,
    'r': 333,
    's': 500,
    't': 278,
    'u': 556,
    'v': 500,
    'w': 722,
    'x': 500,
    'y': 500,
    'z': 500,
    'braceleft': 334,
    'bar': 260,
    'braceright': 334,
    'asciitilde': 584,
    'exclamdown': 333,
    'cent': 556,
    'sterling': 556,
    'fraction': 167,
    'yen': 556,
    'florin': 556,
    'section': 556,
    'currency': 556,
    'quotesingle': 191,
    'quotedblleft': 333,
    'guillemotleft': 556,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 500,
    'fl': 500,
    'endash': 556,
    'dagger': 556,
    'daggerdbl': 556,
    'periodcentered': 278,
    'paragraph': 537,
    'bullet': 350,
    'quotesinglbase': 222,
    'quotedblbase': 333,
    'quotedblright': 333,
    'guillemotright': 556,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 611,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 1000,
    'ordfeminine': 370,
    'Lslash': 556,
    'Oslash': 778,
    'OE': 1000,
    'ordmasculine': 365,
    'ae': 889,
    'dotlessi': 278,
    'lslash': 222,
    'oslash': 611,
    'oe': 944,
    'germandbls': 611,
    'Idieresis': 278,
    'eacute': 556,
    'abreve': 556,
    'uhungarumlaut': 556,
    'ecaron': 556,
    'Ydieresis': 667,
    'divide': 584,
    'Yacute': 667,
    'Acircumflex': 667,
    'aacute': 556,
    'Ucircumflex': 722,
    'yacute': 500,
    'scommaaccent': 500,
    'ecircumflex': 556,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 556,
    'Uacute': 722,
    'uogonek': 556,
    'Edieresis': 667,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 737,
    'Emacron': 667,
    'ccaron': 500,
    'aring': 556,
    'Ncommaaccent': 722,
    'lacute': 222,
    'agrave': 556,
    'Tcommaaccent': 611,
    'Cacute': 722,
    'atilde': 556,
    'Edotaccent': 667,
    'scaron': 500,
    'scedilla': 500,
    'iacute': 278,
    'lozenge': 471,
    'Rcaron': 722,
    'Gcommaaccent': 778,
    'ucircumflex': 556,
    'acircumflex': 556,
    'Amacron': 667,
    'rcaron': 333,
    'ccedilla': 500,
    'Zdotaccent': 611,
    'Thorn': 667,
    'Omacron': 778,
    'Racute': 722,
    'Sacute': 667,
    'dcaron': 643,
    'Umacron': 722,
    'uring': 556,
    'threesuperior': 333,
    'Ograve': 778,
    'Agrave': 667,
    'Abreve': 667,
    'multiply': 584,
    'uacute': 556,
    'Tcaron': 611,
    'partialdiff': 476,
    'ydieresis': 500,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 667,
    'adieresis': 556,
    'edieresis': 556,
    'cacute': 500,
    'nacute': 556,
    'umacron': 556,
    'Ncaron': 722,
    'Iacute': 278,
    'plusminus': 584,
    'brokenbar': 260,
    'registered': 737,
    'Gbreve': 778,
    'Idotaccent': 278,
    'summation': 600,
    'Egrave': 667,
    'racute': 333,
    'omacron': 556,
    'Zacute': 611,
    'Zcaron': 611,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 722,
    'lcommaaccent': 222,
    'tcaron': 317,
    'eogonek': 556,
    'Uogonek': 722,
    'Aacute': 667,
    'Adieresis': 667,
    'egrave': 556,
    'zacute': 500,
    'iogonek': 222,
    'Oacute': 778,
    'oacute': 556,
    'amacron': 556,
    'sacute': 500,
    'idieresis': 278,
    'Ocircumflex': 778,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 556,
    'twosuperior': 333,
    'Odieresis': 778,
    'mu': 556,
    'igrave': 278,
    'ohungarumlaut': 556,
    'Eogonek': 667,
    'dcroat': 556,
    'threequarters': 834,
    'Scedilla': 667,
    'lcaron': 299,
    'Kcommaaccent': 667,
    'Lacute': 556,
    'trademark': 1000,
    'edotaccent': 556,
    'Igrave': 278,
    'Imacron': 278,
    'Lcaron': 556,
    'onehalf': 834,
    'lessequal': 549,
    'ocircumflex': 556,
    'ntilde': 556,
    'Uhungarumlaut': 722,
    'Eacute': 667,
    'emacron': 556,
    'gbreve': 556,
    'onequarter': 834,
    'Scaron': 667,
    'Scommaaccent': 667,
    'Ohungarumlaut': 778,
    'degree': 400,
    'ograve': 556,
    'Ccaron': 722,
    'ugrave': 556,
    'radical': 453,
    'Dcaron': 722,
    'rcommaaccent': 333,
    'Ntilde': 722,
    'otilde': 556,
    'Rcommaaccent': 722,
    'Lcommaaccent': 556,
    'Atilde': 667,
    'Aogonek': 667,
    'Aring': 667,
    'Otilde': 778,
    'zdotaccent': 500,
    'Ecaron': 667,
    'Iogonek': 278,
    'kcommaaccent': 500,
    'minus': 584,
    'Icircumflex': 278,
    'ncaron': 556,
    'tcommaaccent': 278,
    'logicalnot': 584,
    'odieresis': 556,
    'udieresis': 556,
    'notequal': 549,
    'gcommaaccent': 556,
    'eth': 556,
    'zcaron': 500,
    'ncommaaccent': 556,
    'onesuperior': 333,
    'imacron': 278,
    'Euro': 556
  },
  'Symbol': {
    'space': 250,
    'exclam': 333,
    'universal': 713,
    'numbersign': 500,
    'existential': 549,
    'percent': 833,
    'ampersand': 778,
    'suchthat': 439,
    'parenleft': 333,
    'parenright': 333,
    'asteriskmath': 500,
    'plus': 549,
    'comma': 250,
    'minus': 549,
    'period': 250,
    'slash': 278,
    'zero': 500,
    'one': 500,
    'two': 500,
    'three': 500,
    'four': 500,
    'five': 500,
    'six': 500,
    'seven': 500,
    'eight': 500,
    'nine': 500,
    'colon': 278,
    'semicolon': 278,
    'less': 549,
    'equal': 549,
    'greater': 549,
    'question': 444,
    'congruent': 549,
    'Alpha': 722,
    'Beta': 667,
    'Chi': 722,
    'Delta': 612,
    'Epsilon': 611,
    'Phi': 763,
    'Gamma': 603,
    'Eta': 722,
    'Iota': 333,
    'theta1': 631,
    'Kappa': 722,
    'Lambda': 686,
    'Mu': 889,
    'Nu': 722,
    'Omicron': 722,
    'Pi': 768,
    'Theta': 741,
    'Rho': 556,
    'Sigma': 592,
    'Tau': 611,
    'Upsilon': 690,
    'sigma1': 439,
    'Omega': 768,
    'Xi': 645,
    'Psi': 795,
    'Zeta': 611,
    'bracketleft': 333,
    'therefore': 863,
    'bracketright': 333,
    'perpendicular': 658,
    'underscore': 500,
    'radicalex': 500,
    'alpha': 631,
    'beta': 549,
    'chi': 549,
    'delta': 494,
    'epsilon': 439,
    'phi': 521,
    'gamma': 411,
    'eta': 603,
    'iota': 329,
    'phi1': 603,
    'kappa': 549,
    'lambda': 549,
    'mu': 576,
    'nu': 521,
    'omicron': 549,
    'pi': 549,
    'theta': 521,
    'rho': 549,
    'sigma': 603,
    'tau': 439,
    'upsilon': 576,
    'omega1': 713,
    'omega': 686,
    'xi': 493,
    'psi': 686,
    'zeta': 494,
    'braceleft': 480,
    'bar': 200,
    'braceright': 480,
    'similar': 549,
    'Euro': 750,
    'Upsilon1': 620,
    'minute': 247,
    'lessequal': 549,
    'fraction': 167,
    'infinity': 713,
    'florin': 500,
    'club': 753,
    'diamond': 753,
    'heart': 753,
    'spade': 753,
    'arrowboth': 1042,
    'arrowleft': 987,
    'arrowup': 603,
    'arrowright': 987,
    'arrowdown': 603,
    'degree': 400,
    'plusminus': 549,
    'second': 411,
    'greaterequal': 549,
    'multiply': 549,
    'proportional': 713,
    'partialdiff': 494,
    'bullet': 460,
    'divide': 549,
    'notequal': 549,
    'equivalence': 549,
    'approxequal': 549,
    'ellipsis': 1000,
    'arrowvertex': 603,
    'arrowhorizex': 1000,
    'carriagereturn': 658,
    'aleph': 823,
    'Ifraktur': 686,
    'Rfraktur': 795,
    'weierstrass': 987,
    'circlemultiply': 768,
    'circleplus': 768,
    'emptyset': 823,
    'intersection': 768,
    'union': 768,
    'propersuperset': 713,
    'reflexsuperset': 713,
    'notsubset': 713,
    'propersubset': 713,
    'reflexsubset': 713,
    'element': 713,
    'notelement': 713,
    'angle': 768,
    'gradient': 713,
    'registerserif': 790,
    'copyrightserif': 790,
    'trademarkserif': 890,
    'product': 823,
    'radical': 549,
    'dotmath': 250,
    'logicalnot': 713,
    'logicaland': 603,
    'logicalor': 603,
    'arrowdblboth': 1042,
    'arrowdblleft': 987,
    'arrowdblup': 603,
    'arrowdblright': 987,
    'arrowdbldown': 603,
    'lozenge': 494,
    'angleleft': 329,
    'registersans': 790,
    'copyrightsans': 790,
    'trademarksans': 786,
    'summation': 713,
    'parenlefttp': 384,
    'parenleftex': 384,
    'parenleftbt': 384,
    'bracketlefttp': 384,
    'bracketleftex': 384,
    'bracketleftbt': 384,
    'bracelefttp': 494,
    'braceleftmid': 494,
    'braceleftbt': 494,
    'braceex': 494,
    'angleright': 329,
    'integral': 274,
    'integraltp': 686,
    'integralex': 686,
    'integralbt': 686,
    'parenrighttp': 384,
    'parenrightex': 384,
    'parenrightbt': 384,
    'bracketrighttp': 384,
    'bracketrightex': 384,
    'bracketrightbt': 384,
    'bracerighttp': 494,
    'bracerightmid': 494,
    'bracerightbt': 494,
    'apple': 790
  },
  'Times-Roman': {
    'space': 250,
    'exclam': 333,
    'quotedbl': 408,
    'numbersign': 500,
    'dollar': 500,
    'percent': 833,
    'ampersand': 778,
    'quoteright': 333,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 500,
    'plus': 564,
    'comma': 250,
    'hyphen': 333,
    'period': 250,
    'slash': 278,
    'zero': 500,
    'one': 500,
    'two': 500,
    'three': 500,
    'four': 500,
    'five': 500,
    'six': 500,
    'seven': 500,
    'eight': 500,
    'nine': 500,
    'colon': 278,
    'semicolon': 278,
    'less': 564,
    'equal': 564,
    'greater': 564,
    'question': 444,
    'at': 921,
    'A': 722,
    'B': 667,
    'C': 667,
    'D': 722,
    'E': 611,
    'F': 556,
    'G': 722,
    'H': 722,
    'I': 333,
    'J': 389,
    'K': 722,
    'L': 611,
    'M': 889,
    'N': 722,
    'O': 722,
    'P': 556,
    'Q': 722,
    'R': 667,
    'S': 556,
    'T': 611,
    'U': 722,
    'V': 722,
    'W': 944,
    'X': 722,
    'Y': 722,
    'Z': 611,
    'bracketleft': 333,
    'backslash': 278,
    'bracketright': 333,
    'asciicircum': 469,
    'underscore': 500,
    'quoteleft': 333,
    'a': 444,
    'b': 500,
    'c': 444,
    'd': 500,
    'e': 444,
    'f': 333,
    'g': 500,
    'h': 500,
    'i': 278,
    'j': 278,
    'k': 500,
    'l': 278,
    'm': 778,
    'n': 500,
    'o': 500,
    'p': 500,
    'q': 500,
    'r': 333,
    's': 389,
    't': 278,
    'u': 500,
    'v': 500,
    'w': 722,
    'x': 500,
    'y': 500,
    'z': 444,
    'braceleft': 480,
    'bar': 200,
    'braceright': 480,
    'asciitilde': 541,
    'exclamdown': 333,
    'cent': 500,
    'sterling': 500,
    'fraction': 167,
    'yen': 500,
    'florin': 500,
    'section': 500,
    'currency': 500,
    'quotesingle': 180,
    'quotedblleft': 444,
    'guillemotleft': 500,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 556,
    'fl': 556,
    'endash': 500,
    'dagger': 500,
    'daggerdbl': 500,
    'periodcentered': 250,
    'paragraph': 453,
    'bullet': 350,
    'quotesinglbase': 333,
    'quotedblbase': 444,
    'quotedblright': 444,
    'guillemotright': 500,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 444,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 889,
    'ordfeminine': 276,
    'Lslash': 611,
    'Oslash': 722,
    'OE': 889,
    'ordmasculine': 310,
    'ae': 667,
    'dotlessi': 278,
    'lslash': 278,
    'oslash': 500,
    'oe': 722,
    'germandbls': 500,
    'Idieresis': 333,
    'eacute': 444,
    'abreve': 444,
    'uhungarumlaut': 500,
    'ecaron': 444,
    'Ydieresis': 722,
    'divide': 564,
    'Yacute': 722,
    'Acircumflex': 722,
    'aacute': 444,
    'Ucircumflex': 722,
    'yacute': 500,
    'scommaaccent': 389,
    'ecircumflex': 444,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 444,
    'Uacute': 722,
    'uogonek': 500,
    'Edieresis': 611,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 760,
    'Emacron': 611,
    'ccaron': 444,
    'aring': 444,
    'Ncommaaccent': 722,
    'lacute': 278,
    'agrave': 444,
    'Tcommaaccent': 611,
    'Cacute': 667,
    'atilde': 444,
    'Edotaccent': 611,
    'scaron': 389,
    'scedilla': 389,
    'iacute': 278,
    'lozenge': 471,
    'Rcaron': 667,
    'Gcommaaccent': 722,
    'ucircumflex': 500,
    'acircumflex': 444,
    'Amacron': 722,
    'rcaron': 333,
    'ccedilla': 444,
    'Zdotaccent': 611,
    'Thorn': 556,
    'Omacron': 722,
    'Racute': 667,
    'Sacute': 556,
    'dcaron': 588,
    'Umacron': 722,
    'uring': 500,
    'threesuperior': 300,
    'Ograve': 722,
    'Agrave': 722,
    'Abreve': 722,
    'multiply': 564,
    'uacute': 500,
    'Tcaron': 611,
    'partialdiff': 476,
    'ydieresis': 500,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 611,
    'adieresis': 444,
    'edieresis': 444,
    'cacute': 444,
    'nacute': 500,
    'umacron': 500,
    'Ncaron': 722,
    'Iacute': 333,
    'plusminus': 564,
    'brokenbar': 200,
    'registered': 760,
    'Gbreve': 722,
    'Idotaccent': 333,
    'summation': 600,
    'Egrave': 611,
    'racute': 333,
    'omacron': 500,
    'Zacute': 611,
    'Zcaron': 611,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 667,
    'lcommaaccent': 278,
    'tcaron': 326,
    'eogonek': 444,
    'Uogonek': 722,
    'Aacute': 722,
    'Adieresis': 722,
    'egrave': 444,
    'zacute': 444,
    'iogonek': 278,
    'Oacute': 722,
    'oacute': 500,
    'amacron': 444,
    'sacute': 389,
    'idieresis': 278,
    'Ocircumflex': 722,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 500,
    'twosuperior': 300,
    'Odieresis': 722,
    'mu': 500,
    'igrave': 278,
    'ohungarumlaut': 500,
    'Eogonek': 611,
    'dcroat': 500,
    'threequarters': 750,
    'Scedilla': 556,
    'lcaron': 344,
    'Kcommaaccent': 722,
    'Lacute': 611,
    'trademark': 980,
    'edotaccent': 444,
    'Igrave': 333,
    'Imacron': 333,
    'Lcaron': 611,
    'onehalf': 750,
    'lessequal': 549,
    'ocircumflex': 500,
    'ntilde': 500,
    'Uhungarumlaut': 722,
    'Eacute': 611,
    'emacron': 444,
    'gbreve': 500,
    'onequarter': 750,
    'Scaron': 556,
    'Scommaaccent': 556,
    'Ohungarumlaut': 722,
    'degree': 400,
    'ograve': 500,
    'Ccaron': 667,
    'ugrave': 500,
    'radical': 453,
    'Dcaron': 722,
    'rcommaaccent': 333,
    'Ntilde': 722,
    'otilde': 500,
    'Rcommaaccent': 667,
    'Lcommaaccent': 611,
    'Atilde': 722,
    'Aogonek': 722,
    'Aring': 722,
    'Otilde': 722,
    'zdotaccent': 444,
    'Ecaron': 611,
    'Iogonek': 333,
    'kcommaaccent': 500,
    'minus': 564,
    'Icircumflex': 333,
    'ncaron': 500,
    'tcommaaccent': 278,
    'logicalnot': 564,
    'odieresis': 500,
    'udieresis': 500,
    'notequal': 549,
    'gcommaaccent': 500,
    'eth': 500,
    'zcaron': 444,
    'ncommaaccent': 500,
    'onesuperior': 300,
    'imacron': 278,
    'Euro': 500
  },
  'Times-Bold': {
    'space': 250,
    'exclam': 333,
    'quotedbl': 555,
    'numbersign': 500,
    'dollar': 500,
    'percent': 1000,
    'ampersand': 833,
    'quoteright': 333,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 500,
    'plus': 570,
    'comma': 250,
    'hyphen': 333,
    'period': 250,
    'slash': 278,
    'zero': 500,
    'one': 500,
    'two': 500,
    'three': 500,
    'four': 500,
    'five': 500,
    'six': 500,
    'seven': 500,
    'eight': 500,
    'nine': 500,
    'colon': 333,
    'semicolon': 333,
    'less': 570,
    'equal': 570,
    'greater': 570,
    'question': 500,
    'at': 930,
    'A': 722,
    'B': 667,
    'C': 722,
    'D': 722,
    'E': 667,
    'F': 611,
    'G': 778,
    'H': 778,
    'I': 389,
    'J': 500,
    'K': 778,
    'L': 667,
    'M': 944,
    'N': 722,
    'O': 778,
    'P': 611,
    'Q': 778,
    'R': 722,
    'S': 556,
    'T': 667,
    'U': 722,
    'V': 722,
    'W': 1000,
    'X': 722,
    'Y': 722,
    'Z': 667,
    'bracketleft': 333,
    'backslash': 278,
    'bracketright': 333,
    'asciicircum': 581,
    'underscore': 500,
    'quoteleft': 333,
    'a': 500,
    'b': 556,
    'c': 444,
    'd': 556,
    'e': 444,
    'f': 333,
    'g': 500,
    'h': 556,
    'i': 278,
    'j': 333,
    'k': 556,
    'l': 278,
    'm': 833,
    'n': 556,
    'o': 500,
    'p': 556,
    'q': 556,
    'r': 444,
    's': 389,
    't': 333,
    'u': 556,
    'v': 500,
    'w': 722,
    'x': 500,
    'y': 500,
    'z': 444,
    'braceleft': 394,
    'bar': 220,
    'braceright': 394,
    'asciitilde': 520,
    'exclamdown': 333,
    'cent': 500,
    'sterling': 500,
    'fraction': 167,
    'yen': 500,
    'florin': 500,
    'section': 500,
    'currency': 500,
    'quotesingle': 278,
    'quotedblleft': 500,
    'guillemotleft': 500,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 556,
    'fl': 556,
    'endash': 500,
    'dagger': 500,
    'daggerdbl': 500,
    'periodcentered': 250,
    'paragraph': 540,
    'bullet': 350,
    'quotesinglbase': 333,
    'quotedblbase': 500,
    'quotedblright': 500,
    'guillemotright': 500,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 500,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 1000,
    'ordfeminine': 300,
    'Lslash': 667,
    'Oslash': 778,
    'OE': 1000,
    'ordmasculine': 330,
    'ae': 722,
    'dotlessi': 278,
    'lslash': 278,
    'oslash': 500,
    'oe': 722,
    'germandbls': 556,
    'Idieresis': 389,
    'eacute': 444,
    'abreve': 500,
    'uhungarumlaut': 556,
    'ecaron': 444,
    'Ydieresis': 722,
    'divide': 570,
    'Yacute': 722,
    'Acircumflex': 722,
    'aacute': 500,
    'Ucircumflex': 722,
    'yacute': 500,
    'scommaaccent': 389,
    'ecircumflex': 444,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 500,
    'Uacute': 722,
    'uogonek': 556,
    'Edieresis': 667,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 747,
    'Emacron': 667,
    'ccaron': 444,
    'aring': 500,
    'Ncommaaccent': 722,
    'lacute': 278,
    'agrave': 500,
    'Tcommaaccent': 667,
    'Cacute': 722,
    'atilde': 500,
    'Edotaccent': 667,
    'scaron': 389,
    'scedilla': 389,
    'iacute': 278,
    'lozenge': 494,
    'Rcaron': 722,
    'Gcommaaccent': 778,
    'ucircumflex': 556,
    'acircumflex': 500,
    'Amacron': 722,
    'rcaron': 444,
    'ccedilla': 444,
    'Zdotaccent': 667,
    'Thorn': 611,
    'Omacron': 778,
    'Racute': 722,
    'Sacute': 556,
    'dcaron': 672,
    'Umacron': 722,
    'uring': 556,
    'threesuperior': 300,
    'Ograve': 778,
    'Agrave': 722,
    'Abreve': 722,
    'multiply': 570,
    'uacute': 556,
    'Tcaron': 667,
    'partialdiff': 494,
    'ydieresis': 500,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 667,
    'adieresis': 500,
    'edieresis': 444,
    'cacute': 444,
    'nacute': 556,
    'umacron': 556,
    'Ncaron': 722,
    'Iacute': 389,
    'plusminus': 570,
    'brokenbar': 220,
    'registered': 747,
    'Gbreve': 778,
    'Idotaccent': 389,
    'summation': 600,
    'Egrave': 667,
    'racute': 444,
    'omacron': 500,
    'Zacute': 667,
    'Zcaron': 667,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 722,
    'lcommaaccent': 278,
    'tcaron': 416,
    'eogonek': 444,
    'Uogonek': 722,
    'Aacute': 722,
    'Adieresis': 722,
    'egrave': 444,
    'zacute': 444,
    'iogonek': 278,
    'Oacute': 778,
    'oacute': 500,
    'amacron': 500,
    'sacute': 389,
    'idieresis': 278,
    'Ocircumflex': 778,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 556,
    'twosuperior': 300,
    'Odieresis': 778,
    'mu': 556,
    'igrave': 278,
    'ohungarumlaut': 500,
    'Eogonek': 667,
    'dcroat': 556,
    'threequarters': 750,
    'Scedilla': 556,
    'lcaron': 394,
    'Kcommaaccent': 778,
    'Lacute': 667,
    'trademark': 1000,
    'edotaccent': 444,
    'Igrave': 389,
    'Imacron': 389,
    'Lcaron': 667,
    'onehalf': 750,
    'lessequal': 549,
    'ocircumflex': 500,
    'ntilde': 556,
    'Uhungarumlaut': 722,
    'Eacute': 667,
    'emacron': 444,
    'gbreve': 500,
    'onequarter': 750,
    'Scaron': 556,
    'Scommaaccent': 556,
    'Ohungarumlaut': 778,
    'degree': 400,
    'ograve': 500,
    'Ccaron': 722,
    'ugrave': 556,
    'radical': 549,
    'Dcaron': 722,
    'rcommaaccent': 444,
    'Ntilde': 722,
    'otilde': 500,
    'Rcommaaccent': 722,
    'Lcommaaccent': 667,
    'Atilde': 722,
    'Aogonek': 722,
    'Aring': 722,
    'Otilde': 778,
    'zdotaccent': 444,
    'Ecaron': 667,
    'Iogonek': 389,
    'kcommaaccent': 556,
    'minus': 570,
    'Icircumflex': 389,
    'ncaron': 556,
    'tcommaaccent': 333,
    'logicalnot': 570,
    'odieresis': 500,
    'udieresis': 556,
    'notequal': 549,
    'gcommaaccent': 500,
    'eth': 500,
    'zcaron': 444,
    'ncommaaccent': 556,
    'onesuperior': 300,
    'imacron': 278,
    'Euro': 500
  },
  'Times-BoldItalic': {
    'space': 250,
    'exclam': 389,
    'quotedbl': 555,
    'numbersign': 500,
    'dollar': 500,
    'percent': 833,
    'ampersand': 778,
    'quoteright': 333,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 500,
    'plus': 570,
    'comma': 250,
    'hyphen': 333,
    'period': 250,
    'slash': 278,
    'zero': 500,
    'one': 500,
    'two': 500,
    'three': 500,
    'four': 500,
    'five': 500,
    'six': 500,
    'seven': 500,
    'eight': 500,
    'nine': 500,
    'colon': 333,
    'semicolon': 333,
    'less': 570,
    'equal': 570,
    'greater': 570,
    'question': 500,
    'at': 832,
    'A': 667,
    'B': 667,
    'C': 667,
    'D': 722,
    'E': 667,
    'F': 667,
    'G': 722,
    'H': 778,
    'I': 389,
    'J': 500,
    'K': 667,
    'L': 611,
    'M': 889,
    'N': 722,
    'O': 722,
    'P': 611,
    'Q': 722,
    'R': 667,
    'S': 556,
    'T': 611,
    'U': 722,
    'V': 667,
    'W': 889,
    'X': 667,
    'Y': 611,
    'Z': 611,
    'bracketleft': 333,
    'backslash': 278,
    'bracketright': 333,
    'asciicircum': 570,
    'underscore': 500,
    'quoteleft': 333,
    'a': 500,
    'b': 500,
    'c': 444,
    'd': 500,
    'e': 444,
    'f': 333,
    'g': 500,
    'h': 556,
    'i': 278,
    'j': 278,
    'k': 500,
    'l': 278,
    'm': 778,
    'n': 556,
    'o': 500,
    'p': 500,
    'q': 500,
    'r': 389,
    's': 389,
    't': 278,
    'u': 556,
    'v': 444,
    'w': 667,
    'x': 500,
    'y': 444,
    'z': 389,
    'braceleft': 348,
    'bar': 220,
    'braceright': 348,
    'asciitilde': 570,
    'exclamdown': 389,
    'cent': 500,
    'sterling': 500,
    'fraction': 167,
    'yen': 500,
    'florin': 500,
    'section': 500,
    'currency': 500,
    'quotesingle': 278,
    'quotedblleft': 500,
    'guillemotleft': 500,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 556,
    'fl': 556,
    'endash': 500,
    'dagger': 500,
    'daggerdbl': 500,
    'periodcentered': 250,
    'paragraph': 500,
    'bullet': 350,
    'quotesinglbase': 333,
    'quotedblbase': 500,
    'quotedblright': 500,
    'guillemotright': 500,
    'ellipsis': 1000,
    'perthousand': 1000,
    'questiondown': 500,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 1000,
    'AE': 944,
    'ordfeminine': 266,
    'Lslash': 611,
    'Oslash': 722,
    'OE': 944,
    'ordmasculine': 300,
    'ae': 722,
    'dotlessi': 278,
    'lslash': 278,
    'oslash': 500,
    'oe': 722,
    'germandbls': 500,
    'Idieresis': 389,
    'eacute': 444,
    'abreve': 500,
    'uhungarumlaut': 556,
    'ecaron': 444,
    'Ydieresis': 611,
    'divide': 570,
    'Yacute': 611,
    'Acircumflex': 667,
    'aacute': 500,
    'Ucircumflex': 722,
    'yacute': 444,
    'scommaaccent': 389,
    'ecircumflex': 444,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 500,
    'Uacute': 722,
    'uogonek': 556,
    'Edieresis': 667,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 747,
    'Emacron': 667,
    'ccaron': 444,
    'aring': 500,
    'Ncommaaccent': 722,
    'lacute': 278,
    'agrave': 500,
    'Tcommaaccent': 611,
    'Cacute': 667,
    'atilde': 500,
    'Edotaccent': 667,
    'scaron': 389,
    'scedilla': 389,
    'iacute': 278,
    'lozenge': 494,
    'Rcaron': 667,
    'Gcommaaccent': 722,
    'ucircumflex': 556,
    'acircumflex': 500,
    'Amacron': 667,
    'rcaron': 389,
    'ccedilla': 444,
    'Zdotaccent': 611,
    'Thorn': 611,
    'Omacron': 722,
    'Racute': 667,
    'Sacute': 556,
    'dcaron': 608,
    'Umacron': 722,
    'uring': 556,
    'threesuperior': 300,
    'Ograve': 722,
    'Agrave': 667,
    'Abreve': 667,
    'multiply': 570,
    'uacute': 556,
    'Tcaron': 611,
    'partialdiff': 494,
    'ydieresis': 444,
    'Nacute': 722,
    'icircumflex': 278,
    'Ecircumflex': 667,
    'adieresis': 500,
    'edieresis': 444,
    'cacute': 444,
    'nacute': 556,
    'umacron': 556,
    'Ncaron': 722,
    'Iacute': 389,
    'plusminus': 570,
    'brokenbar': 220,
    'registered': 747,
    'Gbreve': 722,
    'Idotaccent': 389,
    'summation': 600,
    'Egrave': 667,
    'racute': 389,
    'omacron': 500,
    'Zacute': 611,
    'Zcaron': 611,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 667,
    'lcommaaccent': 278,
    'tcaron': 366,
    'eogonek': 444,
    'Uogonek': 722,
    'Aacute': 667,
    'Adieresis': 667,
    'egrave': 444,
    'zacute': 389,
    'iogonek': 278,
    'Oacute': 722,
    'oacute': 500,
    'amacron': 500,
    'sacute': 389,
    'idieresis': 278,
    'Ocircumflex': 722,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 500,
    'twosuperior': 300,
    'Odieresis': 722,
    'mu': 576,
    'igrave': 278,
    'ohungarumlaut': 500,
    'Eogonek': 667,
    'dcroat': 500,
    'threequarters': 750,
    'Scedilla': 556,
    'lcaron': 382,
    'Kcommaaccent': 667,
    'Lacute': 611,
    'trademark': 1000,
    'edotaccent': 444,
    'Igrave': 389,
    'Imacron': 389,
    'Lcaron': 611,
    'onehalf': 750,
    'lessequal': 549,
    'ocircumflex': 500,
    'ntilde': 556,
    'Uhungarumlaut': 722,
    'Eacute': 667,
    'emacron': 444,
    'gbreve': 500,
    'onequarter': 750,
    'Scaron': 556,
    'Scommaaccent': 556,
    'Ohungarumlaut': 722,
    'degree': 400,
    'ograve': 500,
    'Ccaron': 667,
    'ugrave': 556,
    'radical': 549,
    'Dcaron': 722,
    'rcommaaccent': 389,
    'Ntilde': 722,
    'otilde': 500,
    'Rcommaaccent': 667,
    'Lcommaaccent': 611,
    'Atilde': 667,
    'Aogonek': 667,
    'Aring': 667,
    'Otilde': 722,
    'zdotaccent': 389,
    'Ecaron': 667,
    'Iogonek': 389,
    'kcommaaccent': 500,
    'minus': 606,
    'Icircumflex': 389,
    'ncaron': 556,
    'tcommaaccent': 278,
    'logicalnot': 606,
    'odieresis': 500,
    'udieresis': 556,
    'notequal': 549,
    'gcommaaccent': 500,
    'eth': 500,
    'zcaron': 389,
    'ncommaaccent': 556,
    'onesuperior': 300,
    'imacron': 278,
    'Euro': 500
  },
  'Times-Italic': {
    'space': 250,
    'exclam': 333,
    'quotedbl': 420,
    'numbersign': 500,
    'dollar': 500,
    'percent': 833,
    'ampersand': 778,
    'quoteright': 333,
    'parenleft': 333,
    'parenright': 333,
    'asterisk': 500,
    'plus': 675,
    'comma': 250,
    'hyphen': 333,
    'period': 250,
    'slash': 278,
    'zero': 500,
    'one': 500,
    'two': 500,
    'three': 500,
    'four': 500,
    'five': 500,
    'six': 500,
    'seven': 500,
    'eight': 500,
    'nine': 500,
    'colon': 333,
    'semicolon': 333,
    'less': 675,
    'equal': 675,
    'greater': 675,
    'question': 500,
    'at': 920,
    'A': 611,
    'B': 611,
    'C': 667,
    'D': 722,
    'E': 611,
    'F': 611,
    'G': 722,
    'H': 722,
    'I': 333,
    'J': 444,
    'K': 667,
    'L': 556,
    'M': 833,
    'N': 667,
    'O': 722,
    'P': 611,
    'Q': 722,
    'R': 611,
    'S': 500,
    'T': 556,
    'U': 722,
    'V': 611,
    'W': 833,
    'X': 611,
    'Y': 556,
    'Z': 556,
    'bracketleft': 389,
    'backslash': 278,
    'bracketright': 389,
    'asciicircum': 422,
    'underscore': 500,
    'quoteleft': 333,
    'a': 500,
    'b': 500,
    'c': 444,
    'd': 500,
    'e': 444,
    'f': 278,
    'g': 500,
    'h': 500,
    'i': 278,
    'j': 278,
    'k': 444,
    'l': 278,
    'm': 722,
    'n': 500,
    'o': 500,
    'p': 500,
    'q': 500,
    'r': 389,
    's': 389,
    't': 278,
    'u': 500,
    'v': 444,
    'w': 667,
    'x': 444,
    'y': 444,
    'z': 389,
    'braceleft': 400,
    'bar': 275,
    'braceright': 400,
    'asciitilde': 541,
    'exclamdown': 389,
    'cent': 500,
    'sterling': 500,
    'fraction': 167,
    'yen': 500,
    'florin': 500,
    'section': 500,
    'currency': 500,
    'quotesingle': 214,
    'quotedblleft': 556,
    'guillemotleft': 500,
    'guilsinglleft': 333,
    'guilsinglright': 333,
    'fi': 500,
    'fl': 500,
    'endash': 500,
    'dagger': 500,
    'daggerdbl': 500,
    'periodcentered': 250,
    'paragraph': 523,
    'bullet': 350,
    'quotesinglbase': 333,
    'quotedblbase': 556,
    'quotedblright': 556,
    'guillemotright': 500,
    'ellipsis': 889,
    'perthousand': 1000,
    'questiondown': 500,
    'grave': 333,
    'acute': 333,
    'circumflex': 333,
    'tilde': 333,
    'macron': 333,
    'breve': 333,
    'dotaccent': 333,
    'dieresis': 333,
    'ring': 333,
    'cedilla': 333,
    'hungarumlaut': 333,
    'ogonek': 333,
    'caron': 333,
    'emdash': 889,
    'AE': 889,
    'ordfeminine': 276,
    'Lslash': 556,
    'Oslash': 722,
    'OE': 944,
    'ordmasculine': 310,
    'ae': 667,
    'dotlessi': 278,
    'lslash': 278,
    'oslash': 500,
    'oe': 667,
    'germandbls': 500,
    'Idieresis': 333,
    'eacute': 444,
    'abreve': 500,
    'uhungarumlaut': 500,
    'ecaron': 444,
    'Ydieresis': 556,
    'divide': 675,
    'Yacute': 556,
    'Acircumflex': 611,
    'aacute': 500,
    'Ucircumflex': 722,
    'yacute': 444,
    'scommaaccent': 389,
    'ecircumflex': 444,
    'Uring': 722,
    'Udieresis': 722,
    'aogonek': 500,
    'Uacute': 722,
    'uogonek': 500,
    'Edieresis': 611,
    'Dcroat': 722,
    'commaaccent': 250,
    'copyright': 760,
    'Emacron': 611,
    'ccaron': 444,
    'aring': 500,
    'Ncommaaccent': 667,
    'lacute': 278,
    'agrave': 500,
    'Tcommaaccent': 556,
    'Cacute': 667,
    'atilde': 500,
    'Edotaccent': 611,
    'scaron': 389,
    'scedilla': 389,
    'iacute': 278,
    'lozenge': 471,
    'Rcaron': 611,
    'Gcommaaccent': 722,
    'ucircumflex': 500,
    'acircumflex': 500,
    'Amacron': 611,
    'rcaron': 389,
    'ccedilla': 444,
    'Zdotaccent': 556,
    'Thorn': 611,
    'Omacron': 722,
    'Racute': 611,
    'Sacute': 500,
    'dcaron': 544,
    'Umacron': 722,
    'uring': 500,
    'threesuperior': 300,
    'Ograve': 722,
    'Agrave': 611,
    'Abreve': 611,
    'multiply': 675,
    'uacute': 500,
    'Tcaron': 556,
    'partialdiff': 476,
    'ydieresis': 444,
    'Nacute': 667,
    'icircumflex': 278,
    'Ecircumflex': 611,
    'adieresis': 500,
    'edieresis': 444,
    'cacute': 444,
    'nacute': 500,
    'umacron': 500,
    'Ncaron': 667,
    'Iacute': 333,
    'plusminus': 675,
    'brokenbar': 275,
    'registered': 760,
    'Gbreve': 722,
    'Idotaccent': 333,
    'summation': 600,
    'Egrave': 611,
    'racute': 389,
    'omacron': 500,
    'Zacute': 556,
    'Zcaron': 556,
    'greaterequal': 549,
    'Eth': 722,
    'Ccedilla': 667,
    'lcommaaccent': 278,
    'tcaron': 300,
    'eogonek': 444,
    'Uogonek': 722,
    'Aacute': 611,
    'Adieresis': 611,
    'egrave': 444,
    'zacute': 389,
    'iogonek': 278,
    'Oacute': 722,
    'oacute': 500,
    'amacron': 500,
    'sacute': 389,
    'idieresis': 278,
    'Ocircumflex': 722,
    'Ugrave': 722,
    'Delta': 612,
    'thorn': 500,
    'twosuperior': 300,
    'Odieresis': 722,
    'mu': 500,
    'igrave': 278,
    'ohungarumlaut': 500,
    'Eogonek': 611,
    'dcroat': 500,
    'threequarters': 750,
    'Scedilla': 500,
    'lcaron': 300,
    'Kcommaaccent': 667,
    'Lacute': 556,
    'trademark': 980,
    'edotaccent': 444,
    'Igrave': 333,
    'Imacron': 333,
    'Lcaron': 611,
    'onehalf': 750,
    'lessequal': 549,
    'ocircumflex': 500,
    'ntilde': 500,
    'Uhungarumlaut': 722,
    'Eacute': 611,
    'emacron': 444,
    'gbreve': 500,
    'onequarter': 750,
    'Scaron': 500,
    'Scommaaccent': 500,
    'Ohungarumlaut': 722,
    'degree': 400,
    'ograve': 500,
    'Ccaron': 667,
    'ugrave': 500,
    'radical': 453,
    'Dcaron': 722,
    'rcommaaccent': 389,
    'Ntilde': 667,
    'otilde': 500,
    'Rcommaaccent': 611,
    'Lcommaaccent': 556,
    'Atilde': 611,
    'Aogonek': 611,
    'Aring': 611,
    'Otilde': 722,
    'zdotaccent': 389,
    'Ecaron': 611,
    'Iogonek': 333,
    'kcommaaccent': 444,
    'minus': 675,
    'Icircumflex': 333,
    'ncaron': 500,
    'tcommaaccent': 278,
    'logicalnot': 675,
    'odieresis': 500,
    'udieresis': 500,
    'notequal': 549,
    'gcommaaccent': 500,
    'eth': 500,
    'zcaron': 389,
    'ncommaaccent': 500,
    'onesuperior': 300,
    'imacron': 278,
    'Euro': 500
  },
  'ZapfDingbats': {
    'space': 278,
    'a1': 974,
    'a2': 961,
    'a202': 974,
    'a3': 980,
    'a4': 719,
    'a5': 789,
    'a119': 790,
    'a118': 791,
    'a117': 690,
    'a11': 960,
    'a12': 939,
    'a13': 549,
    'a14': 855,
    'a15': 911,
    'a16': 933,
    'a105': 911,
    'a17': 945,
    'a18': 974,
    'a19': 755,
    'a20': 846,
    'a21': 762,
    'a22': 761,
    'a23': 571,
    'a24': 677,
    'a25': 763,
    'a26': 760,
    'a27': 759,
    'a28': 754,
    'a6': 494,
    'a7': 552,
    'a8': 537,
    'a9': 577,
    'a10': 692,
    'a29': 786,
    'a30': 788,
    'a31': 788,
    'a32': 790,
    'a33': 793,
    'a34': 794,
    'a35': 816,
    'a36': 823,
    'a37': 789,
    'a38': 841,
    'a39': 823,
    'a40': 833,
    'a41': 816,
    'a42': 831,
    'a43': 923,
    'a44': 744,
    'a45': 723,
    'a46': 749,
    'a47': 790,
    'a48': 792,
    'a49': 695,
    'a50': 776,
    'a51': 768,
    'a52': 792,
    'a53': 759,
    'a54': 707,
    'a55': 708,
    'a56': 682,
    'a57': 701,
    'a58': 826,
    'a59': 815,
    'a60': 789,
    'a61': 789,
    'a62': 707,
    'a63': 687,
    'a64': 696,
    'a65': 689,
    'a66': 786,
    'a67': 787,
    'a68': 713,
    'a69': 791,
    'a70': 785,
    'a71': 791,
    'a72': 873,
    'a73': 761,
    'a74': 762,
    'a203': 762,
    'a75': 759,
    'a204': 759,
    'a76': 892,
    'a77': 892,
    'a78': 788,
    'a79': 784,
    'a81': 438,
    'a82': 138,
    'a83': 277,
    'a84': 415,
    'a97': 392,
    'a98': 392,
    'a99': 668,
    'a100': 668,
    'a89': 390,
    'a90': 390,
    'a93': 317,
    'a94': 317,
    'a91': 276,
    'a92': 276,
    'a205': 509,
    'a85': 509,
    'a206': 410,
    'a86': 410,
    'a87': 234,
    'a88': 234,
    'a95': 334,
    'a96': 334,
    'a101': 732,
    'a102': 544,
    'a103': 544,
    'a104': 910,
    'a106': 667,
    'a107': 760,
    'a108': 760,
    'a112': 776,
    'a111': 595,
    'a110': 694,
    'a109': 626,
    'a120': 788,
    'a121': 788,
    'a122': 788,
    'a123': 788,
    'a124': 788,
    'a125': 788,
    'a126': 788,
    'a127': 788,
    'a128': 788,
    'a129': 788,
    'a130': 788,
    'a131': 788,
    'a132': 788,
    'a133': 788,
    'a134': 788,
    'a135': 788,
    'a136': 788,
    'a137': 788,
    'a138': 788,
    'a139': 788,
    'a140': 788,
    'a141': 788,
    'a142': 788,
    'a143': 788,
    'a144': 788,
    'a145': 788,
    'a146': 788,
    'a147': 788,
    'a148': 788,
    'a149': 788,
    'a150': 788,
    'a151': 788,
    'a152': 788,
    'a153': 788,
    'a154': 788,
    'a155': 788,
    'a156': 788,
    'a157': 788,
    'a158': 788,
    'a159': 788,
    'a160': 894,
    'a161': 838,
    'a163': 1016,
    'a164': 458,
    'a196': 748,
    'a165': 924,
    'a192': 748,
    'a166': 918,
    'a167': 927,
    'a168': 928,
    'a169': 928,
    'a170': 834,
    'a171': 873,
    'a172': 828,
    'a173': 924,
    'a162': 924,
    'a174': 917,
    'a175': 930,
    'a176': 931,
    'a177': 463,
    'a178': 883,
    'a179': 836,
    'a193': 836,
    'a180': 867,
    'a199': 867,
    'a181': 696,
    'a200': 696,
    'a182': 874,
    'a201': 874,
    'a183': 760,
    'a184': 946,
    'a197': 771,
    'a185': 865,
    'a194': 771,
    'a198': 888,
    'a186': 967,
    'a195': 888,
    'a187': 831,
    'a188': 873,
    'a189': 927,
    'a190': 970,
    'a191': 918
  }
};
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';
var isWorker = (typeof window == 'undefined');

/**
 * Maximum time to wait for a font to be loaded by font-face rules.
 */
var kMaxWaitForFontFace = 1000;

// Unicode Private Use Area
var kCmapGlyphOffset = 0xE000;

// PDF Glyph Space Units are one Thousandth of a TextSpace Unit
// except for Type 3 fonts
var kPDFGlyphSpaceUnits = 1000;

// Until hinting is fully supported this constant can be used
var kHintingEnabled = false;

/**
 * Hold a map of decoded fonts and of the standard fourteen Type1
 * fonts and their acronyms.
 */
var stdFontMap = {
  'ArialNarrow': 'Helvetica',
  'ArialNarrow_Bold': 'Helvetica-Bold',
  'ArialNarrow_BoldItalic': 'Helvetica-BoldOblique',
  'ArialNarrow_Italic': 'Helvetica-Oblique',
  'ArialBlack': 'Helvetica',
  'ArialBlack_Bold': 'Helvetica-Bold',
  'ArialBlack_BoldItalic': 'Helvetica-BoldOblique',
  'ArialBlack_Italic': 'Helvetica-Oblique',
  'Arial': 'Helvetica',
  'Arial_Bold': 'Helvetica-Bold',
  'Arial_BoldItalic': 'Helvetica-BoldOblique',
  'Arial_Italic': 'Helvetica-Oblique',
  'Arial_BoldItalicMT': 'Helvetica-BoldOblique',
  'Arial_BoldMT': 'Helvetica-Bold',
  'Arial_ItalicMT': 'Helvetica-Oblique',
  'ArialMT': 'Helvetica',
  'Courier_Bold': 'Courier-Bold',
  'Courier_BoldItalic': 'Courier-BoldOblique',
  'Courier_Italic': 'Courier-Oblique',
  'CourierNew': 'Courier',
  'CourierNew_Bold': 'Courier-Bold',
  'CourierNew_BoldItalic': 'Courier-BoldOblique',
  'CourierNew_Italic': 'Courier-Oblique',
  'CourierNewPS_BoldItalicMT': 'Courier-BoldOblique',
  'CourierNewPS_BoldMT': 'Courier-Bold',
  'CourierNewPS_ItalicMT': 'Courier-Oblique',
  'CourierNewPSMT': 'Courier',
  'Helvetica_Bold': 'Helvetica-Bold',
  'Helvetica_BoldItalic': 'Helvetica-BoldOblique',
  'Helvetica_Italic': 'Helvetica-Oblique',
  'Symbol_Bold': 'Symbol',
  'Symbol_BoldItalic': 'Symbol',
  'Symbol_Italic': 'Symbol',
  'TimesNewRoman': 'Times-Roman',
  'TimesNewRoman_Bold': 'Times-Bold',
  'TimesNewRoman_BoldItalic': 'Times-BoldItalic',
  'TimesNewRoman_Italic': 'Times-Italic',
  'TimesNewRomanPS': 'Times-Roman',
  'TimesNewRomanPS_Bold': 'Times-Bold',
  'TimesNewRomanPS_BoldItalic': 'Times-BoldItalic',
  'TimesNewRomanPS_BoldItalicMT': 'Times-BoldItalic',
  'TimesNewRomanPS_BoldMT': 'Times-Bold',
  'TimesNewRomanPS_Italic': 'Times-Italic',
  'TimesNewRomanPS_ItalicMT': 'Times-Italic',
  'TimesNewRomanPSMT': 'Times-Roman',
  'TimesNewRomanPSMT_Bold': 'Times-Bold',
  'TimesNewRomanPSMT_BoldItalic': 'Times-BoldItalic',
  'TimesNewRomanPSMT_Italic': 'Times-Italic'
};

var serifFonts = {
  'Adobe Jenson': true, 'Adobe Text': true, 'Albertus': true,
  'Aldus': true, 'Alexandria': true, 'Algerian': true,
  'American Typewriter': true, 'Antiqua': true, 'Apex': true,
  'Arno': true, 'Aster': true, 'Aurora': true,
  'Baskerville': true, 'Bell': true, 'Bembo': true,
  'Bembo Schoolbook': true, 'Benguiat': true, 'Berkeley Old Style': true,
  'Bernhard Modern': true, 'Berthold City': true, 'Bodoni': true,
  'Bauer Bodoni': true, 'Book Antiqua': true, 'Bookman': true,
  'Bordeaux Roman': true, 'Californian FB': true, 'Calisto': true,
  'Calvert': true, 'Capitals': true, 'Cambria': true,
  'Cartier': true, 'Caslon': true, 'Catull': true,
  'Centaur': true, 'Century Old Style': true, 'Century Schoolbook': true,
  'Chaparral': true, 'Charis SIL': true, 'Cheltenham': true,
  'Cholla Slab': true, 'Clarendon': true, 'Clearface': true,
  'Cochin': true, 'Colonna': true, 'Computer Modern': true,
  'Concrete Roman': true, 'Constantia': true, 'Cooper Black': true,
  'Corona': true, 'Ecotype': true, 'Egyptienne': true,
  'Elephant': true, 'Excelsior': true, 'Fairfield': true,
  'FF Scala': true, 'Folkard': true, 'Footlight': true,
  'FreeSerif': true, 'Friz Quadrata': true, 'Garamond': true,
  'Gentium': true, 'Georgia': true, 'Gloucester': true,
  'Goudy Old Style': true, 'Goudy Schoolbook': true, 'Goudy Pro Font': true,
  'Granjon': true, 'Guardian Egyptian': true, 'Heather': true,
  'Hercules': true, 'High Tower Text': true, 'Hiroshige': true,
  'Hoefler Text': true, 'Humana Serif': true, 'Imprint': true,
  'Ionic No. 5': true, 'Janson': true, 'Joanna': true,
  'Korinna': true, 'Lexicon': true, 'Liberation Serif': true,
  'Linux Libertine': true, 'Literaturnaya': true, 'Lucida': true,
  'Lucida Bright': true, 'Melior': true, 'Memphis': true,
  'Miller': true, 'Minion': true, 'Modern': true,
  'Mona Lisa': true, 'Mrs Eaves': true, 'MS Serif': true,
  'Museo Slab': true, 'New York': true, 'Nimbus Roman': true,
  'NPS Rawlinson Roadway': true, 'Palatino': true, 'Perpetua': true,
  'Plantin': true, 'Plantin Schoolbook': true, 'Playbill': true,
  'Poor Richard': true, 'Rawlinson Roadway': true, 'Renault': true,
  'Requiem': true, 'Rockwell': true, 'Roman': true,
  'Rotis Serif': true, 'Sabon': true, 'Scala': true,
  'Seagull': true, 'Sistina': true, 'Souvenir': true,
  'STIX': true, 'Stone Informal': true, 'Stone Serif': true,
  'Sylfaen': true, 'Times': true, 'Trajan': true,
  'Trinité': true, 'Trump Mediaeval': true, 'Utopia': true,
  'Vale Type': true, 'Bitstream Vera': true, 'Vera Serif': true,
  'Versailles': true, 'Wanted': true, 'Weiss': true,
  'Wide Latin': true, 'Windsor': true, 'XITS': true
};

var FontLoader = {
  listeningForFontLoad: false,

  bind: function fontLoaderBind(fonts, callback) {
    function checkFontsLoaded() {
      for (var i = 0; i < objs.length; i++) {
        var fontObj = objs[i];
        if (fontObj.loading) {
          return false;
        }
      }

      document.documentElement.removeEventListener(
        'pdfjsFontLoad', checkFontsLoaded, false);

      callback();
      return true;
    }

    var rules = [], names = [], objs = [];

    for (var i = 0; i < fonts.length; i++) {
      var font = fonts[i];

      var obj = new Font(font.name, font.file, font.properties);
      objs.push(obj);

      var str = '';
      var data = obj.data;
      if (data) {
        var length = data.length;
        for (var j = 0; j < length; j++)
          str += String.fromCharCode(data[j]);

        var rule = isWorker ? obj.bindWorker(str) : obj.bindDOM(str);
        if (rule) {
          rules.push(rule);
          names.push(obj.loadedName);
        }
      }
    }

    this.listeningForFontLoad = false;
    if (!isWorker && rules.length) {
      FontLoader.prepareFontLoadEvent(rules, names, objs);
    }

    if (!checkFontsLoaded()) {
      document.documentElement.addEventListener(
        'pdfjsFontLoad', checkFontsLoaded, false);
    }

    return objs;
  },
  // Set things up so that at least one pdfjsFontLoad event is
  // dispatched when all the @font-face |rules| for |names| have been
  // loaded in a subdocument.  It's expected that the load of |rules|
  // has already started in this (outer) document, so that they should
  // be ordered before the load in the subdocument.
  prepareFontLoadEvent: function fontLoaderPrepareFontLoadEvent(rules, names,
                                                                objs) {
      /** Hack begin */
      // There's no event when a font has finished downloading so the
      // following code is a dirty hack to 'guess' when a font is
      // ready.  This code will be obsoleted by Mozilla bug 471915.
      //
      // The only reliable way to know if a font is loaded in Gecko
      // (at the moment) is document.onload in a document with
      // a @font-face rule defined in a "static" stylesheet.  We use a
      // subdocument in an <iframe>, set up properly, to know when
      // our @font-face rule was loaded.  However, the subdocument and
      // outer document can't share CSS rules, so the inner document
      // is only part of the puzzle.  The second piece is an invisible
      // div created in order to force loading of the @font-face in
      // the *outer* document.  (The font still needs to be loaded for
      // its metrics, for reflow).  We create the div first for the
      // outer document, then create the iframe.  Unless something
      // goes really wonkily, we expect the @font-face for the outer
      // document to be processed before the inner.  That's still
      // fragile, but seems to work in practice.
      //
      // The postMessage() hackery was added to work around chrome bug
      // 82402.

      var div = document.createElement('div');
      div.setAttribute('style',
                       'visibility: hidden;' +
                       'width: 10px; height: 10px;' +
                       'position: absolute; top: 0px; left: 0px;');
      var html = '';
      for (var i = 0; i < names.length; ++i) {
        html += '<span style="font-family:' + names[i] + '">Hi</span>';
      }
      div.innerHTML = html;
      document.body.appendChild(div);

      if (!this.listeningForFontLoad) {
        window.addEventListener(
          'message',
          function fontLoaderMessage(e) {
            var fontNames = JSON.parse(e.data);
            for (var i = 0; i < objs.length; ++i) {
              var font = objs[i];
              font.loading = false;
            }
            var evt = document.createEvent('Events');
            evt.initEvent('pdfjsFontLoad', true, false);
            document.documentElement.dispatchEvent(evt);
          },
          false);
        this.listeningForFontLoad = true;
      }

      // XXX we should have a time-out here too, and maybe fire
      // pdfjsFontLoadFailed?
      var src = '<!DOCTYPE HTML><html><head>';
      src += '<style type="text/css">';
      for (var i = 0; i < rules.length; ++i) {
        src += rules[i];
      }
      src += '</style>';
      src += '<script type="application/javascript">';
      var fontNamesArray = '';
      for (var i = 0; i < names.length; ++i) {
        fontNamesArray += '"' + names[i] + '", ';
      }
      src += '  var fontNames=[' + fontNamesArray + '];\n';
      src += '  window.onload = function fontLoaderOnload() {\n';
      src += '    parent.postMessage(JSON.stringify(fontNames), "*");\n';
      src += '  }';
      src += '</script></head><body>';
      for (var i = 0; i < names.length; ++i) {
        src += '<p style="font-family:\'' + names[i] + '\'">Hi</p>';
      }
      src += '</body></html>';
      var frame = document.createElement('iframe');
      frame.src = 'data:text/html,' + src;
      frame.setAttribute('style',
                         'visibility: hidden;' +
                         'width: 10px; height: 10px;' +
                         'position: absolute; top: 0px; left: 0px;');
      document.body.appendChild(frame);
      /** Hack end */
  }
};

var UnicodeRanges = [
  { 'begin': 0x0000, 'end': 0x007F }, // Basic Latin
  { 'begin': 0x0080, 'end': 0x00FF }, // Latin-1 Supplement
  { 'begin': 0x0100, 'end': 0x017F }, // Latin Extended-A
  { 'begin': 0x0180, 'end': 0x024F }, // Latin Extended-B
  { 'begin': 0x0250, 'end': 0x02AF }, // IPA Extensions
  { 'begin': 0x02B0, 'end': 0x02FF }, // Spacing Modifier Letters
  { 'begin': 0x0300, 'end': 0x036F }, // Combining Diacritical Marks
  { 'begin': 0x0370, 'end': 0x03FF }, // Greek and Coptic
  { 'begin': 0x2C80, 'end': 0x2CFF }, // Coptic
  { 'begin': 0x0400, 'end': 0x04FF }, // Cyrillic
  { 'begin': 0x0530, 'end': 0x058F }, // Armenian
  { 'begin': 0x0590, 'end': 0x05FF }, // Hebrew
  { 'begin': 0xA500, 'end': 0xA63F }, // Vai
  { 'begin': 0x0600, 'end': 0x06FF }, // Arabic
  { 'begin': 0x07C0, 'end': 0x07FF }, // NKo
  { 'begin': 0x0900, 'end': 0x097F }, // Devanagari
  { 'begin': 0x0980, 'end': 0x09FF }, // Bengali
  { 'begin': 0x0A00, 'end': 0x0A7F }, // Gurmukhi
  { 'begin': 0x0A80, 'end': 0x0AFF }, // Gujarati
  { 'begin': 0x0B00, 'end': 0x0B7F }, // Oriya
  { 'begin': 0x0B80, 'end': 0x0BFF }, // Tamil
  { 'begin': 0x0C00, 'end': 0x0C7F }, // Telugu
  { 'begin': 0x0C80, 'end': 0x0CFF }, // Kannada
  { 'begin': 0x0D00, 'end': 0x0D7F }, // Malayalam
  { 'begin': 0x0E00, 'end': 0x0E7F }, // Thai
  { 'begin': 0x0E80, 'end': 0x0EFF }, // Lao
  { 'begin': 0x10A0, 'end': 0x10FF }, // Georgian
  { 'begin': 0x1B00, 'end': 0x1B7F }, // Balinese
  { 'begin': 0x1100, 'end': 0x11FF }, // Hangul Jamo
  { 'begin': 0x1E00, 'end': 0x1EFF }, // Latin Extended Additional
  { 'begin': 0x1F00, 'end': 0x1FFF }, // Greek Extended
  { 'begin': 0x2000, 'end': 0x206F }, // General Punctuation
  { 'begin': 0x2070, 'end': 0x209F }, // Superscripts And Subscripts
  { 'begin': 0x20A0, 'end': 0x20CF }, // Currency Symbol
  { 'begin': 0x20D0, 'end': 0x20FF }, // Combining Diacritical Marks For Symbols
  { 'begin': 0x2100, 'end': 0x214F }, // Letterlike Symbols
  { 'begin': 0x2150, 'end': 0x218F }, // Number Forms
  { 'begin': 0x2190, 'end': 0x21FF }, // Arrows
  { 'begin': 0x2200, 'end': 0x22FF }, // Mathematical Operators
  { 'begin': 0x2300, 'end': 0x23FF }, // Miscellaneous Technical
  { 'begin': 0x2400, 'end': 0x243F }, // Control Pictures
  { 'begin': 0x2440, 'end': 0x245F }, // Optical Character Recognition
  { 'begin': 0x2460, 'end': 0x24FF }, // Enclosed Alphanumerics
  { 'begin': 0x2500, 'end': 0x257F }, // Box Drawing
  { 'begin': 0x2580, 'end': 0x259F }, // Block Elements
  { 'begin': 0x25A0, 'end': 0x25FF }, // Geometric Shapes
  { 'begin': 0x2600, 'end': 0x26FF }, // Miscellaneous Symbols
  { 'begin': 0x2700, 'end': 0x27BF }, // Dingbats
  { 'begin': 0x3000, 'end': 0x303F }, // CJK Symbols And Punctuation
  { 'begin': 0x3040, 'end': 0x309F }, // Hiragana
  { 'begin': 0x30A0, 'end': 0x30FF }, // Katakana
  { 'begin': 0x3100, 'end': 0x312F }, // Bopomofo
  { 'begin': 0x3130, 'end': 0x318F }, // Hangul Compatibility Jamo
  { 'begin': 0xA840, 'end': 0xA87F }, // Phags-pa
  { 'begin': 0x3200, 'end': 0x32FF }, // Enclosed CJK Letters And Months
  { 'begin': 0x3300, 'end': 0x33FF }, // CJK Compatibility
  { 'begin': 0xAC00, 'end': 0xD7AF }, // Hangul Syllables
  { 'begin': 0xD800, 'end': 0xDFFF }, // Non-Plane 0 *
  { 'begin': 0x10900, 'end': 0x1091F }, // Phoenicia
  { 'begin': 0x4E00, 'end': 0x9FFF }, // CJK Unified Ideographs
  { 'begin': 0xE000, 'end': 0xF8FF }, // Private Use Area (plane 0)
  { 'begin': 0x31C0, 'end': 0x31EF }, // CJK Strokes
  { 'begin': 0xFB00, 'end': 0xFB4F }, // Alphabetic Presentation Forms
  { 'begin': 0xFB50, 'end': 0xFDFF }, // Arabic Presentation Forms-A
  { 'begin': 0xFE20, 'end': 0xFE2F }, // Combining Half Marks
  { 'begin': 0xFE10, 'end': 0xFE1F }, // Vertical Forms
  { 'begin': 0xFE50, 'end': 0xFE6F }, // Small Form Variants
  { 'begin': 0xFE70, 'end': 0xFEFF }, // Arabic Presentation Forms-B
  { 'begin': 0xFF00, 'end': 0xFFEF }, // Halfwidth And Fullwidth Forms
  { 'begin': 0xFFF0, 'end': 0xFFFF }, // Specials
  { 'begin': 0x0F00, 'end': 0x0FFF }, // Tibetan
  { 'begin': 0x0700, 'end': 0x074F }, // Syriac
  { 'begin': 0x0780, 'end': 0x07BF }, // Thaana
  { 'begin': 0x0D80, 'end': 0x0DFF }, // Sinhala
  { 'begin': 0x1000, 'end': 0x109F }, // Myanmar
  { 'begin': 0x1200, 'end': 0x137F }, // Ethiopic
  { 'begin': 0x13A0, 'end': 0x13FF }, // Cherokee
  { 'begin': 0x1400, 'end': 0x167F }, // Unified Canadian Aboriginal Syllabics
  { 'begin': 0x1680, 'end': 0x169F }, // Ogham
  { 'begin': 0x16A0, 'end': 0x16FF }, // Runic
  { 'begin': 0x1780, 'end': 0x17FF }, // Khmer
  { 'begin': 0x1800, 'end': 0x18AF }, // Mongolian
  { 'begin': 0x2800, 'end': 0x28FF }, // Braille Patterns
  { 'begin': 0xA000, 'end': 0xA48F }, // Yi Syllables
  { 'begin': 0x1700, 'end': 0x171F }, // Tagalog
  { 'begin': 0x10300, 'end': 0x1032F }, // Old Italic
  { 'begin': 0x10330, 'end': 0x1034F }, // Gothic
  { 'begin': 0x10400, 'end': 0x1044F }, // Deseret
  { 'begin': 0x1D000, 'end': 0x1D0FF }, // Byzantine Musical Symbols
  { 'begin': 0x1D400, 'end': 0x1D7FF }, // Mathematical Alphanumeric Symbols
  { 'begin': 0xFF000, 'end': 0xFFFFD }, // Private Use (plane 15)
  { 'begin': 0xFE00, 'end': 0xFE0F }, // Variation Selectors
  { 'begin': 0xE0000, 'end': 0xE007F }, // Tags
  { 'begin': 0x1900, 'end': 0x194F }, // Limbu
  { 'begin': 0x1950, 'end': 0x197F }, // Tai Le
  { 'begin': 0x1980, 'end': 0x19DF }, // New Tai Lue
  { 'begin': 0x1A00, 'end': 0x1A1F }, // Buginese
  { 'begin': 0x2C00, 'end': 0x2C5F }, // Glagolitic
  { 'begin': 0x2D30, 'end': 0x2D7F }, // Tifinagh
  { 'begin': 0x4DC0, 'end': 0x4DFF }, // Yijing Hexagram Symbols
  { 'begin': 0xA800, 'end': 0xA82F }, // Syloti Nagri
  { 'begin': 0x10000, 'end': 0x1007F }, // Linear B Syllabary
  { 'begin': 0x10140, 'end': 0x1018F }, // Ancient Greek Numbers
  { 'begin': 0x10380, 'end': 0x1039F }, // Ugaritic
  { 'begin': 0x103A0, 'end': 0x103DF }, // Old Persian
  { 'begin': 0x10450, 'end': 0x1047F }, // Shavian
  { 'begin': 0x10480, 'end': 0x104AF }, // Osmanya
  { 'begin': 0x10800, 'end': 0x1083F }, // Cypriot Syllabary
  { 'begin': 0x10A00, 'end': 0x10A5F }, // Kharoshthi
  { 'begin': 0x1D300, 'end': 0x1D35F }, // Tai Xuan Jing Symbols
  { 'begin': 0x12000, 'end': 0x123FF }, // Cuneiform
  { 'begin': 0x1D360, 'end': 0x1D37F }, // Counting Rod Numerals
  { 'begin': 0x1B80, 'end': 0x1BBF }, // Sundanese
  { 'begin': 0x1C00, 'end': 0x1C4F }, // Lepcha
  { 'begin': 0x1C50, 'end': 0x1C7F }, // Ol Chiki
  { 'begin': 0xA880, 'end': 0xA8DF }, // Saurashtra
  { 'begin': 0xA900, 'end': 0xA92F }, // Kayah Li
  { 'begin': 0xA930, 'end': 0xA95F }, // Rejang
  { 'begin': 0xAA00, 'end': 0xAA5F }, // Cham
  { 'begin': 0x10190, 'end': 0x101CF }, // Ancient Symbols
  { 'begin': 0x101D0, 'end': 0x101FF }, // Phaistos Disc
  { 'begin': 0x102A0, 'end': 0x102DF }, // Carian
  { 'begin': 0x1F030, 'end': 0x1F09F }  // Domino Tiles
];

function getUnicodeRangeFor(value) {
  for (var i = 0; i < UnicodeRanges.length; i++) {
    var range = UnicodeRanges[i];
    if (value >= range.begin && value < range.end)
      return i;
  }
  return -1;
}

/**
 * 'Font' is the class the outside world should use, it encapsulate all the font
 * decoding logics whatever type it is (assuming the font type is supported).
 *
 * For example to read a Type1 font and to attach it to the document:
 *   var type1Font = new Font("MyFontName", binaryFile, propertiesObject);
 *   type1Font.bind();
 */
var Font = (function Font() {
  var constructor = function font_constructor(name, file, properties) {
    this.name = name;
    this.encoding = properties.encoding;
    this.sizes = [];

    var names = name.split('+');
    names = names.length > 1 ? names[1] : names[0];
    names = names.split(/[-,_]/g)[0];
    this.serif = serifFonts[names] || (name.search(/serif/gi) != -1);

    // If the font is to be ignored, register it like an already loaded font
    // to avoid the cost of waiting for it be be loaded by the platform.
    if (properties.ignore) {
      this.loadedName = this.serif ? 'serif' : 'sans-serif';
      this.loading = false;
      return;
    }

    if (!file) {
      // The file data is not specified. Trying to fix the font name
      // to be used with the canvas.font.
      var fontName = stdFontMap[name] || name.replace('_', '-');
      this.bold = (fontName.search(/bold/gi) != -1);
      this.italic = (fontName.search(/oblique/gi) != -1) ||
                    (fontName.search(/italic/gi) != -1);

      // Use 'name' instead of 'fontName' here because the original
      // name ArialBlack for example will be replaced by Helvetica.
      this.black = (name.search(/Black/g) != -1);

      this.defaultWidth = properties.defaultWidth;
      this.loadedName = fontName.split('-')[0];
      this.loading = false;
      return;
    }

    var data;
    var type = properties.type;
    switch (type) {
      case 'Type1':
      case 'CIDFontType0':
        this.mimetype = 'font/opentype';

        var subtype = properties.subtype;
        var cff = (subtype == 'Type1C' || subtype == 'CIDFontType0C') ?
          new Type2CFF(file, properties) : new CFF(name, file, properties);

        // Wrap the CFF data inside an OTF font file
        data = this.convert(name, cff, properties);
        break;

      case 'TrueType':
      case 'CIDFontType2':
        this.mimetype = 'font/opentype';

        // Repair the TrueType file. It is can be damaged in the point of
        // view of the sanitizer
        data = this.checkAndRepair(name, file, properties);
        break;

      default:
        warn('Font ' + properties.type + ' is not supported');
        break;
    }

    this.data = data;
    this.type = type;
    this.textMatrix = properties.textMatrix;
    this.defaultWidth = properties.defaultWidth;
    this.loadedName = getUniqueName();
    this.composite = properties.composite;
    this.loading = true;
  };

  var numFonts = 0;
  function getUniqueName() {
    return 'pdfFont' + numFonts++;
  }

  function stringToArray(str) {
    var array = [];
    for (var i = 0; i < str.length; ++i)
      array[i] = str.charCodeAt(i);

    return array;
  };

  function arrayToString(arr) {
    var str = '';
    for (var i = 0; i < arr.length; ++i)
      str += String.fromCharCode(arr[i]);

    return str;
  };

  function int16(bytes) {
    return (bytes[0] << 8) + (bytes[1] & 0xff);
  };

  function int32(bytes) {
    return (bytes[0] << 24) + (bytes[1] << 16) +
           (bytes[2] << 8) + (bytes[3] & 0xff);
  };

  function getMaxPower2(number) {
    var maxPower = 0;
    var value = number;
    while (value >= 2) {
      value /= 2;
      maxPower++;
    }

    value = 2;
    for (var i = 1; i < maxPower; i++)
      value *= 2;
    return value;
  };

  function string16(value) {
    return String.fromCharCode((value >> 8) & 0xff) +
           String.fromCharCode(value & 0xff);
  };

  function string32(value) {
    return String.fromCharCode((value >> 24) & 0xff) +
           String.fromCharCode((value >> 16) & 0xff) +
           String.fromCharCode((value >> 8) & 0xff) +
           String.fromCharCode(value & 0xff);
  };

  function createOpenTypeHeader(sfnt, file, numTables) {
    // Windows hates the Mac TrueType sfnt version number
    if (sfnt == 'true')
      sfnt = string32(0x00010000);

    // sfnt version (4 bytes)
    var header = sfnt;

    // numTables (2 bytes)
    header += string16(numTables);

    // searchRange (2 bytes)
    var tablesMaxPower2 = getMaxPower2(numTables);
    var searchRange = tablesMaxPower2 * 16;
    header += string16(searchRange);

    // entrySelector (2 bytes)
    header += string16(Math.log(tablesMaxPower2) / Math.log(2));

    // rangeShift (2 bytes)
    header += string16(numTables * 16 - searchRange);

    file.file += header;
    file.virtualOffset += header.length;
  };

  function createTableEntry(file, tag, data) {
    // offset
    var offset = file.virtualOffset;

    // length
    var length = data.length;

    // Per spec tables must be 4-bytes align so add padding as needed
    while (data.length & 3)
      data.push(0x00);

    while (file.virtualOffset & 3)
      file.virtualOffset++;

    // checksum
    var checksum = 0, n = data.length;
    for (var i = 0; i < n; i += 4)
      checksum = (checksum + int32([data[i], data[i + 1], data[i + 2],
                                    data[i + 3]])) | 0;

    var tableEntry = (tag + string32(checksum) +
                      string32(offset) + string32(length));
    file.file += tableEntry;
    file.virtualOffset += data.length;
  };

  function getRanges(glyphs) {
    // Array.sort() sorts by characters, not numerically, so convert to an
    // array of characters.
    var codes = [];
    var length = glyphs.length;
    for (var n = 0; n < length; ++n)
      codes.push({ unicode: glyphs[n].unicode, code: n });
    codes.sort(function fontGetRangesSort(a, b) {
      return a.unicode - b.unicode;
    });

    // Split the sorted codes into ranges.
    var ranges = [];
    for (var n = 0; n < length; ) {
      var start = codes[n].unicode;
      var startCode = codes[n].code;
      ++n;
      var end = start;
      while (n < length && end + 1 == codes[n].unicode) {
        ++end;
        ++n;
      }
      var endCode = codes[n - 1].code;
      ranges.push([start, end, startCode, endCode]);
    }

    return ranges;
  };

  function createCMapTable(glyphs, deltas) {
    var ranges = getRanges(glyphs);

    var numTables = 1;
    var cmap = '\x00\x00' + // version
               string16(numTables) +  // numTables
               '\x00\x03' + // platformID
               '\x00\x01' + // encodingID
               string32(4 + numTables * 8); // start of the table record

    var segCount = ranges.length + 1;
    var segCount2 = segCount * 2;
    var searchRange = getMaxPower2(segCount) * 2;
    var searchEntry = Math.log(segCount) / Math.log(2);
    var rangeShift = 2 * segCount - searchRange;

    // Fill up the 4 parallel arrays describing the segments.
    var startCount = '';
    var endCount = '';
    var idDeltas = '';
    var idRangeOffsets = '';
    var glyphsIds = '';
    var bias = 0;

    if (deltas) {
      for (var i = 0; i < segCount - 1; i++) {
        var range = ranges[i];
        var start = range[0];
        var end = range[1];
        var offset = (segCount - i) * 2 + bias * 2;
        bias += (end - start + 1);

        startCount += string16(start);
        endCount += string16(end);
        idDeltas += string16(0);
        idRangeOffsets += string16(offset);

        var startCode = range[2];
        var endCode = range[3];
        for (var j = startCode; j <= endCode; ++j)
          glyphsIds += string16(deltas[j]);
      }
    } else {
      for (var i = 0; i < segCount - 1; i++) {
        var range = ranges[i];
        var start = range[0];
        var end = range[1];
        var startCode = range[2];

        startCount += string16(start);
        endCount += string16(end);
        idDeltas += string16((startCode - start + 1) & 0xFFFF);
        idRangeOffsets += string16(0);
      }
    }

    endCount += '\xFF\xFF';
    startCount += '\xFF\xFF';
    idDeltas += '\x00\x01';
    idRangeOffsets += '\x00\x00';

    var format314 = '\x00\x00' + // language
                    string16(segCount2) +
                    string16(searchRange) +
                    string16(searchEntry) +
                    string16(rangeShift) +
                    endCount + '\x00\x00' + startCount +
                    idDeltas + idRangeOffsets + glyphsIds;

    return stringToArray(cmap +
                         '\x00\x04' + // format
                         string16(format314.length + 4) + // length
                         format314);
  };

  function createOS2Table(properties, override) {
    var override = override || {};

    var ulUnicodeRange1 = 0;
    var ulUnicodeRange2 = 0;
    var ulUnicodeRange3 = 0;
    var ulUnicodeRange4 = 0;

    var firstCharIndex = null;
    var lastCharIndex = 0;

    var encoding = properties.encoding;
    for (var index in encoding) {
      var code = encoding[index].unicode;
      if (firstCharIndex > code || !firstCharIndex)
        firstCharIndex = code;
      if (lastCharIndex < code)
        lastCharIndex = code;

      var position = getUnicodeRangeFor(code);
      if (position < 32) {
        ulUnicodeRange1 |= 1 << position;
      } else if (position < 64) {
        ulUnicodeRange2 |= 1 << position - 32;
      } else if (position < 96) {
        ulUnicodeRange3 |= 1 << position - 64;
      } else if (position < 123) {
        ulUnicodeRange4 |= 1 << position - 96;
      } else {
        error('Unicode ranges Bits > 123 are reserved for internal usage');
      }
    }

    var unitsPerEm = override.unitsPerEm || kPDFGlyphSpaceUnits;
    var typoAscent = override.ascent || properties.ascent;
    var typoDescent = override.descent || properties.descent;
    var winAscent = override.yMax || typoAscent;
    var winDescent = -override.yMin || -typoDescent;

    // if there is a units per em value but no other override
    // then scale the calculated ascent
    if (unitsPerEm != kPDFGlyphSpaceUnits &&
        'undefined' == typeof(override.ascent)) {
      // if the font units differ to the PDF glyph space units
      // then scale up the values
      typoAscent = Math.round(typoAscent * unitsPerEm / kPDFGlyphSpaceUnits);
      typoDescent = Math.round(typoDescent * unitsPerEm / kPDFGlyphSpaceUnits);
      winAscent = typoAscent;
      winDescent = -typoDescent;
    }

    return '\x00\x03' + // version
           '\x02\x24' + // xAvgCharWidth
           '\x01\xF4' + // usWeightClass
           '\x00\x05' + // usWidthClass
           '\x00\x00' + // fstype (0 to let the font loads via font-face on IE)
           '\x02\x8A' + // ySubscriptXSize
           '\x02\xBB' + // ySubscriptYSize
           '\x00\x00' + // ySubscriptXOffset
           '\x00\x8C' + // ySubscriptYOffset
           '\x02\x8A' + // ySuperScriptXSize
           '\x02\xBB' + // ySuperScriptYSize
           '\x00\x00' + // ySuperScriptXOffset
           '\x01\xDF' + // ySuperScriptYOffset
           '\x00\x31' + // yStrikeOutSize
           '\x01\x02' + // yStrikeOutPosition
           '\x00\x00' + // sFamilyClass
           '\x00\x00\x06' +
           String.fromCharCode(properties.fixedPitch ? 0x09 : 0x00) +
           '\x00\x00\x00\x00\x00\x00' + // Panose
           string32(ulUnicodeRange1) + // ulUnicodeRange1 (Bits 0-31)
           string32(ulUnicodeRange2) + // ulUnicodeRange2 (Bits 32-63)
           string32(ulUnicodeRange3) + // ulUnicodeRange3 (Bits 64-95)
           string32(ulUnicodeRange4) + // ulUnicodeRange4 (Bits 96-127)
           '\x2A\x32\x31\x2A' + // achVendID
           string16(properties.italicAngle ? 1 : 0) + // fsSelection
           string16(firstCharIndex ||
                    properties.firstChar) + // usFirstCharIndex
           string16(lastCharIndex || properties.lastChar) +  // usLastCharIndex
           string16(typoAscent) + // sTypoAscender
           string16(typoDescent) + // sTypoDescender
           '\x00\x64' + // sTypoLineGap (7%-10% of the unitsPerEM value)
           string16(winAscent) + // usWinAscent
           string16(winDescent) + // usWinDescent
           '\x00\x00\x00\x00' + // ulCodePageRange1 (Bits 0-31)
           '\x00\x00\x00\x00' + // ulCodePageRange2 (Bits 32-63)
           string16(properties.xHeight) + // sxHeight
           string16(properties.capHeight) + // sCapHeight
           string16(0) + // usDefaultChar
           string16(firstCharIndex || properties.firstChar) + // usBreakChar
           '\x00\x03';  // usMaxContext
  };

  function createPostTable(properties) {
    var angle = Math.floor(properties.italicAngle * (Math.pow(2, 16)));
    return '\x00\x03\x00\x00' + // Version number
           string32(angle) + // italicAngle
           '\x00\x00' + // underlinePosition
           '\x00\x00' + // underlineThickness
           string32(properties.fixedPitch) + // isFixedPitch
           '\x00\x00\x00\x00' + // minMemType42
           '\x00\x00\x00\x00' + // maxMemType42
           '\x00\x00\x00\x00' + // minMemType1
           '\x00\x00\x00\x00';  // maxMemType1
  };

  function createNameTable(name) {
    var strings = [
      'Original licence',  // 0.Copyright
      name,                // 1.Font family
      'Unknown',           // 2.Font subfamily (font weight)
      'uniqueID',          // 3.Unique ID
      name,                // 4.Full font name
      'Version 0.11',      // 5.Version
      '',                  // 6.Postscript name
      'Unknown',           // 7.Trademark
      'Unknown',           // 8.Manufacturer
      'Unknown'            // 9.Designer
    ];

    // Mac want 1-byte per character strings while Windows want
    // 2-bytes per character, so duplicate the names table
    var stringsUnicode = [];
    for (var i = 0; i < strings.length; i++) {
      var str = strings[i];

      var strUnicode = '';
      for (var j = 0; j < str.length; j++)
        strUnicode += string16(str.charCodeAt(j));
      stringsUnicode.push(strUnicode);
    }

    var names = [strings, stringsUnicode];
    var platforms = ['\x00\x01', '\x00\x03'];
    var encodings = ['\x00\x00', '\x00\x01'];
    var languages = ['\x00\x00', '\x04\x09'];

    var namesRecordCount = strings.length * platforms.length;
    var nameTable =
      '\x00\x00' +                           // format
      string16(namesRecordCount) +           // Number of names Record
      string16(namesRecordCount * 12 + 6);   // Storage

    // Build the name records field
    var strOffset = 0;
    for (var i = 0; i < platforms.length; i++) {
      var strs = names[i];
      for (var j = 0; j < strs.length; j++) {
        var str = strs[j];
        var nameRecord =
          platforms[i] + // platform ID
          encodings[i] + // encoding ID
          languages[i] + // language ID
          string16(j) + // name ID
          string16(str.length) +
          string16(strOffset);
        nameTable += nameRecord;
        strOffset += str.length;
      }
    }

    nameTable += strings.join('') + stringsUnicode.join('');
    return nameTable;
  }

  constructor.prototype = {
    name: null,
    font: null,
    mimetype: null,
    encoding: null,

    checkAndRepair: function font_checkAndRepair(name, font, properties) {
      function readTableEntry(file) {
        var tag = file.getBytes(4);
        tag = String.fromCharCode(tag[0]) +
              String.fromCharCode(tag[1]) +
              String.fromCharCode(tag[2]) +
              String.fromCharCode(tag[3]);

        var checksum = int32(file.getBytes(4));
        var offset = int32(file.getBytes(4));
        var length = int32(file.getBytes(4));

        // Read the table associated data
        var previousPosition = file.pos;
        file.pos = file.start ? file.start : 0;
        file.skip(offset);
        var data = file.getBytes(length);
        file.pos = previousPosition;

        if (tag == 'head') {
          // clearing checksum adjustment
          data[8] = data[9] = data[10] = data[11] = 0;
          data[17] |= 0x20; //Set font optimized for cleartype flag
        }

        return {
          tag: tag,
          checksum: checksum,
          length: length,
          offset: offset,
          data: data
        };
      };

      function readOpenTypeHeader(ttf) {
        return {
          version: arrayToString(ttf.getBytes(4)),
          numTables: int16(ttf.getBytes(2)),
          searchRange: int16(ttf.getBytes(2)),
          entrySelector: int16(ttf.getBytes(2)),
          rangeShift: int16(ttf.getBytes(2))
        };
      };

      function replaceCMapTable(cmap, font, properties) {
        var start = (font.start ? font.start : 0) + cmap.offset;
        font.pos = start;

        var version = int16(font.getBytes(2));
        var numRecords = int16(font.getBytes(2));

        var records = [];
        for (var i = 0; i < numRecords; i++) {
          records.push({
            platformID: int16(font.getBytes(2)),
            encodingID: int16(font.getBytes(2)),
            offset: int32(font.getBytes(4))
          });
        }

        // Check that table are sorted by platformID then encodingID,
        records.sort(function fontReplaceCMapTableSort(a, b) {
          return ((a.platformID << 16) + a.encodingID) -
                 ((b.platformID << 16) + b.encodingID);
        });

        var tables = [records[0]];
        for (var i = 1; i < numRecords; i++) {
          // The sanitizer will drop the font if 2 tables have the same
          // platformID and the same encodingID, this will be correct for
          // most cases but if the font has been made for Mac it could
          // exist a few platformID: 1, encodingID: 0 but with a different
          // language field and that's correct. But the sanitizer does not
          // seem to support this case.
          var current = records[i];
          var previous = records[i - 1];
          if (((current.platformID << 16) + current.encodingID) <=
             ((previous.platformID << 16) + previous.encodingID))
                continue;
          tables.push(current);
        }

        var missing = numRecords - tables.length;
        if (missing) {
          numRecords = tables.length;
          var data = string16(version) + string16(numRecords);

          for (var i = 0; i < numRecords; i++) {
            var table = tables[i];
            data += string16(table.platformID) +
                    string16(table.encodingID) +
                    string32(table.offset);
          }

          for (var i = 0; i < data.length; i++)
            cmap.data[i] = data.charCodeAt(i);
        }

        var encoding = properties.encoding;
        for (var i = 0; i < numRecords; i++) {
          var table = tables[i];
          font.pos = start + table.offset;

          var format = int16(font.getBytes(2));
          var length = int16(font.getBytes(2));
          var language = int16(font.getBytes(2));

          if (format == 4) {
            return cmap.data;
          } else if (format == 0) {
            // Characters below 0x20 are controls characters that are hardcoded
            // into the platform so if some characters in the font are assigned
            // under this limit they will not be displayed so let's rewrite the
            // CMap.
            var glyphs = [];
            var deltas = [];
            for (var j = 0; j < 256; j++) {
              var index = font.getByte();
              if (index) {
                deltas.push(index);

                var unicode = j + kCmapGlyphOffset;
                var mapping = encoding[j] || {};
                mapping.unicode = unicode;
                encoding[j] = mapping;
                glyphs.push({ unicode: unicode });
              }
            }

            return cmap.data = createCMapTable(glyphs, deltas);
          } else if (format == 6) {
            // Format 6 is a 2-bytes dense mapping, which means the font data
            // lives glue together even if they are pretty far in the unicode
            // table. (This looks weird, so I can have missed something), this
            // works on Linux but seems to fails on Mac so let's rewrite the
            // cmap table to a 3-1-4 style
            var firstCode = int16(font.getBytes(2));
            var entryCount = int16(font.getBytes(2));

            var glyphs = [];
            var ids = [];
            for (var j = 0; j < firstCode + entryCount; j++) {
              var code = (j >= firstCode) ? int16(font.getBytes(2)) : j;
              glyphs.push({ unicode: j + kCmapGlyphOffset });
              ids.push(code);

              var mapping = encoding[j] || {};
              mapping.unicode = glyphs[j].unicode;
              encoding[j] = mapping;
            }
            return cmap.data = createCMapTable(glyphs, ids);
          }
        }
        return cmap.data;
      };

      function sanitizeMetrics(font, header, metrics, numGlyphs) {
        if (!header && !metrics)
          return;

        // The vhea/vmtx tables are not required, so it happens that
        // some fonts embed a vmtx table without a vhea table. In this
        // situation the sanitizer assume numOfLongVerMetrics = 1. As
        // a result it tries to read numGlyphs - 1 SHORT from the vmtx
        // table, and if it is not possible, the font is rejected.
        // So remove the vmtx table if there is no vhea table.
        if (!header && metrics) {
          metrics.data = null;
          return;
        }

        font.pos = (font.start ? font.start : 0) + header.offset;
        font.pos += header.length - 2;
        var numOfMetrics = int16(font.getBytes(2));

        var numOfSidebearings = numGlyphs - numOfMetrics;
        var numMissing = numOfSidebearings -
          ((hmtx.length - numOfMetrics * 4) >> 1);
        if (numMissing > 0) {
          font.pos = (font.start ? font.start : 0) + metrics.offset;
          var entries = '';
          for (var i = 0; i < hmtx.length; i++)
            entries += String.fromCharCode(font.getByte());
          for (var i = 0; i < numMissing; i++)
            entries += '\x00\x00';
          metrics.data = stringToArray(entries);
        }
      };

      function sanitizeGlyphLocations(loca, glyf, numGlyphs,
                                      isGlyphLocationsLong) {
        var itemSize, itemDecode, itemEncode;
        if (isGlyphLocationsLong) {
          itemSize = 4;
          itemDecode = function fontItemDecodeLong(data, offset) {
            return (data[offset] << 24) | (data[offset + 1] << 16) |
                   (data[offset + 2] << 8) | data[offset + 3];
          };
          itemEncode = function fontItemEncodeLong(data, offset, value) {
            data[offset] = (value >>> 24) & 0xFF;
            data[offset + 1] = (value >> 16) & 0xFF;
            data[offset + 2] = (value >> 8) & 0xFF;
            data[offset + 3] = value & 0xFF;
          };
        } else {
          itemSize = 2;
          itemDecode = function fontItemDecode(data, offset) {
            return (data[offset] << 9) | (data[offset + 1] << 1);
          };
          itemEncode = function fontItemEncode(data, offset, value) {
            data[offset] = (value >> 9) & 0xFF;
            data[offset + 1] = (value >> 1) & 0xFF;
          };
        }
        var locaData = loca.data;
        var startOffset = itemDecode(locaData, 0);
        var firstOffset = itemDecode(locaData, itemSize);
        if (firstOffset - startOffset < 12 || startOffset > 0) {
          // removing first glyph
          glyf.data = glyf.data.subarray(firstOffset);
          glyf.length -= firstOffset;

          itemEncode(locaData, 0, 0);
          var i, pos = itemSize;
          for (i = 1; i <= numGlyphs; ++i) {
            itemEncode(locaData, pos,
              itemDecode(locaData, pos) - firstOffset);
            pos += itemSize;
          }
        }
      }

      // Check that required tables are present
      var requiredTables = ['OS/2', 'cmap', 'head', 'hhea',
                             'hmtx', 'maxp', 'name', 'post'];

      var header = readOpenTypeHeader(font);
      var numTables = header.numTables;

      var cmap, maxp, hhea, hmtx, vhea, vmtx, head, loca, glyf;
      var tables = [];
      for (var i = 0; i < numTables; i++) {
        var table = readTableEntry(font);
        var index = requiredTables.indexOf(table.tag);
        if (index != -1) {
          if (table.tag == 'cmap')
            cmap = table;
          else if (table.tag == 'maxp')
            maxp = table;
          else if (table.tag == 'hhea')
            hhea = table;
          else if (table.tag == 'hmtx')
            hmtx = table;
          else if (table.tag == 'head')
            head = table;

          requiredTables.splice(index, 1);
        } else {
          if (table.tag == 'vmtx')
            vmtx = table;
          else if (table.tag == 'vhea')
            vhea = table;
          else if (table.tag == 'loca')
            loca = table;
          else if (table.tag == 'glyf')
            glyf = table;
        }
        tables.push(table);
      }

      var numTables = header.numTables + requiredTables.length;

      // header and new offsets. Table entry information is appended to the
      // end of file. The virtualOffset represents where to put the actual
      // data of a particular table;
      var ttf = {
        file: '',
        virtualOffset: numTables * (4 * 4)
      };

      // The new numbers of tables will be the last one plus the num
      // of missing tables
      createOpenTypeHeader(header.version, ttf, numTables);

      if (requiredTables.indexOf('OS/2') != -1) {
        // extract some more font properties from the OpenType head and
        // hhea tables; yMin and descent value are always negative
        var override = {
          unitsPerEm: int16([head.data[18], head.data[19]]),
          yMax: int16([head.data[42], head.data[43]]),
          yMin: int16([head.data[38], head.data[39]]) - 0x10000,
          ascent: int16([hhea.data[4], hhea.data[5]]),
          descent: int16([hhea.data[6], hhea.data[7]]) - 0x10000
        };

        tables.push({
          tag: 'OS/2',
          data: stringToArray(createOS2Table(properties, override))
        });
      }

      // Ensure the [h/v]mtx tables contains the advance width and
      // sidebearings information for numGlyphs in the maxp table
      font.pos = (font.start || 0) + maxp.offset;
      var version = int16(font.getBytes(4));
      var numGlyphs = int16(font.getBytes(2));

      sanitizeMetrics(font, hhea, hmtx, numGlyphs);
      sanitizeMetrics(font, vhea, vmtx, numGlyphs);

      if (head && loca && glyf) {
        var isGlyphLocationsLong = int16([head.data[50], head.data[51]]);
        sanitizeGlyphLocations(loca, glyf, numGlyphs, isGlyphLocationsLong);
      }

      // Sanitizer reduces the glyph advanceWidth to the maxAdvanceWidth
      // Sometimes it's 0. That needs to be fixed
      if (hhea.data[10] == 0 && hhea.data[11] == 0) {
        hhea.data[10] = 0xFF;
        hhea.data[11] = 0xFF;
      }

      // Replace the old CMAP table with a shiny new one
      if (properties.type == 'CIDFontType2') {
        // Type2 composite fonts map characters directly to glyphs so the cmap
        // table must be replaced.
        // canvas fillText will reencode some characters even if the font has a
        // glyph at that position - e.g. newline is converted to a space and
        // U+00AD (soft hyphen) is not drawn.
        // So, offset all the glyphs by 0xFF to avoid these cases and use
        // the encoding to map incoming characters to the new glyph positions
        if (!cmap) {
          cmap = {
            tag: 'cmap',
            data: null
          };
          tables.push(cmap);
        }

        var encoding = properties.encoding, i;
        if (!encoding[0]) {
          // the font is directly characters to glyphs with no encoding
          // so create an identity encoding
          var widths = properties.widths;
          for (i = 0; i < numGlyphs; i++) {
            var width = widths[i];
            encoding[i] = {
              unicode: i <= 0x1f || (i >= 127 && i <= 255) ?
                i + kCmapGlyphOffset : i,
              width: IsNum(width) ? width : properties.defaultWidth
            };
          }
        } else {
          for (i in encoding) {
            if (encoding.hasOwnProperty(i)) {
              var unicode = encoding[i].unicode;
              if (unicode <= 0x1f || (unicode >= 127 && unicode <= 255))
                encoding[i].unicode = unicode += kCmapGlyphOffset;
            }
          }
        }

        var glyphs = [];
        for (i = 1; i < numGlyphs; i++) {
          glyphs.push({
            unicode: i <= 0x1f || (i >= 127 && i <= 255) ?
              i + kCmapGlyphOffset : i
          });
        }
        cmap.data = createCMapTable(glyphs);
      } else {
        replaceCMapTable(cmap, font, properties);
      }

      // Rewrite the 'post' table if needed
      if (requiredTables.indexOf('post') != -1) {
        tables.push({
          tag: 'post',
          data: stringToArray(createPostTable(properties))
        });
      }

      // Rewrite the 'name' table if needed
      if (requiredTables.indexOf('name') != -1) {
        tables.push({
          tag: 'name',
          data: stringToArray(createNameTable(this.name))
        });
      }

      // Tables needs to be written by ascendant alphabetic order
      tables.sort(function tables_sort(a, b) {
        return (a.tag > b.tag) - (a.tag < b.tag);
      });

      // rewrite the tables but tweak offsets
      for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        var data = [];

        var tableData = table.data;
        for (var j = 0; j < tableData.length; j++)
          data.push(tableData[j]);
        createTableEntry(ttf, table.tag, data);
      }

      // Add the table datas
      for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        var tableData = table.data;
        ttf.file += arrayToString(tableData);

        // 4-byte aligned data
        while (ttf.file.length & 3)
          ttf.file += String.fromCharCode(0);
      }

      return stringToArray(ttf.file);
    },

    convert: function font_convert(fontName, font, properties) {
      function isFixedPitch(glyphs) {
        for (var i = 0; i < glyphs.length - 1; i++) {
          if (glyphs[i] != glyphs[i + 1])
            return false;
        }
        return true;
      }

      // The offsets object holds at the same time a representation of where
      // to write the table entry information about a table and another offset
      // representing the offset where to draw the actual data of a particular
      // table
      var kRequiredTablesCount = 9;

      var otf = {
        file: '',
        virtualOffset: 9 * (4 * 4)
      };

      createOpenTypeHeader('\x4F\x54\x54\x4F', otf, 9);

      var charstrings = font.charstrings;
      properties.fixedPitch = isFixedPitch(charstrings);

      var fields = {
        // PostScript Font Program
        'CFF ': font.data,

        // OS/2 and Windows Specific metrics
        'OS/2': stringToArray(createOS2Table(properties)),

        // Character to glyphs mapping
        'cmap': createCMapTable(charstrings.slice(), font.glyphIds),

        // Font header
        'head': (function fontFieldsHead() {
          return stringToArray(
              '\x00\x01\x00\x00' + // Version number
              '\x00\x00\x10\x00' + // fontRevision
              '\x00\x00\x00\x00' + // checksumAdjustement
              '\x5F\x0F\x3C\xF5' + // magicNumber
              '\x00\x00' + // Flags
              '\x03\xE8' + // unitsPerEM (defaulting to 1000)
              '\x00\x00\x00\x00\x9e\x0b\x7e\x27' + // creation date
              '\x00\x00\x00\x00\x9e\x0b\x7e\x27' + // modifification date
              '\x00\x00' + // xMin
              string16(properties.descent) + // yMin
              '\x0F\xFF' + // xMax
              string16(properties.ascent) + // yMax
              string16(properties.italicAngle ? 2 : 0) + // macStyle
              '\x00\x11' + // lowestRecPPEM
              '\x00\x00' + // fontDirectionHint
              '\x00\x00' + // indexToLocFormat
              '\x00\x00');  // glyphDataFormat
        })(),

        // Horizontal header
        'hhea': (function fontFieldsHhea() {
          return stringToArray(
              '\x00\x01\x00\x00' + // Version number
              string16(properties.ascent) + // Typographic Ascent
              string16(properties.descent) + // Typographic Descent
              '\x00\x00' + // Line Gap
              '\xFF\xFF' + // advanceWidthMax
              '\x00\x00' + // minLeftSidebearing
              '\x00\x00' + // minRightSidebearing
              '\x00\x00' + // xMaxExtent
              string16(properties.capHeight) + // caretSlopeRise
              string16(Math.tan(properties.italicAngle) *
                       properties.xHeight) + // caretSlopeRun
              '\x00\x00' + // caretOffset
              '\x00\x00' + // -reserved-
              '\x00\x00' + // -reserved-
              '\x00\x00' + // -reserved-
              '\x00\x00' + // -reserved-
              '\x00\x00' + // metricDataFormat
              string16(charstrings.length + 1)); // Number of HMetrics
        })(),

        // Horizontal metrics
        'hmtx': (function fontFieldsHmtx() {
          var hmtx = '\x00\x00\x00\x00'; // Fake .notdef
          for (var i = 0; i < charstrings.length; i++) {
            hmtx += string16(charstrings[i].width) + string16(0);
          }
          return stringToArray(hmtx);
        })(),

        // Maximum profile
        'maxp': (function fontFieldsMaxp() {
          return stringToArray(
              '\x00\x00\x50\x00' + // Version number
             string16(charstrings.length + 1)); // Num of glyphs
        })(),

        // Naming tables
        'name': stringToArray(createNameTable(fontName)),

        // PostScript informations
        'post': stringToArray(createPostTable(properties))
      };

      for (var field in fields)
        createTableEntry(otf, field, fields[field]);

      for (var field in fields) {
        var table = fields[field];
        otf.file += arrayToString(table);
      }

      return stringToArray(otf.file);
    },

    bindWorker: function font_bindWorker(data) {
      postMessage({
        action: 'font',
        data: {
          raw: data,
          fontName: this.loadedName,
          mimetype: this.mimetype
        }
      });
    },

    bindDOM: function font_bindDom(data) {
      var fontName = this.loadedName;

      // Add the font-face rule to the document
      var url = ('url(data:' + this.mimetype + ';base64,' +
                 window.btoa(data) + ');');
      var rule = "@font-face { font-family:'" + fontName + "';src:" + url + '}';
      var styleSheet = document.styleSheets[0];
      if (!styleSheet) {
        document.documentElement.firstChild.appendChild(
          document.createElement('style'));
        styleSheet = document.styleSheets[0];
      }
      styleSheet.insertRule(rule, styleSheet.cssRules.length);

      return rule;
    },

    charsToGlyphs: function fonts_chars2Glyphs(chars) {
      var charsCache = this.charsCache;
      var glyphs;

      // if we translated this string before, just grab it from the cache
      if (charsCache) {
        glyphs = charsCache[chars];
        if (glyphs)
          return glyphs;
      }

      // lazily create the translation cache
      if (!charsCache)
        charsCache = this.charsCache = Object.create(null);

      // translate the string using the font's encoding
      var encoding = this.encoding;
      if (!encoding)
        return chars;

      glyphs = [];

      if (this.composite) {
        // composite fonts have multi-byte strings convert the string from
        // single-byte to multi-byte
        // XXX assuming CIDFonts are two-byte - later need to extract the
        // correct byte encoding according to the PDF spec
        var length = chars.length - 1; // looping over two bytes at a time so
                                       // loop should never end on the last byte
        for (var i = 0; i < length; i++) {
          var charcode = int16([chars.charCodeAt(i++), chars.charCodeAt(i)]);
          var glyph = encoding[charcode];
          if ('undefined' == typeof(glyph)) {
            warn('Unencoded charcode ' + charcode);
            glyph = {
              unicode: charcode,
              width: this.defaultWidth
            };
          }
          glyphs.push(glyph);
          // placing null after each word break charcode (ASCII SPACE)
          if (charcode == 0x20)
            glyphs.push(null);
        }
      }
      else {
        for (var i = 0; i < chars.length; ++i) {
          var charcode = chars.charCodeAt(i);
          var glyph = encoding[charcode];
          if ('undefined' == typeof(glyph)) {
            warn('Unencoded charcode ' + charcode);
            glyph = {
              unicode: charcode,
              width: this.defaultWidth
            };
          }
          glyphs.push(glyph);
          if (charcode == 0x20)
            glyphs.push(null);
        }
      }

      // Enter the translated string into the cache
      return (charsCache[chars] = glyphs);
    }
  };

  return constructor;
})();

/*
 * Type1Parser encapsulate the needed code for parsing a Type1 font
 * program. Some of its logic depends on the Type2 charstrings
 * structure.
 */
var Type1Parser = function type1Parser() {
  /*
   * Decrypt a Sequence of Ciphertext Bytes to Produce the Original Sequence
   * of Plaintext Bytes. The function took a key as a parameter which can be
   * for decrypting the eexec block of for decoding charStrings.
   */
  var kEexecEncryptionKey = 55665;
  var kCharStringsEncryptionKey = 4330;

  function decrypt(stream, key, discardNumber) {
    var r = key, c1 = 52845, c2 = 22719;
    var decryptedString = [];

    var value = '';
    var count = stream.length;
    for (var i = 0; i < count; i++) {
      value = stream[i];
      decryptedString[i] = value ^ (r >> 8);
      r = ((value + r) * c1 + c2) & ((1 << 16) - 1);
    }
    return decryptedString.slice(discardNumber);
  }

  /*
   * CharStrings are encoded following the the CharString Encoding sequence
   * describe in Chapter 6 of the "Adobe Type1 Font Format" specification.
   * The value in a byte indicates a command, a number, or subsequent bytes
   * that are to be interpreted in a special way.
   *
   * CharString Number Encoding:
   *  A CharString byte containing the values from 32 through 255 inclusive
   *  indicate an integer. These values are decoded in four ranges.
   *
   * 1. A CharString byte containing a value, v, between 32 and 246 inclusive,
   * indicate the integer v - 139. Thus, the integer values from -107 through
   * 107 inclusive may be encoded in single byte.
   *
   * 2. A CharString byte containing a value, v, between 247 and 250 inclusive,
   * indicates an integer involving the next byte, w, according to the formula:
   * [(v - 247) x 256] + w + 108
   *
   * 3. A CharString byte containing a value, v, between 251 and 254 inclusive,
   * indicates an integer involving the next byte, w, according to the formula:
   * -[(v - 251) * 256] - w - 108
   *
   * 4. A CharString containing the value 255 indicates that the next 4 bytes
   * are a two complement signed integer. The first of these bytes contains the
   * highest order bits, the second byte contains the next higher order bits
   * and the fourth byte contain the lowest order bits.
   *
   *
   * CharString Command Encoding:
   *  CharStrings commands are encoded in 1 or 2 bytes.
   *
   *  Single byte commands are encoded in 1 byte that contains a value between
   *  0 and 31 inclusive.
   *  If a command byte contains the value 12, then the value in the next byte
   *  indicates a command. This "escape" mechanism allows many extra commands
   * to be encoded and this encoding technique helps to minimize the length of
   * the charStrings.
   */
  var charStringDictionary = {
    '1': 'hstem',
    '3': 'vstem',
    '4': 'vmoveto',
    '5': 'rlineto',
    '6': 'hlineto',
    '7': 'vlineto',
    '8': 'rrcurveto',

    // closepath is a Type1 command that do not take argument and is useless
    // in Type2 and it can simply be ignored.
    '9': null, // closepath

    '10': 'callsubr',

    // return is normally used inside sub-routines to tells to the execution
    // flow that it can be back to normal.
    // During the translation process Type1 charstrings will be flattened and
    // sub-routines will be embedded directly into the charstring directly, so
    // this can be ignored safely.
    '11': 'return',

    '12': {
      // dotsection is a Type1 command to specify some hinting feature for dots
      // that do not take a parameter and it can safely be ignored for Type2.
      '0': null, // dotsection

      // [vh]stem3 are Type1 only and Type2 supports [vh]stem with multiple
      // parameters, so instead of returning [vh]stem3 take a shortcut and
      // return [vhstem] instead.
      '1': 'vstem',
      '2': 'hstem',

      // Type1 only command with command not (yet) built-in ,throw an error
      '6': -1, // seac
      '7': -1, // sbw

      '11': 'sub',
      '12': 'div',

      // callothersubr is a mechanism to make calls on the postscript
      // interpreter, this is not supported by Type2 charstring but hopefully
      // most of the default commands can be ignored safely.
      '16': 'callothersubr',

      '17': 'pop',

      // setcurrentpoint sets the current point to x, y without performing a
      // moveto (this is a one shot positionning command). This is used only
      // with the return of an OtherSubrs call.
      // TODO Implement the OtherSubrs charstring embedding and replace this
      // call by a no-op, like 2 'pop' commands for example.
      '33': null // setcurrentpoint
    },
    '13': 'hsbw',
    '14': 'endchar',
    '21': 'rmoveto',
    '22': 'hmoveto',
    '30': 'vhcurveto',
    '31': 'hvcurveto'
  };

  var kEscapeCommand = 12;

  function decodeCharString(array) {
    var charstring = [];
    var lsb = 0;
    var width = 0;

    var value = '';
    var count = array.length;
    for (var i = 0; i < count; i++) {
      value = array[i];

      if (value < 32) {
        var command = null;
        if (value == kEscapeCommand) {
          var escape = array[++i];

          // TODO Clean this code
          if (escape == 16) {
            var index = charstring.pop();
            var argc = charstring.pop();
            for (var j = 0; j < argc; j++)
              charstring.push('drop');

            // If the flex mechanism is not used in a font program, Adobe
            // states that entries 0, 1 and 2 can simply be replaced by
            // {}, which means that we can simply ignore them.
            if (index < 3) {
              continue;
            }

            // This is the same things about hint replacement, if it is not used
            // entry 3 can be replaced by {3}
            // TODO support hint replacment
            if (index == 3) {
              charstring.push(3);
              i++;
              continue;
            }
          } else if (!kHintingEnabled && (value == 1 || value == 2)) {
            charstring.push('drop', 'drop', 'drop', 'drop', 'drop', 'drop');
            continue;
          }

          command = charStringDictionary['12'][escape];
        } else {
          // TODO Clean this code
          if (value == 13) { // hsbw
            if (charstring.length == 2) {
              lsb = charstring[0];
              width = charstring[1];
              charstring.splice(0, 1);
            } else if (charstring.length == 4 && charstring[3] == 'div') {
              lsb = charstring[0];
              width = charstring[1] / charstring[2];
              charstring.splice(0, 1);
            } else if (charstring.length == 4 && charstring[2] == 'div') {
              lsb = charstring[0] / charstring[1];
              width = charstring[3];
              charstring.splice(0, 3);
            } else {
              error('Unsupported hsbw format: ' + charstring);
            }

            charstring.push(lsb, 'hmoveto');
            continue;
          } else if (!kHintingEnabled && (value == 1 || value == 3)) {
            charstring.push('drop', 'drop');
            continue;
          }
          command = charStringDictionary[value];
        }

        // Some charstring commands are meaningless in Type2 and will return
        // a null, let's just ignored them
        if (!command && i < count) {
          continue;
        } else if (!command) {
          break;
        } else if (command == -1) {
          warn('Support for Type1 command ' + value +
                ' (' + escape + ') is not implemented in charstring: ' +
                charstring);
        }

        value = command;
      } else if (value <= 246) {
        value = value - 139;
      } else if (value <= 250) {
        value = ((value - 247) * 256) + array[++i] + 108;
      } else if (value <= 254) {
        value = -((value - 251) * 256) - array[++i] - 108;
      } else {
        value = (array[++i] & 0xff) << 24 | (array[++i] & 0xff) << 16 |
                (array[++i] & 0xff) << 8 | (array[++i] & 0xff) << 0;
      }

      charstring.push(value);
    }

    return { charstring: charstring, width: width, lsb: lsb };
  }

  /*
   * Returns an object containing a Subrs array and a CharStrings
   * array extracted from and eexec encrypted block of data
   */
  function readNumberArray(str, index) {
    var start = index;
    while (str[index++] != '[')
      start++;
    start++;

    var count = 0;
    while (str[index++] != ']')
      count++;

    var array = str.substr(start, count).split(' ');
    for (var i = 0; i < array.length; i++)
      array[i] = parseFloat(array[i] || 0);
    return array;
  }

  function readNumber(str, index) {
    while (str[index] == ' ')
      index++;

    var start = index;

    var count = 0;
    while (str[index++] != ' ')
      count++;

    return parseFloat(str.substr(start, count) || 0);
  }

  function isSeparator(c) {
    return c == ' ' || c == '\n' || c == '\x0d';
  }

  this.extractFontProgram = function t1_extractFontProgram(stream) {
    var eexec = decrypt(stream, kEexecEncryptionKey, 4);
    var eexecStr = '';
    for (var i = 0; i < eexec.length; i++)
      eexecStr += String.fromCharCode(eexec[i]);

    var glyphsSection = false, subrsSection = false;
    var program = {
      subrs: [],
      charstrings: [],
      properties: {
        'private': {
          'lenIV': 4
        }
      }
    };

    var glyph = '';
    var token = '';
    var length = 0;

    var c = '';
    var count = eexecStr.length;
    for (var i = 0; i < count; i++) {
      var getToken = function getToken() {
        while (i < count && isSeparator(eexecStr[i]))
          ++i;

        var token = '';
        while (i < count && !isSeparator(eexecStr[i]))
          token += eexecStr[i++];

        return token;
      };
      var c = eexecStr[i];

      if ((glyphsSection || subrsSection) &&
          (token == 'RD' || token == '-|')) {
        i++;
        var data = eexec.slice(i, i + length);
        var lenIV = program.properties.private['lenIV'];
        var encoded = decrypt(data, kCharStringsEncryptionKey, lenIV);
        var str = decodeCharString(encoded);

        if (glyphsSection) {
          program.charstrings.push({
            glyph: glyph,
            data: str.charstring,
            lsb: str.lsb,
            width: str.width
          });
        } else {
          program.subrs.push(str.charstring);
        }
        i += length;
        token = '';
      } else if (isSeparator(c)) {
        length = parseInt(token, 10);
        token = '';
      } else {
        token += c;
        if (!glyphsSection) {
          switch (token) {
            case '/CharString':
              glyphsSection = true;
              break;
            case '/Subrs':
              ++i;
              var num = parseInt(getToken(), 10);
              getToken(); // read in 'array'
              for (var j = 0; j < num; ++j) {
                var t = getToken(); // read in 'dup'
                if (t == 'ND' || t == '|-' || t == 'noaccess')
                  break;
                var index = parseInt(getToken(), 10);
                if (index > j)
                  j = index;
                var length = parseInt(getToken(), 10);
                getToken(); // read in 'RD'
                var data = eexec.slice(i + 1, i + 1 + length);
                var lenIV = program.properties.private['lenIV'];
                var encoded = decrypt(data, kCharStringsEncryptionKey, lenIV);
                var str = decodeCharString(encoded);
                i = i + 1 + length;
                t = getToken(); // read in 'NP'
                if (t == 'noaccess')
                  getToken(); // read in 'put'
                program.subrs[index] = str.charstring;
              }
              break;
            case '/BlueValues':
            case '/OtherBlues':
            case '/FamilyBlues':
            case '/FamilyOtherBlues':
            case '/StemSnapH':
            case '/StemSnapV':
              program.properties.private[token.substring(1)] =
                readNumberArray(eexecStr, i + 1);
              break;
            case '/StdHW':
            case '/StdVW':
              program.properties.private[token.substring(1)] =
                readNumberArray(eexecStr, i + 2)[0];
              break;
            case '/BlueShift':
            case '/lenIV':
            case '/BlueFuzz':
            case '/BlueScale':
            case '/LanguageGroup':
            case '/ExpansionFactor':
              program.properties.private[token.substring(1)] =
                readNumber(eexecStr, i + 1);
              break;
          }
        } else if (c == '/') {
          token = glyph = '';
          while ((c = eexecStr[++i]) != ' ')
            glyph += c;
        }
      }
    }

    return program;
  };

  this.extractFontHeader = function t1_extractFontHeader(stream, properties) {
    var headerString = '';
    for (var i = 0; i < stream.length; i++)
      headerString += String.fromCharCode(stream[i]);

    var token = '';
    var count = headerString.length;
    for (var i = 0; i < count; i++) {
      var getToken = function getToken() {
        var char = headerString[i];
        while (i < count && (isSeparator(char) || char == '/'))
          char = headerString[++i];

        var token = '';
        while (i < count && !(isSeparator(char) || char == '/')) {
          token += char;
          char = headerString[++i];
        }

        return token;
      };

      var c = headerString[i];
      if (isSeparator(c)) {
        switch (token) {
          case '/FontMatrix':
            var matrix = readNumberArray(headerString, i + 1);

            // The FontMatrix is in unitPerEm, so make it pixels
            for (var j = 0; j < matrix.length; j++)
              matrix[j] *= 1000;

            // Make the angle into the right direction
            matrix[2] *= -1;

            properties.textMatrix = matrix;
            break;
          case '/Encoding':
            var size = parseInt(getToken(), 10);
            getToken(); // read in 'array'

            for (var j = 0; j < size; j++) {
              var token = getToken();
              if (token == 'dup') {
                var index = parseInt(getToken(), 10);
                var glyph = getToken();

                if ('undefined' == typeof(properties.differences[index])) {
                  var mapping = properties.encoding[index] || {};
                  mapping.unicode = GlyphsUnicode[glyph] || index;
                  properties.glyphs[glyph] = properties.encoding[index] =
                                             mapping;
                }
                getToken(); // read the in 'put'
              }
            }
            break;
        }
        token = '';
      } else {
        token += c;
      }
    }
  };
};

/**
 * The CFF class takes a Type1 file and wrap it into a
 * 'Compact Font Format' which itself embed Type2 charstrings.
 */
var CFFStrings = [
  '.notdef', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent',
  'ampersand', 'quoteright', 'parenleft', 'parenright', 'asterisk', 'plus',
  'comma', 'hyphen', 'period', 'slash', 'zero', 'one', 'two', 'three', 'four',
  'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less',
  'equal', 'greater', 'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
  'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
  'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright', 'asciicircum',
  'underscore', 'quoteleft', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
  'z', 'braceleft', 'bar', 'braceright', 'asciitilde', 'exclamdown', 'cent',
  'sterling', 'fraction', 'yen', 'florin', 'section', 'currency',
  'quotesingle', 'quotedblleft', 'guillemotleft', 'guilsinglleft',
  'guilsinglright', 'fi', 'fl', 'endash', 'dagger', 'daggerdbl',
  'periodcentered', 'paragraph', 'bullet', 'quotesinglbase', 'quotedblbase',
  'quotedblright', 'guillemotright', 'ellipsis', 'perthousand', 'questiondown',
  'grave', 'acute', 'circumflex', 'tilde', 'macron', 'breve', 'dotaccent',
  'dieresis', 'ring', 'cedilla', 'hungarumlaut', 'ogonek', 'caron', 'emdash',
  'AE', 'ordfeminine', 'Lslash', 'Oslash', 'OE', 'ordmasculine', 'ae',
  'dotlessi', 'lslash', 'oslash', 'oe', 'germandbls', 'onesuperior',
  'logicalnot', 'mu', 'trademark', 'Eth', 'onehalf', 'plusminus', 'Thorn',
  'onequarter', 'divide', 'brokenbar', 'degree', 'thorn', 'threequarters',
  'twosuperior', 'registered', 'minus', 'eth', 'multiply', 'threesuperior',
  'copyright', 'Aacute', 'Acircumflex', 'Adieresis', 'Agrave', 'Aring',
  'Atilde', 'Ccedilla', 'Eacute', 'Ecircumflex', 'Edieresis', 'Egrave',
  'Iacute', 'Icircumflex', 'Idieresis', 'Igrave', 'Ntilde', 'Oacute',
  'Ocircumflex', 'Odieresis', 'Ograve', 'Otilde', 'Scaron', 'Uacute',
  'Ucircumflex', 'Udieresis', 'Ugrave', 'Yacute', 'Ydieresis', 'Zcaron',
  'aacute', 'acircumflex', 'adieresis', 'agrave', 'aring', 'atilde',
  'ccedilla', 'eacute', 'ecircumflex', 'edieresis', 'egrave', 'iacute',
  'icircumflex', 'idieresis', 'igrave', 'ntilde', 'oacute', 'ocircumflex',
  'odieresis', 'ograve', 'otilde', 'scaron', 'uacute', 'ucircumflex',
  'udieresis', 'ugrave', 'yacute', 'ydieresis', 'zcaron', 'exclamsmall',
  'Hungarumlautsmall', 'dollaroldstyle', 'dollarsuperior', 'ampersandsmall',
  'Acutesmall', 'parenleftsuperior', 'parenrightsuperior', '266 ff',
  'onedotenleader', 'zerooldstyle', 'oneoldstyle', 'twooldstyle',
  'threeoldstyle', 'fouroldstyle', 'fiveoldstyle', 'sixoldstyle',
  'sevenoldstyle', 'eightoldstyle', 'nineoldstyle', 'commasuperior',
  'threequartersemdash', 'periodsuperior', 'questionsmall', 'asuperior',
  'bsuperior', 'centsuperior', 'dsuperior', 'esuperior', 'isuperior',
  'lsuperior', 'msuperior', 'nsuperior', 'osuperior', 'rsuperior', 'ssuperior',
  'tsuperior', 'ff', 'ffi', 'ffl', 'parenleftinferior', 'parenrightinferior',
  'Circumflexsmall', 'hyphensuperior', 'Gravesmall', 'Asmall', 'Bsmall',
  'Csmall', 'Dsmall', 'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall',
  'Jsmall', 'Ksmall', 'Lsmall', 'Msmall', 'Nsmall', 'Osmall', 'Psmall',
  'Qsmall', 'Rsmall', 'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall',
  'Xsmall', 'Ysmall', 'Zsmall', 'colonmonetary', 'onefitted', 'rupiah',
  'Tildesmall', 'exclamdownsmall', 'centoldstyle', 'Lslashsmall',
  'Scaronsmall', 'Zcaronsmall', 'Dieresissmall', 'Brevesmall', 'Caronsmall',
  'Dotaccentsmall', 'Macronsmall', 'figuredash', 'hypheninferior',
  'Ogoneksmall', 'Ringsmall', 'Cedillasmall', 'questiondownsmall', 'oneeighth',
  'threeeighths', 'fiveeighths', 'seveneighths', 'onethird', 'twothirds',
  'zerosuperior', 'foursuperior', 'fivesuperior', 'sixsuperior',
  'sevensuperior', 'eightsuperior', 'ninesuperior', 'zeroinferior',
  'oneinferior', 'twoinferior', 'threeinferior', 'fourinferior',
  'fiveinferior', 'sixinferior', 'seveninferior', 'eightinferior',
  'nineinferior', 'centinferior', 'dollarinferior', 'periodinferior',
  'commainferior', 'Agravesmall', 'Aacutesmall', 'Acircumflexsmall',
  'Atildesmall', 'Adieresissmall', 'Aringsmall', 'AEsmall', 'Ccedillasmall',
  'Egravesmall', 'Eacutesmall', 'Ecircumflexsmall', 'Edieresissmall',
  'Igravesmall', 'Iacutesmall', 'Icircumflexsmall', 'Idieresissmall',
  'Ethsmall', 'Ntildesmall', 'Ogravesmall', 'Oacutesmall', 'Ocircumflexsmall',
  'Otildesmall', 'Odieresissmall', 'OEsmall', 'Oslashsmall', 'Ugravesmall',
  'Uacutesmall', 'Ucircumflexsmall', 'Udieresissmall', 'Yacutesmall',
  'Thornsmall', 'Ydieresissmall', '001.000', '001.001', '001.002', '001.003',
  'Black', 'Bold', 'Book', 'Light', 'Medium', 'Regular', 'Roman', 'Semibold'
];

var type1Parser = new Type1Parser();

var CFF = function cffCFF(name, file, properties) {
  // Get the data block containing glyphs and subrs informations
  var headerBlock = file.getBytes(properties.length1);
  type1Parser.extractFontHeader(headerBlock, properties);

  // Decrypt the data blocks and retrieve it's content
  var eexecBlock = file.getBytes(properties.length2);
  var data = type1Parser.extractFontProgram(eexecBlock);
  for (var info in data.properties)
    properties[info] = data.properties[info];

  var charstrings = this.getOrderedCharStrings(data.charstrings, properties);
  var type2Charstrings = this.getType2Charstrings(charstrings);
  var subrs = this.getType2Subrs(data.subrs);

  this.charstrings = charstrings;
  this.data = this.wrap(name, type2Charstrings, this.charstrings,
                        subrs, properties);
};

CFF.prototype = {
  createCFFIndexHeader: function cff_createCFFIndexHeader(objects, isByte) {
    // First 2 bytes contains the number of objects contained into this index
    var count = objects.length;

    // If there is no object, just create an array saying that with another
    // offset byte.
    if (count == 0)
      return '\x00\x00\x00';

    var data = String.fromCharCode((count >> 8) & 0xFF, count & 0xff);

    // Next byte contains the offset size use to reference object in the file
    // Actually we're using 0x04 to be sure to be able to store everything
    // without thinking of it while coding.
    data += '\x04';

    // Add another offset after this one because we need a new offset
    var relativeOffset = 1;
    for (var i = 0; i < count + 1; i++) {
      data += String.fromCharCode((relativeOffset >>> 24) & 0xFF,
                                  (relativeOffset >> 16) & 0xFF,
                                  (relativeOffset >> 8) & 0xFF,
                                  relativeOffset & 0xFF);

      if (objects[i])
        relativeOffset += objects[i].length;
    }

    for (var i = 0; i < count; i++) {
      for (var j = 0; j < objects[i].length; j++)
        data += isByte ? String.fromCharCode(objects[i][j] & 0xFF) :
                objects[i][j];
    }
    return data;
  },

  encodeNumber: function cff_encodeNumber(value) {
    if (value >= -32768 && value <= 32767) {
      return '\x1c' +
             String.fromCharCode((value >> 8) & 0xFF) +
             String.fromCharCode(value & 0xFF);
    } else if (value >= (-2147483648) && value <= 2147483647) {
      return '\x1d' +
             String.fromCharCode((value >> 24) & 0xFF) +
             String.fromCharCode((value >> 16) & 0xFF) +
             String.fromCharCode((value >> 8) & 0xFF) +
             String.fromCharCode(value & 0xFF);
    }
    error('Value: ' + value + ' is not allowed');
    return null;
  },

  getOrderedCharStrings: function cff_getOrderedCharStrings(glyphs,
                                                            properties) {
    var charstrings = [];
    var missings = [];

    for (var i = 0; i < glyphs.length; i++) {
      var glyph = glyphs[i];
      var mapping = properties.glyphs[glyph.glyph];
      if (!mapping) {
        if (glyph.glyph != '.notdef')
          missings.push(glyph.glyph);
      } else {
        charstrings.push({
          glyph: glyph.glyph,
          unicode: mapping.unicode,
          charstring: glyph.data,
          width: glyph.width,
          lsb: glyph.lsb
        });
      }
    }

    if (missings.length)
      warn(missings + ' does not have unicode in the glyphs dictionary');

    charstrings.sort(function charstrings_sort(a, b) {
      return a.unicode - b.unicode;
    });
    return charstrings;
  },

  getType2Charstrings: function cff_getType2Charstrings(type1Charstrings) {
    var type2Charstrings = [];
    var count = type1Charstrings.length;
    for (var i = 0; i < count; i++) {
      var charstring = type1Charstrings[i].charstring;
      type2Charstrings.push(this.flattenCharstring(charstring.slice(),
                                                   this.commandsMap));
    }
    return type2Charstrings;
  },

  getType2Subrs: function cff_getType2Subrs(type1Subrs) {
    var bias = 0;
    var count = type1Subrs.length;
    if (count < 1240)
      bias = 107;
    else if (count < 33900)
      bias = 1131;
    else
      bias = 32768;

    // Add a bunch of empty subrs to deal with the Type2 bias
    var type2Subrs = [];
    for (var i = 0; i < bias; i++)
      type2Subrs.push([0x0B]);

    for (var i = 0; i < count; i++) {
      var subr = type1Subrs[i];
      if (!subr)
        subr = [0x0B];

      type2Subrs.push(this.flattenCharstring(subr, this.commandsMap));
    }

    return type2Subrs;
  },

  /*
   * Flatten the commands by interpreting the postscript code and replacing
   * every 'callsubr', 'callothersubr' by the real commands.
   */
  commandsMap: {
    'hstem': 1,
    'vstem': 3,
    'vmoveto': 4,
    'rlineto': 5,
    'hlineto': 6,
    'vlineto': 7,
    'rrcurveto': 8,
    'callsubr': 10,
    'return': 11,
    'sub': [12, 11],
    'div': [12, 12],
    'pop': [1, 12, 18],
    'drop' : [12, 18],
    'endchar': 14,
    'rmoveto': 21,
    'hmoveto': 22,
    'vhcurveto': 30,
    'hvcurveto': 31
  },

  flattenCharstring: function flattenCharstring(charstring, map) {
    for (var i = 0; i < charstring.length; i++) {
      var command = charstring[i];
      if (command.charAt) {
        var cmd = map[command];
        assert(cmd, 'Unknow command: ' + command);

        if (IsArray(cmd))
          charstring.splice(i++, 1, cmd[0], cmd[1]);
        else
          charstring[i] = cmd;
      } else {
        // Type1 charstring use a division for number above 32000
        if (command > 32000) {
          var divisor = charstring[i + 1];
          command /= divisor;
          charstring.splice(i, 3, 28, command >> 8, command & 0xff);
        } else {
          charstring.splice(i, 1, 28, command >> 8, command & 0xff);
        }
        i += 2;
      }
    }
    return charstring;
  },

  wrap: function wrap(name, glyphs, charstrings, subrs, properties) {
    var fields = {
      // major version, minor version, header size, offset size
      'header': '\x01\x00\x04\x04',

      'names': this.createCFFIndexHeader([name]),

      'topDict': (function topDict(self) {
        return function cffWrapTopDict() {
          var header = '\x00\x01\x01\x01';
          var dict =
              '\xf8\x1b\x00' + // version
              '\xf8\x1c\x01' + // Notice
              '\xf8\x1d\x02' + // FullName
              '\xf8\x1e\x03' + // FamilyName
              '\xf8\x1f\x04' +  // Weight
              '\x1c\x00\x00\x10'; // Encoding

          var boundingBox = properties.bbox;
          for (var i = 0; i < boundingBox.length; i++)
            dict += self.encodeNumber(boundingBox[i]);
          dict += '\x05'; // FontBBox;

          var offset = fields.header.length +
                       fields.names.length +
                       (header.length + 1) +
                       (dict.length + (4 + 4)) +
                       fields.strings.length +
                       fields.globalSubrs.length;

          // If the offset if over 32767, encodeNumber is going to return
          // 5 bytes to encode the position instead of 3.
          if ((offset + fields.charstrings.length) > 32767) {
            offset += 9;
          } else {
            offset += 7;
          }

          dict += self.encodeNumber(offset) + '\x0f'; // Charset

          offset = offset + (glyphs.length * 2) + 1;
          dict += self.encodeNumber(offset) + '\x11'; // Charstrings

          offset = offset + fields.charstrings.length;
          dict += self.encodeNumber(fields.private.length);
          dict += self.encodeNumber(offset) + '\x12'; // Private

          return header + String.fromCharCode(dict.length + 1) + dict;
        };
      })(this),

      'strings': (function strings(self) {
        var strings = [
          'Version 0.11',         // Version
          'See original notice',  // Notice
          name,                   // FullName
          name,                   // FamilyName
          'Medium'                // Weight
        ];
        return self.createCFFIndexHeader(strings);
      })(this),

      'globalSubrs': this.createCFFIndexHeader([]),

      'charset': (function charset(self) {
        var charsetString = '\x00'; // Encoding

        var count = glyphs.length;
        for (var i = 0; i < count; i++) {
          var index = CFFStrings.indexOf(charstrings[i].glyph);
          // Some characters like asterikmath && circlecopyrt are
          // missing from the original strings, for the moment let's
          // map them to .notdef and see later if it cause any
          // problems
          if (index == -1)
            index = 0;

          charsetString += String.fromCharCode(index >> 8, index & 0xff);
        }
        return charsetString;
      })(this),

      'charstrings': this.createCFFIndexHeader([[0x8B, 0x0E]].concat(glyphs),
                                               true),

      'private': (function cffWrapPrivate(self) {
        var data =
            '\x8b\x14' + // defaultWidth
            '\x8b\x15';  // nominalWidth
        var fieldMap = {
          BlueValues: '\x06',
          OtherBlues: '\x07',
          FamilyBlues: '\x08',
          FamilyOtherBlues: '\x09',
          StemSnapH: '\x0c\x0c',
          StemSnapV: '\x0c\x0d',
          BlueShift: '\x0c\x0a',
          BlueFuzz: '\x0c\x0b',
          BlueScale: '\x0c\x09',
          LanguageGroup: '\x0c\x11',
          ExpansionFactor: '\x0c\x18'
        };
        for (var field in fieldMap) {
          if (!properties.private.hasOwnProperty(field))
            continue;
          var value = properties.private[field];

          if (IsArray(value)) {
            data += self.encodeNumber(value[0]);
            for (var i = 1; i < value.length; i++)
              data += self.encodeNumber(value[i] - value[i - 1]);
          } else {
            data += self.encodeNumber(value);
          }
          data += fieldMap[field];
        }

        data += self.encodeNumber(data.length + 4) + '\x13'; // Subrs offset

        return data;
      })(this),

      'localSubrs': this.createCFFIndexHeader(subrs, true)
    };
    fields.topDict = fields.topDict();


    var cff = [];
    for (var index in fields) {
      var field = fields[index];
      for (var i = 0; i < field.length; i++)
        cff.push(field.charCodeAt(i));
    }

    return cff;
  }
};

var Type2CFF = (function type2CFF() {
  // TODO: replace parsing code with the Type2Parser in font_utils.js
  function constructor(file, properties) {
    var bytes = file.getBytes();
    this.bytes = bytes;
    this.properties = properties;

    this.data = this.parse();
  }

  constructor.prototype = {
    parse: function cff_parse() {
      var header = this.parseHeader();
      var properties = this.properties;
      var nameIndex = this.parseIndex(header.endPos);

      var dictIndex = this.parseIndex(nameIndex.endPos);
      if (dictIndex.length != 1)
        error('CFF contains more than 1 font');

      var stringIndex = this.parseIndex(dictIndex.endPos);
      var gsubrIndex = this.parseIndex(stringIndex.endPos);

      var strings = this.getStrings(stringIndex);

      var baseDict = this.parseDict(dictIndex.get(0).data);
      var topDict = this.getTopDict(baseDict, strings);

      var bytes = this.bytes;

      var privateDict = {};
      var privateInfo = topDict.Private;
      if (privateInfo) {
        var privOffset = privateInfo[1], privLength = privateInfo[0];
        var privBytes = bytes.subarray(privOffset, privOffset + privLength);
        baseDict = this.parseDict(privBytes);
        privateDict = this.getPrivDict(baseDict, strings);
      } else {
        privateDict.defaultWidthX = properties.defaultWidth;
      }

      var charStrings = this.parseIndex(topDict.CharStrings);
      var charset = this.parseCharsets(topDict.charset,
                                       charStrings.length, strings);
      var hasSupplement = this.parseEncoding(topDict.Encoding, properties,
                                             strings, charset);

      // The font sanitizer does not support CFF encoding with a
      // supplement, since the encoding is not really use to map
      // between gid to glyph, let's overwrite what is declared in
      // the top dictionary to let the sanitizer think the font use
      // StandardEncoding, that's a lie but that's ok.
      if (hasSupplement)
        bytes[topDict.Encoding] = 0;

      // The CFF specification state that the 'dotsection' command
      // (12, 0) is deprecated and treated as a no-op, but all Type2
      // charstrings processors should support them. Unfortunately
      // the font sanitizer don't. As a workaround the sequence (12, 0)
      // is replaced by a useless (0, hmoveto).
      var count = charStrings.length;
      for (var i = 0; i < count; i++) {
        var charstring = charStrings.get(i);

        var start = charstring.start;
        var data = charstring.data;
        var length = data.length;
        for (var j = 0; j <= length; j) {
          var value = data[j++];
          if (value == 12 && data[j++] == 0) {
              bytes[start + j - 2] = 139;
              bytes[start + j - 1] = 22;
          } else if (value === 28) {
            j += 2;
          } else if (value >= 247 && value <= 254) {
            j++;
          } else if (value == 255) {
            j += 4;
          }
        }
      }

      // charstrings contains info about glyphs (one element per glyph
      // containing mappings for {unicode, width})
      var charstrings = this.getCharStrings(charset, charStrings,
                                            privateDict, this.properties);

      // create the mapping between charstring and glyph id
      var glyphIds = [];
      for (var i = 0; i < charstrings.length; i++)
        glyphIds.push(charstrings[i].gid);

      this.charstrings = charstrings;
      this.glyphIds = glyphIds;

      var data = [];
      for (var i = 0, ii = bytes.length; i < ii; ++i)
        data.push(bytes[i]);
      return data;
    },

    getCharStrings: function cff_charstrings(charsets, charStrings,
                                             privateDict, properties) {
      var defaultWidth = privateDict['defaultWidthX'];
      var charstrings = [];
      var differences = properties.differences;
      var index = 0;
      for (var i = 1; i < charsets.length; i++) {
        var code = -1;
        var glyph = charsets[i];
        for (var j = 0; j < differences.length; j++) {
          if (differences[j] == glyph) {
            index = j;
            code = differences.indexOf(glyph);
            break;
          }
        }

        var mapping = properties.glyphs[glyph] || {};
        if (code == -1)
          index = code = mapping.unicode || index;

        if (code <= 0x1f || (code >= 127 && code <= 255))
          code += kCmapGlyphOffset;

        var width = mapping.width;
        properties.glyphs[glyph] = properties.encoding[index] = {
          unicode: code,
          width: IsNum(width) ? width : defaultWidth
        };

        charstrings.push({
          unicode: code,
          width: width,
          gid: i
        });
        index++;
      }

      // sort the array by the unicode value
      charstrings.sort(function type2CFFGetCharStringsSort(a, b) {
        return a.unicode - b.unicode;
      });
      return charstrings;
    },

    parseEncoding: function cff_parseencoding(pos, properties, strings,
                                              charset) {
      var encoding = {};
      var bytes = this.bytes;

      function readSupplement() {
        var supplementsCount = bytes[pos++];
        for (var i = 0; i < supplementsCount; i++) {
          var code = bytes[pos++];
          var sid = (bytes[pos++] << 8) + (bytes[pos++] & 0xff);
          encoding[code] = properties.differences.indexOf(strings[sid]);
        }
      }

      if (pos == 0 || pos == 1) {
        var gid = 1;
        var baseEncoding = pos ? Encodings.ExpertEncoding.slice() :
                                 Encodings.StandardEncoding.slice();
        for (var i = 0; i < charset.length; i++) {
          var index = baseEncoding.indexOf(charset[i]);
          if (index != -1)
            encoding[index] = gid++;
        }
      } else {
        var format = bytes[pos++];
        switch (format & 0x7f) {
          case 0:
            var glyphsCount = bytes[pos++];
            for (var i = 1; i <= glyphsCount; i++)
              encoding[bytes[pos++]] = i;

            if (format & 0x80) {
              readSupplement();
              return true;
            }
            break;

          case 1:
            var rangesCount = bytes[pos++];
            var gid = 1;
            for (var i = 0; i < rangesCount; i++) {
              var start = bytes[pos++];
              var count = bytes[pos++];
              for (var j = start; j <= start + count; j++)
                encoding[j] = gid++;
            }

            if (format & 0x80) {
              readSupplement();
              return true;
            }
            break;

          default:
            error('Unknow encoding format: ' + format + ' in CFF');
            break;
        }
      }
      return false;
    },

    parseCharsets: function cff_parsecharsets(pos, length, strings) {
      if (pos == 0) {
        return ISOAdobeCharset.slice();
      } else if (pos == 1) {
        return ExpertCharset.slice();
      } else if (pos == 2) {
        return ExpertSubsetCharset.slice();
      }

      var bytes = this.bytes;
      var format = bytes[pos++];
      var charset = ['.notdef'];

      // subtract 1 for the .notdef glyph
      length -= 1;

      switch (format) {
        case 0:
          for (var i = 0; i < length; i++) {
            var sid = (bytes[pos++] << 8) | bytes[pos++];
            charset.push(strings[sid]);
          }
          break;
        case 1:
          while (charset.length <= length) {
            var sid = (bytes[pos++] << 8) | bytes[pos++];
            var count = bytes[pos++];
            for (var i = 0; i <= count; i++)
              charset.push(strings[sid++]);
          }
          break;
        case 2:
          while (charset.length <= length) {
            var sid = (bytes[pos++] << 8) | bytes[pos++];
            var count = (bytes[pos++] << 8) | bytes[pos++];
            for (var i = 0; i <= count; i++)
              charset.push(strings[sid++]);
          }
          break;
        default:
          error('Unknown charset format');
      }
      return charset;
    },
    getPrivDict: function cff_getprivdict(baseDict, strings) {
      var dict = {};

      // default values
      dict['defaultWidthX'] = 0;
      dict['nominalWidthX'] = 0;

      for (var i = 0, ii = baseDict.length; i < ii; ++i) {
        var pair = baseDict[i];
        var key = pair[0];
        var value = pair[1];
        switch (key) {
          case 20:
            dict['defaultWidthX'] = value[0];
          case 21:
            dict['nominalWidthX'] = value[0];
          default:
            TODO('interpret top dict key: ' + key);
        }
      }
      return dict;
    },
    getTopDict: function cff_gettopdict(baseDict, strings) {
      var dict = {};

      // default values
      dict['Encoding'] = 0;
      dict['charset'] = 0;

      for (var i = 0, ii = baseDict.length; i < ii; ++i) {
        var pair = baseDict[i];
        var key = pair[0];
        var value = pair[1];
        switch (key) {
          case 1:
            dict['Notice'] = strings[value[0]];
            break;
          case 4:
            dict['Weight'] = strings[value[0]];
            break;
          case 3094:
            dict['BaseFontName'] = strings[value[0]];
            break;
          case 5:
            dict['FontBBox'] = value;
            break;
          case 13:
            dict['UniqueID'] = value[0];
            break;
          case 15:
            dict['charset'] = value[0];
            break;
          case 16:
            dict['Encoding'] = value[0];
            break;
          case 17:
            dict['CharStrings'] = value[0];
            break;
          case 18:
            dict['Private'] = value;
            break;
          default:
            TODO('interpret top dict key');
        }
      }
      return dict;
    },
    getStrings: function cff_getStrings(stringIndex) {
      function bytesToString(bytesArray) {
        var str = '';
        for (var i = 0, length = bytesArray.length; i < length; i++)
          str += String.fromCharCode(bytesArray[i]);
        return str;
      }

      var stringArray = [];
      for (var i = 0, length = CFFStrings.length; i < length; i++)
        stringArray.push(CFFStrings[i]);

      for (var i = 0, length = stringIndex.length; i < length; i++)
        stringArray.push(bytesToString(stringIndex.get(i).data));

      return stringArray;
    },
    parseHeader: function cff_parseHeader() {
      var bytes = this.bytes;
      var offset = 0;

      while (bytes[offset] != 1)
        ++offset;

      if (offset != 0) {
        warning('cff data is shifted');
        bytes = bytes.subarray(offset);
        this.bytes = bytes;
      }

      return {
        endPos: bytes[2],
        offsetSize: bytes[3]
      };
    },
    parseDict: function cff_parseDict(dict) {
      var pos = 0;

      function parseOperand() {
        var value = dict[pos++];
        if (value === 30) {
          return parseFloatOperand(pos);
        } else if (value === 28) {
          value = dict[pos++];
          value = (value << 8) | dict[pos++];
          return value;
        } else if (value === 29) {
          value = dict[pos++];
          value = (value << 8) | dict[pos++];
          value = (value << 8) | dict[pos++];
          value = (value << 8) | dict[pos++];
          return value;
        } else if (value <= 246) {
          return value - 139;
        } else if (value <= 250) {
          return ((value - 247) * 256) + dict[pos++] + 108;
        } else if (value <= 254) {
          return -((value - 251) * 256) - dict[pos++] - 108;
        } else {
          error('255 is not a valid DICT command');
        }
        return -1;
      }

      function parseFloatOperand() {
        var str = '';
        var eof = 15;
        var lookup = ['0', '1', '2', '3', '4', '5', '6', '7', '8',
            '9', '.', 'E', 'E-', null, '-'];
        var length = dict.length;
        while (pos < length) {
          var b = dict[pos++];
          var b1 = b >> 4;
          var b2 = b & 15;

          if (b1 == eof)
            break;
          str += lookup[b1];

          if (b2 == eof)
            break;
          str += lookup[b2];
        }
        return parseFloat(str);
      }

      var operands = [];
      var entries = [];

      var pos = 0;
      var end = dict.length;
      while (pos < end) {
        var b = dict[pos];
        if (b <= 21) {
          if (b === 12) {
            ++pos;
            var b = (b << 8) | dict[pos];
          }
          entries.push([b, operands]);
          operands = [];
          ++pos;
        } else {
          operands.push(parseOperand());
        }
      }
      return entries;
    },
    parseIndex: function cff_parseIndex(pos) {
      var bytes = this.bytes;
      var count = bytes[pos++] << 8 | bytes[pos++];
      var offsets = [];
      var end = pos;

      if (count != 0) {
        var offsetSize = bytes[pos++];
        // add 1 for offset to determine size of last object
        var startPos = pos + ((count + 1) * offsetSize) - 1;

        for (var i = 0, ii = count + 1; i < ii; ++i) {
          var offset = 0;
          for (var j = 0; j < offsetSize; ++j) {
            offset <<= 8;
            offset += bytes[pos++];
          }
          offsets.push(startPos + offset);
        }
        end = offsets[count];
      }

      return {
        get: function index_get(index) {
          if (index >= count)
            return null;

          var start = offsets[index];
          var end = offsets[index + 1];
          return {
            start: start,
            end: end,
            data: bytes.subarray(start, end)
          };
        },
        length: count,
        endPos: end
      };
    }
  };

  return constructor;
})();
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var GlyphsUnicode = {
  A: 0x0041,
  AE: 0x00C6,
  AEacute: 0x01FC,
  AEmacron: 0x01E2,
  AEsmall: 0xF7E6,
  Aacute: 0x00C1,
  Aacutesmall: 0xF7E1,
  Abreve: 0x0102,
  Abreveacute: 0x1EAE,
  Abrevecyrillic: 0x04D0,
  Abrevedotbelow: 0x1EB6,
  Abrevegrave: 0x1EB0,
  Abrevehookabove: 0x1EB2,
  Abrevetilde: 0x1EB4,
  Acaron: 0x01CD,
  Acircle: 0x24B6,
  Acircumflex: 0x00C2,
  Acircumflexacute: 0x1EA4,
  Acircumflexdotbelow: 0x1EAC,
  Acircumflexgrave: 0x1EA6,
  Acircumflexhookabove: 0x1EA8,
  Acircumflexsmall: 0xF7E2,
  Acircumflextilde: 0x1EAA,
  Acute: 0xF6C9,
  Acutesmall: 0xF7B4,
  Acyrillic: 0x0410,
  Adblgrave: 0x0200,
  Adieresis: 0x00C4,
  Adieresiscyrillic: 0x04D2,
  Adieresismacron: 0x01DE,
  Adieresissmall: 0xF7E4,
  Adotbelow: 0x1EA0,
  Adotmacron: 0x01E0,
  Agrave: 0x00C0,
  Agravesmall: 0xF7E0,
  Ahookabove: 0x1EA2,
  Aiecyrillic: 0x04D4,
  Ainvertedbreve: 0x0202,
  Alpha: 0x0391,
  Alphatonos: 0x0386,
  Amacron: 0x0100,
  Amonospace: 0xFF21,
  Aogonek: 0x0104,
  Aring: 0x00C5,
  Aringacute: 0x01FA,
  Aringbelow: 0x1E00,
  Aringsmall: 0xF7E5,
  Asmall: 0xF761,
  Atilde: 0x00C3,
  Atildesmall: 0xF7E3,
  Aybarmenian: 0x0531,
  B: 0x0042,
  Bcircle: 0x24B7,
  Bdotaccent: 0x1E02,
  Bdotbelow: 0x1E04,
  Becyrillic: 0x0411,
  Benarmenian: 0x0532,
  Beta: 0x0392,
  Bhook: 0x0181,
  Blinebelow: 0x1E06,
  Bmonospace: 0xFF22,
  Brevesmall: 0xF6F4,
  Bsmall: 0xF762,
  Btopbar: 0x0182,
  C: 0x0043,
  Caarmenian: 0x053E,
  Cacute: 0x0106,
  Caron: 0xF6CA,
  Caronsmall: 0xF6F5,
  Ccaron: 0x010C,
  Ccedilla: 0x00C7,
  Ccedillaacute: 0x1E08,
  Ccedillasmall: 0xF7E7,
  Ccircle: 0x24B8,
  Ccircumflex: 0x0108,
  Cdot: 0x010A,
  Cdotaccent: 0x010A,
  Cedillasmall: 0xF7B8,
  Chaarmenian: 0x0549,
  Cheabkhasiancyrillic: 0x04BC,
  Checyrillic: 0x0427,
  Chedescenderabkhasiancyrillic: 0x04BE,
  Chedescendercyrillic: 0x04B6,
  Chedieresiscyrillic: 0x04F4,
  Cheharmenian: 0x0543,
  Chekhakassiancyrillic: 0x04CB,
  Cheverticalstrokecyrillic: 0x04B8,
  Chi: 0x03A7,
  Chook: 0x0187,
  Circumflexsmall: 0xF6F6,
  Cmonospace: 0xFF23,
  Coarmenian: 0x0551,
  Csmall: 0xF763,
  D: 0x0044,
  DZ: 0x01F1,
  DZcaron: 0x01C4,
  Daarmenian: 0x0534,
  Dafrican: 0x0189,
  Dcaron: 0x010E,
  Dcedilla: 0x1E10,
  Dcircle: 0x24B9,
  Dcircumflexbelow: 0x1E12,
  Dcroat: 0x0110,
  Ddotaccent: 0x1E0A,
  Ddotbelow: 0x1E0C,
  Decyrillic: 0x0414,
  Deicoptic: 0x03EE,
  Delta: 0x2206,
  Deltagreek: 0x0394,
  Dhook: 0x018A,
  Dieresis: 0xF6CB,
  DieresisAcute: 0xF6CC,
  DieresisGrave: 0xF6CD,
  Dieresissmall: 0xF7A8,
  Digammagreek: 0x03DC,
  Djecyrillic: 0x0402,
  Dlinebelow: 0x1E0E,
  Dmonospace: 0xFF24,
  Dotaccentsmall: 0xF6F7,
  Dslash: 0x0110,
  Dsmall: 0xF764,
  Dtopbar: 0x018B,
  Dz: 0x01F2,
  Dzcaron: 0x01C5,
  Dzeabkhasiancyrillic: 0x04E0,
  Dzecyrillic: 0x0405,
  Dzhecyrillic: 0x040F,
  E: 0x0045,
  Eacute: 0x00C9,
  Eacutesmall: 0xF7E9,
  Ebreve: 0x0114,
  Ecaron: 0x011A,
  Ecedillabreve: 0x1E1C,
  Echarmenian: 0x0535,
  Ecircle: 0x24BA,
  Ecircumflex: 0x00CA,
  Ecircumflexacute: 0x1EBE,
  Ecircumflexbelow: 0x1E18,
  Ecircumflexdotbelow: 0x1EC6,
  Ecircumflexgrave: 0x1EC0,
  Ecircumflexhookabove: 0x1EC2,
  Ecircumflexsmall: 0xF7EA,
  Ecircumflextilde: 0x1EC4,
  Ecyrillic: 0x0404,
  Edblgrave: 0x0204,
  Edieresis: 0x00CB,
  Edieresissmall: 0xF7EB,
  Edot: 0x0116,
  Edotaccent: 0x0116,
  Edotbelow: 0x1EB8,
  Efcyrillic: 0x0424,
  Egrave: 0x00C8,
  Egravesmall: 0xF7E8,
  Eharmenian: 0x0537,
  Ehookabove: 0x1EBA,
  Eightroman: 0x2167,
  Einvertedbreve: 0x0206,
  Eiotifiedcyrillic: 0x0464,
  Elcyrillic: 0x041B,
  Elevenroman: 0x216A,
  Emacron: 0x0112,
  Emacronacute: 0x1E16,
  Emacrongrave: 0x1E14,
  Emcyrillic: 0x041C,
  Emonospace: 0xFF25,
  Encyrillic: 0x041D,
  Endescendercyrillic: 0x04A2,
  Eng: 0x014A,
  Enghecyrillic: 0x04A4,
  Enhookcyrillic: 0x04C7,
  Eogonek: 0x0118,
  Eopen: 0x0190,
  Epsilon: 0x0395,
  Epsilontonos: 0x0388,
  Ercyrillic: 0x0420,
  Ereversed: 0x018E,
  Ereversedcyrillic: 0x042D,
  Escyrillic: 0x0421,
  Esdescendercyrillic: 0x04AA,
  Esh: 0x01A9,
  Esmall: 0xF765,
  Eta: 0x0397,
  Etarmenian: 0x0538,
  Etatonos: 0x0389,
  Eth: 0x00D0,
  Ethsmall: 0xF7F0,
  Etilde: 0x1EBC,
  Etildebelow: 0x1E1A,
  Euro: 0x20AC,
  Ezh: 0x01B7,
  Ezhcaron: 0x01EE,
  Ezhreversed: 0x01B8,
  F: 0x0046,
  Fcircle: 0x24BB,
  Fdotaccent: 0x1E1E,
  Feharmenian: 0x0556,
  Feicoptic: 0x03E4,
  Fhook: 0x0191,
  Fitacyrillic: 0x0472,
  Fiveroman: 0x2164,
  Fmonospace: 0xFF26,
  Fourroman: 0x2163,
  Fsmall: 0xF766,
  G: 0x0047,
  GBsquare: 0x3387,
  Gacute: 0x01F4,
  Gamma: 0x0393,
  Gammaafrican: 0x0194,
  Gangiacoptic: 0x03EA,
  Gbreve: 0x011E,
  Gcaron: 0x01E6,
  Gcedilla: 0x0122,
  Gcircle: 0x24BC,
  Gcircumflex: 0x011C,
  Gcommaaccent: 0x0122,
  Gdot: 0x0120,
  Gdotaccent: 0x0120,
  Gecyrillic: 0x0413,
  Ghadarmenian: 0x0542,
  Ghemiddlehookcyrillic: 0x0494,
  Ghestrokecyrillic: 0x0492,
  Gheupturncyrillic: 0x0490,
  Ghook: 0x0193,
  Gimarmenian: 0x0533,
  Gjecyrillic: 0x0403,
  Gmacron: 0x1E20,
  Gmonospace: 0xFF27,
  Grave: 0xF6CE,
  Gravesmall: 0xF760,
  Gsmall: 0xF767,
  Gsmallhook: 0x029B,
  Gstroke: 0x01E4,
  H: 0x0048,
  H18533: 0x25CF,
  H18543: 0x25AA,
  H18551: 0x25AB,
  H22073: 0x25A1,
  HPsquare: 0x33CB,
  Haabkhasiancyrillic: 0x04A8,
  Hadescendercyrillic: 0x04B2,
  Hardsigncyrillic: 0x042A,
  Hbar: 0x0126,
  Hbrevebelow: 0x1E2A,
  Hcedilla: 0x1E28,
  Hcircle: 0x24BD,
  Hcircumflex: 0x0124,
  Hdieresis: 0x1E26,
  Hdotaccent: 0x1E22,
  Hdotbelow: 0x1E24,
  Hmonospace: 0xFF28,
  Hoarmenian: 0x0540,
  Horicoptic: 0x03E8,
  Hsmall: 0xF768,
  Hungarumlaut: 0xF6CF,
  Hungarumlautsmall: 0xF6F8,
  Hzsquare: 0x3390,
  I: 0x0049,
  IAcyrillic: 0x042F,
  IJ: 0x0132,
  IUcyrillic: 0x042E,
  Iacute: 0x00CD,
  Iacutesmall: 0xF7ED,
  Ibreve: 0x012C,
  Icaron: 0x01CF,
  Icircle: 0x24BE,
  Icircumflex: 0x00CE,
  Icircumflexsmall: 0xF7EE,
  Icyrillic: 0x0406,
  Idblgrave: 0x0208,
  Idieresis: 0x00CF,
  Idieresisacute: 0x1E2E,
  Idieresiscyrillic: 0x04E4,
  Idieresissmall: 0xF7EF,
  Idot: 0x0130,
  Idotaccent: 0x0130,
  Idotbelow: 0x1ECA,
  Iebrevecyrillic: 0x04D6,
  Iecyrillic: 0x0415,
  Ifraktur: 0x2111,
  Igrave: 0x00CC,
  Igravesmall: 0xF7EC,
  Ihookabove: 0x1EC8,
  Iicyrillic: 0x0418,
  Iinvertedbreve: 0x020A,
  Iishortcyrillic: 0x0419,
  Imacron: 0x012A,
  Imacroncyrillic: 0x04E2,
  Imonospace: 0xFF29,
  Iniarmenian: 0x053B,
  Iocyrillic: 0x0401,
  Iogonek: 0x012E,
  Iota: 0x0399,
  Iotaafrican: 0x0196,
  Iotadieresis: 0x03AA,
  Iotatonos: 0x038A,
  Ismall: 0xF769,
  Istroke: 0x0197,
  Itilde: 0x0128,
  Itildebelow: 0x1E2C,
  Izhitsacyrillic: 0x0474,
  Izhitsadblgravecyrillic: 0x0476,
  J: 0x004A,
  Jaarmenian: 0x0541,
  Jcircle: 0x24BF,
  Jcircumflex: 0x0134,
  Jecyrillic: 0x0408,
  Jheharmenian: 0x054B,
  Jmonospace: 0xFF2A,
  Jsmall: 0xF76A,
  K: 0x004B,
  KBsquare: 0x3385,
  KKsquare: 0x33CD,
  Kabashkircyrillic: 0x04A0,
  Kacute: 0x1E30,
  Kacyrillic: 0x041A,
  Kadescendercyrillic: 0x049A,
  Kahookcyrillic: 0x04C3,
  Kappa: 0x039A,
  Kastrokecyrillic: 0x049E,
  Kaverticalstrokecyrillic: 0x049C,
  Kcaron: 0x01E8,
  Kcedilla: 0x0136,
  Kcircle: 0x24C0,
  Kcommaaccent: 0x0136,
  Kdotbelow: 0x1E32,
  Keharmenian: 0x0554,
  Kenarmenian: 0x053F,
  Khacyrillic: 0x0425,
  Kheicoptic: 0x03E6,
  Khook: 0x0198,
  Kjecyrillic: 0x040C,
  Klinebelow: 0x1E34,
  Kmonospace: 0xFF2B,
  Koppacyrillic: 0x0480,
  Koppagreek: 0x03DE,
  Ksicyrillic: 0x046E,
  Ksmall: 0xF76B,
  L: 0x004C,
  LJ: 0x01C7,
  LL: 0xF6BF,
  Lacute: 0x0139,
  Lambda: 0x039B,
  Lcaron: 0x013D,
  Lcedilla: 0x013B,
  Lcircle: 0x24C1,
  Lcircumflexbelow: 0x1E3C,
  Lcommaaccent: 0x013B,
  Ldot: 0x013F,
  Ldotaccent: 0x013F,
  Ldotbelow: 0x1E36,
  Ldotbelowmacron: 0x1E38,
  Liwnarmenian: 0x053C,
  Lj: 0x01C8,
  Ljecyrillic: 0x0409,
  Llinebelow: 0x1E3A,
  Lmonospace: 0xFF2C,
  Lslash: 0x0141,
  Lslashsmall: 0xF6F9,
  Lsmall: 0xF76C,
  M: 0x004D,
  MBsquare: 0x3386,
  Macron: 0xF6D0,
  Macronsmall: 0xF7AF,
  Macute: 0x1E3E,
  Mcircle: 0x24C2,
  Mdotaccent: 0x1E40,
  Mdotbelow: 0x1E42,
  Menarmenian: 0x0544,
  Mmonospace: 0xFF2D,
  Msmall: 0xF76D,
  Mturned: 0x019C,
  Mu: 0x039C,
  N: 0x004E,
  NJ: 0x01CA,
  Nacute: 0x0143,
  Ncaron: 0x0147,
  Ncedilla: 0x0145,
  Ncircle: 0x24C3,
  Ncircumflexbelow: 0x1E4A,
  Ncommaaccent: 0x0145,
  Ndotaccent: 0x1E44,
  Ndotbelow: 0x1E46,
  Nhookleft: 0x019D,
  Nineroman: 0x2168,
  Nj: 0x01CB,
  Njecyrillic: 0x040A,
  Nlinebelow: 0x1E48,
  Nmonospace: 0xFF2E,
  Nowarmenian: 0x0546,
  Nsmall: 0xF76E,
  Ntilde: 0x00D1,
  Ntildesmall: 0xF7F1,
  Nu: 0x039D,
  O: 0x004F,
  OE: 0x0152,
  OEsmall: 0xF6FA,
  Oacute: 0x00D3,
  Oacutesmall: 0xF7F3,
  Obarredcyrillic: 0x04E8,
  Obarreddieresiscyrillic: 0x04EA,
  Obreve: 0x014E,
  Ocaron: 0x01D1,
  Ocenteredtilde: 0x019F,
  Ocircle: 0x24C4,
  Ocircumflex: 0x00D4,
  Ocircumflexacute: 0x1ED0,
  Ocircumflexdotbelow: 0x1ED8,
  Ocircumflexgrave: 0x1ED2,
  Ocircumflexhookabove: 0x1ED4,
  Ocircumflexsmall: 0xF7F4,
  Ocircumflextilde: 0x1ED6,
  Ocyrillic: 0x041E,
  Odblacute: 0x0150,
  Odblgrave: 0x020C,
  Odieresis: 0x00D6,
  Odieresiscyrillic: 0x04E6,
  Odieresissmall: 0xF7F6,
  Odotbelow: 0x1ECC,
  Ogoneksmall: 0xF6FB,
  Ograve: 0x00D2,
  Ogravesmall: 0xF7F2,
  Oharmenian: 0x0555,
  Ohm: 0x2126,
  Ohookabove: 0x1ECE,
  Ohorn: 0x01A0,
  Ohornacute: 0x1EDA,
  Ohorndotbelow: 0x1EE2,
  Ohorngrave: 0x1EDC,
  Ohornhookabove: 0x1EDE,
  Ohorntilde: 0x1EE0,
  Ohungarumlaut: 0x0150,
  Oi: 0x01A2,
  Oinvertedbreve: 0x020E,
  Omacron: 0x014C,
  Omacronacute: 0x1E52,
  Omacrongrave: 0x1E50,
  Omega: 0x2126,
  Omegacyrillic: 0x0460,
  Omegagreek: 0x03A9,
  Omegaroundcyrillic: 0x047A,
  Omegatitlocyrillic: 0x047C,
  Omegatonos: 0x038F,
  Omicron: 0x039F,
  Omicrontonos: 0x038C,
  Omonospace: 0xFF2F,
  Oneroman: 0x2160,
  Oogonek: 0x01EA,
  Oogonekmacron: 0x01EC,
  Oopen: 0x0186,
  Oslash: 0x00D8,
  Oslashacute: 0x01FE,
  Oslashsmall: 0xF7F8,
  Osmall: 0xF76F,
  Ostrokeacute: 0x01FE,
  Otcyrillic: 0x047E,
  Otilde: 0x00D5,
  Otildeacute: 0x1E4C,
  Otildedieresis: 0x1E4E,
  Otildesmall: 0xF7F5,
  P: 0x0050,
  Pacute: 0x1E54,
  Pcircle: 0x24C5,
  Pdotaccent: 0x1E56,
  Pecyrillic: 0x041F,
  Peharmenian: 0x054A,
  Pemiddlehookcyrillic: 0x04A6,
  Phi: 0x03A6,
  Phook: 0x01A4,
  Pi: 0x03A0,
  Piwrarmenian: 0x0553,
  Pmonospace: 0xFF30,
  Psi: 0x03A8,
  Psicyrillic: 0x0470,
  Psmall: 0xF770,
  Q: 0x0051,
  Qcircle: 0x24C6,
  Qmonospace: 0xFF31,
  Qsmall: 0xF771,
  R: 0x0052,
  Raarmenian: 0x054C,
  Racute: 0x0154,
  Rcaron: 0x0158,
  Rcedilla: 0x0156,
  Rcircle: 0x24C7,
  Rcommaaccent: 0x0156,
  Rdblgrave: 0x0210,
  Rdotaccent: 0x1E58,
  Rdotbelow: 0x1E5A,
  Rdotbelowmacron: 0x1E5C,
  Reharmenian: 0x0550,
  Rfraktur: 0x211C,
  Rho: 0x03A1,
  Ringsmall: 0xF6FC,
  Rinvertedbreve: 0x0212,
  Rlinebelow: 0x1E5E,
  Rmonospace: 0xFF32,
  Rsmall: 0xF772,
  Rsmallinverted: 0x0281,
  Rsmallinvertedsuperior: 0x02B6,
  S: 0x0053,
  SF010000: 0x250C,
  SF020000: 0x2514,
  SF030000: 0x2510,
  SF040000: 0x2518,
  SF050000: 0x253C,
  SF060000: 0x252C,
  SF070000: 0x2534,
  SF080000: 0x251C,
  SF090000: 0x2524,
  SF100000: 0x2500,
  SF110000: 0x2502,
  SF190000: 0x2561,
  SF200000: 0x2562,
  SF210000: 0x2556,
  SF220000: 0x2555,
  SF230000: 0x2563,
  SF240000: 0x2551,
  SF250000: 0x2557,
  SF260000: 0x255D,
  SF270000: 0x255C,
  SF280000: 0x255B,
  SF360000: 0x255E,
  SF370000: 0x255F,
  SF380000: 0x255A,
  SF390000: 0x2554,
  SF400000: 0x2569,
  SF410000: 0x2566,
  SF420000: 0x2560,
  SF430000: 0x2550,
  SF440000: 0x256C,
  SF450000: 0x2567,
  SF460000: 0x2568,
  SF470000: 0x2564,
  SF480000: 0x2565,
  SF490000: 0x2559,
  SF500000: 0x2558,
  SF510000: 0x2552,
  SF520000: 0x2553,
  SF530000: 0x256B,
  SF540000: 0x256A,
  Sacute: 0x015A,
  Sacutedotaccent: 0x1E64,
  Sampigreek: 0x03E0,
  Scaron: 0x0160,
  Scarondotaccent: 0x1E66,
  Scaronsmall: 0xF6FD,
  Scedilla: 0x015E,
  Schwa: 0x018F,
  Schwacyrillic: 0x04D8,
  Schwadieresiscyrillic: 0x04DA,
  Scircle: 0x24C8,
  Scircumflex: 0x015C,
  Scommaaccent: 0x0218,
  Sdotaccent: 0x1E60,
  Sdotbelow: 0x1E62,
  Sdotbelowdotaccent: 0x1E68,
  Seharmenian: 0x054D,
  Sevenroman: 0x2166,
  Shaarmenian: 0x0547,
  Shacyrillic: 0x0428,
  Shchacyrillic: 0x0429,
  Sheicoptic: 0x03E2,
  Shhacyrillic: 0x04BA,
  Shimacoptic: 0x03EC,
  Sigma: 0x03A3,
  Sixroman: 0x2165,
  Smonospace: 0xFF33,
  Softsigncyrillic: 0x042C,
  Ssmall: 0xF773,
  Stigmagreek: 0x03DA,
  T: 0x0054,
  Tau: 0x03A4,
  Tbar: 0x0166,
  Tcaron: 0x0164,
  Tcedilla: 0x0162,
  Tcircle: 0x24C9,
  Tcircumflexbelow: 0x1E70,
  Tcommaaccent: 0x0162,
  Tdotaccent: 0x1E6A,
  Tdotbelow: 0x1E6C,
  Tecyrillic: 0x0422,
  Tedescendercyrillic: 0x04AC,
  Tenroman: 0x2169,
  Tetsecyrillic: 0x04B4,
  Theta: 0x0398,
  Thook: 0x01AC,
  Thorn: 0x00DE,
  Thornsmall: 0xF7FE,
  Threeroman: 0x2162,
  Tildesmall: 0xF6FE,
  Tiwnarmenian: 0x054F,
  Tlinebelow: 0x1E6E,
  Tmonospace: 0xFF34,
  Toarmenian: 0x0539,
  Tonefive: 0x01BC,
  Tonesix: 0x0184,
  Tonetwo: 0x01A7,
  Tretroflexhook: 0x01AE,
  Tsecyrillic: 0x0426,
  Tshecyrillic: 0x040B,
  Tsmall: 0xF774,
  Twelveroman: 0x216B,
  Tworoman: 0x2161,
  U: 0x0055,
  Uacute: 0x00DA,
  Uacutesmall: 0xF7FA,
  Ubreve: 0x016C,
  Ucaron: 0x01D3,
  Ucircle: 0x24CA,
  Ucircumflex: 0x00DB,
  Ucircumflexbelow: 0x1E76,
  Ucircumflexsmall: 0xF7FB,
  Ucyrillic: 0x0423,
  Udblacute: 0x0170,
  Udblgrave: 0x0214,
  Udieresis: 0x00DC,
  Udieresisacute: 0x01D7,
  Udieresisbelow: 0x1E72,
  Udieresiscaron: 0x01D9,
  Udieresiscyrillic: 0x04F0,
  Udieresisgrave: 0x01DB,
  Udieresismacron: 0x01D5,
  Udieresissmall: 0xF7FC,
  Udotbelow: 0x1EE4,
  Ugrave: 0x00D9,
  Ugravesmall: 0xF7F9,
  Uhookabove: 0x1EE6,
  Uhorn: 0x01AF,
  Uhornacute: 0x1EE8,
  Uhorndotbelow: 0x1EF0,
  Uhorngrave: 0x1EEA,
  Uhornhookabove: 0x1EEC,
  Uhorntilde: 0x1EEE,
  Uhungarumlaut: 0x0170,
  Uhungarumlautcyrillic: 0x04F2,
  Uinvertedbreve: 0x0216,
  Ukcyrillic: 0x0478,
  Umacron: 0x016A,
  Umacroncyrillic: 0x04EE,
  Umacrondieresis: 0x1E7A,
  Umonospace: 0xFF35,
  Uogonek: 0x0172,
  Upsilon: 0x03A5,
  Upsilon1: 0x03D2,
  Upsilonacutehooksymbolgreek: 0x03D3,
  Upsilonafrican: 0x01B1,
  Upsilondieresis: 0x03AB,
  Upsilondieresishooksymbolgreek: 0x03D4,
  Upsilonhooksymbol: 0x03D2,
  Upsilontonos: 0x038E,
  Uring: 0x016E,
  Ushortcyrillic: 0x040E,
  Usmall: 0xF775,
  Ustraightcyrillic: 0x04AE,
  Ustraightstrokecyrillic: 0x04B0,
  Utilde: 0x0168,
  Utildeacute: 0x1E78,
  Utildebelow: 0x1E74,
  V: 0x0056,
  Vcircle: 0x24CB,
  Vdotbelow: 0x1E7E,
  Vecyrillic: 0x0412,
  Vewarmenian: 0x054E,
  Vhook: 0x01B2,
  Vmonospace: 0xFF36,
  Voarmenian: 0x0548,
  Vsmall: 0xF776,
  Vtilde: 0x1E7C,
  W: 0x0057,
  Wacute: 0x1E82,
  Wcircle: 0x24CC,
  Wcircumflex: 0x0174,
  Wdieresis: 0x1E84,
  Wdotaccent: 0x1E86,
  Wdotbelow: 0x1E88,
  Wgrave: 0x1E80,
  Wmonospace: 0xFF37,
  Wsmall: 0xF777,
  X: 0x0058,
  Xcircle: 0x24CD,
  Xdieresis: 0x1E8C,
  Xdotaccent: 0x1E8A,
  Xeharmenian: 0x053D,
  Xi: 0x039E,
  Xmonospace: 0xFF38,
  Xsmall: 0xF778,
  Y: 0x0059,
  Yacute: 0x00DD,
  Yacutesmall: 0xF7FD,
  Yatcyrillic: 0x0462,
  Ycircle: 0x24CE,
  Ycircumflex: 0x0176,
  Ydieresis: 0x0178,
  Ydieresissmall: 0xF7FF,
  Ydotaccent: 0x1E8E,
  Ydotbelow: 0x1EF4,
  Yericyrillic: 0x042B,
  Yerudieresiscyrillic: 0x04F8,
  Ygrave: 0x1EF2,
  Yhook: 0x01B3,
  Yhookabove: 0x1EF6,
  Yiarmenian: 0x0545,
  Yicyrillic: 0x0407,
  Yiwnarmenian: 0x0552,
  Ymonospace: 0xFF39,
  Ysmall: 0xF779,
  Ytilde: 0x1EF8,
  Yusbigcyrillic: 0x046A,
  Yusbigiotifiedcyrillic: 0x046C,
  Yuslittlecyrillic: 0x0466,
  Yuslittleiotifiedcyrillic: 0x0468,
  Z: 0x005A,
  Zaarmenian: 0x0536,
  Zacute: 0x0179,
  Zcaron: 0x017D,
  Zcaronsmall: 0xF6FF,
  Zcircle: 0x24CF,
  Zcircumflex: 0x1E90,
  Zdot: 0x017B,
  Zdotaccent: 0x017B,
  Zdotbelow: 0x1E92,
  Zecyrillic: 0x0417,
  Zedescendercyrillic: 0x0498,
  Zedieresiscyrillic: 0x04DE,
  Zeta: 0x0396,
  Zhearmenian: 0x053A,
  Zhebrevecyrillic: 0x04C1,
  Zhecyrillic: 0x0416,
  Zhedescendercyrillic: 0x0496,
  Zhedieresiscyrillic: 0x04DC,
  Zlinebelow: 0x1E94,
  Zmonospace: 0xFF3A,
  Zsmall: 0xF77A,
  Zstroke: 0x01B5,
  a: 0x0061,
  aabengali: 0x0986,
  aacute: 0x00E1,
  aadeva: 0x0906,
  aagujarati: 0x0A86,
  aagurmukhi: 0x0A06,
  aamatragurmukhi: 0x0A3E,
  aarusquare: 0x3303,
  aavowelsignbengali: 0x09BE,
  aavowelsigndeva: 0x093E,
  aavowelsigngujarati: 0x0ABE,
  abbreviationmarkarmenian: 0x055F,
  abbreviationsigndeva: 0x0970,
  abengali: 0x0985,
  abopomofo: 0x311A,
  abreve: 0x0103,
  abreveacute: 0x1EAF,
  abrevecyrillic: 0x04D1,
  abrevedotbelow: 0x1EB7,
  abrevegrave: 0x1EB1,
  abrevehookabove: 0x1EB3,
  abrevetilde: 0x1EB5,
  acaron: 0x01CE,
  acircle: 0x24D0,
  acircumflex: 0x00E2,
  acircumflexacute: 0x1EA5,
  acircumflexdotbelow: 0x1EAD,
  acircumflexgrave: 0x1EA7,
  acircumflexhookabove: 0x1EA9,
  acircumflextilde: 0x1EAB,
  acute: 0x00B4,
  acutebelowcmb: 0x0317,
  acutecmb: 0x0301,
  acutecomb: 0x0301,
  acutedeva: 0x0954,
  acutelowmod: 0x02CF,
  acutetonecmb: 0x0341,
  acyrillic: 0x0430,
  adblgrave: 0x0201,
  addakgurmukhi: 0x0A71,
  adeva: 0x0905,
  adieresis: 0x00E4,
  adieresiscyrillic: 0x04D3,
  adieresismacron: 0x01DF,
  adotbelow: 0x1EA1,
  adotmacron: 0x01E1,
  ae: 0x00E6,
  aeacute: 0x01FD,
  aekorean: 0x3150,
  aemacron: 0x01E3,
  afii00208: 0x2015,
  afii08941: 0x20A4,
  afii10017: 0x0410,
  afii10018: 0x0411,
  afii10019: 0x0412,
  afii10020: 0x0413,
  afii10021: 0x0414,
  afii10022: 0x0415,
  afii10023: 0x0401,
  afii10024: 0x0416,
  afii10025: 0x0417,
  afii10026: 0x0418,
  afii10027: 0x0419,
  afii10028: 0x041A,
  afii10029: 0x041B,
  afii10030: 0x041C,
  afii10031: 0x041D,
  afii10032: 0x041E,
  afii10033: 0x041F,
  afii10034: 0x0420,
  afii10035: 0x0421,
  afii10036: 0x0422,
  afii10037: 0x0423,
  afii10038: 0x0424,
  afii10039: 0x0425,
  afii10040: 0x0426,
  afii10041: 0x0427,
  afii10042: 0x0428,
  afii10043: 0x0429,
  afii10044: 0x042A,
  afii10045: 0x042B,
  afii10046: 0x042C,
  afii10047: 0x042D,
  afii10048: 0x042E,
  afii10049: 0x042F,
  afii10050: 0x0490,
  afii10051: 0x0402,
  afii10052: 0x0403,
  afii10053: 0x0404,
  afii10054: 0x0405,
  afii10055: 0x0406,
  afii10056: 0x0407,
  afii10057: 0x0408,
  afii10058: 0x0409,
  afii10059: 0x040A,
  afii10060: 0x040B,
  afii10061: 0x040C,
  afii10062: 0x040E,
  afii10063: 0xF6C4,
  afii10064: 0xF6C5,
  afii10065: 0x0430,
  afii10066: 0x0431,
  afii10067: 0x0432,
  afii10068: 0x0433,
  afii10069: 0x0434,
  afii10070: 0x0435,
  afii10071: 0x0451,
  afii10072: 0x0436,
  afii10073: 0x0437,
  afii10074: 0x0438,
  afii10075: 0x0439,
  afii10076: 0x043A,
  afii10077: 0x043B,
  afii10078: 0x043C,
  afii10079: 0x043D,
  afii10080: 0x043E,
  afii10081: 0x043F,
  afii10082: 0x0440,
  afii10083: 0x0441,
  afii10084: 0x0442,
  afii10085: 0x0443,
  afii10086: 0x0444,
  afii10087: 0x0445,
  afii10088: 0x0446,
  afii10089: 0x0447,
  afii10090: 0x0448,
  afii10091: 0x0449,
  afii10092: 0x044A,
  afii10093: 0x044B,
  afii10094: 0x044C,
  afii10095: 0x044D,
  afii10096: 0x044E,
  afii10097: 0x044F,
  afii10098: 0x0491,
  afii10099: 0x0452,
  afii10100: 0x0453,
  afii10101: 0x0454,
  afii10102: 0x0455,
  afii10103: 0x0456,
  afii10104: 0x0457,
  afii10105: 0x0458,
  afii10106: 0x0459,
  afii10107: 0x045A,
  afii10108: 0x045B,
  afii10109: 0x045C,
  afii10110: 0x045E,
  afii10145: 0x040F,
  afii10146: 0x0462,
  afii10147: 0x0472,
  afii10148: 0x0474,
  afii10192: 0xF6C6,
  afii10193: 0x045F,
  afii10194: 0x0463,
  afii10195: 0x0473,
  afii10196: 0x0475,
  afii10831: 0xF6C7,
  afii10832: 0xF6C8,
  afii10846: 0x04D9,
  afii299: 0x200E,
  afii300: 0x200F,
  afii301: 0x200D,
  afii57381: 0x066A,
  afii57388: 0x060C,
  afii57392: 0x0660,
  afii57393: 0x0661,
  afii57394: 0x0662,
  afii57395: 0x0663,
  afii57396: 0x0664,
  afii57397: 0x0665,
  afii57398: 0x0666,
  afii57399: 0x0667,
  afii57400: 0x0668,
  afii57401: 0x0669,
  afii57403: 0x061B,
  afii57407: 0x061F,
  afii57409: 0x0621,
  afii57410: 0x0622,
  afii57411: 0x0623,
  afii57412: 0x0624,
  afii57413: 0x0625,
  afii57414: 0x0626,
  afii57415: 0x0627,
  afii57416: 0x0628,
  afii57417: 0x0629,
  afii57418: 0x062A,
  afii57419: 0x062B,
  afii57420: 0x062C,
  afii57421: 0x062D,
  afii57422: 0x062E,
  afii57423: 0x062F,
  afii57424: 0x0630,
  afii57425: 0x0631,
  afii57426: 0x0632,
  afii57427: 0x0633,
  afii57428: 0x0634,
  afii57429: 0x0635,
  afii57430: 0x0636,
  afii57431: 0x0637,
  afii57432: 0x0638,
  afii57433: 0x0639,
  afii57434: 0x063A,
  afii57440: 0x0640,
  afii57441: 0x0641,
  afii57442: 0x0642,
  afii57443: 0x0643,
  afii57444: 0x0644,
  afii57445: 0x0645,
  afii57446: 0x0646,
  afii57448: 0x0648,
  afii57449: 0x0649,
  afii57450: 0x064A,
  afii57451: 0x064B,
  afii57452: 0x064C,
  afii57453: 0x064D,
  afii57454: 0x064E,
  afii57455: 0x064F,
  afii57456: 0x0650,
  afii57457: 0x0651,
  afii57458: 0x0652,
  afii57470: 0x0647,
  afii57505: 0x06A4,
  afii57506: 0x067E,
  afii57507: 0x0686,
  afii57508: 0x0698,
  afii57509: 0x06AF,
  afii57511: 0x0679,
  afii57512: 0x0688,
  afii57513: 0x0691,
  afii57514: 0x06BA,
  afii57519: 0x06D2,
  afii57534: 0x06D5,
  afii57636: 0x20AA,
  afii57645: 0x05BE,
  afii57658: 0x05C3,
  afii57664: 0x05D0,
  afii57665: 0x05D1,
  afii57666: 0x05D2,
  afii57667: 0x05D3,
  afii57668: 0x05D4,
  afii57669: 0x05D5,
  afii57670: 0x05D6,
  afii57671: 0x05D7,
  afii57672: 0x05D8,
  afii57673: 0x05D9,
  afii57674: 0x05DA,
  afii57675: 0x05DB,
  afii57676: 0x05DC,
  afii57677: 0x05DD,
  afii57678: 0x05DE,
  afii57679: 0x05DF,
  afii57680: 0x05E0,
  afii57681: 0x05E1,
  afii57682: 0x05E2,
  afii57683: 0x05E3,
  afii57684: 0x05E4,
  afii57685: 0x05E5,
  afii57686: 0x05E6,
  afii57687: 0x05E7,
  afii57688: 0x05E8,
  afii57689: 0x05E9,
  afii57690: 0x05EA,
  afii57694: 0xFB2A,
  afii57695: 0xFB2B,
  afii57700: 0xFB4B,
  afii57705: 0xFB1F,
  afii57716: 0x05F0,
  afii57717: 0x05F1,
  afii57718: 0x05F2,
  afii57723: 0xFB35,
  afii57793: 0x05B4,
  afii57794: 0x05B5,
  afii57795: 0x05B6,
  afii57796: 0x05BB,
  afii57797: 0x05B8,
  afii57798: 0x05B7,
  afii57799: 0x05B0,
  afii57800: 0x05B2,
  afii57801: 0x05B1,
  afii57802: 0x05B3,
  afii57803: 0x05C2,
  afii57804: 0x05C1,
  afii57806: 0x05B9,
  afii57807: 0x05BC,
  afii57839: 0x05BD,
  afii57841: 0x05BF,
  afii57842: 0x05C0,
  afii57929: 0x02BC,
  afii61248: 0x2105,
  afii61289: 0x2113,
  afii61352: 0x2116,
  afii61573: 0x202C,
  afii61574: 0x202D,
  afii61575: 0x202E,
  afii61664: 0x200C,
  afii63167: 0x066D,
  afii64937: 0x02BD,
  agrave: 0x00E0,
  agujarati: 0x0A85,
  agurmukhi: 0x0A05,
  ahiragana: 0x3042,
  ahookabove: 0x1EA3,
  aibengali: 0x0990,
  aibopomofo: 0x311E,
  aideva: 0x0910,
  aiecyrillic: 0x04D5,
  aigujarati: 0x0A90,
  aigurmukhi: 0x0A10,
  aimatragurmukhi: 0x0A48,
  ainarabic: 0x0639,
  ainfinalarabic: 0xFECA,
  aininitialarabic: 0xFECB,
  ainmedialarabic: 0xFECC,
  ainvertedbreve: 0x0203,
  aivowelsignbengali: 0x09C8,
  aivowelsigndeva: 0x0948,
  aivowelsigngujarati: 0x0AC8,
  akatakana: 0x30A2,
  akatakanahalfwidth: 0xFF71,
  akorean: 0x314F,
  alef: 0x05D0,
  alefarabic: 0x0627,
  alefdageshhebrew: 0xFB30,
  aleffinalarabic: 0xFE8E,
  alefhamzaabovearabic: 0x0623,
  alefhamzaabovefinalarabic: 0xFE84,
  alefhamzabelowarabic: 0x0625,
  alefhamzabelowfinalarabic: 0xFE88,
  alefhebrew: 0x05D0,
  aleflamedhebrew: 0xFB4F,
  alefmaddaabovearabic: 0x0622,
  alefmaddaabovefinalarabic: 0xFE82,
  alefmaksuraarabic: 0x0649,
  alefmaksurafinalarabic: 0xFEF0,
  alefmaksurainitialarabic: 0xFEF3,
  alefmaksuramedialarabic: 0xFEF4,
  alefpatahhebrew: 0xFB2E,
  alefqamatshebrew: 0xFB2F,
  aleph: 0x2135,
  allequal: 0x224C,
  alpha: 0x03B1,
  alphatonos: 0x03AC,
  amacron: 0x0101,
  amonospace: 0xFF41,
  ampersand: 0x0026,
  ampersandmonospace: 0xFF06,
  ampersandsmall: 0xF726,
  amsquare: 0x33C2,
  anbopomofo: 0x3122,
  angbopomofo: 0x3124,
  angbracketleft: 0x3008, // This glyph is missing from Adobe's original list.
  angbracketright: 0x3009, // This glyph is missing from Adobe's original list.
  angkhankhuthai: 0x0E5A,
  angle: 0x2220,
  anglebracketleft: 0x3008,
  anglebracketleftvertical: 0xFE3F,
  anglebracketright: 0x3009,
  anglebracketrightvertical: 0xFE40,
  angleleft: 0x2329,
  angleright: 0x232A,
  angstrom: 0x212B,
  anoteleia: 0x0387,
  anudattadeva: 0x0952,
  anusvarabengali: 0x0982,
  anusvaradeva: 0x0902,
  anusvaragujarati: 0x0A82,
  aogonek: 0x0105,
  apaatosquare: 0x3300,
  aparen: 0x249C,
  apostrophearmenian: 0x055A,
  apostrophemod: 0x02BC,
  apple: 0xF8FF,
  approaches: 0x2250,
  approxequal: 0x2248,
  approxequalorimage: 0x2252,
  approximatelyequal: 0x2245,
  araeaekorean: 0x318E,
  araeakorean: 0x318D,
  arc: 0x2312,
  arighthalfring: 0x1E9A,
  aring: 0x00E5,
  aringacute: 0x01FB,
  aringbelow: 0x1E01,
  arrowboth: 0x2194,
  arrowdashdown: 0x21E3,
  arrowdashleft: 0x21E0,
  arrowdashright: 0x21E2,
  arrowdashup: 0x21E1,
  arrowdblboth: 0x21D4,
  arrowdbldown: 0x21D3,
  arrowdblleft: 0x21D0,
  arrowdblright: 0x21D2,
  arrowdblup: 0x21D1,
  arrowdown: 0x2193,
  arrowdownleft: 0x2199,
  arrowdownright: 0x2198,
  arrowdownwhite: 0x21E9,
  arrowheaddownmod: 0x02C5,
  arrowheadleftmod: 0x02C2,
  arrowheadrightmod: 0x02C3,
  arrowheadupmod: 0x02C4,
  arrowhorizex: 0xF8E7,
  arrowleft: 0x2190,
  arrowleftdbl: 0x21D0,
  arrowleftdblstroke: 0x21CD,
  arrowleftoverright: 0x21C6,
  arrowleftwhite: 0x21E6,
  arrowright: 0x2192,
  arrowrightdblstroke: 0x21CF,
  arrowrightheavy: 0x279E,
  arrowrightoverleft: 0x21C4,
  arrowrightwhite: 0x21E8,
  arrowtableft: 0x21E4,
  arrowtabright: 0x21E5,
  arrowup: 0x2191,
  arrowupdn: 0x2195,
  arrowupdnbse: 0x21A8,
  arrowupdownbase: 0x21A8,
  arrowupleft: 0x2196,
  arrowupleftofdown: 0x21C5,
  arrowupright: 0x2197,
  arrowupwhite: 0x21E7,
  arrowvertex: 0xF8E6,
  asciicircum: 0x005E,
  asciicircummonospace: 0xFF3E,
  asciitilde: 0x007E,
  asciitildemonospace: 0xFF5E,
  ascript: 0x0251,
  ascriptturned: 0x0252,
  asmallhiragana: 0x3041,
  asmallkatakana: 0x30A1,
  asmallkatakanahalfwidth: 0xFF67,
  asterisk: 0x002A,
  asteriskaltonearabic: 0x066D,
  asteriskarabic: 0x066D,
  asteriskmath: 0x2217,
  asteriskmonospace: 0xFF0A,
  asterisksmall: 0xFE61,
  asterism: 0x2042,
  asuperior: 0xF6E9,
  asymptoticallyequal: 0x2243,
  at: 0x0040,
  atilde: 0x00E3,
  atmonospace: 0xFF20,
  atsmall: 0xFE6B,
  aturned: 0x0250,
  aubengali: 0x0994,
  aubopomofo: 0x3120,
  audeva: 0x0914,
  augujarati: 0x0A94,
  augurmukhi: 0x0A14,
  aulengthmarkbengali: 0x09D7,
  aumatragurmukhi: 0x0A4C,
  auvowelsignbengali: 0x09CC,
  auvowelsigndeva: 0x094C,
  auvowelsigngujarati: 0x0ACC,
  avagrahadeva: 0x093D,
  aybarmenian: 0x0561,
  ayin: 0x05E2,
  ayinaltonehebrew: 0xFB20,
  ayinhebrew: 0x05E2,
  b: 0x0062,
  babengali: 0x09AC,
  backslash: 0x005C,
  backslashmonospace: 0xFF3C,
  badeva: 0x092C,
  bagujarati: 0x0AAC,
  bagurmukhi: 0x0A2C,
  bahiragana: 0x3070,
  bahtthai: 0x0E3F,
  bakatakana: 0x30D0,
  bar: 0x007C,
  barmonospace: 0xFF5C,
  bbopomofo: 0x3105,
  bcircle: 0x24D1,
  bdotaccent: 0x1E03,
  bdotbelow: 0x1E05,
  beamedsixteenthnotes: 0x266C,
  because: 0x2235,
  becyrillic: 0x0431,
  beharabic: 0x0628,
  behfinalarabic: 0xFE90,
  behinitialarabic: 0xFE91,
  behiragana: 0x3079,
  behmedialarabic: 0xFE92,
  behmeeminitialarabic: 0xFC9F,
  behmeemisolatedarabic: 0xFC08,
  behnoonfinalarabic: 0xFC6D,
  bekatakana: 0x30D9,
  benarmenian: 0x0562,
  bet: 0x05D1,
  beta: 0x03B2,
  betasymbolgreek: 0x03D0,
  betdagesh: 0xFB31,
  betdageshhebrew: 0xFB31,
  bethebrew: 0x05D1,
  betrafehebrew: 0xFB4C,
  bhabengali: 0x09AD,
  bhadeva: 0x092D,
  bhagujarati: 0x0AAD,
  bhagurmukhi: 0x0A2D,
  bhook: 0x0253,
  bihiragana: 0x3073,
  bikatakana: 0x30D3,
  bilabialclick: 0x0298,
  bindigurmukhi: 0x0A02,
  birusquare: 0x3331,
  blackcircle: 0x25CF,
  blackdiamond: 0x25C6,
  blackdownpointingtriangle: 0x25BC,
  blackleftpointingpointer: 0x25C4,
  blackleftpointingtriangle: 0x25C0,
  blacklenticularbracketleft: 0x3010,
  blacklenticularbracketleftvertical: 0xFE3B,
  blacklenticularbracketright: 0x3011,
  blacklenticularbracketrightvertical: 0xFE3C,
  blacklowerlefttriangle: 0x25E3,
  blacklowerrighttriangle: 0x25E2,
  blackrectangle: 0x25AC,
  blackrightpointingpointer: 0x25BA,
  blackrightpointingtriangle: 0x25B6,
  blacksmallsquare: 0x25AA,
  blacksmilingface: 0x263B,
  blacksquare: 0x25A0,
  blackstar: 0x2605,
  blackupperlefttriangle: 0x25E4,
  blackupperrighttriangle: 0x25E5,
  blackuppointingsmalltriangle: 0x25B4,
  blackuppointingtriangle: 0x25B2,
  blank: 0x2423,
  blinebelow: 0x1E07,
  block: 0x2588,
  bmonospace: 0xFF42,
  bobaimaithai: 0x0E1A,
  bohiragana: 0x307C,
  bokatakana: 0x30DC,
  bparen: 0x249D,
  bqsquare: 0x33C3,
  braceex: 0xF8F4,
  braceleft: 0x007B,
  braceleftbt: 0xF8F3,
  braceleftmid: 0xF8F2,
  braceleftmonospace: 0xFF5B,
  braceleftsmall: 0xFE5B,
  bracelefttp: 0xF8F1,
  braceleftvertical: 0xFE37,
  braceright: 0x007D,
  bracerightbt: 0xF8FE,
  bracerightmid: 0xF8FD,
  bracerightmonospace: 0xFF5D,
  bracerightsmall: 0xFE5C,
  bracerighttp: 0xF8FC,
  bracerightvertical: 0xFE38,
  bracketleft: 0x005B,
  bracketleftbt: 0xF8F0,
  bracketleftex: 0xF8EF,
  bracketleftmonospace: 0xFF3B,
  bracketlefttp: 0xF8EE,
  bracketright: 0x005D,
  bracketrightbt: 0xF8FB,
  bracketrightex: 0xF8FA,
  bracketrightmonospace: 0xFF3D,
  bracketrighttp: 0xF8F9,
  breve: 0x02D8,
  brevebelowcmb: 0x032E,
  brevecmb: 0x0306,
  breveinvertedbelowcmb: 0x032F,
  breveinvertedcmb: 0x0311,
  breveinverteddoublecmb: 0x0361,
  bridgebelowcmb: 0x032A,
  bridgeinvertedbelowcmb: 0x033A,
  brokenbar: 0x00A6,
  bstroke: 0x0180,
  bsuperior: 0xF6EA,
  btopbar: 0x0183,
  buhiragana: 0x3076,
  bukatakana: 0x30D6,
  bullet: 0x2022,
  bulletinverse: 0x25D8,
  bulletoperator: 0x2219,
  bullseye: 0x25CE,
  c: 0x0063,
  caarmenian: 0x056E,
  cabengali: 0x099A,
  cacute: 0x0107,
  cadeva: 0x091A,
  cagujarati: 0x0A9A,
  cagurmukhi: 0x0A1A,
  calsquare: 0x3388,
  candrabindubengali: 0x0981,
  candrabinducmb: 0x0310,
  candrabindudeva: 0x0901,
  candrabindugujarati: 0x0A81,
  capslock: 0x21EA,
  careof: 0x2105,
  caron: 0x02C7,
  caronbelowcmb: 0x032C,
  caroncmb: 0x030C,
  carriagereturn: 0x21B5,
  cbopomofo: 0x3118,
  ccaron: 0x010D,
  ccedilla: 0x00E7,
  ccedillaacute: 0x1E09,
  ccircle: 0x24D2,
  ccircumflex: 0x0109,
  ccurl: 0x0255,
  cdot: 0x010B,
  cdotaccent: 0x010B,
  cdsquare: 0x33C5,
  cedilla: 0x00B8,
  cedillacmb: 0x0327,
  cent: 0x00A2,
  centigrade: 0x2103,
  centinferior: 0xF6DF,
  centmonospace: 0xFFE0,
  centoldstyle: 0xF7A2,
  centsuperior: 0xF6E0,
  chaarmenian: 0x0579,
  chabengali: 0x099B,
  chadeva: 0x091B,
  chagujarati: 0x0A9B,
  chagurmukhi: 0x0A1B,
  chbopomofo: 0x3114,
  cheabkhasiancyrillic: 0x04BD,
  checkmark: 0x2713,
  checyrillic: 0x0447,
  chedescenderabkhasiancyrillic: 0x04BF,
  chedescendercyrillic: 0x04B7,
  chedieresiscyrillic: 0x04F5,
  cheharmenian: 0x0573,
  chekhakassiancyrillic: 0x04CC,
  cheverticalstrokecyrillic: 0x04B9,
  chi: 0x03C7,
  chieuchacirclekorean: 0x3277,
  chieuchaparenkorean: 0x3217,
  chieuchcirclekorean: 0x3269,
  chieuchkorean: 0x314A,
  chieuchparenkorean: 0x3209,
  chochangthai: 0x0E0A,
  chochanthai: 0x0E08,
  chochingthai: 0x0E09,
  chochoethai: 0x0E0C,
  chook: 0x0188,
  cieucacirclekorean: 0x3276,
  cieucaparenkorean: 0x3216,
  cieuccirclekorean: 0x3268,
  cieuckorean: 0x3148,
  cieucparenkorean: 0x3208,
  cieucuparenkorean: 0x321C,
  circle: 0x25CB,
  circlecopyrt: 0x00A9, // This glyph is missing from Adobe's original list.
  circlemultiply: 0x2297,
  circleot: 0x2299,
  circleplus: 0x2295,
  circlepostalmark: 0x3036,
  circlewithlefthalfblack: 0x25D0,
  circlewithrighthalfblack: 0x25D1,
  circumflex: 0x02C6,
  circumflexbelowcmb: 0x032D,
  circumflexcmb: 0x0302,
  clear: 0x2327,
  clickalveolar: 0x01C2,
  clickdental: 0x01C0,
  clicklateral: 0x01C1,
  clickretroflex: 0x01C3,
  club: 0x2663,
  clubsuitblack: 0x2663,
  clubsuitwhite: 0x2667,
  cmcubedsquare: 0x33A4,
  cmonospace: 0xFF43,
  cmsquaredsquare: 0x33A0,
  coarmenian: 0x0581,
  colon: 0x003A,
  colonmonetary: 0x20A1,
  colonmonospace: 0xFF1A,
  colonsign: 0x20A1,
  colonsmall: 0xFE55,
  colontriangularhalfmod: 0x02D1,
  colontriangularmod: 0x02D0,
  comma: 0x002C,
  commaabovecmb: 0x0313,
  commaaboverightcmb: 0x0315,
  commaaccent: 0xF6C3,
  commaarabic: 0x060C,
  commaarmenian: 0x055D,
  commainferior: 0xF6E1,
  commamonospace: 0xFF0C,
  commareversedabovecmb: 0x0314,
  commareversedmod: 0x02BD,
  commasmall: 0xFE50,
  commasuperior: 0xF6E2,
  commaturnedabovecmb: 0x0312,
  commaturnedmod: 0x02BB,
  compass: 0x263C,
  congruent: 0x2245,
  contourintegral: 0x222E,
  control: 0x2303,
  controlACK: 0x0006,
  controlBEL: 0x0007,
  controlBS: 0x0008,
  controlCAN: 0x0018,
  controlCR: 0x000D,
  controlDC1: 0x0011,
  controlDC2: 0x0012,
  controlDC3: 0x0013,
  controlDC4: 0x0014,
  controlDEL: 0x007F,
  controlDLE: 0x0010,
  controlEM: 0x0019,
  controlENQ: 0x0005,
  controlEOT: 0x0004,
  controlESC: 0x001B,
  controlETB: 0x0017,
  controlETX: 0x0003,
  controlFF: 0x000C,
  controlFS: 0x001C,
  controlGS: 0x001D,
  controlHT: 0x0009,
  controlLF: 0x000A,
  controlNAK: 0x0015,
  controlRS: 0x001E,
  controlSI: 0x000F,
  controlSO: 0x000E,
  controlSOT: 0x0002,
  controlSTX: 0x0001,
  controlSUB: 0x001A,
  controlSYN: 0x0016,
  controlUS: 0x001F,
  controlVT: 0x000B,
  copyright: 0x00A9,
  copyrightsans: 0xF8E9,
  copyrightserif: 0xF6D9,
  cornerbracketleft: 0x300C,
  cornerbracketlefthalfwidth: 0xFF62,
  cornerbracketleftvertical: 0xFE41,
  cornerbracketright: 0x300D,
  cornerbracketrighthalfwidth: 0xFF63,
  cornerbracketrightvertical: 0xFE42,
  corporationsquare: 0x337F,
  cosquare: 0x33C7,
  coverkgsquare: 0x33C6,
  cparen: 0x249E,
  cruzeiro: 0x20A2,
  cstretched: 0x0297,
  curlyand: 0x22CF,
  curlyor: 0x22CE,
  currency: 0x00A4,
  cyrBreve: 0xF6D1,
  cyrFlex: 0xF6D2,
  cyrbreve: 0xF6D4,
  cyrflex: 0xF6D5,
  d: 0x0064,
  daarmenian: 0x0564,
  dabengali: 0x09A6,
  dadarabic: 0x0636,
  dadeva: 0x0926,
  dadfinalarabic: 0xFEBE,
  dadinitialarabic: 0xFEBF,
  dadmedialarabic: 0xFEC0,
  dagesh: 0x05BC,
  dageshhebrew: 0x05BC,
  dagger: 0x2020,
  daggerdbl: 0x2021,
  dagujarati: 0x0AA6,
  dagurmukhi: 0x0A26,
  dahiragana: 0x3060,
  dakatakana: 0x30C0,
  dalarabic: 0x062F,
  dalet: 0x05D3,
  daletdagesh: 0xFB33,
  daletdageshhebrew: 0xFB33,
  dalethatafpatah: 0x05D305B2,
  dalethatafpatahhebrew: 0x05D305B2,
  dalethatafsegol: 0x05D305B1,
  dalethatafsegolhebrew: 0x05D305B1,
  dalethebrew: 0x05D3,
  dalethiriq: 0x05D305B4,
  dalethiriqhebrew: 0x05D305B4,
  daletholam: 0x05D305B9,
  daletholamhebrew: 0x05D305B9,
  daletpatah: 0x05D305B7,
  daletpatahhebrew: 0x05D305B7,
  daletqamats: 0x05D305B8,
  daletqamatshebrew: 0x05D305B8,
  daletqubuts: 0x05D305BB,
  daletqubutshebrew: 0x05D305BB,
  daletsegol: 0x05D305B6,
  daletsegolhebrew: 0x05D305B6,
  daletsheva: 0x05D305B0,
  daletshevahebrew: 0x05D305B0,
  dalettsere: 0x05D305B5,
  dalettserehebrew: 0x05D305B5,
  dalfinalarabic: 0xFEAA,
  dammaarabic: 0x064F,
  dammalowarabic: 0x064F,
  dammatanaltonearabic: 0x064C,
  dammatanarabic: 0x064C,
  danda: 0x0964,
  dargahebrew: 0x05A7,
  dargalefthebrew: 0x05A7,
  dasiapneumatacyrilliccmb: 0x0485,
  dblGrave: 0xF6D3,
  dblanglebracketleft: 0x300A,
  dblanglebracketleftvertical: 0xFE3D,
  dblanglebracketright: 0x300B,
  dblanglebracketrightvertical: 0xFE3E,
  dblarchinvertedbelowcmb: 0x032B,
  dblarrowleft: 0x21D4,
  dblarrowright: 0x21D2,
  dbldanda: 0x0965,
  dblgrave: 0xF6D6,
  dblgravecmb: 0x030F,
  dblintegral: 0x222C,
  dbllowline: 0x2017,
  dbllowlinecmb: 0x0333,
  dbloverlinecmb: 0x033F,
  dblprimemod: 0x02BA,
  dblverticalbar: 0x2016,
  dblverticallineabovecmb: 0x030E,
  dbopomofo: 0x3109,
  dbsquare: 0x33C8,
  dcaron: 0x010F,
  dcedilla: 0x1E11,
  dcircle: 0x24D3,
  dcircumflexbelow: 0x1E13,
  dcroat: 0x0111,
  ddabengali: 0x09A1,
  ddadeva: 0x0921,
  ddagujarati: 0x0AA1,
  ddagurmukhi: 0x0A21,
  ddalarabic: 0x0688,
  ddalfinalarabic: 0xFB89,
  dddhadeva: 0x095C,
  ddhabengali: 0x09A2,
  ddhadeva: 0x0922,
  ddhagujarati: 0x0AA2,
  ddhagurmukhi: 0x0A22,
  ddotaccent: 0x1E0B,
  ddotbelow: 0x1E0D,
  decimalseparatorarabic: 0x066B,
  decimalseparatorpersian: 0x066B,
  decyrillic: 0x0434,
  degree: 0x00B0,
  dehihebrew: 0x05AD,
  dehiragana: 0x3067,
  deicoptic: 0x03EF,
  dekatakana: 0x30C7,
  deleteleft: 0x232B,
  deleteright: 0x2326,
  delta: 0x03B4,
  deltaturned: 0x018D,
  denominatorminusonenumeratorbengali: 0x09F8,
  dezh: 0x02A4,
  dhabengali: 0x09A7,
  dhadeva: 0x0927,
  dhagujarati: 0x0AA7,
  dhagurmukhi: 0x0A27,
  dhook: 0x0257,
  dialytikatonos: 0x0385,
  dialytikatonoscmb: 0x0344,
  diamond: 0x2666,
  diamondsuitwhite: 0x2662,
  dieresis: 0x00A8,
  dieresisacute: 0xF6D7,
  dieresisbelowcmb: 0x0324,
  dieresiscmb: 0x0308,
  dieresisgrave: 0xF6D8,
  dieresistonos: 0x0385,
  dihiragana: 0x3062,
  dikatakana: 0x30C2,
  dittomark: 0x3003,
  divide: 0x00F7,
  divides: 0x2223,
  divisionslash: 0x2215,
  djecyrillic: 0x0452,
  dkshade: 0x2593,
  dlinebelow: 0x1E0F,
  dlsquare: 0x3397,
  dmacron: 0x0111,
  dmonospace: 0xFF44,
  dnblock: 0x2584,
  dochadathai: 0x0E0E,
  dodekthai: 0x0E14,
  dohiragana: 0x3069,
  dokatakana: 0x30C9,
  dollar: 0x0024,
  dollarinferior: 0xF6E3,
  dollarmonospace: 0xFF04,
  dollaroldstyle: 0xF724,
  dollarsmall: 0xFE69,
  dollarsuperior: 0xF6E4,
  dong: 0x20AB,
  dorusquare: 0x3326,
  dotaccent: 0x02D9,
  dotaccentcmb: 0x0307,
  dotbelowcmb: 0x0323,
  dotbelowcomb: 0x0323,
  dotkatakana: 0x30FB,
  dotlessi: 0x0131,
  dotlessj: 0xF6BE,
  dotlessjstrokehook: 0x0284,
  dotmath: 0x22C5,
  dottedcircle: 0x25CC,
  doubleyodpatah: 0xFB1F,
  doubleyodpatahhebrew: 0xFB1F,
  downtackbelowcmb: 0x031E,
  downtackmod: 0x02D5,
  dparen: 0x249F,
  dsuperior: 0xF6EB,
  dtail: 0x0256,
  dtopbar: 0x018C,
  duhiragana: 0x3065,
  dukatakana: 0x30C5,
  dz: 0x01F3,
  dzaltone: 0x02A3,
  dzcaron: 0x01C6,
  dzcurl: 0x02A5,
  dzeabkhasiancyrillic: 0x04E1,
  dzecyrillic: 0x0455,
  dzhecyrillic: 0x045F,
  e: 0x0065,
  eacute: 0x00E9,
  earth: 0x2641,
  ebengali: 0x098F,
  ebopomofo: 0x311C,
  ebreve: 0x0115,
  ecandradeva: 0x090D,
  ecandragujarati: 0x0A8D,
  ecandravowelsigndeva: 0x0945,
  ecandravowelsigngujarati: 0x0AC5,
  ecaron: 0x011B,
  ecedillabreve: 0x1E1D,
  echarmenian: 0x0565,
  echyiwnarmenian: 0x0587,
  ecircle: 0x24D4,
  ecircumflex: 0x00EA,
  ecircumflexacute: 0x1EBF,
  ecircumflexbelow: 0x1E19,
  ecircumflexdotbelow: 0x1EC7,
  ecircumflexgrave: 0x1EC1,
  ecircumflexhookabove: 0x1EC3,
  ecircumflextilde: 0x1EC5,
  ecyrillic: 0x0454,
  edblgrave: 0x0205,
  edeva: 0x090F,
  edieresis: 0x00EB,
  edot: 0x0117,
  edotaccent: 0x0117,
  edotbelow: 0x1EB9,
  eegurmukhi: 0x0A0F,
  eematragurmukhi: 0x0A47,
  efcyrillic: 0x0444,
  egrave: 0x00E8,
  egujarati: 0x0A8F,
  eharmenian: 0x0567,
  ehbopomofo: 0x311D,
  ehiragana: 0x3048,
  ehookabove: 0x1EBB,
  eibopomofo: 0x311F,
  eight: 0x0038,
  eightarabic: 0x0668,
  eightbengali: 0x09EE,
  eightcircle: 0x2467,
  eightcircleinversesansserif: 0x2791,
  eightdeva: 0x096E,
  eighteencircle: 0x2471,
  eighteenparen: 0x2485,
  eighteenperiod: 0x2499,
  eightgujarati: 0x0AEE,
  eightgurmukhi: 0x0A6E,
  eighthackarabic: 0x0668,
  eighthangzhou: 0x3028,
  eighthnotebeamed: 0x266B,
  eightideographicparen: 0x3227,
  eightinferior: 0x2088,
  eightmonospace: 0xFF18,
  eightoldstyle: 0xF738,
  eightparen: 0x247B,
  eightperiod: 0x248F,
  eightpersian: 0x06F8,
  eightroman: 0x2177,
  eightsuperior: 0x2078,
  eightthai: 0x0E58,
  einvertedbreve: 0x0207,
  eiotifiedcyrillic: 0x0465,
  ekatakana: 0x30A8,
  ekatakanahalfwidth: 0xFF74,
  ekonkargurmukhi: 0x0A74,
  ekorean: 0x3154,
  elcyrillic: 0x043B,
  element: 0x2208,
  elevencircle: 0x246A,
  elevenparen: 0x247E,
  elevenperiod: 0x2492,
  elevenroman: 0x217A,
  ellipsis: 0x2026,
  ellipsisvertical: 0x22EE,
  emacron: 0x0113,
  emacronacute: 0x1E17,
  emacrongrave: 0x1E15,
  emcyrillic: 0x043C,
  emdash: 0x2014,
  emdashvertical: 0xFE31,
  emonospace: 0xFF45,
  emphasismarkarmenian: 0x055B,
  emptyset: 0x2205,
  enbopomofo: 0x3123,
  encyrillic: 0x043D,
  endash: 0x2013,
  endashvertical: 0xFE32,
  endescendercyrillic: 0x04A3,
  eng: 0x014B,
  engbopomofo: 0x3125,
  enghecyrillic: 0x04A5,
  enhookcyrillic: 0x04C8,
  enspace: 0x2002,
  eogonek: 0x0119,
  eokorean: 0x3153,
  eopen: 0x025B,
  eopenclosed: 0x029A,
  eopenreversed: 0x025C,
  eopenreversedclosed: 0x025E,
  eopenreversedhook: 0x025D,
  eparen: 0x24A0,
  epsilon: 0x03B5,
  epsilontonos: 0x03AD,
  equal: 0x003D,
  equalmonospace: 0xFF1D,
  equalsmall: 0xFE66,
  equalsuperior: 0x207C,
  equivalence: 0x2261,
  erbopomofo: 0x3126,
  ercyrillic: 0x0440,
  ereversed: 0x0258,
  ereversedcyrillic: 0x044D,
  escyrillic: 0x0441,
  esdescendercyrillic: 0x04AB,
  esh: 0x0283,
  eshcurl: 0x0286,
  eshortdeva: 0x090E,
  eshortvowelsigndeva: 0x0946,
  eshreversedloop: 0x01AA,
  eshsquatreversed: 0x0285,
  esmallhiragana: 0x3047,
  esmallkatakana: 0x30A7,
  esmallkatakanahalfwidth: 0xFF6A,
  estimated: 0x212E,
  esuperior: 0xF6EC,
  eta: 0x03B7,
  etarmenian: 0x0568,
  etatonos: 0x03AE,
  eth: 0x00F0,
  etilde: 0x1EBD,
  etildebelow: 0x1E1B,
  etnahtafoukhhebrew: 0x0591,
  etnahtafoukhlefthebrew: 0x0591,
  etnahtahebrew: 0x0591,
  etnahtalefthebrew: 0x0591,
  eturned: 0x01DD,
  eukorean: 0x3161,
  euro: 0x20AC,
  evowelsignbengali: 0x09C7,
  evowelsigndeva: 0x0947,
  evowelsigngujarati: 0x0AC7,
  exclam: 0x0021,
  exclamarmenian: 0x055C,
  exclamdbl: 0x203C,
  exclamdown: 0x00A1,
  exclamdownsmall: 0xF7A1,
  exclammonospace: 0xFF01,
  exclamsmall: 0xF721,
  existential: 0x2203,
  ezh: 0x0292,
  ezhcaron: 0x01EF,
  ezhcurl: 0x0293,
  ezhreversed: 0x01B9,
  ezhtail: 0x01BA,
  f: 0x0066,
  fadeva: 0x095E,
  fagurmukhi: 0x0A5E,
  fahrenheit: 0x2109,
  fathaarabic: 0x064E,
  fathalowarabic: 0x064E,
  fathatanarabic: 0x064B,
  fbopomofo: 0x3108,
  fcircle: 0x24D5,
  fdotaccent: 0x1E1F,
  feharabic: 0x0641,
  feharmenian: 0x0586,
  fehfinalarabic: 0xFED2,
  fehinitialarabic: 0xFED3,
  fehmedialarabic: 0xFED4,
  feicoptic: 0x03E5,
  female: 0x2640,
  ff: 0xFB00,
  ffi: 0xFB03,
  ffl: 0xFB04,
  fi: 0xFB01,
  fifteencircle: 0x246E,
  fifteenparen: 0x2482,
  fifteenperiod: 0x2496,
  figuredash: 0x2012,
  filledbox: 0x25A0,
  filledrect: 0x25AC,
  finalkaf: 0x05DA,
  finalkafdagesh: 0xFB3A,
  finalkafdageshhebrew: 0xFB3A,
  finalkafhebrew: 0x05DA,
  finalkafqamats: 0x05DA05B8,
  finalkafqamatshebrew: 0x05DA05B8,
  finalkafsheva: 0x05DA05B0,
  finalkafshevahebrew: 0x05DA05B0,
  finalmem: 0x05DD,
  finalmemhebrew: 0x05DD,
  finalnun: 0x05DF,
  finalnunhebrew: 0x05DF,
  finalpe: 0x05E3,
  finalpehebrew: 0x05E3,
  finaltsadi: 0x05E5,
  finaltsadihebrew: 0x05E5,
  firsttonechinese: 0x02C9,
  fisheye: 0x25C9,
  fitacyrillic: 0x0473,
  five: 0x0035,
  fivearabic: 0x0665,
  fivebengali: 0x09EB,
  fivecircle: 0x2464,
  fivecircleinversesansserif: 0x278E,
  fivedeva: 0x096B,
  fiveeighths: 0x215D,
  fivegujarati: 0x0AEB,
  fivegurmukhi: 0x0A6B,
  fivehackarabic: 0x0665,
  fivehangzhou: 0x3025,
  fiveideographicparen: 0x3224,
  fiveinferior: 0x2085,
  fivemonospace: 0xFF15,
  fiveoldstyle: 0xF735,
  fiveparen: 0x2478,
  fiveperiod: 0x248C,
  fivepersian: 0x06F5,
  fiveroman: 0x2174,
  fivesuperior: 0x2075,
  fivethai: 0x0E55,
  fl: 0xFB02,
  florin: 0x0192,
  fmonospace: 0xFF46,
  fmsquare: 0x3399,
  fofanthai: 0x0E1F,
  fofathai: 0x0E1D,
  fongmanthai: 0x0E4F,
  forall: 0x2200,
  four: 0x0034,
  fourarabic: 0x0664,
  fourbengali: 0x09EA,
  fourcircle: 0x2463,
  fourcircleinversesansserif: 0x278D,
  fourdeva: 0x096A,
  fourgujarati: 0x0AEA,
  fourgurmukhi: 0x0A6A,
  fourhackarabic: 0x0664,
  fourhangzhou: 0x3024,
  fourideographicparen: 0x3223,
  fourinferior: 0x2084,
  fourmonospace: 0xFF14,
  fournumeratorbengali: 0x09F7,
  fouroldstyle: 0xF734,
  fourparen: 0x2477,
  fourperiod: 0x248B,
  fourpersian: 0x06F4,
  fourroman: 0x2173,
  foursuperior: 0x2074,
  fourteencircle: 0x246D,
  fourteenparen: 0x2481,
  fourteenperiod: 0x2495,
  fourthai: 0x0E54,
  fourthtonechinese: 0x02CB,
  fparen: 0x24A1,
  fraction: 0x2044,
  franc: 0x20A3,
  g: 0x0067,
  gabengali: 0x0997,
  gacute: 0x01F5,
  gadeva: 0x0917,
  gafarabic: 0x06AF,
  gaffinalarabic: 0xFB93,
  gafinitialarabic: 0xFB94,
  gafmedialarabic: 0xFB95,
  gagujarati: 0x0A97,
  gagurmukhi: 0x0A17,
  gahiragana: 0x304C,
  gakatakana: 0x30AC,
  gamma: 0x03B3,
  gammalatinsmall: 0x0263,
  gammasuperior: 0x02E0,
  gangiacoptic: 0x03EB,
  gbopomofo: 0x310D,
  gbreve: 0x011F,
  gcaron: 0x01E7,
  gcedilla: 0x0123,
  gcircle: 0x24D6,
  gcircumflex: 0x011D,
  gcommaaccent: 0x0123,
  gdot: 0x0121,
  gdotaccent: 0x0121,
  gecyrillic: 0x0433,
  gehiragana: 0x3052,
  gekatakana: 0x30B2,
  geometricallyequal: 0x2251,
  gereshaccenthebrew: 0x059C,
  gereshhebrew: 0x05F3,
  gereshmuqdamhebrew: 0x059D,
  germandbls: 0x00DF,
  gershayimaccenthebrew: 0x059E,
  gershayimhebrew: 0x05F4,
  getamark: 0x3013,
  ghabengali: 0x0998,
  ghadarmenian: 0x0572,
  ghadeva: 0x0918,
  ghagujarati: 0x0A98,
  ghagurmukhi: 0x0A18,
  ghainarabic: 0x063A,
  ghainfinalarabic: 0xFECE,
  ghaininitialarabic: 0xFECF,
  ghainmedialarabic: 0xFED0,
  ghemiddlehookcyrillic: 0x0495,
  ghestrokecyrillic: 0x0493,
  gheupturncyrillic: 0x0491,
  ghhadeva: 0x095A,
  ghhagurmukhi: 0x0A5A,
  ghook: 0x0260,
  ghzsquare: 0x3393,
  gihiragana: 0x304E,
  gikatakana: 0x30AE,
  gimarmenian: 0x0563,
  gimel: 0x05D2,
  gimeldagesh: 0xFB32,
  gimeldageshhebrew: 0xFB32,
  gimelhebrew: 0x05D2,
  gjecyrillic: 0x0453,
  glottalinvertedstroke: 0x01BE,
  glottalstop: 0x0294,
  glottalstopinverted: 0x0296,
  glottalstopmod: 0x02C0,
  glottalstopreversed: 0x0295,
  glottalstopreversedmod: 0x02C1,
  glottalstopreversedsuperior: 0x02E4,
  glottalstopstroke: 0x02A1,
  glottalstopstrokereversed: 0x02A2,
  gmacron: 0x1E21,
  gmonospace: 0xFF47,
  gohiragana: 0x3054,
  gokatakana: 0x30B4,
  gparen: 0x24A2,
  gpasquare: 0x33AC,
  gradient: 0x2207,
  grave: 0x0060,
  gravebelowcmb: 0x0316,
  gravecmb: 0x0300,
  gravecomb: 0x0300,
  gravedeva: 0x0953,
  gravelowmod: 0x02CE,
  gravemonospace: 0xFF40,
  gravetonecmb: 0x0340,
  greater: 0x003E,
  greaterequal: 0x2265,
  greaterequalorless: 0x22DB,
  greatermonospace: 0xFF1E,
  greaterorequivalent: 0x2273,
  greaterorless: 0x2277,
  greateroverequal: 0x2267,
  greatersmall: 0xFE65,
  gscript: 0x0261,
  gstroke: 0x01E5,
  guhiragana: 0x3050,
  guillemotleft: 0x00AB,
  guillemotright: 0x00BB,
  guilsinglleft: 0x2039,
  guilsinglright: 0x203A,
  gukatakana: 0x30B0,
  guramusquare: 0x3318,
  gysquare: 0x33C9,
  h: 0x0068,
  haabkhasiancyrillic: 0x04A9,
  haaltonearabic: 0x06C1,
  habengali: 0x09B9,
  hadescendercyrillic: 0x04B3,
  hadeva: 0x0939,
  hagujarati: 0x0AB9,
  hagurmukhi: 0x0A39,
  haharabic: 0x062D,
  hahfinalarabic: 0xFEA2,
  hahinitialarabic: 0xFEA3,
  hahiragana: 0x306F,
  hahmedialarabic: 0xFEA4,
  haitusquare: 0x332A,
  hakatakana: 0x30CF,
  hakatakanahalfwidth: 0xFF8A,
  halantgurmukhi: 0x0A4D,
  hamzaarabic: 0x0621,
  hamzadammaarabic: 0x0621064F,
  hamzadammatanarabic: 0x0621064C,
  hamzafathaarabic: 0x0621064E,
  hamzafathatanarabic: 0x0621064B,
  hamzalowarabic: 0x0621,
  hamzalowkasraarabic: 0x06210650,
  hamzalowkasratanarabic: 0x0621064D,
  hamzasukunarabic: 0x06210652,
  hangulfiller: 0x3164,
  hardsigncyrillic: 0x044A,
  harpoonleftbarbup: 0x21BC,
  harpoonrightbarbup: 0x21C0,
  hasquare: 0x33CA,
  hatafpatah: 0x05B2,
  hatafpatah16: 0x05B2,
  hatafpatah23: 0x05B2,
  hatafpatah2f: 0x05B2,
  hatafpatahhebrew: 0x05B2,
  hatafpatahnarrowhebrew: 0x05B2,
  hatafpatahquarterhebrew: 0x05B2,
  hatafpatahwidehebrew: 0x05B2,
  hatafqamats: 0x05B3,
  hatafqamats1b: 0x05B3,
  hatafqamats28: 0x05B3,
  hatafqamats34: 0x05B3,
  hatafqamatshebrew: 0x05B3,
  hatafqamatsnarrowhebrew: 0x05B3,
  hatafqamatsquarterhebrew: 0x05B3,
  hatafqamatswidehebrew: 0x05B3,
  hatafsegol: 0x05B1,
  hatafsegol17: 0x05B1,
  hatafsegol24: 0x05B1,
  hatafsegol30: 0x05B1,
  hatafsegolhebrew: 0x05B1,
  hatafsegolnarrowhebrew: 0x05B1,
  hatafsegolquarterhebrew: 0x05B1,
  hatafsegolwidehebrew: 0x05B1,
  hbar: 0x0127,
  hbopomofo: 0x310F,
  hbrevebelow: 0x1E2B,
  hcedilla: 0x1E29,
  hcircle: 0x24D7,
  hcircumflex: 0x0125,
  hdieresis: 0x1E27,
  hdotaccent: 0x1E23,
  hdotbelow: 0x1E25,
  he: 0x05D4,
  heart: 0x2665,
  heartsuitblack: 0x2665,
  heartsuitwhite: 0x2661,
  hedagesh: 0xFB34,
  hedageshhebrew: 0xFB34,
  hehaltonearabic: 0x06C1,
  heharabic: 0x0647,
  hehebrew: 0x05D4,
  hehfinalaltonearabic: 0xFBA7,
  hehfinalalttwoarabic: 0xFEEA,
  hehfinalarabic: 0xFEEA,
  hehhamzaabovefinalarabic: 0xFBA5,
  hehhamzaaboveisolatedarabic: 0xFBA4,
  hehinitialaltonearabic: 0xFBA8,
  hehinitialarabic: 0xFEEB,
  hehiragana: 0x3078,
  hehmedialaltonearabic: 0xFBA9,
  hehmedialarabic: 0xFEEC,
  heiseierasquare: 0x337B,
  hekatakana: 0x30D8,
  hekatakanahalfwidth: 0xFF8D,
  hekutaarusquare: 0x3336,
  henghook: 0x0267,
  herutusquare: 0x3339,
  het: 0x05D7,
  hethebrew: 0x05D7,
  hhook: 0x0266,
  hhooksuperior: 0x02B1,
  hieuhacirclekorean: 0x327B,
  hieuhaparenkorean: 0x321B,
  hieuhcirclekorean: 0x326D,
  hieuhkorean: 0x314E,
  hieuhparenkorean: 0x320D,
  hihiragana: 0x3072,
  hikatakana: 0x30D2,
  hikatakanahalfwidth: 0xFF8B,
  hiriq: 0x05B4,
  hiriq14: 0x05B4,
  hiriq21: 0x05B4,
  hiriq2d: 0x05B4,
  hiriqhebrew: 0x05B4,
  hiriqnarrowhebrew: 0x05B4,
  hiriqquarterhebrew: 0x05B4,
  hiriqwidehebrew: 0x05B4,
  hlinebelow: 0x1E96,
  hmonospace: 0xFF48,
  hoarmenian: 0x0570,
  hohipthai: 0x0E2B,
  hohiragana: 0x307B,
  hokatakana: 0x30DB,
  hokatakanahalfwidth: 0xFF8E,
  holam: 0x05B9,
  holam19: 0x05B9,
  holam26: 0x05B9,
  holam32: 0x05B9,
  holamhebrew: 0x05B9,
  holamnarrowhebrew: 0x05B9,
  holamquarterhebrew: 0x05B9,
  holamwidehebrew: 0x05B9,
  honokhukthai: 0x0E2E,
  hookabovecomb: 0x0309,
  hookcmb: 0x0309,
  hookpalatalizedbelowcmb: 0x0321,
  hookretroflexbelowcmb: 0x0322,
  hoonsquare: 0x3342,
  horicoptic: 0x03E9,
  horizontalbar: 0x2015,
  horncmb: 0x031B,
  hotsprings: 0x2668,
  house: 0x2302,
  hparen: 0x24A3,
  hsuperior: 0x02B0,
  hturned: 0x0265,
  huhiragana: 0x3075,
  huiitosquare: 0x3333,
  hukatakana: 0x30D5,
  hukatakanahalfwidth: 0xFF8C,
  hungarumlaut: 0x02DD,
  hungarumlautcmb: 0x030B,
  hv: 0x0195,
  hyphen: 0x002D,
  hypheninferior: 0xF6E5,
  hyphenmonospace: 0xFF0D,
  hyphensmall: 0xFE63,
  hyphensuperior: 0xF6E6,
  hyphentwo: 0x2010,
  i: 0x0069,
  iacute: 0x00ED,
  iacyrillic: 0x044F,
  ibengali: 0x0987,
  ibopomofo: 0x3127,
  ibreve: 0x012D,
  icaron: 0x01D0,
  icircle: 0x24D8,
  icircumflex: 0x00EE,
  icyrillic: 0x0456,
  idblgrave: 0x0209,
  ideographearthcircle: 0x328F,
  ideographfirecircle: 0x328B,
  ideographicallianceparen: 0x323F,
  ideographiccallparen: 0x323A,
  ideographiccentrecircle: 0x32A5,
  ideographicclose: 0x3006,
  ideographiccomma: 0x3001,
  ideographiccommaleft: 0xFF64,
  ideographiccongratulationparen: 0x3237,
  ideographiccorrectcircle: 0x32A3,
  ideographicearthparen: 0x322F,
  ideographicenterpriseparen: 0x323D,
  ideographicexcellentcircle: 0x329D,
  ideographicfestivalparen: 0x3240,
  ideographicfinancialcircle: 0x3296,
  ideographicfinancialparen: 0x3236,
  ideographicfireparen: 0x322B,
  ideographichaveparen: 0x3232,
  ideographichighcircle: 0x32A4,
  ideographiciterationmark: 0x3005,
  ideographiclaborcircle: 0x3298,
  ideographiclaborparen: 0x3238,
  ideographicleftcircle: 0x32A7,
  ideographiclowcircle: 0x32A6,
  ideographicmedicinecircle: 0x32A9,
  ideographicmetalparen: 0x322E,
  ideographicmoonparen: 0x322A,
  ideographicnameparen: 0x3234,
  ideographicperiod: 0x3002,
  ideographicprintcircle: 0x329E,
  ideographicreachparen: 0x3243,
  ideographicrepresentparen: 0x3239,
  ideographicresourceparen: 0x323E,
  ideographicrightcircle: 0x32A8,
  ideographicsecretcircle: 0x3299,
  ideographicselfparen: 0x3242,
  ideographicsocietyparen: 0x3233,
  ideographicspace: 0x3000,
  ideographicspecialparen: 0x3235,
  ideographicstockparen: 0x3231,
  ideographicstudyparen: 0x323B,
  ideographicsunparen: 0x3230,
  ideographicsuperviseparen: 0x323C,
  ideographicwaterparen: 0x322C,
  ideographicwoodparen: 0x322D,
  ideographiczero: 0x3007,
  ideographmetalcircle: 0x328E,
  ideographmooncircle: 0x328A,
  ideographnamecircle: 0x3294,
  ideographsuncircle: 0x3290,
  ideographwatercircle: 0x328C,
  ideographwoodcircle: 0x328D,
  ideva: 0x0907,
  idieresis: 0x00EF,
  idieresisacute: 0x1E2F,
  idieresiscyrillic: 0x04E5,
  idotbelow: 0x1ECB,
  iebrevecyrillic: 0x04D7,
  iecyrillic: 0x0435,
  ieungacirclekorean: 0x3275,
  ieungaparenkorean: 0x3215,
  ieungcirclekorean: 0x3267,
  ieungkorean: 0x3147,
  ieungparenkorean: 0x3207,
  igrave: 0x00EC,
  igujarati: 0x0A87,
  igurmukhi: 0x0A07,
  ihiragana: 0x3044,
  ihookabove: 0x1EC9,
  iibengali: 0x0988,
  iicyrillic: 0x0438,
  iideva: 0x0908,
  iigujarati: 0x0A88,
  iigurmukhi: 0x0A08,
  iimatragurmukhi: 0x0A40,
  iinvertedbreve: 0x020B,
  iishortcyrillic: 0x0439,
  iivowelsignbengali: 0x09C0,
  iivowelsigndeva: 0x0940,
  iivowelsigngujarati: 0x0AC0,
  ij: 0x0133,
  ikatakana: 0x30A4,
  ikatakanahalfwidth: 0xFF72,
  ikorean: 0x3163,
  ilde: 0x02DC,
  iluyhebrew: 0x05AC,
  imacron: 0x012B,
  imacroncyrillic: 0x04E3,
  imageorapproximatelyequal: 0x2253,
  imatragurmukhi: 0x0A3F,
  imonospace: 0xFF49,
  increment: 0x2206,
  infinity: 0x221E,
  iniarmenian: 0x056B,
  integral: 0x222B,
  integralbottom: 0x2321,
  integralbt: 0x2321,
  integralex: 0xF8F5,
  integraltop: 0x2320,
  integraltp: 0x2320,
  intersection: 0x2229,
  intisquare: 0x3305,
  invbullet: 0x25D8,
  invcircle: 0x25D9,
  invsmileface: 0x263B,
  iocyrillic: 0x0451,
  iogonek: 0x012F,
  iota: 0x03B9,
  iotadieresis: 0x03CA,
  iotadieresistonos: 0x0390,
  iotalatin: 0x0269,
  iotatonos: 0x03AF,
  iparen: 0x24A4,
  irigurmukhi: 0x0A72,
  ismallhiragana: 0x3043,
  ismallkatakana: 0x30A3,
  ismallkatakanahalfwidth: 0xFF68,
  issharbengali: 0x09FA,
  istroke: 0x0268,
  isuperior: 0xF6ED,
  iterationhiragana: 0x309D,
  iterationkatakana: 0x30FD,
  itilde: 0x0129,
  itildebelow: 0x1E2D,
  iubopomofo: 0x3129,
  iucyrillic: 0x044E,
  ivowelsignbengali: 0x09BF,
  ivowelsigndeva: 0x093F,
  ivowelsigngujarati: 0x0ABF,
  izhitsacyrillic: 0x0475,
  izhitsadblgravecyrillic: 0x0477,
  j: 0x006A,
  jaarmenian: 0x0571,
  jabengali: 0x099C,
  jadeva: 0x091C,
  jagujarati: 0x0A9C,
  jagurmukhi: 0x0A1C,
  jbopomofo: 0x3110,
  jcaron: 0x01F0,
  jcircle: 0x24D9,
  jcircumflex: 0x0135,
  jcrossedtail: 0x029D,
  jdotlessstroke: 0x025F,
  jecyrillic: 0x0458,
  jeemarabic: 0x062C,
  jeemfinalarabic: 0xFE9E,
  jeeminitialarabic: 0xFE9F,
  jeemmedialarabic: 0xFEA0,
  jeharabic: 0x0698,
  jehfinalarabic: 0xFB8B,
  jhabengali: 0x099D,
  jhadeva: 0x091D,
  jhagujarati: 0x0A9D,
  jhagurmukhi: 0x0A1D,
  jheharmenian: 0x057B,
  jis: 0x3004,
  jmonospace: 0xFF4A,
  jparen: 0x24A5,
  jsuperior: 0x02B2,
  k: 0x006B,
  kabashkircyrillic: 0x04A1,
  kabengali: 0x0995,
  kacute: 0x1E31,
  kacyrillic: 0x043A,
  kadescendercyrillic: 0x049B,
  kadeva: 0x0915,
  kaf: 0x05DB,
  kafarabic: 0x0643,
  kafdagesh: 0xFB3B,
  kafdageshhebrew: 0xFB3B,
  kaffinalarabic: 0xFEDA,
  kafhebrew: 0x05DB,
  kafinitialarabic: 0xFEDB,
  kafmedialarabic: 0xFEDC,
  kafrafehebrew: 0xFB4D,
  kagujarati: 0x0A95,
  kagurmukhi: 0x0A15,
  kahiragana: 0x304B,
  kahookcyrillic: 0x04C4,
  kakatakana: 0x30AB,
  kakatakanahalfwidth: 0xFF76,
  kappa: 0x03BA,
  kappasymbolgreek: 0x03F0,
  kapyeounmieumkorean: 0x3171,
  kapyeounphieuphkorean: 0x3184,
  kapyeounpieupkorean: 0x3178,
  kapyeounssangpieupkorean: 0x3179,
  karoriisquare: 0x330D,
  kashidaautoarabic: 0x0640,
  kashidaautonosidebearingarabic: 0x0640,
  kasmallkatakana: 0x30F5,
  kasquare: 0x3384,
  kasraarabic: 0x0650,
  kasratanarabic: 0x064D,
  kastrokecyrillic: 0x049F,
  katahiraprolongmarkhalfwidth: 0xFF70,
  kaverticalstrokecyrillic: 0x049D,
  kbopomofo: 0x310E,
  kcalsquare: 0x3389,
  kcaron: 0x01E9,
  kcedilla: 0x0137,
  kcircle: 0x24DA,
  kcommaaccent: 0x0137,
  kdotbelow: 0x1E33,
  keharmenian: 0x0584,
  kehiragana: 0x3051,
  kekatakana: 0x30B1,
  kekatakanahalfwidth: 0xFF79,
  kenarmenian: 0x056F,
  kesmallkatakana: 0x30F6,
  kgreenlandic: 0x0138,
  khabengali: 0x0996,
  khacyrillic: 0x0445,
  khadeva: 0x0916,
  khagujarati: 0x0A96,
  khagurmukhi: 0x0A16,
  khaharabic: 0x062E,
  khahfinalarabic: 0xFEA6,
  khahinitialarabic: 0xFEA7,
  khahmedialarabic: 0xFEA8,
  kheicoptic: 0x03E7,
  khhadeva: 0x0959,
  khhagurmukhi: 0x0A59,
  khieukhacirclekorean: 0x3278,
  khieukhaparenkorean: 0x3218,
  khieukhcirclekorean: 0x326A,
  khieukhkorean: 0x314B,
  khieukhparenkorean: 0x320A,
  khokhaithai: 0x0E02,
  khokhonthai: 0x0E05,
  khokhuatthai: 0x0E03,
  khokhwaithai: 0x0E04,
  khomutthai: 0x0E5B,
  khook: 0x0199,
  khorakhangthai: 0x0E06,
  khzsquare: 0x3391,
  kihiragana: 0x304D,
  kikatakana: 0x30AD,
  kikatakanahalfwidth: 0xFF77,
  kiroguramusquare: 0x3315,
  kiromeetorusquare: 0x3316,
  kirosquare: 0x3314,
  kiyeokacirclekorean: 0x326E,
  kiyeokaparenkorean: 0x320E,
  kiyeokcirclekorean: 0x3260,
  kiyeokkorean: 0x3131,
  kiyeokparenkorean: 0x3200,
  kiyeoksioskorean: 0x3133,
  kjecyrillic: 0x045C,
  klinebelow: 0x1E35,
  klsquare: 0x3398,
  kmcubedsquare: 0x33A6,
  kmonospace: 0xFF4B,
  kmsquaredsquare: 0x33A2,
  kohiragana: 0x3053,
  kohmsquare: 0x33C0,
  kokaithai: 0x0E01,
  kokatakana: 0x30B3,
  kokatakanahalfwidth: 0xFF7A,
  kooposquare: 0x331E,
  koppacyrillic: 0x0481,
  koreanstandardsymbol: 0x327F,
  koroniscmb: 0x0343,
  kparen: 0x24A6,
  kpasquare: 0x33AA,
  ksicyrillic: 0x046F,
  ktsquare: 0x33CF,
  kturned: 0x029E,
  kuhiragana: 0x304F,
  kukatakana: 0x30AF,
  kukatakanahalfwidth: 0xFF78,
  kvsquare: 0x33B8,
  kwsquare: 0x33BE,
  l: 0x006C,
  labengali: 0x09B2,
  lacute: 0x013A,
  ladeva: 0x0932,
  lagujarati: 0x0AB2,
  lagurmukhi: 0x0A32,
  lakkhangyaothai: 0x0E45,
  lamaleffinalarabic: 0xFEFC,
  lamalefhamzaabovefinalarabic: 0xFEF8,
  lamalefhamzaaboveisolatedarabic: 0xFEF7,
  lamalefhamzabelowfinalarabic: 0xFEFA,
  lamalefhamzabelowisolatedarabic: 0xFEF9,
  lamalefisolatedarabic: 0xFEFB,
  lamalefmaddaabovefinalarabic: 0xFEF6,
  lamalefmaddaaboveisolatedarabic: 0xFEF5,
  lamarabic: 0x0644,
  lambda: 0x03BB,
  lambdastroke: 0x019B,
  lamed: 0x05DC,
  lameddagesh: 0xFB3C,
  lameddageshhebrew: 0xFB3C,
  lamedhebrew: 0x05DC,
  lamedholam: 0x05DC05B9,
  lamedholamdagesh: '05DC 05B9 05BC',
  lamedholamdageshhebrew: '05DC 05B9 05BC',
  lamedholamhebrew: 0x05DC05B9,
  lamfinalarabic: 0xFEDE,
  lamhahinitialarabic: 0xFCCA,
  laminitialarabic: 0xFEDF,
  lamjeeminitialarabic: 0xFCC9,
  lamkhahinitialarabic: 0xFCCB,
  lamlamhehisolatedarabic: 0xFDF2,
  lammedialarabic: 0xFEE0,
  lammeemhahinitialarabic: 0xFD88,
  lammeeminitialarabic: 0xFCCC,
  lammeemjeeminitialarabic: 'FEDF FEE4 FEA0',
  lammeemkhahinitialarabic: 'FEDF FEE4 FEA8',
  largecircle: 0x25EF,
  lbar: 0x019A,
  lbelt: 0x026C,
  lbopomofo: 0x310C,
  lcaron: 0x013E,
  lcedilla: 0x013C,
  lcircle: 0x24DB,
  lcircumflexbelow: 0x1E3D,
  lcommaaccent: 0x013C,
  ldot: 0x0140,
  ldotaccent: 0x0140,
  ldotbelow: 0x1E37,
  ldotbelowmacron: 0x1E39,
  leftangleabovecmb: 0x031A,
  lefttackbelowcmb: 0x0318,
  less: 0x003C,
  lessequal: 0x2264,
  lessequalorgreater: 0x22DA,
  lessmonospace: 0xFF1C,
  lessorequivalent: 0x2272,
  lessorgreater: 0x2276,
  lessoverequal: 0x2266,
  lesssmall: 0xFE64,
  lezh: 0x026E,
  lfblock: 0x258C,
  lhookretroflex: 0x026D,
  lira: 0x20A4,
  liwnarmenian: 0x056C,
  lj: 0x01C9,
  ljecyrillic: 0x0459,
  ll: 0xF6C0,
  lladeva: 0x0933,
  llagujarati: 0x0AB3,
  llinebelow: 0x1E3B,
  llladeva: 0x0934,
  llvocalicbengali: 0x09E1,
  llvocalicdeva: 0x0961,
  llvocalicvowelsignbengali: 0x09E3,
  llvocalicvowelsigndeva: 0x0963,
  lmiddletilde: 0x026B,
  lmonospace: 0xFF4C,
  lmsquare: 0x33D0,
  lochulathai: 0x0E2C,
  logicaland: 0x2227,
  logicalnot: 0x00AC,
  logicalnotreversed: 0x2310,
  logicalor: 0x2228,
  lolingthai: 0x0E25,
  longs: 0x017F,
  lowlinecenterline: 0xFE4E,
  lowlinecmb: 0x0332,
  lowlinedashed: 0xFE4D,
  lozenge: 0x25CA,
  lparen: 0x24A7,
  lslash: 0x0142,
  lsquare: 0x2113,
  lsuperior: 0xF6EE,
  ltshade: 0x2591,
  luthai: 0x0E26,
  lvocalicbengali: 0x098C,
  lvocalicdeva: 0x090C,
  lvocalicvowelsignbengali: 0x09E2,
  lvocalicvowelsigndeva: 0x0962,
  lxsquare: 0x33D3,
  m: 0x006D,
  mabengali: 0x09AE,
  macron: 0x00AF,
  macronbelowcmb: 0x0331,
  macroncmb: 0x0304,
  macronlowmod: 0x02CD,
  macronmonospace: 0xFFE3,
  macute: 0x1E3F,
  madeva: 0x092E,
  magujarati: 0x0AAE,
  magurmukhi: 0x0A2E,
  mahapakhhebrew: 0x05A4,
  mahapakhlefthebrew: 0x05A4,
  mahiragana: 0x307E,
  maichattawalowleftthai: 0xF895,
  maichattawalowrightthai: 0xF894,
  maichattawathai: 0x0E4B,
  maichattawaupperleftthai: 0xF893,
  maieklowleftthai: 0xF88C,
  maieklowrightthai: 0xF88B,
  maiekthai: 0x0E48,
  maiekupperleftthai: 0xF88A,
  maihanakatleftthai: 0xF884,
  maihanakatthai: 0x0E31,
  maitaikhuleftthai: 0xF889,
  maitaikhuthai: 0x0E47,
  maitholowleftthai: 0xF88F,
  maitholowrightthai: 0xF88E,
  maithothai: 0x0E49,
  maithoupperleftthai: 0xF88D,
  maitrilowleftthai: 0xF892,
  maitrilowrightthai: 0xF891,
  maitrithai: 0x0E4A,
  maitriupperleftthai: 0xF890,
  maiyamokthai: 0x0E46,
  makatakana: 0x30DE,
  makatakanahalfwidth: 0xFF8F,
  male: 0x2642,
  mansyonsquare: 0x3347,
  maqafhebrew: 0x05BE,
  mars: 0x2642,
  masoracirclehebrew: 0x05AF,
  masquare: 0x3383,
  mbopomofo: 0x3107,
  mbsquare: 0x33D4,
  mcircle: 0x24DC,
  mcubedsquare: 0x33A5,
  mdotaccent: 0x1E41,
  mdotbelow: 0x1E43,
  meemarabic: 0x0645,
  meemfinalarabic: 0xFEE2,
  meeminitialarabic: 0xFEE3,
  meemmedialarabic: 0xFEE4,
  meemmeeminitialarabic: 0xFCD1,
  meemmeemisolatedarabic: 0xFC48,
  meetorusquare: 0x334D,
  mehiragana: 0x3081,
  meizierasquare: 0x337E,
  mekatakana: 0x30E1,
  mekatakanahalfwidth: 0xFF92,
  mem: 0x05DE,
  memdagesh: 0xFB3E,
  memdageshhebrew: 0xFB3E,
  memhebrew: 0x05DE,
  menarmenian: 0x0574,
  merkhahebrew: 0x05A5,
  merkhakefulahebrew: 0x05A6,
  merkhakefulalefthebrew: 0x05A6,
  merkhalefthebrew: 0x05A5,
  mhook: 0x0271,
  mhzsquare: 0x3392,
  middledotkatakanahalfwidth: 0xFF65,
  middot: 0x00B7,
  mieumacirclekorean: 0x3272,
  mieumaparenkorean: 0x3212,
  mieumcirclekorean: 0x3264,
  mieumkorean: 0x3141,
  mieumpansioskorean: 0x3170,
  mieumparenkorean: 0x3204,
  mieumpieupkorean: 0x316E,
  mieumsioskorean: 0x316F,
  mihiragana: 0x307F,
  mikatakana: 0x30DF,
  mikatakanahalfwidth: 0xFF90,
  minus: 0x2212,
  minusbelowcmb: 0x0320,
  minuscircle: 0x2296,
  minusmod: 0x02D7,
  minusplus: 0x2213,
  minute: 0x2032,
  miribaarusquare: 0x334A,
  mirisquare: 0x3349,
  mlonglegturned: 0x0270,
  mlsquare: 0x3396,
  mmcubedsquare: 0x33A3,
  mmonospace: 0xFF4D,
  mmsquaredsquare: 0x339F,
  mohiragana: 0x3082,
  mohmsquare: 0x33C1,
  mokatakana: 0x30E2,
  mokatakanahalfwidth: 0xFF93,
  molsquare: 0x33D6,
  momathai: 0x0E21,
  moverssquare: 0x33A7,
  moverssquaredsquare: 0x33A8,
  mparen: 0x24A8,
  mpasquare: 0x33AB,
  mssquare: 0x33B3,
  msuperior: 0xF6EF,
  mturned: 0x026F,
  mu: 0x00B5,
  mu1: 0x00B5,
  muasquare: 0x3382,
  muchgreater: 0x226B,
  muchless: 0x226A,
  mufsquare: 0x338C,
  mugreek: 0x03BC,
  mugsquare: 0x338D,
  muhiragana: 0x3080,
  mukatakana: 0x30E0,
  mukatakanahalfwidth: 0xFF91,
  mulsquare: 0x3395,
  multiply: 0x00D7,
  mumsquare: 0x339B,
  munahhebrew: 0x05A3,
  munahlefthebrew: 0x05A3,
  musicalnote: 0x266A,
  musicalnotedbl: 0x266B,
  musicflatsign: 0x266D,
  musicsharpsign: 0x266F,
  mussquare: 0x33B2,
  muvsquare: 0x33B6,
  muwsquare: 0x33BC,
  mvmegasquare: 0x33B9,
  mvsquare: 0x33B7,
  mwmegasquare: 0x33BF,
  mwsquare: 0x33BD,
  n: 0x006E,
  nabengali: 0x09A8,
  nabla: 0x2207,
  nacute: 0x0144,
  nadeva: 0x0928,
  nagujarati: 0x0AA8,
  nagurmukhi: 0x0A28,
  nahiragana: 0x306A,
  nakatakana: 0x30CA,
  nakatakanahalfwidth: 0xFF85,
  napostrophe: 0x0149,
  nasquare: 0x3381,
  nbopomofo: 0x310B,
  nbspace: 0x00A0,
  ncaron: 0x0148,
  ncedilla: 0x0146,
  ncircle: 0x24DD,
  ncircumflexbelow: 0x1E4B,
  ncommaaccent: 0x0146,
  ndotaccent: 0x1E45,
  ndotbelow: 0x1E47,
  nehiragana: 0x306D,
  nekatakana: 0x30CD,
  nekatakanahalfwidth: 0xFF88,
  newsheqelsign: 0x20AA,
  nfsquare: 0x338B,
  ngabengali: 0x0999,
  ngadeva: 0x0919,
  ngagujarati: 0x0A99,
  ngagurmukhi: 0x0A19,
  ngonguthai: 0x0E07,
  nhiragana: 0x3093,
  nhookleft: 0x0272,
  nhookretroflex: 0x0273,
  nieunacirclekorean: 0x326F,
  nieunaparenkorean: 0x320F,
  nieuncieuckorean: 0x3135,
  nieuncirclekorean: 0x3261,
  nieunhieuhkorean: 0x3136,
  nieunkorean: 0x3134,
  nieunpansioskorean: 0x3168,
  nieunparenkorean: 0x3201,
  nieunsioskorean: 0x3167,
  nieuntikeutkorean: 0x3166,
  nihiragana: 0x306B,
  nikatakana: 0x30CB,
  nikatakanahalfwidth: 0xFF86,
  nikhahitleftthai: 0xF899,
  nikhahitthai: 0x0E4D,
  nine: 0x0039,
  ninearabic: 0x0669,
  ninebengali: 0x09EF,
  ninecircle: 0x2468,
  ninecircleinversesansserif: 0x2792,
  ninedeva: 0x096F,
  ninegujarati: 0x0AEF,
  ninegurmukhi: 0x0A6F,
  ninehackarabic: 0x0669,
  ninehangzhou: 0x3029,
  nineideographicparen: 0x3228,
  nineinferior: 0x2089,
  ninemonospace: 0xFF19,
  nineoldstyle: 0xF739,
  nineparen: 0x247C,
  nineperiod: 0x2490,
  ninepersian: 0x06F9,
  nineroman: 0x2178,
  ninesuperior: 0x2079,
  nineteencircle: 0x2472,
  nineteenparen: 0x2486,
  nineteenperiod: 0x249A,
  ninethai: 0x0E59,
  nj: 0x01CC,
  njecyrillic: 0x045A,
  nkatakana: 0x30F3,
  nkatakanahalfwidth: 0xFF9D,
  nlegrightlong: 0x019E,
  nlinebelow: 0x1E49,
  nmonospace: 0xFF4E,
  nmsquare: 0x339A,
  nnabengali: 0x09A3,
  nnadeva: 0x0923,
  nnagujarati: 0x0AA3,
  nnagurmukhi: 0x0A23,
  nnnadeva: 0x0929,
  nohiragana: 0x306E,
  nokatakana: 0x30CE,
  nokatakanahalfwidth: 0xFF89,
  nonbreakingspace: 0x00A0,
  nonenthai: 0x0E13,
  nonuthai: 0x0E19,
  noonarabic: 0x0646,
  noonfinalarabic: 0xFEE6,
  noonghunnaarabic: 0x06BA,
  noonghunnafinalarabic: 0xFB9F,
  noonhehinitialarabic: 0xFEE7FEEC,
  nooninitialarabic: 0xFEE7,
  noonjeeminitialarabic: 0xFCD2,
  noonjeemisolatedarabic: 0xFC4B,
  noonmedialarabic: 0xFEE8,
  noonmeeminitialarabic: 0xFCD5,
  noonmeemisolatedarabic: 0xFC4E,
  noonnoonfinalarabic: 0xFC8D,
  notcontains: 0x220C,
  notelement: 0x2209,
  notelementof: 0x2209,
  notequal: 0x2260,
  notgreater: 0x226F,
  notgreaternorequal: 0x2271,
  notgreaternorless: 0x2279,
  notidentical: 0x2262,
  notless: 0x226E,
  notlessnorequal: 0x2270,
  notparallel: 0x2226,
  notprecedes: 0x2280,
  notsubset: 0x2284,
  notsucceeds: 0x2281,
  notsuperset: 0x2285,
  nowarmenian: 0x0576,
  nparen: 0x24A9,
  nssquare: 0x33B1,
  nsuperior: 0x207F,
  ntilde: 0x00F1,
  nu: 0x03BD,
  nuhiragana: 0x306C,
  nukatakana: 0x30CC,
  nukatakanahalfwidth: 0xFF87,
  nuktabengali: 0x09BC,
  nuktadeva: 0x093C,
  nuktagujarati: 0x0ABC,
  nuktagurmukhi: 0x0A3C,
  numbersign: 0x0023,
  numbersignmonospace: 0xFF03,
  numbersignsmall: 0xFE5F,
  numeralsigngreek: 0x0374,
  numeralsignlowergreek: 0x0375,
  numero: 0x2116,
  nun: 0x05E0,
  nundagesh: 0xFB40,
  nundageshhebrew: 0xFB40,
  nunhebrew: 0x05E0,
  nvsquare: 0x33B5,
  nwsquare: 0x33BB,
  nyabengali: 0x099E,
  nyadeva: 0x091E,
  nyagujarati: 0x0A9E,
  nyagurmukhi: 0x0A1E,
  o: 0x006F,
  oacute: 0x00F3,
  oangthai: 0x0E2D,
  obarred: 0x0275,
  obarredcyrillic: 0x04E9,
  obarreddieresiscyrillic: 0x04EB,
  obengali: 0x0993,
  obopomofo: 0x311B,
  obreve: 0x014F,
  ocandradeva: 0x0911,
  ocandragujarati: 0x0A91,
  ocandravowelsigndeva: 0x0949,
  ocandravowelsigngujarati: 0x0AC9,
  ocaron: 0x01D2,
  ocircle: 0x24DE,
  ocircumflex: 0x00F4,
  ocircumflexacute: 0x1ED1,
  ocircumflexdotbelow: 0x1ED9,
  ocircumflexgrave: 0x1ED3,
  ocircumflexhookabove: 0x1ED5,
  ocircumflextilde: 0x1ED7,
  ocyrillic: 0x043E,
  odblacute: 0x0151,
  odblgrave: 0x020D,
  odeva: 0x0913,
  odieresis: 0x00F6,
  odieresiscyrillic: 0x04E7,
  odotbelow: 0x1ECD,
  oe: 0x0153,
  oekorean: 0x315A,
  ogonek: 0x02DB,
  ogonekcmb: 0x0328,
  ograve: 0x00F2,
  ogujarati: 0x0A93,
  oharmenian: 0x0585,
  ohiragana: 0x304A,
  ohookabove: 0x1ECF,
  ohorn: 0x01A1,
  ohornacute: 0x1EDB,
  ohorndotbelow: 0x1EE3,
  ohorngrave: 0x1EDD,
  ohornhookabove: 0x1EDF,
  ohorntilde: 0x1EE1,
  ohungarumlaut: 0x0151,
  oi: 0x01A3,
  oinvertedbreve: 0x020F,
  okatakana: 0x30AA,
  okatakanahalfwidth: 0xFF75,
  okorean: 0x3157,
  olehebrew: 0x05AB,
  omacron: 0x014D,
  omacronacute: 0x1E53,
  omacrongrave: 0x1E51,
  omdeva: 0x0950,
  omega: 0x03C9,
  omega1: 0x03D6,
  omegacyrillic: 0x0461,
  omegalatinclosed: 0x0277,
  omegaroundcyrillic: 0x047B,
  omegatitlocyrillic: 0x047D,
  omegatonos: 0x03CE,
  omgujarati: 0x0AD0,
  omicron: 0x03BF,
  omicrontonos: 0x03CC,
  omonospace: 0xFF4F,
  one: 0x0031,
  onearabic: 0x0661,
  onebengali: 0x09E7,
  onecircle: 0x2460,
  onecircleinversesansserif: 0x278A,
  onedeva: 0x0967,
  onedotenleader: 0x2024,
  oneeighth: 0x215B,
  onefitted: 0xF6DC,
  onegujarati: 0x0AE7,
  onegurmukhi: 0x0A67,
  onehackarabic: 0x0661,
  onehalf: 0x00BD,
  onehangzhou: 0x3021,
  oneideographicparen: 0x3220,
  oneinferior: 0x2081,
  onemonospace: 0xFF11,
  onenumeratorbengali: 0x09F4,
  oneoldstyle: 0xF731,
  oneparen: 0x2474,
  oneperiod: 0x2488,
  onepersian: 0x06F1,
  onequarter: 0x00BC,
  oneroman: 0x2170,
  onesuperior: 0x00B9,
  onethai: 0x0E51,
  onethird: 0x2153,
  oogonek: 0x01EB,
  oogonekmacron: 0x01ED,
  oogurmukhi: 0x0A13,
  oomatragurmukhi: 0x0A4B,
  oopen: 0x0254,
  oparen: 0x24AA,
  openbullet: 0x25E6,
  option: 0x2325,
  ordfeminine: 0x00AA,
  ordmasculine: 0x00BA,
  orthogonal: 0x221F,
  oshortdeva: 0x0912,
  oshortvowelsigndeva: 0x094A,
  oslash: 0x00F8,
  oslashacute: 0x01FF,
  osmallhiragana: 0x3049,
  osmallkatakana: 0x30A9,
  osmallkatakanahalfwidth: 0xFF6B,
  ostrokeacute: 0x01FF,
  osuperior: 0xF6F0,
  otcyrillic: 0x047F,
  otilde: 0x00F5,
  otildeacute: 0x1E4D,
  otildedieresis: 0x1E4F,
  oubopomofo: 0x3121,
  overline: 0x203E,
  overlinecenterline: 0xFE4A,
  overlinecmb: 0x0305,
  overlinedashed: 0xFE49,
  overlinedblwavy: 0xFE4C,
  overlinewavy: 0xFE4B,
  overscore: 0x00AF,
  ovowelsignbengali: 0x09CB,
  ovowelsigndeva: 0x094B,
  ovowelsigngujarati: 0x0ACB,
  p: 0x0070,
  paampssquare: 0x3380,
  paasentosquare: 0x332B,
  pabengali: 0x09AA,
  pacute: 0x1E55,
  padeva: 0x092A,
  pagedown: 0x21DF,
  pageup: 0x21DE,
  pagujarati: 0x0AAA,
  pagurmukhi: 0x0A2A,
  pahiragana: 0x3071,
  paiyannoithai: 0x0E2F,
  pakatakana: 0x30D1,
  palatalizationcyrilliccmb: 0x0484,
  palochkacyrillic: 0x04C0,
  pansioskorean: 0x317F,
  paragraph: 0x00B6,
  parallel: 0x2225,
  parenleft: 0x0028,
  parenleftaltonearabic: 0xFD3E,
  parenleftbt: 0xF8ED,
  parenleftex: 0xF8EC,
  parenleftinferior: 0x208D,
  parenleftmonospace: 0xFF08,
  parenleftsmall: 0xFE59,
  parenleftsuperior: 0x207D,
  parenlefttp: 0xF8EB,
  parenleftvertical: 0xFE35,
  parenright: 0x0029,
  parenrightaltonearabic: 0xFD3F,
  parenrightbt: 0xF8F8,
  parenrightex: 0xF8F7,
  parenrightinferior: 0x208E,
  parenrightmonospace: 0xFF09,
  parenrightsmall: 0xFE5A,
  parenrightsuperior: 0x207E,
  parenrighttp: 0xF8F6,
  parenrightvertical: 0xFE36,
  partialdiff: 0x2202,
  paseqhebrew: 0x05C0,
  pashtahebrew: 0x0599,
  pasquare: 0x33A9,
  patah: 0x05B7,
  patah11: 0x05B7,
  patah1d: 0x05B7,
  patah2a: 0x05B7,
  patahhebrew: 0x05B7,
  patahnarrowhebrew: 0x05B7,
  patahquarterhebrew: 0x05B7,
  patahwidehebrew: 0x05B7,
  pazerhebrew: 0x05A1,
  pbopomofo: 0x3106,
  pcircle: 0x24DF,
  pdotaccent: 0x1E57,
  pe: 0x05E4,
  pecyrillic: 0x043F,
  pedagesh: 0xFB44,
  pedageshhebrew: 0xFB44,
  peezisquare: 0x333B,
  pefinaldageshhebrew: 0xFB43,
  peharabic: 0x067E,
  peharmenian: 0x057A,
  pehebrew: 0x05E4,
  pehfinalarabic: 0xFB57,
  pehinitialarabic: 0xFB58,
  pehiragana: 0x307A,
  pehmedialarabic: 0xFB59,
  pekatakana: 0x30DA,
  pemiddlehookcyrillic: 0x04A7,
  perafehebrew: 0xFB4E,
  percent: 0x0025,
  percentarabic: 0x066A,
  percentmonospace: 0xFF05,
  percentsmall: 0xFE6A,
  period: 0x002E,
  periodarmenian: 0x0589,
  periodcentered: 0x00B7,
  periodhalfwidth: 0xFF61,
  periodinferior: 0xF6E7,
  periodmonospace: 0xFF0E,
  periodsmall: 0xFE52,
  periodsuperior: 0xF6E8,
  perispomenigreekcmb: 0x0342,
  perpendicular: 0x22A5,
  perthousand: 0x2030,
  peseta: 0x20A7,
  pfsquare: 0x338A,
  phabengali: 0x09AB,
  phadeva: 0x092B,
  phagujarati: 0x0AAB,
  phagurmukhi: 0x0A2B,
  phi: 0x03C6,
  phi1: 0x03D5,
  phieuphacirclekorean: 0x327A,
  phieuphaparenkorean: 0x321A,
  phieuphcirclekorean: 0x326C,
  phieuphkorean: 0x314D,
  phieuphparenkorean: 0x320C,
  philatin: 0x0278,
  phinthuthai: 0x0E3A,
  phisymbolgreek: 0x03D5,
  phook: 0x01A5,
  phophanthai: 0x0E1E,
  phophungthai: 0x0E1C,
  phosamphaothai: 0x0E20,
  pi: 0x03C0,
  pieupacirclekorean: 0x3273,
  pieupaparenkorean: 0x3213,
  pieupcieuckorean: 0x3176,
  pieupcirclekorean: 0x3265,
  pieupkiyeokkorean: 0x3172,
  pieupkorean: 0x3142,
  pieupparenkorean: 0x3205,
  pieupsioskiyeokkorean: 0x3174,
  pieupsioskorean: 0x3144,
  pieupsiostikeutkorean: 0x3175,
  pieupthieuthkorean: 0x3177,
  pieuptikeutkorean: 0x3173,
  pihiragana: 0x3074,
  pikatakana: 0x30D4,
  pisymbolgreek: 0x03D6,
  piwrarmenian: 0x0583,
  plus: 0x002B,
  plusbelowcmb: 0x031F,
  pluscircle: 0x2295,
  plusminus: 0x00B1,
  plusmod: 0x02D6,
  plusmonospace: 0xFF0B,
  plussmall: 0xFE62,
  plussuperior: 0x207A,
  pmonospace: 0xFF50,
  pmsquare: 0x33D8,
  pohiragana: 0x307D,
  pointingindexdownwhite: 0x261F,
  pointingindexleftwhite: 0x261C,
  pointingindexrightwhite: 0x261E,
  pointingindexupwhite: 0x261D,
  pokatakana: 0x30DD,
  poplathai: 0x0E1B,
  postalmark: 0x3012,
  postalmarkface: 0x3020,
  pparen: 0x24AB,
  precedes: 0x227A,
  prescription: 0x211E,
  primemod: 0x02B9,
  primereversed: 0x2035,
  product: 0x220F,
  projective: 0x2305,
  prolongedkana: 0x30FC,
  propellor: 0x2318,
  propersubset: 0x2282,
  propersuperset: 0x2283,
  proportion: 0x2237,
  proportional: 0x221D,
  psi: 0x03C8,
  psicyrillic: 0x0471,
  psilipneumatacyrilliccmb: 0x0486,
  pssquare: 0x33B0,
  puhiragana: 0x3077,
  pukatakana: 0x30D7,
  pvsquare: 0x33B4,
  pwsquare: 0x33BA,
  q: 0x0071,
  qadeva: 0x0958,
  qadmahebrew: 0x05A8,
  qafarabic: 0x0642,
  qaffinalarabic: 0xFED6,
  qafinitialarabic: 0xFED7,
  qafmedialarabic: 0xFED8,
  qamats: 0x05B8,
  qamats10: 0x05B8,
  qamats1a: 0x05B8,
  qamats1c: 0x05B8,
  qamats27: 0x05B8,
  qamats29: 0x05B8,
  qamats33: 0x05B8,
  qamatsde: 0x05B8,
  qamatshebrew: 0x05B8,
  qamatsnarrowhebrew: 0x05B8,
  qamatsqatanhebrew: 0x05B8,
  qamatsqatannarrowhebrew: 0x05B8,
  qamatsqatanquarterhebrew: 0x05B8,
  qamatsqatanwidehebrew: 0x05B8,
  qamatsquarterhebrew: 0x05B8,
  qamatswidehebrew: 0x05B8,
  qarneyparahebrew: 0x059F,
  qbopomofo: 0x3111,
  qcircle: 0x24E0,
  qhook: 0x02A0,
  qmonospace: 0xFF51,
  qof: 0x05E7,
  qofdagesh: 0xFB47,
  qofdageshhebrew: 0xFB47,
  qofhatafpatah: 0x05E705B2,
  qofhatafpatahhebrew: 0x05E705B2,
  qofhatafsegol: 0x05E705B1,
  qofhatafsegolhebrew: 0x05E705B1,
  qofhebrew: 0x05E7,
  qofhiriq: 0x05E705B4,
  qofhiriqhebrew: 0x05E705B4,
  qofholam: 0x05E705B9,
  qofholamhebrew: 0x05E705B9,
  qofpatah: 0x05E705B7,
  qofpatahhebrew: 0x05E705B7,
  qofqamats: 0x05E705B8,
  qofqamatshebrew: 0x05E705B8,
  qofqubuts: 0x05E705BB,
  qofqubutshebrew: 0x05E705BB,
  qofsegol: 0x05E705B6,
  qofsegolhebrew: 0x05E705B6,
  qofsheva: 0x05E705B0,
  qofshevahebrew: 0x05E705B0,
  qoftsere: 0x05E705B5,
  qoftserehebrew: 0x05E705B5,
  qparen: 0x24AC,
  quarternote: 0x2669,
  qubuts: 0x05BB,
  qubuts18: 0x05BB,
  qubuts25: 0x05BB,
  qubuts31: 0x05BB,
  qubutshebrew: 0x05BB,
  qubutsnarrowhebrew: 0x05BB,
  qubutsquarterhebrew: 0x05BB,
  qubutswidehebrew: 0x05BB,
  question: 0x003F,
  questionarabic: 0x061F,
  questionarmenian: 0x055E,
  questiondown: 0x00BF,
  questiondownsmall: 0xF7BF,
  questiongreek: 0x037E,
  questionmonospace: 0xFF1F,
  questionsmall: 0xF73F,
  quotedbl: 0x0022,
  quotedblbase: 0x201E,
  quotedblleft: 0x201C,
  quotedblmonospace: 0xFF02,
  quotedblprime: 0x301E,
  quotedblprimereversed: 0x301D,
  quotedblright: 0x201D,
  quoteleft: 0x2018,
  quoteleftreversed: 0x201B,
  quotereversed: 0x201B,
  quoteright: 0x2019,
  quoterightn: 0x0149,
  quotesinglbase: 0x201A,
  quotesingle: 0x0027,
  quotesinglemonospace: 0xFF07,
  r: 0x0072,
  raarmenian: 0x057C,
  rabengali: 0x09B0,
  racute: 0x0155,
  radeva: 0x0930,
  radical: 0x221A,
  radicalex: 0xF8E5,
  radoverssquare: 0x33AE,
  radoverssquaredsquare: 0x33AF,
  radsquare: 0x33AD,
  rafe: 0x05BF,
  rafehebrew: 0x05BF,
  ragujarati: 0x0AB0,
  ragurmukhi: 0x0A30,
  rahiragana: 0x3089,
  rakatakana: 0x30E9,
  rakatakanahalfwidth: 0xFF97,
  ralowerdiagonalbengali: 0x09F1,
  ramiddlediagonalbengali: 0x09F0,
  ramshorn: 0x0264,
  ratio: 0x2236,
  rbopomofo: 0x3116,
  rcaron: 0x0159,
  rcedilla: 0x0157,
  rcircle: 0x24E1,
  rcommaaccent: 0x0157,
  rdblgrave: 0x0211,
  rdotaccent: 0x1E59,
  rdotbelow: 0x1E5B,
  rdotbelowmacron: 0x1E5D,
  referencemark: 0x203B,
  reflexsubset: 0x2286,
  reflexsuperset: 0x2287,
  registered: 0x00AE,
  registersans: 0xF8E8,
  registerserif: 0xF6DA,
  reharabic: 0x0631,
  reharmenian: 0x0580,
  rehfinalarabic: 0xFEAE,
  rehiragana: 0x308C,
  rehyehaleflamarabic: '0631 FEF3 FE8E 0644',
  rekatakana: 0x30EC,
  rekatakanahalfwidth: 0xFF9A,
  resh: 0x05E8,
  reshdageshhebrew: 0xFB48,
  reshhatafpatah: 0x05E805B2,
  reshhatafpatahhebrew: 0x05E805B2,
  reshhatafsegol: 0x05E805B1,
  reshhatafsegolhebrew: 0x05E805B1,
  reshhebrew: 0x05E8,
  reshhiriq: 0x05E805B4,
  reshhiriqhebrew: 0x05E805B4,
  reshholam: 0x05E805B9,
  reshholamhebrew: 0x05E805B9,
  reshpatah: 0x05E805B7,
  reshpatahhebrew: 0x05E805B7,
  reshqamats: 0x05E805B8,
  reshqamatshebrew: 0x05E805B8,
  reshqubuts: 0x05E805BB,
  reshqubutshebrew: 0x05E805BB,
  reshsegol: 0x05E805B6,
  reshsegolhebrew: 0x05E805B6,
  reshsheva: 0x05E805B0,
  reshshevahebrew: 0x05E805B0,
  reshtsere: 0x05E805B5,
  reshtserehebrew: 0x05E805B5,
  reversedtilde: 0x223D,
  reviahebrew: 0x0597,
  reviamugrashhebrew: 0x0597,
  revlogicalnot: 0x2310,
  rfishhook: 0x027E,
  rfishhookreversed: 0x027F,
  rhabengali: 0x09DD,
  rhadeva: 0x095D,
  rho: 0x03C1,
  rhook: 0x027D,
  rhookturned: 0x027B,
  rhookturnedsuperior: 0x02B5,
  rhosymbolgreek: 0x03F1,
  rhotichookmod: 0x02DE,
  rieulacirclekorean: 0x3271,
  rieulaparenkorean: 0x3211,
  rieulcirclekorean: 0x3263,
  rieulhieuhkorean: 0x3140,
  rieulkiyeokkorean: 0x313A,
  rieulkiyeoksioskorean: 0x3169,
  rieulkorean: 0x3139,
  rieulmieumkorean: 0x313B,
  rieulpansioskorean: 0x316C,
  rieulparenkorean: 0x3203,
  rieulphieuphkorean: 0x313F,
  rieulpieupkorean: 0x313C,
  rieulpieupsioskorean: 0x316B,
  rieulsioskorean: 0x313D,
  rieulthieuthkorean: 0x313E,
  rieultikeutkorean: 0x316A,
  rieulyeorinhieuhkorean: 0x316D,
  rightangle: 0x221F,
  righttackbelowcmb: 0x0319,
  righttriangle: 0x22BF,
  rihiragana: 0x308A,
  rikatakana: 0x30EA,
  rikatakanahalfwidth: 0xFF98,
  ring: 0x02DA,
  ringbelowcmb: 0x0325,
  ringcmb: 0x030A,
  ringhalfleft: 0x02BF,
  ringhalfleftarmenian: 0x0559,
  ringhalfleftbelowcmb: 0x031C,
  ringhalfleftcentered: 0x02D3,
  ringhalfright: 0x02BE,
  ringhalfrightbelowcmb: 0x0339,
  ringhalfrightcentered: 0x02D2,
  rinvertedbreve: 0x0213,
  rittorusquare: 0x3351,
  rlinebelow: 0x1E5F,
  rlongleg: 0x027C,
  rlonglegturned: 0x027A,
  rmonospace: 0xFF52,
  rohiragana: 0x308D,
  rokatakana: 0x30ED,
  rokatakanahalfwidth: 0xFF9B,
  roruathai: 0x0E23,
  rparen: 0x24AD,
  rrabengali: 0x09DC,
  rradeva: 0x0931,
  rragurmukhi: 0x0A5C,
  rreharabic: 0x0691,
  rrehfinalarabic: 0xFB8D,
  rrvocalicbengali: 0x09E0,
  rrvocalicdeva: 0x0960,
  rrvocalicgujarati: 0x0AE0,
  rrvocalicvowelsignbengali: 0x09C4,
  rrvocalicvowelsigndeva: 0x0944,
  rrvocalicvowelsigngujarati: 0x0AC4,
  rsuperior: 0xF6F1,
  rtblock: 0x2590,
  rturned: 0x0279,
  rturnedsuperior: 0x02B4,
  ruhiragana: 0x308B,
  rukatakana: 0x30EB,
  rukatakanahalfwidth: 0xFF99,
  rupeemarkbengali: 0x09F2,
  rupeesignbengali: 0x09F3,
  rupiah: 0xF6DD,
  ruthai: 0x0E24,
  rvocalicbengali: 0x098B,
  rvocalicdeva: 0x090B,
  rvocalicgujarati: 0x0A8B,
  rvocalicvowelsignbengali: 0x09C3,
  rvocalicvowelsigndeva: 0x0943,
  rvocalicvowelsigngujarati: 0x0AC3,
  s: 0x0073,
  sabengali: 0x09B8,
  sacute: 0x015B,
  sacutedotaccent: 0x1E65,
  sadarabic: 0x0635,
  sadeva: 0x0938,
  sadfinalarabic: 0xFEBA,
  sadinitialarabic: 0xFEBB,
  sadmedialarabic: 0xFEBC,
  sagujarati: 0x0AB8,
  sagurmukhi: 0x0A38,
  sahiragana: 0x3055,
  sakatakana: 0x30B5,
  sakatakanahalfwidth: 0xFF7B,
  sallallahoualayhewasallamarabic: 0xFDFA,
  samekh: 0x05E1,
  samekhdagesh: 0xFB41,
  samekhdageshhebrew: 0xFB41,
  samekhhebrew: 0x05E1,
  saraaathai: 0x0E32,
  saraaethai: 0x0E41,
  saraaimaimalaithai: 0x0E44,
  saraaimaimuanthai: 0x0E43,
  saraamthai: 0x0E33,
  saraathai: 0x0E30,
  saraethai: 0x0E40,
  saraiileftthai: 0xF886,
  saraiithai: 0x0E35,
  saraileftthai: 0xF885,
  saraithai: 0x0E34,
  saraothai: 0x0E42,
  saraueeleftthai: 0xF888,
  saraueethai: 0x0E37,
  saraueleftthai: 0xF887,
  sarauethai: 0x0E36,
  sarauthai: 0x0E38,
  sarauuthai: 0x0E39,
  sbopomofo: 0x3119,
  scaron: 0x0161,
  scarondotaccent: 0x1E67,
  scedilla: 0x015F,
  schwa: 0x0259,
  schwacyrillic: 0x04D9,
  schwadieresiscyrillic: 0x04DB,
  schwahook: 0x025A,
  scircle: 0x24E2,
  scircumflex: 0x015D,
  scommaaccent: 0x0219,
  sdotaccent: 0x1E61,
  sdotbelow: 0x1E63,
  sdotbelowdotaccent: 0x1E69,
  seagullbelowcmb: 0x033C,
  second: 0x2033,
  secondtonechinese: 0x02CA,
  section: 0x00A7,
  seenarabic: 0x0633,
  seenfinalarabic: 0xFEB2,
  seeninitialarabic: 0xFEB3,
  seenmedialarabic: 0xFEB4,
  segol: 0x05B6,
  segol13: 0x05B6,
  segol1f: 0x05B6,
  segol2c: 0x05B6,
  segolhebrew: 0x05B6,
  segolnarrowhebrew: 0x05B6,
  segolquarterhebrew: 0x05B6,
  segoltahebrew: 0x0592,
  segolwidehebrew: 0x05B6,
  seharmenian: 0x057D,
  sehiragana: 0x305B,
  sekatakana: 0x30BB,
  sekatakanahalfwidth: 0xFF7E,
  semicolon: 0x003B,
  semicolonarabic: 0x061B,
  semicolonmonospace: 0xFF1B,
  semicolonsmall: 0xFE54,
  semivoicedmarkkana: 0x309C,
  semivoicedmarkkanahalfwidth: 0xFF9F,
  sentisquare: 0x3322,
  sentosquare: 0x3323,
  seven: 0x0037,
  sevenarabic: 0x0667,
  sevenbengali: 0x09ED,
  sevencircle: 0x2466,
  sevencircleinversesansserif: 0x2790,
  sevendeva: 0x096D,
  seveneighths: 0x215E,
  sevengujarati: 0x0AED,
  sevengurmukhi: 0x0A6D,
  sevenhackarabic: 0x0667,
  sevenhangzhou: 0x3027,
  sevenideographicparen: 0x3226,
  seveninferior: 0x2087,
  sevenmonospace: 0xFF17,
  sevenoldstyle: 0xF737,
  sevenparen: 0x247A,
  sevenperiod: 0x248E,
  sevenpersian: 0x06F7,
  sevenroman: 0x2176,
  sevensuperior: 0x2077,
  seventeencircle: 0x2470,
  seventeenparen: 0x2484,
  seventeenperiod: 0x2498,
  seventhai: 0x0E57,
  sfthyphen: 0x00AD,
  shaarmenian: 0x0577,
  shabengali: 0x09B6,
  shacyrillic: 0x0448,
  shaddaarabic: 0x0651,
  shaddadammaarabic: 0xFC61,
  shaddadammatanarabic: 0xFC5E,
  shaddafathaarabic: 0xFC60,
  shaddafathatanarabic: 0x0651064B,
  shaddakasraarabic: 0xFC62,
  shaddakasratanarabic: 0xFC5F,
  shade: 0x2592,
  shadedark: 0x2593,
  shadelight: 0x2591,
  shademedium: 0x2592,
  shadeva: 0x0936,
  shagujarati: 0x0AB6,
  shagurmukhi: 0x0A36,
  shalshelethebrew: 0x0593,
  shbopomofo: 0x3115,
  shchacyrillic: 0x0449,
  sheenarabic: 0x0634,
  sheenfinalarabic: 0xFEB6,
  sheeninitialarabic: 0xFEB7,
  sheenmedialarabic: 0xFEB8,
  sheicoptic: 0x03E3,
  sheqel: 0x20AA,
  sheqelhebrew: 0x20AA,
  sheva: 0x05B0,
  sheva115: 0x05B0,
  sheva15: 0x05B0,
  sheva22: 0x05B0,
  sheva2e: 0x05B0,
  shevahebrew: 0x05B0,
  shevanarrowhebrew: 0x05B0,
  shevaquarterhebrew: 0x05B0,
  shevawidehebrew: 0x05B0,
  shhacyrillic: 0x04BB,
  shimacoptic: 0x03ED,
  shin: 0x05E9,
  shindagesh: 0xFB49,
  shindageshhebrew: 0xFB49,
  shindageshshindot: 0xFB2C,
  shindageshshindothebrew: 0xFB2C,
  shindageshsindot: 0xFB2D,
  shindageshsindothebrew: 0xFB2D,
  shindothebrew: 0x05C1,
  shinhebrew: 0x05E9,
  shinshindot: 0xFB2A,
  shinshindothebrew: 0xFB2A,
  shinsindot: 0xFB2B,
  shinsindothebrew: 0xFB2B,
  shook: 0x0282,
  sigma: 0x03C3,
  sigma1: 0x03C2,
  sigmafinal: 0x03C2,
  sigmalunatesymbolgreek: 0x03F2,
  sihiragana: 0x3057,
  sikatakana: 0x30B7,
  sikatakanahalfwidth: 0xFF7C,
  siluqhebrew: 0x05BD,
  siluqlefthebrew: 0x05BD,
  similar: 0x223C,
  sindothebrew: 0x05C2,
  siosacirclekorean: 0x3274,
  siosaparenkorean: 0x3214,
  sioscieuckorean: 0x317E,
  sioscirclekorean: 0x3266,
  sioskiyeokkorean: 0x317A,
  sioskorean: 0x3145,
  siosnieunkorean: 0x317B,
  siosparenkorean: 0x3206,
  siospieupkorean: 0x317D,
  siostikeutkorean: 0x317C,
  six: 0x0036,
  sixarabic: 0x0666,
  sixbengali: 0x09EC,
  sixcircle: 0x2465,
  sixcircleinversesansserif: 0x278F,
  sixdeva: 0x096C,
  sixgujarati: 0x0AEC,
  sixgurmukhi: 0x0A6C,
  sixhackarabic: 0x0666,
  sixhangzhou: 0x3026,
  sixideographicparen: 0x3225,
  sixinferior: 0x2086,
  sixmonospace: 0xFF16,
  sixoldstyle: 0xF736,
  sixparen: 0x2479,
  sixperiod: 0x248D,
  sixpersian: 0x06F6,
  sixroman: 0x2175,
  sixsuperior: 0x2076,
  sixteencircle: 0x246F,
  sixteencurrencydenominatorbengali: 0x09F9,
  sixteenparen: 0x2483,
  sixteenperiod: 0x2497,
  sixthai: 0x0E56,
  slash: 0x002F,
  slashmonospace: 0xFF0F,
  slong: 0x017F,
  slongdotaccent: 0x1E9B,
  smileface: 0x263A,
  smonospace: 0xFF53,
  sofpasuqhebrew: 0x05C3,
  softhyphen: 0x00AD,
  softsigncyrillic: 0x044C,
  sohiragana: 0x305D,
  sokatakana: 0x30BD,
  sokatakanahalfwidth: 0xFF7F,
  soliduslongoverlaycmb: 0x0338,
  solidusshortoverlaycmb: 0x0337,
  sorusithai: 0x0E29,
  sosalathai: 0x0E28,
  sosothai: 0x0E0B,
  sosuathai: 0x0E2A,
  space: 0x0020,
  spacehackarabic: 0x0020,
  spade: 0x2660,
  spadesuitblack: 0x2660,
  spadesuitwhite: 0x2664,
  sparen: 0x24AE,
  squarebelowcmb: 0x033B,
  squarecc: 0x33C4,
  squarecm: 0x339D,
  squarediagonalcrosshatchfill: 0x25A9,
  squarehorizontalfill: 0x25A4,
  squarekg: 0x338F,
  squarekm: 0x339E,
  squarekmcapital: 0x33CE,
  squareln: 0x33D1,
  squarelog: 0x33D2,
  squaremg: 0x338E,
  squaremil: 0x33D5,
  squaremm: 0x339C,
  squaremsquared: 0x33A1,
  squareorthogonalcrosshatchfill: 0x25A6,
  squareupperlefttolowerrightfill: 0x25A7,
  squareupperrighttolowerleftfill: 0x25A8,
  squareverticalfill: 0x25A5,
  squarewhitewithsmallblack: 0x25A3,
  srsquare: 0x33DB,
  ssabengali: 0x09B7,
  ssadeva: 0x0937,
  ssagujarati: 0x0AB7,
  ssangcieuckorean: 0x3149,
  ssanghieuhkorean: 0x3185,
  ssangieungkorean: 0x3180,
  ssangkiyeokkorean: 0x3132,
  ssangnieunkorean: 0x3165,
  ssangpieupkorean: 0x3143,
  ssangsioskorean: 0x3146,
  ssangtikeutkorean: 0x3138,
  ssuperior: 0xF6F2,
  sterling: 0x00A3,
  sterlingmonospace: 0xFFE1,
  strokelongoverlaycmb: 0x0336,
  strokeshortoverlaycmb: 0x0335,
  subset: 0x2282,
  subsetnotequal: 0x228A,
  subsetorequal: 0x2286,
  succeeds: 0x227B,
  suchthat: 0x220B,
  suhiragana: 0x3059,
  sukatakana: 0x30B9,
  sukatakanahalfwidth: 0xFF7D,
  sukunarabic: 0x0652,
  summation: 0x2211,
  sun: 0x263C,
  superset: 0x2283,
  supersetnotequal: 0x228B,
  supersetorequal: 0x2287,
  svsquare: 0x33DC,
  syouwaerasquare: 0x337C,
  t: 0x0074,
  tabengali: 0x09A4,
  tackdown: 0x22A4,
  tackleft: 0x22A3,
  tadeva: 0x0924,
  tagujarati: 0x0AA4,
  tagurmukhi: 0x0A24,
  taharabic: 0x0637,
  tahfinalarabic: 0xFEC2,
  tahinitialarabic: 0xFEC3,
  tahiragana: 0x305F,
  tahmedialarabic: 0xFEC4,
  taisyouerasquare: 0x337D,
  takatakana: 0x30BF,
  takatakanahalfwidth: 0xFF80,
  tatweelarabic: 0x0640,
  tau: 0x03C4,
  tav: 0x05EA,
  tavdages: 0xFB4A,
  tavdagesh: 0xFB4A,
  tavdageshhebrew: 0xFB4A,
  tavhebrew: 0x05EA,
  tbar: 0x0167,
  tbopomofo: 0x310A,
  tcaron: 0x0165,
  tccurl: 0x02A8,
  tcedilla: 0x0163,
  tcheharabic: 0x0686,
  tchehfinalarabic: 0xFB7B,
  tchehinitialarabic: 0xFB7C,
  tchehmedialarabic: 0xFB7D,
  tchehmeeminitialarabic: 0xFB7CFEE4,
  tcircle: 0x24E3,
  tcircumflexbelow: 0x1E71,
  tcommaaccent: 0x0163,
  tdieresis: 0x1E97,
  tdotaccent: 0x1E6B,
  tdotbelow: 0x1E6D,
  tecyrillic: 0x0442,
  tedescendercyrillic: 0x04AD,
  teharabic: 0x062A,
  tehfinalarabic: 0xFE96,
  tehhahinitialarabic: 0xFCA2,
  tehhahisolatedarabic: 0xFC0C,
  tehinitialarabic: 0xFE97,
  tehiragana: 0x3066,
  tehjeeminitialarabic: 0xFCA1,
  tehjeemisolatedarabic: 0xFC0B,
  tehmarbutaarabic: 0x0629,
  tehmarbutafinalarabic: 0xFE94,
  tehmedialarabic: 0xFE98,
  tehmeeminitialarabic: 0xFCA4,
  tehmeemisolatedarabic: 0xFC0E,
  tehnoonfinalarabic: 0xFC73,
  tekatakana: 0x30C6,
  tekatakanahalfwidth: 0xFF83,
  telephone: 0x2121,
  telephoneblack: 0x260E,
  telishagedolahebrew: 0x05A0,
  telishaqetanahebrew: 0x05A9,
  tencircle: 0x2469,
  tenideographicparen: 0x3229,
  tenparen: 0x247D,
  tenperiod: 0x2491,
  tenroman: 0x2179,
  tesh: 0x02A7,
  tet: 0x05D8,
  tetdagesh: 0xFB38,
  tetdageshhebrew: 0xFB38,
  tethebrew: 0x05D8,
  tetsecyrillic: 0x04B5,
  tevirhebrew: 0x059B,
  tevirlefthebrew: 0x059B,
  thabengali: 0x09A5,
  thadeva: 0x0925,
  thagujarati: 0x0AA5,
  thagurmukhi: 0x0A25,
  thalarabic: 0x0630,
  thalfinalarabic: 0xFEAC,
  thanthakhatlowleftthai: 0xF898,
  thanthakhatlowrightthai: 0xF897,
  thanthakhatthai: 0x0E4C,
  thanthakhatupperleftthai: 0xF896,
  theharabic: 0x062B,
  thehfinalarabic: 0xFE9A,
  thehinitialarabic: 0xFE9B,
  thehmedialarabic: 0xFE9C,
  thereexists: 0x2203,
  therefore: 0x2234,
  theta: 0x03B8,
  theta1: 0x03D1,
  thetasymbolgreek: 0x03D1,
  thieuthacirclekorean: 0x3279,
  thieuthaparenkorean: 0x3219,
  thieuthcirclekorean: 0x326B,
  thieuthkorean: 0x314C,
  thieuthparenkorean: 0x320B,
  thirteencircle: 0x246C,
  thirteenparen: 0x2480,
  thirteenperiod: 0x2494,
  thonangmonthothai: 0x0E11,
  thook: 0x01AD,
  thophuthaothai: 0x0E12,
  thorn: 0x00FE,
  thothahanthai: 0x0E17,
  thothanthai: 0x0E10,
  thothongthai: 0x0E18,
  thothungthai: 0x0E16,
  thousandcyrillic: 0x0482,
  thousandsseparatorarabic: 0x066C,
  thousandsseparatorpersian: 0x066C,
  three: 0x0033,
  threearabic: 0x0663,
  threebengali: 0x09E9,
  threecircle: 0x2462,
  threecircleinversesansserif: 0x278C,
  threedeva: 0x0969,
  threeeighths: 0x215C,
  threegujarati: 0x0AE9,
  threegurmukhi: 0x0A69,
  threehackarabic: 0x0663,
  threehangzhou: 0x3023,
  threeideographicparen: 0x3222,
  threeinferior: 0x2083,
  threemonospace: 0xFF13,
  threenumeratorbengali: 0x09F6,
  threeoldstyle: 0xF733,
  threeparen: 0x2476,
  threeperiod: 0x248A,
  threepersian: 0x06F3,
  threequarters: 0x00BE,
  threequartersemdash: 0xF6DE,
  threeroman: 0x2172,
  threesuperior: 0x00B3,
  threethai: 0x0E53,
  thzsquare: 0x3394,
  tihiragana: 0x3061,
  tikatakana: 0x30C1,
  tikatakanahalfwidth: 0xFF81,
  tikeutacirclekorean: 0x3270,
  tikeutaparenkorean: 0x3210,
  tikeutcirclekorean: 0x3262,
  tikeutkorean: 0x3137,
  tikeutparenkorean: 0x3202,
  tilde: 0x02DC,
  tildebelowcmb: 0x0330,
  tildecmb: 0x0303,
  tildecomb: 0x0303,
  tildedoublecmb: 0x0360,
  tildeoperator: 0x223C,
  tildeoverlaycmb: 0x0334,
  tildeverticalcmb: 0x033E,
  timescircle: 0x2297,
  tipehahebrew: 0x0596,
  tipehalefthebrew: 0x0596,
  tippigurmukhi: 0x0A70,
  titlocyrilliccmb: 0x0483,
  tiwnarmenian: 0x057F,
  tlinebelow: 0x1E6F,
  tmonospace: 0xFF54,
  toarmenian: 0x0569,
  tohiragana: 0x3068,
  tokatakana: 0x30C8,
  tokatakanahalfwidth: 0xFF84,
  tonebarextrahighmod: 0x02E5,
  tonebarextralowmod: 0x02E9,
  tonebarhighmod: 0x02E6,
  tonebarlowmod: 0x02E8,
  tonebarmidmod: 0x02E7,
  tonefive: 0x01BD,
  tonesix: 0x0185,
  tonetwo: 0x01A8,
  tonos: 0x0384,
  tonsquare: 0x3327,
  topatakthai: 0x0E0F,
  tortoiseshellbracketleft: 0x3014,
  tortoiseshellbracketleftsmall: 0xFE5D,
  tortoiseshellbracketleftvertical: 0xFE39,
  tortoiseshellbracketright: 0x3015,
  tortoiseshellbracketrightsmall: 0xFE5E,
  tortoiseshellbracketrightvertical: 0xFE3A,
  totaothai: 0x0E15,
  tpalatalhook: 0x01AB,
  tparen: 0x24AF,
  trademark: 0x2122,
  trademarksans: 0xF8EA,
  trademarkserif: 0xF6DB,
  tretroflexhook: 0x0288,
  triagdn: 0x25BC,
  triaglf: 0x25C4,
  triagrt: 0x25BA,
  triagup: 0x25B2,
  ts: 0x02A6,
  tsadi: 0x05E6,
  tsadidagesh: 0xFB46,
  tsadidageshhebrew: 0xFB46,
  tsadihebrew: 0x05E6,
  tsecyrillic: 0x0446,
  tsere: 0x05B5,
  tsere12: 0x05B5,
  tsere1e: 0x05B5,
  tsere2b: 0x05B5,
  tserehebrew: 0x05B5,
  tserenarrowhebrew: 0x05B5,
  tserequarterhebrew: 0x05B5,
  tserewidehebrew: 0x05B5,
  tshecyrillic: 0x045B,
  tsuperior: 0xF6F3,
  ttabengali: 0x099F,
  ttadeva: 0x091F,
  ttagujarati: 0x0A9F,
  ttagurmukhi: 0x0A1F,
  tteharabic: 0x0679,
  ttehfinalarabic: 0xFB67,
  ttehinitialarabic: 0xFB68,
  ttehmedialarabic: 0xFB69,
  tthabengali: 0x09A0,
  tthadeva: 0x0920,
  tthagujarati: 0x0AA0,
  tthagurmukhi: 0x0A20,
  tturned: 0x0287,
  tuhiragana: 0x3064,
  tukatakana: 0x30C4,
  tukatakanahalfwidth: 0xFF82,
  tusmallhiragana: 0x3063,
  tusmallkatakana: 0x30C3,
  tusmallkatakanahalfwidth: 0xFF6F,
  twelvecircle: 0x246B,
  twelveparen: 0x247F,
  twelveperiod: 0x2493,
  twelveroman: 0x217B,
  twentycircle: 0x2473,
  twentyhangzhou: 0x5344,
  twentyparen: 0x2487,
  twentyperiod: 0x249B,
  two: 0x0032,
  twoarabic: 0x0662,
  twobengali: 0x09E8,
  twocircle: 0x2461,
  twocircleinversesansserif: 0x278B,
  twodeva: 0x0968,
  twodotenleader: 0x2025,
  twodotleader: 0x2025,
  twodotleadervertical: 0xFE30,
  twogujarati: 0x0AE8,
  twogurmukhi: 0x0A68,
  twohackarabic: 0x0662,
  twohangzhou: 0x3022,
  twoideographicparen: 0x3221,
  twoinferior: 0x2082,
  twomonospace: 0xFF12,
  twonumeratorbengali: 0x09F5,
  twooldstyle: 0xF732,
  twoparen: 0x2475,
  twoperiod: 0x2489,
  twopersian: 0x06F2,
  tworoman: 0x2171,
  twostroke: 0x01BB,
  twosuperior: 0x00B2,
  twothai: 0x0E52,
  twothirds: 0x2154,
  u: 0x0075,
  uacute: 0x00FA,
  ubar: 0x0289,
  ubengali: 0x0989,
  ubopomofo: 0x3128,
  ubreve: 0x016D,
  ucaron: 0x01D4,
  ucircle: 0x24E4,
  ucircumflex: 0x00FB,
  ucircumflexbelow: 0x1E77,
  ucyrillic: 0x0443,
  udattadeva: 0x0951,
  udblacute: 0x0171,
  udblgrave: 0x0215,
  udeva: 0x0909,
  udieresis: 0x00FC,
  udieresisacute: 0x01D8,
  udieresisbelow: 0x1E73,
  udieresiscaron: 0x01DA,
  udieresiscyrillic: 0x04F1,
  udieresisgrave: 0x01DC,
  udieresismacron: 0x01D6,
  udotbelow: 0x1EE5,
  ugrave: 0x00F9,
  ugujarati: 0x0A89,
  ugurmukhi: 0x0A09,
  uhiragana: 0x3046,
  uhookabove: 0x1EE7,
  uhorn: 0x01B0,
  uhornacute: 0x1EE9,
  uhorndotbelow: 0x1EF1,
  uhorngrave: 0x1EEB,
  uhornhookabove: 0x1EED,
  uhorntilde: 0x1EEF,
  uhungarumlaut: 0x0171,
  uhungarumlautcyrillic: 0x04F3,
  uinvertedbreve: 0x0217,
  ukatakana: 0x30A6,
  ukatakanahalfwidth: 0xFF73,
  ukcyrillic: 0x0479,
  ukorean: 0x315C,
  umacron: 0x016B,
  umacroncyrillic: 0x04EF,
  umacrondieresis: 0x1E7B,
  umatragurmukhi: 0x0A41,
  umonospace: 0xFF55,
  underscore: 0x005F,
  underscoredbl: 0x2017,
  underscoremonospace: 0xFF3F,
  underscorevertical: 0xFE33,
  underscorewavy: 0xFE4F,
  union: 0x222A,
  universal: 0x2200,
  uogonek: 0x0173,
  uparen: 0x24B0,
  upblock: 0x2580,
  upperdothebrew: 0x05C4,
  upsilon: 0x03C5,
  upsilondieresis: 0x03CB,
  upsilondieresistonos: 0x03B0,
  upsilonlatin: 0x028A,
  upsilontonos: 0x03CD,
  uptackbelowcmb: 0x031D,
  uptackmod: 0x02D4,
  uragurmukhi: 0x0A73,
  uring: 0x016F,
  ushortcyrillic: 0x045E,
  usmallhiragana: 0x3045,
  usmallkatakana: 0x30A5,
  usmallkatakanahalfwidth: 0xFF69,
  ustraightcyrillic: 0x04AF,
  ustraightstrokecyrillic: 0x04B1,
  utilde: 0x0169,
  utildeacute: 0x1E79,
  utildebelow: 0x1E75,
  uubengali: 0x098A,
  uudeva: 0x090A,
  uugujarati: 0x0A8A,
  uugurmukhi: 0x0A0A,
  uumatragurmukhi: 0x0A42,
  uuvowelsignbengali: 0x09C2,
  uuvowelsigndeva: 0x0942,
  uuvowelsigngujarati: 0x0AC2,
  uvowelsignbengali: 0x09C1,
  uvowelsigndeva: 0x0941,
  uvowelsigngujarati: 0x0AC1,
  v: 0x0076,
  vadeva: 0x0935,
  vagujarati: 0x0AB5,
  vagurmukhi: 0x0A35,
  vakatakana: 0x30F7,
  vav: 0x05D5,
  vavdagesh: 0xFB35,
  vavdagesh65: 0xFB35,
  vavdageshhebrew: 0xFB35,
  vavhebrew: 0x05D5,
  vavholam: 0xFB4B,
  vavholamhebrew: 0xFB4B,
  vavvavhebrew: 0x05F0,
  vavyodhebrew: 0x05F1,
  vcircle: 0x24E5,
  vdotbelow: 0x1E7F,
  vecyrillic: 0x0432,
  veharabic: 0x06A4,
  vehfinalarabic: 0xFB6B,
  vehinitialarabic: 0xFB6C,
  vehmedialarabic: 0xFB6D,
  vekatakana: 0x30F9,
  venus: 0x2640,
  verticalbar: 0x007C,
  verticallineabovecmb: 0x030D,
  verticallinebelowcmb: 0x0329,
  verticallinelowmod: 0x02CC,
  verticallinemod: 0x02C8,
  vewarmenian: 0x057E,
  vhook: 0x028B,
  vikatakana: 0x30F8,
  viramabengali: 0x09CD,
  viramadeva: 0x094D,
  viramagujarati: 0x0ACD,
  visargabengali: 0x0983,
  visargadeva: 0x0903,
  visargagujarati: 0x0A83,
  vmonospace: 0xFF56,
  voarmenian: 0x0578,
  voicediterationhiragana: 0x309E,
  voicediterationkatakana: 0x30FE,
  voicedmarkkana: 0x309B,
  voicedmarkkanahalfwidth: 0xFF9E,
  vokatakana: 0x30FA,
  vparen: 0x24B1,
  vtilde: 0x1E7D,
  vturned: 0x028C,
  vuhiragana: 0x3094,
  vukatakana: 0x30F4,
  w: 0x0077,
  wacute: 0x1E83,
  waekorean: 0x3159,
  wahiragana: 0x308F,
  wakatakana: 0x30EF,
  wakatakanahalfwidth: 0xFF9C,
  wakorean: 0x3158,
  wasmallhiragana: 0x308E,
  wasmallkatakana: 0x30EE,
  wattosquare: 0x3357,
  wavedash: 0x301C,
  wavyunderscorevertical: 0xFE34,
  wawarabic: 0x0648,
  wawfinalarabic: 0xFEEE,
  wawhamzaabovearabic: 0x0624,
  wawhamzaabovefinalarabic: 0xFE86,
  wbsquare: 0x33DD,
  wcircle: 0x24E6,
  wcircumflex: 0x0175,
  wdieresis: 0x1E85,
  wdotaccent: 0x1E87,
  wdotbelow: 0x1E89,
  wehiragana: 0x3091,
  weierstrass: 0x2118,
  wekatakana: 0x30F1,
  wekorean: 0x315E,
  weokorean: 0x315D,
  wgrave: 0x1E81,
  whitebullet: 0x25E6,
  whitecircle: 0x25CB,
  whitecircleinverse: 0x25D9,
  whitecornerbracketleft: 0x300E,
  whitecornerbracketleftvertical: 0xFE43,
  whitecornerbracketright: 0x300F,
  whitecornerbracketrightvertical: 0xFE44,
  whitediamond: 0x25C7,
  whitediamondcontainingblacksmalldiamond: 0x25C8,
  whitedownpointingsmalltriangle: 0x25BF,
  whitedownpointingtriangle: 0x25BD,
  whiteleftpointingsmalltriangle: 0x25C3,
  whiteleftpointingtriangle: 0x25C1,
  whitelenticularbracketleft: 0x3016,
  whitelenticularbracketright: 0x3017,
  whiterightpointingsmalltriangle: 0x25B9,
  whiterightpointingtriangle: 0x25B7,
  whitesmallsquare: 0x25AB,
  whitesmilingface: 0x263A,
  whitesquare: 0x25A1,
  whitestar: 0x2606,
  whitetelephone: 0x260F,
  whitetortoiseshellbracketleft: 0x3018,
  whitetortoiseshellbracketright: 0x3019,
  whiteuppointingsmalltriangle: 0x25B5,
  whiteuppointingtriangle: 0x25B3,
  wihiragana: 0x3090,
  wikatakana: 0x30F0,
  wikorean: 0x315F,
  wmonospace: 0xFF57,
  wohiragana: 0x3092,
  wokatakana: 0x30F2,
  wokatakanahalfwidth: 0xFF66,
  won: 0x20A9,
  wonmonospace: 0xFFE6,
  wowaenthai: 0x0E27,
  wparen: 0x24B2,
  wring: 0x1E98,
  wsuperior: 0x02B7,
  wturned: 0x028D,
  wynn: 0x01BF,
  x: 0x0078,
  xabovecmb: 0x033D,
  xbopomofo: 0x3112,
  xcircle: 0x24E7,
  xdieresis: 0x1E8D,
  xdotaccent: 0x1E8B,
  xeharmenian: 0x056D,
  xi: 0x03BE,
  xmonospace: 0xFF58,
  xparen: 0x24B3,
  xsuperior: 0x02E3,
  y: 0x0079,
  yaadosquare: 0x334E,
  yabengali: 0x09AF,
  yacute: 0x00FD,
  yadeva: 0x092F,
  yaekorean: 0x3152,
  yagujarati: 0x0AAF,
  yagurmukhi: 0x0A2F,
  yahiragana: 0x3084,
  yakatakana: 0x30E4,
  yakatakanahalfwidth: 0xFF94,
  yakorean: 0x3151,
  yamakkanthai: 0x0E4E,
  yasmallhiragana: 0x3083,
  yasmallkatakana: 0x30E3,
  yasmallkatakanahalfwidth: 0xFF6C,
  yatcyrillic: 0x0463,
  ycircle: 0x24E8,
  ycircumflex: 0x0177,
  ydieresis: 0x00FF,
  ydotaccent: 0x1E8F,
  ydotbelow: 0x1EF5,
  yeharabic: 0x064A,
  yehbarreearabic: 0x06D2,
  yehbarreefinalarabic: 0xFBAF,
  yehfinalarabic: 0xFEF2,
  yehhamzaabovearabic: 0x0626,
  yehhamzaabovefinalarabic: 0xFE8A,
  yehhamzaaboveinitialarabic: 0xFE8B,
  yehhamzaabovemedialarabic: 0xFE8C,
  yehinitialarabic: 0xFEF3,
  yehmedialarabic: 0xFEF4,
  yehmeeminitialarabic: 0xFCDD,
  yehmeemisolatedarabic: 0xFC58,
  yehnoonfinalarabic: 0xFC94,
  yehthreedotsbelowarabic: 0x06D1,
  yekorean: 0x3156,
  yen: 0x00A5,
  yenmonospace: 0xFFE5,
  yeokorean: 0x3155,
  yeorinhieuhkorean: 0x3186,
  yerahbenyomohebrew: 0x05AA,
  yerahbenyomolefthebrew: 0x05AA,
  yericyrillic: 0x044B,
  yerudieresiscyrillic: 0x04F9,
  yesieungkorean: 0x3181,
  yesieungpansioskorean: 0x3183,
  yesieungsioskorean: 0x3182,
  yetivhebrew: 0x059A,
  ygrave: 0x1EF3,
  yhook: 0x01B4,
  yhookabove: 0x1EF7,
  yiarmenian: 0x0575,
  yicyrillic: 0x0457,
  yikorean: 0x3162,
  yinyang: 0x262F,
  yiwnarmenian: 0x0582,
  ymonospace: 0xFF59,
  yod: 0x05D9,
  yoddagesh: 0xFB39,
  yoddageshhebrew: 0xFB39,
  yodhebrew: 0x05D9,
  yodyodhebrew: 0x05F2,
  yodyodpatahhebrew: 0xFB1F,
  yohiragana: 0x3088,
  yoikorean: 0x3189,
  yokatakana: 0x30E8,
  yokatakanahalfwidth: 0xFF96,
  yokorean: 0x315B,
  yosmallhiragana: 0x3087,
  yosmallkatakana: 0x30E7,
  yosmallkatakanahalfwidth: 0xFF6E,
  yotgreek: 0x03F3,
  yoyaekorean: 0x3188,
  yoyakorean: 0x3187,
  yoyakthai: 0x0E22,
  yoyingthai: 0x0E0D,
  yparen: 0x24B4,
  ypogegrammeni: 0x037A,
  ypogegrammenigreekcmb: 0x0345,
  yr: 0x01A6,
  yring: 0x1E99,
  ysuperior: 0x02B8,
  ytilde: 0x1EF9,
  yturned: 0x028E,
  yuhiragana: 0x3086,
  yuikorean: 0x318C,
  yukatakana: 0x30E6,
  yukatakanahalfwidth: 0xFF95,
  yukorean: 0x3160,
  yusbigcyrillic: 0x046B,
  yusbigiotifiedcyrillic: 0x046D,
  yuslittlecyrillic: 0x0467,
  yuslittleiotifiedcyrillic: 0x0469,
  yusmallhiragana: 0x3085,
  yusmallkatakana: 0x30E5,
  yusmallkatakanahalfwidth: 0xFF6D,
  yuyekorean: 0x318B,
  yuyeokorean: 0x318A,
  yyabengali: 0x09DF,
  yyadeva: 0x095F,
  z: 0x007A,
  zaarmenian: 0x0566,
  zacute: 0x017A,
  zadeva: 0x095B,
  zagurmukhi: 0x0A5B,
  zaharabic: 0x0638,
  zahfinalarabic: 0xFEC6,
  zahinitialarabic: 0xFEC7,
  zahiragana: 0x3056,
  zahmedialarabic: 0xFEC8,
  zainarabic: 0x0632,
  zainfinalarabic: 0xFEB0,
  zakatakana: 0x30B6,
  zaqefgadolhebrew: 0x0595,
  zaqefqatanhebrew: 0x0594,
  zarqahebrew: 0x0598,
  zayin: 0x05D6,
  zayindagesh: 0xFB36,
  zayindageshhebrew: 0xFB36,
  zayinhebrew: 0x05D6,
  zbopomofo: 0x3117,
  zcaron: 0x017E,
  zcircle: 0x24E9,
  zcircumflex: 0x1E91,
  zcurl: 0x0291,
  zdot: 0x017C,
  zdotaccent: 0x017C,
  zdotbelow: 0x1E93,
  zecyrillic: 0x0437,
  zedescendercyrillic: 0x0499,
  zedieresiscyrillic: 0x04DF,
  zehiragana: 0x305C,
  zekatakana: 0x30BC,
  zero: 0x0030,
  zeroarabic: 0x0660,
  zerobengali: 0x09E6,
  zerodeva: 0x0966,
  zerogujarati: 0x0AE6,
  zerogurmukhi: 0x0A66,
  zerohackarabic: 0x0660,
  zeroinferior: 0x2080,
  zeromonospace: 0xFF10,
  zerooldstyle: 0xF730,
  zeropersian: 0x06F0,
  zerosuperior: 0x2070,
  zerothai: 0x0E50,
  zerowidthjoiner: 0xFEFF,
  zerowidthnonjoiner: 0x200C,
  zerowidthspace: 0x200B,
  zeta: 0x03B6,
  zhbopomofo: 0x3113,
  zhearmenian: 0x056A,
  zhebrevecyrillic: 0x04C2,
  zhecyrillic: 0x0436,
  zhedescendercyrillic: 0x0497,
  zhedieresiscyrillic: 0x04DD,
  zihiragana: 0x3058,
  zikatakana: 0x30B8,
  zinorhebrew: 0x05AE,
  zlinebelow: 0x1E95,
  zmonospace: 0xFF5A,
  zohiragana: 0x305E,
  zokatakana: 0x30BE,
  zparen: 0x24B5,
  zretroflexhook: 0x0290,
  zstroke: 0x01B6,
  zuhiragana: 0x305A,
  zukatakana: 0x30BA
};

