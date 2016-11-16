/** 
  * COPYRIGHT (C) 2015 Sreenidhi Pundi Muralidharan. All Rights Reserved.
  * Solves CS 298 Project Work - On-the-fly Map Generator for OSM Data using WebGL.
  * @author Sreenidhi Pundi Muralidharan
  * @version 1.01 Dec 15, 2015
  * This JavaScript file has several functions to give colors to the lines, to convert the lat-lon coordinates.
  * into pixels and so on
*/

var OsmMaps = OsmMaps ? OsmMaps : {};
(function() 
{

OsmMaps.points = {};
var PI_180 = Math.PI / 180.0;
var PI_4 = Math.PI * 4;
var BOUNDINGBOX_STEP = 0.05;
/**
  * This function is to flatten both the polygon and line arrays into a single big array.
  * @param the points as individual groups - each row of the DB is returned as a group
  * @return the conatenated array containing all the points - combining all the rows from the DB into one array
*/
OsmMaps.points.flatten = function(pointGroups) 
{
  return [].concat.apply([],pointGroups);/* faster way to merge individual polyon/line vertices into one large flat array */
};


/** 
 * This function is to create an index array for connection the points plotted.
 * This array is given to WebGL and further to the GPU using index buffers
 * @param the lat-lon points
 * @return the index array  
 *                                                                0       1       2       3       4       5       6       7       8
 * For a given points flat cotaining a polygon and a line say [{x0,y0},{x1,y1},{x2,y2},{x3,y3},{x0,y0},{x4,y4},{x5,y5},{x6,y6},{x7,y7}]
 * the index array would be [0,1,1,2,2,3,3,0,4,5,5,6,6,7]
 */
OsmMaps.points.createIndexArray = function(pointsFlat) 
{
  var currentIndex = 0;
  var startIndex, point;
  var indexArray = [];
  var pointsFlatLength = pointsFlat.length;
  for (i=0; i < pointsFlatLength; i++) 
  {
    point = pointsFlat[i];
    if (point.isStart) 
    {
          startIndex = currentIndex;
    }
    if (point.isEnd && point.shape == "POLYGON") 
    {
      indexArray.push(startIndex);
      // Since polygon has repeated last vertex just draw a line from that vertex to itself.
      indexArray.push(currentIndex);
      indexArray.push(currentIndex);
      currentIndex ++;
    } 
    else 
    {
      indexArray.push(currentIndex);
      if (!point.isStart) 
      {
        if (point.shape=="LINESTRING" && point.isEnd) 
        {
          
        } 
        else 
        {
          indexArray.push(currentIndex); /* if you omit this the index array would look like [0,1,2,3,0,4,5,6,7]*/
        }
      }
      currentIndex ++;
    } 
  }
  return indexArray;
};

/**
  * This function is to remove the points with longitude = 0 value.
  * @param the flattened points array
  * @return the flattened points array with the points having longitude = 0 removed
*/
OsmMaps.points.removeLon0 = function (pointsFlat) 
{
  var i;
  /* Remove points where lon = 0 */
  for(i = 0; i < pointsFlat.length; i++) 
  {
    if(pointsFlat[i].lon == 0) 
    {
      pointsFlat.splice(i, 1);
      i--;
    }
  }
  return pointsFlat;
};

/**
  * This function is to set colors for individual lines.
  * @param the flattened points array
  * @return the colors for the lines
*/
OsmMaps.points.setColors = function(pointsFlat) 
{
  var pointsFlatLength = pointsFlat.length;
  var colors = new Float32Array(4 * pointsFlatLength);
  var shape;
  for(var i = 0; i < pointsFlatLength ; i++) 
  {
    shape = pointsFlat[i].shape;
    if (pointsFlat[i].isInvisible) 
    {
      // completely opaque.
      colors[4 * i] = 0.0;
      colors[4* i+1] = 0.0;
      colors[4* i+2] = 0.0;
      colors[4* i+3] = 0.0;
    } 
    else if(shape == 'POLYGON') 
    {
      //grey color for bulidings
      colors[4 * i] = 0.0;
      colors[4* i+1] = 0.0;
      colors[4* i+2] = 0.0;
      colors[4* i+3] = 0.4; 
    } 
    else if(shape == 'LINESTRING') 
    {
      //yellow color for roads
      colors[4 * i] = 1.0;
      colors[4* i+1] = 0.8;
      colors[4* i+2] = 0.0;
      colors[4* i+3] = 1.0;
    } 
    else 
    {
      //blue color for other objects
      colors[4 * i] = 0.0;
      colors[4* i+1] = 0.5;
      colors[4* i+2] = 1.0;
      colors[4* i+3] = 1.0; 
    }
  }
  return colors;
};

/**
  * This function is to call the function that converts the lat-lon to pixel coordinates.
  * This function stores the converted x-y coordinate values in the rawData variable.
  * @param the flattened points array
  * @return raw data, stored as x-y pixel 
*/
OsmMaps.points.pointsToPixels = function(pointsFlat) 
{
  var pointsFlatLength = pointsFlat.length;
  var rawData = new Float32Array(2 * pointsFlat.length);
	for (var i = 0; i < pointsFlatLength; i++) 
  {
		var pixel = OsmMaps.points.latLongToPixelXY(pointsFlat[i].lat, pointsFlat[i].lon);
		rawData[i * 2] = pixel.x;
		rawData[i * 2 + 1] = pixel.y;
  }
  return rawData;
};

/**
  * This function is call to set the bounding box according to the step value.
  * The lat-lon values are either incremented or decremented by a certain value.
  * @param the current positional coordinates
  * @return the maximum and minimum lat-lon values
*/
OsmMaps.points.getBoundingBox = function(position) 
{
  return {
    latMin: position.coords.latitude - BOUNDINGBOX_STEP,
    latMax: position.coords.latitude + BOUNDINGBOX_STEP,
    lonMin: position.coords.longitude - BOUNDINGBOX_STEP,
    lonMax: position.coords.longitude + BOUNDINGBOX_STEP
  };
};

/**
  * This function is to convert the lat-lon points to pixel coordinates.
  * @param the latitude and longitude points to be converted
  * @return the pixel coordinates
*/
OsmMaps.points.latLongToPixelXY = function (latitude, longitude) 
{
	var sinLatitude = Math.sin(latitude * PI_180);
	var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) /(PI_4)) * 256;
	var pixelX = ((longitude + 180) / 360) * 256;
	var pixel =  { x: pixelX, y: pixelY};
	return pixel;
};
  
})();