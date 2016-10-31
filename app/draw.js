import simplifyjs from 'simplify-js'
import convex from 'convexhull-js'
import {hexToRgba} from 'hex-and-rgba'

export const DRAW_TOOL = 'draw'
export const ERASE_TOOL = 'erase'

const canvas = document.getElementById('draw')
const container = document.getElementById('map-container')
const box = container.getBoundingClientRect()
const context = canvas.getContext('2d')
let points = []
const polygons = []
const mapPolygons = []

function makeMapPolygon({map, polygon, color}) {
  const coordinates = polygon.map(point => {
    return pixelToCoordinate(point, map)
  })
  const mapPolygon = new google.maps.Polygon({
    paths: coordinates,
    strokeColor: color,
    strokeWeight: 2,
    fillColor: color,
    fillOpacity: 0.4
  })
  mapPolygon.setMap(map)
  return mapPolygon
}

const tools = {}

tools[DRAW_TOOL] = {
  color: '#ff2a50',
  up({polygon, map}) {
    const mapPolygon = makeMapPolygon({
      map, polygon, color: this.color
    })
    polygons.push(polygon)
    mapPolygons.push(mapPolygon)
  }
}

tools[ERASE_TOOL] = {
  color: '#3399ff',
  up({polygon, map}) {
    polygons.forEach((livePolygon, index) => {
      polygons[index] = livePolygon.union(new Polygon(polygon))
      console.log(livePolygon.cut(new Polygon(polygon)))
      const newPolygon = polygons[index]
      const coordinates = newPolygon.points.map(point => {
        return pixelToCoordinate(point, map)
      })
      console.log(window.coordinates = coordinates)
      console.log(newPolygon)
      const mapPolygon = new google.maps.Polygon({
        paths: coordinates,
        strokeColor: this.color,
        strokeWeight: 2,
        fillColor: this.color,
        fillOpacity: 0.4
      })
      mapPolygon.setMap(map)
    })
  }
}

canvas.setAttribute('width', box.width)
canvas.setAttribute('height', box.height)

function max(array) {
  return array.reduce((a, b) => Math.max(a, b))
}

function min(array) {
  return array.reduce((a, b) => Math.min(a, b))
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
