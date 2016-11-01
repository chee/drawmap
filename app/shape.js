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
