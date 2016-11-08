import hexToRgba from 'hex-rgba'

import {
  simplify,
  reduce
} from './shape'
import {
  polygon as turfPolygon,
  featureCollection,
  intersect,
  union,
  difference,
  point as turfPoint,
  inside
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

function makePoint({map, point}) {
  let coordinate = pixelToCoordinate(point, map)
  if (!coordinate) return null
  coordinate = [coordinate.lng(), coordinate.lat()]
  return turfPoint(coordinate)
}

function makeFeature({map, polygon}) {
  if (!polygon.length) debugger
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
  features = features.filter(identity)
  plot(map)
}

const tools = {}

tools[DRAW_TOOL] = {
  color: '#ff2a50',
  width: 20,
  up({polygon, map}) {
    const feature = makeFeature({
      map, polygon
    })
    if (!feature) return
    const unions = []
    features = features.filter(identity)
    features.forEach((livingFeature, index) => {
      if (intersect(feature, livingFeature)) {
        delete features[index]
        unions[index] = union(livingFeature, feature)
      }
    })
    if (unions.length) {
      const polygons = unions.reduce((a, b) => union(a, b)).geometry.coordinates.map(coordinates => (
        coordinates.map(coordinate => coordinateToPixel(coordinate, map))
      ))
      const unionFeature = makeFeature({
        map,
        polygon: polygons[0]
      })
      if (!feature) return
      features.push(unionFeature)
      gaps.forEach((gap, index) => {
        if (intersect(feature, gap)) {
          gaps[index] = difference(gap, feature)
          try {
            gaps[index] && (features[features.length - 1] = difference(features[features.length - 1], gaps[index]))
          } catch(error) {
            console.error(error)
          }
          gaps = gaps.filter(identity)
        } else {
          features[features.length - 1] = difference(features[features.length - 1], gap)
        }
      })
    } else {
      features.push(feature)
    }
    redrawMap(map)
  },
  point({point, map}) {

  }
}

function erase(gap) {
  features.forEach((feature, index) => {
    gap = intersect(gap, feature)
    if (gap) {
      // if this gap intersects with a feature, then add it to the gaps array
      gaps.push(gap)
      gaps = gaps.filter(identity)
      features[index] = difference(feature, gap)
    }
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
    erase(gap)
    redrawMap(map)
  },
  point({point, map}) {
    point = makePoint({point, map})
    features.forEach((feature, index) => {
      if (inside(point, feature)) {
        delete features[index]
      }
    })
    redrawMap(map)
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
