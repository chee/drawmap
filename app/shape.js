import Polygon from 'polygon'
import simplify from 'simplify-js'
import Delaunay from 'delaunay'

export function sortPoints(points) {
  return points.sort((a, b) => (
    a.x == b.x ? a.y - b.y : a.x - b.x
  ))
}

export function convexHull(points) {
  function removeInner(a, b, c) {
    const crossProduct = (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x)
    const dotProduct = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)
    return crossProduct < 0 || (crossProduct == 0 && dotProduct <= 0)
  }

  points = sortPoints(points)

  const length = points.length
  const hull = []

  for (let i = 0; i < 2 * length; i++) {
    const j = i < length ? i : 2 * length - 1 - i
    while (hull.length >= 2 && removeInner(hull[hull.length - 2], hull[hull.length - 1], points[j])) {
      hull.pop()
    }
    hull.push(points[j])
  }

  hull.pop()

  return hull
}

const max = array => array.reduce((a, b) => Math.max(a, b))
const min = array => array.reduce((a, b) => Math.min(a, b))

export function biggest(polygons) {
  return polygons.sort((a, b) => {
    const currentX = current.points.map(({x}) => x)
    const maxCurrentX = max(currentX)
    const minCurrentX = min(currentX)
    const currentXDiff = Math.max(maxCurrentX, minCurrentX) - Math.min(maxCurrentX, minCurrentX)
    const previousX = previous.map(({x}) => x)
    const maxPreviousX = max(previousX)
    const minPreviousX = min(previousX)
    const previousXDiff = Math.max(maxPrevioousX, minPrevioousX) - Math.min(maxPrevioousX, minPrevioousX)

    const currentY = current.points.map(({y}) => y)
    const maxCurrentY = max(currentY)
    const minCurrentY = min(currentY)
    const currentYDiff = Math.max(maxCurrentY, minCurrentY) - Math.min(maxCurrentY, minCurrentY)
    const previousY = previous.map(({y}) => y)
    const maxPreviousY = max(previousY)
    const minPreviousY = min(previousY)
    const previousYDiff = Math.max(maxPreviousY, minPreviousY) - Math.min(maxPreviousY, minPreviousY)

    if (currentXDiff > previousXDiff && currentYDiff > previousYDiff) {
      return 1
    } else if (currentXDiff > previousXdiff || currentYDiff > previousYDiff) {
      return 0
    }
    return -1
  })[0]
}


function pointsToPolygon(points, triangles, maxEdgeLength) {
  const dist = function(a, b) {
    return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])
  }

  const dist2 = function(a, b) {
    a = points[a]
    b = points[b]
    return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])
  }

  if (!points.length) {
    return null
  }

  const pointFreq = []

  points.forEach(() => pointFreq.push(0))

  maxEdgeLength *= maxEdgeLength
  let i = triangles.length

  while (i -= 3) {
    if (dist2(triangles[i-1], triangles[i-2]) < maxEdgeLength
    && dist2(triangles[i-3], triangles[i-2]) < maxEdgeLength
    && dist2(triangles[i-1], triangles[i-3]) < maxEdgeLength) {
      pointFreq[triangles[i-1]]++
      pointFreq[triangles[i-2]]++
      pointFreq[triangles[i-3]]++
    }
  }

  let output = []
  var len = pointFreq.length

  for (let i = 0; i < len; i++) {
    if (pointFreq[i] < 4) {
      output.push(points[i])
    }
  }

  // Sort points by looping around by each next closest point
  function sort(a,b) {
    const length = sorted.length - 1
    const distA = dist(sorted[length], a)
    const distB =dist(sorted[length], b)
    if (distA < distB){
      return 1
    } else if (distA == distB) {
      return 0
    }
    return -1
  }

  const sorted = []

  while (output.length) {
    sorted.push(output.pop())
    output = output.sort(sort)
  }

  return sorted
}


export function removeInner(points) {
  points = simplify(points, 2, true)
  const triangles = Delaunay.triangulate(points.map(({x, y}) => [x, y]))
  const minX = min(points.map(({x}) => x))
  const maxX = max(points.map(({x}) => x))
  const edge = maxX - minX
  return pointsToPolygon(points, triangles, edge)
}


export function isScribble(points) {
  const polygon = new Polygon(points)
  let hull = convexHull(points)
  const outerPoints = hull.length
  const innerPoints = simplify(points, 1).reduce((previous, current) => (
    previous + (polygon.containsPoint(current) ? 1 : 0)
  ), 0) - outerPoints
  console.log(`outer: ${outerPoints}\tinner: ${innerPoints}`)
  return outerPoints < innerPoints
}
