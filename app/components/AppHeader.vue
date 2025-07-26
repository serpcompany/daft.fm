<template>
  <UHeader 
      title="Daft.fm" 
      to="/"
    >
      <template #left>
        <UNavigationMenu 
          :items="[
            { label: 'Artists', to: '/artists' },
            { label: 'Albums', to: '/albums' },
            { label: 'Songs', to: '/songs' }
          ]"
          variant="link"
        />
      </template>
    </UHeader>
</template>