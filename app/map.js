export default function() {
  const map = new window.google.maps.Map(document.getElementById('map'), {
    zoom: 10,
    center: {lat: 54.4635, lng: -6.33464},
    disableDefaultUI: true
  })
  document.dispatchEvent(new CustomEvent('mapready', { detail: map }))
}
