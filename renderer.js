import WaveSurfer from './node_modules/wavesurfer.js/dist/wavesurfer.esm.js'
import RegionsPlugin from './node_modules/wavesurfer.js/dist/plugins/regions.esm.js'

const pitchWorker = new Worker('./pitch-worker.js', { type: 'module' })

const { tobiPlayer } = window;

const openButton = document.getElementById('openButton');
const playButton = document.getElementById('playButton');

const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgba(200, 200, 200, 0.5)',
  progressColor: 'rgba(100, 100, 100, 0.5)',
  minPxPerSec: 100,
  hideScrollbar: true,
  autoCenter: false,
  loopSelection: true,
  loop: true,
})

ws.on('interaction', () => {
  ws.playPause()
})

// Update the zoom level on slider change
ws.once('decode', () => {
  const slider = document.querySelector('input[type="range"]')

  slider.addEventListener('input', (e) => {
    const minPxPerSec = e.target.valueAsNumber
    ws.zoom(minPxPerSec)
  })
})

openButton.addEventListener('click', async () => {
  const filePath = await tobiPlayer.openDialog();
  if (filePath) {
    playButton.disabled = false;
    const fileName = filePath.split('/').pop();
    tobiPlayer.setAppTitle(fileName);
  };
  ws.load(filePath);
});

playButton.addEventListener('click', () => {
  ws.playPause()
});

// Pitch detection
ws.on('decode', () => {
  const peaks = ws.getDecodedData().getChannelData(0)
  pitchWorker.postMessage({ peaks, sampleRate: ws.options.sampleRate })
})

// When the worker sends back pitch data, update the UI
pitchWorker.onmessage = (e) => {
  const { frequencies, baseFrequency } = e.data

  // Render the frequencies on a canvas
  const pitchUpColor = '#385587'
  const pitchDownColor = '#C26351'
  const height = 100

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = frequencies.length
  canvas.height = height
  canvas.style.width = '100%'
  canvas.style.height = '100%'

  // Each frequency is a point whose Y position is the frequency and X position is the time
  const pointSize = devicePixelRatio
  let prevY = 0
  frequencies.forEach((frequency, index) => {
    if (!frequency) return
    const y = Math.round(height - (frequency / (baseFrequency * 2)) * height) * 0.7 + 30
    // 20, the bigger the lower the pitch contour positioned.
    // 0.8, the bigger the narrower the pitch contour drawn on canvas.
    
    ctx.fillStyle = y > prevY ? pitchDownColor : pitchUpColor
    ctx.fillRect(index, y, pointSize, pointSize)
    prevY = y
  })

  // Add the canvas to the waveform container
  ws.renderer.getWrapper().appendChild(canvas)
  // Remove the canvas when a new audio is loaded
  ws.once('load', () => canvas.remove())
}

// Regions

// Initialize the Regions plugin
const wsRegions = ws.registerPlugin(RegionsPlugin.create())

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.05)`

// Create 1 default regions that can be dragged and resized, with a specific time ranges
ws.on('decode', () => {
  // Regions
  wsRegions.addRegion({
    start: 0.2,
    end: 5,
    color: randomColor(),
    drag: true,
    resize: true,
  })
})

wsRegions.enableDragSelection({
  color: 'rgba(255, 0, 0, 0.1)',
})

// Loop a region on click
let loop = true
// Toggle looping with a checkbox
document.querySelector('input[type="checkbox"]').onclick = (e) => {
  loop = e.target.checked
}

{
  let activeRegion = null
  wsRegions.on('region-in', (region) => {
    activeRegion = region
  })
  wsRegions.on('region-out', (region) => {
    if (activeRegion === region) {
      if (loop) {
        region.play()
      } else {
        activeRegion = null
        ws.pause()
      }
    }
  })
  wsRegions.on('region-clicked', (region, e) => {
    e.stopPropagation() // prevent triggering a click on the waveform
    activeRegion = region
    ws.playPause()
    region.setOptions({ color: randomColor() })
  })
  // Reset the active region when the user clicks anywhere in the waveform
  ws.on('interaction', () => {
    activeRegion = null
  })
}
