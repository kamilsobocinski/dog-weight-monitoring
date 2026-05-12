import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WeightScreen } from './WeightScreen'
import { NutritionScreen } from './NutritionScreen'
import { HealthScreen } from './HealthScreen'

export function DietWeightScreen({ dog, dogs, weights, onAdd, onDelete, onNavigate, onScan, onMedicalCard, onSelectDog }) {
  const { t } = useTranslation()
  const [subTab, setSubTab] = useState('nutrition')

  const SUB_TABS = [
    { id: 'nutrition', icon: '🥩', label: t('nav.nutrition') },
    { id: 'weight',    icon: '⚖️', label: t('nav.weight') },
    { id: 'health',    icon: '💉', label: t('nav.health') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gray-200)',
        paddingTop: 4,
        flexShrink: 0,
      }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 0 8px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: subTab === tab.id ? 700 : 500,
              color: subTab === tab.id ? 'var(--blue)' : 'var(--gray-400)',
              borderBottom: subTab === tab.id ? '2.5px solid var(--blue)' : '2.5px solid transparent',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub-screen */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {subTab === 'nutrition' && (
          <NutritionScreen dog={dog} weights={weights} />
        )}
        {subTab === 'weight' && (
          <WeightScreen dog={dog} weights={weights} onAdd={onAdd} onDelete={onDelete} />
        )}
        {subTab === 'health' && (
          <HealthScreen
            dog={dog} dogs={dogs}
            onSelectDog={onSelectDog}
            onNavigate={onNavigate}
            onScan={onScan}
            onMedicalCard={onMedicalCard}
          />
        )}
      </div>
    </div>
  )
}
