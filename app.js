const speed = 100

// Sugestii afișate la focus pe câmpul de plecare (când e gol)
const suggestedDepartures = {
  "Târgu Mureș": [46.54245, 24.55747],
  "Brașov": [45.6579, 25.6012],
  "Caransebeș": [45.4167, 22.2167],
  "Jibou": [47.255, 23.257],
  "Arad": [46.1866, 21.3123],
  "București": [44.4268, 26.1025],
  "Craiova": [44.3302, 23.7949],
  "Galați": [45.4353, 28.0080],
  "Iași": [47.1585, 27.6014],
  "Constanța": [44.1598, 28.6348]
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

// ── Stare globală ──────────────────────────────────────────────────────────
let start = suggestedDepartures["Târgu Mureș"]
let startName = "Târgu Mureș"
let currentDest = null
let currentDestName = ""
let route
let startMarker
let destMarker
let selectedDest = null
let selectedName = ""
let searchTimeout = null
let depSearchTimeout = null

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

// Icon verde pentru plecare
const greenIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// ── Utilitare coordonate ──────────────────────────────────────────────────
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

  const decRe = /^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/
  const decMatch = s.match(decRe)
  if (decMatch) {
    const lat = parseFloat(decMatch[1])
    const lng = parseFloat(decMatch[2])
    if (isValidLatLng(lat, lng)) return { lat, lng, format: "DD" }
  }

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

  if (intPart.length < degLen) return null

  const deg = parseInt(intPart.substring(0, degLen), 10)
  const remainder = intPart.substring(degLen)

  let decDeg
  if (remainder.length <= 2) {
    const minutes = parseFloat(remainder + fracPart) || 0
    decDeg = deg + minutes / 60
  } else {
    const mm = parseInt(remainder.substring(0, 2), 10)
    const ss = parseFloat(remainder.substring(2) + fracPart) || 0
    decDeg = deg + mm / 60 + ss / 3600
  }

  const sign = (hem === "S" || hem === "W" || hem === "V") ? -1 : 1
  return sign * decDeg
}

function isValidLatLng(lat, lng) {
  return isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
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

// ── Distanțe ───────────────────────────────────────────────────────────────
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

// ── Nominatim helpers ──────────────────────────────────────────────────────
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

function dedupeResults(filtered) {
  const seen = new Set()
  return filtered.filter(item => {
    const code = getCountyCode(item)
    const name = getLocalityName(item)
    const key = `${name.toLowerCase()}-${code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function searchNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=15&countrycodes=ro&q=${encodeURIComponent(query)}`
  const res = await fetch(url, fetchOpts)
  const data = await res.json()
  return dedupeResults(filterAndSort(data))
}

function renderSuggestions(container, items, onPick) {
  container.innerHTML = ""

  if (items.length === 0) {
    const div = document.createElement("div")
    div.className = "suggestion-item"
    div.style.color = "#999"
    div.textContent = "Nicio localitate găsită"
    container.appendChild(div)
    return
  }

  items.forEach(item => {
    const div = document.createElement("div")
    div.className = "suggestion-item"
    div.textContent = item.label
    div.onclick = () => {
      container.innerHTML = ""
      onPick(item)
    }
    container.appendChild(div)
  })
}

// ── PLECARE ────────────────────────────────────────────────────────────────
const depInput = document.getElementById("departureInput")
const depSuggBox = document.getElementById("depSuggestions")
depInput.value = startName

function showDefaultDepartureSuggestions() {
  const items = Object.entries(suggestedDepartures).map(([name, coords]) => ({
    label: name,
    coords,
    name
  }))
  renderSuggestions(depSuggBox, items, item => {
    depInput.value = item.name
    setDeparture(item.coords, item.name)
  })
}

function setDeparture(coords, name) {
  start = coords
  startName = name
  updateStartMarker()
  recalcIfPossible()
}

function updateStartMarker() {
  if (startMarker) map.removeLayer(startMarker)
  startMarker = L.marker(start, { draggable: true, icon: greenIcon })
    .addTo(map)
    .bindPopup(`Plecare: ${startName}`)

  startMarker.on("drag", function () {
    const pos = startMarker.getLatLng()
    start = [pos.lat, pos.lng]
    if (currentDest) {
      const newDistance = routeDistance([start, currentDest])
      const newTime = (newDistance / speed) * 60
      document.getElementById("distance").innerText = newDistance.toFixed(1)
      document.getElementById("time").innerText = newTime.toFixed(0)
      if (route) map.removeLayer(route)
      route = L.polyline([start, currentDest], { color: "red", weight: 4 }).addTo(map)
    }
  })

  startMarker.on("dragend", function () {
    const pos = startMarker.getLatLng()
    start = [pos.lat, pos.lng]
    startName = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`
    depInput.value = startName
    startMarker.setPopupContent(`Plecare: ${startName}`)
  })
}

function recalcIfPossible() {
  if (currentDest) {
    resolveRoute(currentDest, currentDestName)
  }
}

depInput.addEventListener("focus", function () {
  if (this.value.trim().length < 3) showDefaultDepartureSuggestions()
})

depInput.addEventListener("input", function () {
  const q = this.value.trim()
  clearTimeout(depSearchTimeout)

  if (q.length < 3) {
    showDefaultDepartureSuggestions()
    return
  }

  depSearchTimeout = setTimeout(async () => {
    try {
      const unique = await searchNominatim(q)
      const items = unique.map(item => {
        const code = getCountyCode(item)
        const name = getLocalityName(item)
        return {
          label: code ? `${name} (${code})` : name,
          coords: [parseFloat(item.lat), parseFloat(item.lon)]
        }
      })
      renderSuggestions(depSuggBox, items, picked => {
        depInput.value = picked.label
        setDeparture(picked.coords, picked.label)
      })
    } catch (e) {
      console.error("Eroare căutare plecare:", e)
    }
  }, 400)
})

// Închide lista de sugestii la click în afara câmpului
document.addEventListener("click", function (e) {
  if (!e.target.closest("#departureInput") && !e.target.closest("#depSuggestions")) {
    depSuggBox.innerHTML = ""
  }
  if (!e.target.closest("#destination") && !e.target.closest("#suggestions")) {
    document.getElementById("suggestions").innerHTML = ""
  }
})

// ── Click pe hartă = destinație ────────────────────────────────────────────
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

  resolveRoute(newDest, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
})

// ── DESTINAȚIE (căutare după nume) ─────────────────────────────────────────
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
      const unique = await searchNominatim(city)
      const items = unique.map(item => {
        const code = getCountyCode(item)
        const name = getLocalityName(item)
        return {
          label: code ? `${name} (${code})` : name,
          coords: [parseFloat(item.lat), parseFloat(item.lon)]
        }
      })
      renderSuggestions(container, items, picked => {
        document.getElementById("destination").value = picked.label
        selectedDest = picked.coords
        selectedName = picked.label
      })
    } catch (e) {
      console.error("Eroare căutare:", e)
    }
  }, 400)
})

// ── Coordonate — feedback live ─────────────────────────────────────────────
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

// ── Calculează ─────────────────────────────────────────────────────────────
async function calculate() {
  // Dacă e completat câmpul de coordonate, îl prioritizăm
  const coordVal = document.getElementById("coordInput").value.trim()
  if (coordVal) {
    const parsed = parseCoords(coordVal)
    if (!parsed) {
      alert("Format coordonate nerecunoscut.\n\nFormate acceptate:\n• 46.5424, 24.5574\n• N4632.547 E02433.448\n• N463232.8 E0243320.9")
      return
    }
    const label = formatCoordResult(parsed.lat, parsed.lng, parsed.format)
    resolveRoute([parsed.lat, parsed.lng], label)
    return
  }

  // Altfel folosim câmpul de nume localitate
  const city = document.getElementById("destination").value.trim()
  if (!city) return

  if (city.toLowerCase().includes("bucure")) {
    resolveRoute([44.4268, 26.1025], "București (B)")
    return
  }

  if (selectedDest) {
    resolveRoute(selectedDest, selectedName)
    return
  }

  try {
    const filtered = await searchNominatim(city)

    if (filtered.length === 0) {
      alert("Localitate negăsită. Selectați din lista de sugestii.")
      return
    }

    const best = filtered[0]
    const code = getCountyCode(best)
    const name = getLocalityName(best)
    const locationName = code ? `${name} (${code})` : name
    const dest = [parseFloat(best.lat), parseFloat(best.lon)]
    resolveRoute(dest, locationName)
  } catch (e) {
    alert("Eroare la căutare")
  }
}

// ── Trasare rută ───────────────────────────────────────────────────────────
function resolveRoute(dest, locationName) {
  currentDest = dest
  currentDestName = locationName

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
    currentDest = newDest

    const newDistance = routeDistance([start, newDest])
    const newTime = (newDistance / speed) * 60

    document.getElementById("distance").innerText = newDistance.toFixed(1)
    document.getElementById("time").innerText = newTime.toFixed(0)

    if (route) map.removeLayer(route)
    route = L.polyline([start, newDest], { color: "red", weight: 4 }).addTo(map)
  })

  destMarker.on("dragend", function () {
    const pos = destMarker.getLatLng()
    const label = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`
    selectedDest = [pos.lat, pos.lng]
    selectedName = label
    currentDest = selectedDest
    currentDestName = label
    document.getElementById("destination").value = label
    destMarker.setPopupContent(label)
  })

  route = L.polyline(points, { color: "red", weight: 4 }).addTo(map)
  map.fitBounds(route.getBounds(), { padding: [30, 30] })

  updateStartMarker()
}

// ── Inițializare ───────────────────────────────────────────────────────────
updateStartMarker()
