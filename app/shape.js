import Polygon from 'polygon'
import simplifyjs from 'simplify-js'
import { MSQR } from 'msqr'

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

export function expand(points) {
  const polygon = new Polygon(points)
  const center = polygon.center()
  const area = polygon.area()
  const aabb = polygon.aabb()
  return polygon.scale(1.2, center, true).points
}

export function simplify(points, canvas) {
  const simplePoints = simplifyjs(points, 4, true)
  const polygons = new Polygon(simplePoints).pruneSelfIntersections()
  const hull = expand(convexHull(simplePoints))
  const polygon = new Polygon(simplePoints)
  if (polygons.length > 1) {
    return hull
  } else {
    const p = MSQR(canvas, {
      tolerance: 1.1
    })
    console.log(p)
    return p[0]
  }
}
