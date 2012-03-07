
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
  
