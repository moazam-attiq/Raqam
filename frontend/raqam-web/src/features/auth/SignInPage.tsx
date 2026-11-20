import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { isApiError } from '@/lib/api/errors'
import { AuthLayout } from './AuthLayout'
import { authApi } from './auth-api'
import type { SignInResult } from './auth-api'
import { useSession, useStartSession } from './session'

type Step = 'password' | 'code' | 'recovery'

const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})
type Credentials = z.infer<typeof credentialsSchema>

const codeSchema = z.object({
  code: z.string().refine((value) => /^\d{6}$/.test(value.replace(/\s/g, '')), 'Enter the 6-digit code.'),
})
const recoverySchema = z.object({ code: z.string().trim().min(1, 'Enter a recovery code.') })
type CodeValues = z.infer<typeof codeSchema>

const wrongMessage: Record<Step, string> = {
  password: 'Email or password is incorrect.',
  code: 'That code is not valid. Check your authenticator app, or go back and sign in again if this took a while.',
  recovery: 'That recovery code is not valid or has already been used.',
}

const LOCKED_MESSAGE = 'Too many failed attempts. This account is locked for a few minutes. Try again later.'
const COOKIE_MESSAGE =
  'You signed in, but the browser did not keep the session. Run the app over HTTPS (see the README) and try again.'

/** A saved destination is only used if it stays inside this app. */
function safeDestination(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export function SignInPage() {
  const session = useSession()
  const location = useLocation()
  const destination = safeDestination(location.state)
  const [step, setStep] = useState<Step>('password')

  // Someone who is already signed in has no use for this screen.
  if (session.data) {
    return <Navigate to={destination} replace />
  }

  const copy: Record<Step, { title: string; description: string }> = {
    password: { title: 'Sign in', description: 'Welcome back. Enter your details to open your ledger.' },
    code: { title: 'Two-step verification', description: 'Enter the 6-digit code from your authenticator app.' },
    recovery: { title: 'Use a recovery code', description: 'Enter one of the recovery codes you saved when you turned on two-step verification.' },
  }

  return (
    <AuthLayout title={copy[step].title} description={copy[step].description}>
      {step === 'password' ? (
        <CredentialsForm onTwoFactor={() => setStep('code')} />
      ) : (
        <CodeForm
          key={step}
          mode={step}
          onSwitch={() => setStep(step === 'code' ? 'recovery' : 'code')}
          onBack={() => setStep('password')}
        />
      )}
    </AuthLayout>
  )
}

/** Turns a sign-in answer into the next move: continue, two-step, or a message for the person. */
function useOutcome(step: Step, onTwoFactor?: () => void) {
  const startSession = useStartSession()

  /** Returns the message to show, or null when the person moves on. */
  return async function handle(result: SignInResult): Promise<string | null> {
    if (result.lockedOut) {
      return LOCKED_MESSAGE
    }
    if (result.requiresTwoFactor && onTwoFactor) {
      onTwoFactor()
      return null
    }
    if (result.succeeded) {
      // Storing the user is what moves the person on: SignInPage then redirects (see its guard).
      const user = await startSession()
      return user ? null : COOKIE_MESSAGE
    }
    return wrongMessage[step]
  }
}

function requestMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.kind === 'tooManyRequests' ? 'Too many attempts. Wait a minute, then try again.' : error.message
  }
  return 'Something went wrong. Try again.'
}

function CredentialsForm({ onTwoFactor }: { onTwoFactor: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const handle = useOutcome('password', onTwoFactor)
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<Credentials>({ resolver: zodResolver(credentialsSchema), defaultValues: { email: '', password: '' } })

  useEffect(() => setFocus('email'), [setFocus])

  const signIn = useMutation({
    mutationFn: (values: Credentials) => authApi.signIn(values.email, values.password),
    onMutate: () => setFormError(null),
    onSuccess: async (result) => setFormError(await handle(result)),
    onError: (error) => setFormError(requestMessage(error)),
  })

  return (
    <form noValidate onSubmit={handleSubmit((values) => signIn.mutate(values))} className="space-y-4">
      <FormField label="Email" error={errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="username" {...register('email')} />}
      </FormField>
      <FormField label="Password" error={errors.password?.message}>
        {(field) => (
          <div className="relative">
            <Input
              {...field}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-11"
              {...register('password')}
            />
            <IconButton
              label={showPassword ? 'Hide password' : 'Show password'}
              icon={showPassword ? <EyeOff /> : <Eye />}
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute right-1 top-1"
            />
          </div>
        )}
      </FormField>
      <FormError message={formError} />
      <Button type="submit" loading={signIn.isPending} className="w-full">
        <LogIn />
        Sign in
      </Button>
    </form>
  )
}

function CodeForm({
  mode,
  onSwitch,
  onBack,
}: {
  mode: 'code' | 'recovery'
  onSwitch: () => void
  onBack: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const handle = useOutcome(mode)
  const isRecovery = mode === 'recovery'
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CodeValues>({ resolver: zodResolver(isRecovery ? recoverySchema : codeSchema), defaultValues: { code: '' } })

  useEffect(() => setFocus('code'), [setFocus])

  const verify = useMutation({
    mutationFn: ({ code }: CodeValues) =>
      isRecovery ? authApi.redeemRecoveryCode(code.trim()) : authApi.verifyCode(code.replace(/\s/g, '')),
    onMutate: () => setFormError(null),
    onSuccess: async (result) => setFormError(await handle(result)),
    onError: (error) => setFormError(requestMessage(error)),
  })

  return (
    <form noValidate onSubmit={handleSubmit((values) => verify.mutate(values))} className="space-y-4">
      <FormField label={isRecovery ? 'Recovery code' : 'Authenticator code'} error={errors.code?.message}>
        {(field) => (
          <Input
            {...field}
            type="text"
            inputMode={isRecovery ? 'text' : 'numeric'}
            autoComplete={isRecovery ? 'off' : 'one-time-code'}
            {...register('code')}
          />
        )}
      </FormField>
      <FormError message={formError} />
      <Button type="submit" loading={verify.isPending} className="w-full">
        {isRecovery ? <KeyRound /> : <ShieldCheck />}
        {isRecovery ? 'Use recovery code' : 'Verify'}
      </Button>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft />
          Back to sign in
        </Button>
        <Button variant="ghost" size="sm" onClick={onSwitch}>
          {isRecovery ? 'Use authenticator code' : 'Use a recovery code'}
        </Button>
      </div>
    </form>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null
  }
  return (
    <p role="alert" className="rounded-lg border border-danger/40 bg-expense-soft px-3 py-2 text-sm text-fg">
      {message}
    </p>
  )
}
