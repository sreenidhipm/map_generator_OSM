/** 
  * COPYRIGHT (C) 2015 Sreenidhi Pundi Muralidharan. All Rights Reserved.
  * Solves CS 298 Project Work - On-the-fly Map Generator for OSM Data using WebGL.
  * @author Sreenidhi Pundi Muralidharan
  * @version 1.01 Dec 15, 2015
  * This JavaScript file has several functions for compiling and linking shaders,
  * matrix conversions and to draw the map on the canvas.
*/

var OsmMaps = OsmMaps ? OsmMaps : {};
(function() 
{
  
/** Constants for the file */
OsmMaps.CANVAS = document.getElementById("map-canvas");
var PAN_STEP = 0.025;

OsmMaps.zoom = 15;
OsmMaps.position = null;
OsmMaps.startTime = new Date().getTime();

/**
  * This function is to log WebGL errors for debugging.
*/
OsmMaps.log = function log(m) 
{
  console.log('[' + (new Date().getTime() - OsmMaps.startTime) + '] ' + (m || ''));
}
/**
  * Getting WebGL context.
*/
var gl = OsmMaps.GL = OsmMaps.CANVAS.getContext('experimental-webgl');
// Uncomment the following line to debug webgl.
//gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError, logAndValidate);
var pixelsToWebGLMatrix = new Float32Array(16);
// matrix which maps pixel coordinates to WebGL coordinates
window.onresize = resize;

/**
  * CSS styles for zooming in/out.
*/
$('#plus').click(function() 
{
  OsmMaps.zoom ++;
  if (OsmMaps.zoom !=15) 
  {
    $('.pan').css('display', 'none');
  } 
  else 
  {
     $('.pan').css('display', 'block');
  }
  init();
});

$('#minus').click(function() 
{ 
  OsmMaps.zoom --;
  if (OsmMaps.zoom !=15) 
  {
    $('.pan').css('display', 'none');
  } 
  else 
  {
     $('.pan').css('display', 'block');
  }  
  init();
});

/**
  * CSS styles for panning around.
*/
$('#pan-bottom').click(function() 
{
  OsmMaps.position.coords.latitude -= PAN_STEP; 
  init();
});

$('#pan-top').click(function() 
{
  OsmMaps.position.coords.latitude += PAN_STEP;
  init();
});

$('#pan-left').click(function() 
{
  OsmMaps.position.coords.longitude -= PAN_STEP; 
  init();
});

$('#pan-right').click(function() 
{
  OsmMaps.position.coords.longitude += PAN_STEP; 
  init();
});

/**
  * This function is to resize the canvas when the browser is resized.
*/
function resize() 
{
  // Get the canvas from the WebGL context
  var canvas = gl.canvas;
 
  // Lookup the size the browser is displaying the canvas.
  var displayWidth  = canvas.clientWidth;
  var displayHeight = canvas.clientHeight;
 
  // Check if the canvas is not the same size.
  if (canvas.width  != displayWidth ||
      canvas.height != displayHeight) 
    {
 
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
 
    // Set the viewport to match
    console.log("canvas: resize");
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  pixelsToWebGLMatrix.set([2/canvas.width, 0, 0, 0, 0, -2/canvas.height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);
}

/**
  * This function is to initialize and call other functions.
*/
function init() 
{
  resize();
  var shaderProgram = createMapShaders();
  getGeoLocation(function(position) 
  {
    OsmMaps.data.getPointsWithPosition(shaderProgram, position, function(shaderProgram, position, data) 
    {
      drawMap(shaderProgram, position, data);
    });
  });
}

/**
  * This function gets the shader code from the HTML script tag and stores it in a JavaScript variable.
  * It then compiles the shaders and links it to the program.
*/
function createMapShaders() 
{
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
    
  return shaderProgram;
};


/** 
  * This function calls the plot function.
  * It gets the data and calls the setColors() method to set colors for the lines/ploygons drawn
  * This function calls plot() twice, once for polygons and once for lines.
  * @param the shader program object, positional coordinates and the data for drawing
*/
function drawMap(shaderProgram, position, data) 
{
  var polyPointGroups = data['poly_point_groups'];
  var linePointGroups = data['line_point_groups'];
  
  //Plot polygons.
  var polyFlatPoints = OsmMaps.points.flatten(polyPointGroups);
  var polyUpdatedPoints =OsmMaps.points.removeLon0(polyFlatPoints);
  var polyIndexArray = OsmMaps.points.createIndexArray(polyUpdatedPoints);
  //Update Colors
  var polyColorsArr = OsmMaps.points.setColors(polyUpdatedPoints);
  var polyPixelArr = OsmMaps.points.pointsToPixels(polyUpdatedPoints);
  plot(shaderProgram, position, polyUpdatedPoints, polyColorsArr, polyPixelArr, polyIndexArray);
  
  //Plot lines.
  var lineFlatPoints = OsmMaps.points.flatten(linePointGroups);
  var lineUpdatedPoints =OsmMaps.points.removeLon0(lineFlatPoints);
  var lineIndexArray = OsmMaps.points.createIndexArray(lineUpdatedPoints);
  //Update Colors
  var lineColorsArr = OsmMaps.points.setColors(lineUpdatedPoints);
  var linePixelArr = OsmMaps.points.pointsToPixels(lineUpdatedPoints);
  plot(shaderProgram, position, lineUpdatedPoints, lineColorsArr, linePixelArr, lineIndexArray);  
  
}

/** 
  * This function is to draw the map. It makes use of the 
  * It sends the data through the buffers to the underlying GPU.
  * It finally draws the objects using drawElements() call.
  * @param the shader program object, positional coordinates, the data for drawing,
  *        the colors and pixel arrays and the index array 
*/
function plot(shaderProgram, position, points, colorsArr, pixelArr, indexArray) 
{
  OsmMaps.log("start plot");
  var pixelArrayBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, pixelArrayBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, pixelArr, gl.STATIC_DRAW);
	// enable the 'worldCoord' attribute in the shader to receive buffer
	var attributeLoc = gl.getAttribLocation(shaderProgram, 'worldCoord');
  gl.enableVertexAttribArray(attributeLoc);
  gl.vertexAttribPointer(attributeLoc, 2, gl.FLOAT, false, 0, 0);

  //index buffer
  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);

  //color buffer
  var aVertexColor = gl.getAttribLocation(shaderProgram, 'aVertexColor');
  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colorsArr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aVertexColor);
  gl.vertexAttribPointer(aVertexColor, 4, gl.FLOAT, false, 0, 0);
  //gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);
  doMatrixConversions(shaderProgram, position);
  //gl.drawArrays(gl.POINTS, 0, points.length);
  gl.lineWidth(5);
  //console.log(points); 
  gl.drawElements(gl.LINES, indexArray.length, gl.UNSIGNED_SHORT, 0);
  
  OsmMaps.log("end plot");
  
}

/** 
  * This function is to do matrix translations and scaling for the geometry
  * @param the shader program object and the positional coordinates 
*/
function doMatrixConversions(shaderProgram, position) 
{
	/**
	 * We need to create a transformation that takes world coordinate
	 * points in the pointArrayBuffer to the coordinates WebGL expects.
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

/** 
  * This callback function is to get the current positional coordinates from the browser.
*/
function getGeoLocation(callback) 
{
  if(OsmMaps.position) 
  {
    window.setTimeout(function() 
    {
      console.log(OsmMaps.position);
      callback(OsmMaps.position);
    }, 10);
  } 
  else if (navigator.geolocation) 
  { //current position's lat/long coordinates
    navigator.geolocation.getCurrentPosition(function(position) 
    {
      OsmMaps.position = 
      {
        "coords": {
          "latitude": position.coords.latitude,
          "longitude": position.coords.longitude
        }
      };

      callback(OsmMaps.position);
    });
  } 
  else 
  { // else get lat/long position of TansAmerica Building in SFO
    throw new Error('incompatible browser');
  }
}

/** 
  * This function is define the scaling matrix for scaling the geometry according to zoom levels.
  * @param the matrix, the x and y scaling factors
*/
var _scaleMatrix = function(matrix, scaleX, scaleY) 
{
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

/** 
  * This function is define the translation matrix for translating the position of the geometry.
  * @param the matrix, the x and y translating factors
*/
var _translateMatrix = function(matrix, tx, ty) 
{
	// translation is in last column of matrix
	matrix[12] += matrix[0]*tx + matrix[4]*ty;
	matrix[13] += matrix[1]*tx + matrix[5]*ty;
	matrix[14] += matrix[2]*tx + matrix[6]*ty;
	matrix[15] += matrix[3]*tx + matrix[7]*ty;
};

/**
  * This function truncates the lat-lon points, after the first four digits.
  * This function acts as a cache.
  * @param the current lat-lon positional coordinates
  * @return truncated lat-lon points
*/
function getKey_(position) 
{
  return "key-"+ OsmMaps.position.coords.latitude.toFixed(4) + "-" + OsmMaps.position.coords.longitude.toFixed(4);
};

init();
})();
