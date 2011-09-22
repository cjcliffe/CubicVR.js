
CubicVR.RegisterModule("Utility",function(base) {

  var undef = base.undef;

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
    get: function(idOrUrl) {  // Let's extend this with a modular architecture for handling direct retrieval of resources perhaps?
      var id = null;
      var url = null;
      var elem = null;

      if (idOrUrl === undef) {
        console.log("CubicVR.get() Unable to retrieve, parameter was undefined!");
        return "";
      }

      if (idOrUrl.indexOf("\n")!==-1) {  // passed in a string already?  pass it back.
        return idOrUrl;
      }
      
      if (idOrUrl[0] == '#') {
        id = idOrUrl.substr(1);
        elem = document.getElementById(id);
        if (elem) {
          url = elem.src||null;
        }
      }
      
      if (!elem && !id && !url && idOrUrl) {
        url = idOrUrl;
      }
      
      if (elem && !url) {
        return CubicVR.util.collectTextNode(elem);        
      } else if (url) {
        var lcurl = url.toLowerCase();
        if (lcurl.indexOf(".js") !== -1) {
          return CubicVR.util.getJSON(url);
        } else if (lcurl.indexOf(".xml")!==-1 || lcurl.indexOf(".dae")!==-1) {
          return CubicVR.util.getXML(url);
        } else {
          return CubicVR.util.getURL(url);
        }
      } else if (id && !elem) {
        console.log("Unable to retrieve requested ID: '"+idOrUrl+"'");
        return "";
      } else {
        console.log("Unable to retrieve requested object or ID: '"+idOrUrl+"'");
        return "";
      }
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
      var fa = float_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = parseFloat(fa[i]);
      }
      if (fa[fa.length - 1] !== fa[fa.length - 1]) {
        fa.pop();
      }
      return fa;
    },
    intDelimArray: function(float_str, delim) {
//      if (!float_str) return [];
      var fa = float_str.split(delim ? delim : ",");
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
      var fa = text_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = fa[i];
      }
      return fa;
  },
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
   }
};


  var extend = {
    util: util,
    get: util.get
  };
  
  return extend;
});
  
