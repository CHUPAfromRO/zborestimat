const targuMures = [46.54245, 24.55747]
const speed = 100 // knots

const map = L.map('map').setView(targuMures,7)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
attribution:'© OpenStreetMap'
}).addTo(map)

let route

function haversine(lat1, lon1, lat2, lon2){

const R = 6371

const toRad = x => x * Math.PI / 180

const dLat = toRad(lat2-lat1)
const dLon = toRad(lon2-lon1)

const a =
Math.sin(dLat/2)*Math.sin(dLat/2) +
Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) *
Math.sin(dLon/2)*Math.sin(dLon/2)

const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

const km = R*c

return km * 0.539957 // NM
}

async function calculate(){

const city = document.getElementById("destination").value

const url =
`https://nominatim.openstreetmap.org/search?format=json&q=${city},Romania`

const res = await fetch(url)
const data = await res.json()

if(data.length===0){
alert("Localitate negăsită")
return
}

const lat = parseFloat(data[0].lat)
const lon = parseFloat(data[0].lon)

const distance =
haversine(
targuMures[0],
targuMures[1],
lat,
lon
)

const time = (distance/speed)*60

document.getElementById("distance").innerText =
distance.toFixed(1)

document.getElementById("time").innerText =
time.toFixed(0)

if(route) map.removeLayer(route)

route = L.polyline(
[targuMures,[lat,lon]],
{color:"red"}
).addTo(map)

map.fitBounds(route.getBounds())

}
