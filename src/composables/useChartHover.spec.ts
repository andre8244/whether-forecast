import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useChartHover } from './useChartHover'

const WIDTH = 480

function plotElement(): HTMLElement {
  const element = document.createElement('div')
  element.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: WIDTH,
      height: 90,
      right: WIDTH,
      bottom: 90,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  return element
}

function setup(count = 48) {
  return useChartHover(ref(count), ref(plotElement()))
}

function at(clientX: number): PointerEvent {
  return { clientX } as PointerEvent
}

describe('pointer selection', () => {
  it('starts with nothing selected', () => {
    expect(setup().isActive.value).toBe(false)
  })

  it('selects the slot under the pointer', () => {
    const hover = setup()
    hover.onPointer(at(WIDTH * 0.25))

    expect(hover.active.value).toBe(12)
    expect(hover.isActive.value).toBe(true)
  })

  it('clamps at both ends of the plot', () => {
    const hover = setup()
    hover.onPointer(at(-40))
    expect(hover.active.value).toBe(0)

    hover.onPointer(at(WIDTH + 40))
    expect(hover.active.value).toBe(47)
  })

  it('ignores a pointer event before the element is mounted', () => {
    const hover = useChartHover(ref(48), ref(null))
    hover.onPointer(at(100))

    expect(hover.isActive.value).toBe(false)
  })

  it('ignores a pointer event while the plot has no width', () => {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect
    const hover = useChartHover(ref(48), ref(element))
    hover.onPointer(at(100))

    expect(hover.isActive.value).toBe(false)
  })

  it('clears the selection', () => {
    const hover = setup()
    hover.onPointer(at(100))
    hover.clear()

    expect(hover.isActive.value).toBe(false)
  })
})

describe('keyboard selection', () => {
  it('selects the first slot on the first press, in either direction', () => {
    const forward = setup()
    forward.step(1)
    expect(forward.active.value).toBe(0)

    const backward = setup()
    backward.step(-1)
    expect(backward.active.value).toBe(0)
  })

  it('walks one slot at a time', () => {
    const hover = setup()
    hover.step(1)
    hover.step(1)
    hover.step(1)
    expect(hover.active.value).toBe(2)

    hover.step(-1)
    expect(hover.active.value).toBe(1)
  })

  it('does not walk past either end', () => {
    const hover = setup()
    hover.toStart()
    hover.step(-1)
    expect(hover.active.value).toBe(0)

    hover.toEnd()
    hover.step(1)
    expect(hover.active.value).toBe(47)
  })

  it('jumps to either end', () => {
    const hover = setup()
    hover.toEnd()
    expect(hover.active.value).toBe(47)

    hover.toStart()
    expect(hover.active.value).toBe(0)
  })

  it('does nothing on an empty series', () => {
    const hover = setup(0)
    hover.step(1)
    hover.toEnd()

    expect(hover.isActive.value).toBe(false)
  })
})

describe('positioning', () => {
  it('puts the guide at the centre of the active slot', () => {
    const hover = setup(4)
    hover.toStart()
    expect(hover.guideLeft.value).toBeCloseTo(12.5)

    hover.toEnd()
    expect(hover.guideLeft.value).toBeCloseTo(87.5)
  })

  it('places the tooltip to the right on the left half', () => {
    const hover = setup()
    hover.onPointer(at(WIDTH * 0.1))

    expect(hover.tooltipStyle.value.transform).toBe('translateX(12px)')
  })

  it('flips the tooltip on the right half', () => {
    const hover = setup()
    hover.onPointer(at(WIDTH * 0.9))

    expect(hover.tooltipStyle.value.transform).toBe('translateX(calc(-100% - 12px))')
  })

  it('reports a slot beyond a shrunken series as inactive', () => {
    const count = ref(48)
    const hover = useChartHover(count, ref(plotElement()))
    hover.toEnd()
    expect(hover.isActive.value).toBe(true)

    count.value = 10
    expect(hover.isActive.value).toBe(false)
  })
})
