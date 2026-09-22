import { useEffect, useState } from 'react'
import { Card } from '@renderer/components/Card'
import { PageHeader } from '@renderer/components/PageHeader'
import { Toggle } from '@renderer/components/Toggle'
import type { AppSettings } from '@shared/types'

export function SettingsScreen(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    void window.api
      .getAppSettings()
      .then((next) => {
        if (!stop) setSettings(next)
      })
      .catch(() => {
        if (!stop) setError('Не удалось прочитать настройки')
      })
    return () => {
      stop = true
    }
  }, [])

  async function update(patch: Partial<AppSettings>): Promise<void> {
    setError(null)
    try {
      setSettings(await window.api.setAppSettings(patch))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeader kicker="Настройки" title="Запуск" />
      <Card>
        <SettingRow
          title="Автозагрузка"
          text="Запускать вместе с Windows"
          on={Boolean(settings?.openAtLogin)}
          disabled={!settings}
          onChange={(openAtLogin) => void update({ openAtLogin })}
        />
        <div className="my-6 h-px bg-line" />
        <SettingRow
          title="Запуск в трее"
          text="Открывать без окна. Закрытие прячет программу в трей"
          on={Boolean(settings?.startInTray)}
          disabled={!settings}
          onChange={(startInTray) => void update({ startInTray })}
        />
        {error ? <p className="mt-5 text-sm text-bad">{error}</p> : null}
      </Card>
    </div>
  )
}

function SettingRow({
  title,
  text,
  on,
  disabled,
  onChange
}: {
  title: string
  text: string
  on: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-[22px] font-semibold tracking-tight">{title}</p>
        <p className="mt-2 text-[15px] text-muted">{text}</p>
      </div>
      <Toggle on={on} disabled={disabled} onChange={onChange} />
    </div>
  )
}
