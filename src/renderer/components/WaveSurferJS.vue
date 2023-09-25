<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, defineProps, onMounted, ref, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js'
import Pitchfinder from 'pitchfinder'
import { useAppStore } from '../stores'

const appStore = useAppStore()
const {
  isPlaying, loopRegion, playRegion,
  activatedSurferName, transcriptText 
} = storeToRefs(appStore)

let ws:any = null
let activeRegion:any = null;
const wsPeaks = ref(null)
const filled = ref(false)
let wsmmps = ref(10)
let isMuted = ref(false)
let normalSpeed = ref(true)

const props = defineProps({
  name: {
    type: String,
    default: 'main',
  },
  useRecord: {
    type: Boolean,
    default: false,
  }
})

const isActivated = computed(() => {
  return props.name === activatedSurferName.value
})

watch(() => isPlaying.value, (v) => {
  if (ws) {
    if (v) {
      if (isActivated.value) {
        ws.play()
      }
    } else {
      ws.pause()
    }
  }
  console.log("isPlaying: ", isPlaying.value)
})

watch(() => wsPeaks.value, (v) => {
  updatePeaks()
})

function togglePlayPause(){
  isPlaying.value = !isPlaying.value
}

function toggleLoop(){
  loopRegion.value = !loopRegion.value
}

function createWs(audio: any, url: string) {
  const opts:any = {
    container: "#waveform",
    waveColor: 'rgba(200, 200, 200, 0.5)',
    progressColor: 'rgba(100, 100, 100, 0.5)',
    minPxPerSec: wsmmps.value,
    hideScrollbar: true,
    autoCenter: false,
    height: 160,
  };

  clear();

  if (audio) {
    opts.media = audio
  } else {
    opts.url = url
  }  

  const _ws = WaveSurfer.create(opts)
  // Initialize the Regions plugin
  const wsRegions = _ws.registerPlugin(RegionsPlugin.create())
  const random = (min:number, max:number) => Math.random() * (max - min) + min
  const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.03)`
  wsRegions.enableDragSelection({
    color: 'randomColor',
  })

  _ws.once('decode', () => {
    wsPeaks.value = ws.getDecodedData().getChannelData(0)
    console.log('decoded!')
  })
  
  _ws.on('audioprocess', () => {
    // console.log(_ws.getCurrentTime())
    const currentTime = _ws.getCurrentTime();
    const wordElements = document.getElementsByTagName('word');

    // Iterate through the word elements
    for (const wordElement of wordElements) {
      const start = parseFloat(wordElement.getAttribute('start'));
      const end = parseFloat(wordElement.getAttribute('end'));

      // Check if the current time falls within the start and end time of the word
      if (currentTime >= start && currentTime <= end) {
        // Add a CSS class to highlight the currently playing word
        const theContent = wordElement.textContent;
        // check if there's leading space
        if (theContent[0] === ' ') {
          wordElement.innerHTML = ` <u>${wordElement.textContent}</u>`;
        } else {
          wordElement.innerHTML = `<u>${wordElement.textContent}</u>`;
        }
      } else {
        // Remove the CSS class if the word is not currently playing
        wordElement.innerHTML = wordElement.textContent;
        wordElement.classList.remove('highlight');
      }
    }    
  })

  _ws.on('decode', () => {
    // Regions
    wsRegions.addRegion({
      start: 0.2,
      end: 6,
      color: randomColor(),
      drag: true,
      resize: true,
    })
  })

  wsRegions.on('region-in', (region:any) => {
    activeRegion = region
  })

  wsRegions.on('region-out', (region:any) => {
    if (activeRegion === region) {
      if (playRegion.value) {
        if (loopRegion.value) {
          region.play()
        } else {
          activeRegion = null
          _ws.pause()
          _ws.seekTo(region.end / _ws.getDuration())
        }
      }
    }
  })

  wsRegions.on('region-clicked', (region:any, e:any) => {
    e.stopPropagation() // prevent triggering a click on the waveform
    activeRegion = region
    togglePlayPause()
    _ws.playPause()
  })

  wsRegions.on('region-updated', (region:any, e:any) => {
    console.log('region changed')
    region === activeRegion
    const waveformContainer = document.querySelector('#waveform');        
    const waveformWidth = (waveformContainer as HTMLElement).offsetWidth;
    const regionDuration = region.end - region.start;
    wsmmps.value = waveformWidth / regionDuration;     
    _ws.zoom(wsmmps.value);
    _ws.seekTo(region.start / _ws.getDuration());
  })

  return _ws;
};

function updatePeaks() {
  const sampleRate = ws.options.sampleRate
  const peaks:any = wsPeaks.value
  const algo = 'AMDF'
  const detectPitch = Pitchfinder[algo]({ sampleRate })
  const duration = peaks.length / sampleRate
  const bpm = peaks.length / duration / 60

  const frequencies = Pitchfinder.frequencies(detectPitch, peaks, {
    tempo: bpm,
    quantization: bpm,
  })

  // Find the baseline frequency (the value that appears most often)
  const frequencyMap:any = {}
  let maxAmount = 0
  let baseFrequency = 0
  frequencies.forEach((frequency) => {
    if (!frequency) return
    const tolerance = 10
    frequency = Math.round(frequency * tolerance) / tolerance
    if (!frequencyMap[frequency]) frequencyMap[frequency] = 0
    frequencyMap[frequency] += 1
    if (frequencyMap[frequency] > maxAmount) {
      maxAmount = frequencyMap[frequency]
      baseFrequency = frequency
    }
  })

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
  const dotSiceRatio = 0.75
  const pointSize = devicePixelRatio * dotSiceRatio
  let prevY = 0
  frequencies.forEach((frequency:any, index:any) => {
    if (!frequency) return
    const hratio = 0.7 // the bigger the narrower the pitch contour drawn on canvas.
    const marginTop = 30 // the bigger the lower the pitch contour positioned.
    const y = Math.round(height - (frequency / (baseFrequency * 2)) * height) * hratio + marginTop    
    if (ctx) {
      ctx.fillStyle = y > prevY ? pitchDownColor : pitchUpColor
      ctx.fillRect(index, y, pointSize, pointSize)
    }
    prevY = y
  })

  // Add the canvas to the waveform container
  ws.renderer.getWrapper().appendChild(canvas)
  // Remove the canvas when a new audio is loaded
  ws.once('load', () => canvas.remove())
}


async function loadFile() {
  const tobiPlayer = (window as any).tobiPlayer;
  const filePath = await tobiPlayer.openDialog();
  if (filePath) {
    const fileName = filePath.split('/').pop();
    tobiPlayer.setAppTitle(fileName);
    console.log(fileName);
    const audioUrl = await tobiPlayer.loadAudioFile(filePath);
    const audio = new Audio(audioUrl);
    ws = createWs(audio, "");

    filled.value = true;
    activatedSurferName.value = props.name;
    tobiPlayer.createTranscript(filePath).then((ts:any) => {
      transcriptText.value = ts
    });
  };
}

function clear() {
  if (ws) {
    ws.destroy();
  }
  ws = null;
  isPlaying.value = false;
  filled.value = false;
}

function zoomIn(){
  if (ws) {
    wsmmps.value = ws.options.minPxPerSec * 1.2
    if (wsmmps.value > 300) {
      wsmmps.value = 300;
    }
    ws.seekTo(ws.getActivePlugins()[0].getRegions()[0].start / ws.getDuration());
    ws.zoom(wsmmps.value);
    console.log(ws.options.minPxPerSec);
  }
}

function zoomOut(){
  if (ws) {
    wsmmps.value = ws.options.minPxPerSec * 0.8   
    if (wsmmps.value < 10) {
      wsmmps.value = 10;
    }
    ws.seekTo(ws.getActivePlugins()[0].getRegions()[0].start / ws.getDuration());
    ws.zoom(wsmmps.value);
    console.log(ws.options.minPxPerSec);
  }
}

function zoomToTxtents(){
  if (ws) {
    ws.zoom(10)
  }
}

function volumeUp(){
  if (ws) {
    let currentVolume = ws.getVolume()
    if (currentVolume < 0.9) {
      ws.setVolume(currentVolume + 0.1)
    } else {
      ws.setVolume(1)
    }
  }
}

function volumeDown(){
  if (ws) {
    let currentVolume = ws.getVolume()
    if (currentVolume > 0.1) {
      ws.setVolume(currentVolume - 0.1)
    } else {
      ws.setVolume(0)
    }
  }
}

function toggleMuted(){
  if (ws) {
    if (ws.getMuted()) {
      ws.setMuted(false)
      isMuted.value = false
    } else {
      ws.setMuted(true)
      isMuted.value = true
    }
  }
}

function toggleSpeed(){
  if (ws) {
    if (ws.getPlaybackRate() === 1) {
      ws.setPlaybackRate(0.8)
      normalSpeed.value = false
    } else {
      ws.setPlaybackRate(1)
      normalSpeed.value = true
    }
  }
}

const clickableText = ref<HTMLElement | null>(null);

// Handle the span click event
const handleClick = (event: MouseEvent) => {
  if (event.target instanceof HTMLElement){
    if (event.target.tagName === "WORD") {
      const word_start = (event.target as HTMLElement).getAttribute('start');
      const word_end = (event.target as HTMLElement).getAttribute('end');
      const segment_start = (event.target.closest('segment') as HTMLElement).getAttribute('start');
      const segment_end = (event.target.closest('segment') as HTMLElement).getAttribute('end');
      // const segment_content = (event.target.closest('segment') as HTMLElement).innerText;
      if (ws) {
        ws.setTime(word_start);
        if (word_start != null) {
          ws.seekTo(Number(word_start) / ws.getDuration());
        }
        // update the activeRegion's start and end
        const waveformContainer = document.querySelector('#waveform');        
        const waveformWidth = (waveformContainer as HTMLElement).offsetWidth;

        const regionOffset = 0.2 // extend the region by 0.2 seconds forward and backward
        const region_start = Number(segment_start) - regionOffset < 0 ? 0 : Number(segment_start) - regionOffset;
        const region_end = Number(segment_end) + regionOffset > ws.getDuration() ? ws.getDuration() : Number(segment_end) + regionOffset;        
        
        const regionDuration = region_end - region_start;
        wsmmps.value = waveformWidth / regionDuration;
        ws.zoom(wsmmps.value)
             
        ws.getActivePlugins()[0].clearRegions()
        const random = (min:number, max:number) => Math.random() * (max - min) + min        
        ws.getActivePlugins()[0].addRegion({
          start: region_start,
          end: region_end,
          color: String(`rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.03)`),
          drag: true,
          resize: true,
          // content: segment_content
        })
        ws.play();
        isPlaying.value = true;
      }
    }
  }
};


onMounted(() => {
  clickableText.value?.addEventListener('click', handleClick); 
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      togglePlayPause()
    }
  })
});
</script>


<template>
  <div id="content">
    <div id="waveform"></div>
    <div id="player-controls">
      <img class='imageButton' id="open-audio-file" src="/icons/eject.png" alt="open" @click="loadFile">
      <img v-if="normalSpeed" id= "toggle-speed" class='imageButton' src="/icons/turtle.png" alt="zoom to extents" @click="toggleSpeed"> 
      <img v-else class='imageButton' id="toggle-speed" src="/icons/turtle-black.png" alt="zoom to extents" @click="toggleSpeed"> 
      <img v-if="isPlaying" class="imageButton" id="play-pause" src="/icons/pause.png" alt="pause" @click="togglePlayPause">
      <img v-else class="imageButton" id="play-pause" src="/icons/play.png" alt="play" @click="togglePlayPause">
      <img v-if="loopRegion" class="imageButton" src="/icons/repeat-one.png" alt="loop" @click="toggleLoop">
      <img v-else class="imageButton" src="/icons/repeat.png" alt="play" @click="toggleLoop">
      <img class='imageButton' id="volume-down" src="/icons/volume-down.png" alt="zoom to extents" @click="volumeDown">       
      <img class='imageButton' id="volume-up" src="/icons/volume-up.png" alt="zoom to extents" @click="volumeUp"> 
      <img v-if="isMuted" class='imageButton' id="mute" src="/icons/not-muted.png" alt="zoom to extents" @click="toggleMuted"> 
      <img v-else class='imageButton' id="mute" src="/icons/mute.png" alt="zoom to extents" @click="toggleMuted"> 
      <img class='imageButton' id="zoom-in" src="/icons/zoom-in.png" alt="zoom in" @click="zoomIn" > 
      <img class='imageButton' id="zoom-out" src="/icons/zoom-out.png" alt="zoom out" @click="zoomOut" > 
      <img class='imageButton' id="zoom-to-extents" src="/icons/zoom-to-extents.png" alt="zoom to extents" @click="zoomToTxtents"> 
    </div>
    <div id="transcript" ref="clickableText" @click="handleClick">
      <article id="interactive-transcript" v-html="transcriptText"></article>
    </div>
  </div>
</template>

<style scoped>
#waveform {
  width: 763px;
  height: 160px;
  margin-bottom: 20px;
  /* border-radius: 5px;
  box-shadow: 0 0 10px #00000033;
  border: 1px solid #00000033; */
}
#interactive-transcript {
  width: 725px;
  height: 390px;
  padding: 10px 20px;
  margin-bottom: 20px;
  font-size: medium;
  border-radius: 5px;
  box-shadow: 0 0 2px #00000033;
  border: 1px solid #00000033; 
}
#transcript{
  width: 720px;
  height: 365px;
  margin-top: 10px;
  border: none;
  resize: none;
  text-align: justify;
  font-size: larger; 
}

#player-controls {
  width: 100%;
  height: 50px;  
  align-items: center;
  margin-bottom: 20px;
}

.imageButton {
  height: 25px;
  width: 25px;
  margin-top: 10px;
  margin-right: 10px;  
  align-items: center;
  justify-content: center;
}
</style>
