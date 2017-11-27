var mapboxgl = require("mapbox-gl/dist/mapbox-gl.js");
var layers = []; 
var markers = [];

mapboxgl.accessToken = "pk.eyJ1Ijoia3VibzI1IiwiYSI6ImNqOGJhOXViMjBuN3cyd3BiYWh2cjJ4cmMifQ.OG_L80J3ki2Pfa7WN1pgbg";
    var map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v10",
    center: [135.756578, 34.9858534],
    zoom: 10.25                               
});

function clearMap(){
    layers.forEach((layer) => {
        console.log("remove", layer);
        map.removeLayer(layer.id);
        map.removeSource(layer.id);
    });
    layers = []; 

    markers.forEach((marker) => {
        console.log("Remove", marker);
        marker.remove();
    });

    markers = [];
}

function displayOnMap(term, geojson){
    clearMap();    

    var layerPolygon = {
        id: term + "Polygon" + Math.round(Math.random() * 100000),
        type: "fill",
        source: {
            type: "geojson",
            data: geojson
        },
        layout: {},
        paint: {
            "fill-color": "#" + (Math.random().toString(16) + "000000").slice(2, 8),
            "fill-opacity": 0.8
        },
        filter: ["==", "$type", "Polygon"]
    };

    layers.push(layerPolygon);
    map.addLayer(layerPolygon);

    geojson.features.forEach((feature) => {
        var markerElement = document.createElement("div");
        markerElement.classList.add("marker");

        var markerHTML = "<h3>";

        if(feature.properties.name_en !== null){
            markerHTML += feature.properties.name_en;
        }

        if(feature.properties.name !== null){
            markerHTML += " (" + feature.properties.name.replace(/\s*\([^()]*\)*$/g, "") + ")";
        }

        markerHTML += "</h3><ul>";

        if(feature.properties.amenity !== null){
            markerHTML += "<li><strong>Amenity</strong>: place of worship</li>";
        }

        if(feature.properties.leisure !== null){
            markerHTML += "<li><strong>Leisure</strong>: " + feature.properties.leisure +"</li>";
        }

        if(feature.properties.tourism !== null){
            markerHTML += "<li><strong>Tourism</strong>: " + feature.properties.tourism +"</li>";
        }

        markerHTML += "</ul>";

        var marker = new mapboxgl.Marker(markerElement, {offset: [0, -20]})
        .setLngLat(feature.properties.centroid)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(markerHTML))
        .addTo(map);

        markers.push(marker);
    });
}

function search(event, fullName = false){
    event.preventDefault();   
    var term = event.target.closest("form").querySelector("input").value;
    var xhttp = new XMLHttpRequest();
    
    xhttp.onreadystatechange = () => {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            var featureCollection = JSON.parse(xhttp.responseText);

            console.log(featureCollection);
            displayOnMap(term, featureCollection);
        }
    };
    
    xhttp.open("GET", "/search?q=" + term + "&f=" + ((fullName === true)? 1 : 0), true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send();
}

document.getElementById("search").addEventListener("submit", search);
document.getElementById("searchButton").addEventListener("click", search);

document.getElementById("searchBox").addEventListener("input", (event) => {
    suggest(event, document.getElementById("searchSuggestionList"));
});

document.getElementById("openMenu").addEventListener("click", (event) => {
    if(event.target.id === "openMenu"){
        if(event.target.classList.contains("open")){
            document.querySelectorAll(".open").forEach((node) => {
                node.classList.remove("open");
            });
        }
        else{
            event.target.classList.toggle("open");
            event.target.children[0].classList.toggle("open");
        }
    }
});

document.getElementById("searchMenuButton").addEventListener("click", (event) => {
    event.stopPropagation();

    hideOpen("searchMenuWrapper");
    document.getElementById("searchMenuWrapper").classList.toggle("open");    
});

document.getElementById("nearbyMenuButton").addEventListener("click", (event) => {
    event.stopPropagation();

    hideOpen("nearbyMenuWrapper");
    document.getElementById("nearbyMenuWrapper").classList.toggle("open");        
});

document.getElementById("betweenMenuButton").addEventListener("click", (event) => {
    event.stopPropagation();

    hideOpen("betweenMenuWrapper");
    document.getElementById("betweenMenuWrapper").classList.toggle("open");        
});

function hideOpen(id){
    document.querySelectorAll(".menuContentWrapper.open").forEach((node) => {
        if(node.id !== id){
            node.classList.toggle("open");            
        }
    });
}

document.getElementById("removeMenuButton").addEventListener("click", (event) => {
    clearMap();

    document.querySelectorAll(".menuInput").forEach((input) => {
        input.value = "";
    });

    document.querySelectorAll(".suggestionList").forEach((list) => {
        list.innerHTML = '';
    });
});

function assignSuggestion(event){
    event.target.closest("form").querySelector("input").value = event.target.innerHTML.replace(/\s*\([^()]*\)*$/g, "");
    search(event, true);
}

function suggest(event, suggestionList){
    suggestionList.innerHTML = "";
    var xhttp = new XMLHttpRequest();
    
    xhttp.onreadystatechange = () => {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            var suggestions = JSON.parse(xhttp.responseText);

            suggestions.forEach((suggestion) => {
                var li = document.createElement("li");
                var span = document.createElement("span");

                span.innerHTML = suggestion["name:en"];

                if(suggestion.name !== null){
                    span.innerHTML += " (" + suggestion.name.replace(/\s*\([^()]*\)*$/g, "") + ")";
                }

                li.addEventListener("click", assignSuggestion);
                li.appendChild(span);
                suggestionList.appendChild(li);
            });
        }
    };
    
    xhttp.open("GET", "/suggest?q=" + event.target.value, true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send();
}

document.getElementById("nearbyBox").addEventListener("input", (event) => {
    suggest(event, document.getElementById("nearbySuggestionList"));
});

function getNearby(event){
    event.preventDefault();
    
    var term = document.getElementById("nearbyBox").value;
    var distance = document.getElementById("nearbyDistance").value;
    distance = (distance > 1000)? 1000 : (distance < 20)? 20 : distance;
    var xhttp = new XMLHttpRequest();
    
    xhttp.onreadystatechange = () => {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            var featureCollection = JSON.parse(xhttp.responseText);
            console.log(featureCollection);

            displayOnMap(term, featureCollection);
        }
    };
    
    xhttp.open("GET", "/nearby?q=" + term + "&d=" + distance, true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send();
}

document.getElementById("nearby").addEventListener("submit", getNearby);
document.getElementById("nearbyButton").addEventListener("click", getNearby);

document.getElementById("betweenStartBox").addEventListener("input", (event) => {
    suggest(event, document.getElementById("betweenStartSuggestionList"));
});

document.getElementById("betweenEndBox").addEventListener("input", (event) => {
    suggest(event, document.getElementById("betweenEndSuggestionList"));
});

function between(event){
    var xhttp = new XMLHttpRequest();

    var inputStart = document.getElementById("betweenStartBox").value;
    var inputEnd = document.getElementById("betweenEndBox").value;

    var distance = document.getElementById("betweenDistance").value;
    distance = (distance > 500)? 500 : (distance < 20)? 20 : distance;

    if(inputStart === "" || inputEnd === ""){
        return;
    }
    
    xhttp.onreadystatechange = () => {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            var ways = JSON.parse(xhttp.responseText);
            console.log("BETWEEN", ways);

            displayOnMap("between", ways[1]);            

            var layer = {
                "id": "route",
                "type": "line",
                "source": {
                    "type": "geojson",
                    "data": ways[0]
                },
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    "line-color": "#" + (Math.random().toString(16) + "000000").slice(2, 8),
                    "line-width": 4
                }
            };

            layers.push(layer);
            map.addLayer(layer);
        }
    };
    
    xhttp.open("GET", "/between?start=" + inputStart + "&end=" + inputEnd + "&d=" + distance, true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send();
}

document.getElementById("betweenButton").addEventListener("click", between);