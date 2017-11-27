const express = require('express');
const app = express();
const {Pool} = require("pg");

const pool = new Pool({
    host: "localhost",
    port: 5433,
    database: "postgis_23_sample",
    user: "postgres"
});

class GeoJson{
    constructor(){
        this.type = "Feature";
        this.geometry = {};
        this.properties = {};
    }
}

app.get('/', function (req, res) {
  res.sendFile(__dirname + "/public/views/index.html");
});

app.get("/search", function(req, res){
    if(req.query.q === ""){
        return;
    }

    console.log("SEARCH", req.query);

    var name = (req.query.f === "1")? `"name:en" = $1`: `to_tsvector('jp', "name:en") @@ to_tsquery('jp', $1)`;
    var value = (req.query.f === "1")? req.query.q : req.query.q.replace(/\s/g, ":*&") + ":*";

    var query = {
        text:   `with poi as (
                    select distinct name, "name:en", tourism, amenity, leisure, st_asgeojson(way) , st_asgeojson(st_centroid(way)) centroid
                    from planet_osm_polygon
                    where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                    union
                    select distinct name, "name:en", tourism, amenity, leisure, st_asgeojson(way) , st_asgeojson(st_centroid(way)) centroid
                    from planet_osm_point
                    where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                )
                select distinct on (name) * from poi
                where ` + name,
        values: [value]
    };
    
    pool.query(query , (err, result) => {
        if(err != null) {
            console.log(err);
        }
                
        var featureCollection = {
            "type": "FeatureCollection",
            "features": []
        };
        
        var features = result.rows.map(function(row){
            var temp = new GeoJson();
            temp.geometry = JSON.parse(row.st_asgeojson);

            temp.properties = {
                name: row.name,
                name_en: row["name:en"],
                tourism: row.tourism,
                amenity: row.amenity,
                leisure: row.leisure,
                centroid: JSON.parse(row.centroid).coordinates
            };

            return temp;
        });
                
        featureCollection.features = features;
        
        res.send(featureCollection);
    });
});

app.get("/suggest", (req, res) => {
    if(req.query.q === ""){
        return;
    }

    console.log("SUGGEST", req.query);
    var query = {
        text:   `with poi as (
                    select distinct name, "name:en"
                    from planet_osm_polygon
                    where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                    union
                    select distinct name, "name:en"
                    from planet_osm_point
                    where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                )
                select distinct on (name) * from poi
                where to_tsvector('jp', "name:en") @@ to_tsquery('jp', $1)
                limit 5`,
        values: [req.query.q.replace(/\s/g, ":*&") + ":*"]
    };
    
    pool.query(query , (err, result) => {
        if(err != null) {
            console.log(err);
        }
        
        res.send(result.rows);
    });
});

app.get("/nearby", (req, res) => {
    if(req.query.q === ""){
        return;
    }

    console.log("NEARBY", req.query);
    var query = {
        text: 
            `with poi as (
                select name, "name:en", tourism, amenity, leisure, st_asgeojson(way), st_asgeojson(st_centroid(way)) centroid, way
                from planet_osm_polygon
                where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                union
                select name, "name:en", tourism, amenity, leisure, st_asgeojson(way), st_asgeojson(st_centroid(way)) centroid, way
                from planet_osm_point
                where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
            )
            select * from poi
            where st_dwithin(
                way::geography, 
                (
                    select way::geography from poi
                    where "name:en" = $1
                    limit 1
                ), 
            $2)
            and (tourism is null or tourism <> 'information')`,
        values: [req.query.q, req.query.d]
    };
    
    pool.query(query , (err, result) => {
        if(err != null) {
            console.log(err);
        }

        var featureCollection = {
            "type": "FeatureCollection",
            "features": []
        };
        
        var features = result.rows.map(function(row){
            var temp = new GeoJson();
            temp.geometry = JSON.parse(row.st_asgeojson);

            temp.properties = {
                name: row.name,
                name_en: row["name:en"],
                tourism: row.tourism,
                amenity: row.amenity,
                leisure: row.leisure,
                centroid: JSON.parse(row.centroid).coordinates
            };

            return temp;
        });
                
        featureCollection.features = features;
        
        res.send(featureCollection);
    });
});

app.get("/between", (req, res) => {
    if(req.query.start === "" || req.query.end === ""){
        return;
    }

    console.log("BETWEEN", req.query);
    var query = {
        text: 
            `with route as (
                with p1 as (
                    select v.id from (    
                        select "name:en", way
                        from planet_osm_polygon
                        where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                        and "name:en" = $1
                        union
                        select "name:en", way
                        from planet_osm_point
                        where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                        and "name:en" = $1
                    ) poi
                    cross join ways_vertices_pgr v
                    order by v.the_geom <-> poi.way
                    limit 1
                ),
                p2 as (
                    select v.id from (    
                        select "name:en", way
                        from planet_osm_polygon
                        where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                        and "name:en" = $2
                        union
                        select "name:en", way
                        from planet_osm_point
                        where (tourism <> '' or amenity = 'place_of_worship' or leisure <> '')
                        and "name:en" = $2
                    ) poi
                    cross join ways_vertices_pgr v
                    order by v.the_geom <-> poi.way
                    limit 1
                )
                select st_union(w.the_geom) from pgr_dijkstra('SELECT gid as id, source, target, cost, reverse_cost, x1, y1, x2, y2 FROM ways', (select id from p1), (select id from p2)) path
                left join ways w on w.gid = path.edge
            ),
            poi as (
                select name, "name:en", tourism, amenity, leisure, way from planet_osm_polygon
                where ((tourism <> '' and tourism <> 'information')  or amenity = 'place_of_worship' or leisure <> '')
                union
                select name, "name:en", tourism, amenity, leisure, way from planet_osm_point
                where ((tourism <> '' and tourism <> 'information')  or amenity = 'place_of_worship' or leisure <> '')
            )
            select name, "name:en", tourism, amenity, leisure, st_asgeojson(way) as way, st_asgeojson(st_union) as union, st_asgeojson(st_centroid(way)) centroid from poi
            cross join route
            where st_dwithin(way::geography, st_union, $3)`,
        values: [req.query.start, req.query.end, req.query.d]
    };
    
    pool.query(query , (err, result) => {
        if(err != null) {
            console.log(err);
        }

        var featureCollection = {
            "type": "FeatureCollection",
            "features": []
        };
        
        var roadJson = new GeoJson();

        var features = result.rows.map(function(row){
            var temp = new GeoJson();
            temp.geometry = JSON.parse(row.way);

            temp.properties = {
                name: row.name,
                name_en: row["name:en"],
                tourism: row.tourism,
                amenity: row.amenity,
                leisure: row.leisure,
                centroid: JSON.parse(row.centroid).coordinates
            };

            roadJson.geometry = JSON.parse(row.union);
            return temp;
        });
                
        featureCollection.features = features;
        
        

        var featureArray = [
            roadJson,
            featureCollection
        ];

        res.send(featureArray);
    });
});

app.listen(12000, "0.0.0.0", function () {
  console.log('Listening on port 12000!');
});

app.use(express.static('public'));