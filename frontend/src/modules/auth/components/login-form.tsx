'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLogin } from '../hooks/use-auth';
import { loginSchema, type LoginFormValues } from '../schemas/auth.schema';

/**
 * Login form component.
 * Uses React Hook Form + Zod for validation.
 * Handles API errors inline (not via toast).
 */
export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: login, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* API Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive-bg px-3 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error.message}</p>
        </div>
      )}

      {/* Identifier Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="identifier"
          className="text-sm font-medium text-foreground"
        >
          Email / Username / Phone
        </label>
        <input
          id="identifier"
          type="text"
          autoComplete="username"
          autoFocus
          disabled={isPending}
          aria-invalid={!!errors.identifier}
          aria-describedby={errors.identifier ? 'identifier-error' : undefined}
          {...register('identifier')}
          className={cn(
            'w-full rounded-md border bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors',
            errors.identifier
              ? 'border-destructive focus:ring-destructive/30'
              : 'border-input',
          )}
          placeholder="Enter your identifier"
        />
        {errors.identifier && (
          <p id="identifier-error" className="text-xs text-destructive">
            {errors.identifier.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={isPending}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors',
              errors.password
                ? 'border-destructive focus:ring-destructive/30'
                : 'border-input',
            )}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={isPending}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          'w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground',
          'hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-normal',
          'flex items-center justify-center gap-2',
        )}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
