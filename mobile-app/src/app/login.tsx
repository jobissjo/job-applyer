import { useState } from "react";
import { authApi } from "@/services/api";
import { Text, View } from "react-native";
import { useSession } from "@/providers/session";
import { useAction } from "@/hooks/use-resource";
import { Button, Card, Feedback, Field, Page, styles } from "@/components/ui";
export default function Login() {
  const { signIn } = useSession();
  const action = useAction();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Page
      title={register ? "Start your next chapter." : "Welcome back."}
      subtitle="Thoughtful applications. New opportunities."
    >
      <View
        style={[
          styles.card,
          { backgroundColor: "#edf4ee", paddingVertical: 30 },
        ]}
      >
        <Text style={styles.brand}>ApplyPilot.</Text>
        <Text style={styles.h2}>
          Your experience deserves{"\n"}the right opportunity.
        </Text>
        <Text style={styles.muted}>
          Find your fit, prepare an application, and keep your job search
          moving.
        </Text>
      </View>
      <Card
        title={verifying ? "Verify your email" : register ? "Create your account" : "Sign in to your workspace"}
      >
        <Field
          label="Email address"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          editable={!action.busy}
        />
        {!verifying && <Field
          label="Password"
          secureTextEntry
          autoComplete={register ? "new-password" : "current-password"}
          value={password}
          onChangeText={setPassword}
          editable={!action.busy}
        />}
        {verifying && <>
          <Text style={styles.muted}>Enter the six-digit code from your inbox. It expires in 10 minutes. Check spam too.</Text>
          <Field label="Verification code" value={code} onChangeText={setCode} editable={!action.busy} />
        </>}
        <Feedback {...action} />
        {!!notice && <Text style={styles.muted}>{notice}</Text>}
        <Button
          label={
            action.busy
              ? "Connecting…"
              : verifying ? "Verify email" : register
                ? "Create account"
                : "Sign in"
          }
          disabled={action.busy || !email.trim() || (verifying ? !/^\d{6}$/.test(code.trim()) : !password)}
          onPress={() => {
            void action.run(async () => {
              setNotice("");
              if (verifying) {
                const result = await authApi.verifyEmail(email.trim(), code.trim());
                setVerifying(false); setRegister(false); setCode("");
                setNotice(result.message);
                return;
              }
              if (register) {
                await authApi.register(email.trim(), password);
                setVerifying(true); setPassword("");
                setNotice("Check your email for a verification code.");
                return;
              }
              await signIn(email, password);
            });
          }}
        />
        <Button label={verifying ? "Resend code" : "Verify email / resend code"} secondary disabled={action.busy || !email.trim()}
          onPress={() => { void action.run(async () => {
            setNotice("");
            const result = await authApi.resendVerification(email.trim());
            setVerifying(true);
            setNotice(result.message);
          }); }} />
        {verifying && <Text style={styles.muted}>Wait 60 seconds between requests. Only the latest code works.</Text>}
        <Button
          label={
            verifying ? "Back to sign in" : register
              ? "Already have an account? Sign in"
              : "New here? Create an account"
          }
          secondary
          disabled={action.busy}
          onPress={() => { setVerifying(false); setRegister(verifying ? false : !register); }}
        />
      </Card>
    </Page>
  );
}
