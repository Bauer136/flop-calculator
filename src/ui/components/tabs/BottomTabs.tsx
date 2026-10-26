import { Suspense, lazy } from 'react'
import { type BottomTab, setTab, useResults } from '../../state/results.ts'
import { HotnessTab, NextCardTab } from './CardTabs.tsx'
import { CustomStatsTab } from './CustomStatsTab.tsx'
import { FlopBreakdownTab, PreflopStatsTab } from './PreflopTabs.tsx'
import styles from './Tabs.module.css'

// The chart tabs pull in Recharts, so they load on demand.
const EquityTab = lazy(() => import('./EquityTab.tsx').then((m) => ({ default: m.EquityTab })))
const GroupsTab = lazy(() => import('./GroupsTab.tsx').then((m) => ({ default: m.GroupsTab })))

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'equity', label: 'Equity' },
  { id: 'nextCard', label: 'Next card' },
  { id: 'hotness', label: 'Hotness' },
  { id: 'groups', label: 'Groups' },
  { id: 'customStats', label: 'Custom stats' },
  { id: 'preflopStats', label: 'Preflop stats' },
  { id: 'flopBreakdown', label: 'Flop breakdown' },
]

export function BottomTabs() {
  const tab = useResults((s) => s.tab)
  return (
    <section className={`panel ${styles.tabs}`} aria-label="Analysis tools">
      <div role="tablist" className={styles.tabList}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? styles.tabActive : styles.tabButton}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {tab === 'equity' && <EquityTab />}
          {tab === 'nextCard' && <NextCardTab />}
          {tab === 'hotness' && <HotnessTab />}
          {tab === 'groups' && <GroupsTab />}
          {tab === 'customStats' && <CustomStatsTab />}
          {tab === 'preflopStats' && <PreflopStatsTab />}
          {tab === 'flopBreakdown' && <FlopBreakdownTab />}
        </Suspense>
      </div>
    </section>
  )
}
