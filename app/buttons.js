import {DRAW_TOOL, ERASE_TOOL} from './draw'

const draw = document.getElementById('draw-button')
const erase = document.getElementById('erase-button')
const move = document.getElementById('move-button')
const canvas = document.getElementById('draw')

const buttons = [draw, erase, move]

function setActiveButton(event) {
  buttons.forEach(button => {
    button.classList.remove('selected')
  })
  event.target.classList.add('selected')
}

function enableDraw(tool) {
  canvas.classList.remove('pointer-events--none')
  canvas.setAttribute('data-tool', tool)
}

function disableDraw() {
  canvas.classList.add('pointer-events--none')
}

buttons.forEach(button => {
  button.addEventListener('click', setActiveButton)
})

draw.addEventListener('click', () => enableDraw(DRAW_TOOL))
erase.addEventListener('click', () => enableDraw(ERASE_TOOL))

move.addEventListener('click', disableDraw)
