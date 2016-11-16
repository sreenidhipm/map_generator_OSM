<?php
/** 
  * COPYRIGHT (C) 2015 Sreenidhi Pundi Muralidharan. All Rights Reserved.
  * Solves CS 298 Project Work - On-the-fly Map Generator for OSM Data using WebGL.
  * @author Sreenidhi Pundi Muralidharan
  * @version 1.01 Dec 15, 2015
  * This PHP file is used to connect to the Postgres Database and fetch the query results.
*/

/**Constants for the file */
$WGS84PROJ = 94326;
$GOOGLEMERCPROJ = 900913;
$WGS84SRID = 4326;

//connectivity to database

$hostDb = "host=localhost";
$dbName = "dbname=osm";
$userDb = "user=sreenidhi";

$pgCon = pg_connect("$hostDb $dbName $userDb");

if(!$pgCon) 
{
  echo "Error : Unable to open database\n";
} 
else 
{    
  $latMin = $_REQUEST['latMin'];
  $lonMin = $_REQUEST['lonMin'];
  $latMax = $_REQUEST['latMax'];
  $lonMax = $_REQUEST['lonMax'];
  
  $sqlTransform = "SELECT ST_Transform(ST_MakeEnvelope(($lonMin), 
                    ($latMin), ($lonMax), ($latMax), $WGS84PROJ), $GOOGLEMERCPROJ)";
                    
  pg_prepare($pgCon, "sqlTransform", $sqlTransform);
  $queryResult = pg_execute($pgCon, "sqlTransform", array());
                  
  $data = pg_fetch_assoc($queryResult);
  $stTransform  = $data["st_transform"];
  
  pg_free_result($queryResult);   

  $sql = "SELECT name, ST_AsText(ST_Transform(way,$WGS84SRID)) FROM planet_osm_polygon
           WHERE ST_Intersects(way, '$stTransform') OFFSET 1";

  pg_prepare($pgCon, "sqlPoly", $sql);
  $queryResult = pg_execute($pgCon, "sqlPoly", array());
  $polyPointsCollection = processQueryResult($queryResult);
  
  $sql = "SELECT name, ST_AsText(ST_Transform(way,$WGS84SRID)) FROM planet_osm_line
                      WHERE ST_Intersects(way, '$stTransform') OFFSET 1";

  pg_prepare($pgCon, "sqlLines", $sql);
  $queryResult = pg_execute($pgCon, "sqlLines", array());
  $linePointsCollection = processQueryResult($queryResult);
  
 //Close connection
 pg_close($pgCon);
 $data = array();

 
 $data['poly_point_groups'] = $polyPointsCollection; 
 $data['line_point_groups'] = $linePointsCollection;
 ob_start('ob_gzhandler');
 echo json_encode($data);
 ob_end_flush();

}

/**
  * This function is to separate the lat-lon pairs from the query result. 
  * @param the query results
  * @return the lat-lon points
*/
function processQueryResult($queryResult) 
{
  $pointsCollection = array();
  while($data=pg_fetch_assoc($queryResult)) 
  {
    $name = $data["name"];
    $stAstext = $data["st_astext"];
    $plotShape = substr($stAstext, 0, strpos($stAstext, "("));
    $tmp = str_replace(array("LINESTRING(", "POINT(", "POLYGON(("),"", $stAstext);
    $tmp = str_replace(")", "", $tmp);
    $geoLocationsArr = explode(",", $tmp);
    $points = array();
    $counter = 0;
    foreach($geoLocationsArr as $geoLocation) {
      $tmpArr = explode(" ", $geoLocation);
      $longitudes = (float) $tmpArr[0];
      $latitudes =  (float) $tmpArr[1];
      $shapes =  $plotShape;
      $coord = array("lon"=> ceil($longitudes*100000000)/100000000, 
                     "lat"=> floor($latitudes*100000000)/100000000, 
                     "shape"=> $shapes);
      if ($counter == 0)  
      {
        $coord["isStart"] = true;
      }
      if ($counter == count($geoLocationsArr)-1) 
      {
        $coord["isEnd"] = true;
      }
      array_push($points , $coord);
      $counter ++;
    }
    array_push($pointsCollection, $points);
  }
  //Free result set
  pg_free_result($queryResult);
  return $pointsCollection;
}
      
?>