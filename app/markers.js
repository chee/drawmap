import {
  within,
  point as turfPoint,
  featureCollection
} from '@turf/turf'

let markers = []

document.addEventListener('search', event => {
  markers.forEach(marker => marker.setMap(null))
  markers = []
  const map = event.detail
  const geoJson = new Promise(resolve => {
    map.data.toGeoJson(resolve)
  })
  const searchData = geoJson.then(getSearchData)

  Promise.all([geoJson, searchData]).then(([geoJson, searchData]) => {
    const points = featureCollection(
      searchData.markers.map(convertMarkerDataToPoint)
    )
    const containedPoints = within(points, geoJson)

    if (containedPoints && containedPoints.features.length) {
      groupMarkers(containedPoints.features.map(makeMarker))
        .forEach(marker => {
          markers.push(marker)
          marker.setMap(map)
        })
    }
  })
})

function getSearchData(geoJson) {
  return fetch('/markers.json', {
    geoJson
  }).then(data => data.json())
}

function convertMarkerDataToPoint(marker) {
  return turfPoint([
    Number(marker.Longitude),
    Number(marker.Latitude)
  ], marker)
}

function makeMarker(point) {
  const icon = `//propertynews.com/${point.properties.Icon || '/images/sitefiles/map-icons/map-icon.png'}`
  const [lng, lat] = point.geometry.coordinates

  const marker = new window.google.maps.Marker({
    position: { lng, lat },
    title: point.properties.Title,
    icon,
    properties: point.properties
  })

  marker.addListener('click', event => {
    marker.properties.event = event
    markerClicked(marker)
  })
  return marker
}

function markerClicked(marker) {
  console.log(marker)
}

function groupMarkers(markers) {
  return markers
}
