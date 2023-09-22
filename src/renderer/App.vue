<script setup lang="ts">
import WaveSurferJS from './components/WaveSurferJS.vue'

window.tobiPlayer.sendMessage('Hello from tobiPlayer!');
</script>

<template>
  <WaveSurferJS audioFileNameAsTitle="... no file loaded." />
</template>

<style scoped>
</style>
