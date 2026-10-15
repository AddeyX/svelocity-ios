<script lang="ts">
  import { VStack, Text, Button } from '@svelocity/swiftui';

  const title: string = 'Hello from Svelocity';
  let expanded = $state(false);
</script>

<VStack spacing={12} padding={24}>
  <Text>{title}</Text>
  <Button onclick={() => expanded = !expanded}>Toggle details</Button>
  {#if expanded}
    <Text>This view and its state execute as native Swift.</Text>
  {:else}
    <Text>Tap to see more.</Text>
  {/if}
</VStack>
