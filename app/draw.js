import simplify from 'simplify-js'

const canvas = document.getElementById('draw')
const container = document.getElementById('map-container')
const box = container.getBoundingClientRect()
const context = canvas.getContext('2d')
let points = []
const polygons = []

canvas.setAttribute('width', box.width)
canvas.setAttribute('height', box.height)

function addPoint(x, y) {
  points.push({
    x,
    y
  })
}

function redraw() {
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#ff2a50'
  context.fillStyle = 'rgba(255, 47, 74, 0.2)'
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
  const map = event.detail
  let painting = false

  function down(event) {
    painting = true
    const x = event.offsetX || event.touches[0].pageX
    const y = event.offsetY || event.touches[0].pageY
    addPoint(x, y)
    redraw()
  }

  function up(event) {
    painting = false
    if (!points.length) return
    const simplePoints = simplify(points, 4, true)
    const coordinates = simplePoints.map(point => {
      return pixelToCoordinate(point, map)
    })
    const polygon = new google.maps.Polygon({
      paths: coordinates,
      strokeColor: '#ff2a50',
      strokeWeight: 2,
      fillColor: '#ff2a50',
      fillOpacity: 0.4
    })
    polygons.push(polygon)
    polygon.setMap(map)
    points = []
    redraw()
  }

  function move(event) {
    event.preventDefault()
    const x = event.offsetX || event.touches[0].pageX
    const y = event.offsetY || event.touches[0].pageY
    if (painting) {
      addPoint(x, y)
      redraw()
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
