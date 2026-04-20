import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';

import { ApiError, apiJson, type AuthTokenResponse } from '../api/client';
import { API_BASE_URL } from '../config';
import { useSessionStore } from '../state/sessionStore';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

type Form = z.infer<typeof schema>;

export function AuthScreen({ onAuthed }: { onAuthed?: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const defaultEmail = useMemo(() => `u${Date.now()}@test.dev`, []);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail, password: 'password123' },
  });

  const applyTokens = async (tokens: AuthTokenResponse) => {
    useSessionStore.getState().setAccessToken(tokens.access_token);
    await useSessionStore.getState().saveRefreshToken(tokens.refresh_token);
  };

  const onRegister = handleSubmit(
    async (values) => {
      setErr(null);
      try {
        const tokens = await apiJson<AuthTokenResponse>('/v1/auth/register', {
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
        const tokens = await apiJson<AuthTokenResponse>('/v1/auth/login', {
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

  return (
    <View style={styles.root} testID="auth-root">
      <Text style={styles.title}>Sarthi</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            testID="auth-email-input"
            style={styles.input}
            placeholder="Email"
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
            style={styles.input}
            placeholder="Password"
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
      {err ? (
        <Text testID="auth-error-text" style={styles.submitErr}>
          {err}
        </Text>
      ) : null}
      {isSubmitting ? <ActivityIndicator /> : null}
      <Pressable
        testID="auth-register-btn"
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={onRegister}
        disabled={isSubmitting}
      >
        <Text style={styles.btnLabel}>Register</Text>
      </Pressable>
      <View style={styles.spacer} />
      <Pressable
        testID="auth-login-btn"
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={onLogin}
        disabled={isSubmitting}
      >
        <Text style={styles.btnLabel}>Login</Text>
      </Pressable>
      {__DEV__ ? (
        <Text style={styles.devHint} testID="auth-api-url-hint">
          API: {API_BASE_URL}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  fieldErr: { color: '#b91c1c', fontSize: 13 },
  submitErr: { color: '#b91c1c' },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.85 },
  btnLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  devHint: { marginTop: 16, fontSize: 11, color: '#64748b' },
  spacer: { height: 8 },
});
