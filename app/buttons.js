const draw = document.getElementById('draw-button')
const move = document.getElementById('move-button')
const buttons = [draw, move]

function setActiveButton(event) {
  buttons.forEach(button => {
    button.classList.remove('selected')
  })
  event.target.classList.add('selected')
}

buttons.forEach(button => {
  button.addEventListener('click', setActiveButton)
})

draw.addEventListener('click', event => {
  document.getElementById('draw').classList.remove('pointer-events--none')
})

move.addEventListener('click', event => {
  document.getElementById('draw').classList.add('pointer-events--none')
})
