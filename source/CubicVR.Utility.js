
CubicVR.RegisterModule("Utility",function(base) {

  var undef = base.undef;
  var log = base.log;

  var classBin = {};
  var jsonBin = {};

  var util = {        
    multiSplit: function(split_str,split_chars) {
        var arr = split_str.split(split_chars[0]);
    
        for (var i = 1, iMax = split_chars.length; i < iMax; i++) {
            var sc = split_chars[i];
            for (var j = 0, jMax = arr.length; j < jMax; j++) {
                var arsplit = arr[j].trim().split(sc);
                var empty = true;
                if (arsplit.length > 1) {
                    for (var k = 0; k < arsplit.length; k++) {
                        if (arsplit[k].trim() !== "") {
                            arr.splice(j+k,(k===0)?1:0,arsplit[k]);
                            if (k) {
                              jMax++;
                            }
                            empty = false;
                        }
                    }
                } else {
                    arr[j] = arr[j].trim().replace(sc,"");
                    if (arr[j] !== "") empty = false;
                }
                if (empty) {
                  arr.splice(j,1);
                  jMax--;
                  j--;                      
                }
            }
        }
        return arr;
    },
    getJSONScriptObj: function(id, success) {
      if (typeof(id) === "string" && id.length > 0 && id.charAt(0) === "#" ) {
        var jsonScript = document.getElementById(id.substr(1));
        if ( jsonScript ) {
          var scriptContents = jsonScript.innerHTML || jsonScript.text;
          var jsonObj = JSON.parse(scriptContents);
          if (success) {
            success(jsonObj);
          }
          return jsonObj;
        }
      }
      return id;
    },
    getScriptContents: function(id) {
      var shaderScript = document.getElementById(id);

      var str = "";
      var srcUrl = "";

      if (!shaderScript) {
        srcUrl = id;
      } else {
        if (shaderScript.src !== "" || shaderScript.attributes['srcUrl'] !== undef) {
          srcUrl = (shaderScript.src !== '') ? shaderScript.src : (shaderScript.attributes['srcUrl'].value);
        }
      }

      if (srcUrl.length !== 0) {
        var xmlHttp = new XMLHttpRequest();
        if(xmlHttp.overrideMimeType){
          // Firefox generates a misleading "syntax" error if we don't have this line.
          xmlHttp.overrideMimeType("application/json");
        }
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          str = xmlHttp.responseText;
        }
      } else {
        var k = shaderScript.firstChild;
        while (k) {
          if (k.nodeType === 3) {
            str += k.textContent;
          }
          k = k.nextSibling;
        }
      }

      return str;
    },
    xmlNeedsBadgerFish: function(xmlDoc) {
      var nodeStack = [xmlDoc];

      while (nodeStack.length) {
          var n = nodeStack.pop();

          if (n.attributes) if (n.attributes.length) {
            return true;
          }   
          
          for (var i = 0, iMax = n.childNodes.length; i < iMax; i++) {
              nodeStack.push(n.childNodes[i]);
          }
      }
      
      return false;
    },
    getFirstEntry: function(v) {
        for (var a in v) {
          if (v.hasOwnProperty(a)) {
              return v[a];                
          }
        }
    },
    getURIFileType: function(url) {   // attempt to get an extension, optional override via ?_ext=json, &_ext=js, ?ext=xml or &ext=dae, etc. for dynamic fetching ..
        var lcurl = url.toLowerCase();

        var extensionParams = ["_ext","ext"];
        var extValues = {
            "json": ["js","javascript","json"],
            "xml": ["xml"]
        };

        function getExtValue(extn) {
            for (var e in extValues) {
                if (!extValues.hasOwnProperty(e)) continue;
                if (extValues[e].indexOf(extn) !== -1) {
                    return e;
                }
            }
            return undef;
        }
        
        // example http://some.domain/myJSONServer.php?file=100&_ext=json
        // example http://some.domain/myFile.json
        // example http://some.domain/myFile.xml
        // example myFile.js
        // example someFile.someExt?_ext=json
        
        if (lcurl.indexOf("?")!==-1) {  // split query
            var arUrl = lcurl.split("?");
            lcurl = arUrl[0];
            if (arUrl[1]) {
                var arParam;
                if (arUrl[1].indexOf("&") === -1) { // split params
                    arParam = [arUrl[1]];
                } else {
                    arParam = arUrl[1].split("&");
                }
                
                for (var i = 0, iMax = arParam.length; i < iMax; i++) { // split values
                    var p = arParam[i];
                    if (p.indexOf("=")!==-1) {
                        var arp = p.split("=");
                        
                        if (extensionParams.indexOf(arp[0]) !== -1) {   // test for extension param
                            var extVal = getExtValue(arp[1]);
                            
                            if (extVal) {
                                return extVal;
                            } else {    // soft fail, test below
                                log("Unable to determine extension type '"+arp[1]+"' provided for URI: ["+url+"], falling back to filename part.");
                            }
                        }
                    }
                }
            }
        }
        if (lcurl.indexOf(".")!==-1) {  // split by file extension
            var arLcurl = lcurl.split(".");
            return getExtValue(arLcurl[arLcurl.length-1]);    // grab last in array since URI likely will have them
        }
        
        return undef;
    },
    
    get: function(idOrUrl,classType) {  // Let's extend this with a modular architecture for handling direct retrieval of resources perhaps?    
      var id = null;
      var url = null;
      var elem = null;
      classType = classType || null;
      
      if (idOrUrl === undef) {
        return undef;
      }

      if (isFinite(idOrUrl)) {
        return idOrUrl;
      }

      if (typeof(idOrUrl)==='function') {   // pass a function? sure! :)
        idOrUrl = idOrUrl(classType);
      }
        
      if (typeof(idOrUrl) === 'object') {
        if (classType) {
            if (idOrUrl instanceof classType) {
                return idOrUrl;                
            } else {
                return new classType(idOrUrl);
            }
        }
        return idOrUrl;          
      }

      if (typeof(idOrUrl) == 'string') {
        if (idOrUrl.indexOf("\n")!==-1) {  // passed in a multi-line string already?  should probably check for json/xml or pass it back
            return idOrUrl;
        } else if (idOrUrl[0] == '#') {
            id = idOrUrl.substr(1);
            elem = document.getElementById(id);
            if (elem) {
              url = elem.src||null;
            }
        }
        if (!elem && !id && !url && idOrUrl) {
          url = idOrUrl;
        }
      }
      
      if (elem && !url) {
        return CubicVR.util.collectTextNode(elem);  // apply JSON text eval here?
      } else if (url) {
        var xml = null;
        var json_data = jsonBin[url] || null;
        
        if (!json_data) {
            var extType = util.getURIFileType(url);

            if (extType === undef && !elem) {
                return url; // nothing else do to here..  should perhaps figure out if the contents are a one-line json or xml string or text URL?
            }

            if (extType === "json") {
               json_data = CubicVR.util.getJSON(url);
            } else if (extType === "xml") {
              xml = CubicVR.util.getXML(url);
            } else {
              xml = CubicVR.util.getURL(url);  
            }
            
            if (xml && xml.childNodes) {
              json_data = util.getFirstEntry(util.xml2json(xml));
            } else if (xml) {
              json_data = xml;  // pass through text loading, possibly check for json or xml in the string here
            }
        }

        // automagic recall of previous ID's, URL's and class instances
        if (json_data && jsonBin[url]===undef) {
          jsonBin[url] = json_data;                
        }      
                
        if (classType) {
             if (classBin[url] && classBin[url] instanceof classType) {
                return classBin[url];
             } else if (json_data) {
                classBin[url] = new classType(json_data);
                return classBin[url];
             }
        } else if (json_data) {
            return json_data;            
        }
        
        return url; // else return the url?
      } else if (id && !elem) {
        console.log("Unable to retrieve requested ID: '"+idOrUrl+"'");
        return undef;
      } else {
//        console.log("Unable to retrieve requested object or ID: '"+idOrUrl+"'");
        return undef;
      }
    },
    clearCache: function() {
        classBin = {};
        jsonBin = {};
    },
    getURL: function(srcUrl) {
      try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          if (xmlHttp.responseText.length) {
            return xmlHttp.responseText;
          } else if (xmlHttp.responseXML) {
            return xmlHttp.responseXML;
          }
        }
      }
      catch(e) {
        alert(srcUrl + " failed to load.");
      }


      return null;
    },
    getXML: function(srcUrl) {
      try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.overrideMimeType("application/xml");
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          return xmlHttp.responseXML;
        }
      }
      catch(e) {
        try {
          alert(srcUrl + " failed to load.");
        }
        catch (ex) {
          throw(e);
        }
      }


      return null;
    },    
    getJSON: function(srcUrl) {
      try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.overrideMimeType("application/json");
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          return eval("("+xmlHttp.responseText+")");
        }
      }
      catch(e) {
        try {
          alert(srcUrl + " failed to load.");
        }
        catch (ex) {
          throw(e);
        }
      }


      return null;
    },        
    repackArray: function(data, stride, count) {
      if (data.length !== parseInt(stride, 10) * parseInt(count, 10)) {
        log("array repack error, data size !== stride*count: data.length=" +
            data.length + " stride=" + stride + " count=" + count);
      }

      var returnData = [];

      var c = 0;
      for (var i = 0, iMax = data.length; i < iMax; i++) {
        var ims = i % stride;

        if (ims === 0) {
          returnData[c] = [];
        }

        returnData[c][ims] = data[i];

        if (ims === stride - 1) {
          c++;
        }
      }

      return returnData;
    },
    collectTextNode: function(tn) {
      if (!tn) {
        return "";
      }

      var s = "";
      var textNodeChildren = tn.childNodes;
      for (var i = 0, tnl = textNodeChildren.length; i < tnl; i++) {
        s += textNodeChildren[i].nodeValue;
      }
      return s;
    },
    floatDelimArray: function(float_str, delim) {
//      if (!float_str) return [];
      if (delim != "\n") {
        float_str = float_str.replace(/\n/g," ").replace(/^\s+|\s+$/, '');          
      }
      var fa = float_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = parseFloat(fa[i]);
      }
      if (fa[fa.length - 1] !== fa[fa.length - 1]) {
        fa.pop();
      }
      return fa;
    },
    intDelimArray: function(int_str, delim) {
//      if (!int_str) return [];
      if (delim != "\n") {
        int_str = int_str.replace(/\n/g," ").replace(/^\s+|\s+$/, '');          
      }
      var fa = int_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = parseInt(fa[i], 10);
      }
      if (fa[fa.length - 1] !== fa[fa.length - 1]) {
        fa.pop();
      }
      return fa;
    },
    textDelimArray: function(text_str, delim) {
//      if (!text_str) return "";
      if (delim != "\n") {
        text_str = text_str.replace(/\n/g," ").replace(/^\s+|\s+$/, '');          
      }
      var fa = text_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = fa[i];
      }
      return fa;
  },
  xmlstring2json: function(xmlString) {
    var splitVal = xmlString.replace(/<!--.*?-->/gm,'').replace(/\n/g,' ').split(/(<[^>]*>)([^<]*)/gm);
    var whiteSpace = /^\s+$/gm;
    var tagId, stack = [], json_stack = [], json = {};
    var json_root = json;

    for (var i = 0, iMax = splitVal.length; i<iMax; i++) {
        var s = splitVal[i];
        if (whiteSpace.test(s) || s === "") continue;
        if (/<\?\s?xml[^>]*>/.test(s)) continue;
        if (/<.*?>/.test(s)) {
            var tagVal = s.split(/<([^>]*?)(.*)?>/g);
            tagId = tagVal[2];
            if (tagId[0]!=="/") {
                var arTagId = tagId.split(" ");                
                tagId = arTagId[0];
                var tagStr = arTagId.slice(1).join(" ");

                stack.push(tagId);
                json_stack.push(json);
                
                if (json[tagId] && !(json[tagId] instanceof Array)) {
                    json[tagId] = [json[tagId]];
                } else if (!json[tagId]) {
                    json[tagId] = {};
                    json = json[tagId];
                } else {
                    json = json[tagId];
                }
                
                if (json instanceof Array) {
                    json.push({});
                    json = json[json.length-1];
                }
                if (tagId.substr(tagId.length-1) === "/" || tagStr.substr(tagStr.length-1) === "/") {
                    tagId = "/"+tagId;
                }
            }
            if (tagId[0]==='/') {
                tagId = tagId.substr(1);
                if (stack.length && stack[stack.length-1] !== tagId) {
                    console.log("Unmatched tag, aborting: "+tagId);   
                    return false;
                } else {
                    stack.pop();
                    if (json_stack.length) {
                        json = json_stack[json_stack.length-1];
                    } else {
                        json = null;
                    }
                    json_stack.pop();
                }
            }
        } else {
            var parent = json_stack[json_stack.length-1][tagId];
            if (parent instanceof Array) {
                parent.pop();
                parent.push(util.parseNumeric(s));
            } else {
                json_stack[json_stack.length-1][tagId] = util.parseNumeric(s);
            }
        }
    } 

    return json_root;
  },
  xmlstring2badgerfish: function(xmlString) {
    var splitVal = xmlString.replace(/<!--.*?-->/gm,'').replace(/\n/g,' ').split(/(<[^>]*>)([^<]*)/gm);
    var whiteSpace = /^\s+$/gm;
    var tagId, stack = [], json_stack = [], json = {};
    var json_root = json;

    for (var i = 0, iMax = splitVal.length; i<iMax; i++) {
        var s = splitVal[i];
        if (whiteSpace.test(s) || s === "") continue;
        if (/<\?\s?xml[^>]*>/.test(s)) continue;
        if (/<.*?>/.test(s)) {
            var tagVal = s.split(/<([^>]*?)(.*)?>/g);
            tagId = tagVal[2];
            if (tagId[0]!=="/") {
                var arTagId = tagId.split(" ");                
                tagId = arTagId[0];
                var tagStr = arTagId.slice(1).join(" ");

                stack.push(tagId);
                json_stack.push(json);
                
                if (json[tagId] && !(json[tagId] instanceof Array)) {
                    json[tagId] = [json[tagId]];
                    json = json[tagId];
                } else if (!json[tagId]) {
                    json[tagId] = {};
                    json = json[tagId];
                } else {
                    json = json[tagId];
                }
                
                if (json instanceof Array) {
                    json.push({});
                    json = json[json.length-1];
                }
                if (tagId.substr(tagId.length-1) === "/" || tagStr.substr(tagStr.length-1) === "/") {
                    tagId = "/"+tagId;
                }
                
                var arAttributeData = util.multiSplit(tagStr,"= ");
                var key = "";
                for (var j = 0; j < arAttributeData.length; j++) {
                    var ars = arAttributeData[j];
                    if (ars[ars.length-1] === "/") {
                        ars = ars.substr(0,ars.length-1);
                    }
                    var isValue = ((j%2) === 1);
                    if (isValue) {
                        if (ars[0] === "'" || ars[0] === '"') {
                            var quoteChar = ars[0];
                            ars = ars.substr(1);
                            
                            while (ars[ars.length-1] !== quoteChar && arAttributeData.length+1 < j) {
                                ars = ars + arAttributeData.splice(j+1,1);
                            }
                            if (ars[ars.length-1] === quoteChar) {
                                ars = ars.substr(0,ars.length-1);
                            }
                        }
                        
                        json["@"+key] = ars;
                        
                    } else {
                        key = ars;
                    }
                }
            }
            if (tagId[0]==='/') {
                tagId = tagId.substr(1);
                if (stack.length && stack[stack.length-1] !== tagId) {
                    console.log("Unmatched tag, aborting: "+stack[stack.length-1]);   
                    return false;
                } else {
                    stack.pop();
                    if (json_stack.length) {
                        json = json_stack[json_stack.length-1];
                    } else {
                        json = null;
                    }
                    json_stack.pop();
                }
            }
        } else {
            json.$ = s;
        }
    } 
//console.log(json_root);
    return json_root;
  },
  // convert XML to badgerfish-json preserving attributes
  xml2badgerfish: function(xmlDoc) {
      var jsonData = {};
      var nodeStack = [];

      var i, iMax, iMin;

      var n;
      var j = jsonData;
      var cn, tn;
      var regEmpty = /^\s+|\s+$/g;

      xmlDoc.jsonParent = j;
      nodeStack.push(xmlDoc);

      while (nodeStack.length) {
          n = nodeStack.pop();
          var tagGroup = null;

          j = n.jsonParent;

          for (i = 0, iMax = n.childNodes.length; i < iMax; i++) {
              cn = n.childNodes[i];
              tn = cn.tagName;

              if (tn !== undef) {
                  tagGroup = tagGroup || {};
                  tagGroup[tn] = tagGroup[tn] || 0;
                  tagGroup[tn]++;
              }
          }

          if (n.attributes) if (n.attributes.length) {
              for (i = 0, iMax = n.attributes.length; i < iMax; i++) {
                  var att = n.attributes[i];

                  j["@" + att.name] = att.value;
              }
          }

          for (i = 0, iMax = n.childNodes.length; i < iMax; i++) {
              cn = n.childNodes[i];
              tn = cn.tagName;

              if (cn.nodeType === 1) {
                  if (tagGroup[tn] > 1) {
                      j[tn] = j[tn] || [];
                      j[tn].push({});
                      cn.jsonParent = j[tn][j[tn].length - 1];
                  } else {
                      j[tn] = j[tn] || {};
                      cn.jsonParent = j[tn];
                  }
                  nodeStack.push(cn);
              } else if (cn.nodeType === 3) {
                  if (cn.nodeValue.replace(regEmpty, "") !== "") {
                      j.$ = j.$ || "";
                      j.$ += cn.nodeValue;
                  }
              }
          }
      }
      return jsonData;
   },
   // check if an XML node only contains text
   isTextNode: function(tn) {
      var s = "";
      var textNodeChildren = tn.childNodes;
      for (var i = 0, tnl = textNodeChildren.length; i < tnl; i++) {
        if (textNodeChildren[i].nodeType!==3 || textNodeChildren[i].childNodes.length) return false;
      }
      
      return true;
   },
   // if string is a number such as int or float then parse it as such, otherwise pass through
   parseNumeric: function(str_in) {
        var arr = null,i,iMax,s;

        s = str_in.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\n/g,' ').replace(/ *, */gm,',').replace(/\s+/g,' ');   // trim any whitespace or line feeds or double spaces
        if (s === "") return s;

        // see if it's an array type and parse it out, order is important so don't re-arrange ;)
        if ((s.indexOf(" ") !== -1 || s.indexOf(",") !== -1) && /[0-9\.,e\-\+ ]+/g.test(s)) {
            if (!/[^0-9\-\+]+/g.test(s)) { // int
                //console.log("int");
                return parseInt(s,10);
            } else if (!/[^0-9\- ]+/g.test(s)) { // long vector space
                //console.log("long vector");
                return util.intDelimArray(s," ");
            } else if (!/[^0-9\-,]+/g.test(s)) { // long vector csv
                //console.log("long vector");
                return util.intDelimArray(s,",");
            } else if (!/[^0-9\.e\-\+ ]+/g.test(s)) { // float vector space
                //console.log("float vector");
                return util.floatDelimArray(s," ");
            } else if (!/[^0-9\.,e\+\-]+/g.test(s)) { // float vector csv
                //console.log("float vector");
                return util.floatDelimArray(s,",");
            }  else if (!/[^0-9,\-\+ ]+/g.test(s)) { // 2 dimensional long vector space,csv
                //console.log("2 dimensional long vector");
                arr = s.split(" ");
                for (i = 0, iMax = arr.length; i<iMax; i++) {
                    arr[i] = util.intDelimArray(arr[i],",");
                }
                return arr;
            } else if (!/[^0-9\.,e\-\+ ]+/g.test(s)) { // 2 dimensional float vector space,csv
                //console.log("2 dimensional float vector");
                arr = s.split(" ");
                for (i = 0, iMax = arr.length; i<iMax; i++) {
                    arr[i] = util.floatDelimArray(arr[i],",");
                }
                return arr;
            }
        }
        
        var float_val = parseFloat(s);

        if (!isNaN(float_val)) {        
            if (!/[^0-9\-\+]+/g.test(s)) {
                return parseInt(s,10);
            } else {
                return float_val;
            }
        }
        
        return str_in;
   },
   // direct conversion of <tag><tag2>string</tag2></tag> -> { tag2: "string" } attributes will be dropped.
   // to preserve attributes use xml2badgerfish
   xml2json: function(xmlDoc) {
      var jsonData = {};
      var nodeStack = [];

      var i, iMax, iMin;

      var n;
      var j = jsonData;
      var cn, tn;
      var regEmpty = /^\s+|\s+$/g;

      xmlDoc.jsonParent = j;
      nodeStack.push(xmlDoc);

      while (nodeStack.length) {
          n = nodeStack.pop();
          var tagGroup = null;

          j = n.jsonParent;

          for (i = 0, iMax = n.childNodes.length; i < iMax; i++) {
              cn = n.childNodes[i];
              tn = cn.tagName;

              if (tn !== undef) {
                  tagGroup = tagGroup || {};
                  tagGroup[tn] = tagGroup[tn] || 0;
                  tagGroup[tn]++;
              }
          }

          for (i = 0, iMax = n.childNodes.length; i < iMax; i++) {
              cn = n.childNodes[i];
              tn = cn.tagName;

              var isText = util.isTextNode(cn);

              if (cn.nodeType === 1) {
                  if (tagGroup[tn] > 1) {
                      j[tn] = j[tn] || [];
                      
                      if (isText) {
                          j[tn].push(util.parseNumeric(util.collectTextNode(cn)));                      
                      } else {
                          j[tn].push({});
                          cn.jsonParent = j[tn][j[tn].length - 1];
                      }
                  } else {
                     if (isText) {
                          j[tn] = util.parseNumeric(util.collectTextNode(cn));
                     } else {
                          j[tn] = j[tn] || {};
                          cn.jsonParent = j[tn];
                     }
                  }
                  
                  if (!isText) {
                      nodeStack.push(cn);
                  }
              }
          }
      }
      return jsonData;
   }
};


  var extend = {
    util: util,
    get: util.get,
    clearCache: util.clearCache
  };
  
  return extend;
});
  
  
  
/**
$Id: Iuppiter.js 3026 2010-06-23 10:03:13Z Bear $

Copyright (c) 2010 Nuwa Information Co., Ltd, and individual contributors.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  1. Redistributions of source code must retain the above copyright notice,
     this list of conditions and the following disclaimer.

  2. Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in the
     documentation and/or other materials provided with the distribution.

  3. Neither the name of Nuwa Information nor the names of its contributors
     may be used to endorse or promote products derived from this software
     without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

$Author: Bear $
$Revision: 3026 $
*/

if (typeof Iuppiter === 'undefined')
    Iuppiter = {
        version: '$Revision: 3026 $'.substring(11).replace(" $", "")
    };

/**
 * Convert string value to a byte array.
 *
 * @param {String} input The input string value.
 * @return {Array} A byte array from string value.
 */
Iuppiter.toByteArray = function(input) {
    var b = [], i, unicode;
    for(i = 0; i < input.length; i++) {
        unicode = input.charCodeAt(i);
        // 0x00000000 - 0x0000007f -> 0xxxxxxx
        if (unicode <= 0x7f) {
            b.push(unicode);
        // 0x00000080 - 0x000007ff -> 110xxxxx 10xxxxxx
        } else if (unicode <= 0x7ff) {
            b.push((unicode >> 6) | 0xc0);
            b.push((unicode & 0x3F) | 0x80);
        // 0x00000800 - 0x0000ffff -> 1110xxxx 10xxxxxx 10xxxxxx
        } else if (unicode <= 0xffff) {
            b.push((unicode >> 12) | 0xe0);
            b.push(((unicode >> 6) & 0x3f) | 0x80);
            b.push((unicode & 0x3f) | 0x80);
        // 0x00010000 - 0x001fffff -> 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
        } else {
            b.push((unicode >> 18) | 0xf0);
            b.push(((unicode >> 12) & 0x3f) | 0x80);
            b.push(((unicode >> 6) & 0x3f) | 0x80);
            b.push((unicode & 0x3f) | 0x80);
        }
    }

    return b;
};

/**
 * Base64 Class.
 * Reference: http://code.google.com/p/javascriptbase64/
 *            http://www.stringify.com/static/js/base64.js
 * They both under MIT License.
 */
Iuppiter.Base64 = {

    /// Encoding characters table.
    CA: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",

    /// Encoding characters table for url safe encoding.
    CAS: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",

    /// Decoding reference table.
    IA: new Array(256),

    /// Decoding reference table for url safe encoded string.
    IAS: new Array(256),

    /**
 * Constructor.
 */
    init: function(){
        /// Initialize variables for Base64 namespace.
        var i;

        for (i = 0; i < 256; i++) {
            Iuppiter.Base64.IA[i] = -1;
            Iuppiter.Base64.IAS[i] = -1;
        }

        for (i = 0, iS = Iuppiter.Base64.CA.length; i < iS; i++) {
            Iuppiter.Base64.IA[Iuppiter.Base64.CA.charCodeAt(i)] = i;
            Iuppiter.Base64.IAS[Iuppiter.Base64.CAS.charCodeAt(i)] = i;
        }

        Iuppiter.Base64.IA['='] = Iuppiter.Base64.IAS['='] = 0;
    },

    /**
 * Encode base64.
 *
 * @param {Array|String} input A byte array or a string.
 * @param {Boolean} urlsafe True if you want to make encoded string is url
 *                          safe.
 * @return {String} Encoded base64 string.
 */
    encode: function(input, urlsafe) {
        var ca, dArr, sArr, sLen,
            eLen, dLen, s, d, left,
            i;

        if(urlsafe)
            ca = Iuppiter.Base64.CAS;
        else
            ca = Iuppiter.Base64.CA;

        if(input.constructor == Array)
            sArr = input;
        else
            sArr = Iuppiter.toByteArray(input);

        sLen = sArr.length;

        eLen = (sLen / 3) * 3;              // Length of even 24-bits.
        dLen = ((sLen - 1) / 3 + 1) << 2;   // Length of returned array
        dArr = new Array(dLen);

        // Encode even 24-bits
        for (s = 0, d = 0; s < eLen;) {
            // Copy next three bytes into lower 24 bits of int, paying attension to sign.
            i = (sArr[s++] & 0xff) << 16 | (sArr[s++] & 0xff) << 8 |
                (sArr[s++] & 0xff);

            // Encode the int into four chars
            dArr[d++] = ca.charAt((i >> 18) & 0x3f);
            dArr[d++] = ca.charAt((i >> 12) & 0x3f);
            dArr[d++] = ca.charAt((i >> 6) & 0x3f);
            dArr[d++] = ca.charAt(i & 0x3f);
        }

        // Pad and encode last bits if source isn't even 24 bits.
        left = sLen - eLen; // 0 - 2.
        if (left > 0) {
            // Prepare the int
            i = ((sArr[eLen] & 0xff) << 10) |
                 (left == 2 ? ((sArr[sLen - 1] & 0xff) << 2) : 0);

            // Set last four chars
            dArr[dLen - 4] = ca.charAt(i >> 12);
            dArr[dLen - 3] = ca.charAt((i >> 6) & 0x3f);
            dArr[dLen - 2] = left == 2 ? ca.charAt(i & 0x3f) : '=';
            dArr[dLen - 1] = '=';
        }

        return dArr.join("");
    },

    /**
 * Decode base64 encoded string or byte array.
 *
 * @param {Array|String} input A byte array or encoded string.
 * @param {Object} urlsafe True if the encoded string is encoded by urlsafe.
 * @return {Array|String} A decoded byte array or string depends on input
 *                        argument's type.
 */
    decode: function(input, urlsafe) {
        var ia, dArr, sArr, sLen, bytes,
            sIx, eIx, pad, cCnt, sepCnt, len,
            d, cc, left,
            i, j, r;

        if(urlsafe)
            ia = Iuppiter.Base64.IAS;
        else
            ia = Iuppiter.Base64.IA;

        if(input.constructor == Array) {
            sArr = input;
            bytes = true;
        }
        else {
            sArr = Iuppiter.toByteArray(input);
            bytes = false;
        }

        sLen = sArr.length;

        sIx = 0;
        eIx = sLen - 1;    // Start and end index after trimming.

        // Trim illegal chars from start
        while (sIx < eIx && ia[sArr[sIx]] < 0)
            sIx++;

        // Trim illegal chars from end
        while (eIx > 0 && ia[sArr[eIx]] < 0)
            eIx--;

        // get the padding count (=) (0, 1 or 2)
        // Count '=' at end.
        pad = sArr[eIx] == '=' ? (sArr[eIx - 1] == '=' ? 2 : 1) : 0;
        cCnt = eIx - sIx + 1;   // Content count including possible separators
        sepCnt = sLen > 76 ? (sArr[76] == '\r' ? cCnt / 78 : 0) << 1 : 0;

        // The number of decoded bytes
        len = ((cCnt - sepCnt) * 6 >> 3) - pad;
        dArr = new Array(len);       // Preallocate byte[] of exact length

        // Decode all but the last 0 - 2 bytes.
        d = 0;
        for (cc = 0, eLen = (len / 3) * 3; d < eLen;) {
            // Assemble three bytes into an int from four "valid" characters.
            i = ia[sArr[sIx++]] << 18 | ia[sArr[sIx++]] << 12 |
                ia[sArr[sIx++]] << 6 | ia[sArr[sIx++]];

            // Add the bytes
            dArr[d++] = (i >> 16) & 0xff;
            dArr[d++] = (i >> 8) & 0xff;
            dArr[d++] = i & 0xff;

            // If line separator, jump over it.
            if (sepCnt > 0 && ++cc == 19) {
                sIx += 2;
                cc = 0;
            }
        }

        if (d < len) {
            // Decode last 1-3 bytes (incl '=') into 1-3 bytes
            i = 0;
            for (j = 0; sIx <= eIx - pad; j++)
                i |= ia[sArr[sIx++]] << (18 - j * 6);

            for (r = 16; d < len; r -= 8)
                dArr[d++] = (i >> r) & 0xff;
        }

        if(bytes) {
            return dArr;
        }
        else {
            for(i = 0; i < dArr.length; i++)
                dArr[i] = String.fromCharCode(dArr[i]);

            return dArr.join('');
        }
    }
};

Iuppiter.Base64.init();

(function() {

// Constants was used for compress/decompress function.
var NBBY = 8,
MATCH_BITS = 6,
MATCH_MIN = 3,
MATCH_MAX = ((1 << MATCH_BITS) + (MATCH_MIN - 1)),
OFFSET_MASK = ((1 << (16 - MATCH_BITS)) - 1),
LEMPEL_SIZE = 256;

/**
 * Compress string or byte array using fast and efficient algorithm.
 *
 * Because of weak of javascript's natural, many compression algorithm
 * become useless in javascript implementation. The main problem is
 * performance, even the simple Huffman, LZ77/78 algorithm will take many
 * many time to operate. We use LZJB algorithm to do that, it suprisingly
 * fulfills our requirement to compress string fastly and efficiently.
 *
 * Our implementation is based on
 * http://src.opensolaris.org/source/raw/onnv/onnv-gate/
 * usr/src/uts/common/os/compress.c
 * It is licensed under CDDL.
 *
 * Please note it depends on toByteArray utility function.
 *
 * @param {String|Array} input The string or byte array that you want to
 *                             compress.
 * @return {Array} Compressed byte array.
 */
Iuppiter.compress = function(input) {
    var sstart, dstart = [], slen,
        src = 0, dst = 0,
        cpy, copymap,
        copymask = 1 << (NBBY - 1),
        mlen, offset,
        hp,
        lempel = new Array(LEMPEL_SIZE),
        i, bytes;

    // Initialize lempel array.
    for(i = 0; i < LEMPEL_SIZE; i++)
        lempel[i] = 3435973836;

    // Using byte array or not.
    if(input.constructor == Array) {
        sstart = input;
        bytes = true;
    }
    else {
        sstart = Iuppiter.toByteArray(input);
        bytes = false;
    }

    slen = sstart.length;

    while (src < slen) {
        if ((copymask <<= 1) == (1 << NBBY)) {
            if (dst >= slen - 1 - 2 * NBBY) {
                mlen = slen;
                for (src = 0, dst = 0; mlen; mlen--)
                    dstart[dst++] = sstart[src++];
                return dstart;
            }
            copymask = 1;
            copymap = dst;
            dstart[dst++] = 0;
        }
        if (src > slen - MATCH_MAX) {
            dstart[dst++] = sstart[src++];
            continue;
        }
        hp = ((sstart[src] + 13) ^
              (sstart[src + 1] - 13) ^
               sstart[src + 2]) &
             (LEMPEL_SIZE - 1);
        offset = (src - lempel[hp]) & OFFSET_MASK;
        lempel[hp] = src;
        cpy = src - offset;
        if (cpy >= 0 && cpy != src &&
            sstart[src] == sstart[cpy] &&
            sstart[src + 1] == sstart[cpy + 1] &&
            sstart[src + 2] == sstart[cpy + 2]) {
            dstart[copymap] |= copymask;
            for (mlen = MATCH_MIN; mlen < MATCH_MAX; mlen++)
                if (sstart[src + mlen] != sstart[cpy + mlen])
                    break;
            dstart[dst++] = ((mlen - MATCH_MIN) << (NBBY - MATCH_BITS)) |
                            (offset >> NBBY);
            dstart[dst++] = offset;
            src += mlen;
        } else {
            dstart[dst++] = sstart[src++];
        }
    }

    return dstart;
};

/**
 * Decompress string or byte array using fast and efficient algorithm.
 *
 * Our implementation is based on
 * http://src.opensolaris.org/source/raw/onnv/onnv-gate/
 * usr/src/uts/common/os/compress.c
 * It is licensed under CDDL.
 *
 * Please note it depends on toByteArray utility function.
 *
 * @param {String|Array} input The string or byte array that you want to
 *                             compress.
 * @param {Boolean} _bytes Returns byte array if true otherwise string.
 * @return {String|Array} Decompressed string or byte array.
 */
Iuppiter.decompress = function(input, _bytes) {
    var sstart, dstart = [], slen,
        src = 0, dst = 0,
        cpy, copymap,
        copymask = 1 << (NBBY - 1),
        mlen, offset,
        i, bytes, get;
        
    // Using byte array or not.
    if(input.constructor == Array) {
        sstart = input;
        bytes = true;
    }
    else {
        sstart = Iuppiter.toByteArray(input);
        bytes = false;
    }    
    
    // Default output string result.
    if(typeof(_bytes) == 'undefined')
        bytes = false;
    else
        bytes = _bytes;
    
    slen = sstart.length;    
    
    get = function() {
        if(bytes) {
            return dstart;
        }
        else {
            // Decompressed string.
            for(i = 0; i < dst; i++)
                dstart[i] = String.fromCharCode(dstart[i]);

            return dstart.join('');
        }
    };   
            
        while (src < slen) {
                if ((copymask <<= 1) == (1 << NBBY)) {
                        copymask = 1;
                        copymap = sstart[src++];
                }
                if (copymap & copymask) {
                        mlen = (sstart[src] >> (NBBY - MATCH_BITS)) + MATCH_MIN;
                        offset = ((sstart[src] << NBBY) | sstart[src + 1]) & OFFSET_MASK;
                        src += 2;
                        if ((cpy = dst - offset) >= 0)
                                while (--mlen >= 0)
                                        dstart[dst++] = dstart[cpy++];
                        else
                                /*
                                 * offset before start of destination buffer
                                 * indicates corrupt source data
                                 */
                                return get();
                } else {
                        dstart[dst++] = sstart[src++];
                }
        }
    
        return get();
};

})();

/*

test('jslzjb', function() {
    var s = "Hello World!!!Hello World!!!Hello World!!!Hello World!!!";
    for(var i = 0; i < 10; i++)
        s += s;

    var c = Iuppiter.compress(s);
        ok(c.length < s.length, c);

    var d = Iuppiter.decompress(c);
    ok(d == s, d);

    // Compressed byte array can be converted into base64 to sumbit to server side to do something.
    var b = Iuppiter.Base64.encode(c, true);

    var bb = Iuppiter.toByteArray(b);
    var db = Iuppiter.decompress(Iuppiter.Base64.decode(bb, true));
    ok(db == s, db);
})
*/
