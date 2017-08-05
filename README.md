# map_generator_OSM
On-the-fly map generator for Open Street Map data using WebGL

This project describes an approach to create an On-the-fly MapGenerator for Openstreetmap Data Using WebGL. The most common methods to generate online maps generate PNG overlay tile images from a wide range of data sources, like GeoJSON, GeoTIFF, PostGIS, CSV, and SQLite, etc., based on the coordinates and zoom-level. This project aims to send vector data for the map to the browser and hence render maps on-the-fly using WebGL. We push all of the vector computation to the GPU. This means that less data needs to be sent to the browser.
