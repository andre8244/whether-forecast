import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import HourlyChart from './HourlyChart.vue'
import type { HourPoint } from '../../types/weather'

function hour(index: number, overrides: Partial<HourPoint> = {}): HourPoint {
  const at = new Date(Date.parse('2026-09-16T12:00:00Z') + index * 3_600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}T${pad(at.getUTCHours())}:00`

  return {
    time,
    timestamp: at.getTime(),
    temperature: 20 + index,
    apparentTemperature: 21 + index,
    precipitationProbability: index * 2,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 3,
    cloudCover: 50,
    humidity: 60,
    pressure: 1012,
    windSpeed: 8,
    windGusts: 18,
    windDirection: 200,
    uvIndex: 3,
    cape: 100,
    liftedIndex: 2,
    cin: 0,
    stormProbability: 0,
    stormPerModel: {},
    stormSpread: null,
    rainProbability: null,
    modelConsensus: null,
    ...overrides,
  }
}

const HOURS = Array.from({ length: 48 }, (_, i) => hour(i))

const PLOT_WIDTH = 480

/** The plot reports a real width so pointer maths has something to divide by. */
function mountChart(hours = HOURS) {
  const wrapper = mount(HourlyChart, { props: { hours }, attachTo: document.body })
  const plot = wrapper.find('.plot').element as HTMLElement
  plot.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: PLOT_WIDTH,
      height: 92,
      right: PLOT_WIDTH,
      bottom: 92,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  return wrapper
}

/**
 * jsdom makes `clientX` and `key` read-only, so Test Utils' `trigger` cannot
 * set them. Real events carry the properties through their constructor.
 */
function pointer(wrapper: ReturnType<typeof mountChart>, type: string, clientX = 0) {
  wrapper.find('.plot').element
    .dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }))
  return nextTick()
}

function press(wrapper: ReturnType<typeof mountChart>, key: string) {
  wrapper.find('.plot').element
    .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  return nextTick()
}

describe('HourlyChart', () => {
  it('labels the time axis from the first hour to the last', () => {
    const labels = mountChart().findAll('.axis span').map((s) => s.text())

    expect(labels.length).toBeGreaterThan(1)
    expect(labels.length).toBeLessThanOrEqual(5)
    expect(labels[0]).toBe('mer 12:00')
    expect(labels.at(-1)).toBe('ven 11:00')
  })

  it('thins the axis on a narrow plot', async () => {
    // jsdom has no ResizeObserver, so the component is driven through the same
    // path a real resize would take.
    const observers: ((width: number) => void)[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
          observers.push((width) => cb([{ contentRect: { width } }]))
        }
        observe() {}
        disconnect() {}
      },
    )

    const wrapper = mountChart()
    expect(wrapper.findAll('.axis span')).toHaveLength(5)

    observers.forEach((set) => set(360))
    await nextTick()
    expect(wrapper.findAll('.axis span')).toHaveLength(3)

    vi.unstubAllGlobals()
  })

  it('names the day whenever the axis crosses midnight', () => {
    const labels = mountChart().findAll('.axis span').map((s) => s.text())

    // The span runs 12:00 Wednesday to 11:00 Friday, so a bare "12:00" would
    // appear twice for different days.
    expect(labels[0]).toMatch(/^mer /)
    expect(labels.filter((l) => /^(mer|gio|ven) /.test(l)).length).toBeGreaterThan(1)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('shows no tooltip until the pointer enters the plot', () => {
    const wrapper = mountChart()
    expect(wrapper.find('.tooltip').exists()).toBe(false)
    expect(wrapper.find('.guide').exists()).toBe(false)
  })

  it('shows the values for the hour under the pointer', async () => {
    const wrapper = mountChart()
    // A quarter across 48 slots is hour 12.
    await pointer(wrapper, 'pointermove', 120)

    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('32°')
    expect(tooltip.text()).toContain('33°')
    expect(tooltip.text()).toContain('24%')
  })

  it('hides the tooltip when the pointer leaves', async () => {
    const wrapper = mountChart()
    await pointer(wrapper, 'pointermove', 120)
    expect(wrapper.find('.tooltip').exists()).toBe(true)

    await pointer(wrapper, 'pointerleave')
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('places the tooltip beside the guide, not over it', async () => {
    const wrapper = mountChart()

    await pointer(wrapper, 'pointermove', 0)
    const left = wrapper.find('.tooltip').attributes('style') ?? ''
    expect(left).toContain('translateX(12px)')
    expect(left).not.toContain('-100%')
  })

  it('flips the tooltip to the other side near the right edge', async () => {
    const wrapper = mountChart()

    await pointer(wrapper, 'pointermove', PLOT_WIDTH - 1)
    expect(wrapper.find('.tooltip').attributes('style'))
      .toContain('translateX(calc(-100% - 12px))')
  })

  it('walks the hours with the arrow keys', async () => {
    const wrapper = mountChart()
    await press(wrapper, 'ArrowRight')
    expect(wrapper.find('.tooltip').text()).toContain('20°')

    await press(wrapper, 'ArrowRight')
    expect(wrapper.find('.tooltip').text()).toContain('21°')

    await press(wrapper, 'ArrowLeft')
    expect(wrapper.find('.tooltip').text()).toContain('20°')
  })

  it('jumps to the ends with Home and End', async () => {
    const wrapper = mountChart()
    await press(wrapper, 'End')
    expect(wrapper.find('.tooltip').text()).toContain('11:00')

    await press(wrapper, 'Home')
    expect(wrapper.find('.tooltip').text()).toContain('12:00')
  })

  it('does not walk past either end', async () => {
    const wrapper = mountChart()
    await press(wrapper, 'ArrowLeft')
    await press(wrapper, 'ArrowLeft')
    expect(wrapper.find('.tooltip').text()).toContain('12:00')

    await press(wrapper, 'End')
    await press(wrapper, 'ArrowRight')
    expect(wrapper.find('.tooltip').text()).toContain('11:00')
  })

  it('describes the hovered hour to assistive technology', async () => {
    const wrapper = mountChart()

    expect(wrapper.find('.plot').attributes('aria-label')).toContain('frecce')

    await pointer(wrapper, 'pointermove', 120)
    expect(wrapper.find('.plot').attributes('aria-label')).toContain('percepita 33°')
  })

  it('omits the storm row below the lowest risk band', async () => {
    const quiet = mountChart()
    await pointer(quiet, 'pointermove', 120)
    expect(quiet.find('.tooltip').text()).not.toContain('Temporale')

    const stormy = mountChart(HOURS.map((h) => ({ ...h, stormProbability: 40 })))
    await pointer(stormy, 'pointermove', 120)
    expect(stormy.find('.tooltip').text()).toContain('Temporale')
  })
})
