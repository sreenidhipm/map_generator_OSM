var OsmMaps = OsmMaps ? OsmMaps : {};
(function() {
  
/** Constants for the file */
OsmMaps.CANVAS = document.getElementById("map-canvas");
/** Define such Boundary constants - till California so that panning beyond them will cause errors **/
var BOUNDARYLATMIN = 21.53 // in degrees
var BOUNDARYLATMAX = 49.04 // in degrees
var BOUNDARYLONMIN = -124.72 // in degrees
var BOUNDARYLONMAX = -70.49 // in degrees

OsmMaps.zoom = 15;
OsmMaps.position = null;
OsmMaps.startTime = new Date().getTime();
OsmMaps.log = function log(m) {
  console.log('[' + (new Date().getTime() - OsmMaps.startTime) + '] ' + (m || ''));
}
var gl = OsmMaps.GL = OsmMaps.CANVAS.getContext('experimental-webgl');

//gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError, logAndValidate);
var pixelsToWebGLMatrix = new Float32Array(16);
// matrix which maps pixel coordinates to WebGL coordinates
window.onresize = resize;

$('#plus').click(function() {
  OsmMaps.zoom ++;
  init();
});

$('#minus').click(function() { 
  OsmMaps.zoom --;

  init();
});

$('#pan-left').click(function() {
  if(OsmMaps.zoom > 5) {
    if(OsmMaps.position.coords.longitude > OsmMaps.BOUNDARYLONMIN) {
      OsmMaps.position.coords.latitude -= 0.10; // do this till lonMin is reached
      init();
    } else {
      console.log("Longitude out of bounds to pan around");
    }
  } else {
    console.log("Zoom level too small to pan around and longitude out of bounds");
  }
  
});

$('#pan-right').click(function() {
  if(OsmMaps.zoom > 5) {
    if(OsmMaps.position.coords.longitude < OsmMaps.BOUNDARYLONMAX) {
      OsmMaps.position.coords.latitude += 0.10; // do this till lonMax is reached
      init();
    } else {
      console.log("Longitude out of bounds to pan around");
    }
  } else {
    console.log("Zoom level too small to pan around and longitude out of bounds");
  }
    
});

$('#pan-top').click(function() {
  if(OsmMaps.zoom > 5) {
    if(OsmMaps.position.coords.latitude > OsmMaps.BOUNDARYLATMIN) {
      OsmMaps.position.coords.longitude -= 0.10; // do this till latMin is reached
      init(); 
    } else {
      console.log("Latitude out of bounds to pan around");
    }
  } else {
    console.log("Zoom level too small to pan around and latitude out of bounds");
  }
  
});

$('#pan-bottom').click(function() {
  if(OsmMaps.zoom > 5) {
    if(OsmMaps.position.coords.latitude < OsmMaps.BOUNDARYLATMAX) {
      OsmMaps.position.coords.latitude += 0.10; // do this till latMax is reached
      init();
    } else {
      console.log("Latitude out of bounds to pan around");
    }  
  } else {
    console.log("Zoom level too small to pan around and latitude out of bounds");
  }
  
});

function resize() {
  // Get the canvas from the WebGL context
  var canvas = gl.canvas;
 
  // Lookup the size the browser is displaying the canvas.
  var displayWidth  = canvas.clientWidth;
  var displayHeight = canvas.clientHeight;
 
  // Check if the canvas is not the same size.
  if (canvas.width  != displayWidth ||
      canvas.height != displayHeight) {
 
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
 
    // Set the viewport to match
    console.log("canvas: resize");
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  pixelsToWebGLMatrix.set([2/canvas.width, 0, 0, 0, 0, -2/canvas.height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);
}

function init() {
  resize();
  var shaderProgram = createMapShaders();
  getGeoLocation(function(position) {
    OsmMaps.data.getPointsWithPosition(shaderProgram, position, function(shaderProgram, position, data) {
      drawMap(shaderProgram, position, data);
    });
  });
}

function createMapShaders() {
  // vertex shader 
  var vertCode = document.getElementById('pointVertexShader').text;
  var vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);

  // fragment shader 
  var fragCode = document.getElementById('pointFragmentShader').text;    
  var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);      
  gl.compileShader(fragShader);

  // link shaders to create our program
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader); 
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);
  gl.useProgram(shaderProgram);
  
  setPointSize(shaderProgram);
  return shaderProgram;
};

function setPointSize(shaderProgram) {
  gl.aPointSize = gl.getAttribLocation(shaderProgram, "aPointSize"); 
	var currentZoom = OsmMaps.zoom/* map zoom */;
	var pointSize = Math.max(currentZoom - 6.0, 1.0); // point size depends on how the zoom level is set
	gl.vertexAttrib1f(gl.aPointSize, pointSize);
}

function drawMap(shaderProgram, position, data) {
  var pointGroups = data['point_groups'];
  var pointShape = data['shape'];
  //var flatPoints = OsmMaps.points.flatten(pointGroups);
  //var updatedPoints = OsmMaps.points.addInvisibleLines(flatPoints);
  //Update Colors
  for (var i=0; i< pointGroups.length; i++) {
    var updatedPoints = pointGroups[i];
    var colorsArr = OsmMaps.points.setColors(updatedPoints);
    var pixelArr = OsmMaps.points.pointsToPixels(updatedPoints);
    plot(shaderProgram, position, updatedPoints, colorsArr, pixelArr);
  }
  OsmMaps.log("DONE");
}

function plot(shaderProgram, position, points, colorsArr, pixelArr) {
  OsmMaps.log("entering plot");
  var pixelArrayBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pixelArrayBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, pixelArr, gl.STATIC_DRAW);
	// enable the 'worldCoord' attribute in the shader to receive buffer
	var attributeLoc = gl.getAttribLocation(shaderProgram, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 0, 0);

  //color buffer
  var aVertexColor = gl.getAttribLocation(shaderProgram, 'aVertexColor');
  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, colorsArr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aVertexColor);
  gl.vertexAttribPointer(aVertexColor, 4, gl.FLOAT, false, 0, 0);
  //gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);
  doMatrixConversions(shaderProgram, position);
  gl.drawArrays(gl.POINTS, 0, points.length);
  gl.lineWidth(13);
  OsmMaps.log("before drawArrays");
  gl.drawArrays(gl.LINE_STRIP, 0, points.length);
  OsmMaps.log("after drawArrays");
}


function doMatrixConversions(shaderProgram, position) {
	/**
	 * We need to create a transformation that takes world coordinate
	 * points in the pointArrayBuffer to the coodinates WebGL expects.
	 * (a) Start with second half in pixelsToWebGLMatrix, which takes pixel
	 *     coordinates to WebGL coordinates.
	 * (b) Scale and translate to take world coordinates to pixel coords
	 */
  var mapMatrix = new Float32Array(16);
	// copy pixel->webgl matrix
	mapMatrix.set(pixelsToWebGLMatrix);
	// Scale to current zoom (worldCoords * 2^zoom)
	var scale = Math.pow(2, OsmMaps.zoom);
  _scaleMatrix(mapMatrix, scale, scale);
  var boundingBox = OsmMaps.points.getBoundingBox(position);
  var offset = OsmMaps.points.latLongToPixelXY(boundingBox.latMax, boundingBox.lonMin);
  _translateMatrix(mapMatrix, -offset.x, -offset.y);
  
	// attach matrix value to 'mapMatrix' uniform in shader
  var matrixLoc = gl.getUniformLocation(shaderProgram, 'mapMatrix');
	gl.uniformMatrix4fv(matrixLoc, false, mapMatrix);
}

function getGeoLocation(callback) {
  if(OsmMaps.position) {
    window.setTimeout(function() {
      callback(OsmMaps.position);
    }, 10);
  } else if (navigator.geolocation) { //current position's lat/long coordinates
    navigator.geolocation.getCurrentPosition(function(position) {
      OsmMaps.position = {
        "coords": {
          "latitude": position.coords.latitude,
          "longitude": position.coords.longitude
        }
      };
      callback(OsmMaps.position);
    });
  } else { // else get lat/long position of TansAmerica Building in SFO
    throw new Error('incompatible browser');
  }
}

var _scaleMatrix = function(matrix, scaleX, scaleY) {
	// scaling x and y, which is just scaling first two columns of matrix
	matrix[0] *= scaleX;
	matrix[1] *= scaleX;
	matrix[2] *= scaleX;
	matrix[3] *= scaleX;
	matrix[4] *= scaleY;
	matrix[5] *= scaleY;
	matrix[6] *= scaleY;
	matrix[7] *= scaleY;
};

var _translateMatrix = function(matrix, tx, ty) {
	// translation is in last column of matrix
	matrix[12] += matrix[0]*tx + matrix[4]*ty;
	matrix[13] += matrix[1]*tx + matrix[5]*ty;
	matrix[14] += matrix[2]*tx + matrix[6]*ty;
	matrix[15] += matrix[3]*tx + matrix[7]*ty;
};

function getKey_(position) {
  return "key-"+ OsmMaps.position.coords.latitude.toFixed(4) + "-" + OsmMaps.position.coords.longitude.toFixed(4);
};

init();
})();
