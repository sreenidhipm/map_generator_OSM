/** 
  * COPYRIGHT (C) 2015 Sreenidhi Pundi Muralidharan. All Rights Reserved.
  * Solves CS 298 Project Work - On-the-fly Map Generator for OSM Data using WebGL.
  * @author Sreenidhi Pundi Muralidharan
  * @version 1.01 Dec 15, 2015
  * This JavaScript file is to invoke the PHP using an AJAX call
*/

var OsmMaps = OsmMaps ? OsmMaps : {};
(function() 
{
OsmMaps.data = {};
OsmMaps.data.cache = {};
/**
  * This callback function invokes the PHP with an AJAX call.
  * @param the current lat-lon positional coordinates and the shader program object
  * @success the lat-lon objects (JSON)
*/
OsmMaps.data.getPointsWithPosition = function(shaderProgram, position, callback) 
{
  var boundingBox = OsmMaps.points.getBoundingBox(position);
  // data['some-information'] = $("#case-number").val() || 0;
  var cachedData = OsmMaps.data.cache[getKey_(position)];
  if (cachedData) 
  {
    window.setTimeout(function() 
    {
      callback(shaderProgram, position, cachedData);
    }, 0);
  } 
  else 
  {
  	$.ajax({
  		type: "GET",
  		dataType: "json",
  		url: "/code4/server/query_postgres.php",
      data: boundingBox,
      /**
       *  @link - query_postgres_data.json
       */
  		success: function(data)
      {
        OsmMaps.data.cache[getKey_(position)] = data;
        callback(shaderProgram, position, data);
  		}
  	}); 
  } 
};

/**
  * This function truncates the lat-lon points, after the first four digits.
  * This function acts as a cache.
  * @param the current lat-lon positional coordinates
  * @return truncated lat-lon points
*/
function getKey_(position) 
{
  return "key-"+ position.coords.latitude.toFixed(4) + "-" + position.coords.longitude.toFixed(4);
}

})();