<template>
  <UFooter>
      <template #left>
        <p>&copy; {{ new Date().getFullYear() }} Daft.fm</p>
      </template>
      
      <UNavigationMenu 
        :items="[
          { label: 'About', to: '#' },
          { label: 'Contact', to: '#' }
        ]"
        variant="link"
      />
    </UFooter>
</template>