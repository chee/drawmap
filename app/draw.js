import hexToRgba from 'hex-rgba'

import {
  simplify,
  within as polygonWithin,
  reduce as reducePolygons
} from './shape'
import {
  point as turfPoint,
  polygon as turfPolygon,
  featureCollection,
  intersect,
  union,
  difference
} from '@turf/turf'

export const DRAW_TOOL = 'draw'
export const ERASE_TOOL = 'erase'

const canvas = document.getElementById('draw')
const container = document.getElementById('map-container')
const context = canvas.getContext('2d')
let points = []
let features = []
let gaps = []

function setCanvasHeight() {
  const box = container.getBoundingClientRect()
  canvas.setAttribute('width', box.width)
  canvas.setAttribute('height', box.height)
}
window.addEventListener('resize', setCanvasHeight)
setCanvasHeight()

function makeFeature({map, polygon}) {
  const coordinates = polygon.map(point => {
    return pixelToCoordinate(point, map)
  }).map(point => point && [
    point.lng(),
    point.lat()
  ]).filter(identity)
  coordinates.push(coordinates[0])
  if (coordinates.length < 4) return null
  try {
    return turfPolygon([coordinates])
  } catch(error) {
    console.error(error)
    return null
  }
}

function clear(map) {
  map.data.forEach(feature => {
    map.data.remove(feature)
  })
}

const identity = thing => thing

function plot(map) {
  try {
    map.data.addGeoJson(featureCollection(features))
  } catch(error) {
    console.error('fuck: ', error)
  }
}

function redrawMap(map) {
  clear(map)
  features = features.filter(identity).filter(({ geometry: { coordinates: [ points ] } }) => {
    let contained = false
    features.forEach(feature => {
      contained = contained || polygonWithin(points, feature.geometry.coordinates[0]) ? true : false
      feature.geometry.coordinates.slice(1).forEach((gapPoints, index) => {
        if (polygonWithin(points, gapPoints)) {
          contained = false
        }
      })
      // console.log(polygonWithin(points, featurePoints), points, featurePoints)
    })
    return !contained
  })
  gaps = gaps.filter(identity)
  //gaps = containsAny(gaps.filter(identity), features)
  plot(map)
  document.dispatchEvent(new CustomEvent('search', { detail: map }))
}

const tools = {}

function makeUnions(drawnFeature) {
  const unions = []
  features = features.filter(identity)
  features.forEach((feature, index) => {
    if (intersect(feature, drawnFeature)) {
      delete features[index]
      unions.push(union(feature, drawnFeature))
    }
  })
  features = features.filter(identity)
  return unions
}

function reduceFeatures(features) {
  return features.reduce((a, b) => union(a, b))
}

function featureToPolygons(feature, map) {
  return feature.geometry.coordinates.map(coordinates => (
    coordinates.map(coordinate => coordinateToPixel(coordinate, map))
  ))
}

tools[DRAW_TOOL] = {
  color: '#ff2a50',
  width: 20,
  up({polygon, map}) {
    const drawnFeature = makeFeature({
      map, polygon
    })
    if (!drawnFeature) return
    const unions = makeUnions(drawnFeature)
    if (unions.length) {
      const polygon = reducePolygons(featureToPolygons(reduceFeatures(unions), map))
      const unionFeature = makeFeature({
        map,
        polygon
      })
      features.push(unionFeature)
    } else {
      features.push(drawnFeature)
    }

    const featureIndex = features.length - 1
    gaps.forEach((gap, index) => {
      if (!(drawnFeature && gap)) return

      // if these intersect, it means the user drew a shape that was intended to change the shape of an erased area
      if (intersect(drawnFeature, gap)) {
        gaps[index] = difference(gap, drawnFeature)
        try {
          gaps[index] && (features[featureIndex] = difference(features[featureIndex], gaps[index]))
        } catch(error) {
          console.error('errur', error)
        }
      } else if (intersect(features[featureIndex], gap)) {
        features[featureIndex] = difference(features[featureIndex], gap)
      }
    })
    redrawMap(map)
  },
  point({point, map}) {

  }
}

function erase(gap) {
  features.forEach((feature, index) => {
    if (!gap) return
    const newGap = intersect(gap, feature)
    if (!newGap) return
    gaps.push(newGap)
    const newFeature = difference(feature, newGap)
    newFeature && (features[index] = newFeature)
  })
}

tools[ERASE_TOOL] = {
  color: '#3399ff',
  width: 30,
  up({polygon, map}) {
    const gap = makeFeature({
      map, polygon
    })
    if (!gap) return
    console.log('gap', gap)
    erase(gap)
    redrawMap(map)
  },
  point({point, map}) {
    // point = makePoint({point, map})
    // features.forEach((feature, index) => {
    //   if (inside(point, feature)) {
    //     delete features[index]
    //   }
    // })
    // redrawMap(map)
  }
}

function addPoint(x, y) {
  points.push({x, y})
}

export function drawline({color, width, display = true}) {
  context.beginPath()
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = color && display ? hexToRgba(color, 60) : 'rgba(0, 0, 0, .01)'
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.lineWidth = width
  for (let index = 0; index < points.length; index += 1) {
    context.lineTo(points[index].x - (display ? width / 2 : 0), points[index].y)
  }
  context.stroke()
}

function pixelToCoordinate(point, map) {
  if (!(point && point.x && point.y)) return
  const topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast())
  const bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest())
  const scale = Math.pow(2, map.zoom)
  const worldPoint = new window.google.maps.Point(point.x / scale + bottomLeft.x, point.y / scale + topRight.y)
  return map.getProjection().fromPointToLatLng(worldPoint)
}

function coordinateToPixel(coordinate, map) {
  const topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast())
  const bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest())
  const scale = Math.pow(2, map.zoom)
  const worldPoint = map.getProjection().fromLatLngToPoint({
    lng() {
      return coordinate[0]
    },
    lat() {
      return coordinate[1]
    }
  })
  return new window.google.maps.Point((worldPoint.x - bottomLeft.x) * scale, (worldPoint.y - topRight.y) * scale)
}

function redraw({color, width}) {
  drawline({
    color,
    width
  })
}

document.addEventListener('mapready', event => {
  const map = event.detail
  let painting = false
  let moving = false

  map.data.setStyle({
    strokeColor: '#ff2a50',
    strokeWeight: 2,
    fillColor: '#ff2a50',
    fillOpacity: 0.4
  })

  function down(event) {
    const tool = tools[canvas.getAttribute('data-tool')]
    moving = false
    painting = true
    const x = event.offsetX || event.touches[0].pageX
    const y = event.offsetY || event.touches[0].pageY
    addPoint(x, y)
    redraw(tool)
  }

  function move(event) {
    event.preventDefault()
    const tool = tools[canvas.getAttribute('data-tool')]
    const y = event.offsetY || (event.touches && event.touches[0].pageY)
    const x = event.offsetX || (event.touches && event.touches[0].pageX)
    if (painting && x && y) {
      moving = true
      addPoint(x, y)
      redraw(tool)
    }
  }

  function up(event) {
    const tool = tools[canvas.getAttribute('data-tool')]
    if (!moving) {
      const point = points.pop()
      painting = false
      tool.point({point, map})
      return redraw(tool)
    }
    painting = false
    moving = false
    if (!points.length) return
    const polygon = simplify(points, canvas, tool.width)
    if (polygon.length > 3) {
      tool.up({polygon, map})
    }
    points = []
    redraw(tool)
  }

  function cancel() {
    const tool = tools[canvas.getAttribute('data-tool')]
    points = []
    moving = painting = false
    redraw(tool)
  }

  canvas.addEventListener('mousedown', down)
  canvas.addEventListener('mouseup', up)
  canvas.addEventListener('mouseleave', cancel)
  canvas.addEventListener('mousemove', move )

  canvas.addEventListener('touchstart', down)
  canvas.addEventListener('touchend', up)
  canvas.addEventListener('touchmove', move)
})
