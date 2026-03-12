const speed = 100

const cities = {
"Târgu Mureș":[46.54245,24.55747],
"Jibou":[47.255,23.257],
"Caransebeș":[45.4167,22.2167],
"Arad":[46.1866,21.3123],
"Brașov":[45.6579,25.6012]
}

const bigCities = {
"București":[44.4268,26.1025],
"Cluj-Napoca":[46.7712,23.6236],
"Iași":[47.1585,27.6014],
"Timișoara":[45.7489,21.2087],
"Oradea":[47.0465,21.9189],
"Sibiu":[45.7983,24.1256]
}

const valeaOltuluiRoute = [
[45.252,24.317], // Caineni
[45.143,24.674], // Curtea de Arges
[44.980,26.020]  // Floresti VOR/DME
]

let start = cities["Târgu Mureș"]

const map = L.map('map').setView(start,7)

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{attribution:'© OpenStreetMap'}
).addTo(map)

let route

// afisare orase mari pe harta
Object.entries(bigCities).forEach(city=>{
L.marker(city[1])
.addTo(map)
.bindPopup(city[0])
})

function haversine(lat1,lon1,lat2,lon2){

const R=6371
const toRad=x=>x*Math.PI/180

const dLat=toRad(lat2-lat1)
const dLon=toRad(lon2-lon1)

const a=
Math.sin(dLat/2)**2+
Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*
Math.sin(dLon/2)**2

const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

return R*c*0.539957
}

function routeDistance(points){

let dist=0

for(let i=0;i<points.length-1;i++){

dist+=haversine(
points[i][0],
points[i][1],
points[i+1][0],
points[i+1][1]
)

}

return dist
}

async function calculate(){

const departure =
document.getElementById("departure").value

start=cities[departure]

const city =
document.getElementById("destination").value

const url =
`https://nominatim.openstreetmap.org/search?format=json&q=${city},Romania`

const res = await fetch(url)
const data = await res.json()

if(data.length===0){
alert("Localitate negăsită")
return
}

const dest = [
parseFloat(data[0].lat),
parseFloat(data[0].lon)
]

let points=[start]

// ruta Valea Oltului catre Bucuresti
const plecariValeaOltului = [
"Târgu Mureș",
"Jibou",
"Arad"
]

if(
city.toLowerCase().includes("bucure")
&& plecariValeaOltului.includes(departure)
){

valeaOltuluiRoute.forEach(p=>points.push(p))

}

points.push(dest)

const distance=routeDistance(points)

const time=(distance/speed)*60

document.getElementById("distance")
.innerText=distance.toFixed(1)

document.getElementById("time")
.innerText=time.toFixed(0)

if(route) map.removeLayer(route)

route=L.polyline(points,{
color:"red",
weight:4
}).addTo(map)

map.fitBounds(route.getBounds())

}
