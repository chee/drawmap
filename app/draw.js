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
  }).map(point => [
    point.lng(),
    point.lat()
  ])
  coordinates.push(coordinates[0])
  return turfPolygon([coordinates])
}

function clear(map) {
  map.data.forEach(livingFeature => {
    map.data.remove(livingFeature)
  })
}

const identity = thing => thing

function plot(map) {
  map.data.addGeoJson(featureCollection(features), ...gaps)
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
    const unions = []
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
      features.push(makeFeature({
        map,
        polygon: polygons[0]
      }))
      const gaps = polygons.slice(1)
      gaps.map(polygon => makeFeature({
        map,
        polygon
      })).forEach(gap => {
        if (intersect(gap, feature)) {

        } else {
          erase(gap)
        }
      })
    } else {
      features.push(feature)
    }
    redrawMap(map)
  }
}

function erase(gap) {
  features.forEach((feature, index) => {
    if (intersect(gap, feature)) {
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
    erase(gap)
    redrawMap(map)
  }
}

function addPoint(x, y) {
  points.push({x, y})
}

export function drawline({color, width, display = true}) {
  context.beginPath()
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = color && display ? hexToRgba(color, 60) : 'rgba(0,0,0,.01)'
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.lineWidth = width
  context.moveTo(points[0] && points[0].x, points[0] && points[0].y)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x - (display ? width / 2 : 0), points[index].y)
  }
  context.stroke()
}

function redraw({color, width}) {
  drawline({
    color,
    width,
    points
  })
}

function pixelToCoordinate(point, map) {
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
    if (!moving) {
      points.pop()
      painting = false
      return
    }
    const tool = tools[canvas.getAttribute('data-tool')]
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

  canvas.addEventListener('mousedown', down)
  canvas.addEventListener('mouseup', up)
  canvas.addEventListener('mouseleave', up)
  canvas.addEventListener('mousemove', move )

  canvas.addEventListener('touchstart', down)
  canvas.addEventListener('touchend', up)
  canvas.addEventListener('touchleave', up)
  canvas.addEventListener('touchmove', move)
})
