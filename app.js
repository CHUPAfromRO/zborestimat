const speed = 100

const cities = {
  "Târgu Mureș": [46.54245, 24.55747],
  "Jibou": [47.255, 23.257],
  "Caransebeș": [45.4167, 22.2167],
  "Arad": [46.1866, 21.3123],
  "Brașov": [45.6579, 25.6012]
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

const allowedTypes = ["city", "town", "village", "hamlet", "suburb", "quarter", "neighbourhood", "municipality"]

let start = cities["Târgu Mureș"]
let route
let destMarker
let selectedDest = null
let selectedName = ""
let searchTimeout = null

const fetchOpts = {
  headers: {
    "Accept-Language": "ro",
    "User-Agent": "calculator-zbor/1.0"
  }
}

const map = L.map('map').setView(start, 7)

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap' }
).addTo(map)

map.on("click", function (e) {
  const newDest = [e.latlng.lat, e.latlng.lng]
  const departure = document.getElementById("departure").value
  start = cities[departure]
  resolveRoute(newDest, `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`, departure)
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

function getLocalityName(item) {
  return (
    item.address?.city ||
    item.address?.town ||
    item.address?.village ||
    item.address?.hamlet ||
    item.address?.suburb ||
    item.namedetails?.name ||
    item.display_name?.split(",")[0]?.trim() ||
    ""
  )
}

function filterAndSort(data) {
  return data
    .filter(item => allowedTypes.includes(item.type) || allowedTypes.includes(item.addresstype))
    .sort((a, b) => {
      const priority = ["city", "municipality", "town", "village", "hamlet", "suburb", "quarter", "neighbourhood"]
      const aP = priority.indexOf(a.type !== "administrative" ? a.type : a.addresstype)
      const bP = priority.indexOf(b.type !== "administrative" ? b.type : b.addresstype)
      return (aP === -1 ? 99 : aP) - (bP === -1 ? 99 : bP)
    })
}

document.getElementById("destination").addEventListener("input", function () {
  const city = this.value.trim()
  const container = document.getElementById("suggestions")

  selectedDest = null
  selectedName = ""
  container.innerHTML = ""

  if (city.length < 3) return
  if (city.toLowerCase().includes("bucure")) return

  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=15&countrycodes=ro&q=${encodeURIComponent(city)}`
      const res = await fetch(url, fetchOpts)
      const data = await res.json()

      const filtered = filterAndSort(data)

      // deduplicare dupa nume+judet ca sa pastram localitati omonime din judete diferite
      const seen = new Set()
      const unique = filtered.filter(item => {
        const code = getCountyCode(item)
        const name = getLocalityName(item)
        const key = `${name.toLowerCase()}-${code}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      container.innerHTML = ""

      if (unique.length === 0) {
        const div = document.createElement("div")
        div.className = "suggestion-item"
        div.style.color = "#999"
        div.textContent = "Nicio localitate găsită"
        container.appendChild(div)
        return
      }

      unique.forEach(item => {
        const code = getCountyCode(item)
        const name = getLocalityName(item)
        const locationName = code ? `${name} (${code})` : name

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
    } catch (e) {
      console.error("Eroare căutare:", e)
    }
  }, 400)
})

async function calculate() {
  const departure = document.getElementById("departure").value
  start = cities[departure]

  const city = document.getElementById("destination").value.trim()
  if (!city) return

  if (city.toLowerCase().includes("bucure")) {
    resolveRoute([44.4268, 26.1025], "București (B)", departure)
    return
  }

  if (selectedDest) {
    resolveRoute(selectedDest, selectedName, departure)
    return
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=15&countrycodes=ro&q=${encodeURIComponent(city)}`
    const res = await fetch(url, fetchOpts)
    const data = await res.json()

    const filtered = filterAndSort(data)

    if (filtered.length === 0) {
      alert("Localitate negăsită. Selectați din lista de sugestii.")
      return
    }

    const best = filtered[0]
    const code = getCountyCode(best)
    const name = getLocalityName(best)
    const locationName = code ? `${name} (${code})` : name
    const dest = [parseFloat(best.lat), parseFloat(best.lon)]
    resolveRoute(dest, locationName, departure)
  } catch (e) {
    alert("Eroare la căutare")
  }
}

function resolveRoute(dest, locationName, departure) {
  const points = [start, dest]
  const distance = routeDistance(points)
  const time = (distance / speed) * 60

  document.getElementById("distance").innerText = distance.toFixed(1)
  document.getElementById("time").innerText = time.toFixed(0)

  if (route) map.removeLayer(route)
  if (destMarker) map.removeLayer(destMarker)

  destMarker = L.marker(dest, { draggable: true }).addTo(map).bindPopup(locationName)

  destMarker.on("drag", function () {
    const pos = destMarker.getLatLng()
    const newDest = [pos.lat, pos.lng]

    const newDistance = routeDistance([start, newDest])
    const newTime = (newDistance / speed) * 60

    document.getElementById("distance").innerText = newDistance.toFixed(1)
    document.getElementById("time").innerText = newTime.toFixed(0)

    if (route) map.removeLayer(route)
    route = L.polyline([start, newDest], { color: "red", weight: 4 }).addTo(map)
  })

  destMarker.on("dragend", function () {
    const pos = destMarker.getLatLng()
    selectedDest = [pos.lat, pos.lng]
    document.getElementById("destination").value = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`
  })

  route = L.polyline(points, { color: "red", weight: 4 }).addTo(map)
  map.fitBounds(route.getBounds())
}
