import hexToRgba from 'hex-rgba'

import {
  simplify,
  within as polygonWithin,
  reduce as reducePolygons,
  equal
} from './shape'

import {
  point as turfPoint,
  polygon as turfPolygon,
  featureCollection,
  intersect,
  union,
  difference,
  within
} from '@turf/turf'

export const DRAW_TOOL = 'draw'
export const ERASE_TOOL = 'erase'

const canvas = document.getElementById('draw')
const container = document.getElementById('map-container')
const context = canvas.getContext('2d')
let points = []
let features = []

const tools = {}

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

  // make it meet back up at the start
  coordinates.push(coordinates[0])
  if (coordinates.length < 4) return null
  try {
    return turfPolygon([coordinates])
  } catch(error) {
    return null
  }
}

function clear(map) {
  map.data.forEach(feature => {
    map.data.remove(feature)
  })
}

const identity = thing => thing
const selectFeature = featureObject => featureObject.feature

function plot(map) {
  try {
    map.data.addGeoJson(featureCollection(features.map(selectFeature)))
  } catch(error) {
    debugger
    console.error('fuck: ', error)
  }
}

function redrawMap(map) {
  clear(map)
  features = features.filter(selectFeature)

  // erase features that are inside another feature
  features = features.filter(selectFeature).filter(({feature}) => {
    const { geometry: { coordinates: [ points ] } } = feature
    let contained = false
    features.map(selectFeature).forEach(feature => {
      if (!feature) return
      contained = contained || polygonWithin(points, feature.geometry.coordinates[0]) ? true : false
      feature.geometry.coordinates.slice(1).forEach((gapPoints, index) => {
        if (polygonWithin(points, gapPoints)) {
          contained = false
        }
      })
    })

    return !contained
  })

  plot(map)
  document.dispatchEvent(new CustomEvent('search', { detail: map }))
}

function reduceFeatures(features) {
  return features.reduce((a, b) => union(a, b))
}

function featureToPolygons(feature, map) {
  return feature.geometry.coordinates.map(coordinates => (
    coordinates.map(coordinate => coordinateToPixel(coordinate, map))
  ))
}

function getUnions(drawnFeature) {
  const unions = {
    indexes: [],
    features: []
  }
  features.forEach((featureObject, index) => {
    const feature = featureObject.feature
    if (intersect(feature, drawnFeature)) {
      unions.indexes.push(index)
      unions.features.push(union(feature, drawnFeature))
    }
  })
  return unions
}

function makeUnionFeatureObject({unions, map}) {
  if (!(unions.indexes && unions.indexes.length)) return null
  const unionFeature = makeFeature({
    polygon: reducePolygons(featureToPolygons(reduceFeatures(unions.features), map)),
    map
  })
  const unionFeatureObject = {
    feature: unionFeature,
    subfeatures: [],
    gaps: []
  }
  unions.indexes.forEach(index => {
    const featureObject = features[index]
    delete features[index]
    unionFeatureObject.subfeatures = unionFeatureObject.subfeatures.concat(featureObject.subfeatures)
    unionFeatureObject.gaps = unionFeatureObject.gaps.concat(featureObject.gaps)
  })

  unionFeatureObject.gaps.forEach(gap => {
    unionFeatureObject.feature = difference(unionFeatureObject.feature, gap)
  })

  return unionFeatureObject
}


tools[DRAW_TOOL] = {
  color: '#ff2a50',
  width: 20,
  up({polygon, map}) {
    const drawnFeature = makeFeature({
      map, polygon
    })
    if (!drawnFeature) return
    features = features.filter(selectFeature)
    const unions = getUnions(drawnFeature)
    const unionFeatureObject = makeUnionFeatureObject({unions, map})
    if (unionFeatureObject) {
      features.push(unionFeatureObject)
    } else {
      features.push({
        feature: drawnFeature,
        subfeatures: [],
        gaps: []
      })
    }
    redrawMap(map)
  },
  point({point, map}) {
    window.google.maps.event.trigger(map, 'click', {
      stop: null,
      latLng: pixelToCoordinate(point, map)
    })
  }
}

function erase(gap) {
  if (!gap) return
  features.forEach((featureObject, index) => {
    const {feature} = featureObject
    gap = intersect(gap, feature)
    if (gap) {
      featureObject.gaps.push(gap)
      featureObject.feature = difference(feature, gap)
    }
  })
}

tools[ERASE_TOOL] = {
  color: '#3399ff',
  width: 30,
  up({polygon, map}) {
    const gap = makeFeature({
      polygon, map
    })
    if (!gap) return
    erase(gap)
    redrawMap(map)
  },
  point({point, map}) {
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
