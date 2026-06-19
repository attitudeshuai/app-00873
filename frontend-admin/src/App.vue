<template>
  <Popup />
</template>

<script setup lang="ts">
import Popup from './views/Popup.vue'
</script>

<style>
/* Extension popup specific styles */
body {
  width: 350px;
  margin: 0 auto;
}

:root {
  --el-color-primary: var(--color-primary);
}
</style>
