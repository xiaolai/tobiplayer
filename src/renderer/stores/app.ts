import { ref, computed, type Ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const isPlaying = ref(false);
  const playRegion = ref(true);
  const loopRegion = ref(true);
  const showTranscript = ref(true); 
  const activatedSurferName = ref('');
  const transcriptText = ref('');
  const popupMenuCloseTrigger = ref(0);
  function closePopupMenu() {
    popupMenuCloseTrigger.value += 1;
  }


  return {
    isPlaying,
    playRegion,
    loopRegion,
    activatedSurferName,
    transcriptText,
    popupMenuCloseTrigger,
    closePopupMenu,
  }
})

export default {
  methods: {
    handlePointerUp(event: any) {
      // Handle touchpad pointer up event
      console.log('Pointer up event:', event);
    },
    handlePointerDown(event: any) {
      // Handle touchpad pointer down event
      console.log('Pointer down event:', event);
    },
  },
};