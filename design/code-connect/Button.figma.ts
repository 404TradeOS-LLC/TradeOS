// url=https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=10-57
// source=web/src/components/ui/button.tsx
// component=Button
//
// Parserless Code Connect template for the published TradeOS Button family.
// Maps Figma's MD to the production default size, not to a nonexistent "md".
import figma from 'figma'

const instance = figma.selectedInstance
const label = instance.getString('Label')
const variant = instance.getEnum('Variant', {
  Default: 'default',
  Outline: 'outline',
  Secondary: 'secondary',
  Ghost: 'ghost',
  Destructive: 'destructive',
  Link: 'link',
})
const size = instance.getEnum('Size', {
  XS: 'xs',
  SM: 'sm',
  MD: 'default',
  LG: 'lg',
})

export default {
  example: figma.code`<Button variant="${variant}" size="${size}">${label}</Button>`,
  imports: ['import { Button } from "@/components/ui/button"'],
  id: 'tradeos-ui-button',
  metadata: { nestable: true },
}
