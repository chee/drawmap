export default function() {
  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 9,
    center: {lat: -25.363, lng: 131.044},
    disableDefaultUI: true
  })
  document.dispatchEvent(new CustomEvent('mapready', { detail: map }))
}
