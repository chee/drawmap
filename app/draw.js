import simplifyjs from 'simplify-js'
import convex from 'convexhull-js'
import {hexToRgba} from 'hex-and-rgba'
import turf from '@turf/turf'

export const DRAW_TOOL = 'draw'
export const ERASE_TOOL = 'erase'

const canvas = document.getElementById('draw')
const container = document.getElementById('map-container')
const box = container.getBoundingClientRect()
const context = canvas.getContext('2d')
let points = []
let features = []
let gaps = []

function setCanvasHeight() {
  canvas.setAttribute('width', box.width)
  canvas.setAttribute('height', box.height)
}
window.addEventListener('resize', setCanvasHeight)
setCanvasHeight()

function makeFeature({map, polygon, color}) {
  window.map = map
  const google = window.google
  const coordinates = polygon.map(point => {
    return pixelToCoordinate(point, map)
  }).map(point => [
    point.lng(),
    point.lat()
  ])
  coordinates.push(coordinates[0])
  const feature = turf.polygon([coordinates])
  return feature
}

function plot() {
    map.data.addGeoJson(turf.featureCollection(features), ...gaps)
}

const tools = {}

tools[DRAW_TOOL] = {
  color: '#ff2a50',
  up({polygon, map}) {
  const feature = makeFeature({
    map, polygon
  })
  map.data.forEach(livingFeature => {
    map.data.remove(livingFeature)
  })
  const unions = []
  features.forEach((livingFeature, index) => {
    const intersect = turf.intersect(feature, livingFeature)
    if (intersect) {
      delete features[index]
      unions[index] = turf.union(livingFeature, feature)
    }
  })
  if (unions.length) {
    features.push(unions.reduce((a, b) => turf.union(a, b)))
  } else {
    features.push(feature)
  }
  features = features.filter(feature => feature)
  plot()
  }
}

tools[ERASE_TOOL] = {
  color: '#3399ff',
  up({polygon, map}) {
    const gap = makeFeature({
      map, polygon
    })
    map.data.forEach(livingFeature => {
      map.data.remove(livingFeature)
    })
    const unions = []
    features.forEach((feature, index) => {
      const intersect = turf.intersect(gap, feature)
      if (intersect) {
        features[index] = turf.difference(feature, gap)
      }
    })
    plot()
  }
}

function simplify(points) {
  const simplePoints = simplifyjs(points, 4, true)
  return convex(points)
}

function addPoint(x, y) {
  points.push({
    x,
    y
  })
}

function redraw({color}) {
  const [r, g, b, a] = hexToRgba(`${color}66`)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = color
  context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
  context.lineJoin = 'round'
  context.lineWidth = 5
  context.beginPath()
  context.moveTo(points[0] && points[0].x, points[0] && points[0].y)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y)
  }
  context.closePath()
  context.stroke()
  context.fill()
}

function pixelToCoordinate(point, map) {
  const topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast())
  const bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest())
  const scale = Math.pow(2, map.zoom)
  const worldPoint = new google.maps.Point(point.x / scale + bottomLeft.x, point.y / scale + topRight.y)
  return map.getProjection().fromPointToLatLng(worldPoint)
}

document.addEventListener('mapready', event => {
  const google = window.google
  const map = event.detail
  let painting = false

  map.data.setStyle({
    strokeColor: '#ff2a50',
    strokeWeight: 2,
    fillColor: '#ff2a50',
    fillOpacity: 0.4
  })

  function down(event) {
    const tool = tools[canvas.getAttribute('data-tool')]
    painting = true
    const x = event.offsetX || event.touches[0].pageX
    const y = event.offsetY || event.touches[0].pageY
    addPoint(x, y)
    redraw(tool)
  }

  function up(event) {
    const tool = tools[canvas.getAttribute('data-tool')]
    painting = false
    if (!points.length) return
    const polygon = simplify(points)
    tool.up({polygon, map})
    points = []
    redraw(tool)
  }

  function move(event) {
    event.preventDefault()
    const tool = tools[canvas.getAttribute('data-tool')]
    const x = event.offsetX || event.touches[0].pageX
    const y = event.offsetY || event.touches[0].pageY
    if (painting) {
      addPoint(x, y)
      redraw(tool)
    }
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
