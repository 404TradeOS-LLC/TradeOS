// url=https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=175-17
// source=web/src/components/ui/textarea.tsx
// component=Textarea
//
// Figma "Text" represents the placeholder in this published design family.
// Focused is an interaction preview, not a permanent React component prop.
// Disabled and Error map to real native textarea/ARIA attributes.
import figma from 'figma'

const instance = figma.selectedInstance
const placeholder = instance.getString('Text')
const state = instance.getEnum('State', {
  Default: 'default',
  Focused: 'focused',
  Disabled: 'disabled',
  Error: 'error',
})

export default {
  example: figma.code`<Textarea placeholder="${placeholder}" ${state === 'disabled' ? 'disabled' : ''} ${state === 'error' ? 'aria-invalid="true"' : ''} />`,
  imports: ['import { Textarea } from "@/components/ui/textarea"'],
  id: 'tradeos-ui-textarea',
  metadata: { nestable: true },
}
