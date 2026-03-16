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

function toDMS(deg, isLat) {
  const d = Math.floor(Math.abs(deg))
  const mFull = (Math.abs(deg) - d) * 60
  const m = Math.floor(mFull)
  const s = ((mFull - m) * 60).toFixed(1)
  const dir = isLat ? (deg >= 0 ? "N" : "S") : (deg >= 0 ? "E" : "V")
  const mDec = mFull.toFixed(3).padStart(6, "0")
  return {
    dm: `${d}° ${mDec}'`,
    dms: `${d}° ${m.toString().padStart(2, "0")}' ${s}"`,
    dir
  }
}

function buildPopup(latDMS, lngDMS, altText) {
  return `
    <div style="font-family: monospace; font-size: 12px; line-height: 1.8; min-width: 220px;">
      <b style="font-size: 13px; font-family: sans-serif;">📍 Coordonate</b><br>
      <hr style="margin: 4px 0; border-color: #ccc">
      <b>Grade, Minute:</b><br>
      &nbsp;Lat: ${latDMS.dm} ${latDMS.dir}<br>
      &nbsp;Lon: ${lngDMS.dm} ${lngDMS.dir}<br>
      <b>Grade, Minute, Secunde:</b><br>
      &nbsp;Lat: ${latDMS.dms} ${latDMS.dir}<br>
      &nbsp;Lon: ${lngDMS.dms} ${lngDMS.dir}<br>
      <hr style="margin: 4px 0; border-color: #ccc">
      <b>Altitudine:</b> ${altText}
    </div>
  `
}

// ---------------------------------------------------------------------------
// Coordinate parsing
// Accepts three formats:
//   1. Decimal degrees:        46.5424, 24.5574   or   46.5424 24.5574
//   2. DDMMss.s (DMS compact): N463232.8 E0243320.9
//   3. DDMM.mmm (DMm compact): N4632.547 E02433.448
// ---------------------------------------------------------------------------
function parseCoords(raw) {
  const s = raw.trim().toUpperCase()

  // Format 1: two decimal numbers separated by comma or space
  const decRe = /^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/
  const decMatch = s.match(decRe)
  if (decMatch) {
    const lat = parseFloat(decMatch[1])
    const lng = parseFloat(decMatch[2])
    if (isValidLatLng(lat, lng)) return { lat, lng, format: "DD" }
  }

  // Format 2 & 3: N/S + digits + E/W/V + digits
  const coordRe = /^([NS])(\d+(?:\.\d+)?)\s+([EWV])(\d+(?:\.\d+)?)$/
  const coordMatch = s.match(coordRe)
  if (coordMatch) {
    const latHem = coordMatch[1]
    const latRaw = coordMatch[2]
    const lngHem = coordMatch[3]
    const lngRaw = coordMatch[4]

    const lat = parseDMorDMS(latRaw, latHem)
    const lng = parseDMorDMS(lngRaw, lngHem)

    if (lat !== null && lng !== null && isValidLatLng(lat, lng)) {
      const dotPos = latRaw.indexOf(".")
      const intDigits = dotPos === -1 ? latRaw.length : dotPos
      const format = intDigits <= 4 ? "DMm" : "DMS"
      return { lat, lng, format }
    }
  }

  return null
}

function parseDMorDMS(raw, hem) {
  const dotPos = raw.indexOf(".")
  const intPart = dotPos === -1 ? raw : raw.substring(0, dotPos)
  const fracPart = dotPos === -1 ? "" : raw.substring(dotPos)

  const isLon = (hem === "E" || hem === "W" || hem === "V")
  const degLen = isLon ? 3 : 2

  const deg = parseInt(intPart.substring(0, degLen), 10)
  const remainder = intPart.substring(degLen)

  let decDeg
  if (remainder.length <= 2) {
    const minutes = parseFloat(remainder + fracPart)
    decDeg = deg + minutes / 60
  } else {
    const mm = parseInt(remainder.substring(0, 2), 10)
    const ss = parseFloat(remainder.substring(2) + fracPart)
    decDeg = deg + mm / 60 + ss / 3600
  }

  const sign = (hem === "S" || hem === "W" || hem === "V") ? -1 : 1
  return sign * decDeg
}

function isValidLatLng(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function formatCoordResult(lat, lng, format) {
  const latF = lat.toFixed(5)
  const lngF = lng.toFixed(5)
  if (format === "DD") return `${latF}, ${lngF}`
  const latDMS = toDMS(lat, true)
  const lngDMS = toDMS(lng, false)
  if (format === "DMm") return `${latDMS.dir}${latDMS.dm} ${lngDMS.dir}${lngDMS.dm}`
  return `${latDMS.dir}${latDMS.dms} ${lngDMS.dir}${lngDMS.dms}`
}

// ---------------------------------------------------------------------------

map.on("click", async function (e) {
  const lat = e.latlng.lat
  const lng = e.latlng.lng
  const newDest = [lat, lng]

  const latDMS = toDMS(lat, true)
  const lngDMS = toDMS(lng, false)

  const popup = L.popup()
    .setLatLng(e.latlng)
    .setContent(buildPopup(latDMS, lngDMS, "Se încarcă..."))
    .openOn(map)

  try {
    const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
    const data = await res.json()
    const meters = data.results[0].elevation
    const feet = (meters * 3.28084).toFixed(0)
    popup.setContent(buildPopup(latDMS, lngDMS, `${feet} ft`))
  } catch {
    popup.setContent(buildPopup(latDMS, lngDMS, "Indisponibil"))
  }

  const departure = document.getElementById("departure").value
  start = cities[departure]
  resolveRoute(newDest, `${lat.toFixed(4)}, ${lng.toFixed(4)}`, departure)
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
  return item.display_name?.split(",")[0]?.trim() || ""
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
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=15&countrycodes=ro&q=${encodeURIComponent(city)}`
      const res = await fetch(url, fetchOpts)
      const data = await res.json()

      const filtered = filterAndSort(data)

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

// Coordinate input — live validation feedback
document.getElementById("coordInput").addEventListener("input", function () {
  const val = this.value.trim()
  const feedback = document.getElementById("coordFeedback")

  if (!val) {
    feedback.textContent = ""
    feedback.style.color = ""
    return
  }

  const parsed = parseCoords(val)
  if (parsed) {
    feedback.textContent = `✔ ${formatCoordResult(parsed.lat, parsed.lng, parsed.format)}`
    feedback.style.color = "green"
  } else {
    feedback.textContent = "Format nerecunoscut"
    feedback.style.color = "red"
  }
})

async function calculate() {
  const departure = document.getElementById("departure").value
  start = cities[departure]

  // Dacă e completat câmpul de coordonate, îl prioritizăm
  const coordVal = document.getElementById("coordInput").value.trim()
  if (coordVal) {
    const parsed = parseCoords(coordVal)
    if (!parsed) {
      alert("Format coordonate nerecunoscut.\n\nFormate acceptate:\n• 46.5424, 24.5574\n• N4632.547 E02433.448\n• N463232.8 E0243320.9")
      return
    }
    const label = formatCoordResult(parsed.lat, parsed.lng, parsed.format)
    resolveRoute([parsed.lat, parsed.lng], label, departure)
    return
  }

  // Altfel folosim câmpul de nume localitate
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
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=15&countrycodes=ro&q=${encodeURIComponent(city)}`
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
