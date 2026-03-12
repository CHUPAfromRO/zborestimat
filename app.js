const speed = 100

const cities = {
  "Târgu Mureș": [46.54245, 24.55747],
  "Jibou": [47.255, 23.257],
  "Caransebeș": [45.4167, 22.2167],
  "Arad": [46.1866, 21.3123],
  "Brașov": [45.6579, 25.6012]
}

const bigCities = {
  "București": [44.4268, 26.1025],
  "Cluj-Napoca": [46.7712, 23.6236],
  "Iași": [47.1585, 27.6014],
  "Timișoara": [45.7489, 21.2087],
  "Oradea": [47.0465, 21.9189],
  "Sibiu": [45.7983, 24.1256]
}

const countyAbbr = {
  "Alba": "AB", "Arad": "AR", "Argeș": "AG", "Bacău": "BC",
  "Bihor": "BH", "Bistrița-Năsăud": "BN", "Botoșani": "BT",
  "Brăila": "BR", "Brașov": "BV", "Buzău": "BZ", "Călărași": "CL",
  "Caraș-Severin": "CS", "Cluj": "CJ", "Constanța": "CT",
  "Covasna": "CV", "Dâmbovița": "DB", "Dolj": "DJ", "Galați": "GL",
  "Giurgiu": "GR", "Gorj": "GJ", "Harghita": "HR", "Hunedoara": "HD",
  "Ialomița": "IL", "Iași": "IS", "Ilfov": "IF", "Maramureș": "MM",
  "Mehedinți": "MH", "Mureș": "MS", "Neamț": "NT", "Olt": "OT",
  "Prahova": "PH", "Sălaj": "SJ", "Satu Mare": "SM", "Sibiu": "SB",
  "Suceava": "SV", "Teleorman": "TR", "Timiș": "TM", "Tulcea": "TL",
  "Vâlcea": "VL", "Vaslui": "VS", "Vrancea": "VN", "București": "B"
}

let start = cities["Târgu Mureș"]
let route
let destMarker
let selectedDest = null
let selectedName = ""

const map = L.map('map').setView(start, 7)

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap' }
).addTo(map)

Object.entries(bigCities).forEach(city => {
  L.marker(city[1])
    .addTo(map)
    .bindPopup(city[0])
})

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c * 0.539957
}

function routeDistance(points) {
  let dist = 0
  for (let i = 0; i < points.length - 1; i++) {
    dist += haversine(
      points[i][0], points[i][1],
      points[i + 1][0], points[i + 1][1]
    )
  }
  return dist
}

function getCountyCode(item) {
  const county = item.address?.county
    ?.replace(/\s*Județ\s*/i, "")
    ?.replace(/\s*County\s*/i, "")
    ?.trim()
  return countyAbbr[county] || county || ""
}

document.getElementById("destination").addEventListener("input", async function () {
  const city = this.value.trim()
  const container = document.getElementById("suggestions")

  selectedDest = null
  selectedName = ""

  if (city.length < 3) {
    container.innerHTML = ""
    return
  }

  if (city.toLowerCase().includes("bucure")) {
    container.innerHTML = ""
    return
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=ro&q=${encodeURIComponent(city)}`
  const res = await fetch(url)
  const data = await res.json()

  const unique = [...new Map(data.map(item => {
    const code = getCountyCode(item)
    return [code, item]
  })).values()]

  container.innerHTML = ""

  unique.forEach(item => {
    const code = getCountyCode(item)
    const locationName = code ? `${city} (${code})` : city

    const div = document.createElement("div")
    div.className = "suggestion-item"
    div.textContent = locationName
    div.onclick = () => {
      document.getElementById("destination").value = locationName
      container.innerHTML = ""
      selectedDest = [parseFloat(item.lat), parseFloat(item.lon)]
      selectedName = locationName
    }
    container.appendChild(div)
  })
})

async function calculate() {
  const departure = document.getElementById("departure").value
  start = cities[departure]

  const city = document.getElementById("destination").value.trim()
  if (!city) return

  if (city.toLowerCase().includes("bucure")) {
    resolveRoute([44.4268, 26.1025], city, departure)
    return
  }

  if (selectedDest) {
    resolveRoute(selectedDest, selectedName, departure)
    return
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=ro&q=${encodeURIComponent(city)}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.length === 0) {
    alert("Localitate negăsită")
    return
  }

  const dest = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  resolveRoute(dest, city, departure)
}

function resolveRoute(dest, locationName, departure) {
  const points = [start, dest]
  const distance = routeDistance(points)
  let time = (distance / speed) * 60

  if (departure.includes("Mure") && locationName.toLowerCase().includes("bucure")) {
    time = 100
  }

  document.getElementById("distance").innerText = distance.toFixed(1)
  document.getElementById("time").innerText = time.toFixed(0)

  if (route) map.removeLayer(route)
  if (destMarker) map.removeLayer(destMarker)

  destMarker = L.marker(dest).addTo(map).bindPopup(locationName)

  route = L.polyline(points, {
    color: "red",
    weight: 4
  }).addTo(map)

  map.fitBounds(route.getBounds())
}
