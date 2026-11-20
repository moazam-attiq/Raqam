import { Copy, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toast-context'
import { errorMessage } from '@/lib/api/errors'
import { QrCode } from './QrCode'
import {
  groupKey,
  useDisableTwoFactor,
  useEnableTwoFactor,
  useStartTwoFactorSetup,
  useTwoFactorStatus,
} from './security-api'
import type { TwoFactorSetup } from './security-api'

export function SecurityPage() {
  const status = useTwoFactorStatus()
  const start = useStartTwoFactorSetup()
  const disable = useDisableTwoFactor()
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  // Shown once, straight after turning on: the server cannot show them again.
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [confirmingOff, setConfirmingOff] = useState(false)
  const { notify } = useToast()

  function beginSetup() {
    start.mutate(undefined, {
      onSuccess: setSetup,
      onError: (error) => notify(errorMessage(error), 'error'),
    })
  }

  function turnOff() {
    disable.mutate(undefined, {
      onSuccess: () => {
        notify('Two-step verification is off', 'success')
        setConfirmingOff(false)
      },
      onError: (error) => {
        notify(errorMessage(error), 'error')
        setConfirmingOff(false)
      },
    })
  }

  const enabled = status.data?.enabled === true

  return (
    <>
      <PageHeader title="Security" description="Protect your account with a code from an authenticator app." />

      <Card>
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <ShieldCheck aria-hidden="true" className="size-5 text-brand" />
            <h2 className="text-lg font-semibold tracking-tight text-fg">Two-step verification</h2>
            {status.data && <Badge tone={enabled ? 'income' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>}
          </div>

          {recoveryCodes ? (
            <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
          ) : status.isPending ? (
            <div role="status" aria-label="Loading security settings" className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : status.isError ? (
            <ErrorState error={status.error} onRetry={() => status.refetch()} />
          ) : setup ? (
            <SetupSteps
              setup={setup}
              onCancel={() => setSetup(null)}
              onEnabled={(codes) => {
                setSetup(null)
                setRecoveryCodes(codes)
              }}
            />
          ) : enabled ? (
            <>
              <p className="max-w-prose text-sm text-muted">
                Signing in asks for a 6-digit code from your authenticator app after your password. If you lose your
                phone, use one of the recovery codes you saved.
              </p>
              <Button variant="danger" className="mt-4" onClick={() => setConfirmingOff(true)}>
                Turn off
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-prose text-sm text-muted">
                Add a second step to signing in: after your password, you enter a 6-digit code from an app such as
                Google Authenticator, Microsoft Authenticator or Authy.
              </p>
              <Button className="mt-4" loading={start.isPending} onClick={beginSetup}>
                Turn on
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmingOff}
        onOpenChange={setConfirmingOff}
        title="Turn off two-step verification?"
        description="Signing in will need only your password. Your recovery codes stop working, and turning it on again gives you a new key and new codes."
        confirmLabel="Turn off"
        pending={disable.isPending}
        onConfirm={turnOff}
      />
    </>
  )
}

function SetupSteps({
  setup,
  onCancel,
  onEnabled,
}: {
  setup: TwoFactorSetup
  onCancel: () => void
  onEnabled: (recoveryCodes: string[]) => void
}) {
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const enable = useEnableTwoFactor()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(digits)) {
      setFieldError('Enter the 6-digit code.')
      return
    }
    setFieldError(undefined)
    enable.mutate(digits, {
      onSuccess: (result) => onEnabled(result.recoveryCodes),
      onError: (error) => setFieldError(errorMessage(error)),
    })
  }

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="space-y-3">
        <QrCode text={setup.authenticatorUri} label="QR code for your authenticator app" />
      </div>

      <form onSubmit={submit} noValidate className="max-w-md space-y-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Open your authenticator app and scan the code, or type the key below.</li>
          <li>Enter the 6-digit code the app shows to finish.</li>
        </ol>

        <div>
          <p className="text-xs text-muted">Key to type in</p>
          <p className="mt-1 break-all font-mono text-sm text-fg" aria-label="Setup key">
            {groupKey(setup.sharedKey)}
          </p>
        </div>

        <FormField label="Authenticator code" error={fieldError}>
          {(field) => (
            <Input
              {...field}
              invalid={field['aria-invalid'] === true}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          )}
        </FormField>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={enable.isPending}>
            Turn on
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={enable.isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { notify } = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      notify('Recovery codes copied', 'success')
    } catch {
      notify('Could not copy. Select the codes and copy them by hand.', 'error')
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <p role="status" className="text-sm font-medium text-fg">
        Two-step verification is on. Save these recovery codes now.
      </p>
      <p className="text-sm text-muted">
        Each code works once if you lose access to your authenticator app. They are shown only here, only now.
      </p>
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-lg bg-sunken p-4 font-mono text-sm text-fg">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copy}>
          <Copy aria-hidden="true" />
          Copy codes
        </Button>
        <Button onClick={onDone}>I have saved them</Button>
      </div>
    </div>
  )
}
