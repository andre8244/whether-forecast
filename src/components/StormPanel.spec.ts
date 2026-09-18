import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import StormPanel from './StormPanel.vue'
import type { HourPoint } from '../types/weather'

const PLOT_WIDTH = 480

/** Gives the bar plot a real width so pointer maths has something to divide by. */
function withPlot(wrapper: ReturnType<typeof mount>) {
  const plot = wrapper.find('.plot')
  if (plot.exists()) {
    ;(plot.element as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: PLOT_WIDTH,
        height: 48,
        right: PLOT_WIDTH,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
  }
  return wrapper
}

/** jsdom makes clientX read-only, so Test Utils' trigger cannot set it. */
function pointer(wrapper: ReturnType<typeof mount>, type: string, clientX = 0) {
  wrapper.find('.plot').element.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }))
  return nextTick()
}

function hour(overrides: Partial<HourPoint> = {}): HourPoint {
  return {
    time: '2026-09-16T12:00',
    timestamp: new Date('2026-09-16T12:00:00').getTime(),
    temperature: 24,
    apparentTemperature: 25,
    precipitationProbability: 20,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 3,
    cloudCover: 50,
    humidity: 60,
    pressure: 1012,
    windSpeed: 8,
    windGusts: 18,
    windDirection: 200,
    uvIndex: 4,
    cape: 1200,
    liftedIndex: -1,
    cin: -20,
    stormProbability: 0,
    stormPerModel: {},
    stormSpread: null,
    rainProbability: null,
    modelConsensus: null,
    ...overrides,
  }
}

describe('StormPanel', () => {
  it('shows the peak probability as the headline', () => {
    const wrapper = mount(StormPanel, {
      props: {
        hours: [
          hour({ stormProbability: 10 }),
          hour({ time: '2026-09-16T13:00', stormProbability: 45 }),
          hour({ time: '2026-09-16T14:00', stormProbability: 20 }),
        ],
        degraded: false,
      },
    })

    expect(wrapper.find('.value').text()).toBe('45%')
    expect(wrapper.text()).toContain('Temporali probabili')
  })

  it('says what the peak is and on which day', () => {
    const wrapper = mount(StormPanel, {
      props: {
        hours: [
          hour({ stormProbability: 10 }),
          hour({ time: '2026-09-18T15:00', stormProbability: 45 }),
        ],
        degraded: false,
      },
    })

    const line = wrapper.find('.picco').text().replace(/\s+/g, ' ')
    // A bare "Massimo 15:00" says neither which quantity nor which day.
    expect(line).toContain('Probabilità massima')
    expect(line).toMatch(/oggi|domani|luned|marted|mercoled|gioved|venerd|sabato|domenica/)
    expect(line).toContain('15:00')
  })

  it('states plainly when no thunderstorm is expected', () => {
    const wrapper = mount(StormPanel, {
      props: { hours: [hour({ stormProbability: 0 })], degraded: false },
    })
    expect(wrapper.text()).toContain('Nessun temporale previsto')
  })

  it('hides the probability and explains why when the ensemble failed', () => {
    const wrapper = mount(StormPanel, {
      props: { hours: [hour({ stormProbability: null })], degraded: true },
    })

    expect(wrapper.text()).toContain('Dati ensemble non disponibili')
    expect(wrapper.find('.toggle').exists()).toBe(false)
  })

  it('warns when the models disagree', () => {
    const wrapper = mount(StormPanel, {
      props: {
        hours: [hour({ stormProbability: 30, stormSpread: 55 })],
        degraded: false,
      },
    })
    expect(wrapper.text()).toContain('I modelli non concordano')
  })

  it('stays quiet when the spread is within tolerance', () => {
    const wrapper = mount(StormPanel, {
      props: {
        hours: [hour({ stormProbability: 30, stormSpread: 10 })],
        degraded: false,
      },
    })
    expect(wrapper.text()).not.toContain('non concordano')
  })

  it('reveals the per-model split and the convective indices on expand', async () => {
    const wrapper = mount(StormPanel, {
      props: {
        hours: [
          hour({
            stormProbability: 40,
            stormPerModel: {
              ecmwf_ifs025_ensemble: 55,
              icon_global_eps: 30,
              ncep_gefs025: 25,
            },
          }),
        ],
        degraded: false,
      },
    })

    expect(wrapper.find('.details').exists()).toBe(false)

    await wrapper.find('.toggle').trigger('click')

    const details = wrapper.find('.details')
    expect(details.exists()).toBe(true)
    expect(details.text()).toContain('ECMWF')
    expect(details.text()).toContain('GFS')
    expect(details.text()).toContain('1200 J/kg')
    // CAPE 1200 sits in the moderate band; the lifted index has its own.
    expect(details.text()).toContain('moderata')
    expect(details.text()).toContain('poco instabile')
  })
})


describe('StormPanel hourly readout', () => {
  const SERIES = Array.from({ length: 48 }, (_, i) =>
    hour({
      time: `2026-09-16T${String(i % 24).padStart(2, '0')}:00`,
      stormProbability: i,
      stormPerModel: {
        ecmwf_ifs025_ensemble: i + 2,
        icon_global_eps: i,
        ncep_gefs025: Math.max(0, i - 2),
      },
    }),
  )

  function mountPanel() {
    return withPlot(mount(StormPanel, { props: { hours: SERIES, degraded: false } }))
  }

  it('shows no readout until the pointer enters the bars', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.tooltip').exists()).toBe(false)
    expect(wrapper.find('.guide').exists()).toBe(false)
  })

  it('reads out the hour under the pointer', async () => {
    const wrapper = mountPanel()
    await pointer(wrapper, 'pointermove', PLOT_WIDTH * 0.25)

    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
    // A quarter across 48 slots is hour 12.
    expect(tooltip.text()).toContain('12%')
    expect(tooltip.text()).toContain('12:00')
  })

  it('breaks the hovered hour down by model', async () => {
    const wrapper = mountPanel()
    await pointer(wrapper, 'pointermove', PLOT_WIDTH * 0.25)

    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.text()).toContain('ECMWF')
    expect(tooltip.text()).toContain('14%')
    expect(tooltip.text()).toContain('GFS')
    expect(tooltip.text()).toContain('10%')
  })

  it('hides the readout when the pointer leaves', async () => {
    const wrapper = mountPanel()
    await pointer(wrapper, 'pointermove', PLOT_WIDTH * 0.25)
    await pointer(wrapper, 'pointerleave')

    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('retargets the expanded model split to the hovered hour', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.toggle').trigger('click')

    // With nothing hovered the split describes the peak, hour 47.
    expect(wrapper.find('.details').text()).toContain('di picco')
    expect(wrapper.findAll('.models li')[0].text()).toContain('49%')

    await pointer(wrapper, 'pointermove', PLOT_WIDTH * 0.25)
    expect(wrapper.find('.details').text()).toContain('selezionata')
    expect(wrapper.findAll('.models li')[0].text()).toContain('14%')
  })

  it('offers no plot at all when the ensemble is missing', () => {
    const wrapper = mount(StormPanel, {
      props: { hours: [hour({ stormProbability: null })], degraded: true },
    })

    expect(wrapper.find('.plot').exists()).toBe(false)
  })
})
