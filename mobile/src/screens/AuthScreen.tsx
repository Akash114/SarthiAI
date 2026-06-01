import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { ApiError, apiJson, type AuthTokenResponse } from '../api/client';
import type { AuthPasswordRegisterResponse } from '../api/types';
import { API_BASE_URL } from '../config';
import { Button, FixedScreen } from '../components';
import { useGoogleLogin } from '../hooks/mutations';
import { isGoogleAuthConfigured, useGoogleIdTokenAuth } from '../lib/googleAuth';
import { useSessionStore } from '../state/sessionStore';
import { useTheme } from '../theme';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

type Form = z.infer<typeof schema>;
type Mode = 'login' | 'register' | 'verify';

export function AuthScreen({ onAuthed }: { onAuthed?: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const [mode, setMode] = useState<Mode>('login');
  const [err, setErr] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (__DEV__ && devCode) setCode(devCode);
  }, [devCode]);

  const googleLogin = useGoogleLogin();
  const [googleRequest, googleResponse, promptGoogle] = useGoogleIdTokenAuth();
  const googleConfigured = isGoogleAuthConfigured();

  const applyTokens = async (tokens: AuthTokenResponse) => {
    useSessionStore.getState().setAccessToken(tokens.access_token);
    useSessionStore.getState().setUser(tokens.user);
    await useSessionStore.getState().saveRefreshToken(tokens.refresh_token);
  };

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) return;
    setErr(null);
    void (async () => {
      try {
        const tokens = await googleLogin.mutateAsync({ id_token: idToken });
        await applyTokens(tokens);
        onAuthed?.();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Google sign-in failed');
      }
    })();
  }, [googleResponse, googleLogin, onAuthed]);

  const onRegister = handleSubmit(
    async (values) => {
      setErr(null);
      try {
        const result = await apiJson<AuthPasswordRegisterResponse>('/v1/auth/password/register', {
          method: 'POST',
          json: { email: values.email, password: values.password },
        });
        setPendingEmail(result.email);
        setDevCode(result.verification_code ?? null);
        setMode('verify');
      } catch (e: unknown) {
        if (e instanceof ApiError) {
          const b = e.body as { message?: unknown; detail?: unknown } | null;
          const msg =
            typeof b?.message === 'string'
              ? b.message
              : typeof b?.detail === 'string'
                ? b.detail
                : e.message;
          setErr(msg);
        } else {
          setErr(e instanceof Error ? e.message : 'Register failed');
        }
      }
    },
    () => setErr('Fix email and password (password: 8–72 characters).'),
  );

  const onLogin = handleSubmit(
    async (values) => {
      setErr(null);
      try {
        const tokens = await apiJson<AuthTokenResponse>('/v1/auth/password/login', {
          method: 'POST',
          json: { email: values.email, password: values.password },
        });
        await applyTokens(tokens);
        onAuthed?.();
      } catch (e: unknown) {
        if (e instanceof ApiError) {
          const b = e.body as { message?: unknown; detail?: unknown } | null;
          const msg =
            typeof b?.message === 'string'
              ? b.message
              : typeof b?.detail === 'string'
                ? b.detail
                : e.message;
          setErr(msg);
        } else {
          setErr(e instanceof Error ? e.message : 'Login failed');
        }
      }
    },
    () => setErr('Fix email and password (password: 8–72 characters).'),
  );

  const onVerify = async () => {
    setErr(null);
    try {
      const tokens = await apiJson<AuthTokenResponse>('/v1/auth/password/verify', {
        method: 'POST',
        json: { email: pendingEmail || getValues('email'), code: code.trim() },
      });
      await applyTokens(tokens);
      onAuthed?.();
    } catch (e) {
      if (e instanceof ApiError) {
        const b = e.body as { message?: unknown; detail?: unknown } | null;
        setErr(typeof b?.message === 'string' ? b.message : typeof b?.detail === 'string' ? b.detail : e.message);
      } else {
        setErr(e instanceof Error ? e.message : 'Verification failed');
      }
    }
  };

  return (
    <FixedScreen>
      <View style={styles.root} testID="auth-root">
      <Text style={[typography.display, { color: colors.text, marginBottom: spacing.xs }]}>Sarthi</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {mode === 'verify' ? 'Confirm your email to continue.' : 'Your companion for high-output days.'}
      </Text>
      {mode !== 'verify' ? (
        <>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            testID="auth-email-input"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isSubmitting}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.email ? (
        <Text style={styles.fieldErr} testID="auth-email-error">
          {errors.email.message}
        </Text>
      ) : null}
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            testID="auth-password-input"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            editable={!isSubmitting}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password ? (
        <Text style={styles.fieldErr} testID="auth-password-error">
          {errors.password.message}
        </Text>
      ) : null}
        </>
      ) : (
        <View style={{ gap: spacing.sm, width: '100%' }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{pendingEmail}</Text>
          {devCode ? (
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Dev verification code</Text>
              <Text testID="auth-dev-code" style={{ color: colors.text, textAlign: 'center', fontWeight: '700' }}>
                {devCode}
              </Text>
            </View>
          ) : null}
          <TextInput
            testID="auth-code-input"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Verification code"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
        </View>
      )}
      {err ? (
        <Text testID="auth-error-text" style={styles.submitErr}>
          {err}
        </Text>
      ) : null}
      {isSubmitting ? <ActivityIndicator /> : null}
      {mode === 'verify' ? (
        <>
          <Button testID="auth-verify-btn" title="Verify email" onPress={onVerify} disabled={!code.trim()} />
          <Button title="Back to login" variant="ghost" onPress={() => setMode('login')} />
        </>
      ) : (
        <>
          <Button
            testID="auth-login-btn"
            title={mode === 'login' ? 'Login' : 'Create account'}
            onPress={mode === 'login' ? onLogin : onRegister}
            loading={isSubmitting}
          />
          <Button
            testID="auth-register-btn"
            title={mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
            variant="ghost"
            onPress={() => {
              setErr(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          />
          {googleConfigured ? (
            <Button
              testID="auth-google-btn"
              title="Continue with Google"
              variant="ghost"
              disabled={!googleRequest || googleLogin.isPending}
              loading={googleLogin.isPending}
              onPress={() => {
                setErr(null);
                void promptGoogle();
              }}
            />
          ) : null}
        </>
      )}
      {__DEV__ ? (
        <Text style={[styles.devHint, { color: colors.textMuted }]} testID="auth-api-url-hint">
          API: {API_BASE_URL}
        </Text>
      ) : null}
    </View>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12, justifyContent: 'center', alignItems: 'stretch' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  fieldErr: { color: '#b91c1c', fontSize: 13 },
  submitErr: { color: '#b91c1c' },
  devHint: { marginTop: 16, fontSize: 11, color: '#64748b' },
});
